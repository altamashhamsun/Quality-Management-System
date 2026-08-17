"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { downloadQualityReportPdf, type QualityReportPdfData } from "@/lib/qualityReportPdf";

type Branch = { id: string; name: string };
type QCReport = {
  id: string;
  branch_id: string;
  title: string;
  status: string;
  items: Record<string, string[]>;
  created_at: string;
  closed_at: string | null;
};
type QCSession = {
  id: string;
  report_id: string;
  round_number: number;
  status: string;
  checklist: Array<{
    id: string;
    item: string;
    question: string;
    found_issue: string;
    answer?: boolean;
  }> | null;
  created_at: string;
};
type DescRow = {
  item_name: string;
  content: string;
  updated_at: string;
};

export default function PublicQualityControlPage() {
  const [reports, setReports] = useState<QCReport[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<QCReport | null>(null);
  const [sessions, setSessions] = useState<QCSession[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: r }] = await Promise.all([
        supabase.from("branches").select("id, name").order("name"),
        supabase
          .from("quality_reports")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      setBranches(b ?? []);
      setReports((r ?? []) as unknown as QCReport[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedReport) return;
    (async () => {
      const { data } = await supabase
        .from("quality_sessions")
        .select("*")
        .eq("report_id", selectedReport.id)
        .order("round_number");
      setSessions((data as QCSession[]) ?? []);
    })();
  }, [selectedReport?.id]);

  const branchName = (id: string) =>
    branches.find((b) => b.id === id)?.name ?? "\u2014";

  const totals = {
    total: reports.length,
    active: reports.filter((r) => r.status === "active").length,
    closed: reports.filter((r) => r.status === "closed").length,
  };

  async function downloadPdf(report: QCReport) {
    setPdfBusy(true);
    try {
      const { data: sessData } = await supabase
        .from("quality_sessions")
        .select("*")
        .eq("report_id", report.id)
        .order("round_number");
      const rounds: QualityReportPdfData["rounds"] = [];
      for (const session of (sessData ?? []) as QCSession[]) {
        if (session.round_number === 1) {
          const { data } = await supabase
            .from("quality_descriptions")
            .select("item_name, content, updated_at")
            .eq("session_id", session.id);
          const descs: Record<string, { text: string; writtenAt: string }> = {};
          for (const d of (data ?? []) as DescRow[]) descs[d.item_name] = {
            text: d.content,
            writtenAt: new Date(d.updated_at).toLocaleString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
          rounds.push({ roundNumber: 1, descriptions: descs });
        } else {
          rounds.push({
            roundNumber: session.round_number,
            descriptions: {},
            checklist: session.checklist ?? [],
          });
        }
      }
      const { data: settings } = await supabase
        .from("settings")
        .select("owner_name")
        .eq("id", 1)
        .maybeSingle();
      downloadQualityReportPdf({
        title: report.title,
        branchName: branchName(report.branch_id),
        date: new Date(report.created_at).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", year: "numeric",
        }),
        auditor: settings?.owner_name || undefined,
        rounds,
      });
    } catch {
      setError("Could not generate PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-zinc-50">Quality Control</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Quality inspection reports, checklists and audit findings
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-zinc-300">
          {totals.total} reports
        </span>
        <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">
          {totals.active} active
        </span>
        <span className="rounded-lg border border-zinc-500/40 bg-zinc-500/10 px-3 py-1.5 text-zinc-300">
          {totals.closed} closed
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading reports...</p>
      ) : reports.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6 text-sm text-zinc-500">
          No quality reports yet.
        </p>
      ) : selectedReport ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <button
                onClick={() => { setSelectedReport(null); setSessions([]); }}
                className="mb-2 text-sm text-zinc-500 hover:text-zinc-300"
              >
                &larr; All Reports
              </button>
              <h3 className="text-lg font-semibold text-zinc-50">{selectedReport.title}</h3>
              <p className="text-xs text-zinc-500">
                {branchName(selectedReport.branch_id)} &middot;{" "}
                {new Date(selectedReport.created_at).toLocaleDateString("en-GB", {
                  day: "2-digit", month: "short", year: "numeric",
                })}
              </p>
            </div>
            <button
              onClick={() => downloadPdf(selectedReport)}
              disabled={pdfBusy}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white disabled:opacity-50"
            >
              {pdfBusy ? "Generating\u2026" : "Download PDF"}
            </button>
          </div>

          {sessions.length === 0 ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6 text-sm text-zinc-500">
              No rounds completed yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map((s) => {
                const resolved = (s.checklist ?? []).filter((i) => i.answer === true).length;
                const unresolved = (s.checklist ?? []).filter((i) => i.answer === false).length;
                return (
                  <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-50">
                          Round {s.round_number}
                        </h4>
                        <p className="text-xs text-zinc-500">
                          {s.round_number === 1
                            ? "Descriptions"
                            : `${resolved} resolved \u00b7 ${unresolved} unresolved`}
                        </p>
                      </div>
                      <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        s.status === "active"
                          ? "bg-emerald-950 text-emerald-400"
                          : "bg-zinc-800 text-zinc-500"
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    {s.round_number > 1 && (s.checklist ?? []).length > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
                        {(s.checklist ?? []).map((item) => (
                          <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-zinc-200">{item.item}</p>
                                <p className="text-[11px] text-zinc-500">{item.question}</p>
                              </div>
                              {item.answer !== undefined && (
                                <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-medium ${
                                  item.answer
                                    ? "bg-emerald-950 text-emerald-400"
                                    : "bg-red-950 text-red-400"
                                }`}>
                                  {item.answer ? "Resolved" : "Unresolved"}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {(() => {
            const grouped = new Map<string, QCReport[]>();
            for (const r of reports) {
              const list = grouped.get(r.branch_id) ?? [];
              list.push(r);
              grouped.set(r.branch_id, list);
            }
            return [...grouped.keys()]
              .sort((a, b) => branchName(a).localeCompare(branchName(b)))
              .map((branchId) => {
                const branchReports = (grouped.get(branchId) ?? []).sort(
                  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                );
                return (
                  <div key={branchId}>
                    <h3 className="mb-3 text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                      {branchName(branchId)}
                      <span className="ml-2 text-zinc-600 normal-case tracking-normal">
                        ({branchReports.length})
                      </span>
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {branchReports.map((report) => (
                        <div
                          key={report.id}
                          className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 transition-all duration-300 hover:border-zinc-700"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold text-zinc-50">{report.title}</h4>
                                <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                                  report.status === "active"
                                    ? "bg-emerald-950 text-emerald-400"
                                    : "bg-zinc-800 text-zinc-500"
                                }`}>
                                  {report.status}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-zinc-500">
                                {new Date(report.created_at).toLocaleDateString("en-GB", {
                                  day: "2-digit", month: "short", year: "numeric",
                                })}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => downloadPdf(report)}
                                disabled={pdfBusy}
                                className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white disabled:opacity-50"
                              >
                                PDF
                              </button>
                              <button
                                onClick={() => setSelectedReport(report)}
                                className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
                              >
                                View
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
          })()}
        </div>
      )}
    </div>
  );
}
