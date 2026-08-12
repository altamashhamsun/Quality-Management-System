"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import NeonTile from "@/components/NeonTile";
import Modal from "@/components/Modal";

type Department = { id: string; name: string; created_at: string };

export default function DepartmentsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { loading } = useAuth();
  const [branchName, setBranchName] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const branchId = params.id;

    const branchResult = await supabase
      .from("branches")
      .select("name")
      .eq("id", branchId)
      .maybeSingle();
    if (branchResult.data) setBranchName(branchResult.data.name);

    const { data } = await supabase
      .from("departments")
      .select("id, name, created_at")
      .eq("branch_id", branchId)
      .order("created_at", { ascending: true });

    setDepartments(data ?? []);
    setDataLoading(false);
  }, [params.id]);

  useEffect(() => {
    if (loading) return;
    (async () => {
      await load();
    })();
  }, [loading, load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setError(null);
    setModalOpen(true);
  }

  function openEdit(dept: Department) {
    setEditing(dept);
    setName(dept.name);
    setError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    const trimmed = name.trim();

    if (editing) {
      const { error } = await supabase
        .from("departments")
        .update({ name: trimmed })
        .eq("id", editing.id);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from("departments")
        .insert({ branch_id: params.id, name: trimmed });
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete(dept: Department) {
    if (!confirm(`Delete department "${dept.name}"?`)) return;

    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", dept.id);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  const actionBtn =
    "rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-cyan-400/60 hover:text-cyan-300";

  return (
    <div className="min-h-full bg-[#050507] font-sans">
      <header className="flex items-center justify-between border-b border-zinc-800/80 px-6 py-4">
        <h1 className="neon-text-cyan text-2xl font-bold tracking-tight">
          Compliance IOS
        </h1>
        <button
          onClick={() => supabase.auth.signOut().then(() => router.replace("/"))}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-pink-500/60 hover:text-pink-400"
        >
          Sign Out
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/branches")}
              className="mb-2 text-sm text-zinc-500 transition-colors hover:text-cyan-300"
            >
              &larr; Back to Branches
            </button>
            <h2 className="neon-text-violet text-xl font-semibold">
              {dataLoading ? "..." : branchName ?? "Branch"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Manage departments in this branch
            </p>
          </div>
          <button
            onClick={openCreate}
            className="rounded-lg border-2 border-cyan-400/60 px-4 py-2 text-sm font-medium text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all duration-300 hover:bg-cyan-400/10 hover:shadow-[0_0_25px_rgba(34,211,238,0.4)]"
          >
            + Add Department
          </button>
        </div>

        {dataLoading ? (
          <p className="text-sm text-zinc-500">Loading departments...</p>
        ) : departments.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No departments yet. Click &quot;Add Department&quot; to get started.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept, i) => (
              <NeonTile
                key={dept.id}
                name={dept.name}
                subtitle={`Department · ${new Date(dept.created_at).toLocaleDateString()}`}
                color={(["pink", "violet", "cyan"] as const)[i % 3]}
                onClick={() =>
                  router.push(`/branches/${params.id}/departments/${dept.id}`)
                }
                actions={
                  <>
                    <button
                      onClick={() => openEdit(dept)}
                      className={actionBtn}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(dept)}
                      className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-red-500/60 hover:text-red-400"
                    >
                      Delete
                    </button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </main>

      <Modal
        open={modalOpen}
        title={editing ? "Edit Department" : "Add Department"}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
            Department Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. HR, Finance, IT"
              autoFocus
              required
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none transition-colors placeholder:text-zinc-600 focus:border-cyan-400/60"
            />
          </label>
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
            {saving ? "Saving..." : editing ? "Save Changes" : "Add"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
