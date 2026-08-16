import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
];

const MAX_ATTEMPTS_PER_MODEL = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type AiAnalysis = {
  rephrased: string;
  clause_number: string;
  clause_name: string;
  corrective_action: string;
  preventive_action: string;
  root_cause: string;
  consequences: string;
  standard?: string;
};

type AiResponse = {
  analyses: AiAnalysis[];
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: {
    issue?: string;
    department?: string;
    standard?: string;
    clause?: string;
    standards?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { issue, department, standard, clause, standards } = body;
  if (!issue || !department) {
    return NextResponse.json(
      { error: "Missing required fields: issue, department." },
      { status: 400 },
    );
  }

  const applicable =
    Array.isArray(standards) && standards.length > 0 ? standards : standard ? [standard] : [];

  const prompt = [
    "You are the AI Auditor for a hospitality company.",
    "You will be given a raw issue reported in a department.",
    "Do exactly the following, nothing else:",
    `1. Rewrite the issue in simple, clear, plain English. Use the SAME rephrased wording for every standard.`,
    `2. For EACH applicable standard listed below, decide which clause NUMBER and clause NAME of that standard the issue violates.`,
    `3. For EACH applicable standard, give the simplest, shortest CORRECTIVE ACTION to fix the issue right now.`,
    `4. For EACH applicable standard, give the simplest, shortest PREVENTIVE ACTION to stop it from happening again.`,
    `5. For EACH applicable standard, state the most likely ROOT CAUSE in one short sentence.`,
    `6. For EACH applicable standard, state the operational/compliance CONSEQUENCES if left unresolved, in one short sentence.`,
    "Respond ONLY with a valid JSON object with this exact shape:",
    '{"analyses": [{"standard": "...", "clause_number": "...", "clause_name": "...", "rephrased": "...", "corrective_action": "...", "preventive_action": "...", "root_cause": "...", "consequences": "..."}]}',
    'Provide exactly ONE "analyses" entry per applicable standard. The "standard" key must contain the exact name of that standard (e.g. "ISO 9001:2015").',
    "",
    `Department: ${department}`,
    applicable.length > 0
      ? `Applicable standards (one analysis entry required for EACH of these): ${applicable.join("; ")}`
      : "No specific standard was selected. Provide a single analysis and pick the most appropriate clause yourself.",
    standard ? `Selected standard: ${standard}` : "",
    clause ? `Reference clause: ${clause}` : "",
    `Reported issue: ${issue}`,
  ].join("\n");

  try {
    let lastError = "";
    for (const model of GEMINI_MODELS) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt++) {
        if (attempt > 0) await sleep(1000 * attempt);

        let res: Response;
        try {
          res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.4,
                  maxOutputTokens: 2048,
                  thinkingConfig: { thinkingBudget: 0 },
                },
              }),
              signal: AbortSignal.timeout(60000),
            },
          );
        } catch (e) {
          lastError = `Request failed: ${e instanceof Error ? e.message : String(e)}`;
          continue;
        }

        if (res.ok) {
          const data = await res.json();
          const text: string =
            data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";

          const result = parseJson(text);
          const legacy = result as unknown as Record<string, string | undefined>;

          const analyses = (result?.analyses ?? []).filter(
            (a) => a.clause_number || a.clause_name || a.rephrased,
          );

          return NextResponse.json({
            analyses:
              analyses.length > 0
                ? analyses
                : [
                    {
                      rephrased: legacy.rephrased ?? "",
                      clause_number: legacy.clause_number ?? "",
                      clause_name: legacy.clause_name ?? "",
                      standard: legacy.standard ?? "",
                      corrective_action: legacy.corrective_action ?? "",
                      preventive_action: legacy.preventive_action ?? "",
                      root_cause: legacy.root_cause ?? "",
                      consequences: legacy.consequences ?? "",
                    },
                  ],
          } satisfies AiResponse);
        }

        const errText = await res.text();
        lastError = `Gemini API error ${res.status}: ${errText.slice(0, 300)}`;

        if (res.status === 429 || res.status === 503) {
          // transient capacity/rate-limit error -> retry same model, then next model
          continue;
        }
        if (res.status === 404) {
          // model not available for this key -> try next model
          break;
        }
        return NextResponse.json({ error: lastError }, { status: 502 });
      }
    }
    return NextResponse.json(
      { error: `AI is temporarily overloaded. Please try again in a moment. ${lastError}` },
      { status: 503 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: `AI request failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}

function parseJson(text: string): AiResponse | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as AiResponse;
  } catch {
    return null;
  }
}
