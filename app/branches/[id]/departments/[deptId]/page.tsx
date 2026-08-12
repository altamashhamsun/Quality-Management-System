"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";

type NcrRecord = {
  id: string;
  ncr_number: string | null;
  description: string | null;
  branch: string | null;
  clause: string | null;
  opening_ncs: number | null;
  closing_ncs: number | null;
  recommendations: string | null;
  status: string | null;
  hod_name: string | null;
  hod_comments: string | null;
  branch_manager: string | null;
  branch_manager_comments: string | null;
  hr: string | null;
  hr_comments: string | null;
  ceo: string | null;
  ceo_comments: string | null;
};

const FIELDS: { key: string; label: string; type?: "number" }[] = [
  { key: "ncr_number", label: "NCR #" },
  { key: "description", label: "Description" },
  { key: "branch", label: "Branch" },
  { key: "clause", label: "Clause" },
  { key: "opening_ncs", label: "Opening NCs", type: "number" },
  { key: "closing_ncs", label: "Closing NCs", type: "number" },
  { key: "recommendations", label: "Recommendations" },
  { key: "status", label: "Status" },
  { key: "hod_name", label: "Head of Department/Manager/Supervisor" },
  { key: "hod_comments", label: "Comments from Head of Department/Manager/Supervisor" },
  { key: "branch_manager", label: "Branch Manager" },
  { key: "branch_manager_comments", label: "Comments from Branch Manager" },
  { key: "hr", label: "HR" },
  { key: "hr_comments", label: "Comments from HR" },
  { key: "ceo", label: "CEO" },
  { key: "ceo_comments", label: "Comments from CEO" },
];

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
  const [form, setForm] = useState<Record<string, string>>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function startEdit(record: NcrRecord) {
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
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
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

    resetForm();
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

  const inputClass =
    "w-full min-w-36 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-50 outline-none transition-colors placeholder:text-zinc-600 focus:border-cyan-400/60";

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
        <div className="mb-8">
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

        {error && (
          <p className="mb-4 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/60">
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
                    No NCR records yet. Use the row below to add one.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-zinc-800/60 transition-colors hover:bg-zinc-900/40"
                  >
                    {FIELDS.map((f) => (
                      <td key={f.key} className="whitespace-nowrap px-3 py-2 text-zinc-300">
                        {record[f.key as keyof NcrRecord] == null
                          ? ""
                          : String(record[f.key as keyof NcrRecord])}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        onClick={() => startEdit(record)}
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

          <form
            onSubmit={handleSave}
            className="border-t-2 border-cyan-400/40 bg-zinc-900/40"
          >
            <div className="flex items-center gap-3 p-3">
              {FIELDS.map((f) => (
                <input
                  key={f.key}
                  type={f.type === "number" ? "number" : "text"}
                  value={form[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.label}
                  className={inputClass}
                />
              ))}
              <div className="flex flex-col gap-1 self-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg border-2 border-cyan-400/60 px-4 py-1.5 text-sm font-medium text-cyan-300 transition-all duration-300 hover:bg-cyan-400/10 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Add"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs text-zinc-300 transition-colors hover:text-zinc-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
