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
      const { data: sessions } = await supabase
        .from("quality_sessions")
        .select("*")
        .eq("report_id", report.id)
        .order("round_number");
      const rounds: QualityReportPdfData["rounds"] = [];
      for (const session of (sessions ?? []) as QCSession[]) {
        if (session.round_number === 1) {
          const { data } = await supabase
            .from("quality_descriptions")
            .select("item_name, content")
            .eq("session_id", session.id);
          const descs: Record<string, string> = {};
          for (const d of (data ?? []) as DescRow[]) descs[d.item_name] = d.content;
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
          day: "2-digit",
          month: "short",
          year: "numeric",
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
        <h2 className="text-xl font-semibold text-txt">Quality Control</h2>
        <p className="mt-1 text-sm text-txt-s">
          Quality inspection reports, checklists and audit findings
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-bdr bg-card-h px-4 py-3 text-sm text-txt-s">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-lg border border-bdr bg-card px-3 py-1.5 text-txt-s">
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
        <p className="text-sm text-txt-s">Loading reports...</p>
      ) : reports.length === 0 ? (
        <p className="rounded-xl border border-bdr bg-card p-6 text-sm text-txt-s">
          No quality reports yet.
        </p>
      ) : selectedReport ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <button
                onClick={() => { setSelectedReport(null); setSessions([]); }}
                className="mb-2 text-sm text-txt-s hover:text-txt"
              >
                &larr; All Reports
              </button>
              <h3 className="text-lg font-semibold text-txt">{selectedReport.title}</h3>
              <p className="text-xs text-txt-s">
                {branchName(selectedReport.branch_id)} &middot;{" "}
                {new Date(selectedReport.created_at).toLocaleDateString("en-GB", {
                  day: "2-digit", month: "short", year: "numeric",
                })}
              </p>
            </div>
            <button
              onClick={() => downloadPdf(selectedReport)}
              disabled={pdfBusy}
              className="rounded-lg border border-bdr-h px-3 py-1.5 text-xs text-txt-s transition-colors hover:text-txt disabled:opacity-50"
            >
              {pdfBusy ? "Generating\u2026" : "Download PDF"}
            </button>
          </div>

          {sessions.length === 0 ? (
            <p className="rounded-xl border border-bdr bg-card p-6 text-sm text-txt-s">
              No rounds completed yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map((s) => {
                const resolved = (s.checklist ?? []).filter((i) => i.answer === true).length;
                const unresolved = (s.checklist ?? []).filter((i) => i.answer === false).length;
                return (
                  <div key={s.id} className="rounded-xl border border-bdr bg-card p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-txt">
                          Round {s.round_number}
                        </h4>
                        <p className="text-xs text-txt-s">
                          {s.round_number === 1
                            ? "Descriptions"
                            : `${resolved} resolved \u00b7 ${unresolved} unresolved`}
                        </p>
                      </div>
                      <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        s.status === "active"
                          ? "bg-emerald-950 text-emerald-400"
                          : "bg-card-h text-txt-s"
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    {s.round_number > 1 && (s.checklist ?? []).length > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
                        {(s.checklist ?? []).map((item) => (
                          <div key={item.id} className="rounded-lg border border-bdr bg-card-h p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-txt">{item.item}</p>
                                <p className="text-[11px] text-txt-s">{item.question}</p>
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
        <div className="flex flex-col gap-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-xl border border-bdr bg-card p-4 transition-all duration-300 hover:border-bdr-h"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-txt">{report.title}</h4>
                    <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                      report.status === "active"
                        ? "bg-emerald-950 text-emerald-400"
                        : "bg-card-h text-txt-s"
                    }`}>
                      {report.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-txt-s">
                    {branchName(report.branch_id)} &middot;{" "}
                    {new Date(report.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadPdf(report)}
                    disabled={pdfBusy}
                    className="rounded-lg border border-bdr-h px-2.5 py-1.5 text-xs text-txt-s transition-colors hover:text-txt disabled:opacity-50"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => setSelectedReport(report)}
                    className="rounded-lg border border-bdr-h px-2.5 py-1.5 text-xs text-txt-s transition-colors hover:text-txt"
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
