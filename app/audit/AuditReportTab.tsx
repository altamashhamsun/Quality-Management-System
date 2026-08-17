"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { NcrRecord } from "@/lib/ncr";
import { isResolved, severityLabel, type IncidentRecord } from "@/lib/incident";
import {
  downloadAuditReportPdf,
  type AuditReportPdfData,
  type ReportIncident,
  type ReportNc,
} from "@/lib/auditReportPdf";

type PlanDoc = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  department_ids: string[];
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

const emptyNarrative = {
  reference_id: "",
  audit_date: "",
  auditors: "",
  lead_auditees: "",
  overall_assessment: "",
  key_findings: "",
  scope: "",
  methodology: "",
  conformances: "",
};

export default function AuditReportTab() {
  const { loading } = useAuth();
  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [records, setRecords] = useState<NcrRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [narrative, setNarrative] = useState<Record<string, string>>(emptyNarrative);
  const [reportId, setReportId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const load = useCallback(async () => {
    const [plansResult, deptsResult, recordsResult, incidentsResult] = await Promise.all([
      supabase
        .from("audit_documents")
        .select("id, title, start_date, end_date, department_ids")
        .eq("category", "plan")
        .order("start_date", { ascending: false }),
      supabase.from("departments").select("id, name, branches(name)"),
      supabase.from("ncr_records").select("*"),
      supabase.from("incidents").select("*"),
    ]);
    if (!plansResult.error) setPlans(plansResult.data ?? []);
    if (!deptsResult.error) setDepartments(deptsResult.data ?? []);
    if (!recordsResult.error) setRecords(recordsResult.data ?? []);
    if (!incidentsResult.error) setIncidents(incidentsResult.data ?? []);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    (async () => {
      await load();
    })();
  }, [loading, load]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

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

  const planDepartments = useMemo(() => {
    if (!selectedPlan) return [];
    if (selectedPlan.department_ids.length === 0) {
      return departments.map((d) => ({
        id: d.id,
        name: d.name,
        branch: Array.isArray(d.branches)
          ? (d.branches[0]?.name ?? "Other")
          : (d.branches?.name ?? "Other"),
      }));
    }
    return selectedPlan.department_ids
      .map((id) => deptMeta.get(id))
      .filter((d): d is { name: string; branch: string } => Boolean(d));
  }, [selectedPlan, departments, deptMeta]);

  const scopedRecords = useMemo(() => {
    if (!selectedPlan || !selectedPlan.start_date || !selectedPlan.end_date) return [];
    const start = selectedPlan.start_date;
    const end = selectedPlan.end_date;
    const auditDate = narrative.audit_date;
    const branchFilter = new Set<string>();
    for (const id of selectedPlan.department_ids) {
      const meta = deptMeta.get(id);
      if (meta) branchFilter.add(meta.branch);
    }
    return records.filter((r) => {
      if (r.opening_ncs == null) return false;
      const key = dateKey(excelSerialToDate(r.opening_ncs));
      if (auditDate) {
        if (key !== auditDate) return false;
      } else {
        if (key < start || key > end) return false;
      }
      if (branchFilter.size > 0 && !branchFilter.has(r.branch ?? "")) return false;
      return true;
    });
  }, [records, selectedPlan, deptMeta, narrative.audit_date]);

  const isMajor = (r: NcrRecord) =>
    r.priority === "Urgent" || r.priority === "High";

  const ncRows: ReportNc[] = useMemo(
    () =>
      scopedRecords.map((r) => ({
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
      })),
    [scopedRecords],
  );

  const majorNcs = useMemo(() => ncRows.filter((n, i) => isMajor(scopedRecords[i])), [ncRows, scopedRecords]);
  const minorNcs = useMemo(() => ncRows.filter((n, i) => !isMajor(scopedRecords[i])), [ncRows, scopedRecords]);

  const scopedIncidents = useMemo(() => {
    if (!selectedPlan || !selectedPlan.start_date || !selectedPlan.end_date) return [];
    const start = selectedPlan.start_date;
    const end = selectedPlan.end_date;
    const auditDate = narrative.audit_date;
    const branchFilter = new Set<string>();
    for (const id of selectedPlan.department_ids) {
      const meta = deptMeta.get(id);
      if (meta) branchFilter.add(meta.branch);
    }
    return incidents.filter((r) => {
      if (!r.occurred_at || isResolved(r)) return false;
      const key = dateKey(new Date(r.occurred_at));
      if (auditDate) {
        if (key !== auditDate) return false;
      } else {
        if (key < start || key > end) return false;
      }
      if (branchFilter.size > 0 && !branchFilter.has(r.branch_name ?? "")) return false;
      return true;
    });
  }, [incidents, selectedPlan, deptMeta, narrative.audit_date]);

  const incidentRows: ReportIncident[] = useMemo(
    () =>
      scopedIncidents.map((r) => ({
        incidentId: r.incident_id ?? `INC-${r.id.slice(0, 6).toUpperCase()}`,
        title: r.title ?? "—",
        incidentType: r.incident_type ?? "—",
        severity: severityLabel(r.severity),
        branch: r.branch_name ?? "—",
        department: r.department_name ?? "—",
        occurredAt: r.occurred_at ? dateKey(new Date(r.occurred_at)) : "—",
        description: r.description ?? "",
      })),
    [scopedIncidents],
  );

  const criteria = useMemo(() => {
    const set = new Set<string>();
    for (const r of scopedRecords) {
      if (!r.guideline) continue;
      const standard = r.guideline.split(" – ")[0].trim();
      if (standard) set.add(standard);
    }
    return [...set];
  }, [scopedRecords]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const d of planDepartments) if (d.branch) set.add(d.branch);
    for (const r of scopedRecords) if (r.branch) set.add(r.branch);
    return [...set];
  }, [planDepartments, scopedRecords]);

  // Autosave the audit report narrative to Supabase so work is never lost.
  useEffect(() => {
    if (!selectedPlan || dataLoading) return;
    const hasContent = Object.entries(narrative).some(
      ([k, v]) => v.trim() && k !== "reference_id",
    );
    if (!hasContent) return;

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setAutosaveStatus("saving");

    autosaveTimer.current = setTimeout(async () => {
      const summary = `Audit date: ${narrative.audit_date || "—"}, Major NCs: ${majorNcs.length}, Minor NCs: ${minorNcs.length}, Unresolved incidents: ${scopedIncidents.length}, Departments: ${planDepartments.map((d) => d.name).join(", ") || "All"}, Criteria: ${criteria.join(", ") || "—"}`;
      const content = {
        reference_id: narrative.reference_id.trim(),
        audit_date: narrative.audit_date.trim(),
        auditors: narrative.auditors.trim(),
        lead_auditees: narrative.lead_auditees.trim(),
        overall_assessment: narrative.overall_assessment.trim(),
        key_findings: narrative.key_findings.trim(),
        scope: narrative.scope.trim(),
        methodology: narrative.methodology.trim(),
        conformances: narrative.conformances.trim(),
      };
      const payload = {
        category: "report",
        title: `${selectedPlan.title} – Audit Report`,
        description: summary,
        content,
        plan_id: selectedPlan.id,
        start_date: selectedPlan.start_date,
        end_date: selectedPlan.end_date,
        department_ids: selectedPlan.department_ids,
      };

      if (reportId) {
        await supabase.from("audit_documents").update(payload).eq("id", reportId);
      } else {
        const { data } = await supabase
          .from("audit_documents")
          .insert(payload)
          .select("id")
          .single();
        if (data) setReportId(data.id);
      }
      setAutosaveStatus("saved");
      setSavedAt(new Date().toLocaleString());
    }, 800);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [selectedPlan, dataLoading, narrative, reportId, majorNcs, minorNcs, scopedIncidents, planDepartments, criteria]);

  async function loadReportForPlan(planId: string) {
    setError(null);
    setSavedAt(null);
    setNarrative(emptyNarrative);
    setReportId(null);
    if (!planId) return;
    const { data } = await supabase
      .from("audit_documents")
      .select("id, content")
      .eq("category", "report")
      .eq("plan_id", planId)
      .maybeSingle();
    if (data?.content) {
      setReportId(data.id);
      setNarrative({ ...emptyNarrative, ...(data.content as Record<string, string>) });
    }
  }

  function handlePlanChange(id: string) {
    setSelectedPlanId(id);
    void loadReportForPlan(id);
  }

  function setField(key: string, value: string) {
    setNarrative((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!selectedPlan) return;
    setSaving(true);
    setError(null);
    setSavedAt(null);

    const summary = `Audit date: ${narrative.audit_date || "—"}, Major NCs: ${majorNcs.length}, Minor NCs: ${minorNcs.length}, Unresolved incidents: ${scopedIncidents.length}, Departments: ${planDepartments.map((d) => d.name).join(", ") || "All"}, Criteria: ${criteria.join(", ") || "—"}`;
    const content = {
      reference_id: narrative.reference_id.trim(),
      audit_date: narrative.audit_date.trim(),
      auditors: narrative.auditors.trim(),
      lead_auditees: narrative.lead_auditees.trim(),
      overall_assessment: narrative.overall_assessment.trim(),
      key_findings: narrative.key_findings.trim(),
      scope: narrative.scope.trim(),
      methodology: narrative.methodology.trim(),
      conformances: narrative.conformances.trim(),
    };
    const payload = {
      category: "report",
      title: `${selectedPlan.title} – Audit Report`,
      description: summary,
      content,
      plan_id: selectedPlan.id,
      start_date: selectedPlan.start_date,
      end_date: selectedPlan.end_date,
      department_ids: selectedPlan.department_ids,
    };

    let result;
    if (reportId) {
      result = await supabase
        .from("audit_documents")
        .update(payload)
        .eq("id", reportId);
    } else {
      const { data, error } = await supabase
        .from("audit_documents")
        .insert(payload)
        .select("id")
        .single();
      result = { error };
      if (!error && data) setReportId(data.id);
    }

    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSavedAt(new Date().toLocaleString());
  }

  async function handlePdf() {
    if (!selectedPlan) return;
    setPdfBusy(true);
    setError(null);
    try {
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

      const reference =
        narrative.reference_id.trim() || `AUD-${selectedPlan.id.slice(0, 6).toUpperCase()}`;
      const data: AuditReportPdfData = {
        title: selectedPlan.title,
        reference,
        location: locations.join(", "),
        dateRange: narrative.audit_date
          ? new Date(narrative.audit_date + "T00:00:00").toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : formatDateRange(selectedPlan.start_date!, selectedPlan.end_date!),
        auditors: narrative.auditors.trim() || "—",
        leadAuditees: narrative.lead_auditees.trim() || "—",
        overallAssessment: narrative.overall_assessment.trim(),
        keyFindings: narrative.key_findings.trim(),
        scope: narrative.scope.trim(),
        criteria,
        methodology: narrative.methodology.trim(),
        conformances: narrative.conformances.trim(),
        majorNcs,
        minorNcs,
        incidents: incidentRows,
        photos,
      };
      downloadAuditReportPdf(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-300";

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-50">Audit Report</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Select an audit plan to generate a professional report from the NCRs
            raised on its audit date.
          </p>
        </div>
        {selectedPlan && (
          <button
            onClick={handlePdf}
            disabled={pdfBusy}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors duration-300 hover:bg-zinc-700 disabled:opacity-50"
          >
            {pdfBusy ? "Preparing PDF..." : "Download Report PDF"}
          </button>
        )}
      </div>

      {dataLoading ? (
        <p className="text-sm text-zinc-500">Loading audit plans...</p>
      ) : plans.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-12 text-center text-sm text-zinc-500">
          No audit plans yet. Create an audit plan with a date range in the
          Audit Plans tab first.
        </p>
      ) : (
        <>
          <label className="mb-6 flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
            Select an audit plan
            <select
              value={selectedPlanId}
              onChange={(e) => handlePlanChange(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-50 outline-none focus:border-zinc-300"
            >
              <option value="">Choose an audit plan...</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.start_date ? ` (${formatDateRange(p.start_date, p.end_date!)})` : ""}
                </option>
              ))}
            </select>
          </label>

          {!selectedPlan ? (
            <p className="text-sm text-zinc-500">
              Select a plan above to build its report.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <StatCard label="NCRs for this audit" value={scopedRecords.length} />
                <StatCard label="Major NCs" value={majorNcs.length} tone="red" />
                <StatCard label="Minor NCs" value={minorNcs.length} tone="yellow" />
                <StatCard label="Unresolved Incidents" value={scopedIncidents.length} tone="red" />
                <StatCard label="Standards" value={criteria.length} />
              </div>

              <ReportSection title="Audit Details">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                    Reference ID
                    <input
                      type="text"
                      value={narrative.reference_id}
                      onChange={(e) => setField("reference_id", e.target.value)}
                      placeholder={`AUD-${selectedPlan.id.slice(0, 6).toUpperCase()}`}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                    Location / Branch(es)
                    <input
                      type="text"
                      value={locations.join(", ")}
                      readOnly
                      className={`${inputClass} opacity-70`}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                    Window
                    <input
                      type="text"
                      value={formatDateRange(selectedPlan.start_date!, selectedPlan.end_date!)}
                      readOnly
                      className={`${inputClass} opacity-70`}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                    Audit date
                    <input
                      type="date"
                      value={narrative.audit_date}
                      onChange={(e) => setField("audit_date", e.target.value)}
                      className={`${inputClass} [color-scheme:dark]`}
                    />
                    <span className="text-[11px] text-zinc-500">
                      NCRs opened on this date in the plan&apos;s branches are the
                      records for this audit.
                    </span>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                    Auditor(s)
                    <input
                      type="text"
                      value={narrative.auditors}
                      onChange={(e) => setField("auditors", e.target.value)}
                      placeholder="e.g. A. Sharma, R. Verma"
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                    Lead Auditee(s)
                    <input
                      type="text"
                      value={narrative.lead_auditees}
                      onChange={(e) => setField("lead_auditees", e.target.value)}
                      placeholder="e.g. B. Mehta (Kitchen Manager)"
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                    Departments Audited
                    <input
                      type="text"
                      value={planDepartments.map((d) => d.name).join(", ") || "All"}
                      readOnly
                      className={`${inputClass} opacity-70`}
                    />
                  </label>
                </div>
              </ReportSection>

              <NarrativeBox
                title="Overall Assessment"
                hint="e.g. Compliant, Needs Improvement, Non-Compliant"
                value={narrative.overall_assessment}
                onChange={(v) => setField("overall_assessment", v)}
                rows={3}
              />
              <NarrativeBox
                title="Key Findings Highlights"
                hint="Brief summary for executive management: critical risk areas and major wins"
                value={narrative.key_findings}
                onChange={(v) => setField("key_findings", v)}
                rows={4}
              />
              <NarrativeBox
                title="Audit Scope"
                hint="Specific departments, processes, areas, or records evaluated"
                value={narrative.scope}
                onChange={(v) => setField("scope", v)}
                rows={3}
              />
              <NarrativeBox
                title="Methodology"
                hint="How data was gathered: walkthroughs, document reviews, logs, interviews"
                value={narrative.methodology}
                onChange={(v) => setField("methodology", v)}
                rows={3}
              />

              <ReportSection title="Criteria / Standards">
                {criteria.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No standards found. NCRs against these standards will appear
                    here when raised on the audit date.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {criteria.map((c) => (
                      <li key={c} className="text-sm text-zinc-300">
                        • {c}
                      </li>
                    ))}
                  </ul>
                )}
              </ReportSection>

              <ReportSection title="Conformances / Strengths">
                <textarea
                  value={narrative.conformances}
                  onChange={(e) => setField("conformances", e.target.value)}
                  placeholder="Areas operating smoothly and meeting standards..."
                  rows={4}
                  className={`${inputClass} resize-none`}
                />
              </ReportSection>

              <ReportSection title="Non-Conformances">
                <NcList title="Major NC" tone="red" ncs={majorNcs} empty="No major non-conformances on this audit date." />
                <NcList title="Minor NC" tone="yellow" ncs={minorNcs} empty="No minor non-conformances on this audit date." />
              </ReportSection>

              <ReportSection title="Unresolved Incidents">
                {incidentRows.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No unresolved incidents on record for the audited branch(es) in
                    this date window.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {incidentRows.map((n) => (
                      <div
                        key={n.incidentId}
                        className="rounded-lg border border-red-900/40 bg-zinc-900/40 p-3"
                      >
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-red-300">
                            {n.incidentId}
                          </p>
                          <span className="rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300">
                            {n.severity}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-zinc-200">{n.title}</p>
                        {n.description && (
                          <p className="mt-1 text-xs text-zinc-400">{n.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
                          <span>Type: {n.incidentType}</span>
                          <span>Branch: {n.branch}</span>
                          <span>Dept: {n.department}</span>
                          <span>Date: {n.occurredAt}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ReportSection>

              <ReportSection title="Opportunities for Improvement">
                {ncRows.filter((n) => n.correctiveAction || n.preventiveAction).length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    Corrective and preventive actions for each NCR will be listed here.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {ncRows
                      .filter((n) => n.correctiveAction || n.preventiveAction)
                      .map((n) => (
                        <div key={n.ncrNumber} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                          <p className="mb-2 text-xs font-semibold text-zinc-300">
                            {n.ncrNumber}
                          </p>
                          <div className="flex flex-col gap-2 text-xs text-zinc-400">
                            {n.correctiveAction && (
                              <p>
                                <span className="font-medium text-zinc-300">Corrective: </span>
                                {n.correctiveAction}
                              </p>
                            )}
                            {n.preventiveAction && (
                              <p>
                                <span className="font-medium text-zinc-300">Preventive: </span>
                                {n.preventiveAction}
                              </p>
                            )}
                            {n.consequences && (
                              <p>
                                <span className="font-medium text-red-300">Consequence: </span>
                                {n.consequences}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </ReportSection>

              <ReportSection title="Corrective Action Plan (CAP)">
                <div className="flex flex-col gap-4">
                  {ncRows.filter((n) => n.rootCause).length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      Root cause analysis for each NCR will be listed here.
                    </p>
                  ) : (
                    ncRows
                      .filter((n) => n.rootCause)
                      .map((n) => (
                        <div key={n.ncrNumber} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                          <p className="mb-2 text-xs font-semibold text-zinc-300">{n.ncrNumber}</p>
                          <dl className="flex flex-col gap-2 text-xs text-zinc-400">
                            <div>
                              <dt className="font-medium text-zinc-300">Root Cause</dt>
                              <dd>{n.rootCause}</dd>
                            </div>
                            <div>
                              <dt className="font-medium text-zinc-300">Corrective Action</dt>
                              <dd>{n.correctiveAction || "—"}</dd>
                            </div>
                            <div>
                              <dt className="font-medium text-zinc-300">Preventive Action</dt>
                              <dd>{n.preventiveAction || "—"}</dd>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <dt className="font-medium text-zinc-300">Responsibility</dt>
                                <dd>{n.responsibility}</dd>
                              </div>
                              <div>
                                <dt className="font-medium text-zinc-300">Deadline</dt>
                                <dd>{n.deadline}</dd>
                              </div>
                            </div>
                          </dl>
                        </div>
                      ))
                  )}
                </div>
              </ReportSection>

              <ReportSection title="Formal Sign-Off & Evidence">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Auditor
                    </p>
                    <p className="mb-8 text-xs text-zinc-400">
                      {narrative.auditors.trim() || "Name & signature of lead auditor"}
                    </p>
                    <div className="border-t border-dashed border-zinc-700 pt-2 text-[10px] text-zinc-500">
                      Signature & Date
                    </div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Management
                    </p>
                    <p className="mb-8 text-xs text-zinc-400">
                      {narrative.lead_auditees.trim() || "Name & signature of management representative"}
                    </p>
                    <div className="border-t border-dashed border-zinc-700 pt-2 text-[10px] text-zinc-500">
                      Signature & Date
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Appendices / Evidence (photos from audit date)
                  </p>
                  {scopedRecords.every((r) => (r.pictures ?? []).length === 0) ? (
                    <p className="text-sm text-zinc-500">
                      No photos attached to NCRs on this audit date.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {scopedRecords.flatMap((r) => (r.pictures ?? []).slice(0, 3)).slice(0, 12).map((url, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={url}
                          alt={`Evidence ${i + 1}`}
                          className="h-16 w-16 rounded-md border border-zinc-800 object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </ReportSection>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg border border-zinc-600 bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Report"}
                </button>
                <button
                  onClick={handlePdf}
                  disabled={pdfBusy}
                  className="rounded-lg border border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 disabled:opacity-50"
                >
                  {pdfBusy ? "Preparing..." : "Download PDF"}
                </button>
                {(savedAt || autosaveStatus !== "idle") && (
                  <span className="text-xs text-emerald-400">
                    {autosaveStatus === "saving"
                      ? "Autosaving..."
                      : savedAt
                        ? `Saved at ${savedAt}`
                        : ""}
                  </span>
                )}
              </div>
              {error && (
                <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
                  {error}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "red" | "yellow";
}) {
  const color =
    tone === "red"
      ? "text-red-400"
      : tone === "yellow"
        ? "text-yellow-300"
        : "text-zinc-100";
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </p>
    </div>
  );
}

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
      <h3 className="mb-3 border-l-2 border-red-600 pl-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">
        {title}
      </h3>
      {children}
    </section>
  );
}

function NarrativeBox({
  title,
  hint,
  value,
  onChange,
  rows,
}: {
  title: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <ReportSection title={title}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint}
        rows={rows}
        className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-zinc-300"
      />
    </ReportSection>
  );
}

function NcList({
  title,
  tone,
  ncs,
  empty,
}: {
  title: string;
  tone: "red" | "yellow";
  ncs: ReportNc[];
  empty: string;
}) {
  if (ncs.length === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }
  const badge =
    tone === "red"
      ? "border-red-500/50 bg-red-500/10 text-red-300"
      : "border-yellow-500/50 bg-yellow-500/10 text-yellow-300";
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-semibold text-zinc-300">
        {title}{" "}
        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${badge}`}>
          {ncs.length}
        </span>
      </p>
      <div className="flex flex-col gap-2">
        {ncs.map((n) => (
          <div
            key={n.ncrNumber}
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
          >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-zinc-200">{n.ncrNumber}</p>
              <span className="text-[10px] text-zinc-500">{n.priority}</span>
            </div>
            <p className="text-xs text-zinc-400">{n.description}</p>
            {n.clause && n.clause !== "—" && (
              <p className="mt-1 text-[10px] text-zinc-500">Clause: {n.clause}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
