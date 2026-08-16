"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatExcelDate } from "@/lib/ncr";
import { isResolved } from "@/lib/timeline";
import type { NcrRecord } from "@/lib/ncr";

type Branch = { id: string; name: string };
type Department = { id: string; name: string; branch_id: string };

type Row = NcrRecord & { department_name: string | null };

function ncrNum(ncr: string | null): number {
  const m = (ncr ?? "").match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

type Group = {
  key: string;
  label: string;
  serial: number;
  records: Row[];
  resolved: number;
  unresolved: number;
};

function buildGroups(records: Row[]): Group[] {
  const map = new Map<string, Group>();
  const noDate: Row[] = [];
  for (const r of records) {
    if (r.opening_ncs == null) {
      noDate.push(r);
      continue;
    }
    const label = formatExcelDate(r.opening_ncs);
    const existing = map.get(label);
    if (existing) {
      existing.records.push(r);
    } else {
      map.set(label, {
        key: label,
        label,
        serial: r.opening_ncs,
        records: [r],
        resolved: 0,
        unresolved: 0,
      });
    }
  }
  const groups: Group[] = [...map.values()].sort((a, b) => a.serial - b.serial);
  for (const g of groups) {
    g.records.sort((a, b) => ncrNum(a.ncr_number) - ncrNum(b.ncr_number));
    g.resolved = g.records.filter((r) => isResolved(r.status, r.closing_ncs)).length;
    g.unresolved = g.records.length - g.resolved;
  }
  if (noDate.length > 0) {
    groups.push({
      key: "No Date",
      label: "No Date",
      serial: 0,
      records: noDate,
      resolved: noDate.filter((r) => isResolved(r.status, r.closing_ncs)).length,
      unresolved: noDate.filter((r) => !isResolved(r.status, r.closing_ncs)).length,
    });
  }
  return groups;
}

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

function statusSpan(status: string | null) {
  if (isResolved(status, null)) {
    return <span className="text-[11px] font-medium text-emerald-400">Resolved</span>;
  }
  return <span className="text-[11px] font-medium text-red-400">Pending</span>;
}

export default function PublicNcrsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [records, setRecords] = useState<Row[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [branchesResult, deptsResult, recordsResult] = await Promise.all([
        supabase.from("branches").select("id, name").order("name"),
        supabase.from("departments").select("id, name, branch_id").order("name"),
        supabase.from("ncr_records").select("*, departments(name)"),
      ]);
      if (!branchesResult.error) setBranches(branchesResult.data ?? []);
      if (!deptsResult.error) setDepartments(deptsResult.data ?? []);
      if (!recordsResult.error) {
        setRecords(
          (recordsResult.data ?? []).map((r) => {
            const dept = r.departments;
            const name = dept
              ? Array.isArray(dept)
                ? (dept[0]?.name ?? null)
                : (dept.name ?? null)
              : null;
            return { ...r, departments: undefined, department_name: name } as unknown as Row;
          }),
        );
      }
      setLoading(false);
    })();
  }, []);

  const deptBranch = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) map.set(d.id, d.branch_id);
    return map;
  }, [departments]);

  const scoped = useMemo(() => {
    if (!selectedBranchId) return records;
    return records.filter(
      (r) => r.department_id && deptBranch.get(r.department_id) === selectedBranchId,
    );
  }, [records, selectedBranchId, deptBranch]);

  const groups = useMemo(() => buildGroups(scoped), [scoped]);
  const totals = useMemo(
    () => ({
      resolved: scoped.filter((r) => isResolved(r.status, r.closing_ncs)).length,
      unresolved: scoped.filter((r) => !isResolved(r.status, r.closing_ncs)).length,
    }),
    [scoped],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-50">NCRs</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Non-conformity records raised per branch
          </p>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
          Branch
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-zinc-300"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-zinc-300">
          {scoped.length} NCRs
        </span>
        <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">
          +{totals.resolved} resolved
        </span>
        <span className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-red-300">
          -{totals.unresolved} pending
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading NCRs...</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-zinc-500">No NCRs recorded yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div
              key={group.key}
              className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60"
            >
              <div className="flex flex-wrap items-center gap-3 bg-zinc-900/60 px-4 py-3">
                <span className="text-sm font-semibold text-zinc-100">
                  {group.label}
                </span>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
                  {group.records.length} NCR{group.records.length === 1 ? "" : "s"}
                </span>
                <span className="text-[11px] font-semibold text-emerald-400">
                  +{group.resolved}
                </span>
                <span className="text-[11px] font-semibold text-red-400">
                  -{group.unresolved}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/40">
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        NCR #
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Department
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Description
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Clause
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Closing
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Priority
                      </th>
                      <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.records.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-zinc-800/60 last:border-0"
                      >
                        <td className="px-2 py-2 font-mono text-zinc-200">
                          {r.ncr_number ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-zinc-400">
                          {r.department_name ?? "—"}
                        </td>
                        <td className="min-w-[16rem] px-2 py-2 text-zinc-200">
                          {r.description ?? "—"}
                        </td>
                        <td className="max-w-[10rem] px-2 py-2 text-zinc-400">
                          {r.clause ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-zinc-400">
                          {formatExcelDate(r.closing_ncs) || "—"}
                        </td>
                        <td className="px-2 py-2">{priorityBadge(r.priority)}</td>
                        <td className="px-2 py-2">{statusSpan(r.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
