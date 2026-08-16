"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import Header from "@/components/Header";
import Modal from "@/components/Modal";
import RichTextEditor from "@/components/RichTextEditor";
import AuditorTab from "./AuditorTab";
import AuditReportTab from "./AuditReportTab";

// The page is driven by query params (tab=auditor, branch, dept) so a
// specific view can be deep-linked. The content that reads searchParams is
// wrapped in a Suspense boundary so the route can be statically prerendered
// (see the useSearchParams docs).

type AuditDocument = {
  id: string;
  category: "plan" | "report" | "capa";
  title: string;
  description: string | null;
  content: Record<string, string> | null;
  start_date: string | null;
  end_date: string | null;
  department_ids: string[];
  plan_id: string | null;
  created_at: string;
};

const TABS = [
  { key: "plan", label: "Audit Plans", activeClass: "border-zinc-300 bg-zinc-100 text-zinc-950" },
  { key: "capa", label: "Corrective & Preventive Action", activeClass: "border-zinc-300 bg-zinc-100 text-zinc-950" },
  { key: "auditor", label: "Auditor", activeClass: "border-zinc-300 bg-zinc-100 text-zinc-950" },
  { key: "auditReport", label: "Audit Report", activeClass: "border-zinc-300 bg-zinc-100 text-zinc-950" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const PLAN_SECTIONS: { key: string; label: string }[] = [
  { key: "objectives", label: "Objectives" },
  { key: "scope", label: "Scope" },
  { key: "criteria", label: "Criteria" },
  { key: "risk_assessment", label: "Risk Assessment" },
  { key: "procedures", label: "Procedures" },
  { key: "timeline", label: "Timeline" },
  { key: "team_resources", label: "Team & Resources" },
];

const emptySections = () =>
  Object.fromEntries(PLAN_SECTIONS.map((s) => [s.key, ""])) as Record<string, string>;

const DRAFT_KEY = "auditPlanDraft";

type PlanDraft = {
  id: string | null;
  title: string;
  description: string;
  sections: Record<string, string>;
  startDate: string;
  endDate: string;
  department_ids: string[];
};

function readDraft(): PlanDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlanDraft;
  } catch {
    return null;
  }
}

type PlanDepartment = {
  id: string;
  name: string;
  branches: { name: string } | { name: string }[] | null;
};

function htmlToText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? "";
}

export default function AuditPage() {
  return (
    <Suspense fallback={null}>
      <AuditContent />
    </Suspense>
  );
}

