import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
];

const MAX_ATTEMPTS_PER_MODEL = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ChecklistItem = {
  id: string;
  item: string;
  question: string;
  found_issue: string;
};

type AiResponse = {
  checklist: ChecklistItem[];
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
    round?: number;
    descriptions?: Record<string, string>;
    previousChecklist?: Array<{
      id: string;
      item: string;
      question: string;
      found_issue: string;
      answer?: boolean;
    }>;
    previousAnswers?: Record<string, boolean>;
    previousUnresolved?: Array<{
      item: string;
      question: string;
      found_issue: string;
      solved: boolean;
      note: string;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { round, descriptions, previousChecklist, previousAnswers, previousUnresolved } = body;
  if (round == null) {
    return NextResponse.json(
      { error: "Missing required field: round." },
      { status: 400 },
    );
  }

  let prompt: string;

  if (round === 1) {
    if (!descriptions || Object.keys(descriptions).length === 0) {
      return NextResponse.json(
        { error: "Round 1 requires at least one area description." },
        { status: 400 },
      );
    }
    const descText = Object.entries(descriptions)
      .map(([area, desc]) => `[${area}]: ${desc}`)
      .join("\n");
    prompt = [
      "You are a quality control expert for a hospitality company.",
      "An inspector completed Round 1 of a quality walkthrough.",
      "Below are descriptions written for each area with issues noted at specific times.",
      "Analyze the issues and create a checklist for Round 2 to verify if issues have been resolved.",
      "For each issue, create: item (area name), question (specific verification question), found_issue (what was found).",
      "Respond ONLY with a valid JSON object with this exact shape:",
      '{"checklist": [{"id": "1", "item": "...", "question": "...", "found_issue": "..."}]}',
      "Each item must have a unique numeric string id starting from \"1\".",
      "",
      "Area descriptions:",
      descText,
      ...(previousUnresolved && previousUnresolved.length > 0 ? [
        "",
        "IMPORTANT: The inspector also carried forward unresolved issues from a PREVIOUS inspection.",
        "For items marked SOLVED — still include them in the checklist so the inspector can verify the fix.",
        "For items marked NOT SOLVED — include them with priority so they are re-checked.",
        "",
        "Previous unresolved issues:",
        ...previousUnresolved.map((i) => {
          const status = i.solved ? "SOLVED (verify fix)" : "NOT SOLVED (priority re-check)";
          return `- [${status}] Item: ${i.item} | Q: ${i.question} | Found: ${i.found_issue}${i.note ? ` | Inspector note: ${i.note}` : ""}`;
        }),
      ] : []),
    ].join("\n");
  } else {
    if (!previousChecklist || previousChecklist.length === 0) {
      return NextResponse.json(
        { error: `Round ${round} requires a previous checklist.` },
        { status: 400 },
      );
    }
    const resolved: typeof previousChecklist = [];
    const unresolved: typeof previousChecklist = [];
    for (const item of previousChecklist) {
      if (item.answer === true) {
        resolved.push(item);
      } else {
        unresolved.push(item);
      }
    }
    const resolvedText =
      resolved.length > 0
        ? resolved.map((i) => `- [RESOLVED] Item: ${i.item} | Q: ${i.question} | Found: ${i.found_issue}`).join("\n")
        : "(none)";
    const unresolvedText =
      unresolved.length > 0
        ? unresolved.map((i) => `- [UNRESOLVED] Item: ${i.item} | Q: ${i.question} | Found: ${i.found_issue}`).join("\n")
        : "(none)";
    prompt = [
      "You are a quality control expert for a hospitality company.",
      `An inspector completed Round ${round}.`,
      "Below are the previous checklist items with yes/no answers.",
      "Unresolved items need follow-up. Create a focused checklist for the next round.",
      "Respond ONLY with a valid JSON object with this exact shape:",
      '{"checklist": [{"id": "1", "item": "...", "question": "...", "found_issue": "..."}]}',
      "Each item must have a unique numeric string id starting from \"1\".",
      "",
      "Resolved items:",
      resolvedText,
      "",
      "Unresolved items:",
      unresolvedText,
    ].join("\n");
  }

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

          const checklist = (result?.checklist ?? []).filter(
            (c) => c.item || c.question || c.found_issue,
          );

          return NextResponse.json({
            checklist: checklist.length > 0 ? checklist : [],
          } satisfies AiResponse);
        }

        const errText = await res.text();
        lastError = `Gemini API error ${res.status}: ${errText.slice(0, 300)}`;

        if (res.status === 429 || res.status === 503) {
          continue;
        }
        if (res.status === 404) {
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
