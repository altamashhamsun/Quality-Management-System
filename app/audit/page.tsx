"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import Header from "@/components/Header";
import Modal from "@/components/Modal";

type AuditDocument = {
  id: string;
  category: "plan" | "report" | "capa";
  title: string;
  description: string | null;
  created_at: string;
};

const TABS = [
  { key: "plan", label: "Audit Plans", activeClass: "border-zinc-300 bg-zinc-100 text-zinc-950" },
  { key: "report", label: "Audit Reports", activeClass: "border-zinc-300 bg-zinc-100 text-zinc-950" },
  { key: "capa", label: "Corrective & Preventive Action", activeClass: "border-zinc-300 bg-zinc-100 text-zinc-950" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AuditPage() {
  const { loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("plan");
  const [documents, setDocuments] = useState<AuditDocument[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AuditDocument | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("audit_documents")
      .select("id, category, title, description, created_at")
      .order("created_at", { ascending: true });
    if (!error) setDocuments(data ?? []);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    (async () => {
      await load();
    })();
  }, [loading, load]);

  const activeDocuments = documents.filter((doc) => doc.category === activeTab);

  function openCreate() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setError(null);
    setModalOpen(true);
  }

  function openEdit(doc: AuditDocument) {
    setEditing(doc);
    setTitle(doc.title);
    setDescription(doc.description ?? "");
    setError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setError(null);

    const payload = {
      category: activeTab,
      title: title.trim(),
      description: description.trim() === "" ? null : description.trim(),
    };

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

  return (
    <div className="min-h-full bg-[#050507] font-sans">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-50">Audit</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Manage audit plans, audit reports, and corrective & preventive actions
            </p>
          </div>
          <button
            onClick={openCreate}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors duration-300 hover:border-zinc-300 hover:bg-zinc-800"
          >
            + Add {TABS.find((t) => t.key === activeTab)?.label.replace(/s$/, "")}
          </button>
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
                <span className="ml-2 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {dataLoading ? (
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
                    {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="min-h-10 text-xs leading-relaxed text-zinc-400">
                  {doc.description ?? "\u2014"}
                </p>
                <div className="mt-3 flex justify-end gap-2">
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
                  : activeTab === "report"
                    ? "e.g. Q3 Audit Report"
                    : "e.g. CAPA-001: Corrective action for found NC"
              }
              autoFocus
              required
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-300"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details, scope, findings, or actions"
              rows={4}
              className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-300"
            />
          </label>
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
    </div>
  );
}
