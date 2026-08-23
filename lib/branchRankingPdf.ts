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

export type BranchPdfItem = {
  ncrNumber: string;
  description: string;
  department: string;
  resolved: boolean;
  photos: string[];
};

export type BranchPdfIncident = {
  incidentId: string;
  title: string;
  severity: string;
  department: string;
  occurredAt: string | null;
  resolved: boolean;
  photos: string[];
};

export type BranchPdfQcSession = {
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
};

export type BranchPdfBranch = {
  branch: string;
  rank: number;
  pct: number;
  resolved: number;
  total: number;
  unresolved: number;
  ncrs: BranchPdfItem[];
  incidents: BranchPdfIncident[];
  qcSessions: BranchPdfQcSession[];
};

export type BranchRankingPdfData = {
  mode: "month" | "year";
  month: number;
  year: number;
  includeQc: boolean;
  branches: BranchPdfBranch[];
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

  // ---- COVER HEADER ----
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
  doc.text(`${data.branches.length} Branches  |  All Branches Report`, MARGIN, 42);
  y = 60;

  // ---- OVERVIEW TABLE ----
  sectionHeader("All Branches Overview");
  const headerRow = ["#", "Branch", "Resolved", "Unresolved", "Total", "Rate"];
  const colWidths = [10, 50, 30, 30, 25, 25];
  let tx = MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(...INK);
  doc.rect(MARGIN, y - 4, MAX_W, 8, "F");
  for (let i = 0; i < headerRow.length; i++) {
    doc.text(headerRow[i], tx + 2, y);
    tx += colWidths[i];
  }
  y += 8;

  for (const b of data.branches) {
    ensure(7);
    tx = MARGIN;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...BODY);
    const vals = [String(b.rank), b.branch, String(b.resolved), String(b.unresolved), String(b.total), `${b.pct}%`];
    for (let i = 0; i < vals.length; i++) {
      doc.text(vals[i], tx + 2, y);
      tx += colWidths[i];
    }
    y += 6;
    doc.setDrawColor(240, 240, 242);
    doc.setLineWidth(0.1);
    doc.line(MARGIN, y - 2, MARGIN + MAX_W, y - 2);
  }
  y += 4;

  // ---- PER-BRANCH SECTIONS ----
  for (const branch of data.branches) {
    newPage(18);

    // Branch header
    doc.setFillColor(...ACCENT);
    doc.rect(0, 10, PAGE_W, 28, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(`#${branch.rank}  ${branch.branch}`, MARGIN, 24);

    const badgeX = PAGE_W - MARGIN - 30;
    doc.setFillColor(branch.pct >= 80 ? 22 : branch.pct >= 50 ? 217 : 220, branch.pct >= 80 ? 163 : branch.pct >= 50 ? 119 : 38, branch.pct >= 80 ? 74 : branch.pct >= 50 ? 6 : 38);
    doc.roundedRect(badgeX, 14, 28, 20, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(`${branch.pct}%`, badgeX + 14, 26, { align: "center" });
    doc.setFontSize(6);
    doc.text("Resolution", badgeX + 14, 31, { align: "center" });

    y = 46;

    // Summary
    muted(`Resolved: ${branch.resolved}  |  Unresolved: ${branch.unresolved}  |  Total: ${branch.total}`);
    y += 2;

    const unresolvedNcrs = branch.ncrs.filter((n) => !n.resolved);
    const resolvedNcrs = branch.ncrs.filter((n) => n.resolved);
    const unresolvedInc = branch.incidents.filter((i) => !i.resolved);
    const resolvedInc = branch.incidents.filter((i) => i.resolved);
    let unresolvedQc = 0;
    let resolvedQc = 0;
    for (const s of branch.qcSessions) {
      for (const item of s.checklist ?? []) {
        if (!item.found_issue) continue;
        if (item.answer === true) resolvedQc++;
        else unresolvedQc++;
      }
    }

    // Unresolved
    if (unresolvedNcrs.length + unresolvedInc.length + unresolvedQc > 0) {
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
      if (unresolvedInc.length > 0) {
        ensure(10);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...ACCENT);
        doc.text(`Incidents (${unresolvedInc.length})`, MARGIN, y); y += 5;
        for (const inc of unresolvedInc) {
          ensure(10);
          doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK);
          doc.text(`${inc.incidentId} - ${inc.title}`, MARGIN, y); y += 4;
          muted(`Severity: ${inc.severity ?? "N/A"} | Dept: ${inc.department}`); y += 1;
        }
      }
      if (data.includeQc && unresolvedQc > 0) {
        ensure(10);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...ACCENT);
        doc.text(`QC Items (${unresolvedQc})`, MARGIN, y); y += 5;
        for (const s of branch.qcSessions) {
          const items = (s.checklist ?? []).filter((i) => i.found_issue && i.answer !== true);
          if (items.length === 0) continue;
          ensure(8); muted(`Round ${s.roundNumber} - ${new Date(s.createdAt).toLocaleDateString()}`); y += 1;
          for (const item of items) { ensure(8); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...BODY); doc.text(`- ${item.question || item.item}`, MARGIN + 4, y); y += 3.5; }
          y += 1;
        }
      }
    }

    // Resolved
    if (resolvedNcrs.length + resolvedInc.length + resolvedQc > 0) {
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
      if (resolvedInc.length > 0) {
        ensure(10);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(22, 163, 74);
        doc.text(`Incidents (${resolvedInc.length})`, MARGIN, y); y += 5;
        for (const inc of resolvedInc) {
          ensure(10);
          doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...INK);
          doc.text(`${inc.incidentId} - ${inc.title}`, MARGIN, y); y += 4;
          muted(`Severity: ${inc.severity ?? "N/A"} | Dept: ${inc.department}`); y += 1;
        }
      }
      if (data.includeQc && resolvedQc > 0) {
        ensure(10);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(22, 163, 74);
        doc.text(`QC Items (${resolvedQc})`, MARGIN, y); y += 5;
        for (const s of branch.qcSessions) {
          const items = (s.checklist ?? []).filter((i) => i.found_issue && i.answer === true);
          if (items.length === 0) continue;
          ensure(8); muted(`Round ${s.roundNumber} - ${new Date(s.createdAt).toLocaleDateString()}`); y += 1;
          for (const item of items) { ensure(8); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...BODY); doc.text(`- ${item.question || item.item}`, MARGIN + 4, y); y += 3.5; }
          y += 1;
        }
      }
    }

    // QC Rounds Detail
    if (data.includeQc && branch.qcSessions.length > 0) {
      sectionHeader("QC Inspection Rounds");
      for (const s of branch.qcSessions) {
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

    // NCR Photos
    const ncrPhotos = branch.ncrs.filter((n) => n.photos.length > 0);
    if (ncrPhotos.length > 0) {
      sectionHeader("NCR Evidence Photos");
      for (const ncr of ncrPhotos) {
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

    // Incident Photos
    const incPhotos = branch.incidents.filter((i) => i.photos.length > 0);
    if (incPhotos.length > 0) {
      sectionHeader("Incident Evidence Photos");
      for (const inc of incPhotos) {
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
    ? `Branch-of-Month-${MONTHS[data.month]}-${data.year}-All-Branches.pdf`
    : `Branch-of-Year-${data.year}-All-Branches.pdf`;
  doc.save(filename);
}
