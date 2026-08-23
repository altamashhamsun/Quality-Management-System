import { jsPDF } from "jspdf";

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const MAX_W = PAGE_W - MARGIN * 2;
const BOTTOM = 16;

const ACCENT: readonly [number, number, number] = [200, 30, 40];
const INK: readonly [number, number, number] = [26, 26, 34];
const BODY: readonly [number, number, number] = [52, 52, 62];
const MUTED: readonly [number, number, number] = [130, 130, 140];
const BORDER: readonly [number, number, number] = [218, 218, 224];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  for (const chunk of text.split("\n")) {
    const wrapped = doc.splitTextToSize(chunk, maxWidth) as string[];
    lines.push(...wrapped);
  }
  return lines;
}

export type BranchRankingPdfData = {
  mode: "month" | "year";
  month: number;
  year: number;
  includeQc: boolean;
  branchName: string;
  pct: number;
  resolved: number;
  total: number;
  unresolved: number;
  ncrs: {
    ncrNumber: string;
    description: string;
    department: string;
    resolved: boolean;
    photos: string[];
  }[];
  incidents: {
    incidentId: string;
    title: string;
    severity: string;
    department: string;
    occurredAt: string | null;
    resolved: boolean;
    photos: string[];
  }[];
  qc?: {
    reports: {
      branchId: string;
      sessions: {
        roundNumber: number;
        createdAt: string;
        closedAt: string | null;
        checklist: {
          item: string;
          question: string;
          found_issue: string;
          answer?: boolean;
          photos?: string[];
        }[];
      }[];
    }[];
  };
};

function addImageWithBorder(doc: jsPDF, photo: string, yRef: { value: number }, ensure: (n: number) => void) {
  try {
    const props = doc.getImageProperties(photo);
    const maxW = MAX_W - 4;
    const maxH = 70;
    let imgW = props.width;
    let imgH = props.height;
    if (imgW > maxW) { imgH = (imgH / imgW) * maxW; imgW = maxW; }
    if (imgH > maxH) { imgW = (imgW / imgH) * maxH; imgH = maxH; }
    ensure(imgH + 8);
    const imgX = MARGIN + (MAX_W - imgW) / 2;
    doc.addImage(photo, "JPEG", imgX, yRef.value, imgW, imgH);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.4);
    doc.rect(imgX, yRef.value, imgW, imgH, "S");
    yRef.value += imgH + 3;
  } catch { /* skip */ }
}

