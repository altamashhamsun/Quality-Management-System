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
  photos: string[];
};

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const MAX_W = PAGE_W - MARGIN * 2;

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  if (!text) return [""];
  const lines: string[] = [];
  for (const chunk of text.split("\n")) {
    lines.push(...(doc.splitTextToSize(chunk, maxWidth) as string[]));
  }
  return lines;
}

export function downloadAuditReportPdf(data: AuditReportPdfData) {
  const doc = new jsPDF("p", "mm", "a4");
  let y = 16;

  const newPage = () => {
    doc.addPage();
    y = 24;
  };

  const ensure = (need: number) => {
    if (PAGE_H - y < need) newPage();
  };

  const para = (text: string, size = 10, lineH = 5) => {
    if (!text) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(45, 45, 55);
    const lines = wrap(doc, text, MAX_W);
    for (const line of lines) {
      ensure(lineH);
      doc.text(line, MARGIN, y);
      y += lineH;
    }
    y += 2;
  };

  const header = (title: string) => {
    ensure(18);
    doc.setFillColor(22, 22, 30);
    doc.rect(0, y - 5, PAGE_W, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), MARGIN, y);
    y += 6;
    doc.setDrawColor(200, 30, 40);
    doc.setLineWidth(1);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    doc.setLineWidth(0.2);
    y += 3;
  };

  const ncsTable = (title: string, ncs: ReportNc[], color: [number, number, number]) => {
    if (ncs.length === 0) return;
    ensure(40);
    header(title);

    const cols = [24, 86, 30, 20, 26];
    const colX: number[] = [];
    let x = MARGIN;
    for (const w of cols) {
      colX.push(x);
      x += w;
    }
    const renderRow = (cells: string[], h: number, isHead: boolean) => {
      ensure(h);
      if (isHead) doc.setFillColor(color[0], color[1], color[2]);
      else doc.setFillColor(248, 248, 250);
      doc.rect(MARGIN, y - 2, MAX_W, h, "F");
      doc.setFont("helvetica", isHead ? "bold" : "normal");
      doc.setFontSize(7.5);
      for (let c = 0; c < cells.length; c++) {
        const vLines = wrap(doc, cells[c] ?? "—", cols[c] - 4);
        doc.setTextColor(255, 255, 255);
        doc.text(vLines[0] ?? "", colX[c] + 2, y);
        for (let i = 1; i < vLines.length; i++) {
          ensure(h);
          doc.text(vLines[i], colX[c] + 2, y + i * 4);
        }
      }
      y += h;
    };

    const headH = 8;
    const heights = ncs.map((nc) => {
      const a = wrap(doc, nc.ncrNumber || "—", cols[0] - 4);
      const b = wrap(doc, nc.description || "—", cols[1] - 4);
      const c = wrap(doc, nc.clause || "—", cols[2] - 4);
      const d = wrap(doc, nc.priority || "—", cols[3] - 4);
      const e = wrap(doc, nc.deadline || "—", cols[4] - 4);
      return Math.max(a.length, b.length, c.length, d.length, e.length, 1) * 4 + 6;
    });

    renderRow(["NCR #", "Finding / Non-Conformance", "Clause", "Priority", "Deadline"], headH, true);
    ncs.forEach((nc, i) => {
      const h = heights[i];
      if (PAGE_H - y < h + 6) {
        newPage();
        renderRow(["NCR #", "Finding / Non-Conformance", "Clause", "Priority", "Deadline"], headH, true);
      }
      renderRow([nc.ncrNumber, nc.description, nc.clause, nc.priority, nc.deadline], h, false);
    });
    y += 4;
  };

  // ---- COVER HEADER ----
  doc.setFillColor(22, 22, 30);
  doc.rect(0, 0, PAGE_W, 30, "F");
  doc.setFillColor(200, 30, 40);
  doc.rect(0, 30, PAGE_W, 2, "F");
  doc.setTextColor(235, 235, 240);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("COMPLIANCE IOS", MARGIN, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(170, 170, 180);
  doc.text("Internal Audit Report", MARGIN, 20);

  y = 44;
  doc.setTextColor(30, 30, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  const titleLines = wrap(doc, data.title || "Audit Report", MAX_W);
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 7 + 2;
  doc.setFontSize(11);
  doc.setTextColor(140, 30, 35);
  doc.text("INTERNAL AUDIT REPORT", MARGIN, y);
  y += 8;

  // meta box
  const meta: Array<[string, string]> = [
    ["Reference ID", data.reference],
    ["Location / Branch(es)", data.location || "—"],
    ["Date(s) of Audit", data.dateRange],
    ["Auditor(s)", data.auditors || "—"],
    ["Lead Auditee(s)", data.leadAuditees || "—"],
  ];
  const boxTop = y;
  const metaLines = meta.map(([, v]) => wrap(doc, v, MAX_W - 50).length);
  const boxH = 8 + meta.reduce((acc, m, i) => acc + Math.max(metaLines[i], 1) * 5, 0);
  doc.setDrawColor(200, 200, 210);
  doc.setFillColor(246, 246, 249);
  doc.rect(MARGIN, boxTop, MAX_W, boxH, "FD");
  y = boxTop + 6;
  meta.forEach(([l, v], i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 90);
    doc.text(l, MARGIN + 4, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 40);
    const vLines = wrap(doc, v || "—", MAX_W - 50);
    doc.text(vLines[0], MARGIN + 52, y);
    y += Math.max(metaLines[i], 1) * 5;
  });
  y = boxTop + boxH + 8;

  // sections
  if (data.overallAssessment) {
    ensure(30);
    header("1. Overall Assessment");
    para(data.overallAssessment);
    y += 3;
  }
  if (data.keyFindings) {
    ensure(30);
    header("2. Key Findings Highlights");
    para(data.keyFindings);
    y += 3;
  }
  if (data.scope) {
    ensure(30);
    header("3. Audit Scope");
    para(data.scope);
    y += 3;
  }
  if (data.criteria.length > 0) {
    ensure(30);
    header("4. Criteria / Standards");
    data.criteria.forEach((c) => para("•  " + c));
    y += 3;
  }
  if (data.methodology) {
    ensure(30);
    header("5. Methodology");
    para(data.methodology);
    y += 3;
  }

  // Detailed findings
  ensure(30);
  header("6. Detailed Audit Findings");

  if (data.conformances) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 90, 50);
    doc.text("Conformances / Strengths", MARGIN, y);
    y += 4;
    para(data.conformances, 9.5);
    y += 2;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 40);
  doc.text("Non-Conformances", MARGIN, y);
  y += 4;

  ncsTable("Major Non-Conformances", data.majorNcs, [140, 30, 35]);
  ncsTable("Minor Non-Conformances", data.minorNcs, [150, 110, 40]);

  // OFI + consequences
  const ofi = [...data.majorNcs, ...data.minorNcs].filter(
    (n) => n.correctiveAction || n.preventiveAction,
  );
  if (ofi.length > 0) {
    ensure(30);
    header("7. Opportunities for Improvement");
    for (const nc of ofi) {
      ensure(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 40);
      doc.text(nc.ncrNumber, MARGIN, y);
      y += 4.5;
      if (nc.correctiveAction) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 90);
        doc.text("Corrective Action: ", MARGIN, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(45, 45, 55);
        const caLines = wrap(doc, nc.correctiveAction, MAX_W - 34);
        doc.text(caLines[0], MARGIN + 34, y);
        y += Math.max(caLines.length, 1) * 4.5;
      }
      if (nc.preventiveAction) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 90);
        doc.text("Preventive Action: ", MARGIN, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(45, 45, 55);
        const paLines = wrap(doc, nc.preventiveAction, MAX_W - 34);
        doc.text(paLines[0], MARGIN + 34, y);
        y += Math.max(paLines.length, 1) * 4.5;
      }
      if (nc.consequences) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(140, 40, 40);
        doc.text("Consequence: ", MARGIN, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(45, 45, 55);
        const coLines = wrap(doc, nc.consequences, MAX_W - 30);
        doc.text(coLines[0], MARGIN + 30, y);
        y += Math.max(coLines.length, 1) * 4.5;
      }
      y += 3;
    }
  }

  // CAP
  const capNcs = ofi.filter((n) => n.rootCause);
  if (capNcs.length > 0) {
    ensure(30);
    header("8. Corrective Action Plan (CAP)");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 40);
    doc.text("Root Cause Analysis (RCA)", MARGIN, y);
    y += 4.5;
    for (const nc of capNcs) {
      ensure(14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 90);
      doc.text(`${nc.ncrNumber}: `, MARGIN, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(45, 45, 55);
      const rcLines = wrap(doc, nc.rootCause, MAX_W - 24);
      doc.text(rcLines[0], MARGIN + 24, y);
      y += Math.max(rcLines.length, 1) * 4.5;
    }
    y += 3;

    const cols2 = [24, 76, 76, 20];
    const col2X: number[] = [];
    let x2 = MARGIN;
    for (const w of cols2) {
      col2X.push(x2);
      x2 += w;
    }
    const h2 = capNcs.map((nc) => {
      const a = wrap(doc, nc.ncrNumber || "—", cols2[0] - 4);
      const b = wrap(doc, nc.correctiveAction || "—", cols2[1] - 4);
      const c = wrap(doc, nc.preventiveAction || "—", cols2[2] - 4);
      const d = wrap(doc, nc.deadline || "—", cols2[3] - 4);
      return Math.max(a.length, b.length, c.length, d.length, 1) * 4 + 6;
    });

    const renderRow2 = (cells: string[], h: number, isHead: boolean) => {
      ensure(h);
      if (isHead) doc.setFillColor(22, 22, 30);
      else doc.setFillColor(248, 248, 250);
      doc.rect(MARGIN, y - 2, MAX_W, h, "F");
      doc.setFont("helvetica", isHead ? "bold" : "normal");
      doc.setFontSize(7.5);
      for (let c = 0; c < cells.length; c++) {
        const vLines = wrap(doc, cells[c] ?? "—", cols2[c] - 4);
        doc.setTextColor(255, 255, 255);
        doc.text(vLines[0] ?? "", col2X[c] + 2, y);
        for (let i = 1; i < vLines.length; i++) {
          doc.text(vLines[i], col2X[c] + 2, y + i * 4);
        }
      }
      y += h;
    };

    renderRow2(["NCR #", "Corrective Action", "Preventive Action", "Deadline"], 8, true);
    capNcs.forEach((nc, i) => {
      if (PAGE_H - y < h2[i] + 6) {
        newPage();
        renderRow2(["NCR #", "Corrective Action", "Preventive Action", "Deadline"], 8, true);
      }
      renderRow2([nc.ncrNumber, nc.correctiveAction, nc.preventiveAction, nc.deadline], h2[i], false);
    });
    y += 4;
  }

  // Sign-off
  ensure(70);
  header("9. Formal Sign-Off & Evidence");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 40);
  doc.text("Auditor", MARGIN, y);
  y += 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 90);
  doc.text(data.auditors || "Name & signature of lead auditor", MARGIN, y);
  y += 6;
  doc.setDrawColor(150, 150, 160);
  doc.line(MARGIN, y, MARGIN + 80, y);
  doc.line(MARGIN + 90, y, PAGE_W - MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 140);
  doc.text("Signature & Date", MARGIN + 28, y + 4);
  doc.text("Signature & Date", MARGIN + 118, y + 4);
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 40);
  doc.text("Management", MARGIN, y);
  y += 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 90);
  doc.text(data.leadAuditees || "Name & signature of management representative", MARGIN, y);
  y += 6;
  doc.setDrawColor(150, 150, 160);
  doc.line(MARGIN, y, MARGIN + 80, y);
  doc.line(MARGIN + 90, y, PAGE_W - MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 140);
  doc.text("Signature & Date", MARGIN + 28, y + 4);
  doc.text("Signature & Date", MARGIN + 118, y + 4);
  y += 14;

  // Evidence photos
  if (data.photos.length > 0) {
    ensure(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 40);
    doc.text("Appendices / Evidence", MARGIN, y);
    y += 5;
    const maxPhotos = Math.min(data.photos.length, 12);
    const perRow = 3;
    const imgW = (MAX_W - (perRow - 1) * 5) / perRow;
    for (let i = 0; i < maxPhotos; i++) {
      const col = i % perRow;
      if (col === 0) {
        ensure(50);
      }
      const url = data.photos[i];
      const fmt = url.startsWith("data:image/png") ? "PNG" : "JPEG";
      const x = MARGIN + col * (imgW + 5);
      const imgH = 40;
      try {
        doc.addImage(url, fmt, x, y, imgW, imgH);
      } catch {
        // skip unloadable image
      }
      if (col === perRow - 1) y += imgH + 5;
    }
  }

  // footer page numbers
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 225);
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 140);
    doc.text(
      `${data.reference || ""}  |  Page ${i} of ${total}`,
      MARGIN,
      PAGE_H - 7,
    );
  }

  doc.save(`${data.reference || "audit-report"}.pdf`);
}
