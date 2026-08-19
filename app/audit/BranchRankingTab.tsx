"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isResolved } from "@/lib/incident";

type NcrRow = {
  id: string;
  status: string | null;
  opening_ncs: number | null;
  closing_ncs: number | null;
  created_at: string;
  departments:
    | { name: string; branches: { name: string } | { name: string }[] | null }
    | { name: string; branches: { name: string } | { name: string }[] | null }[]
    | null;
};

type IncidentRow = {
  id: string;
  status: string | null;
  branch_name: string | null;
  created_at: string;
  resolved_at: string | null;
};

type QCReportRow = {
  id: string;
  branch_id: string;
};

type QCSessionRow = {
  id: string;
  report_id: string;
  created_at: string;
  checklist: { item: string; question: string; found_issue: string; answer?: boolean }[] | null;
};

type BranchStat = {
  branch: string;
  total: number;
  resolved: number;
  unresolved: number;
  pct: number;
  ncrs: number;
  incidents: number;
  qc: number;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function extractBranchName(dept: NcrRow["departments"]): string | null {
  if (!dept) return null;
  const d = Array.isArray(dept) ? dept[0] : dept;
  if (!d?.branches) return null;
  const b = d.branches;
  return Array.isArray(b) ? (b[0]?.name ?? null) : b.name;
}

export default function BranchRankingTab({ mode }: { mode: "month" | "year" }) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [branchStats, setBranchStats] = useState<BranchStat[]>([]);
  const [includeQc, setIncludeQc] = useState(true);

  const years = Array.from({ length: 10 }, (_, i) => now.getFullYear() - i);

  const periodLabel =
    mode === "month"
      ? `${MONTHS[selectedMonth]} ${selectedYear}`
      : String(selectedYear);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const startDate =
        mode === "month"
          ? new Date(selectedYear, selectedMonth, 1).toISOString()
          : new Date(selectedYear, 0, 1).toISOString();
      const endDate =
        mode === "month"
          ? new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString()
          : new Date(selectedYear, 11, 31, 23, 59, 59).toISOString();

      const baseQueries = [
        supabase
          .from("ncr_records")
          .select("id, status, opening_ncs, closing_ncs, created_at, departments(name, branches(name))")
          .gte("created_at", startDate)
          .lte("created_at", endDate),
        supabase
          .from("incidents")
          .select("id, status, branch_name, created_at, resolved_at")
          .gte("created_at", startDate)
          .lte("created_at", endDate),
      ];

      const qcQueries = includeQc ? [
        supabase.from("quality_reports").select("id, branch_id"),
        supabase
          .from("quality_sessions")
          .select("id, report_id, checklist, created_at")
          .gte("created_at", startDate)
          .lte("created_at", endDate),
        supabase.from("branches").select("id, name"),
      ] : [];

      const results = await Promise.all([...baseQueries, ...qcQueries]);
      const ncrsResult = results[0] as { data: NcrRow[] | null };
      const incidentsResult = results[1] as { data: IncidentRow[] | null };

      const map = new Map<string, BranchStat>();

      function getStat(branch: string): BranchStat {
        let stat = map.get(branch);
        if (!stat) {
          stat = { branch, total: 0, resolved: 0, unresolved: 0, pct: 0, ncrs: 0, incidents: 0, qc: 0 };
          map.set(branch, stat);
        }
        return stat;
      }

      for (const r of (ncrsResult.data ?? [])) {
        const branch = extractBranchName(r.departments) ?? "Other";
        const resolved =
          r.status === "Done" ||
          (r.closing_ncs != null && r.closing_ncs > 0);
        const stat = getStat(branch);
        stat.total += 1;
        stat.ncrs += 1;
        if (resolved) stat.resolved += 1;
        else stat.unresolved += 1;
      }

      for (const r of (incidentsResult.data ?? [])) {
        const branch = r.branch_name ?? "Other";
        const resolved = isResolved(r);
        const stat = getStat(branch);
        stat.total += 1;
        stat.incidents += 1;
        if (resolved) stat.resolved += 1;
        else stat.unresolved += 1;
      }

      if (includeQc && results.length >= 5) {
        const qcReportsResult = results[2] as { data: QCReportRow[] | null };
        const qcSessionsResult = results[3] as { data: QCSessionRow[] | null };
        const branchesResult = results[4] as { data: { id: string; name: string }[] | null };

        const branchIdToName = new Map<string, string>();
        for (const b of branchesResult?.data ?? []) branchIdToName.set(b.id, b.name);
        const reportToBranch = new Map<string, string>();
        for (const r of qcReportsResult?.data ?? []) reportToBranch.set(r.id, r.branch_id);

        for (const s of qcSessionsResult?.data ?? []) {
          const branchId = reportToBranch.get(s.report_id);
          if (!branchId) continue;
          const branch = branchIdToName.get(branchId) ?? "Unknown QC";
          for (const item of s.checklist ?? []) {
            if (!item.found_issue) continue;
            const resolved = item.answer === true;
            const stat = getStat(branch);
            stat.total += 1;
            stat.qc += 1;
            if (resolved) stat.resolved += 1;
            else stat.unresolved += 1;
          }
        }
      }

      const stats = [...map.values()].map((s) => ({
        ...s,
        pct: s.total === 0 ? 0 : Math.round((s.resolved / s.total) * 100),
      }));
      stats.sort((a, b) => b.pct - a.pct || b.resolved - a.resolved);

      setBranchStats(stats);
      setLoading(false);
    })();
  }, [mode, selectedMonth, selectedYear, includeQc]);

  const bestBranch = branchStats[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            {mode === "month" ? "Branch of the Month" : "Branch of the Year"}
          </h3>
          <p className="text-xs text-zinc-500">{periodLabel} &mdash; ranked by issue resolution rate</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIncludeQc((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            <span className="relative inline-flex h-4 w-7 shrink-0 items-center rounded-full bg-zinc-800 transition-colors">
              <span
                className={`inline-block h-3 w-3 rounded-full bg-zinc-400 transition-transform ${
                  includeQc ? "translate-x-3.5 bg-amber-400" : "translate-x-0.5"
                }`}
              />
            </span>
            <span>QC Issues</span>
          </button>
          {mode === "month" && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-700"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          )}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-700"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : !bestBranch ? (
        <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-12 text-center text-sm text-zinc-500">
          No data for {periodLabel} yet.
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                  {mode === "month" ? "Monthly Champion" : "Yearly Champion"}
                </p>
                <p className="mt-2 text-3xl font-bold text-zinc-50">{bestBranch.branch}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  {bestBranch.resolved} of {bestBranch.total} issues resolved
                </p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-amber-400">{bestBranch.pct}%</p>
                <p className="mt-1 text-xs text-zinc-500">resolution rate</p>
              </div>
            </div>
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${bestBranch.pct}%` }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {branchStats.map((b, i) => (
              <div
                key={b.branch}
                className={`rounded-xl border p-4 transition-all ${
                  i === 0
                    ? "border-amber-700/50 bg-amber-950/20"
                    : "border-zinc-800 bg-zinc-950/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{
                        backgroundColor: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#b45309" : "#27272a",
                        color: i < 3 ? "#000" : "#71717a",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-zinc-100">{b.branch}</span>
                  </div>
                  <span className="text-2xl font-bold text-zinc-50">{b.pct}%</span>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${b.pct}%`,
                      backgroundColor: b.pct >= 80 ? "#16a34a" : b.pct >= 50 ? "#d97706" : "#dc2626",
                    }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-semibold text-zinc-100">{b.ncrs}</p>
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">NCRs</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-zinc-100">{b.incidents}</p>
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">Incidents</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-zinc-100">{b.qc}</p>
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">QC</p>
                  </div>
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-zinc-500">
                  <span className="text-emerald-400">{b.resolved} resolved</span>
                  <span className="text-red-400">{b.unresolved} unresolved</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
