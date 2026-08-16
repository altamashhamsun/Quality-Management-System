import { jsPDF } from "jspdf";
import { isResolved, severityLabel, type IncidentRecord } from "./incident";
import { dateLabel, imageProxyUrl, timeLabel } from "./hasm";

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const MAX_W = PAGE_W - MARGIN * 2;

type Color = readonly [number, number, number];

const DARK: Color = [18, 18, 26];
const ACCENT: Color = [200, 30, 40];
const INK: Color = [30, 30, 40];
const BODY: Color = [52, 52, 62];
const MUTED: Color = [130, 130, 140];
const GREEN: Color = [22, 122, 82];
const RED: Color = [185, 28, 28];
const ORANGE: Color = [194, 90, 20];
const AMBER: Color = [180, 130, 20];
const LIGHT: Color = [247, 247, 250];
const BORDER: Color = [218, 218, 224];

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  if (!text) return [""];
  const lines: string[] = [];
  for (const chunk of text.split("\n")) {
    const wrapped = doc.splitTextToSize(chunk, maxWidth) as string[];
    lines.push(...(wrapped.length ? wrapped : [""]));
  }
  return lines.length ? lines : [""];
}

/** Fetch a remote image (e.g. Google Drive) into a data URL for embedding. */
async function fetchImageDataUrl(url: string): Promise<string> {
  const res = await fetch(imageProxyUrl(url));
  if (!res.ok) throw new Error("fetch failed");
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Read the natural pixel size of an image so it can be drawn at exact aspect ratio. */
function getImageDimensions(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || 1,
        height: img.naturalHeight || 1,
      });
    img.onerror = () => reject(new Error("bad image"));
    img.src = dataUrl;
  });
}