function AuditContent() {
  const { loading } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const branchParam = searchParams.get("branch");
  const deptParam = searchParams.get("dept");
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    tabParam === "auditor" ? "auditor" : "plan",
  );
  // Follow the voice assistant's tab requests in the URL. Track the full query
  // string so a fresh request (new nonce) still lands on the auditor tab even
  // when tab=auditor is already present. This is a render-time adjustment, not
  // an effect, so manual tab clicks afterwards aren't overridden.
  const [lastQuery, setLastQuery] = useState(() => searchParams.toString());
  const query = searchParams.toString();
  if (query !== lastQuery) {
    setLastQuery(query);
    if (tabParam === "auditor") setActiveTab("auditor");
  }
  const [documents, setDocuments] = useState<AuditDocument[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AuditDocument | null>(null);
  const [viewing, setViewing] = useState<AuditDocument | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<Record<string, string>>(emptySections());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<PlanDepartment[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("audit_documents")
      .select(
        "id, category, title, description, content, start_date, end_date, department_ids, plan_id, created_at",
      )
      .order("created_at", { ascending: true });
    if (!error) setDocuments(data ?? []);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    (async () => {
      const depts = await supabase
        .from("departments")
        .select("id, name, branches(name)");
      if (!depts.error) setDepartments(depts.data ?? []);
      await load();
    })();
  }, [loading, load]);

  // Autosave the audit plan form as a local draft so closing the window or
  // refreshing mid-edit never loses the work. Restored on the next open.
  useEffect(() => {
    if (!modalOpen || activeTab !== "plan") return;
    const draft: PlanDraft = {
      id: editing?.id ?? null,
      title,
      description,
      sections,
      startDate,
      endDate,
      department_ids: selectedDepts,
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [modalOpen, activeTab, editing, title, description, sections, startDate, endDate, selectedDepts]);

  const activeDocuments = documents.filter((doc) => doc.category === activeTab);

  const departmentsByBranch = useMemo(() => {
    const groups: { branch: string; items: PlanDepartment[] }[] = [];
    const map = new Map<string, PlanDepartment[]>();
    for (const dept of departments) {
      const branch = Array.isArray(dept.branches)
        ? (dept.branches[0]?.name ?? "Other")
        : (dept.branches?.name ?? "Other");
      if (!map.has(branch)) map.set(branch, []);
      map.get(branch)!.push(dept);
    }
    for (const [branch, items] of map) groups.push({ branch, items });
    return groups;
  }, [departments]);

  const deptName = useMemo(() => {
    const map = new Map(departments.map((d) => [d.id, d.name]));
    return (id: string) => map.get(id) ?? "Unknown";
  }, [departments]);

  function toggleDept(id: string) {
    setSelectedDepts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }

  function formatDateRange(doc: AuditDocument): string {
    if (!doc.start_date || !doc.end_date) return "";
    const opts: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "short",
      year: "numeric",
    };
    return `${new Date(doc.start_date + "T00:00:00").toLocaleDateString(undefined, opts)} — ${new Date(doc.end_date + "T00:00:00").toLocaleDateString(undefined, opts)}`;
  }

  function openCreate() {
    setEditing(null);
    const draft = readDraft();
    setTitle(draft?.title ?? "");
    setDescription(draft?.description ?? "");
    setSections({ ...emptySections(), ...(draft?.sections ?? {}) });
    setStartDate(draft?.startDate ?? "");
    setEndDate(draft?.endDate ?? "");
    setSelectedDepts(draft?.department_ids ?? []);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(doc: AuditDocument) {
    setEditing(doc);
    const draft = readDraft();
    if (draft && draft.id === doc.id) {
      setTitle(draft.title);
      setDescription(draft.description);
      setSections({ ...emptySections(), ...draft.sections });
      setStartDate(draft.startDate);
      setEndDate(draft.endDate);
      setSelectedDepts(draft.department_ids ?? []);
    } else {
      setTitle(doc.title);
      setDescription(doc.description ?? "");
      setSections({ ...emptySections(), ...(doc.content ?? {}) });
      setStartDate(doc.start_date ?? "");
      setEndDate(doc.end_date ?? "");
      setSelectedDepts(doc.department_ids ?? []);
    }
    setError(null);
    setModalOpen(true);
  }

  function setSection(key: string, html: string) {
    setSections((prev) => ({ ...prev, [key]: html }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setError(null);

    let payload: {
      category: TabKey;
      title: string;
      description: string | null;
      content: Record<string, string> | null;
      start_date?: string | null;
      end_date?: string | null;
      department_ids?: string[];
    };

    if (activeTab === "plan") {
      const summary = PLAN_SECTIONS.map((s) => {
        const text = htmlToText(sections[s.key]).trim();
        return text ? `${s.label}: ${text}` : "";
      })
        .filter(Boolean)
        .join("\n");
      payload = {
        category: activeTab,
        title: title.trim(),
        description: summary === "" ? null : summary,
        content: sections,
        start_date: startDate || null,
        end_date: endDate || null,
        department_ids: selectedDepts,
      };
    } else {
      payload = {
        category: activeTab,
        title: title.trim(),
        description: description.trim() === "" ? null : description.trim(),
        content: null,
      };
    }

    let result;
    if (editing) {
      result = await supabase
        .from("audit_documents")
        .update(payload)
        .eq("id", editing.id);
    } else {
      result = await supabase.from("audit_documents").insert(payload);
    }

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setModalOpen(false);
    window.localStorage.removeItem(DRAFT_KEY);
    load();
  }

  async function handleDelete(doc: AuditDocument) {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    const { error } = await supabase
      .from("audit_documents")
      .delete()
      .eq("id", doc.id);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  const inputClass =
    "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-300";

  return (
    <div className="min-h-full bg-[#050507] font-sans">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-50">Audit</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Manage audit plans, corrective & preventive actions, and generate audit reports
            </p>
          </div>
          {activeTab !== "auditor" && activeTab !== "auditReport" && (
            <button
              onClick={openCreate}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors duration-300 hover:border-zinc-300 hover:bg-zinc-800"
            >
              + Add {TABS.find((t) => t.key === activeTab)?.label.replace(/s$/, "")}
            </button>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            const count = documents.filter((doc) => doc.category === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-300 ${
                  active
                    ? `${tab.activeClass}`
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
              >
                {tab.label}
                {tab.key !== "auditor" && tab.key !== "auditReport" && (
                  <span className="ml-2 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-500">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === "auditor" ? (
          <AuditorTab branchId={branchParam} deptId={deptParam} />
        ) : activeTab === "auditReport" ? (
          <AuditReportTab />
        ) : dataLoading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : activeDocuments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-12 text-center text-sm text-zinc-500">
            No {TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} yet. Click
            &quot;Add&quot; to create one.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeDocuments.map((doc) => (
              <div
                key={doc.id}
                className="group rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/40"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-zinc-50">
                    {doc.title}
                  </h3>
                  <span className="shrink-0 rounded bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                    {doc.category === "plan" && doc.start_date
                      ? formatDateRange(doc)
                      : new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
                {doc.category === "plan" && doc.department_ids.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {doc.department_ids.map((id) => (
                      <span
                        key={id}
                        className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400"
                      >
                        {deptName(id)}
                      </span>
                    ))}
                  </div>
                )}
                <p className="min-h-10 whitespace-pre-line text-xs leading-relaxed text-zinc-400">
                  {doc.description ?? "\u2014"}
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => setViewing(doc)}
                    className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
                  >
                    View
                  </button>
                  <button
                    onClick={() => openEdit(doc)}
                    className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(doc)}
                    className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Modal
        open={modalOpen}
        title={editing ? "Edit Document" : "Add Document"}
        onClose={() => setModalOpen(false)}
        xwide={activeTab === "plan"}
        wide={activeTab !== "plan"}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                activeTab === "plan"
                  ? "e.g. Q3 Internal Audit Plan"
                  : "e.g. CAPA-001: Corrective action for found NC"
              }
              autoFocus
              required
              className={inputClass}
            />
          </label>

          {activeTab === "plan" ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                  Audit Start Date
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (endDate && endDate < e.target.value) setEndDate(e.target.value);
                    }}
                    className={`${inputClass} [color-scheme:dark]`}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
                  Audit End Date
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || undefined}
                    className={`${inputClass} [color-scheme:dark]`}
                  />
                </label>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Departments to audit
                </p>
                {departmentsByBranch.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    No departments found. Add departments under Branches first.
                  </p>
                ) : (
                  <div className="flex max-h-48 flex-col gap-4 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                    {departmentsByBranch.map((group) => (
                      <div key={group.branch}>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          {group.branch}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {group.items.map((dept) => {
                            const selected = selectedDepts.includes(dept.id);
                            return (
                              <button
                                type="button"
                                key={dept.id}
                                onClick={() => toggleDept(dept.id)}
                                className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                                  selected
                                    ? "border-zinc-200 bg-zinc-100 text-zinc-950"
                                    : "border-zinc-700 text-zinc-300 hover:border-zinc-400 hover:text-white"
                                }`}
                              >
                                {dept.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {PLAN_SECTIONS.map((section) => (
                <div key={section.key} className="flex flex-col gap-1.5">
                  <p className="text-sm font-semibold text-zinc-200">
                    {section.label}
                  </p>
                  <RichTextEditor
                    value={sections[section.key]}
                    onChange={(html) => setSection(section.key, html)}
                    placeholder={`Write ${section.label.toLowerCase()}...`}
                    minHeight="7rem"
                  />
                </div>
              ))}
            </div>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details, scope, findings, or actions"
                rows={4}
                className={`${inputClass} resize-none`}
              />
            </label>
          )}

          <p className="rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-500">
            Category:{" "}
            <span className="font-medium text-zinc-300">
              {TABS.find((t) => t.key === activeTab)?.label}
            </span>
          </p>
          {error && (
            <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
              {error}
            </p>
          )}
          <div className="mt-2 flex gap-3">
            {editing && (
              <button
                type="button"
                onClick={() => handleDelete(editing)}
                className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all duration-300 hover:border-zinc-300 hover:text-white"
              >
                Delete
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-100 transition-all duration-300 hover:bg-zinc-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Save Changes" : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={viewing !== null}
        title={viewing?.title ?? ""}
        onClose={() => setViewing(null)}
        xwide
      >
        {viewing &&
          (viewing.category === "plan" && viewing.content ? (
            <div className="flex flex-col gap-5">
              {PLAN_SECTIONS.map((section) => {
                const html = viewing.content?.[section.key] ?? "";
                return (
                  <div key={section.key}>
                    <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                      {section.label}
                    </h3>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                      {html ? (
                        <div
                          className="prose-xs rte-body text-sm text-zinc-200"
                          dangerouslySetInnerHTML={{ __html: html }}
                        />
                      ) : (
                        <p className="text-sm text-zinc-600">—</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="whitespace-pre-line text-sm text-zinc-300">
              {viewing.description ?? "\u2014"}
            </p>
          ))}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => {
              setViewing(null);
              openEdit(viewing!);
            }}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
          >
            Edit
          </button>
        </div>
      </Modal>
    </div>
  );
}
