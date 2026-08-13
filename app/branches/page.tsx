"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import NeonTile from "@/components/NeonTile";
import Modal from "@/components/Modal";
import Header from "@/components/Header";

type Branch = { id: string; name: string; created_at: string };

export default function BranchesPage() {
  const router = useRouter();
  const { email, loading } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("branches")
      .select("id, name, created_at")
      .order("created_at", { ascending: true });

    if (!error) setBranches(data ?? []);
    setDataLoading(false);
  }, []);

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

  function openEdit(branch: Branch) {
    setEditing(branch);
    setName(branch.name);
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
        .from("branches")
        .update({ name: trimmed })
        .eq("id", editing.id);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("branches").insert({ name: trimmed });
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

  async function handleDelete(branch: Branch) {
    if (!confirm(`Delete branch "${branch.name}"? This will delete its departments too.`)) return;

    const { error } = await supabase.from("branches").delete().eq("id", branch.id);
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
      <Header email={email} />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="neon-text-violet text-xl font-semibold">Branches</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Manage your compliance branches and their departments
            </p>
          </div>
          <button
            onClick={openCreate}
            className="rounded-lg border-2 border-cyan-400/60 px-4 py-2 text-sm font-medium text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all duration-300 hover:bg-cyan-400/10 hover:shadow-[0_0_25px_rgba(34,211,238,0.4)]"
          >
            + Create Branch
          </button>
        </div>

        {dataLoading ? (
          <p className="text-sm text-zinc-500">Loading branches...</p>
        ) : branches.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No branches yet. Click &quot;Create Branch&quot; to get started.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch, i) => (
              <NeonTile
                key={branch.id}
                name={branch.name}
                subtitle={`Branch · ${new Date(branch.created_at).toLocaleDateString()}`}
                color={(["cyan", "pink", "violet"] as const)[i % 3]}
                onClick={() => router.push(`/branches/${branch.id}`)}
                actions={
                  <>
                    <button
                      onClick={() => openEdit(branch)}
                      className={actionBtn}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(branch)}
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
        title={editing ? "Edit Branch" : "Create Branch"}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
            Branch Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Downtown Branch"
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
            {saving ? "Saving..." : editing ? "Save Changes" : "Create"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
