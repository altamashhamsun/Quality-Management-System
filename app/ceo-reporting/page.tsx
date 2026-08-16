"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import Header from "@/components/Header";
import StatsTile from "@/components/StatsTile";
import {
  PRIORITY_DAYS,
  daysOverdue,
  dueSerial,
  isResolved,
} from "@/lib/timeline";
import { formatExcelDate } from "@/lib/ncr";

type NcrWithDept = {
  id: string;
  ncr_number: string | null;
  description: string | null;
  branch: string | null;
  clause: string | null;
  guideline: string | null;
  opening_ncs: number | null;
  closing_ncs: number | null;
  status: string | null;
  priority: string | null;
  reported_to_ceo: boolean | null;
  corrective_action: string | null;
  preventive_action: string | null;
  departments:
    | { name: string; branches: { name: string } | { name: string }[] | null }
    | { name: string; branches: { name: string } | { name: string }[] | null }[]
    | null;
};

type DeptNode = { name: string; branches: { name: string } | { name: string }[] | null };

function extractDept(dept: NcrWithDept["departments"]): DeptNode | null {
  if (!dept) return null;
  return Array.isArray(dept) ? (dept[0] ?? null) : dept;
}

function deptBranchName(dept: DeptNode): string {
  const b = dept.branches;
  return b ? (Array.isArray(b) ? (b[0]?.name ?? "—") : b.name) : "—";
}

const PRIORITY_ORDER: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

function priorityBadge(priority: string | null) {
  const style =
    priority === "Urgent"
      ? "border-red-500/70 bg-red-500/15 text-red-300"
      : priority === "High"
        ? "border-orange-500/70 bg-orange-500/15 text-orange-300"
        : priority === "Medium"
          ? "border-yellow-500/70 bg-yellow-500/15 text-yellow-300"
          : priority === "Low"
            ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
            : "border-zinc-700 bg-zinc-900 text-zinc-400";
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-medium ${style}`}>
      {priority ?? "—"}
    </span>
  );
}

export default function CeoReportingPage() {
  const { loading } = useAuth();
  const [records, setRecords] = useState<NcrWithDept[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("ncr_records")
      .select("id, ncr_number, description, branch, clause, guideline, opening_ncs, closing_ncs, status, priority, reported_to_ceo, corrective_action, preventive_action, departments(name, branches(name))")
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

  const overdue = useMemo(() => {
    const list = records
      .filter((r) => {
        if (r.opening_ncs == null) return false;
        if (!r.priority || !PRIORITY_DAYS[r.priority]) return false;
        if (isResolved(r.status, r.closing_ncs)) return false;
        return daysOverdue(r.opening_ncs, r.priority) > 0;
      })
      .map((r) => {
        const dept = extractDept(r.departments);
        return {
          id: r.id,
          ncrNumber: r.ncr_number ?? "NCR",
          branch: r.branch ?? (dept ? deptBranchName(dept) : "—"),
          department: dept?.name ?? "—",
          description: r.description ?? "—",
          clause: r.clause ?? "—",
          guideline: r.guideline ?? "",
          opening: r.opening_ncs,
          due: dueSerial(r.opening_ncs, r.priority),
          overdueDays: daysOverdue(r.opening_ncs, r.priority),
          status: r.status ?? "—",
          priority: r.priority ?? "—",
          reportedToCeo: r.reported_to_ceo ?? false,
          correctiveAction: r.corrective_action ?? "",
          preventiveAction: r.preventive_action ?? "",
        };
      });
    list.sort(
      (a, b) =>
        b.overdueDays - a.overdueDays ||
        (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0),
    );
    return list;
  }, [records]);

  const summary = useMemo(
    () => ({
      urgent: overdue.filter((r) => r.priority === "Urgent").length,
      high: overdue.filter((r) => r.priority === "High").length,
      medium: overdue.filter((r) => r.priority === "Medium").length,
      low: overdue.filter((r) => r.priority === "Low").length,
      notReported: overdue.filter((r) => !r.reportedToCeo).length,
    }),
    [overdue],
  );

  async function markReported(id: string, value: boolean) {
    const prev = records.map((r) => ({ ...r }));
    setRecords((rs) => rs.map((r) => (r.id === id ? { ...r, reported_to_ceo: value } : r)));
    const { error: err } = await supabase
      .from("ncr_records")
      .update({ reported_to_ceo: value })
      .eq("id", id);
    if (err) {
      setRecords(prev);
      setError(err.message);
    }
  }

  return (
    <div className="min-h-full bg-[#050507] font-sans">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-zinc-50">CEO Reporting</h2>
          <p className="mt-1 text-sm text-zinc-500">
            NCRs that have exceeded their fix timeline and need CEO attention
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
            {error}
          </p>
        )}

        {dataLoading ? (
          <p className="text-sm text-zinc-500">Loading NCRs...</p>
        ) : overdue.length === 0 ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-8 text-center">
            <p className="text-sm font-medium text-emerald-200">
              No NCRs have exceeded their timeline.
            </p>
            <p className="mt-1 text-xs text-emerald-300/70">
              Nothing to escalate to the CEO right now.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatsTile label="Overdue NCRs" value={overdue.length} />
              <StatsTile label="Urgent" value={summary.urgent} />
              <StatsTile label="High" value={summary.high} />
              <StatsTile label="Medium" value={summary.medium} />
              <StatsTile label="Low" value={summary.low} />
              <StatsTile label="Not Reported to CEO" value={summary.notReported} />
            </div>

            <div className="mb-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
              <span>
                Timeline: Urgent {PRIORITY_DAYS.Urgent}d · High {PRIORITY_DAYS.High}d ·
                Medium {PRIORITY_DAYS.Medium}d · Low {PRIORITY_DAYS.Low}d
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <colgroup>
                    <col className="w-24" />
                    <col className="w-28" />
                    <col className="w-24" />
                    <col className="min-w-[16rem]" />
                    <col className="w-24" />
                    <col className="w-28" />
                    <col className="w-28" />
                    <col className="w-24" />
                    <col className="w-28" />
                    <col className="w-28" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/40">
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        NCR #
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Branch
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Dept
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Description
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Priority
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Opened
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Due
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Overdue
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Status
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Reported to CEO
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-800/60 align-top last:border-0">
                        <td className="px-2 py-2 font-mono text-zinc-200">{r.ncrNumber}</td>
                        <td className="px-2 py-2 text-zinc-400">{r.branch}</td>
                        <td className="px-2 py-2 text-zinc-400">{r.department}</td>
                        <td className="px-2 py-2 text-zinc-200">
                          {r.description}
                          {r.guideline && (
                            <span className="mt-0.5 block text-[10px] text-zinc-500">
                              {r.guideline}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2">{priorityBadge(r.priority)}</td>
                        <td className="px-2 py-2 text-zinc-400">
                          {formatExcelDate(r.opening)}
                        </td>
                        <td className="px-2 py-2 text-zinc-400">
                          {formatExcelDate(r.due)}
                        </td>
                        <td className="px-2 py-2 font-semibold text-red-400">
                          {r.overdueDays}d
                        </td>
                        <td className="px-2 py-2 text-zinc-400">{r.status}</td>
                        <td className="px-2 py-2">
                          <select
                            value={r.reportedToCeo ? "Yes" : "No"}
                            onChange={(e) => markReported(r.id, e.target.value === "Yes")}
                            className={`rounded-md border px-2 py-1 text-xs outline-none ${
                              r.reportedToCeo
                                ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
                                : "border-zinc-700 bg-zinc-900 text-zinc-400"
                            }`}
                          >
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
