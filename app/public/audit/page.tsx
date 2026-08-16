"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  downloadAuditReportPdf,
  type AuditReportPdfData,
  type ReportIncident,
  type ReportNc,
} from "@/lib/auditReportPdf";
import type { NcrRecord } from "@/lib/ncr";
import { isResolved, severityLabel, type IncidentRecord } from "@/lib/incident";

type DocRow = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  content: Record<string, string> | null;
  start_date: string | null;
  end_date: string | null;
  department_ids: string[];
  plan_id: string | null;
};

type Department = {
  id: string;
  name: string;
  branches: { name: string } | { name: string }[] | null;
};

const EXCEL_EPOCH_OFFSET = 25569;

function excelSerialToDate(serial: number): Date {
  return new Date(Math.round((serial - EXCEL_EPOCH_OFFSET) * 86400000));
}

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  return `${new Date(start + "T00:00:00").toLocaleDateString(undefined, opts)} — ${new Date(end + "T00:00:00").toLocaleDateString(undefined, opts)}`;
}

function formatExcelDate(serial: number | null): string {
  if (serial == null) return "—";
  return excelSerialToDate(serial).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PublicAuditPage() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [records, setRecords] = useState<NcrRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [docsResult, deptsResult, recordsResult, incidentsResult] = await Promise.all([
        supabase.from("audit_documents").select("*"),
        supabase.from("departments").select("id, name, branches(name)"),
        supabase.from("ncr_records").select("*"),
        supabase.from("incidents").select("*"),
      ]);
      if (!docsResult.error) setDocs((docsResult.data ?? []) as DocRow[]);
      if (!deptsResult.error) setDepartments(deptsResult.data ?? []);
      if (!recordsResult.error) setRecords(recordsResult.data ?? []);
      if (!incidentsResult.error) setIncidents(incidentsResult.data ?? []);
      setLoading(false);
    })();
  }, []);

  const reports = useMemo(() => docs.filter((d) => d.category === "report"), [docs]);
  const capas = useMemo(() => docs.filter((d) => d.category === "capa"), [docs]);

  const deptMeta = useMemo(() => {
    const map = new Map<string, { name: string; branch: string }>();
    for (const dept of departments) {
      const branch = Array.isArray(dept.branches)
        ? (dept.branches[0]?.name ?? "Other")
        : (dept.branches?.name ?? "Other");
      map.set(dept.id, { name: dept.name, branch });
    }
    return map;
  }, [departments]);

  const ncRows = useMemo(
    () =>
      records
        .filter((r) => (r.corrective_action ?? "").trim() !== "" || (r.preventive_action ?? "").trim() !== "")
        .map((r) => ({
          ncrNumber: r.ncr_number ?? "NCR",
          branch: r.branch ?? "—",
          departmentName: r.department_id ? (deptMeta.get(r.department_id)?.name ?? "—") : "—",
          priority: r.priority ?? "—",
          status: r.status ?? "—",
          correctiveAction: r.corrective_action ?? "",
          preventiveAction: r.preventive_action ?? "",
          rootCause: r.root_cause ?? "",
        }))
        .sort((a, b) => a.ncrNumber.localeCompare(b.ncrNumber)),
    [records, deptMeta],
  );

  const scopeIncidents = useCallback(
    (report: DocRow): IncidentRecord[] => {
      if (!report.start_date || !report.end_date) return [];
      const narrative = report.content ?? {};
      const auditDate = narrative.audit_date ?? "";
      const branchFilter = new Set<string>();
      for (const id of report.department_ids) {
        const meta = deptMeta.get(id);
        if (meta) branchFilter.add(meta.branch);
      }
      return incidents.filter((r) => {
        if (!r.occurred_at || isResolved(r)) return false;
        const key = dateKey(new Date(r.occurred_at));
        if (auditDate) {
          if (key !== auditDate) return false;
        } else {
          if (key < report.start_date! || key > report.end_date!) return false;
        }
        if (branchFilter.size > 0 && !branchFilter.has(r.branch_name ?? "")) return false;
        return true;
      });
    },
    [incidents, deptMeta],
  );

  const incidentCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const report of reports) {
      map.set(report.id, scopeIncidents(report).length);
    }
    return map;
  }, [reports, scopeIncidents]);

  async function downloadReport(report: DocRow) {
    if (!report.start_date || !report.end_date) return;
    setPdfBusy(report.id);
    setError(null);
    try {
      const narrative = report.content ?? {};
      const auditDate = narrative.audit_date ?? "";

      const branchFilter = new Set<string>();
      for (const id of report.department_ids) {
        const meta = deptMeta.get(id);
        if (meta) branchFilter.add(meta.branch);
      }

      const scopedRecords = records.filter((r) => {
        if (r.opening_ncs == null) return false;
        const key = dateKey(excelSerialToDate(r.opening_ncs));
        if (auditDate) {
          if (key !== auditDate) return false;
        } else {
          if (key < report.start_date! || key > report.end_date!) return false;
        }
        if (branchFilter.size > 0 && !branchFilter.has(r.branch ?? "")) return false;
        return true;
      });

      const isMajor = (r: NcrRecord) =>
        r.priority === "Urgent" || r.priority === "High";

      const buildRow = (r: NcrRecord): ReportNc => ({
        ncrNumber: r.ncr_number ?? "NCR",
        description: r.description ?? "—",
        clause: r.clause ?? "—",
        priority: r.priority ?? "—",
        correctiveAction: r.corrective_action ?? "",
        preventiveAction: r.preventive_action ?? "",
        rootCause: r.root_cause ?? "",
        consequences: r.consequences ?? "",
        responsibility: r.hod_name ?? r.branch_manager ?? "—",
        deadline: formatExcelDate(r.closing_ncs),
      });

      const majorNcs = scopedRecords.filter(isMajor).map(buildRow);
      const minorNcs = scopedRecords.filter((r) => !isMajor(r)).map(buildRow);

      const criteria = new Set<string>();
      for (const r of scopedRecords) {
        if (!r.guideline) continue;
        const standard = r.guideline.split(" – ")[0].trim();
        if (standard) criteria.add(standard);
      }

      const locations = new Set<string>();
      for (const id of report.department_ids) {
        const meta = deptMeta.get(id);
        if (meta) locations.add(meta.branch);
      }
      for (const r of scopedRecords) if (r.branch) locations.add(r.branch);

      const incidentRows: ReportIncident[] = scopeIncidents(report).map((r) => ({
        incidentId: r.incident_id ?? `INC-${r.id.slice(0, 6).toUpperCase()}`,
        title: r.title ?? "—",
        incidentType: r.incident_type ?? "—",
        severity: severityLabel(r.severity),
        branch: r.branch_name ?? "—",
        department: r.department_name ?? "—",
        occurredAt: dateKey(new Date(r.occurred_at!)),
        description: r.description ?? "",
      }));

      const photos: string[] = [];
      for (const r of scopedRecords) {
        if (photos.length >= 12) break;
        for (const url of r.pictures ?? []) {
          if (photos.length >= 12) break;
          try {
            const res = await fetch(url);
            const blob = await res.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            });
            photos.push(dataUrl);
          } catch {
            photos.push(url);
          }
        }
      }

      const data: AuditReportPdfData = {
        title: report.title,
        reference:
          narrative.reference_id?.trim() ||
          `AUD-${report.plan_id?.slice(0, 6).toUpperCase() ?? report.id.slice(0, 6).toUpperCase()}`,
        location: [...locations].join(", ") || "—",
        dateRange: auditDate
          ? new Date(auditDate + "T00:00:00").toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : formatDateRange(report.start_date, report.end_date),
        auditors: narrative.auditors?.trim() || "—",
        leadAuditees: narrative.lead_auditees?.trim() || "—",
        overallAssessment: narrative.overall_assessment?.trim() || "",
        keyFindings: narrative.key_findings?.trim() || "",
        scope: narrative.scope?.trim() || "",
        criteria: [...criteria],
        methodology: narrative.methodology?.trim() || "",
        conformances: narrative.conformances?.trim() || "",
        majorNcs,
        minorNcs,
        incidents: incidentRows,
        photos,
      };
      downloadAuditReportPdf(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate PDF.");
    } finally {
      setPdfBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading audit documents...</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-semibold text-zinc-50">Audit</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Audit reports and corrective &amp; preventive actions — read only
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
          {error}
        </p>
      )}

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Audit Reports
        </h3>
        {reports.length === 0 ? (
          <p className="text-sm text-zinc-500">No audit reports published yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-zinc-100">
                      {report.title}
                    </h4>
                    {report.description && (
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                        {report.description}
                      </p>
                    )}
                    {(incidentCounts.get(report.id) ?? 0) > 0 && (
                      <p className="mt-2 text-[11px] font-medium text-red-400/90">
                        {incidentCounts.get(report.id)} unresolved incident(s) in scope
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => downloadReport(report)}
                    disabled={pdfBusy === report.id}
                    className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                  >
                    {pdfBusy === report.id ? "Preparing PDF..." : "Download Report PDF"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Corrective &amp; Preventive Action Plans
        </h3>
        {capas.length === 0 ? (
          <p className="text-sm text-zinc-500">No corrective/preventive action plans yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {capas.map((capa) => (
              <div
                key={capa.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <h4 className="text-sm font-semibold text-zinc-100">{capa.title}</h4>
                {capa.description && (
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    {capa.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Corrective &amp; Preventive Actions (from NCRs)
        </h3>
        {ncRows.length === 0 ? (
          <p className="text-sm text-zinc-500">No corrective/preventive actions recorded.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
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
                      Priority
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                      Corrective Action
                    </th>
                    <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                      Preventive Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ncRows.map((r) => (
                    <tr key={r.ncrNumber} className="border-b border-zinc-800/60 align-top last:border-0">
                      <td className="px-2 py-2 font-mono text-zinc-200">{r.ncrNumber}</td>
                      <td className="px-2 py-2 text-zinc-400">{r.branch}</td>
                      <td className="px-2 py-2 text-zinc-400">{r.departmentName}</td>
                      <td className="px-2 py-2 text-zinc-400">{r.priority}</td>
                      <td className="min-w-[16rem] px-2 py-2 text-zinc-300">
                        {r.correctiveAction || "—"}
                      </td>
                      <td className="min-w-[16rem] px-2 py-2 text-zinc-300">
                        {r.preventiveAction || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
