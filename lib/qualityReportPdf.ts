import { jsPDF } from "jspdf";

export type QualityReportPdfData = {
  title: string;
  branchName: string;
  date: string;
  auditor?: string;
  rounds: Array<{
    roundNumber: number;
    createdAt?: string;
    descriptions: Record<string, { text: string; writtenAt: string }>;
    checklist?: Array<{
      item: string;
      question: string;
      found_issue: string;
      answer?: boolean;
      photos?: string[];
    }>;
  }>;
  chartData?: Array<{
    round: number;
    resolved: number;
    unresolved: number;
    resolutionRate: number;
  }>;
  summary?: {
    totalRounds: number;
    totalResolved: number;
    totalUnresolved: number;
    overallRate: number;
    trendDirection: "improved" | "declined" | "unchanged";
    rateChange: number;
    firstRoundRate: number;
    lastRoundRate: number;
    bestRound: number;
    worstRound: number;
  };
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

function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  for (const chunk of text.split("\n")) {
    const wrapped = doc.splitTextToSize(chunk, maxWidth) as string[];
    lines.push(...wrapped);
  }
  return lines;
}

export function downloadQualityReportPdf(data: QualityReportPdfData) {
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
  const chip = "QUALITY REPORT";
  doc.roundedRect(PAGE_W - MARGIN - 40, 10, 40, 10, 1.5, 1.5, "F");
  doc.text(chip, PAGE_W - MARGIN - 20, 17, { align: "center" });

  // ---- SUBTITLE ----
  y = 44;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text("Quality Control Report", MARGIN, y);
  y += 8;

  // ---- TITLE ----
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  const titleLines = doc.splitTextToSize(
    data.title || "Quality Control Report",
    MAX_W
  ) as string[];
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 7.5 + 4;

  // ---- META CARD ----
  const roundsCompleted = data.rounds.length;
  const meta: Array<[string, string]> = [
    ["Branch", data.branchName || "—"],
    ["Date", data.date || "—"],
    ["Rounds Completed", roundsCompleted > 0 ? `${roundsCompleted}` : "0"],
  ];
  if (data.auditor) meta.push(["Auditor", data.auditor]);
  const rowH = 8;
  const cardH = meta.length * rowH + 6;

  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(MARGIN, y, MAX_W, cardH, 2, 2, "FD");
  let my = y + 6;
  for (const [label, value] of meta) {
    doc.setFillColor(222, 222, 228);
    doc.rect(MARGIN, my - 4.5, 44, rowH + 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 82);
    doc.text(label, MARGIN + 4, my + 0.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(value, MARGIN + 52, my + 0.5);
    my += rowH + 3;
  }
  y = my + 6;

  // ---- EXECUTIVE SUMMARY ----
  if (data.summary) {
    const s = data.summary;
    sectionHeader("Executive Summary");

    const trendColor: [number, number, number] = s.trendDirection === "improved" ? [30, 140, 60] : s.trendDirection === "declined" ? [ACCENT[0], ACCENT[1], ACCENT[2]] : [MUTED[0], MUTED[1], MUTED[2]];
    const summaryLines: string[] = [
      `Total rounds completed: ${s.totalRounds}`,
      `Total issues found: ${s.totalResolved + s.totalUnresolved} (${s.totalResolved} resolved, ${s.totalUnresolved} unresolved)`,
      `Overall resolution rate: ${s.overallRate.toFixed(1)}%`,
      `Quality trend: ${s.trendDirection === "improved" ? "IMPROVED" : s.trendDirection === "declined" ? "DECLINED" : "UNCHANGED"} (${s.rateChange > 0 ? "+" : ""}${s.rateChange.toFixed(1)}% from Round 1 to Round ${s.totalRounds})`,
      `Best performing round: Round ${s.bestRound} | Worst performing round: Round ${s.worstRound}`,
    ];

    for (const line of summaryLines) {
      ensure(6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...BODY);
      doc.text(line, MARGIN + 2, y);
      y += 5.5;
    }

    ensure(14);
    const trendLabel = s.trendDirection === "improved" ? "IMPROVED" : s.trendDirection === "declined" ? "DECLINED" : "NO CHANGE";
    doc.setFillColor(...trendColor);
    doc.roundedRect(MARGIN + 2, y, 50, 8, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`${trendLabel}  ${s.rateChange > 0 ? "+" : ""}${s.rateChange.toFixed(1)}%`, MARGIN + 27, y + 5.5, { align: "center" });
    y += 14;
  }

  // ---- CHART ----
  if (data.chartData && data.chartData.length > 0) {
    sectionHeader("Quality Progress Chart");

    const chartX = MARGIN + 5;
    const chartW = MAX_W - 10;
    const chartH = 70;
    const chartY = y + 2;
    const padL = 20;
    const padR = 14;
    const padT = 10;
    const padB = 18;
    const innerW = chartW - padL - padR;
    const innerH = chartH - padT - padB;

    ensure(chartH + 16);

    doc.setFillColor(252, 252, 254);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(chartX, chartY, chartW, chartH, 2, 2, "FD");

    const maxRate = 100;
    const dataPoints = data.chartData;

    const getX = (i: number) => chartX + padL + (dataPoints.length > 1 ? (i / (dataPoints.length - 1)) * innerW : innerW / 2);
    const getY = (rate: number) => chartY + padT + innerH - (rate / maxRate) * innerH;

    // Grid lines
    doc.setDrawColor(230, 230, 236);
    doc.setLineWidth(0.15);
    for (let pct = 0; pct <= 100; pct += 25) {
      const gy = getY(pct);
      doc.line(chartX + padL, gy, chartX + chartW - padR, gy);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...MUTED);
      doc.text(`${pct}%`, chartX + padL - 10, gy + 1.5, { align: "right" });
    }

    // X-axis labels
    for (let i = 0; i < dataPoints.length; i++) {
      const px = getX(i);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...BODY);
      doc.text(dataPoints[i].round === 0 ? "Start" : `R${dataPoints[i].round}`, px, chartY + chartH - 3, { align: "center" });
    }

    // Area fill under the line (using polygon)
    if (dataPoints.length > 1) {
      doc.setFillColor(16, 185, 129);
      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(0.1);
      const pts: [number, number][] = [[getX(0), getY(0)]];
      for (let i = 0; i < dataPoints.length; i++) {
        pts.push([getX(i), getY(dataPoints[i].resolutionRate)]);
      }
      pts.push([getX(dataPoints.length - 1), getY(0)]);
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        doc.line(x1, y1, x2, y2);
      }
    }

    // Line — connects zero baseline through each round
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(1.6);
    for (let i = 0; i < dataPoints.length - 1; i++) {
      doc.line(getX(i), getY(dataPoints[i].resolutionRate), getX(i + 1), getY(dataPoints[i + 1].resolutionRate));
    }

    // Dots + value labels (skip zero starting point)
    for (let i = 1; i < dataPoints.length; i++) {
      const px = getX(i);
      const py = getY(dataPoints[i].resolutionRate);
      doc.setFillColor(16, 185, 129);
      doc.circle(px, py, 2.5, "F");
      doc.setFillColor(255, 255, 255);
      doc.circle(px, py, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(16, 140, 100);
      doc.text(`${dataPoints[i].resolutionRate}%`, px, py - 4, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...MUTED);
      doc.text(`${dataPoints[i].resolved}/${dataPoints[i].resolved + dataPoints[i].unresolved}`, px, py + 6, { align: "center" });
    }

    y = chartY + chartH + 8;

    // X-axis title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...BODY);
    doc.text("Round", chartX + padL + innerW / 2, chartY + chartH - 2, { align: "center" });

    // Y-axis title (rotated)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...BODY);
    const yTitleX = chartX + 3;
    const yTitleY = chartY + padT + innerH / 2;
    doc.text("Resolution Rate %", yTitleX, yTitleY, { align: "center", angle: 90 });
  }

  // ---- ROUNDS ----
  for (const round of data.rounds) {
    const isRound1 = round.roundNumber === 1;
    const headerTitle = round.createdAt
      ? `Round ${round.roundNumber}  —  ${round.createdAt}`
      : `Round ${round.roundNumber}`;
    sectionHeader(headerTitle);

    if (isRound1) {
      // Round 1: list descriptions per item
      const entries = Object.entries(round.descriptions);
      if (entries.length === 0) {
        emptyBox("No description data recorded for this round.");
      } else {
        for (const [itemName, desc] of entries) {
          ensure(20);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10.5);
          doc.setTextColor(...INK);
          doc.text(itemName, MARGIN, y);
          y += 6;
          const descText = desc.text || "No description provided.";
          body(descText);
          if (desc.writtenAt) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor(...MUTED);
            doc.text(`Last edited: ${desc.writtenAt}`, MARGIN, y);
            y += 5;
          }
        }
      }
    } else {
      // Round 2+: checklist table
      const checklist = round.checklist ?? [];
      if (checklist.length === 0) {
        emptyBox("No checklist items recorded for this round.");
      } else {
        // Column widths: # | Area | Question | Found Issue | Status
        const colW = [10, 30, 55, 55, 28];
        const tableW = colW.reduce((a, b) => a + b, 0);
        const tableX = MARGIN;
        const headers = ["#", "Area", "Question", "Found Issue", "Status"];
        const headerH = 8;
        const cellPadX = 2;
        const lineH = 4.2;

        // --- Table header ---
        ensure(headerH + 6);
        doc.setFillColor(...DARK);
        doc.rect(tableX, y, tableW, headerH, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(245, 245, 248);
        let cx = tableX;
        for (let c = 0; c < headers.length; c++) {
          doc.text(headers[c], cx + cellPadX, y + 5.5);
          cx += colW[c];
        }
        y += headerH;

        // --- Table rows ---
        for (let r = 0; r < checklist.length; r++) {
          const item = checklist[r];
          const status = item.answer === true ? "Resolved ✓" : item.answer === false ? "Unresolved ✗" : "—";
          const values = [
            `${r + 1}`,
            item.item || "",
            item.question || "",
            item.found_issue || "",
            status,
          ];

          const cellLines = values.map((v, c) =>
            wrapLines(doc, v, colW[c] - cellPadX * 2)
          );
          const maxLines = Math.max(...cellLines.map((l) => l.length), 1);
          const rowHCalc = maxLines * lineH + 4;

          ensure(rowHCalc + 2);

          // Alternate row background
          if (r % 2 === 0) {
            doc.setFillColor(252, 252, 254);
            doc.rect(tableX, y, tableW, rowHCalc, "F");
          }

          // Row bottom border
          doc.setDrawColor(235, 235, 240);
          doc.setLineWidth(0.2);
          doc.line(tableX, y + rowHCalc, tableX + tableW, y + rowHCalc);

          // Cell text
          doc.setFontSize(8);
          let cellX = tableX;
          for (let c = 0; c < values.length; c++) {
            const lines = cellLines[c];
            if (c === 4) {
              // Status column — colored text
              if (item.answer === true) {
                doc.setTextColor(30, 140, 60);
              } else if (item.answer === false) {
                doc.setTextColor(...ACCENT);
              } else {
                doc.setTextColor(...MUTED);
              }
              doc.setFont("helvetica", "bold");
            } else {
              doc.setFont("helvetica", c === 0 ? "bold" : "normal");
              doc.setTextColor(...BODY);
            }
            let ly = y + 4.5;
            for (const line of lines) {
              doc.text(line, cellX + cellPadX, ly);
              ly += lineH;
            }
            // Draw vertical column separators
            if (c < values.length - 1) {
              doc.setDrawColor(235, 235, 240);
              doc.setLineWidth(0.2);
              doc.line(cellX + colW[c], y, cellX + colW[c], y + rowHCalc);
            }
            cellX += colW[c];
          }

          y += rowHCalc;

          // Render photos for this checklist item
          const itemPhotos = (item as { photos?: string[] }).photos;
          if (itemPhotos && itemPhotos.length > 0) {
            for (const photo of itemPhotos) {
              try {
                const props = doc.getImageProperties(photo);
                const maxW = MAX_W - 4;
                const maxH = 110;
                let imgW = props.width;
                let imgH = props.height;
                if (imgW > maxW) { imgH = (imgH / imgW) * maxW; imgW = maxW; }
                if (imgH > maxH) { imgW = (imgW / imgH) * maxH; imgH = maxH; }
                ensure(imgH + 12);
                const imgX = MARGIN + (MAX_W - imgW) / 2;
                doc.addImage(photo, "JPEG", imgX, y, imgW, imgH);
                doc.setDrawColor(80, 80, 90);
                doc.setLineWidth(0.6);
                doc.rect(imgX, y, imgW, imgH, "S");
                y += imgH + 6;
              } catch {
                // skip invalid image
              }
            }
          }
        }

        // Table outer border
        const totalTableH =
          headerH +
          checklist.reduce((acc, item) => {
            const cellLines = [
              "",
              item.item || "",
              item.question || "",
              item.found_issue || "",
              "",
            ].map((v, c) => wrapLines(doc, v, colW[c] - cellPadX * 2));
            const maxLines = Math.max(...cellLines.map((l) => l.length), 1);
            return acc + maxLines * lineH + 4;
          }, 0);
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.3);
        doc.rect(tableX, y - totalTableH, tableW, totalTableH, "S");
        doc.setLineWidth(0.2);

        y += 6;
      }
    }
  }

  if (data.rounds.length === 0) {
    sectionHeader("Rounds");
    emptyBox("No rounds have been completed yet.");
  }

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
      doc.text(data.title || "Quality Control Report", MARGIN, 7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(170, 170, 180);
      doc.text(data.branchName || "", PAGE_W - MARGIN, 7.5, { align: "right" });
    }
    doc.setDrawColor(222, 222, 227);
    doc.line(MARGIN, PAGE_H - 13, PAGE_W - MARGIN, PAGE_H - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const dateSlug = (data.date || "report").replace(/[^a-z0-9]+/gi, "-").replace(/-$/, "");
    doc.text(
      `QC-${dateSlug}  |  Page ${i} of ${total}`,
      MARGIN,
      PAGE_H - 7.5
    );
    doc.text(
      `Generated ${data.date || new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}`,
      PAGE_W - MARGIN,
      PAGE_H - 7.5,
      { align: "right" }
    );
  }

  doc.save(`${(data.title || "quality-report").replace(/[^a-z0-9]+/gi, "-")}.pdf`);
}
