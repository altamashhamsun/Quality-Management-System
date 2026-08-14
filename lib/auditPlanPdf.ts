import { jsPDF } from "jspdf";

export type AuditPlanPdfData = {
  title: string;
  reference: string;
  dateRange: string;
  departments: string[];
  content: Record<string, string> | null;
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

function htmlToText(html: string): string {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? "").trim();
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

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const MAX_W = PAGE_W - MARGIN * 2;

export function downloadAuditPlanPdf(plan: AuditPlanPdfData) {
  const doc = new jsPDF("p", "mm", "a4");
  let y = 0;

  const newPage = (top = 22) => {
    doc.addPage();
    y = top;
  };

  const ensure = (need: number) => {
    if (PAGE_H - y < need) newPage();
  };

  const sectionHeader = (title: string) => {
    ensure(24);
    y += 4;
    doc.setFillColor(200, 30, 40);
    doc.rect(MARGIN, y - 4.5, 2.4, 5.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(26, 26, 34);
    doc.text(title, MARGIN + 6, y);
    y += 3;
    doc.setDrawColor(214, 214, 220);
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
    doc.setTextColor(52, 52, 62);
    for (const line of lines) {
      ensure(lineH + 4);
      doc.text(line, MARGIN, y);
      y += lineH;
    }
    y += 3;
  };

  const emptyBox = (message: string) => {
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
  doc.setFillColor(22, 22, 30);
  doc.rect(0, 0, PAGE_W, 30, "F");
  doc.setFillColor(200, 30, 40);
  doc.rect(0, 30, PAGE_W, 2.2, "F");

  doc.setTextColor(235, 235, 240);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("COMPLIANCE IOS", MARGIN, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(170, 170, 180);
  doc.text("Internal Audit Management System", MARGIN, 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(200, 30, 40);
  const chip = "INTERNAL AUDIT PLAN";
  doc.roundedRect(PAGE_W - MARGIN - 46, 10, 46, 10, 1.5, 1.5, "F");
  doc.text(chip, PAGE_W - MARGIN - 23, 17, { align: "center" });

  // ---- TITLE ----
  y = 48;
  doc.setTextColor(26, 26, 34);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  const titleLines = doc.splitTextToSize(plan.title || "Audit Plan", MAX_W) as string[];
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 7.5 + 4;

  // ---- META CARD ----
  const meta: Array<[string, string]> = [
    ["Reference ID", plan.reference],
    ["Audit Period", plan.dateRange],
    [
      "Departments to Audit",
      plan.departments.length > 0 ? plan.departments.join(", ") : "All",
    ],
  ];
  const metaRows = meta.map(([, v]) => wrapLines(doc, v, MAX_W - 62).length);
  const rowH = 8;
  const cardH = meta.reduce((acc, m, i) => acc + Math.max(metaRows[i], 1) * rowH, 0) + 6;

  doc.setFillColor(247, 247, 250);
  doc.setDrawColor(218, 218, 224);
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
    doc.setTextColor(30, 30, 40);
    const wrapped = wrapLines(doc, value, MAX_W - 62);
    doc.text(wrapped, MARGIN + 52, my + 0.5);
    my += Math.max(metaRows[i], 1) * rowH + 3;
  }
  y = my + 6;

  // ---- SECTIONS ----
  for (const key of PLAN_SECTION_KEYS) {
    const text = htmlToText(plan.content?.[key] ?? "");
    const label = PLAN_SECTION_LABELS[key] ?? key;
    if (!text) {
      sectionHeader(label);
      emptyBox("No information provided for this section yet.");
      continue;
    }
    sectionHeader(label);
    body(text);
  }

  // ---- FOOTER ----
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(222, 222, 227);
    doc.line(MARGIN, PAGE_H - 13, PAGE_W - MARGIN, PAGE_H - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 140);
    doc.text(
      `${plan.title || "Audit Plan"}  |  Page ${i} of ${total}`,
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
