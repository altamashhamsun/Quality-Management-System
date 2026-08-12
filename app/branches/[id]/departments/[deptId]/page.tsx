"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import Modal from "@/components/Modal";
import {
  FIELDS,
  NcrRecord,
  exportNcrToXlsx,
  parseNcrFile,
} from "@/lib/ncr";

const NUMBER_FIELDS = new Set(["opening_ncs", "closing_ncs"]);

const emptyForm = () =>
  Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Record<string, string>;

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

    setRecords(data ?? []);
    setDataLoading(false);
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

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
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
        rows.map((row) => ({ department_id: params.deptId, ...row })),
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
    "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none transition-colors placeholder:text-zinc-600 focus:border-cyan-400/60";

  return (
    <div className="min-h-full bg-[#050507] font-sans">
      <header className="flex items-center justify-between border-b border-zinc-800/80 px-6 py-4">
        <h1 className="neon-text-cyan text-2xl font-bold tracking-tight">
          Compliance IOS
        </h1>
        <button
          onClick={() =>
            supabase.auth.signOut().then(() => router.replace("/"))
          }
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-pink-500/60 hover:text-pink-400"
        >
          Sign Out
        </button>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <button
              onClick={() => router.push(`/branches/${params.id}`)}
              className="mb-2 text-sm text-zinc-500 transition-colors hover:text-cyan-300"
            >
              &larr; Back to Departments
            </button>
            <h2 className="neon-text-violet text-xl font-semibold">
              {dataLoading ? "..." : deptName ?? "Department"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Non-Conformance Report (NCR) records
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              disabled={records.length === 0}
              className="rounded-lg border-2 border-pink-500/60 px-4 py-2 text-sm font-medium text-pink-400 shadow-[0_0_15px_rgba(244,114,182,0.2)] transition-all duration-300 hover:bg-pink-500/10 hover:shadow-[0_0_25px_rgba(244,114,182,0.4)] disabled:opacity-40"
            >
              Export XLSX
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="rounded-lg border-2 border-violet-500/60 px-4 py-2 text-sm font-medium text-violet-400 shadow-[0_0_15px_rgba(167,139,250,0.2)] transition-all duration-300 hover:bg-violet-500/10 hover:shadow-[0_0_25px_rgba(167,139,250,0.4)] disabled:opacity-40"
            >
              {importing ? "Importing..." : "Import XLSX"}
            </button>
            <button
              onClick={openCreate}
              className="rounded-lg border-2 border-cyan-400/60 px-4 py-2 text-sm font-medium text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all duration-300 hover:bg-cyan-400/10 hover:shadow-[0_0_25px_rgba(34,211,238,0.4)]"
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

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60">
          <table className="w-full min-w-max border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                {FIELDS.map((f) => (
                  <th
                    key={f.key}
                    className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-cyan-300"
                  >
                    {f.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-cyan-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {dataLoading ? (
                <tr>
                  <td
                    colSpan={FIELDS.length + 1}
                    className="px-3 py-8 text-center text-zinc-500"
                  >
                    Loading records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td
                    colSpan={FIELDS.length + 1}
                    className="px-3 py-8 text-center text-zinc-500"
                  >
                    No NCR records yet. Click &quot;Create NCR&quot; to add one.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-zinc-800/60 transition-colors hover:bg-zinc-900/40"
                  >
                    {FIELDS.map((f) => (
                      <td
                        key={f.key}
                        className="whitespace-nowrap px-3 py-2 text-zinc-300"
                      >
                        {record[f.key as keyof NcrRecord] == null
                          ? ""
                          : String(record[f.key as keyof NcrRecord])}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        onClick={() => openEdit(record)}
                        className="mr-2 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-cyan-400/60 hover:text-cyan-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(record)}
                        className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-red-500/60 hover:text-red-400"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={form[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
          {error && (
            <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="mt-2 rounded-lg bg-cyan-400/20 px-4 py-2.5 text-sm font-medium text-cyan-300 transition-all duration-300 hover:bg-cyan-400/30 disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Save Changes" : "Create NCR"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