export async function downloadBranchRankingPdf(data: BranchRankingPdfData) {
  const doc = new jsPDF("p", "mm", "a4");
  let y = 0;
  const yPos = { value: 0 };

  const newPage = (top = 22) => { doc.addPage(); y = top; yPos.value = top; };
  const ensure = (need: number) => { if (PAGE_H - y - BOTTOM < need) newPage(); };

  const sectionHeader = (title: string) => {
    ensure(24);
    y += 4;
    doc.setFillColor(...ACCENT);
    doc.rect(MARGIN, y - 4.5, 2.4, 5.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    doc.text(title, MARGIN + 5, y);
    y += 8;
  };

  const muted = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(text, MARGIN, y);
    y += 4;
  };

  const periodLabel = data.mode === "month" ? `${MONTHS[data.month]} ${data.year}` : String(data.year);

  // ---- HEADER ----
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, 52, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(data.mode === "month" ? "Branch of the Month" : "Branch of the Year", MARGIN, 22);
  doc.setFontSize(13);
  doc.setTextColor(200, 200, 210);
  doc.text(periodLabel, MARGIN, 32);
  doc.setFontSize(11);
  doc.text(`Branch: ${data.branchName}`, MARGIN, 42);

  const badgeX = PAGE_W - MARGIN - 32;
  doc.setFillColor(data.pct >= 80 ? 22 : data.pct >= 50 ? 217 : 220, data.pct >= 80 ? 163 : data.pct >= 50 ? 119 : 38, data.pct >= 80 ? 74 : data.pct >= 50 ? 6 : 38);
  doc.roundedRect(badgeX, 16, 32, 28, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(`${data.pct}%`, badgeX + 16, 30, { align: "center" });
  doc.setFontSize(7);
  doc.text("Resolution", badgeX + 16, 36, { align: "center" });
  doc.text("Rate", badgeX + 16, 40, { align: "center" });
  y = 60;

  // ---- SUMMARY ----
  sectionHeader("Summary");
  const summaryItems: [string, string][] = [
    ["Period", periodLabel],
    ["Total Issues", String(data.total)],
    ["Resolved", `${data.resolved} (${data.pct}%)`],
    ["Unresolved", String(data.unresolved)],
    ["NCRs", String(data.ncrs.length)],
    ["Incidents", String(data.incidents.length)],
  ];
  if (data.includeQc && data.qc) {
    const qcCount = data.qc.reports.reduce((sum, r) => sum + r.sessions.reduce((s2, sess) => s2 + (sess.checklist ?? []).filter((i) => i.found_issue).length, 0), 0);
    summaryItems.push(["QC Items", String(qcCount)]);
    summaryItems.push(["QC Rounds", String(data.qc.reports.reduce((s, r) => s + r.sessions.length, 0))]);
  }
  const colW = MAX_W / 2;
  for (let i = 0; i < summaryItems.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = MARGIN + col * colW;
    const sy = y + row * 10;
    ensure(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(summaryItems[i][0], sx, sy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(summaryItems[i][1], sx, sy + 4);
  }
  y += Math.ceil(summaryItems.length / 2) * 10 + 4;

  // ---- UNRESOLVED ISSUES ----
  const unresolvedNcrs = data.ncrs.filter((n) => !n.resolved);
  const unresolvedIncidents = data.incidents.filter((i) => !i.resolved);
  let unresolvedQcCount = 0;
  if (data.includeQc && data.qc) {
    for (const r of data.qc.reports) for (const s of r.sessions) for (const item of s.checklist ?? []) if (item.found_issue && item.answer !== true) unresolvedQcCount++;
  }
  if (unresolvedNcrs.length + unresolvedIncidents.length + unresolvedQcCount > 0) {
    sectionHeader("Unresolved Issues");
    if (unresolvedNcrs.length > 0) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...ACCENT);
      doc.text(`NCRs (${unresolvedNcrs.length})`, MARGIN, y); y += 5;
      for (const ncr of unresolvedNcrs) {
        ensure(12);
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK);
        doc.text(`${ncr.ncrNumber} - ${ncr.department}`, MARGIN, y); y += 4;
        if (ncr.description) { for (const line of wrapLines(doc, ncr.description, MAX_W - 4).slice(0, 2)) { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...BODY); doc.text(line, MARGIN + 2, y); y += 3.5; } }
        y += 1;
      }
    }
    if (unresolvedIncidents.length > 0) {
      ensure(10);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...ACCENT);
      doc.text(`Incidents (${unresolvedIncidents.length})`, MARGIN, y); y += 5;
      for (const inc of unresolvedIncidents) {
        ensure(12);
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK);
        doc.text(`${inc.incidentId} - ${inc.title}`, MARGIN, y); y += 4;
        muted(`Severity: ${inc.severity ?? "N/A"} | Dept: ${inc.department}`); y += 1;
      }
    }
    if (data.includeQc && unresolvedQcCount > 0) {
      ensure(10);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...ACCENT);
      doc.text(`QC Items (${unresolvedQcCount})`, MARGIN, y); y += 5;
      for (const r of data.qc!.reports) {
        for (const s of r.sessions) {
          const items = (s.checklist ?? []).filter((i) => i.found_issue && i.answer !== true);
          if (items.length === 0) continue;
          ensure(8); muted(`Round ${s.roundNumber} - ${new Date(s.createdAt).toLocaleDateString()}`); y += 1;
          for (const item of items) { ensure(8); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...BODY); doc.text(`- ${item.question || item.item}`, MARGIN + 4, y); y += 3.5; }
          y += 1;
        }
      }
    }
  }

  // ---- RESOLVED ISSUES ----
  const resolvedNcrs = data.ncrs.filter((n) => n.resolved);
  const resolvedIncidents = data.incidents.filter((i) => i.resolved);
  let resolvedQcCount = 0;
  if (data.includeQc && data.qc) {
    for (const r of data.qc.reports) for (const s of r.sessions) for (const item of s.checklist ?? []) if (item.found_issue && item.answer === true) resolvedQcCount++;
  }
  if (resolvedNcrs.length + resolvedIncidents.length + resolvedQcCount > 0) {
    sectionHeader("Resolved Issues");
    if (resolvedNcrs.length > 0) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(22, 163, 74);
      doc.text(`NCRs (${resolvedNcrs.length})`, MARGIN, y); y += 5;
      for (const ncr of resolvedNcrs) {
        ensure(12);
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK);
        doc.text(`${ncr.ncrNumber} - ${ncr.department}`, MARGIN, y); y += 4;
        if (ncr.description) { for (const line of wrapLines(doc, ncr.description, MAX_W - 4).slice(0, 2)) { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...BODY); doc.text(line, MARGIN + 2, y); y += 3.5; } }
        y += 1;
      }
    }
    if (resolvedIncidents.length > 0) {
      ensure(10);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(22, 163, 74);
      doc.text(`Incidents (${resolvedIncidents.length})`, MARGIN, y); y += 5;
      for (const inc of resolvedIncidents) {
        ensure(12);
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK);
        doc.text(`${inc.incidentId} - ${inc.title}`, MARGIN, y); y += 4;
        muted(`Severity: ${inc.severity ?? "N/A"} | Dept: ${inc.department}`); y += 1;
      }
    }
    if (data.includeQc && resolvedQcCount > 0) {
      ensure(10);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(22, 163, 74);
      doc.text(`QC Items (${resolvedQcCount})`, MARGIN, y); y += 5;
      for (const r of data.qc!.reports) {
        for (const s of r.sessions) {
          const items = (s.checklist ?? []).filter((i) => i.found_issue && i.answer === true);
          if (items.length === 0) continue;
          ensure(8); muted(`Round ${s.roundNumber} - ${new Date(s.createdAt).toLocaleDateString()}`); y += 1;
          for (const item of items) { ensure(8); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...BODY); doc.text(`- ${item.question || item.item}`, MARGIN + 4, y); y += 3.5; }
          y += 1;
        }
      }
    }
  }

  // ---- QC ROUNDS DETAIL ----
  if (data.includeQc && data.qc && data.qc.reports.length > 0) {
    const allSessions = data.qc.reports.flatMap((r) => r.sessions);
    if (allSessions.length > 0) {
      sectionHeader("QC Inspection Rounds (Details)");
      for (const s of allSessions) {
        ensure(14);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...INK);
        doc.text(`Round ${s.roundNumber}  |  Started: ${new Date(s.createdAt).toLocaleString()}`, MARGIN, y); y += 4;
        if (s.closedAt) muted(`Closed: ${new Date(s.closedAt).toLocaleString()}`);
        y += 2;
        const checklistItems = (s.checklist ?? []).filter((i) => i.found_issue);
        for (const item of checklistItems) {
          const resolved = item.answer === true;
          ensure(14);
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...BODY);
          doc.text(`${resolved ? "[Resolved]" : "[Open]"} ${item.question || item.item}`, MARGIN + 2, y); y += 3.5;
          if (item.found_issue) muted(`  Issue: ${item.found_issue.slice(0, 120)}`);
          if (item.photos && item.photos.length > 0) {
            for (const photo of item.photos.slice(0, 2)) {
              yPos.value = y;
              addImageWithBorder(doc, photo, yPos, ensure);
              y = yPos.value;
            }
          }
          y += 1;
        }
        y += 2;
      }
    }
  }

  // ---- NCR PHOTOS ----
  const ncrsWithPhotos = data.ncrs.filter((n) => n.photos.length > 0);
  if (ncrsWithPhotos.length > 0) {
    sectionHeader("NCR Evidence Photos");
    for (const ncr of ncrsWithPhotos) {
      ensure(10);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK);
      doc.text(`${ncr.ncrNumber} - ${ncr.department}`, MARGIN, y); y += 5;
      for (const photo of ncr.photos.slice(0, 3)) {
        yPos.value = y;
        addImageWithBorder(doc, photo, yPos, ensure);
        y = yPos.value;
      }
      y += 2;
    }
  }

  // ---- INCIDENT PHOTOS ----
  const incidentsWithPhotos = data.incidents.filter((i) => i.photos.length > 0);
  if (incidentsWithPhotos.length > 0) {
    sectionHeader("Incident Evidence Photos");
    for (const inc of incidentsWithPhotos) {
      ensure(10);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK);
      doc.text(`${inc.incidentId} - ${inc.title}`, MARGIN, y); y += 5;
      for (const photo of inc.photos.slice(0, 3)) {
        yPos.value = y;
        addImageWithBorder(doc, photo, yPos, ensure);
        y = yPos.value;
      }
      y += 2;
    }
  }

  // ---- FOOTER ----
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W / 2, PAGE_H - 8, { align: "center" });
    doc.text("Quality and Compliance IOS", MARGIN, PAGE_H - 8);
  }

  const filename = data.mode === "month"
    ? `Branch-of-Month-${MONTHS[data.month]}-${data.year}-${data.branchName}.pdf`
    : `Branch-of-Year-${data.year}-${data.branchName}.pdf`;
  doc.save(filename);
}
