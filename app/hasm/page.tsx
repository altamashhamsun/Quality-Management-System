"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import Header from "@/components/Header";
import StatsTile from "@/components/StatsTile";
import {
  asHasmReport,
  dateLabel,
  driveFileIds,
  driveImageUrl,
  formatHasmReport,
  imageProxyUrl,
  isResolved,
  timeLabel,
  type HasmRecord,
  type HasmReport,
} from "@/lib/hasm";

import Lightbox from "@/components/Lightbox";

type Photo = {
  file: File;
  url: string;
  driveUrl: string;
  driveLink: string;
};

type Group = { label: string; key: string; records: HasmRecord[] };

function buildGroups(records: HasmRecord[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of records) {
    const label = dateLabel(r.created_at);
    const existing = map.get(label);
    if (existing) existing.records.push(r);
    else map.set(label, { label, key: label, records: [r] });
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Downscale the photo before sending to AI so the request stays small. */
async function fileToBase64ForAi(
  file: File,
): Promise<{ base64: string; mime: string }> {
  const maxDim = 1280;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  return { base64: dataUrl.split(",")[1] ?? "", mime: "image/jpeg" };
}

export default function HasmPage() {
  const { loading } = useAuth();
  const [records, setRecords] = useState<HasmRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [details, setDetails] = useState("");
  const [location, setLocation] = useState("");
  const [report, setReport] = useState<HasmReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{
    photos: string[];
    links: string[];
    index: number;
  } | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("hasm_records")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    setRecords(data ?? []);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    (async () => {
      await load();
    })();
  }, [loading, load]);

  const groups = useMemo(() => buildGroups(records), [records]);
  const summary = useMemo(
    () => ({
      total: records.length,
      resolved: records.filter((r) => isResolved(r)).length,
      unresolved: records.filter((r) => !isResolved(r)).length,
    }),
    [records],
  );

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    setError(null);
    for (const file of files) {
      readAsDataUrl(file)
        .then((url) => {
          setPhotos((prev) => [...prev, { file, url, driveUrl: "", driveLink: "" }]);
        })
        .catch(() => setError("Could not read that image."));
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function generateReport() {
    setError(null);
    if (photos.length === 0 && details.trim() === "") {
      setError("Take a photo or write some details about the hazard first.");
      return;
    }
    setAnalyzing(true);
    setReport(null);
    try {
      let imageBase64 = "";
      let imageMime = "image/jpeg";
      if (photos[0]) {
        const prepared = await fileToBase64ForAi(photos[0].file);
        imageBase64 = prepared.base64;
        imageMime = prepared.mime;
      }
      const res = await fetch("/api/ai/hasm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          imageMime,
          details: details.trim(),
          location: location.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI analysis failed.");
      setReport(data.report as HasmReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function uploadToDrive(
    photo: Photo,
    index: number,
  ): Promise<{ imageUrl: string; link: string }> {
    try {
      const ext = photo.file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
      const stamp = new Date();
      const datePart = [
        stamp.getFullYear(),
        String(stamp.getMonth() + 1).padStart(2, "0"),
        String(stamp.getDate()).padStart(2, "0"),
      ].join("");
      const filename = `HASM-${datePart}-${index + 1}.${ext}`;
      const res = await fetch("/api/drive/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          base64: await fileToBase64(photo.file),
          mime: photo.file.type || "image/jpeg",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Drive upload failed.");
      const link: string = data.publicLink ?? data.webViewLink ?? "";
      return { imageUrl: driveImageUrl(link), link };
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Drive upload failed.");
    }
  }

  async function saveHazard() {
    if (!report) return;
    setError(null);
    setSaving(true);
    try {
      const pictures: string[] = [];
      const driveLinks: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const { imageUrl, link } = await uploadToDrive(photos[i], i);
        pictures.push(imageUrl);
        driveLinks.push(link);
      }
      const { error: err } = await supabase.from("hasm_records").insert({
        title: report.title || "Untitled Hazard",
        description: details.trim() || null,
        location: location.trim() || null,
        status: "unresolved",
        report: formatHasmReport(report),
        ai_json: report,
        pictures: pictures.length ? pictures : null,
        drive_links: driveLinks.length ? driveLinks : null,
      });
      if (err) throw new Error(err.message);
      setPhotos([]);
      setDetails("");
      setLocation("");
      setReport(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save the hazard.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(record: HasmRecord, value: string) {
    const next = value === "resolved" ? "resolved" : "unresolved";
    const prev = records.map((r) => ({ ...r }));
    setRecords((rs) =>
      rs.map((r) =>
        r.id === record.id
          ? { ...r, status: next, resolved_at: next === "resolved" ? new Date().toISOString() : null }
          : r,
      ),
    );
    const { error: err } = await supabase
      .from("hasm_records")
      .update({
        status: next,
        resolved_at: next === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", record.id);
    if (err) {
      setRecords(prev);
      setError(err.message);
    }
  }

  async function makePdf(record: HasmRecord) {
    setPdfBusy(record.id);
    try {
      const { downloadHasmPdf } = await import("@/lib/hasmPdf");
      await downloadHasmPdf(record);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the PDF.");
    } finally {
      setPdfBusy(null);
    }
  }

  async function deleteHazard(record: HasmRecord) {
    const title = record.title || "this hazard";
    if (!window.confirm(`Delete "${title}"?\n\nThis also removes its Drive photos.`)) {
      return;
    }
    setError(null);
    try {
      const ids = driveFileIds([...(record.drive_links ?? []), ...(record.pictures ?? [])]);
      if (ids.length > 0) {
        await fetch("/api/drive/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
      }
      const { error: err } = await supabase
        .from("hasm_records")
        .delete()
        .eq("id", record.id);
      if (err) throw new Error(err.message);
      setRecords((rs) => rs.filter((r) => r.id !== record.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete the hazard.");
    }
  }

  return (
    <div className="min-h-full bg-[#050507] font-sans">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-zinc-50">HASM</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Hazard Analysis &amp; Safety Management — AI hazard reports with corrective
            actions and safety precautions
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
            {error}
          </p>
        )}

        <div className="grid grid-cols-3 gap-3">
          <StatsTile label="Total Hazards" value={summary.total} />
          <StatsTile label="Resolved" value={summary.resolved} />
          <StatsTile label="Unresolved" value={summary.unresolved} />
        </div>

        {/* ---------- REPORT NEW HAZARD ---------- */}
        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
          <h3 className="text-base font-semibold text-zinc-100">
            Report a New Hazard
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Take a photo or upload one, add some details, and let AI build the report.
            Photos are stored in Google Drive with a date sequence.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                Photos / Hazard picture
              </label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={(e) => addFiles(e.target.files)}
                className="block w-full text-sm text-zinc-400 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-200 hover:file:bg-zinc-700"
              />
              {photos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {photos.map((p, i) => (
                    <div key={i} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={`Hazard photo ${i + 1}`}
                        className="h-24 w-24 rounded-lg border border-zinc-800 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
                        aria-label="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                Location / area (optional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Kitchen wash area, Store room, Main lobby"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-500 focus:border-zinc-300"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                Details about the hazard (optional)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="e.g. Water leaking from the AC on the floor near the service desk. People keep walking over it."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-500 focus:border-zinc-300"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={generateReport}
                disabled={analyzing || saving}
                className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
              >
                {analyzing ? "AI is analyzing…" : "Generate Report with AI"}
              </button>
              {report && (
                <button
                  type="button"
                  onClick={saveHazard}
                  disabled={saving || analyzing}
                  className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Hazard"}
                </button>
              )}
              {(report || photos.length > 0 || details || location) && (
                <button
                  type="button"
                  onClick={() => {
                    setReport(null);
                    setPhotos([]);
                    setDetails("");
                    setLocation("");
                    setError(null);
                  }}
                  disabled={saving}
                  className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:border-zinc-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {report && (
              <div className="rounded-xl border border-orange-500/40 bg-orange-500/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-zinc-100">
                    {report.title || "AI Report"}
                  </h4>
                  <span className="rounded border border-orange-500/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-300">
                    AI Draft — review and save
                  </span>
                </div>
                <div className="mt-3 flex flex-col gap-3 text-sm text-zinc-300">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      The Hazard
                    </p>
                    <p className="mt-0.5 text-zinc-200">{report.hazard || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Why It Is a Hazard
                    </p>
                    <p className="mt-0.5 text-zinc-200">{report.why || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Risks
                    </p>
                    <ul className="mt-0.5 list-inside list-disc text-zinc-200">
                      {report.risks.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Corrective Actions
                    </p>
                    <ul className="mt-0.5 list-inside list-disc text-zinc-200">
                      {report.corrective_actions.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Safety Precautions
                    </p>
                    <ul className="mt-0.5 list-inside list-disc text-zinc-200">
                      {report.safety_precautions.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  {report.standards.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Relevant Standards
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {report.standards.map((s, i) => (
                          <span
                            key={i}
                            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ---------- HAZARD LIST ---------- */}
        <section className="mt-8">
          <h3 className="mb-3 text-base font-semibold text-zinc-100">Hazards</h3>
          {dataLoading ? (
            <p className="text-sm text-zinc-500">Loading hazards...</p>
          ) : records.length === 0 ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6 text-sm text-zinc-500">
              No hazards reported yet. Report your first hazard above.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <div
                  key={group.key}
                  className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60"
                >
                  <div className="flex items-center gap-3 bg-zinc-900/60 px-4 py-2.5">
                    <span className="text-sm font-semibold text-zinc-100">
                      {group.label}
                    </span>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
                      {group.records.length} hazard
                      {group.records.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex flex-col divide-y divide-zinc-800/60">
                    {group.records.map((record) => {
                      const rpt = asHasmReport(record.ai_json);
                      const resolved = isResolved(record);
                      return (
                        <div key={record.id} className="p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold text-zinc-100">
                                  {record.title || rpt?.title || "Untitled Hazard"}
                                </h4>
                                <span
                                  className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                                    resolved
                                      ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
                                      : "border-red-500/70 bg-red-500/15 text-red-300"
                                  }`}
                                >
                                  {resolved ? "Resolved" : "Unresolved"}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-500">
                                {dateLabel(record.created_at)} · {timeLabel(record.created_at)}
                                {record.location ? ` · ${record.location}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => makePdf(record)}
                                disabled={pdfBusy === record.id}
                                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white disabled:opacity-50"
                              >
                                {pdfBusy === record.id ? "Generating…" : "Download PDF"}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteHazard(record)}
                                className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs text-red-300 transition-colors hover:border-red-400 hover:text-red-200"
                              >
                                Delete
                              </button>
                              <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                                Status
                                <select
                                  value={resolved ? "resolved" : "unresolved"}
                                  onChange={(e) => toggleStatus(record, e.target.value)}
                                  className={`rounded-md border px-2 py-1 text-xs outline-none ${
                                    resolved
                                      ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
                                      : "border-red-500/70 bg-red-500/15 text-red-300"
                                  }`}
                                >
                                  <option value="unresolved">Unresolved</option>
                                  <option value="resolved">Resolved</option>
                                </select>
                              </label>
                            </div>
                          </div>

                          {record.description && (
                            <p className="mt-2 text-sm text-zinc-300">
                              {record.description}
                            </p>
                          )}

                          {(record.pictures ?? []).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(record.pictures ?? []).map((src, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() =>
                                    setLightbox({
                                      photos: record.pictures ?? [],
                                      links: record.drive_links ?? [],
                                      index: i,
                                    })
                                  }
                                  className="group relative cursor-zoom-in"
                                  aria-label={`View hazard photo ${i + 1}`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={imageProxyUrl(src)}
                                    alt={`Hazard photo ${i + 1}`}
                                    className="h-20 w-20 rounded-lg border border-zinc-800 object-cover transition-transform group-hover:scale-105"
                                  />
                                </button>
                              ))}
                            </div>
                          )}

                          {rpt && (
                            <div className="mt-3 flex flex-col gap-3 text-sm text-zinc-300">
                              {rpt.hazard && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                    The Hazard
                                  </p>
                                  <p className="mt-0.5 text-zinc-200">{rpt.hazard}</p>
                                </div>
                              )}
                              {rpt.why && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Why It Is a Hazard
                                  </p>
                                  <p className="mt-0.5 text-zinc-200">{rpt.why}</p>
                                </div>
                              )}
                              <div className="grid gap-3 sm:grid-cols-3">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Risks
                                  </p>
                                  <ul className="mt-0.5 list-inside list-disc text-[13px] text-zinc-300">
                                    {rpt.risks.map((r, i) => (
                                      <li key={i}>{r}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Corrective Actions
                                  </p>
                                  <ul className="mt-0.5 list-inside list-disc text-[13px] text-zinc-300">
                                    {rpt.corrective_actions.map((r, i) => (
                                      <li key={i}>{r}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Safety Precautions
                                  </p>
                                  <ul className="mt-0.5 list-inside list-disc text-[13px] text-zinc-300">
                                    {rpt.safety_precautions.map((r, i) => (
                                      <li key={i}>{r}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                              {rpt.standards.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Standards:
                                  </span>
                                  {rpt.standards.map((s, i) => (
                                    <span
                                      key={i}
                                      className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300"
                                    >
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Lightbox
        items={(lightbox?.photos ?? []).map((src, i) => ({
          src: imageProxyUrl(src),
          driveLink: lightbox?.links[i],
        }))}
        index={lightbox?.index ?? null}
        onClose={() => setLightbox(null)}
        onNavigate={(i) => setLightbox((p) => (p ? { ...p, index: i } : p))}
      />
    </div>
  );
}
