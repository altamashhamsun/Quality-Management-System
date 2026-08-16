"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import Modal from "@/components/Modal";
import Header from "@/components/Header";
import StatsTile from "@/components/StatsTile";
import StatusBadge from "@/components/StatusBadge";
import { downloadNcrPdf, downloadNcrsPdf } from "@/lib/ncrPdf";
import {
  FIELDS,
  NcrRecord,
  exportNcrToXlsx,
  formatExcelDate,
  parseNcrFile,
} from "@/lib/ncr";
import {
  daysOverdue,
  dueSerial,
  isDone,
  isResolved,
} from "@/lib/timeline";

const NUMBER_FIELDS = new Set(["opening_ncs", "closing_ncs"]);
const PRIORITY_OPTIONS = ["Urgent", "High", "Medium", "Low"];
const STATUS_OPTIONS = ["Action Not Taken Yet", "Action Taken", "Done"];

const emptyForm = () =>
  Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Record<string, string>;

function needsReminder(record: NcrRecord): boolean {
  if (record.reported_to_ceo || isDone(record.status)) return false;
  if (record.priority === "Urgent" || record.priority === "High") return true;
  return daysOverdue(record.opening_ncs, record.priority) > 0;
}

function ncrNum(ncr: string | null): number {
  const m = (ncr ?? "").match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

type Group = {
  key: string;
  label: string;
  serial: number;
  records: NcrRecord[];
  resolved: number;
  unresolved: number;
};

function buildGroups(records: NcrRecord[]): Group[] {
  const map = new Map<string, Group>();
  const noDate: NcrRecord[] = [];
  for (const r of records) {
    if (r.opening_ncs == null) {
      noDate.push(r);
      continue;
    }
    const serial = r.opening_ncs;
    const label = formatExcelDate(serial);
    const existing = map.get(label);
    if (existing) {
      existing.records.push(r);
    } else {
      map.set(label, {
        key: label,
        label,
        serial,
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

async function photoDataUrls(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      out.push(dataUrl);
    } catch {
      out.push(url);
    }
  }
  return out;
}

function PrioritySelect({
  record,
  onSave,
}: {
  record: NcrRecord;
  onSave: (record: NcrRecord, value: string) => void;
}) {
  const value = record.priority ?? "";
  const style =
    value === "Urgent"
      ? "border-red-500/70 bg-red-500/15 text-red-300"
      : value === "High"
        ? "border-orange-500/70 bg-orange-500/15 text-orange-300"
        : value === "Medium"
          ? "border-yellow-500/70 bg-yellow-500/15 text-yellow-300"
          : value === "Low"
            ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
            : "border-zinc-700 bg-zinc-900 text-zinc-400";
  return (
    <select
      value={value}
      onChange={(e) => onSave(record, e.target.value)}
      className={`rounded-md border px-2 py-1 text-xs outline-none ${style}`}
    >
      <option value="">—</option>
      {PRIORITY_OPTIONS.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function CeoSelect({
  record,
  onSave,
}: {
  record: NcrRecord;
  onSave: (record: NcrRecord, value: string) => void;
}) {
  const value = record.reported_to_ceo ? "Yes" : "No";
  const style =
    value === "Yes"
      ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
      : "border-zinc-700 bg-zinc-900 text-zinc-400";
  return (
    <select
      value={value}
      onChange={(e) => onSave(record, e.target.value)}
      className={`rounded-md border px-2 py-1 text-xs outline-none ${style}`}
    >
      <option value="Yes">Yes</option>
      <option value="No">No</option>
    </select>
  );
}

function TimelineCell({ record }: { record: NcrRecord }) {
  const due = dueSerial(record.opening_ncs, record.priority);
  if (due == null) return <span className="text-zinc-600">—</span>;
  const overdue = daysOverdue(record.opening_ncs, record.priority);
  if (overdue > 0 && !isDone(record.status)) {
    return (
      <div>
        <span className="text-red-400">{formatExcelDate(due)}</span>
        <span className="block text-[10px] text-red-400">Overdue {overdue}d</span>
      </div>
    );
  }
  return <span className="text-zinc-300">{formatExcelDate(due)}</span>;
}

function ReminderCell({
  record,
  onForward,
}: {
  record: NcrRecord;
  onForward: (record: NcrRecord) => void;
}) {
  if (record.reported_to_ceo)
    return <span className="text-[11px] text-emerald-400">Reported</span>;
  if (isDone(record.status))
    return <span className="text-[11px] text-zinc-500">Done</span>;
  if (needsReminder(record))
    return (
      <button
        onClick={() => onForward(record)}
        className="rounded-md border border-red-500/70 bg-red-500/15 px-2 py-1 text-[11px] text-red-300 transition-colors hover:bg-red-500/25"
      >
        Forward to CEO
      </button>
    );
  return <span className="text-zinc-600">—</span>;
}

function PhotosCell({ record }: { record: NcrRecord }) {
  const urls = record.pictures ?? [];
  const driveLinks = record.drive_links ?? [];
  if (urls.length === 0 && driveLinks.length === 0) {
    return <span className="text-zinc-600">—</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {urls.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`${record.ncr_number ?? "NCR"} photo ${i + 1}`}
            className="h-10 w-10 rounded-md border border-zinc-800 object-cover"
          />
        </a>
      ))}
      {driveLinks.map((link, i) => (
        <a
          key={`drive-${i}`}
          href={link}
          target="_blank"
          rel="noreferrer"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors hover:text-zinc-200"
          title="Google Drive copy"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2 4 15h5l3 5 3-5h5L12 2Z" />
          </svg>
        </a>
      ))}
    </div>
  );
}

export default function NcrPage() {
  const params = useParams<{ id: string; deptId: string }>();
  const router = useRouter();
  const { loading } = useAuth();

  const [deptName, setDeptName] = useState<string | null>(null);
  const [records, setRecords] = useState<NcrRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const deptResult = await supabase
      .from("departments")
      .select("name")
      .eq("id", params.deptId)
      .maybeSingle();
    if (deptResult.data) setDeptName(deptResult.data.name);

    const { data } = await supabase
      .from("ncr_records")
      .select("*")
      .eq("department_id", params.deptId)
      .order("created_at", { ascending: true });

    const records = data ?? [];
    setRecords(records);
    setDataLoading(false);

    const groups = buildGroups(records);
    setExpanded((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const newest = groups[groups.length - 1];
      return newest ? { [newest.key]: true } : {};
    });
  }, [params.deptId]);

  useEffect(() => {
    if (loading) return;
    (async () => {
      await load();
    })();
  }, [loading, load]);

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleGroup(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptyForm(),
      status: "Action Not Taken Yet",
      priority: "Medium",
      reported_to_ceo: "No",
    });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(record: NcrRecord) {
    setEditingId(record.id);
    setError(null);
    setForm(
      Object.fromEntries(
        FIELDS.map((f) => [
          f.key,
          record[f.key as keyof NcrRecord] == null
            ? ""
            : f.key === "reported_to_ceo"
              ? (record.reported_to_ceo ? "Yes" : "No")
              : String(record[f.key as keyof NcrRecord]),
        ]),
      ),
    );
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const payload = Object.fromEntries(
      FIELDS.map((f) => {
        const value = form[f.key] ?? "";
        if (NUMBER_FIELDS.has(f.key)) {
          return [f.key, value === "" ? null : parseInt(value, 10)];
        }
        if (f.key === "reported_to_ceo") {
          return [f.key, value === "" ? null : value === "Yes"];
        }
        return [f.key, value === "" ? null : value];
      }),
    );

    setSaving(true);
    setError(null);

    let result;
    if (editingId) {
      result = await supabase
        .from("ncr_records")
        .update(payload)
        .eq("id", editingId);
    } else {
      result = await supabase
        .from("ncr_records")
        .insert({ department_id: params.deptId, ...payload });
    }

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    closeModal();
    load();
  }

  async function handleDelete(record: NcrRecord) {
    if (!confirm(`Delete NCR "${record.ncr_number ?? "record"}"?`)) return;

    const { error } = await supabase
      .from("ncr_records")
      .delete()
      .eq("id", record.id);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  async function handleDeleteGroup(group: Group) {
    if (
      !confirm(
        `Delete all ${group.records.length} NCR${group.records.length === 1 ? "" : "s"} for ${group.label}? This cannot be undone.`,
      )
    ) {
      return;
    }

    const ids = group.records.map((r) => r.id);
    const { error } = await supabase
      .from("ncr_records")
      .delete()
      .in("id", ids);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  async function handleStatusChange(record: NcrRecord, newStatus: string) {
    const { error } = await supabase
      .from("ncr_records")
      .update({ status: newStatus })
      .eq("id", record.id);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  async function handlePriorityChange(record: NcrRecord, value: string) {
    const { error } = await supabase
      .from("ncr_records")
      .update({ priority: value === "" ? null : value })
      .eq("id", record.id);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  async function handleCeoChange(record: NcrRecord, value: string) {
    const { error } = await supabase
      .from("ncr_records")
      .update({ reported_to_ceo: value === "Yes" })
      .eq("id", record.id);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  async function handleForwardToCeo(record: NcrRecord) {
    const { error } = await supabase
      .from("ncr_records")
      .update({ reported_to_ceo: true })
      .eq("id", record.id);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  async function handleCommentsBlur(record: NcrRecord, rawValue: string) {
    const value = rawValue.trim();
    if (value === (record.branch_manager_comments ?? "").trim()) return;
    const { error } = await supabase
      .from("ncr_records")
      .update({ branch_manager_comments: value === "" ? null : value })
      .eq("id", record.id);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  function recordToPdfData(record: NcrRecord, photos: string[]) {
    const due = dueSerial(record.opening_ncs, record.priority);
    return {
      ncrNumber: record.ncr_number ?? "NCR",
      branch: record.branch ?? "",
      department: deptName ?? "",
      guideline: record.guideline ?? "",
      clause: record.clause ?? "",
      description: record.description ?? "",
      rootCause: record.root_cause ?? "—",
      correctiveAction: record.corrective_action ?? "—",
      preventiveAction: record.preventive_action ?? "—",
      consequences: record.consequences ?? "—",
      openingDate: formatExcelDate(record.opening_ncs),
      dueDate: due == null ? "" : formatExcelDate(due),
      priority: record.priority ?? "",
      status: record.status ?? "",
      photos,
    };
  }

  async function handleNcrPdf(record: NcrRecord) {
    setPdfBusy(record.id);
    try {
      const photos = await photoDataUrls(record.pictures ?? []);
      await downloadNcrPdf(recordToPdfData(record, photos));
    } finally {
      setPdfBusy(null);
    }
  }

  async function handleGroupPdf(group: Group) {
    setPdfBusy(group.key);
    try {
      const ncrs = [];
      for (const r of group.records) {
        const photos = await photoDataUrls(r.pictures ?? []);
        ncrs.push(recordToPdfData(r, photos));
      }
      await downloadNcrsPdf(ncrs, `ncrs-${group.label.replace(/\s+/g, "-")}.pdf`);
    } finally {
      setPdfBusy(null);
    }
  }

  function handleExport() {
    exportNcrToXlsx(records);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setError(null);

    try {
      const rows = await parseNcrFile(file);
      if (rows.length === 0) {
        setError("No rows found in the selected file.");
        return;
      }

      const { error } = await supabase.from("ncr_records").insert(
        rows.map((row) => ({
          department_id: params.deptId,
          ...row,
          status: row.status || "Action Not Taken Yet",
        })),
      );

      if (error) {
        setError(error.message);
        return;
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to import the file.",
      );
    } finally {
      setImporting(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-300";

  const query = search.trim().toLowerCase();
  const filteredRecords = query
    ? records.filter((record) =>
        Object.entries(record).some(([key, value]) => {
          if (
            key === "id" ||
            key === "department_id" ||
            key === "pictures" ||
            value == null
          ) {
            return false;
          }
          return String(value).toLowerCase().includes(query);
        }),
      )
    : records;

  const groups = buildGroups(filteredRecords);

  const pdfButtonClass =
    "rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white disabled:opacity-40";

  return (
    <div className="min-h-full bg-[#050507] font-sans">
      <Header />

      <main className="mx-auto max-w-full px-4 py-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              onClick={() => router.push(`/branches/${params.id}`)}
              className="mb-1 text-xs text-zinc-500 transition-colors hover:text-zinc-200"
            >
              &larr; Back to Departments
            </button>
            <h2 className="text-lg font-semibold text-zinc-50">
              {dataLoading ? "..." : deptName ?? "Department"}
            </h2>
            <p className="text-xs text-zinc-500">
              Non-Conformance Report (NCR) records
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExport}
              disabled={records.length === 0}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors duration-300 hover:border-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              Export XLSX
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors duration-300 hover:border-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              {importing ? "Importing..." : "Import XLSX"}
            </button>
            <button
              onClick={openCreate}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors duration-300 hover:border-zinc-300 hover:bg-zinc-800"
            >
              + Create NCR
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search issues..."
          className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-50 outline-none transition-colors duration-300 placeholder:text-zinc-600 focus:border-zinc-300"
        />

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatsTile label="Total NCRs" value={records.length} />
          <StatsTile
            label="Action Taken"
            value={records.filter((r) => r.status === "Action Taken").length}
          />
          <StatsTile
            label="Action Not Taken Yet"
            value={records.filter((r) => r.status === "Action Not Taken Yet").length}
          />
          <StatsTile
            label="Done"
            value={records.filter((r) => r.status === "Done").length}
          />
        </div>

        {dataLoading ? (
          <p className="text-sm text-zinc-500">Loading records...</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No NCR records yet. Click &quot;Create NCR&quot; to add one.
          </p>
        ) : filteredRecords.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No records match &quot;{search}&quot;.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => {
              const isOpen = !!expanded[group.key];
              return (
                <div
                  key={group.key}
                  className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60"
                >
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full items-center justify-between gap-3 bg-zinc-900/60 px-4 py-3 text-left transition-colors hover:bg-zinc-900"
                  >
                    <span className="flex items-center gap-3">
                      <svg
                        className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      <span className="text-sm font-semibold text-zinc-100">
                        {group.label}
                      </span>
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
                        {group.records.length} NCR
                        {group.records.length === 1 ? "" : "s"}
                      </span>
                      <span
                        className="text-[11px] font-semibold text-emerald-400"
                        title={`${group.resolved} resolved`}
                      >
                        +{group.resolved}
                      </span>
                      <span
                        className="text-[11px] font-semibold text-red-400"
                        title={`${group.unresolved} unresolved`}
                      >
                        -{group.unresolved}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGroupPdf(group);
                        }}
                        disabled={pdfBusy === group.key}
                        className={pdfButtonClass}
                      >
                        {pdfBusy === group.key ? "Preparing..." : "PDF"}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group);
                        }}
                        className="rounded-lg border border-red-500/50 px-2.5 py-1.5 text-xs text-red-400 transition-colors hover:border-red-400 hover:text-red-300"
                      >
                        Delete Date
                      </button>
                    </span>
                  </button>

                  {isOpen && (
                    <>
                      <div className="hidden overflow-x-auto lg:block">
                        <table className="w-full border-collapse text-left text-xs">
                          <colgroup>
                            <col className="w-24" />
                            <col className="min-w-[16rem]" />
                            <col className="w-32" />
                            <col className="w-24" />
                            <col className="w-24" />
                            <col className="w-28" />
                            <col className="w-28" />
                            <col className="w-48" />
                            <col className="w-28" />
                            <col className="w-32" />
                            <col className="w-32" />
                            <col className="w-36" />
                          </colgroup>
                          <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-900/40">
                              <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                NCR #
                              </th>
                              <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                Description
                              </th>
                              <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                Clause
                              </th>
                              <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                Opening
                              </th>
                              <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                Closing
                              </th>
                              <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                Priority
                              </th>
                              <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                Branch Manager
                              </th>
                              <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                Comments from BM
                              </th>
                              <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                Reported to CEO
                              </th>
                              <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                Reminder
                              </th>
                              <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                Photos
                              </th>
                              <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.records.map((record) => (
                              <tr
                                key={record.id}
                                className="border-b border-zinc-800/60 transition-colors hover:bg-zinc-900/40"
                              >
                                <td className="whitespace-nowrap px-2 py-2 font-semibold text-zinc-100">
                                  {record.ncr_number || "NCR"}
                                </td>
                                <td className="break-words px-2 py-2 text-zinc-300">
                                  {record.description || "—"}
                                </td>
                                <td className="break-words px-2 py-2 text-zinc-300">
                                  {record.clause || "—"}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-zinc-300">
                                  {formatExcelDate(record.opening_ncs) || "—"}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-zinc-300">
                                  {formatExcelDate(record.closing_ncs) || "—"}
                                </td>
                                <td className="px-2 py-2">
                                  <PrioritySelect
                                    record={record}
                                    onSave={handlePriorityChange}
                                  />
                                </td>
                                <td className="whitespace-nowrap px-2 py-2">
                                  <TimelineCell record={record} />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    key={record.id}
                                    defaultValue={record.branch_manager_comments ?? ""}
                                    placeholder="Comments..."
                                    onBlur={(e) =>
                                      handleCommentsBlur(record, e.target.value)
                                    }
                                    className="w-full rounded-md border border-zinc-800 bg-transparent px-2 py-1 text-xs text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-500"
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <CeoSelect
                                    record={record}
                                    onSave={handleCeoChange}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <ReminderCell
                                    record={record}
                                    onForward={handleForwardToCeo}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <PhotosCell record={record} />
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-right">
                                  <button
                                    onClick={() => handleNcrPdf(record)}
                                    disabled={pdfBusy === record.id}
                                    className={`mr-2 ${pdfButtonClass}`}
                                  >
                                    {pdfBusy === record.id ? "..." : "PDF"}
                                  </button>
                                  <button
                                    onClick={() => openEdit(record)}
                                    className={`mr-2 ${pdfButtonClass}`}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(record)}
                                    className={pdfButtonClass}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex flex-col gap-3 p-4 lg:hidden">
                        {group.records.map((record) => (
                          <div
                            key={record.id}
                            className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                          >
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-zinc-50">
                                {record.ncr_number || "NCR"}
                              </p>
                              <StatusBadge
                                status={record.status}
                                onChange={(value) =>
                                  handleStatusChange(record, value)
                                }
                              />
                            </div>
                            <dl>
                              <div className="border-t border-zinc-800/50 py-2">
                                <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                  Description
                                </dt>
                                <dd className="mt-0.5 break-words text-xs text-zinc-300">
                                  {record.description || "—"}
                                </dd>
                              </div>
                              <div className="border-t border-zinc-800/50 py-2">
                                <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                  Clause
                                </dt>
                                <dd className="mt-0.5 break-words text-xs text-zinc-300">
                                  {record.clause || "—"}
                                </dd>
                              </div>
                              <div className="border-t border-zinc-800/50 py-2">
                                <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                  Opening
                                </dt>
                                <dd className="mt-0.5 text-xs text-zinc-300">
                                  {formatExcelDate(record.opening_ncs) || "—"}
                                </dd>
                              </div>
                              <div className="border-t border-zinc-800/50 py-2">
                                <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                  Closing
                                </dt>
                                <dd className="mt-0.5 text-xs text-zinc-300">
                                  {formatExcelDate(record.closing_ncs) || "—"}
                                </dd>
                              </div>
                              <div className="border-t border-zinc-800/50 py-2">
                                <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                  Priority
                                </dt>
                                <dd className="mt-1">
                                  <PrioritySelect
                                    record={record}
                                    onSave={handlePriorityChange}
                                  />
                                </dd>
                              </div>
                              <div className="border-t border-zinc-800/50 py-2">
                                <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                  Branch Manager Timeline
                                </dt>
                                <dd className="mt-0.5">
                                  <TimelineCell record={record} />
                                </dd>
                              </div>
                              <div className="border-t border-zinc-800/50 py-2">
                                <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                  Comments from BM
                                </dt>
                                <dd className="mt-1">
                                  <input
                                    key={record.id}
                                    defaultValue={record.branch_manager_comments ?? ""}
                                    placeholder="Comments..."
                                    onBlur={(e) =>
                                      handleCommentsBlur(record, e.target.value)
                                    }
                                    className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                                  />
                                </dd>
                              </div>
                              <div className="border-t border-zinc-800/50 py-2">
                                <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                  Reported to CEO
                                </dt>
                                <dd className="mt-1">
                                  <CeoSelect
                                    record={record}
                                    onSave={handleCeoChange}
                                  />
                                </dd>
                              </div>
                              <div className="border-t border-zinc-800/50 py-2">
                                <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                  Reminder
                                </dt>
                                <dd className="mt-1">
                                  <ReminderCell
                                    record={record}
                                    onForward={handleForwardToCeo}
                                  />
                                </dd>
                              </div>
                              <div className="border-t border-zinc-800/50 py-2">
                                <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                  Photos
                                </dt>
                                <dd className="mt-1">
                                  <PhotosCell record={record} />
                                </dd>
                              </div>
                            </dl>
                            <div className="mt-3 flex justify-end gap-2">
                              <button
                                onClick={() => handleNcrPdf(record)}
                                disabled={pdfBusy === record.id}
                                className={pdfButtonClass}
                              >
                                {pdfBusy === record.id ? "Preparing..." : "PDF"}
                              </button>
                              <button
                                onClick={() => openEdit(record)}
                                className={pdfButtonClass}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(record)}
                                className={pdfButtonClass}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Modal
        open={modalOpen}
        title={editingId ? "Edit NCR" : "Create NCR"}
        onClose={closeModal}
        wide
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label
                key={f.key}
                className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300"
              >
                {f.label}
                {f.type === "select" || f.key === "status" ? (
                  <select
                    value={form[f.key]}
                    onChange={(e) => setField(f.key, e.target.value)}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {(f.type === "select" ? f.options ?? [] : STATUS_OPTIONS).map(
                      (o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ),
                    )}
                  </select>
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    value={form[f.key]}
                    onChange={(e) => setField(f.key, e.target.value)}
                    className={inputClass}
                  />
                )}
              </label>
            ))}
          </div>
          {error && (
            <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="mt-2 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-100 transition-all duration-300 hover:bg-zinc-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Save Changes" : "Create NCR"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
