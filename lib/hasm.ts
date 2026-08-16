export type HasmRecord = {
  id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  status: "resolved" | "unresolved" | null;
  report: string | null;
  ai_json: Record<string, unknown> | null;
  pictures: string[] | null;
  drive_links: string[] | null;
  created_at: string;
  resolved_at: string | null;
};

/** Structured report returned by the AI (and stored in ai_json). */
export type HasmReport = {
  title: string;
  hazard: string;
  why: string;
  risks: string[];
  corrective_actions: string[];
  safety_precautions: string[];
  standards: string[];
};

export const HASM_STATUS = ["unresolved", "resolved"] as const;

export function isResolved(record: {
  status: string | null;
  resolved_at: string | null;
}): boolean {
  return record.status === "resolved" || !!record.resolved_at;
}

export function asHasmReport(json: Record<string, unknown> | null): HasmReport | null {
  if (!json) return null;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const title = str(json.title).trim();
  const hazard = str(json.hazard).trim();
  const why = str(json.why).trim();
  if (!title && !hazard) return null;
  return {
    title,
    hazard,
    why,
    risks: arr(json.risks),
    corrective_actions: arr(json.corrective_actions),
    safety_precautions: arr(json.safety_precautions),
    standards: arr(json.standards),
  };
}

/** Plain-text version of the report, used for the `report` column + PDFs. */
export function formatHasmReport(report: HasmReport): string {
  const lines: string[] = [];
  lines.push(`HAZARD: ${report.hazard || "—"}`);
  lines.push("");
  lines.push(`WHY IT IS A HAZARD: ${report.why || "—"}`);
  lines.push("");
  lines.push("RISKS:");
  if (report.risks.length === 0) lines.push("- —");
  for (const r of report.risks) lines.push(`- ${r}`);
  lines.push("");
  lines.push("CORRECTIVE ACTIONS:");
  if (report.corrective_actions.length === 0) lines.push("- —");
  for (const r of report.corrective_actions) lines.push(`- ${r}`);
  lines.push("");
  lines.push("SAFETY PRECAUTIONS:");
  if (report.safety_precautions.length === 0) lines.push("- —");
  for (const r of report.safety_precautions) lines.push(`- ${r}`);
  if (report.standards.length > 0) {
    lines.push("");
    lines.push(`RELEVANT STANDARDS: ${report.standards.join(", ")}`);
  }
  return lines.join("\n");
}

/** Convert a Drive `/view` link into a direct image URL that can be <img>-ed or fetched. */
export function driveImageUrl(link: string): string {
  const m = link.match(/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  return link;
}

/** Turn a Drive view link into a thumbnail URL (faster to render in lists). */
export function driveThumbUrl(link: string): string {
  const m = link.match(/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400`;
  return link;
}

const PROXYABLE_HOSTS = new Set([
  "drive.google.com",
  "drive.usercontent.google.com",
  "usercontent.google.com",
  "lh3.googleusercontent.com",
  "lh5.googleusercontent.com",
]);

/**
 * Google Drive image URLs can be blocked in browsers (CORS for fetch,
 * HTML interstitials for <img>). Route them through our own proxy so
 * they always render and can be embedded in PDFs.
 */
export function imageProxyUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (PROXYABLE_HOSTS.has(parsed.hostname)) {
      return `/api/drive/image?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // not a valid URL -> leave as-is
  }
  return url;
}

/** Extract Google Drive file IDs from stored view/uc links. */
export function driveFileIds(links: (string | null | undefined)[] | null): string[] {
  const ids = new Set<string>();
  for (const link of links ?? []) {
    if (!link) continue;
    const m =
      link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) ids.add(m[1]);
  }
  return [...ids];
}

export function dateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
