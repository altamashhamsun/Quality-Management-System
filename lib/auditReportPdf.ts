import { jsPDF } from "jspdf";

export type ReportNc = {
  ncrNumber: string;
  description: string;
  clause: string;
  priority: string;
  correctiveAction: string;
  preventiveAction: string;
  rootCause: string;
  consequences: string;
  responsibility: string;
  deadline: string;
};

export type ReportIncident = {
  incidentId: string;
  title: string;
  incidentType: string;
  severity: string;
  branch: string;
  department: string;
  occurredAt: string;
  description: string;
};

export type AuditReportPdfData = {
  title: string;
  reference: string;
  location: string;
  dateRange: string;
  auditors: string;
  leadAuditees: string;
  overallAssessment: string;
  keyFindings: string;
  scope: string;
  criteria: string[];
  methodology: string;
  conformances: string;
  majorNcs: ReportNc[];
  minorNcs: ReportNc[];
  incidents: ReportIncident[];
  photos: string[];
};

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const MAX_W = PAGE_W - MARGIN * 2;

const DARK = [22, 22, 30] as const;
const ACCENT = [200, 30, 40] as const;
const INK = [30, 30, 40] as const;
const BODY = [52, 52, 62] as const;
const MUTED = [130, 130, 140] as const;
const LIGHT = [247, 247, 250] as const;
const BORDER = [218, 218, 224] as const;
const HEAD_FILL: readonly [number, number, number] = [26, 26, 34];
const ROW_FILL: readonly [number, number, number] = [248, 248, 250];

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  if (!text) return [""];
  const lines: string[] = [];
  for (const chunk of text.split("\n")) {
    const wrapped = doc.splitTextToSize(chunk, maxWidth) as string[];
    lines.push(...(wrapped.length ? wrapped : [""]));
  }
  return lines.length ? lines : [""];
}

