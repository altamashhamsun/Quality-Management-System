"use client";

import { useEffect, useMemo, useState } from "react";
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

type BranchStat = {
  branch: string;
  total: number;
  resolved: number;
  unresolved: number;
  pct: number;
};

function extractBranchName(dept: NcrRow["departments"]): string | null {
  if (!dept) return null;
  const d = Array.isArray(dept) ? dept[0] : dept;
  if (!d?.branches) return null;
  const b = d.branches;
  return Array.isArray(b) ? (b[0]?.name ?? null) : b.name;
}

export default function BranchRankingTab({ mode }: { mode: "month" | "year" }) {
  const [loading, setLoading] = useState(true);
  const [branchStats, setBranchStats] = useState<BranchStat[]>([]);
  const [bestBranch, setBestBranch] = useState<BranchStat | null>(null);

  const now = new Date();
  const periodLabel =
    mode === "month"
      ? now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
      : String(now.getFullYear());

  useEffect(() => {
    (async () => {
      const startDate =
        mode === "month"
          ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
          : new Date(now.getFullYear(), 0, 1).toISOString();
      const endDate =
        mode === "month"
          ? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
          : new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();

      const [ncrsResult, incidentsResult] = await Promise.all([
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
      ]);

      const map = new Map<string, BranchStat>();

      for (const r of (ncrsResult.data ?? []) as NcrRow[]) {
        const branch = extractBranchName(r.departments) ?? "Other";
        const resolved =
          r.status === "Done" ||
          (r.closing_ncs != null && r.closing_ncs > 0);
        let stat = map.get(branch);
        if (!stat) {
          stat = { branch, total: 0, resolved: 0, unresolved: 0, pct: 0 };
          map.set(branch, stat);
        }
        stat.total += 1;
        if (resolved) stat.resolved += 1;
        else stat.unresolved += 1;
      }

      for (const r of (incidentsResult.data ?? []) as IncidentRow[]) {
        const branch = r.branch_name ?? "Other";
        const resolved = isResolved(r);
        let stat = map.get(branch);
        if (!stat) {
          stat = { branch, total: 0, resolved: 0, unresolved: 0, pct: 0 };
          map.set(branch, stat);
        }
        stat.total += 1;
        if (resolved) stat.resolved += 1;
        else stat.unresolved += 1;
      }

      const stats = [...map.values()].map((s) => ({
        ...s,
        pct: s.total === 0 ? 0 : Math.round((s.resolved / s.total) * 100),
      }));
      stats.sort((a, b) => b.pct - a.pct || b.resolved - a.resolved);

      setBranchStats(stats);
      setBestBranch(stats[0] ?? null);
      setLoading(false);
    })();
  }, [mode]);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading {mode === "month" ? "monthly" : "yearly"} data...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          {mode === "month" ? "Branch of the Month" : "Branch of the Year"}
        </h3>
        <p className="text-xs text-zinc-500">{periodLabel} &mdash; ranked by issue resolution rate</p>
      </div>

      {!bestBranch ? (
        <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-12 text-center text-sm text-zinc-500">
          No data for this {mode === "month" ? "month" : "year"} yet.
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-bold text-zinc-50">{bestBranch.branch}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {bestBranch.resolved} of {bestBranch.total} issues resolved ({bestBranch.pct}%)
                </p>
              </div>
              <span className="rounded border border-amber-600 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
                {mode === "month" ? "Monthly Champion" : "Yearly Champion"}
              </span>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${bestBranch.pct}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {branchStats.map((b, i) => (
              <div
                key={b.branch}
                className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-4 py-3"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#b45309" : "#27272a",
                    color: i < 3 ? "#000" : "#71717a",
                  }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-100">{b.branch}</span>
                    {i === 0 && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-400">
                        Best
                      </span>
                    )}
                    {i === branchStats.length - 1 && branchStats.length > 1 && (
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-400">
                        Needs Improvement
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-zinc-500">
                    <span>{b.resolved}/{b.total} resolved</span>
                    <span>&middot;</span>
                    <span>{b.pct}%</span>
                    <span>&middot;</span>
                    <span>{b.unresolved} unresolved</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${b.pct}%`,
                        backgroundColor: b.pct >= 80 ? "#16a34a" : b.pct >= 50 ? "#d97706" : "#dc2626",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
