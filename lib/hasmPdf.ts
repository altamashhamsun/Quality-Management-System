import { jsPDF } from "jspdf";
import { asHasmReport, imageProxyUrl, isResolved, type HasmRecord } from "./hasm";

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const MAX_W = PAGE_W - MARGIN * 2;

const DARK: readonly [number, number, number] = [22, 22, 30];
const ACCENT: readonly [number, number, number] = [234, 88, 12];
const INK: readonly [number, number, number] = [30, 30, 40];
const BODY: readonly [number, number, number] = [52, 52, 62];
const MUTED: readonly [number, number, number] = [130, 130, 140];
const GREEN: readonly [number, number, number] = [22, 122, 82];
const RED: readonly [number, number, number] = [185, 28, 28];
const LIGHT: readonly [number, number, number] = [247, 247, 250];
const BORDER: readonly [number, number, number] = [218, 218, 224];

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
export async function fetchImageDataUrl(url: string): Promise<string> {
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

export type HasmPdfData = {
  title: string;
  date: string;
  time: string;
  status: string;
  location: string;
  description: string;
  hazard: string;
  why: string;
  risks: string[];
  corrective_actions: string[];
  safety_precautions: string[];
  standards: string[];
  reference: string;
  photos: string[];
};

export function buildHasmPdfData(record: HasmRecord): HasmPdfData {
  const report = asHasmReport(record.ai_json);
  const status = isResolved(record) ? "Resolved" : "Unresolved";
  const d = new Date(record.created_at);
  return {
    title: report?.title || record.title || "Hazard Report",
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    status,
    location: record.location || "—",
    description: record.description || "",
    hazard: report?.hazard || "",
    why: report?.why || "",
    risks: report?.risks ?? [],
    corrective_actions: report?.corrective_actions ?? [],
    safety_precautions: report?.safety_precautions ?? [],
    standards: report?.standards ?? [],
    reference: `HASM-${record.id.slice(0, 8).toUpperCase()}`,
    photos: (record.pictures ?? []).filter(Boolean),
  };
}

export async function downloadHasmPdf(record: HasmRecord) {
  const data = buildHasmPdfData(record);

  const doc = new jsPDF("p", "mm", "a4");
  let y = 0;

  const newPage = (top = 24) => {
    doc.addPage();
    y = top;
  };

  const ensure = (need: number) => {
    if (PAGE_H - y < need) newPage();
  };

  const sectionHeader = (title: string, color: readonly [number, number, number] = ACCENT) => {
    ensure(26);
    y += 4;
    doc.setFillColor(...color);
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
    y += 3;
  };

  const bulletList = (items: string[]) => {
    const list = items.length ? items : ["—"];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...BODY);
    for (const item of list) {
      const lines = wrap(doc, item, MAX_W - 8);
      for (let i = 0; i < lines.length; i++) {
        ensure(5.5);
        doc.text(i === 0 ? "•" : "", MARGIN, y);
        doc.text(lines[i], MARGIN + 5, y);
        y += 5;
      }
    }
    y += 2;
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
  doc.text("Hazard Analysis & Safety Management", MARGIN, 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(...ACCENT);
  doc.roundedRect(PAGE_W - MARGIN - 56, 10, 56, 10, 1.5, 1.5, "F");
  doc.text("HAZARD REPORT", PAGE_W - MARGIN - 28, 17, { align: "center" });

  // ---------- TITLE ----------
  y = 48;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  const titleLines = wrap(doc, data.title, MAX_W);
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 7.5 + 4;

  // ---------- META ----------
  const statusColor = data.status === "Resolved" ? GREEN : RED;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...statusColor);
  doc.text(`STATUS: ${data.status.toUpperCase()}`, MARGIN, y);
  y += 6;

  const meta: Array<[string, string]> = [
    ["Reference", data.reference],
    ["Reported", `${data.date} ${data.time}`],
    ["Location", data.location || "—"],
  ];
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(MARGIN, y, MAX_W, 8 * meta.length + 6, 2, 2, "FD");
  let my = y + 6;
  for (const [label, value] of meta) {
    doc.setFillColor(222, 222, 228);
    doc.rect(MARGIN, my - 4.5, 44, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 82);
    doc.text(label, MARGIN + 4, my + 0.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const wrapped = wrap(doc, value || "—", MAX_W - 60);
    doc.text(wrapped[0], MARGIN + 52, my + 0.5);
    my += 8;
  }
  y = my + 6;

  // ---------- SECTIONS ----------
  if (data.description) {
    sectionHeader("1. What Was Reported");
    body(data.description);
  }

  sectionHeader("2. The Hazard");
  body(data.hazard || "No hazard summary available.");

  sectionHeader("3. Why It Is a Hazard");
  body(data.why || "No explanation available.");

  sectionHeader("4. Risks");
  bulletList(data.risks);

  sectionHeader("5. Corrective Actions");
  bulletList(data.corrective_actions);

  sectionHeader("6. Safety Precautions");
  bulletList(data.safety_precautions);

  sectionHeader("7. Relevant Standards");
  bulletList(data.standards.length ? data.standards : ["—"]);

  // ---------- PHOTOS ----------
  sectionHeader("8. Photos");
  if (data.photos.length === 0) {
    body("No photos attached.");
  } else {
    const maxH = 90;
    for (const url of data.photos) {
      try {
        const dataUrl = await fetchImageDataUrl(url);
        const dims = await getImageDimensions(dataUrl);
        const fmt = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
        // Scale by pixels so the aspect ratio stays exact (never stretched).
        let w = MAX_W;
        let h = (w * dims.height) / dims.width;
        if (h > maxH) {
          h = maxH;
          w = (h * dims.width) / dims.height;
        }
        ensure(h + 10);
        doc.addImage(dataUrl, fmt, MARGIN, y, w, h);
        y += h + 6;
      } catch {
        ensure(30);
        doc.setFillColor(240, 240, 243);
        doc.setDrawColor(...BORDER);
        doc.rect(MARGIN, y, MAX_W, 20, "FD");
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text("Photo", MARGIN + MAX_W / 2, y + 12, { align: "center" });
        y += 26;
      }
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
      `${data.reference}  |  Page ${i} of ${total}`,
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

  doc.save(`${data.reference}.pdf`);
}
