"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import Header from "@/components/Header";
import StatsTile from "@/components/StatsTile";
import Lightbox from "@/components/Lightbox";
import {
  dateLabel,
  driveFileIds,
  driveImageUrl,
  imageProxyUrl,
  timeLabel,
} from "@/lib/hasm";
import {
  INCIDENT_STATUS,
  INCIDENT_TYPES,
  SEVERITIES,
  isResolved,
  makeIncidentId,
  severityClass,
  severityLabel,
  type IncidentRecord,
} from "@/lib/incident";
import { downloadIncidentReportPdf } from "@/lib/incidentReportPdf";

const DRAFT_KEY = "__cis_incident_draft_v1__";

type Photo = {
  file: File;
  url: string;
  draftDataUrl: string;
  driveUrl: string;
  driveLink: string;
};

type Draft = {
  incidentId: string;
  occurredAt: string;
  location: string;
  branchId: string;
  departmentId: string;
  incidentType: string;
  severity: string;
  title: string;
  description: string;
  peopleInvolved: string;
  witnesses: string;
  injury: string;
  propertyDamage: string;
  guestImpact: string;
  foodSafetyImpact: string;
  operationalImpact: string;
  immediateCause: string;
  rootCause: string;
  contributingFactors: string;
  suggestedSop: string;
  suggestedSopClause: string;
  suggestedStandards: string;
  immediateCorrection: string;
  correctiveAction: string;
  preventiveAction: string;
  responsiblePerson: string;
  deadline: string;
  status: string;
};

type AiCapa = {
  immediate_correction: string;
  corrective_action: string;
  preventive_action: string;
};

type Group = { label: string; key: string; records: IncidentRecord[] };

const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-500 focus:border-zinc-300";
const labelCls = "mb-1.5 block text-sm font-medium text-zinc-300";
const sectionCls = "rounded-xl border border-zinc-800 bg-zinc-950/60 p-5";

function emptyDraft(seed: number): Draft {
  return {
    incidentId: makeIncidentId(seed),
    occurredAt: "",
    location: "",
    branchId: "",
    departmentId: "",
    incidentType: "",
    severity: "",
    title: "",
    description: "",
    peopleInvolved: "",
    witnesses: "",
    injury: "",
    propertyDamage: "",
    guestImpact: "",
    foodSafetyImpact: "",
    operationalImpact: "",
    immediateCause: "",
    rootCause: "",
    contributingFactors: "",
    suggestedSop: "",
    suggestedSopClause: "",
    suggestedStandards: "",
    immediateCorrection: "",
    correctiveAction: "",
    preventiveAction: "",
    responsiblePerson: "",
    deadline: "",
    status: "unresolved",
  };
}

