"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import Header from "@/components/Header";
import { isResolved } from "@/lib/incident";

type IncidentRow = {
  id: string;
  status: string | null;
  branch_name: string | null;
  department_name: string | null;
  created_at: string;
  resolved_at: string | null;
};

type NcrWithDept = {
  id: string;
  status: string | null;
  opening_ncs: number | null;
  closing_ncs: number | null;
  departments:
    | { name: string; branches: { name: string } | { name: string }[] | null }
    | { name: string; branches: { name: string } | { name: string }[] | null }[]
    | null;
};

type DeptStat = {
  branch: string;
  dept: string;
  total: number;
  resolved: number;
  unresolved: number;
  minDays: number | null;
  avgDays: number | null;
  pct: number;
};

type BranchStat = {
  branch: string;
  total: number;
  resolved: number;
  unresolved: number;
  pct: number;
};

type DeptNode = {
  name: string;
  branches: { name: string } | { name: string }[] | null;
};

function extractDept(
  dept: NcrWithDept["departments"],
): DeptNode | null {
  if (!dept) return null;
  return Array.isArray(dept) ? (dept[0] ?? null) : dept;
}

function deptBranchName(dept: DeptNode): string {
  const b = dept.branches;
  return b ? (Array.isArray(b) ? (b[0]?.name ?? "—") : b.name) : "—";
}

