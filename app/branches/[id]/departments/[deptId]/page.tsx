"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import Modal from "@/components/Modal";
import Header from "@/components/Header";
import StatsTile from "@/components/StatsTile";
import StatusBadge from "@/components/StatusBadge";
import {
  FIELDS,
  NcrRecord,
  exportNcrToXlsx,
  formatDisplayValue,
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
  const [search, setSearch] = useState("");
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
    "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-300";

  const query = search.trim().toLowerCase();
  const filteredRecords = query
    ? records.filter((record) =>
        Object.entries(record).some(([key, value]) => {
          if (key === "id" || key === "department_id" || value == null) {
            return false;
          }
          return String(value).toLowerCase().includes(query);
        }),
      )
    : records;

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

        <div className="lg:hidden">
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
            filteredRecords.map((record) => (
              <div
                key={record.id}
                className="mb-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-50">
                    {record.ncr_number || "NCR"}
                  </p>
                  <StatusBadge status={record.status} />
                </div>
                <dl>
                  {FIELDS.filter((f) => f.key !== "status").map((f) => (
                    <div
                      key={f.key}
                      className="border-t border-zinc-800/50 py-2"
                    >
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                        {f.label}
                      </dt>
                      <dd className="mt-0.5 break-words text-xs text-zinc-300">
                        {record[f.key as keyof NcrRecord] == null
                          ? "\u2014"
                          : formatDisplayValue(
                              f.key,
                              record[f.key as keyof NcrRecord],
                            )}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => openEdit(record)}
                    className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(record)}
                    className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden rounded-xl border border-zinc-800 bg-zinc-950/60 lg:block">
          <table className="w-full table-fixed border-collapse text-left text-xs">
            <colgroup>
              {FIELDS.map((f) => (
                <col key={f.key} />
              ))}
              <col className="w-28" />
            </colgroup>
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                {FIELDS.map((f) => (
                  <th
                    key={f.key}
                    className="break-words px-1.5 py-2 align-top text-[10px] font-semibold uppercase tracking-wide text-zinc-400"
                  >
                    {f.label}
                  </th>
                ))}
                <th className="px-1.5 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
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
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={FIELDS.length + 1}
                    className="px-3 py-8 text-center text-zinc-500"
                  >
                    No records match &quot;{search}&quot;.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-zinc-800/60 transition-colors hover:bg-zinc-900/40"
                  >
                    {FIELDS.map((f) => (
                      <td
                        key={f.key}
                        className="break-words px-1.5 py-2 align-top text-zinc-300"
                      >
                        {f.key === "status" ? (
                          <StatusBadge
                            status={record.status}
                          />
                        ) : record[f.key as keyof NcrRecord] == null ? (
                          ""
                        ) : (
                          formatDisplayValue(
                            f.key,
                            record[f.key as keyof NcrRecord],
                          )
                        )}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-1.5 py-2 text-right">
                      <button
                        onClick={() => openEdit(record)}
                        className="mr-2 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(record)}
                        className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
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
