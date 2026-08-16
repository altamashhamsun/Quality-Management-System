"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import Header from "@/components/Header";

type SettingsRow = {
  id: number;
  owner_name: string;
  secondary_email: string | null;
  public_ncrs: boolean;
  public_performances: boolean;
  public_calendar: boolean;
  public_audit: boolean;
  public_hasm: boolean;
};

const PUBLIC_TOGGLES = [
  { key: "public_ncrs", label: "NCR Records", path: "/public/ncrs" },
  { key: "public_performances", label: "Performances", path: "/public/performances" },
  { key: "public_calendar", label: "Calendar", path: "/public/calendar" },
  { key: "public_audit", label: "Audit", path: "/public/audit" },
  { key: "public_hasm", label: "HASM", path: "/public/hasm" },
] as const;

type ToggleKey = (typeof PUBLIC_TOGGLES)[number]["key"];

export default function SettingsPage() {
  const { loading } = useAuth();
  const [dataLoading, setDataLoading] = useState(true);
  const [ownerName, setOwnerName] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    public_ncrs: true,
    public_performances: true,
    public_calendar: true,
    public_audit: true,
    public_hasm: true,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    supabase
      .from("settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data: row, error }) => {
        setDataLoading(false);
        if (!error && row) {
          const settings = row as SettingsRow;
          setOwnerName(settings.owner_name);
          setSecondaryEmail(settings.secondary_email ?? "");
          setToggles({
            public_ncrs: settings.public_ncrs,
            public_performances: settings.public_performances,
            public_calendar: settings.public_calendar,
            public_audit: settings.public_audit,
            public_hasm: settings.public_hasm,
          });
        }
      });
  }, [loading]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("settings")
      .update({
        owner_name: ownerName.trim(),
        secondary_email: secondaryEmail.trim() || null,
        public_ncrs: toggles.public_ncrs,
        public_performances: toggles.public_performances,
        public_calendar: toggles.public_calendar,
        public_audit: toggles.public_audit,
        public_hasm: toggles.public_hasm,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      setMessage({ type: "error", text: `Could not save: ${error.message}` });
    } else {
      setMessage({ type: "ok", text: "Settings saved." });
    }
  }

  return (
    <div className="min-h-full bg-[#050507] font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-zinc-50">Settings</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Owner profile and which public pages visitors may see
          </p>
        </div>

        {dataLoading ? (
          <p className="text-sm text-zinc-500">Loading settings...</p>
        ) : (
          <div className="flex flex-col gap-6">
            <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Owner Profile
              </h3>
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-zinc-300">Owner name</span>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. QA Manager"
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-zinc-400"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-zinc-300">Secondary email</span>
                  <input
                    type="email"
                    value={secondaryEmail}
                    onChange={(e) => setSecondaryEmail(e.target.value)}
                    placeholder="optional"
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-zinc-400"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Public Pages
              </h3>
              <p className="mb-4 text-xs text-zinc-500">
                Toggle which pages are visible to visitors (no login required).
              </p>
              <div className="flex flex-col">
                {PUBLIC_TOGGLES.map((t) => {
                  const enabled = toggles[t.key];
                  return (
                    <div
                      key={t.key}
                      className="flex items-center justify-between gap-3 border-b border-zinc-800/70 py-3 last:border-b-0"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm text-zinc-200">{t.label}</span>
                        <span className="text-xs text-zinc-500">{t.path}</span>
                      </div>
                      <button
                        onClick={() =>
                          setToggles((prev) => ({ ...prev, [t.key]: !prev[t.key] }))
                        }
                        aria-label={`Toggle ${t.label}`}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                          enabled ? "bg-zinc-100" : "bg-zinc-700"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-zinc-950 transition-all ${
                            enabled ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg border border-zinc-600 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {message && (
                <span
                  className={`text-sm ${
                    message.type === "ok" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {message.text}
                </span>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