export default function PerformancesPage() {
  const { loading } = useAuth();
  const [records, setRecords] = useState<NcrWithDept[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const load = useCallback(async () => {
    const [recordsResult, incidentsResult] = await Promise.all([
      supabase
        .from("ncr_records")
        .select("id, status, opening_ncs, closing_ncs, departments(name, branches(name))"),
      supabase
        .from("incidents")
        .select("id, status, branch_name, department_name, created_at, resolved_at"),
    ]);
    setRecords(recordsResult.data ?? []);
    setIncidents(incidentsResult.data ?? []);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    (async () => {
      await load();
    })();
  }, [loading, load]);

  const { deptStats, branchStats } = useMemo(() => {
    const deptMap = new Map<string, DeptStat>();
    const branchMap = new Map<string, BranchStat>();

    for (const record of records) {
      const dept = extractDept(record.departments);
      if (!dept) continue;
      const branch = deptBranchName(dept);
      const deptKey = `${branch}|${dept.name}`;

      const resolved =
        record.status === "Done" ||
        (record.closing_ncs != null && record.closing_ncs > 0);

      let deptStat = deptMap.get(deptKey);
      if (!deptStat) {
        deptStat = {
          branch,
          dept: dept.name,
          total: 0,
          resolved: 0,
          unresolved: 0,
          minDays: null,
          avgDays: null,
          pct: 0,
        };
        deptMap.set(deptKey, deptStat);
      }
      deptStat.total += 1;
      if (resolved) deptStat.resolved += 1;
      else deptStat.unresolved += 1;

      if (
        resolved &&
        record.opening_ncs != null &&
        record.opening_ncs > 0 &&
        record.closing_ncs != null &&
        record.closing_ncs > 0
      ) {
        const days = record.closing_ncs - record.opening_ncs;
        if (days >= 0) {
          deptStat.minDays =
            deptStat.minDays == null ? days : Math.min(deptStat.minDays, days);
          deptStat.avgDays =
            deptStat.avgDays == null
              ? days
              : (deptStat.avgDays + days) / 2;
        }
      }

      let branchStat = branchMap.get(branch);
      if (!branchStat) {
        branchStat = { branch, total: 0, resolved: 0, unresolved: 0, pct: 0 };
        branchMap.set(branch, branchStat);
      }
      branchStat.total += 1;
      if (resolved) branchStat.resolved += 1;
      else branchStat.unresolved += 1;
    }

    for (const rec of incidents) {
      const branch = rec.branch_name ?? "Other";
      const dept = rec.department_name ?? "Unassigned";
      const deptKey = `${branch}|${dept}`;
      const resolved = isResolved(rec);

      let deptStat = deptMap.get(deptKey);
      if (!deptStat) {
        deptStat = {
          branch,
          dept,
          total: 0,
          resolved: 0,
          unresolved: 0,
          minDays: null,
          avgDays: null,
          pct: 0,
        };
        deptMap.set(deptKey, deptStat);
      }
      deptStat.total += 1;
      if (resolved) deptStat.resolved += 1;
      else deptStat.unresolved += 1;

      if (resolved && rec.created_at && rec.resolved_at) {
        const days = Math.round(
          (new Date(rec.resolved_at).getTime() - new Date(rec.created_at).getTime()) /
            86400000,
        );
        if (days >= 0) {
          deptStat.minDays =
            deptStat.minDays == null ? days : Math.min(deptStat.minDays, days);
          deptStat.avgDays =
            deptStat.avgDays == null ? days : (deptStat.avgDays + days) / 2;
        }
      }

      let branchStat = branchMap.get(branch);
      if (!branchStat) {
        branchStat = { branch, total: 0, resolved: 0, unresolved: 0, pct: 0 };
        branchMap.set(branch, branchStat);
      }
      branchStat.total += 1;
      if (resolved) branchStat.resolved += 1;
      else branchStat.unresolved += 1;
    }

    const deptStats = [...deptMap.values()].map((d) => ({
      ...d,
      pct: d.total === 0 ? 0 : Math.round((d.resolved / d.total) * 100),
      avgDays: d.avgDays == null ? null : Math.round(d.avgDays),
    }));
    deptStats.sort((a, b) => b.resolved - a.resolved || a.branch.localeCompare(b.branch));

    const branchStats = [...branchMap.values()].map((b) => ({
      ...b,
      pct: b.total === 0 ? 0 : Math.round((b.resolved / b.total) * 100),
    }));
    branchStats.sort((a, b) => b.pct - a.pct || b.resolved - a.resolved);

    return { deptStats, branchStats };
  }, [records, incidents]);

  const maxDeptResolved = Math.max(1, ...deptStats.map((d) => d.resolved));
  const bestBranch = branchStats[0];

  return (
    <div className="min-h-full bg-[#050507] font-sans">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-zinc-50">Performances</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Department and branch compliance performance
          </p>
        </div>

        {dataLoading ? (
          <p className="text-sm text-zinc-500">Loading performances...</p>
        ) : (
          <div className="flex flex-col gap-8">
            <section>
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Best Compliance Branch
              </h3>
              {!bestBranch ? (
                <p className="text-sm text-zinc-500">No data yet.</p>
              ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-2xl font-bold text-zinc-50">
                        {bestBranch.branch}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {bestBranch.resolved} of {bestBranch.total} issues
                        resolved ({bestBranch.pct}%)
                      </p>
                    </div>
                    <span className="rounded border border-zinc-600 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-300">
                      #1 Ranked
                    </span>
                  </div>
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-zinc-100"
                      style={{ width: `${bestBranch.pct}%` }}
                    />
                  </div>
                </div>
              )}

              {branchStats.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  {branchStats.map((b, i) => (
                    <div
                      key={b.branch}
                      className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-4 py-2.5"
                    >
                      <span className="w-6 text-center text-xs font-semibold text-zinc-500">
                        {i + 1}
                      </span>
                      <span className="w-16 text-sm font-medium text-zinc-200">
                        {b.branch}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-zinc-100"
                          style={{ width: `${b.pct}%` }}
                        />
                      </div>
                      <span className="w-20 text-right text-xs text-zinc-400">
                        {b.resolved}/{b.total} ({b.pct}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Department Ranking — Most Issues Resolved
              </h3>
              <p className="mb-4 text-xs text-zinc-500">
                Bars show issues noticed vs resolved; minimum and average time to
                resolve are in days.
              </p>
              {deptStats.length === 0 ? (
                <p className="text-sm text-zinc-500">No data yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {deptStats.map((d, i) => (
                    <div
                      key={`${d.branch}|${d.dept}`}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-center text-xs font-semibold text-zinc-500">
                            {i + 1}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-zinc-100">
                              {d.dept}
                            </p>
                            <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                              {d.branch}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-4 text-right text-xs">
                          <div>
                            <p className="text-zinc-500">Min Time</p>
                            <p className="font-semibold text-zinc-100">
                              {d.minDays == null
                                ? "—"
                                : `${d.minDays} day${d.minDays === 1 ? "" : "s"}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-zinc-500">Avg Time</p>
                            <p className="font-semibold text-zinc-100">
                              {d.avgDays == null
                                ? "—"
                                : `${d.avgDays} day${d.avgDays === 1 ? "" : "s"}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-zinc-500">Resolved</p>
                            <p className="font-semibold text-zinc-100">
                              {d.resolved}/{d.total}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-zinc-500">
                            Noticed
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className="h-full rounded-full bg-zinc-500"
                              style={{
                                width: `${(d.total / Math.max(1, deptStats[0].total)) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="w-10 shrink-0 text-right text-xs text-zinc-400">
                            {d.total}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-zinc-500">
                            Resolved
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className="h-full rounded-full bg-zinc-100"
                              style={{
                                width: `${(d.resolved / maxDeptResolved) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="w-10 shrink-0 text-right text-xs text-zinc-400">
                            {d.resolved}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
