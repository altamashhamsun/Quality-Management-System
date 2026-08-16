import { jsPDF } from "jspdf";

export type AuditPlanPdfData = {
  title: string;
  reference: string;
  dateRange: string;
  departments: string[];
  content: Record<string, string> | null;
  leadAuditor?: string;
};

export const PLAN_SECTION_KEYS = [
  "objectives",
  "scope",
  "criteria",
  "risk_assessment",
  "procedures",
  "timeline",
  "team_resources",
] as const;

export const PLAN_SECTION_LABELS: Record<string, string> = {
  objectives: "Audit Objectives",
  scope: "Audit Scope",
  criteria: "Audit Criteria",
  risk_assessment: "Risk Assessment",
  procedures: "Audit Procedures & Methods",
  timeline: "Timeline",
  team_resources: "Audit Team & Resources",
};

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const MAX_W = PAGE_W - MARGIN * 2;
const BOTTOM = 16;

const DARK: readonly [number, number, number] = [22, 22, 30];
const ACCENT: readonly [number, number, number] = [200, 30, 40];
const INK: readonly [number, number, number] = [26, 26, 34];
const BODY: readonly [number, number, number] = [52, 52, 62];
const MUTED: readonly [number, number, number] = [130, 130, 140];
const LIGHT: readonly [number, number, number] = [247, 247, 250];
const BORDER: readonly [number, number, number] = [218, 218, 224];

function htmlToText(html: string): string {
  if (!html) return "";
  const text = html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/li>/gi, "")
    .replace(/<\/?(?:ul|ol)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'");
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  for (const chunk of text.split("\n")) {
    const wrapped = doc.splitTextToSize(chunk, maxWidth) as string[];
    lines.push(...wrapped);
  }
  return lines;
}