export async function downloadIncidentReportPdf(records: IncidentRecord[]) {
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

  const subHeader = (title: string, color: Color = ACCENT) => {
    ensure(15);
    y += 3;
    doc.setFillColor(...color);
    doc.rect(MARGIN, y - 3.2, 1.6, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(title, MARGIN + 4, y);
    y += 5;
  };

  const body = (text: string, lineH = 5) => {
    if (!text) return;
    const lines = wrap(doc, text, MAX_W);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...BODY);
    for (const line of lines) {
      ensure(lineH + 4);
      doc.text(line, MARGIN, y);
      y += lineH;
    }
    y += 2;
  };

  const kv = (label: string, value: string | null | undefined) => {
    const v = (value ?? "").trim();
    if (!v) return;
    const lines = wrap(doc, v, MAX_W - 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    for (let i = 0; i < lines.length; i++) {
      ensure(5);
      if (i === 0) {
        doc.text(label, MARGIN, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...BODY);
      }
      doc.text(lines[i], MARGIN + 42, y);
      y += 4.5;
    }
    y += 1.5;
  };

  const statBoxes = (items: { label: string; value: number; color?: Color }[]) => {
    const cols = 3;
    const gap = 4;
    const w = (MAX_W - gap * (cols - 1)) / cols;
    const h = 15;
    const rows = Math.ceil(items.length / cols);
    ensure(rows * h + (rows - 1) * gap + 10);
    for (let i = 0; i < items.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = MARGIN + col * (w + gap);
      const yy = y + row * (h + gap);
      doc.setFillColor(...LIGHT);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(x, yy, w, h, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...(items[i].color ?? INK));
      doc.text(String(items[i].value), x + 5, yy + 7.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(items[i].label, x + 5, yy + 12);
    }
    y += rows * h + (rows - 1) * gap + 6;
  };

  const renderTable = (headers: string[], colWidths: number[], rows: string[][]) => {
    if (rows.length === 0) return;
    const PAD = 2;
    const LINE_H = 4.2;
    const HEAD_H = 8;

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
      doc.setFillColor(...(isHead ? DARK : LIGHT));
      doc.setDrawColor(...BORDER);
      doc.rect(MARGIN, y - 2, MAX_W, h, "F");
      doc.setFont("helvetica", isHead ? "bold" : "normal");
      doc.setFontSize(7.5);
      let cx = MARGIN;
      for (let c = 0; c < cells.length; c++) {
        const cellLines = wrap(doc, cells[c] || "—", colWidths[c] - PAD * 2);
        doc.setTextColor(isHead ? 255 : 40, isHead ? 255 : 40, isHead ? 255 : 55);
        cellLines.forEach((line, li) => doc.text(line, cx + PAD, y + LINE_H * li + 2.2));
        cx += colWidths[c];
      }
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
    y += 4;
  };

  // ---------- COVER BAND ----------
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
  doc.text("Incident Management System", MARGIN, 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(...ACCENT);
  doc.roundedRect(PAGE_W - MARGIN - 60, 10, 60, 10, 1.5, 1.5, "F");
  doc.text("INCIDENT LOG REPORT", PAGE_W - MARGIN - 30, 17, { align: "center" });

  // ---------- TITLE ----------
  y = 48;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  const titleLines = wrap(doc, "Incident Management Report", MAX_W);
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 7.5 + 3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const subtitle = `Complete register of all logged incidents (${records.length} total) — prepared for senior management.`;
  const subLines = wrap(doc, subtitle, MAX_W);
  for (const line of subLines) {
    doc.text(line, MARGIN, y);
    y += 5;
  }
  y += 3;

  // ---------- 1. EXECUTIVE SUMMARY ----------
  sectionHeader("1. Executive Summary");

  const resolvedCount = records.filter((r) => isResolved(r)).length;
  const unresolvedCount = records.length - resolvedCount;
  const criticalCount = records.filter((r) => r.severity === "critical").length;
  const majorCount = records.filter((r) => r.severity === "major").length;
  const minorCount = records.filter((r) => r.severity === "minor").length;

  statBoxes([
    { label: "TOTAL INCIDENTS", value: records.length, color: INK },
    { label: "RESOLVED", value: resolvedCount, color: GREEN },
    { label: "UNRESOLVED", value: unresolvedCount, color: RED },
    { label: "CRITICAL", value: criticalCount, color: RED },
    { label: "MAJOR", value: majorCount, color: ORANGE },
    { label: "MINOR", value: minorCount, color: AMBER },
  ]);

  const byType = new Map<string, number>();
  for (const r of records) {
    const key = r.incident_type || "Unspecified";
    byType.set(key, (byType.get(key) ?? 0) + 1);
  }
  const byBranch = new Map<string, number>();
  for (const r of records) {
    const key = r.branch_name || "Unknown";
    byBranch.set(key, (byBranch.get(key) ?? 0) + 1);
  }

  if (byType.size > 0) {
    subHeader("Incidents by Type");
    renderTable(
      ["Incident Type", "Count"],
      [150, 32],
      [...byType.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v)]),
    );
  }

  if (byBranch.size > 0) {
    subHeader("Incidents by Branch");
    renderTable(
      ["Branch", "Count"],
      [150, 32],
      [...byBranch.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v)]),
    );
  }

  // ---------- 2. INCIDENTS IN DETAIL ----------
  sectionHeader("2. Incidents in Detail");

  const sevRank: Record<string, number> = { critical: 0, major: 1, minor: 2 };
  const sorted = [...records].sort((a, b) => {
    const ra = sevRank[a.severity ?? ""] ?? 3;
    const rb = sevRank[b.severity ?? ""] ?? 3;
    if (ra !== rb) return ra - rb;
    const ta = a.occurred_at ?? a.created_at;
    const tb = b.occurred_at ?? b.created_at;
    return tb.localeCompare(ta);
  });

  if (sorted.length === 0) {
    body("No incidents have been logged yet.");
  } else {
    for (const r of sorted) {
      const resolved = isResolved(r);
      const sevColor =
        r.severity === "critical"
          ? RED
          : r.severity === "major"
            ? ORANGE
            : r.severity === "minor"
              ? AMBER
              : MUTED;

      ensure(40);
      y += 8;

      // incident header bar
      doc.setFillColor(...DARK);
      doc.rect(MARGIN, y - 5, MAX_W, 9, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(r.incident_id || "INCIDENT", MARGIN + 3, y + 0.5);
      doc.setTextColor(
        resolved ? 210 : 255,
        resolved ? 255 : 120,
        resolved ? 220 : 120,
      );
      doc.text(
        resolved ? "RESOLVED" : "UNRESOLVED",
        PAGE_W - MARGIN - 3,
        y + 0.5,
        { align: "right" },
      );
      y += 7;

      // title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12.5);
      doc.setTextColor(...INK);
      const title = r.title || "Untitled Incident";
      const titleLines2 = wrap(doc, title, MAX_W - 30);
      doc.text(titleLines2, MARGIN, y);
      y += titleLines2.length * 5.5 + 1;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...sevColor);
      doc.text(`SEVERITY: ${severityLabel(r.severity).toUpperCase()}`, MARGIN, y);
      y += 4.5;

      const metaParts = [
        r.occurred_at
          ? `Occurred: ${dateLabel(r.occurred_at)} ${timeLabel(r.occurred_at)}`
          : `Logged: ${dateLabel(r.created_at)}`,
        r.branch_name ? `Branch: ${r.branch_name}` : "",
        r.department_name ? `Dept: ${r.department_name}` : "",
        r.location ? `Location: ${r.location}` : "",
      ].filter(Boolean);
      if (metaParts.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        const metaLines = wrap(doc, metaParts.join("   |   "), MAX_W);
        for (const line of metaLines) {
          ensure(5);
          doc.text(line, MARGIN, y);
          y += 4.5;
        }
      }
      y += 2;

      if ((r.description ?? "").trim()) {
        subHeader("What Happened");
        body(r.description ?? "");
      }

      const people = (r.people_involved ?? "").trim();
      const witnesses = (r.witnesses ?? "").trim();
      if (people || witnesses) {
        subHeader("People Involved");
        if (people) kv("People", people);
        if (witnesses) kv("Witnesses", witnesses);
      }

      const impacts: Array<[string, string | null | undefined]> = [
        ["Injury", r.injury],
        ["Property damage", r.property_damage],
        ["Guest impact", r.guest_impact],
        ["Food-safety impact", r.food_safety_impact],
        ["Operational / business impact", r.operational_impact],
      ];
      if (impacts.some(([, v]) => (v ?? "").trim())) {
        subHeader("Impact");
        for (const [label, value] of impacts) kv(label, value);
      }

      const inv: Array<[string, string | null | undefined]> = [
        ["Immediate cause", r.immediate_cause],
        ["Root cause", r.root_cause],
        ["Contributing factors", r.contributing_factors],
      ];
      if (inv.some(([, v]) => (v ?? "").trim())) {
        subHeader("Investigation & Root Cause");
        for (const [label, value] of inv) kv(label, value);
      }

      const comp: Array<[string, string | null | undefined]> = [
        ["Relevant SOP", r.suggested_sop],
        ["SOP / ISO clause", r.suggested_sop_clause],
        ["ISO standard(s)", (r.suggested_standards ?? []).join("; ")],
      ];
      if (comp.some(([, v]) => (v ?? "").trim())) {
        subHeader("Compliance Reference");
        for (const [label, value] of comp) kv(label, value);
      }

      const capa: Array<[string, string | null | undefined]> = [
        ["Immediate correction", r.immediate_correction],
        ["Corrective action", r.corrective_action],
        ["Preventive action", r.preventive_action],
        ["Responsible person", r.responsible_person],
        ["Deadline", r.deadline ? dateLabel(r.deadline) : ""],
      ];
      if (capa.some(([, v]) => (v ?? "").trim())) {
        subHeader("Action Plan (CAPA)");
        for (const [label, value] of capa) kv(label, value);
      }

      const photoUrls = (r.pictures ?? []).filter(Boolean).slice(0, 3);
      if (photoUrls.length > 0) {
        subHeader("Evidence Photos");
        const maxH = 40;
        for (const url of photoUrls) {
          try {
            const dataUrl = await fetchImageDataUrl(url);
            const dims = await getImageDimensions(dataUrl);
            const fmt = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
            let w = MAX_W * 0.55;
            let h = (w * dims.height) / dims.width;
            if (h > maxH) {
              h = maxH;
              w = (h * dims.width) / dims.height;
            }
            ensure(h + 8);
            doc.addImage(dataUrl, fmt, MARGIN, y, w, h);
            y += h + 4;
          } catch {
            // skip broken photo
          }
        }
      }

      // divider between incidents
      y += 2;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      doc.setLineWidth(0.2);
      y += 5;
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
      `Incident Management Report  |  Page ${i} of ${total}`,
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

  const stamp = new Date();
  const fileDate = `${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, "0")}-${String(stamp.getDate()).padStart(2, "0")}`;
  doc.save(`Incident-Management-Report-${fileDate}.pdf`);
}
