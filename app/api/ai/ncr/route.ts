import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
];

const MAX_ATTEMPTS_PER_MODEL = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type AiResult = {
  rephrased: string;
  clause_number: string;
  clause_name: string;
  corrective_action: string;
  preventive_action: string;
  root_cause: string;
  consequences: string;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: { issue?: string; department?: string; standard?: string; clause?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { issue, department, standard, clause } = body;
  if (!issue || !department || !standard) {
    return NextResponse.json(
      { error: "Missing required fields: issue, department, standard." },
      { status: 400 },
    );
  }

  const prompt = [
    "You are a professional ISO compliance auditor for a hospitality company.",
    "You will be given a raw issue reported in a department.",
    "Do exactly the following, nothing else:",
    `1. Rewrite the issue in simple, clear, plain English.`,
    `2. Identify the most relevant clause NUMBER and clause NAME from the selected standard or guideline that this issue violates.`,
    `3. Give the simplest, shortest CORRECTIVE ACTION to fix the issue right now.`,
    `4. Give the simplest, shortest PREVENTIVE ACTION to stop it from happening again.`,
    `5. State the most likely ROOT CAUSE of the issue in one short sentence.`,
    `6. State the operational/compliance CONSEQUENCES if left unresolved, in one short sentence.`,
    "Respond ONLY with a valid JSON object with these exact keys:",
    '{"rephrased": "...", "clause_number": "...", "clause_name": "...", "corrective_action": "...", "preventive_action": "...", "root_cause": "...", "consequences": "..."}',
    "",
    `Department: ${department}`,
    `Selected standard/guideline: ${standard}`,
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

          return NextResponse.json({
            rephrased: result?.rephrased ?? "",
            clause_number: result?.clause_number ?? "",
            clause_name: result?.clause_name ?? "",
            corrective_action: result?.corrective_action ?? "",
            preventive_action: result?.preventive_action ?? "",
            root_cause: result?.root_cause ?? "",
            consequences: result?.consequences ?? "",
          } satisfies AiResult);
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

function parseJson(text: string): AiResult | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as AiResult;
  } catch {
    return null;
  }
}