function buildGroups(records: IncidentRecord[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of records) {
    const label = dateLabel(r.created_at);
    const existing = map.get(label);
    if (existing) existing.records.push(r);
    else map.set(label, { label, key: label, records: [r] });
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Downscale a photo into a small JPEG data URL so the autosaved draft fits in localStorage. */
async function downscaleForDraft(file: File): Promise<string> {
  const maxDim = 960;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

function dataUrlToFile(dataUrl: string, name: string, type: string): File {
  const [head, b64] = dataUrl.split(",");
  const mime = head?.match(/data:(.*?);/)?.[1] ?? (type || "image/jpeg");
  const bin = atob(b64 ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

type DraftPhoto = { name: string; type: string; dataUrl: string };
type StoredDraft = Draft & { photoData?: DraftPhoto[] };

/** Read the autosaved draft so a closed app can resume mid-form. */
function readStoredDraft(): StoredDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed || !parsed.incidentId) return null;
    return parsed;
  } catch {
    // corrupt draft -> ignore it
    return null;
  }
}

function draftPhotos(photos: DraftPhoto[] | undefined): Photo[] {
  return (photos ?? []).map((p) => ({
    file: dataUrlToFile(p.dataUrl, p.name, p.type),
    url: p.dataUrl,
    draftDataUrl: p.dataUrl,
    driveUrl: "",
    driveLink: "",
  }));
}

export default function IncidentsPage() {
  const { loading } = useAuth();
  const [records, setRecords] = useState<IncidentRecord[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<
    { id: string; name: string; branch_id: string }[]
  >([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(0));
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [aiCapa, setAiCapa] = useState<AiCapa | null>(null);
  const [aiDone, setAiDone] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lightbox, setLightbox] = useState<{
    photos: string[];
    links: string[];
    index: number;
  } | null>(null);
  const saveTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("incident_log")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    setRecords(data ?? []);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    (async () => {
      const [branchesResult, deptsResult] = await Promise.all([
        supabase.from("branches").select("id, name").order("name"),
        supabase.from("departments").select("id, name, branch_id").order("name"),
      ]);
      if (!branchesResult.error) setBranches(branchesResult.data ?? []);
      if (!deptsResult.error) setDepartments(deptsResult.data ?? []);
      await load();
    })();
  }, [loading, load]);

  // Restore a previously autosaved draft after hydration (a closed app can
  // resume mid-form). Runs off the synchronous effect path to avoid cascading
  // renders and SSR/client mismatches.
  useEffect(() => {
    const stored = readStoredDraft();
    if (!stored) return;
    const t = window.setTimeout(() => {
      setDraft(stored);
      setPhotos(draftPhotos(stored.photoData));
      setFormOpen(true);
      setDraftRestored(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  // Autosave the whole form (including photos) so nothing is lost on close.
  useEffect(() => {
    if (!formOpen) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        const payload = {
          ...draft,
          photoData: photos.map((p) => ({
            name: p.file.name,
            type: p.file.type,
            dataUrl: p.draftDataUrl,
          })),
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        setLastSavedAt(new Date());
      } catch {
        setError(
          "Draft could not be saved automatically — reduce photo sizes or save the incident now.",
        );
      }
    }, 500);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [draft, photos, formOpen]);

  const setField = (key: keyof Draft, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const groups = useMemo(() => buildGroups(records), [records]);
  const summary = useMemo(
    () => ({
      total: records.length,
      resolved: records.filter((r) => isResolved(r)).length,
      unresolved: records.filter((r) => !isResolved(r)).length,
      critical: records.filter((r) => r.severity === "critical").length,
    }),
    [records],
  );

  const branchDepartments = useMemo(
    () =>
      draft.branchId
        ? departments.filter((d) => d.branch_id === draft.branchId)
        : [],
    [departments, draft.branchId],
  );

  function openForm() {
    setDraft(emptyDraft(records.length));
    setPhotos([]);
    setAiCapa(null);
    setAiDone(false);
    setError(null);
    setFormOpen(true);
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // fine without it
    }
    setDraft(emptyDraft(records.length));
    setPhotos([]);
    setAiCapa(null);
    setAiDone(false);
    setDraftRestored(false);
    setLastSavedAt(null);
    setError(null);
    setFormOpen(false);
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    setError(null);
    for (const file of files) {
      readAsDataUrl(file)
        .then((url) => downscaleForDraft(file).then((draftDataUrl) => ({ url, draftDataUrl })))
        .then(({ url, draftDataUrl }) => {
          setPhotos((prev) => [
            ...prev,
            { file, url, draftDataUrl, driveUrl: "", driveLink: "" },
          ]);
        })
        .catch(() => setError("Could not read that image."));
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function generateAi() {
    if (!draft.title.trim() && !draft.description.trim()) {
      setError("Add an incident title or a description first so the AI can help.");
      return;
    }
    setError(null);
    setAnalyzing(true);
    setAiDone(false);
    try {
      const dept = departments.find((d) => d.id === draft.departmentId);
      const res = await fetch("/api/ai/incident", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentType: draft.incidentType,
          severity: draft.severity,
          departmentName: dept?.name ?? "",
          location: draft.location,
          title: draft.title,
          description: draft.description,
          peopleInvolved: draft.peopleInvolved,
          witnesses: draft.witnesses,
          injury: draft.injury,
          propertyDamage: draft.propertyDamage,
          guestImpact: draft.guestImpact,
          foodSafetyImpact: draft.foodSafetyImpact,
          operationalImpact: draft.operationalImpact,
          immediateCause: draft.immediateCause,
          rootCause: draft.rootCause,
          contributingFactors: draft.contributingFactors,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI suggestions failed.");
      const s = data.suggestions as {
        sop: { name: string; standard: string; clause: string } | null;
        iso_standards: string[];
        capa: AiCapa;
      };
      setDraft((prev) => ({
        ...prev,
        suggestedSop: s.sop?.name ?? prev.suggestedSop,
        suggestedSopClause:
          s.sop?.standard && s.sop?.clause
            ? `${s.sop.standard} – ${s.sop.clause}`
            : (s.sop?.clause ?? prev.suggestedSopClause),
        suggestedStandards: s.iso_standards.join("\n"),
        immediateCorrection: s.capa.immediate_correction,
        correctiveAction: s.capa.corrective_action,
        preventiveAction: s.capa.preventive_action,
      }));
      setAiCapa(s.capa);
      setAiDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI suggestions failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function uploadToDrive(
    photo: Photo,
    index: number,
  ): Promise<{ imageUrl: string; link: string }> {
    try {
      const ext = photo.file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
      const stamp = new Date();
      const datePart = [
        stamp.getFullYear(),
        String(stamp.getMonth() + 1).padStart(2, "0"),
        String(stamp.getDate()).padStart(2, "0"),
      ].join("");
      const filename = `INC-${datePart}-${index + 1}.${ext}`;
      const res = await fetch("/api/drive/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          base64: await fileToBase64(photo.file),
          mime: photo.file.type || "image/jpeg",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Drive upload failed.");
      const link: string = data.publicLink ?? data.webViewLink ?? "";
      return { imageUrl: driveImageUrl(link), link };
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Drive upload failed.");
    }
  }

  async function saveIncident() {
    if (!draft.title.trim()) {
      setError("Incident title is required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const pictures: string[] = [];
      const driveLinks: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const { imageUrl, link } = await uploadToDrive(photos[i], i);
        pictures.push(imageUrl);
        driveLinks.push(link);
      }
      const dept = departments.find((d) => d.id === draft.departmentId);
      const branch = branches.find((b) => b.id === draft.branchId);
      const standards = draft.suggestedStandards
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const { error: err } = await supabase.from("incident_log").insert({
        incident_id: draft.incidentId,
        title: draft.title.trim(),
        incident_type: draft.incidentType || null,
        severity: draft.severity || null,
        occurred_at: draft.occurredAt
          ? new Date(draft.occurredAt).toISOString()
          : null,
        location: draft.location.trim() || null,
        branch_id: draft.branchId || null,
        branch_name: branch?.name ?? null,
        department_id: draft.departmentId || null,
        department_name: dept?.name ?? null,
        description: draft.description.trim() || null,
        people_involved: draft.peopleInvolved.trim() || null,
        witnesses: draft.witnesses.trim() || null,
        pictures: pictures.length ? pictures : null,
        drive_links: driveLinks.length ? driveLinks : null,
        injury: draft.injury.trim() || null,
        property_damage: draft.propertyDamage.trim() || null,
        guest_impact: draft.guestImpact.trim() || null,
        food_safety_impact: draft.foodSafetyImpact.trim() || null,
        operational_impact: draft.operationalImpact.trim() || null,
        immediate_cause: draft.immediateCause.trim() || null,
        root_cause: draft.rootCause.trim() || null,
        contributing_factors: draft.contributingFactors.trim() || null,
        suggested_sop: draft.suggestedSop.trim() || null,
        suggested_sop_clause: draft.suggestedSopClause.trim() || null,
        suggested_standards: standards.length ? standards : null,
        ai_capa: aiCapa,
        immediate_correction: draft.immediateCorrection.trim() || null,
        corrective_action: draft.correctiveAction.trim() || null,
        preventive_action: draft.preventiveAction.trim() || null,
        responsible_person: draft.responsiblePerson.trim() || null,
        deadline: draft.deadline ? new Date(draft.deadline).toISOString() : null,
        status: draft.status === "resolved" ? "resolved" : "unresolved",
      });
      if (err) throw new Error(err.message);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // fine without it
      }
      setDraft(emptyDraft(records.length));
      setPhotos([]);
      setAiCapa(null);
      setAiDone(false);
      setDraftRestored(false);
      setLastSavedAt(null);
      setFormOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save the incident.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(record: IncidentRecord, value: string) {
    const next = value === "resolved" ? "resolved" : "unresolved";
    const prev = records.map((r) => ({ ...r }));
    setRecords((rs) =>
      rs.map((r) =>
        r.id === record.id
          ? {
              ...r,
              status: next,
              resolved_at:
                next === "resolved" ? new Date().toISOString() : null,
            }
          : r,
      ),
    );
    const { error: err } = await supabase
      .from("incident_log")
      .update({
        status: next,
        resolved_at: next === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", record.id);
    if (err) {
      setRecords(prev);
      setError(err.message);
    }
  }

  async function deleteIncident(record: IncidentRecord) {
    const title = record.title || "this incident";
    if (!window.confirm(`Delete "${title}"?\n\nThis also removes its Drive photos.`)) {
      return;
    }
    setError(null);
    try {
      const ids = driveFileIds([
        ...(record.drive_links ?? []),
        ...(record.pictures ?? []),
      ]);
      if (ids.length > 0) {
        await fetch("/api/drive/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
      }
      const { error: err } = await supabase
        .from("incident_log")
        .delete()
        .eq("id", record.id);
      if (err) throw new Error(err.message);
      setRecords((rs) => rs.filter((r) => r.id !== record.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete the incident.");
    }
  }

  async function handleReportPdf() {
    if (records.length === 0) return;
    setPdfBusy(true);
    setError(null);
    try {
      await downloadIncidentReportPdf(records);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate the report PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-[#050507] font-sans">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-50">Incident Log</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Incident registration with AI-suggested SOP / ISO clauses and a CAPA
              plan. Your draft is saved automatically as you type.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReportPdf}
            disabled={pdfBusy || dataLoading || records.length === 0}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors duration-300 hover:bg-zinc-700 disabled:opacity-50"
          >
            {pdfBusy ? "Preparing PDF..." : "Download CEO Report (PDF)"}
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatsTile label="Total Incidents" value={summary.total} />
          <StatsTile label="Resolved" value={summary.resolved} />
          <StatsTile label="Unresolved" value={summary.unresolved} />
          <StatsTile label="Critical" value={summary.critical} />
        </div>

        {!formOpen ? (
          <button
            type="button"
            onClick={openForm}
            className="mt-6 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-400 hover:bg-zinc-800"
          >
            + Incident Registration
          </button>
        ) : (
          <section className={`${sectionCls} mt-6`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-zinc-100">
                Incident Registration
              </h3>
              <span className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400">
                {draft.incidentId}
              </span>
            </div>

            {(draftRestored || lastSavedAt) && (
              <p className="mt-2 text-xs text-emerald-400/90">
                {draftRestored && "Draft restored — your unsaved form is back."}
                {draftRestored && lastSavedAt ? " " : ""}
                {lastSavedAt
                  ? `Autosaved at ${lastSavedAt.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}.`
                  : ""}
              </p>
            )}

            {/* ---------- 1. INCIDENT DETAILS ---------- */}
            <div className="mt-5 flex flex-col gap-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <h4 className="mb-3 text-sm font-semibold text-zinc-100">
                  1. Incident Details
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Date / time</label>
                    <input
                      type="datetime-local"
                      value={draft.occurredAt}
                      onChange={(e) => setField("occurredAt", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Location / area</label>
                    <input
                      type="text"
                      value={draft.location}
                      onChange={(e) => setField("location", e.target.value)}
                      placeholder="e.g. Kitchen prep area, Main lobby, Store room"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Branch</label>
                    <select
                      value={draft.branchId}
                      onChange={(e) => {
                        setField("branchId", e.target.value);
                        setField("departmentId", "");
                      }}
                      className={inputCls}
                    >
                      <option value="">Select branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Department</label>
                    <select
                      value={draft.departmentId}
                      onChange={(e) => setField("departmentId", e.target.value)}
                      disabled={!draft.branchId}
                      className={inputCls}
                    >
                      <option value="">Select department</option>
                      {branchDepartments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Incident type</label>
                    <select
                      value={draft.incidentType}
                      onChange={(e) => setField("incidentType", e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select incident type</option>
                      {INCIDENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Severity</label>
                    <select
                      value={draft.severity}
                      onChange={(e) => setField("severity", e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Select severity</option>
                      {SEVERITIES.map((s) => (
                        <option key={s} value={s}>
                          {severityLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ---------- 2. WHAT HAPPENED ---------- */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <h4 className="mb-3 text-sm font-semibold text-zinc-100">
                  2. What Happened
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Incident title</label>
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) => setField("title", e.target.value)}
                      placeholder="Short title, e.g. Slip and fall in kitchen wash area"
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Description</label>
                    <textarea
                      value={draft.description}
                      onChange={(e) => setField("description", e.target.value)}
                      rows={4}
                      placeholder="What happened, in order?"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>People involved</label>
                    <input
                      type="text"
                      value={draft.peopleInvolved}
                      onChange={(e) => setField("peopleInvolved", e.target.value)}
                      placeholder="Names / roles"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Witnesses</label>
                    <input
                      type="text"
                      value={draft.witnesses}
                      onChange={(e) => setField("witnesses", e.target.value)}
                      placeholder="Names / roles"
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Photos / evidence</label>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={(e) => addFiles(e.target.files)}
                      className="block w-full text-sm text-zinc-400 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-200 hover:file:bg-zinc-700"
                    />
                    {photos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {photos.map((p, i) => (
                          <div key={i} className="group relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.url}
                              alt={`Evidence photo ${i + 1}`}
                              className="h-24 w-24 rounded-lg border border-zinc-800 object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removePhoto(i)}
                              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
                              aria-label="Remove photo"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ---------- 3. IMPACT ---------- */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <h4 className="mb-3 text-sm font-semibold text-zinc-100">
                  3. Impact
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Injury</label>
                    <textarea
                      value={draft.injury}
                      onChange={(e) => setField("injury", e.target.value)}
                      rows={2}
                      placeholder="Anyone hurt? Details"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Property damage</label>
                    <textarea
                      value={draft.propertyDamage}
                      onChange={(e) => setField("propertyDamage", e.target.value)}
                      rows={2}
                      placeholder="Damage to equipment, building, etc."
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Guest impact</label>
                    <textarea
                      value={draft.guestImpact}
                      onChange={(e) => setField("guestImpact", e.target.value)}
                      rows={2}
                      placeholder="How guests were affected"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Food-safety impact</label>
                    <textarea
                      value={draft.foodSafetyImpact}
                      onChange={(e) => setField("foodSafetyImpact", e.target.value)}
                      rows={2}
                      placeholder="Food / hygiene implications"
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Operational / business impact</label>
                    <textarea
                      value={draft.operationalImpact}
                      onChange={(e) => setField("operationalImpact", e.target.value)}
                      rows={2}
                      placeholder="Impact on operations, service or revenue"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* ---------- 4. INVESTIGATION ---------- */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <h4 className="mb-3 text-sm font-semibold text-zinc-100">
                  4. Investigation
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Immediate cause</label>
                    <textarea
                      value={draft.immediateCause}
                      onChange={(e) => setField("immediateCause", e.target.value)}
                      rows={2}
                      placeholder="What directly caused it?"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Root cause</label>
                    <textarea
                      value={draft.rootCause}
                      onChange={(e) => setField("rootCause", e.target.value)}
                      rows={2}
                      placeholder="Why did it really happen?"
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Contributing factors</label>
                    <textarea
                      value={draft.contributingFactors}
                      onChange={(e) => setField("contributingFactors", e.target.value)}
                      rows={2}
                      placeholder="Anything that made it worse or more likely"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Relevant SOP within Organization{" "}
                      <span className="text-zinc-500">(AI suggests)</span>
                    </label>
                    <input
                      type="text"
                      value={draft.suggestedSop}
                      onChange={(e) => setField("suggestedSop", e.target.value)}
                      placeholder="e.g. Chemical Storage & Safe Usage"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Relevant ISO standard / clause{" "}
                      <span className="text-zinc-500">(AI suggests)</span>
                    </label>
                    <textarea
                      value={draft.suggestedStandards}
                      onChange={(e) =>
                        setField("suggestedStandards", e.target.value)
                      }
                      rows={3}
                      placeholder="One ISO clause per line, e.g. ISO 45001:2018 – 6.1.2 (Hazard identification)"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>SOP clause (number & name)</label>
                    <input
                      type="text"
                      value={draft.suggestedSopClause}
                      onChange={(e) =>
                        setField("suggestedSopClause", e.target.value)
                      }
                      placeholder="e.g. ISO 45001:2018 – 8.1.2 (Eliminating hazards)"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* ---------- 5. CAPA ---------- */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-zinc-100">
                    5. CAPA <span className="font-normal text-zinc-500">(AI suggests in simple form)</span>
                  </h4>
                  {aiDone && (
                    <span className="rounded border border-orange-500/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-300">
                      AI draft — review &amp; edit
                    </span>
                  )}
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Immediate correction</label>
                    <textarea
                      value={draft.immediateCorrection}
                      onChange={(e) => setField("immediateCorrection", e.target.value)}
                      rows={2}
                      placeholder="What to do right now to contain it"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Corrective action</label>
                    <textarea
                      value={draft.correctiveAction}
                      onChange={(e) => setField("correctiveAction", e.target.value)}
                      rows={2}
                      placeholder="How to fix the underlying problem"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Preventive action</label>
                    <textarea
                      value={draft.preventiveAction}
                      onChange={(e) => setField("preventiveAction", e.target.value)}
                      rows={2}
                      placeholder="How to stop it happening again"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Responsible person</label>
                    <input
                      type="text"
                      value={draft.responsiblePerson}
                      onChange={(e) => setField("responsiblePerson", e.target.value)}
                      placeholder="Name / role"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Deadline</label>
                    <input
                      type="date"
                      value={draft.deadline}
                      onChange={(e) => setField("deadline", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <select
                      value={draft.status}
                      onChange={(e) => setField("status", e.target.value)}
                      className={inputCls}
                    >
                      {INCIDENT_STATUS.map((s) => (
                        <option key={s} value={s}>
                          {s === "resolved" ? "Resolved" : "Unresolved"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={generateAi}
                  disabled={analyzing || saving}
                  className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
                >
                  {analyzing ? "AI is reading your incident…" : "Generate SOP, ISO & CAPA with AI"}
                </button>
                <button
                  type="button"
                  onClick={saveIncident}
                  disabled={saving || analyzing}
                  className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Incident"}
                </button>
                <button
                  type="button"
                  onClick={clearDraft}
                  disabled={saving}
                  className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:border-zinc-400 hover:text-white"
                >
                  Discard Draft
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ---------- INCIDENT LIST ---------- */}
        <section className="mt-8">
          <h3 className="mb-3 text-base font-semibold text-zinc-100">Incidents</h3>
          {dataLoading ? (
            <p className="text-sm text-zinc-500">Loading incidents...</p>
          ) : records.length === 0 ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6 text-sm text-zinc-500">
              No incidents logged yet. Register your first incident above.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <div
                  key={group.key}
                  className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60"
                >
                  <div className="flex items-center gap-3 bg-zinc-900/60 px-4 py-2.5">
                    <span className="text-sm font-semibold text-zinc-100">
                      {group.label}
                    </span>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
                      {group.records.length} incident
                      {group.records.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex flex-col divide-y divide-zinc-800/60">
                    {group.records.map((record) => {
                      const resolved = isResolved(record);
                      return (
                        <div key={record.id} className="p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                  {record.incident_id || "INC"}
                                </span>
                                <h4 className="text-sm font-semibold text-zinc-100">
                                  {record.title || "Untitled Incident"}
                                </h4>
                                {record.severity && (
                                  <span
                                    className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${severityClass(record.severity)}`}
                                  >
                                    {severityLabel(record.severity)}
                                  </span>
                                )}
                                <span
                                  className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                                    resolved
                                      ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
                                      : "border-red-500/70 bg-red-500/15 text-red-300"
                                  }`}
                                >
                                  {resolved ? "Resolved" : "Unresolved"}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-500">
                                {record.incident_type || "No type"}
                                {record.branch_name ? ` · ${record.branch_name}` : ""}
                                {record.department_name
                                  ? ` · ${record.department_name}`
                                  : ""}
                                {record.occurred_at
                                  ? ` · ${dateLabel(record.occurred_at)} ${timeLabel(record.occurred_at)}`
                                  : ` · logged ${dateLabel(record.created_at)}`}
                                {record.location ? ` · ${record.location}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => deleteIncident(record)}
                                className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs text-red-300 transition-colors hover:border-red-400 hover:text-red-200"
                              >
                                Delete
                              </button>
                              <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                                Status
                                <select
                                  value={resolved ? "resolved" : "unresolved"}
                                  onChange={(e) => toggleStatus(record, e.target.value)}
                                  className={`rounded-md border px-2 py-1 text-xs outline-none ${
                                    resolved
                                      ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
                                      : "border-red-500/70 bg-red-500/15 text-red-300"
                                  }`}
                                >
                                  <option value="unresolved">Unresolved</option>
                                  <option value="resolved">Resolved</option>
                                </select>
                              </label>
                            </div>
                          </div>

                          {record.description && (
                            <p className="mt-2 text-sm text-zinc-300">
                              {record.description}
                            </p>
                          )}

                          {(record.pictures ?? []).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(record.pictures ?? []).map((src, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() =>
                                    setLightbox({
                                      photos: record.pictures ?? [],
                                      links: record.drive_links ?? [],
                                      index: i,
                                    })
                                  }
                                  className="group relative cursor-zoom-in"
                                  aria-label={`View evidence photo ${i + 1}`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={imageProxyUrl(src)}
                                    alt={`Evidence photo ${i + 1}`}
                                    className="h-20 w-20 rounded-lg border border-zinc-800 object-cover transition-transform group-hover:scale-105"
                                  />
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <Detail label="People involved" value={record.people_involved} />
                            <Detail label="Witnesses" value={record.witnesses} />
                            <Detail label="Injury" value={record.injury} />
                            <Detail label="Property damage" value={record.property_damage} />
                            <Detail label="Guest impact" value={record.guest_impact} />
                            <Detail label="Food-safety impact" value={record.food_safety_impact} />
                            <Detail label="Operational impact" value={record.operational_impact} />
                            <Detail label="Immediate cause" value={record.immediate_cause} />
                            <Detail label="Root cause" value={record.root_cause} />
                            <Detail label="Contributing factors" value={record.contributing_factors} />
                            <Detail label="Relevant SOP" value={record.suggested_sop} />
                            <Detail
                              label="SOP clause"
                              value={record.suggested_sop_clause}
                            />
                            <Detail
                              label="Relevant ISO standard / clause"
                              value={(record.suggested_standards ?? []).join("\n")}
                            />
                            <Detail
                              label="Immediate correction"
                              value={record.immediate_correction}
                            />
                            <Detail
                              label="Corrective action"
                              value={record.corrective_action}
                            />
                            <Detail
                              label="Preventive action"
                              value={record.preventive_action}
                            />
                            <Detail label="Responsible person" value={record.responsible_person} />
                            <Detail
                              label="Deadline"
                              value={
                                record.deadline
                                  ? dateLabel(record.deadline)
                                  : null
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Lightbox
        items={(lightbox?.photos ?? []).map((src, i) => ({
          src: imageProxyUrl(src),
          driveLink: lightbox?.links[i],
        }))}
        index={lightbox?.index ?? null}
        onClose={() => setLightbox(null)}
        onNavigate={(i) => setLightbox((p) => (p ? { ...p, index: i } : p))}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value || !value.trim()) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-line text-[13px] text-zinc-300">
        {value}
      </p>
    </div>
  );
}
