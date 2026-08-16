"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  asHasmReport,
  dateLabel,
  imageProxyUrl,
  isResolved,
  timeLabel,
  type HasmRecord,
} from "@/lib/hasm";
import { downloadHasmPdf } from "@/lib/hasmPdf";
import Lightbox from "@/components/Lightbox";

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

export default function PublicHasmPage() {
  const [records, setRecords] = useState<HasmRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{
    photos: string[];
    links: string[];
    index: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from("hasm_records")
        .select("*")
        .order("created_at", { ascending: false });
      if (err) setError(err.message);
      setRecords(data ?? []);
      setLoading(false);
    })();
  }, []);

  const groups = useMemo(() => buildGroups(records), [records]);
  const totals = useMemo(
    () => ({
      total: records.length,
      resolved: records.filter((r) => isResolved(r)).length,
      unresolved: records.filter((r) => !isResolved(r)).length,
    }),
    [records],
  );

  async function makePdf(record: HasmRecord) {
    setPdfBusy(record.id);
    try {
      await downloadHasmPdf(record);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the PDF.");
    } finally {
      setPdfBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-zinc-50">Hazard Reports</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Hazard Analysis &amp; Safety Management — AI-generated hazard reports,
          corrective actions and safety precautions
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-zinc-300">
          {totals.total} hazards
        </span>
        <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">
          {totals.resolved} resolved
        </span>
        <span className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-red-300">
          {totals.unresolved} unresolved
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading hazard reports...</p>
      ) : records.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6 text-sm text-zinc-500">
          No hazard reports yet.
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
                  {group.records.length} report{group.records.length === 1 ? "" : "s"}
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
                        <button
                          type="button"
                          onClick={() => makePdf(record)}
                          disabled={pdfBusy === record.id}
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white disabled:opacity-50"
                        >
                          {pdfBusy === record.id ? "Generating…" : "Download PDF"}
                        </button>
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
