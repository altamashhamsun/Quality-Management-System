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
  if (!text) return [""];
  const lines: string[] = [];
  for (const chunk of text.split("\n")) {
    const wrapped = doc.splitTextToSize(chunk, maxWidth) as string[];
    lines.push(...wrapped);
  }
  return lines;
}

export function downloadAuditPlanPdf(plan: AuditPlanPdfData) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const maxW = pageW - margin * 2;
  let y = 16;

  // header band
  doc.setFillColor(22, 22, 30);
  doc.rect(0, 0, pageW, 26, "F");
  doc.setFillColor(200, 30, 40);
  doc.rect(0, 26, pageW, 2, "F");
  doc.setTextColor(235, 235, 240);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("COMPLIANCE IOS", margin, 11);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(170, 170, 180);
  doc.text("Internal Audit Management System", margin, 18);

  // title
  y = 42;
  doc.setTextColor(30, 30, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const titleLines = doc.splitTextToSize(plan.title || "Audit Plan", maxW) as string[];
  doc.text(titleLines, margin, y);
  y += titleLines.length * 7 + 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(120, 120, 130);
  doc.text("AUDIT PLAN", margin, y);
  y += 8;

  // meta box
  const meta: Array<[string, string]> = [
    ["Reference ID", plan.reference],
    ["Audit Period", plan.dateRange],
    [
      "Departments to Audit",
      plan.departments.length > 0 ? plan.departments.join(", ") : "All",
    ],
  ];
  const boxTop = y;
  let boxBottom = boxTop + meta.length * 8 + 6;
  doc.setDrawColor(200, 200, 210);
  doc.setFillColor(246, 246, 249);
  doc.rect(margin, boxTop, maxW, boxBottom - boxTop, "FD");
  let my = boxTop + 7;
  for (const [label, value] of meta) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 70);
    doc.text(label, margin + 4, my);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 40);
    const wrapped = doc.splitTextToSize(value, maxW - 16 - 42) as string[];
    doc.text(wrapped, margin + 46, my);
    my += Math.max(wrapped.length, 1) * 5 + 2;
  }
  y = my + 8;

  // footer
  const addFooter = () => {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setDrawColor(220, 220, 225);
      doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 140);
      doc.text(
        `${plan.title}  |  Page ${i} of ${total}`,
        margin,
        pageH - 7,
      );
      doc.text(
        `Generated ${new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}`,
        pageW - margin,
        pageH - 7,
        { align: "right" },
      );
    }
  };

  for (const key of PLAN_SECTION_KEYS) {
    const text = htmlToText(plan.content?.[key] ?? "");
    if (!text) continue;

    // page break if near bottom
    if (y > pageH - 40) {
      doc.addPage();
      y = 24;
    }
    doc.setFillColor(30, 30, 40);
    doc.rect(margin, y - 5, 3, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 40);
    doc.text(PLAN_SECTION_LABELS[key] ?? key, margin + 6, y);
    y += 3;
    doc.setDrawColor(200, 200, 210);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(45, 45, 55);
    const lines = wrapLines(doc, text, maxW);
    for (const line of lines) {
      if (y > pageH - 28) {
        doc.addPage();
        y = 24;
      }
      doc.text(line, margin, y);
      y += 5;
    }
    y += 6;
  }

  addFooter();
  doc.save(`${plan.title.replace(/[^a-z0-9]+/gi, "-") || "audit-plan"}.pdf`);
}
