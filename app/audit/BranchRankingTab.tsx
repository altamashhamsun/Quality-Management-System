"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { isResolved } from "@/lib/incident";
import { downloadBranchRankingPdf } from "@/lib/branchRankingPdf";

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

type SavedRecord = {
  id: string;
  month: number;
  year: number;
  branch_id: string;
  branch_name: string;
  resolved: number;
  total: number;
  pct: number;
  ncrs: number;
  incidents: number;
  qc: number;
  include_qc: boolean;
  created_at: string;
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
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedSavedId, setSelectedSavedId] = useState<string>("live");
  const [pdfBusy, setPdfBusy] = useState(false);

  const years = Array.from({ length: 10 }, (_, i) => now.getFullYear() - i);

  const periodLabel =
    mode === "month"
      ? `${MONTHS[selectedMonth]} ${selectedYear}`
      : String(selectedYear);

  const fetchSavedRecords = useCallback(async () => {
    let query = supabase
      .from("branch_of_month_records")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    if (mode === "year") {
      query = query.eq("year", selectedYear);
    }
    const { data } = await query;
    setSavedRecords((data as SavedRecord[]) ?? []);
  }, [mode, selectedYear]);

  useEffect(() => {
    fetchSavedRecords();
  }, [fetchSavedRecords]);

  useEffect(() => {
    if (selectedSavedId !== "live") return;
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
  }, [mode, selectedMonth, selectedYear, includeQc, selectedSavedId]);

  const bestBranch = branchStats[0] ?? null;

  async function saveMonthRecord() {
    if (!bestBranch) return;
    setSaving(true);
    await supabase.from("branch_of_month_records").upsert(
      {
        month: selectedMonth,
        year: selectedYear,
        branch_id: "00000000-0000-0000-0000-000000000000",
        branch_name: bestBranch.branch,
        resolved: bestBranch.resolved,
        total: bestBranch.total,
        pct: bestBranch.pct,
        ncrs: bestBranch.ncrs,
        incidents: bestBranch.incidents,
        qc: bestBranch.qc,
        include_qc: includeQc,
      },
      { onConflict: "month,year" }
    );
    await fetchSavedRecords();
    setSaving(false);
  }

  async function downloadPdf() {
    const currentList = mode === "year" ? yearBranchAgg : branchStats;
    if (currentList.length === 0) return;
    setPdfBusy(true);
    try {
      const startDate = mode === "month"
        ? new Date(selectedYear, selectedMonth, 1).toISOString()
        : new Date(selectedYear, 0, 1).toISOString();
      const endDate = mode === "month"
        ? new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString()
        : new Date(selectedYear, 11, 31, 23, 59, 59).toISOString();

      const [ncrRes, incRes] = await Promise.all([
        supabase
          .from("ncr_records")
          .select("id, ncr_number, description, status, opening_ncs, closing_ncs, pictures, drive_links, departments(name, branches(name))")
          .gte("created_at", startDate).lte("created_at", endDate),
        supabase
          .from("incidents")
          .select("id, incident_id, title, severity, branch_name, department_name, status, occurred_at, resolved_at, pictures, drive_links")
          .gte("created_at", startDate).lte("created_at", endDate),
      ]);

      const allNcrRows = ncrRes.data ?? [];
      const allIncRows = incRes.data ?? [];

      const branchesRes = await supabase.from("branches").select("id, name");
      const branchNameToId = new Map<string, string>();
      for (const b of branchesRes.data ?? []) branchNameToId.set(b.name, b.id);

      let qcReportsRaw: { id: string; branch_id: string }[] = [];
      let qcSessionsRaw: { id: string; report_id: string; round_number: number; created_at: string; closed_at: string | null; checklist: unknown }[] = [];
      if (includeQc) {
        const [qr, qs] = await Promise.all([
          supabase.from("quality_reports").select("id, branch_id"),
          supabase.from("quality_sessions").select("id, report_id, round_number, created_at, closed_at, checklist").gte("created_at", startDate).lte("created_at", endDate),
        ]);
        qcReportsRaw = (qr.data ?? []) as typeof qcReportsRaw;
        qcSessionsRaw = (qs.data ?? []) as typeof qcSessionsRaw;
      }

      const reportToBranchId = new Map<string, string>();
      for (const r of qcReportsRaw) reportToBranchId.set(r.id, r.branch_id);

      async function fetchPhotos(urls: (string | null)[]): Promise<string[]> {
        const photos: string[] = [];
        for (const url of urls.filter(Boolean).slice(0, 3)) {
          try { const res = await fetch(url!); const blob = await res.blob(); const du = await new Promise<string>((ok, err) => { const reader = new FileReader(); reader.onload = () => ok(reader.result as string); reader.onerror = () => err(reader.error); reader.readAsDataURL(blob); }); photos.push(du); } catch { /* skip */ }
        }
        return photos;
      }

      const branches: import("@/lib/branchRankingPdf").BranchPdfBranch[] = [];

      for (let i = 0; i < currentList.length; i++) {
        const stat = currentList[i];
        const branchNcrs = allNcrRows.filter((r) => {
          const dept = Array.isArray(r.departments) ? r.departments[0] : r.departments;
          const br = dept?.branches as { name: string } | { name: string }[] | null | undefined;
          const bName = Array.isArray(br) ? br[0]?.name : (br as { name: string } | null)?.name;
          return bName === stat.branch;
        });
        const branchInc = allIncRows.filter((r) => r.branch_name === stat.branch);

        const ncrItems = await Promise.all(branchNcrs.map(async (r) => ({
          ncrNumber: r.ncr_number ?? "",
          description: r.description ?? "",
          department: (Array.isArray(r.departments) ? r.departments[0] : r.departments)?.name ?? "",
          resolved: r.status === "Done" || (r.closing_ncs != null && r.closing_ncs > 0),
          photos: await fetchPhotos(r.pictures ?? []),
        })));

        const incItems = await Promise.all(branchInc.map(async (r) => ({
          incidentId: r.incident_id ?? "",
          title: r.title ?? "",
          severity: r.severity ?? "",
          department: r.department_name ?? "",
          occurredAt: r.occurred_at,
          resolved: isResolved(r),
          photos: await fetchPhotos(r.pictures ?? []),
        })));

        let qcSessions: import("@/lib/branchRankingPdf").BranchPdfQcSession[] = [];
        if (includeQc) {
          const branchId = branchNameToId.get(stat.branch) ?? null;
          const reportIds = branchId ? qcReportsRaw.filter((r) => r.branch_id === branchId).map((r) => r.id) : [];
          const sessForBranch = qcSessionsRaw.filter((s) => reportIds.includes(s.report_id));
          qcSessions = sessForBranch.map((s) => ({
            roundNumber: s.round_number,
            createdAt: s.created_at,
            closedAt: s.closed_at,
            checklist: (s.checklist ?? []) as import("@/lib/branchRankingPdf").BranchPdfQcSession["checklist"],
          }));
        }

        branches.push({
          branch: stat.branch,
          rank: i + 1,
          pct: stat.pct,
          resolved: stat.resolved,
          total: stat.total,
          unresolved: stat.unresolved,
          ncrs: ncrItems,
          incidents: incItems,
          qcSessions,
        });
      }

      await downloadBranchRankingPdf({
        mode,
        month: selectedMonth,
        year: selectedYear,
        includeQc,
        branches,
      });
    } finally {
      setPdfBusy(false);
    }
  }

  function loadSavedRecord(record: SavedRecord) {
    setSelectedSavedId(record.id);
    setBranchStats([{
      branch: record.branch_name,
      total: record.total,
      resolved: record.resolved,
      unresolved: record.total - record.resolved,
      pct: record.pct,
      ncrs: record.ncrs,
      incidents: record.incidents,
      qc: record.qc,
    }]);
    setLoading(false);
  }

  const yearBranchAgg = (() => {
    if (mode !== "year") return [];
    const map = new Map<string, { resolved: number; total: number; months: number }>();
    for (const r of savedRecords) {
      const existing = map.get(r.branch_name) ?? { resolved: 0, total: 0, months: 0 };
      existing.resolved += r.resolved;
      existing.total += r.total;
      existing.months += 1;
      map.set(r.branch_name, existing);
    }
    return [...map.entries()]
      .map(([branch, v]) => ({
        branch,
        resolved: v.resolved,
        total: v.total,
        unresolved: v.total - v.resolved,
        pct: v.total === 0 ? 0 : Math.round((v.resolved / v.total) * 100),
        ncrs: 0,
        incidents: 0,
        qc: 0,
        months: v.months,
      }))
      .sort((a, b) => b.pct - a.pct || b.resolved - a.resolved);
  })();

  const yearBest = yearBranchAgg[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            {mode === "month" ? "Branch of the Month" : "Branch of the Year"}
          </h3>
          <p className="text-xs text-zinc-500">
            {mode === "year" ? "Aggregated from saved monthly records" : `${periodLabel} — ranked by issue resolution rate`}
          </p>
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
              onChange={(e) => { setSelectedMonth(Number(e.target.value)); setSelectedSavedId("live"); }}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-700"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          )}
          <select
            value={selectedYear}
            onChange={(e) => { setSelectedYear(Number(e.target.value)); setSelectedSavedId("live"); }}
            className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-700"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {mode === "month" && savedRecords.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">Saved Records:</span>
          <select
            value={selectedSavedId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedSavedId(val);
              if (val === "live") {
                setLoading(true);
              } else {
                const record = savedRecords.find((r) => r.id === val);
                if (record) loadSavedRecord(record);
              }
            }}
            className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-700"
          >
            <option value="live">Live Data (current)</option>
            {savedRecords.map((r) => (
              <option key={r.id} value={r.id}>
                {MONTHS[r.month]} {r.year} — {r.branch_name} ({r.pct}%)
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === "month" && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={downloadPdf}
            disabled={!bestBranch || pdfBusy}
            className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 disabled:opacity-40"
          >
            {pdfBusy ? "Preparing PDF..." : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={saveMonthRecord}
            disabled={!bestBranch || saving}
            className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-950/50 disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save Month Record"}
          </button>
        </div>
      )}

      {mode === "year" && savedRecords.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={downloadPdf}
            disabled={!yearBest || pdfBusy}
            className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 disabled:opacity-40"
          >
            {pdfBusy ? "Preparing PDF..." : "Download PDF"}
          </button>
        </div>
      )}

      {mode === "month" ? (
        loading ? (
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
                    Monthly Champion
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
        )
      ) : (
        <>
          {savedRecords.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-12 text-center text-sm text-zinc-500">
              No saved monthly records for {selectedYear}. Save monthly records first.
            </p>
          ) : (
            <>
              {yearBest && (
                <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                        Yearly Champion
                      </p>
                      <p className="mt-2 text-3xl font-bold text-zinc-50">{yearBest.branch}</p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {yearBest.resolved} of {yearBest.total} issues resolved across {yearBest.months} months
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-bold text-amber-400">{yearBest.pct}%</p>
                      <p className="mt-1 text-xs text-zinc-500">resolution rate</p>
                    </div>
                  </div>
                  <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${yearBest.pct}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {yearBranchAgg.map((b, i) => (
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
                    <div className="mt-3 flex justify-between text-[10px] text-zinc-500">
                      <span className="text-emerald-400">{b.resolved} resolved</span>
                      <span className="text-red-400">{b.total - b.resolved} unresolved</span>
                      <span>{b.months} month{b.months !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Monthly Breakdown — {selectedYear}
                </h4>
                <div className="space-y-2">
                  {savedRecords.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-950 text-[11px] font-bold text-amber-400">
                          {r.month + 1}
                        </span>
                        <span className="text-sm font-semibold text-zinc-100">{MONTHS[r.month]}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-zinc-300">{r.branch_name}</span>
                        <span className="text-lg font-bold text-amber-400">{r.pct}%</span>
                        <span className="text-[10px] text-zinc-500">{r.resolved}/{r.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
