import { NextRequest, NextResponse } from "next/server";
import { STANDARDS_BY_DEPARTMENT, STANDARD_LABELS } from "@/lib/guidelines";

const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
];

const MAX_ATTEMPTS_PER_MODEL = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type HasmAiResponse = {
  title: string;
  hazard: string;
  why: string;
  risks: string[];
  corrective_actions: string[];
  safety_precautions: string[];
  standards: string[];
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: { imageBase64?: string; imageMime?: string; details?: string; location?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { imageBase64, imageMime, details, location } = body;

  const imageB64 = (imageBase64 ?? "").trim();
  if (imageB64.length === 0 && !(details ?? "").trim()) {
    return NextResponse.json(
      { error: "Add a photo or some details about the hazard." },
      { status: 400 },
    );
  }
  if (imageB64 && imageB64.length > MAX_IMAGE_BYTES * 1.4) {
    return NextResponse.json(
      { error: "The photo is too large. Please upload a smaller image." },
      { status: 413 },
    );
  }

  // All standards maintained inside the portal (per-department ISO lists).
  const allStandards = [...new Set(Object.values(STANDARDS_BY_DEPARTMENT).flat())];
  const standardsText = allStandards
    .map((s) => `${s} – ${STANDARD_LABELS[s] ?? ""}`)
    .join("\n");

  const prompt = [
    "You are the HASM (Hazard Analysis and Safety Management) assistant for a hospitality company.",
    "You will be given a PHOTO of a hazard and some short notes from an employee.",
    "Analyze the hazard and produce a short, to-the-point report that a beginner can easily understand.",
    "",
    "Do exactly the following, nothing else:",
    "1. Give this hazard a short, clear TITLE.",
    "2. Describe WHAT the hazard is in 1-2 simple sentences.",
    "3. Explain WHY it is dangerous (how it can harm people, property or the business) in simple beginner-friendly English.",
    "4. List 2-4 realistic RISKS (to people, property or compliance).",
    "5. List 2-4 short CORRECTIVE ACTIONS to fix the hazard right now.",
    "6. List 2-4 SAFETY PRECAUTIONS to stop it from happening again.",
    "7. Pick the 1-3 MOST RELEVANT standards from the company standards list below.",
    "",
    "Rules:",
    "- Use simple, plain, easy English. No jargon. Short sentences.",
    "- Keep it concise and to the point, NOT a long detailed report.",
    "- Corrective actions and safety precautions must be practical for a hotel.",
    '- The "standards" array must only contain exact standard codes from the list below.',
    "",
    "Respond ONLY with a valid JSON object with this exact shape:",
    '{"title": "...", "hazard": "...", "why": "...", "risks": ["..."], "corrective_actions": ["..."], "safety_precautions": ["..."], "standards": ["ISO 45001:2018"]}',
    "",
    "Company standards:",
    standardsText,
    "",
    location ? `Location / area where the hazard was found: ${location}` : "",
    details ? `Employee notes: ${details}` : "",
    imageB64 ? "The first attached part is the photo of the hazard. Use it as the main source of truth." : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const parts: Array<Record<string, unknown>> = [];
  if (imageB64) {
    parts.push({
      inline_data: {
        mime_type: imageMime || "image/jpeg",
        data: imageB64,
      },
    });
  }
  parts.push({ text: prompt });

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
                contents: [{ role: "user", parts }],
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
          const parsed = parseJson(text);
          if (parsed && (parsed.title || parsed.hazard)) {
            return NextResponse.json({
              report: {
                title: parsed.title ?? "",
                hazard: parsed.hazard ?? "",
                why: parsed.why ?? "",
                risks: Array.isArray(parsed.risks) ? parsed.risks : [],
                corrective_actions: Array.isArray(parsed.corrective_actions)
                  ? parsed.corrective_actions
                  : [],
                safety_precautions: Array.isArray(parsed.safety_precautions)
                  ? parsed.safety_precautions
                  : [],
                standards: Array.isArray(parsed.standards) ? parsed.standards : [],
              } satisfies HasmAiResponse,
            });
          }
          lastError = "The AI response could not be parsed. Please try again.";
          continue;
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

function parseJson(text: string): HasmAiResponse | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as HasmAiResponse;
  } catch {
    return null;
  }
}
