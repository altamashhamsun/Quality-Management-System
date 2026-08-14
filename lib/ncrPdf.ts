import { jsPDF } from "jspdf";

export type NcrPdfData = {
  ncrNumber: string;
  branch: string;
  department: string;
  guideline: string;
  clause: string;
  description: string;
  rootCause: string;
  correctiveAction: string;
  preventiveAction: string;
  consequences: string;
  openingDate: string;
  dueDate: string;
  priority: string;
  status: string;
  photos: string[];
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load photo"));
    img.src = url;
  });
}

async function renderNcrPage(doc: jsPDF, ncr: NcrPdfData) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Non-Conformance Record", margin, y);
  y += 8;
  doc.setFontSize(13);
  doc.setTextColor(60, 60, 60);
  doc.text(ncr.ncrNumber, margin, y);
  y += 4;
  doc.setDrawColor(150);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setTextColor(0, 0, 0);
  const rows: Array<[string, string]> = [
    ["Branch", ncr.branch],
    ["Department", ncr.department],
    ["Standard / Guideline", ncr.guideline],
    ["Clause Violated", ncr.clause],
    ["Priority", ncr.priority],
    ["Opening Date", ncr.openingDate],
    ["Due Date (Timeline)", ncr.dueDate],
    ["Status", ncr.status],
  ];

  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(value || "\u2014", pageW - margin * 2 - 55) as string[];
    doc.text(wrapped, margin + 55, y);
    y += Math.max(wrapped.length, 1) * 4.6 + 2;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  }

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Issue Description", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const desc = doc.splitTextToSize(ncr.description, pageW - margin * 2) as string[];
  doc.text(desc, margin, y);
  y += desc.length * 4.6 + 4;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Root Cause", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const rc = doc.splitTextToSize(ncr.rootCause, pageW - margin * 2) as string[];
  doc.text(rc, margin, y);
  y += rc.length * 4.6 + 4;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Corrective Action", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const ca = doc.splitTextToSize(ncr.correctiveAction, pageW - margin * 2) as string[];
  doc.text(ca, margin, y);
  y += ca.length * 4.6 + 4;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Preventive Action", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const pa = doc.splitTextToSize(ncr.preventiveAction, pageW - margin * 2) as string[];
  doc.text(pa, margin, y);
  y += pa.length * 4.6 + 4;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Consequences", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const cons = doc.splitTextToSize(ncr.consequences, pageW - margin * 2) as string[];
  doc.text(cons, margin, y);
  y += cons.length * 4.6 + 6;
  if (y > 270) {
    doc.addPage();
    y = 20;
  }

  for (let i = 0; i < ncr.photos.length; i++) {
    const dataUrl = ncr.photos[i];
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Photo ${i + 1}`, margin, y);
    y += 3;
    try {
      const img = await loadImage(dataUrl);
      const ratio = img.naturalWidth / img.naturalHeight;
      let w = 120;
      let h = w / ratio;
      if (h > 80) {
        h = 80;
        w = h * ratio;
      }
      const fmt = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(dataUrl, fmt, margin, y, w, h);
      y += h + 6;
    } catch {
      y += 10;
    }
  }
}

export async function downloadNcrPdf(ncr: NcrPdfData) {
  const doc = new jsPDF();
  await renderNcrPage(doc, ncr);
  doc.save(`${ncr.ncrNumber}.pdf`);
}

export async function downloadNcrsPdf(ncrs: NcrPdfData[], filename = "ncrs-report.pdf") {
  if (ncrs.length === 0) return;
  const doc = new jsPDF();
  let first = true;
  for (const ncr of ncrs) {
    if (!first) doc.addPage();
    first = false;
    await renderNcrPage(doc, ncr);
  }
  doc.save(filename);
}
