import { NextRequest, NextResponse } from "next/server";
import {
  GUIDELINES_BY_DEPARTMENT,
  STANDARDS_BY_DEPARTMENT,
  STANDARD_LABELS,
} from "@/lib/guidelines";

const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
];

const MAX_ATTEMPTS_PER_MODEL = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type IncidentAiResponse = {
  sop: { name: string; standard: string; clause: string } | null;
  iso_standards: string[];
  capa: {
    immediate_correction: string;
    corrective_action: string;
    preventive_action: string;
  };
};

type IncidentInput = {
  incidentType?: string;
  severity?: string;
  departmentName?: string;
  location?: string;
  title?: string;
  description?: string;
  peopleInvolved?: string;
  witnesses?: string;
  injury?: string;
  propertyDamage?: string;
  guestImpact?: string;
  foodSafetyImpact?: string;
  operationalImpact?: string;
  immediateCause?: string;
  rootCause?: string;
  contributingFactors?: string;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: IncidentInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    incidentType,
    severity,
    departmentName,
    location,
    title,
    description,
    peopleInvolved,
    witnesses,
    injury,
    propertyDamage,
    guestImpact,
    foodSafetyImpact,
    operationalImpact,
    immediateCause,
    rootCause,
    contributingFactors,
  } = body;

  if (!(title ?? "").trim() && !(description ?? "").trim()) {
    return NextResponse.json(
      { error: "Add an incident title or a description first." },
      { status: 400 },
    );
  }

  // Organization SOPs + ISO standards available to the selected department.
  const orgSops =
    GUIDELINES_BY_DEPARTMENT[departmentName ?? ""] ??
    GUIDELINES_BY_DEPARTMENT["Compliance"];
  const sopsText = orgSops
    .map((s) => `- ${s.name} (${s.standard} – ${s.clause})`)
    .join("\n");

  const allowed =
    STANDARDS_BY_DEPARTMENT[departmentName ?? ""] ??
    [...new Set(Object.values(STANDARDS_BY_DEPARTMENT).flat())];
  const standardsText = [...new Set(allowed)]
    .map((s) => `${s} – ${STANDARD_LABELS[s] ?? ""}`)
    .join("\n");

  const facts = [
    `Incident type: ${incidentType || "Not provided"}`,
    `Severity: ${severity || "Not provided"}`,
    `Department: ${departmentName || "Not provided"}`,
    `Location / area: ${location || "Not provided"}`,
    `Incident title: ${title || "Not provided"}`,
    `Description: ${description || "Not provided"}`,
    `People involved: ${peopleInvolved || "Not provided"}`,
    `Witnesses: ${witnesses || "Not provided"}`,
    `Injury impact: ${injury || "Not provided"}`,
    `Property damage impact: ${propertyDamage || "Not provided"}`,
    `Guest impact: ${guestImpact || "Not provided"}`,
    `Food-safety impact: ${foodSafetyImpact || "Not provided"}`,
    `Operational/business impact: ${operationalImpact || "Not provided"}`,
    `Immediate cause: ${immediateCause || "Not provided"}`,
    `Root cause: ${rootCause || "Not provided"}`,
    `Contributing factors: ${contributingFactors || "Not provided"}`,
  ].join("\n");

  const prompt = [
    "You are the Incident Investigation and CAPA assistant for a hospitality company.",
    "Read ALL of the incident facts below and produce a short, simple, beginner-friendly analysis.",
    "Do exactly the following, nothing else:",
    "1. Pick the SINGLE most relevant SOP from the organization SOP list and return its exact name, its standard code and its clause.",
    "2. Pick 1-3 most relevant ISO standards/clauses from the company standards list below. Format each as \"ISO CODE – Clause number (clause name)\" using the exact standard codes.",
    "3. Build a practical CAPA plan in plain, easy English:",
    '   - "immediate_correction": what to do RIGHT NOW to contain the situation.',
    '   - "corrective_action": how to fix the underlying problem properly.',
    '   - "preventive_action": how to stop it happening again long-term.',
    "",
    "Rules:",
    "- Use simple, plain, easy English. No jargon. Short sentences.",
    "- Everything must be practical for a hotel.",
    "- The SOP must be one of the exact names from the organization SOP list.",
    '- The "iso_standards" array must only use exact standard codes from the list below.',
    "",
    "Respond ONLY with a valid JSON object with this exact shape:",
    '{"sop": {"name": "...", "standard": "ISO ...", "clause": "..."}, "iso_standards": ["ISO 45001:2018 – 6.1.2 (Hazard identification)"], "capa": {"immediate_correction": "...", "corrective_action": "...", "preventive_action": "..."}}',
    "",
    "Incident facts:",
    facts,
    "",
    "Organization SOPs:",
    sopsText,
    "",
    "Company standards:",
    standardsText,
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
                contents: [
                  {
                    role: "user",
                    parts: [{ text: prompt }],
                  },
                ],
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
          if (parsed && (parsed.sop || parsed.capa)) {
            return NextResponse.json({
              suggestions: {
                sop: parsed.sop ?? null,
                iso_standards: Array.isArray(parsed.iso_standards)
                  ? parsed.iso_standards
                  : [],
                capa: {
                  immediate_correction: parsed.capa?.immediate_correction ?? "",
                  corrective_action: parsed.capa?.corrective_action ?? "",
                  preventive_action: parsed.capa?.preventive_action ?? "",
                },
              },
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

function parseJson(text: string): IncidentAiResponse | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as {
      sop?: { name?: string; standard?: string; clause?: string } | null;
      iso_standards?: unknown;
      capa?: {
        immediate_correction?: string;
        corrective_action?: string;
        preventive_action?: string;
      };
    };
    const sopName = (raw.sop?.name ?? "").trim();
    const capa = raw.capa;
    const capaOk =
      capa &&
      (capa.immediate_correction ||
        capa.corrective_action ||
        capa.preventive_action);
    if (!sopName && !capaOk) return null;
    return {
      sop: sopName
        ? {
            name: sopName,
            standard: (raw.sop?.standard ?? "").trim(),
            clause: (raw.sop?.clause ?? "").trim(),
          }
        : null,
      iso_standards: Array.isArray(raw.iso_standards)
        ? raw.iso_standards.filter((x): x is string => typeof x === "string")
        : [],
      capa: {
        immediate_correction: capa?.immediate_correction ?? "",
        corrective_action: capa?.corrective_action ?? "",
        preventive_action: capa?.preventive_action ?? "",
      },
    };
  } catch {
    return null;
  }
}