export function downloadAuditPlanPdf(plan: AuditPlanPdfData) {
  const doc = new jsPDF("p", "mm", "a4");
  let y = 0;

  const newPage = (top = 22) => {
    doc.addPage();
    y = top;
  };

  const ensure = (need: number) => {
    if (PAGE_H - y - BOTTOM < need) newPage();
  };

  const sectionHeader = (title: string) => {
    ensure(24);
    y += 4;
    doc.setFillColor(...ACCENT);
    doc.rect(MARGIN, y - 4.5, 2.4, 5.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    doc.text(title, MARGIN + 6, y);
    y += 3;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    doc.setLineWidth(0.2);
    y += 7;
  };

  const body = (text: string, lineH = 5) => {
    const lines = wrapLines(doc, text, MAX_W);
    if (lines.length === 0) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...BODY);
    for (const line of lines) {
      ensure(lineH + 4);
      doc.text(line, MARGIN, y);
      y += lineH;
    }
    y += 3;
  };

  const emptyBox = (message: string) => {
    ensure(18);
    doc.setDrawColor(205, 205, 212);
    doc.setFillColor(250, 250, 252);
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(MARGIN, y, MAX_W, 12, "FD");
    doc.setLineDashPattern([], 0);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 160);
    doc.text(message, MARGIN + 4, y + 7.5);
    y += 17;
  };

  // ---- COVER HEADER ----
  doc.setFillColor(...DARK);
  doc.rect(0, 0, PAGE_W, 30, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(0, 30, PAGE_W, 2.2, "F");

  doc.setTextColor(235, 235, 240);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("QUALITY AND COMPLIANCE IOS", MARGIN, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(170, 170, 180);
  doc.text("Internal Audit Management System", MARGIN, 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(...ACCENT);
  const chip = "INTERNAL AUDIT PLAN";
  doc.roundedRect(PAGE_W - MARGIN - 46, 10, 46, 10, 1.5, 1.5, "F");
  doc.text(chip, PAGE_W - MARGIN - 23, 17, { align: "center" });

  // ---- TITLE ----
  y = 48;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  const titleLines = doc.splitTextToSize(plan.title || "Audit Plan", MAX_W) as string[];
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 7.5 + 4;

  // ---- META CARD ----
  const meta: Array<[string, string]> = [
    ["Reference ID", plan.reference || "—"],
    ["Audit Period", plan.dateRange || "—"],
    [
      "Departments to Audit",
      plan.departments.length > 0 ? plan.departments.join(", ") : "All",
    ],
  ];
  const metaRows = meta.map(([, v]) => wrapLines(doc, v, MAX_W - 62).length);
  const rowH = 8;
  const cardH = meta.reduce((acc, m, i) => acc + Math.max(metaRows[i], 1) * rowH, 0) + 6;

  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(MARGIN, y, MAX_W, cardH, 2, 2, "FD");
  let my = y + 6;
  for (let i = 0; i < meta.length; i++) {
    const [label, value] = meta[i];
    doc.setFillColor(222, 222, 228);
    doc.rect(MARGIN, my - 4.5, 44, Math.max(metaRows[i], 1) * rowH + 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 82);
    doc.text(label, MARGIN + 4, my + 0.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const wrapped = wrapLines(doc, value, MAX_W - 62);
    doc.text(wrapped, MARGIN + 52, my + 0.5);
    my += Math.max(metaRows[i], 1) * rowH + 3;
  }
  y = my + 6;

  // ---- SECTIONS ----
  for (let i = 0; i < PLAN_SECTION_KEYS.length; i++) {
    const key = PLAN_SECTION_KEYS[i];
    const text = htmlToText(plan.content?.[key] ?? "");
    const label = `${i + 1}. ${PLAN_SECTION_LABELS[key] ?? key}`;
    if (!text) {
      sectionHeader(label);
      emptyBox("No information provided for this section yet.");
      continue;
    }
    sectionHeader(label);
    body(text);
  }

  // ---- LEAD AUDITOR ----
  ensure(26);
  y += 6;
  sectionHeader("8. Lead Auditor");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(plan.leadAuditor || "Name of Lead Auditor", MARGIN, y);
  y += 4.5;
  doc.setDrawColor(150, 150, 160);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + 80, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Signature & Date", MARGIN + 30, y + 4);
  doc.setLineWidth(0.2);
  y += 12;

  // ---- AUDIT AUTHORITY NOTE ----
  sectionHeader("Audit Authority & Management Note");
  const note = [
    "This operational audit plan has been formally approved by the CEO. Audit inspections across target departments may occur unannounced at any time throughout the designated execution window.",
    "All preliminary findings and Non-Conformance Reports (NCRs) will be communicated directly to the Branch Manager for immediate operational alignment, and full audit results will be formally reported to the CEO.",
  ].join("\n\n");
  const noteLines = wrapLines(doc, note, MAX_W - 12);
  const boxH = noteLines.length * 4.8 + 12;
  ensure(boxH + 8);
  doc.setFillColor(252, 250, 247);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.35);
  doc.roundedRect(MARGIN, y, MAX_W, boxH, 2, 2, "FD");
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(60, 60, 70);
  let ny = y + 8;
  for (const line of noteLines) {
    doc.text(line, MARGIN + 6, ny);
    ny += 4.8;
  }
  y += boxH + 8;

  // ---- RUNNING HEADER + FOOTER ----
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    if (i > 1) {
      doc.setFillColor(...DARK);
      doc.rect(0, 0, PAGE_W, 12, "F");
      doc.setFillColor(...ACCENT);
      doc.rect(0, 12, PAGE_W, 1.2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(235, 235, 240);
      doc.text(plan.title || "Audit Plan", MARGIN, 7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(170, 170, 180);
      doc.text(plan.reference || "", PAGE_W - MARGIN, 7.5, { align: "right" });
    }
    doc.setDrawColor(222, 222, 227);
    doc.line(MARGIN, PAGE_H - 13, PAGE_W - MARGIN, PAGE_H - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `${plan.reference || plan.title || "Audit Plan"}  |  Page ${i} of ${total}`,
      MARGIN,
      PAGE_H - 7.5,
    );
    doc.text(
      `Generated ${new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}`,
      PAGE_W - MARGIN,
      PAGE_H - 7.5,
      { align: "right" },
    );
  }

  doc.save(`${plan.title.replace(/[^a-z0-9]+/gi, "-") || "audit-plan"}.pdf`);
}