export function downloadAuditReportPdf(data: AuditReportPdfData) {
  const doc = new jsPDF("p", "mm", "a4");
  let y = 0;

  const newPage = (top = 24) => {
    doc.addPage();
    y = top;
  };

  const ensure = (need: number) => {
    if (PAGE_H - y < need) newPage();
  };

  const sectionHeader = (title: string) => {
    ensure(26);
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
    const lines = wrap(doc, text, MAX_W);
    if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) return;
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

  const emptyBox = (message: string, height = 13) => {
    ensure(height + 6);
    doc.setDrawColor(205, 205, 212);
    doc.setFillColor(250, 250, 252);
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(MARGIN, y, MAX_W, height, "FD");
    doc.setLineDashPattern([], 0);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 160);
    const msgLines = wrap(doc, message, MAX_W - 8);
    doc.text(msgLines.slice(0, 2), MARGIN + 4, y + 7.5);
    y += height + 5;
  };

  const bullet = (text: string) => {
    const lines = wrap(doc, text, MAX_W - 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...BODY);
    for (let i = 0; i < lines.length; i++) {
      ensure(5.5);
      doc.text(i === 0 ? "•" : "", MARGIN, y);
      doc.text(lines[i], MARGIN + 5, y);
      y += 5;
    }
    y += 2;
  };

  // ---------- TABLE RENDERER ----------
  const PAD = 2;
  const LINE_H = 4.2;
  const HEAD_H = 9;

  const renderTable = (headers: string[], colWidths: number[], rows: string[][]) => {
    if (rows.length === 0) return;

    // measure with the same font that will be used to draw
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);

    const rowHeight = (cells: string[]) => {
      let maxLines = 1;
      cells.forEach((cell, c) => {
        const n = wrap(doc, cell || "—", colWidths[c] - PAD * 2).length;
        maxLines = Math.max(maxLines, n);
      });
      return Math.max(maxLines * LINE_H + 4, 8);
    };

    const drawRow = (cells: string[], h: number, isHead: boolean) => {
      doc.setFillColor(...(isHead ? HEAD_FILL : ROW_FILL));
      doc.setDrawColor(...BORDER);
      doc.rect(MARGIN, y - 2, MAX_W, h, "F");
      doc.setFont("helvetica", isHead ? "bold" : "normal");
      doc.setFontSize(7.5);
      let cx = MARGIN;
      for (let c = 0; c < cells.length; c++) {
        const cellLines = wrap(doc, cells[c] || "—", colWidths[c] - PAD * 2);
        doc.setTextColor(isHead ? 255 : 40, isHead ? 255 : 40, isHead ? 255 : 55);
        cellLines.forEach((line, li) => {
          doc.text(line, cx + PAD, y + LINE_H * li + 2.2);
        });
        cx += colWidths[c];
      }
      // borders
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.15);
      let bx = MARGIN;
      for (let c = 0; c < colWidths.length; c++) {
        doc.line(bx, y - 2, bx, y - 2 + h);
        bx += colWidths[c];
      }
      doc.line(bx, y - 2, bx, y - 2 + h);
      doc.line(MARGIN, y - 2 + h, bx, y - 2 + h);
      doc.setLineWidth(0.2);
      y += h;
    };

    drawRow(headers, HEAD_H, true);
    rows.forEach((row) => {
      const h = rowHeight(row);
      if (PAGE_H - y < h + 6) {
        newPage();
        drawRow(headers, HEAD_H, true);
      }
      drawRow(row, h, false);
    });
    y += 5;
  };

  // ---------- COVER ----------
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
  doc.roundedRect(PAGE_W - MARGIN - 50, 10, 50, 10, 1.5, 1.5, "F");
  doc.text("INTERNAL AUDIT REPORT", PAGE_W - MARGIN - 25, 17, { align: "center" });

  // ---------- TITLE ----------
  y = 48;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  const titleLines = wrap(doc, data.title || "Audit Report", MAX_W);
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 7.5 + 4;

  // ---------- META CARD ----------
  const meta: Array<[string, string]> = [
    ["Reference ID", data.reference],
    ["Location / Branch(es)", data.location || "—"],
    ["Date(s) of Audit", data.dateRange],
    ["Auditor(s)", data.auditors || "—"],
    ["Lead Auditee(s)", data.leadAuditees || "—"],
  ];
  const metaRows = meta.map(([, v]) => wrap(doc, v || "—", MAX_W - 60).length);
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
    const wrapped = wrap(doc, value || "—", MAX_W - 60);
    doc.text(wrapped, MARGIN + 52, my + 0.5);
    my += Math.max(metaRows[i], 1) * rowH + 3;
  }
  y = my + 6;

  // ---------- NARRATIVE SECTIONS ----------
  sectionHeader("1. Overall Assessment");
  if (data.overallAssessment) body(data.overallAssessment);
  else emptyBox("No overall assessment recorded for this audit.");

  sectionHeader("2. Key Findings Highlights");
  if (data.keyFindings) body(data.keyFindings);
  else emptyBox("No key findings recorded for this audit.");

  sectionHeader("3. Audit Scope");
  if (data.scope) body(data.scope);
  else emptyBox("No audit scope recorded.");

  sectionHeader("4. Criteria / Standards");
  if (data.criteria.length === 0) {
    emptyBox("No standards / criteria recorded for this audit.");
  } else {
    data.criteria.forEach((c) => bullet(c));
    y += 2;
  }

  sectionHeader("5. Methodology");
  if (data.methodology) body(data.methodology);
  else emptyBox("No methodology recorded.");

  // ---------- DETAILED FINDINGS ----------
  sectionHeader("6. Detailed Audit Findings");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 90, 50);
  doc.text("Conformances / Strengths", MARGIN, y);
  y += 5;
  if (data.conformances) body(data.conformances);
  else emptyBox("No conformances / strengths recorded.");

  y += 3;

  const ncColumns = [26, 74, 30, 28, 24];
  const ncHeaders = ["NCR #", "Finding / Non-Conformance", "Clause", "Priority", "Deadline"];
  const ncRows = (ncs: ReportNc[]) =>
    ncs.map((nc) => [
      nc.ncrNumber,
      nc.description,
      nc.clause,
      nc.priority,
      nc.deadline,
    ]);

  sectionHeader("Major Non-Conformances");
  if (data.majorNcs.length === 0) {
    emptyBox("No major non-conformances recorded.");
  } else {
    renderTable(ncHeaders, ncColumns, ncRows(data.majorNcs));
  }

  sectionHeader("Minor Non-Conformances");
  if (data.minorNcs.length === 0) {
    emptyBox("No minor non-conformances recorded.");
  } else {
    renderTable(ncHeaders, ncColumns, ncRows(data.minorNcs));
  }

  // ---------- UNRESOLVED INCIDENTS ----------
  sectionHeader("Unresolved Incidents");
  if (data.incidents.length === 0) {
    emptyBox("No unresolved incidents on record for the audited branch(es) in this date window.");
  } else {
    renderTable(
      ["Incident ID", "Title", "Type", "Severity", "Branch"],
      [34, 76, 32, 22, 18],
      data.incidents.map((i) => [
        i.incidentId,
        i.title,
        i.incidentType,
        i.severity,
        i.branch,
      ]),
    );
  }

  // ---------- OFI ----------
  sectionHeader("7. Opportunities for Improvement");
  const ofi = [...data.majorNcs, ...data.minorNcs].filter(
    (n) => n.correctiveAction || n.preventiveAction,
  );
  if (ofi.length === 0) {
    emptyBox("No corrective or preventive actions recorded.");
  } else {
    for (const nc of ofi) {
      ensure(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(nc.ncrNumber, MARGIN, y);
      y += 4.5;
      if (nc.correctiveAction) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(70, 70, 82);
        doc.text("Corrective Action: ", MARGIN, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...BODY);
        const caLines = wrap(doc, nc.correctiveAction, MAX_W - 34);
        doc.text(caLines[0], MARGIN + 34, y);
        y += Math.max(caLines.length, 1) * 4.5;
      }
      if (nc.preventiveAction) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(70, 70, 82);
        doc.text("Preventive Action: ", MARGIN, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...BODY);
        const paLines = wrap(doc, nc.preventiveAction, MAX_W - 34);
        doc.text(paLines[0], MARGIN + 34, y);
        y += Math.max(paLines.length, 1) * 4.5;
      }
      if (nc.consequences) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...ACCENT);
        doc.text("Consequence: ", MARGIN, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...BODY);
        const coLines = wrap(doc, nc.consequences, MAX_W - 30);
        doc.text(coLines[0], MARGIN + 30, y);
        y += Math.max(coLines.length, 1) * 4.5;
      }
      y += 3;
    }
  }

  // ---------- CAP ----------
  sectionHeader("8. Corrective Action Plan (CAP)");
  const capNcs = ofi.filter((n) => n.rootCause);
  if (capNcs.length === 0) {
    emptyBox("No root cause analysis recorded for this audit.");
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text("Root Cause Analysis (RCA)", MARGIN, y);
    y += 4.5;
    for (const nc of capNcs) {
      ensure(14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(70, 70, 82);
      doc.text(`${nc.ncrNumber}: `, MARGIN, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BODY);
      const rcLines = wrap(doc, nc.rootCause, MAX_W - 24);
      doc.text(rcLines[0], MARGIN + 24, y);
      y += Math.max(rcLines.length, 1) * 4.5;
    }
    y += 4;

    renderTable(
      ["NCR #", "Corrective Action", "Preventive Action", "Deadline"],
      [26, 78, 58, 20],
      capNcs.map((nc) => [
        nc.ncrNumber,
        nc.correctiveAction,
        nc.preventiveAction,
        nc.deadline,
      ]),
    );
  }

  // ---------- SIGN-OFF ----------
  sectionHeader("9. Formal Sign-Off & Evidence");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text("Auditor", MARGIN, y);
  y += 3.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(data.auditors || "Name & signature of lead auditor", MARGIN, y);
  y += 7;
  doc.setDrawColor(150, 150, 160);
  doc.line(MARGIN, y, MARGIN + 80, y);
  doc.line(MARGIN + 90, y, PAGE_W - MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Signature & Date", MARGIN + 30, y + 4);
  doc.text("Signature & Date", MARGIN + 120, y + 4);
  y += 15;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text("Management", MARGIN, y);
  y += 3.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(data.leadAuditees || "Name & signature of management representative", MARGIN, y);
  y += 7;
  doc.setDrawColor(150, 150, 160);
  doc.line(MARGIN, y, MARGIN + 80, y);
  doc.line(MARGIN + 90, y, PAGE_W - MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Signature & Date", MARGIN + 30, y + 4);
  doc.text("Signature & Date", MARGIN + 120, y + 4);
  y += 15;

  // ---------- EVIDENCE PHOTOS ----------
  sectionHeader("Appendices / Evidence");
  if (data.photos.length === 0) {
    emptyBox("No evidence photos attached to the NCRs of this audit.");
  } else {
    const maxPhotos = Math.min(data.photos.length, 12);
    const perRow = 3;
    const gap = 5;
    const imgW = (MAX_W - (perRow - 1) * gap) / perRow;
    const imgH = 40;
    for (let i = 0; i < maxPhotos; i++) {
      const col = i % perRow;
      if (col === 0) ensure(imgH + 10);
      const url = data.photos[i];
      const fmt = url.startsWith("data:image/png") ? "PNG" : "JPEG";
      const x = MARGIN + col * (imgW + gap);
      try {
        doc.addImage(url, fmt, x, y, imgW, imgH);
      } catch {
        doc.setFillColor(240, 240, 243);
        doc.setDrawColor(...BORDER);
        doc.rect(x, y, imgW, imgH, "FD");
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text("Photo", x + imgW / 2, y + imgH / 2, { align: "center" });
      }
      if (col === perRow - 1) y += imgH + gap;
    }
  }

  // ---------- FOOTER ----------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(222, 222, 227);
    doc.line(MARGIN, PAGE_H - 13, PAGE_W - MARGIN, PAGE_H - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `${data.reference || ""}  |  Page ${i} of ${total}`,
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

  doc.save(`${data.reference || "audit-report"}.pdf`);
}
