"use client";

import { useEffect, useState, useCallback } from "react";
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

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string | null;
  webViewLink: string;
};

type DriveStatus = {
  configured: boolean;
  clientId: boolean;
  clientSecret: boolean;
  refreshToken: boolean;
  folderId: string;
};

type NcrRecord = {
  id: string;
  status: string;
  pictures: string[] | null;
  drive_links: string[] | null;
};

type IncidentRecord = {
  id: string;
  status: string;
  pictures: string[] | null;
  drive_links: string[] | null;
};

type PersistentStatus = {
  branch_id: string;
  item: string;
  question: string;
  resolved: boolean;
};

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
  const [storageInfo, setStorageInfo] = useState<
    { name: string; rowCount: number }[] | null
  >(null);
  const [storageLoading, setStorageLoading] = useState(true);
  const [dbSizeBytes, setDbSizeBytes] = useState<number | null>(null);
  const FREE_TIER_BYTES = 500 * 1024 * 1024;

  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveTotalSize, setDriveTotalSize] = useState(0);
  const [driveLoading, setDriveLoading] = useState(true);
  const [driveDeleting, setDriveDeleting] = useState<string | null>(null);
  const [driveSelected, setDriveSelected] = useState<Set<string>>(new Set());
  const [driveBulkDeleting, setDriveBulkDeleting] = useState(false);
  const [driveFilter, setDriveFilter] = useState<"all" | "resolved" | "unresolved">("all");
  const [driveFileStatusMap, setDriveFileStatusMap] = useState<Map<string, "resolved" | "unresolved" | "unknown">>(new Map());
  const [driveTestUploading, setDriveTestUploading] = useState(false);

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

  const loadDriveData = useCallback(async () => {
    setDriveLoading(true);
    try {
      const [statusRes, listRes] = await Promise.all([
        fetch("/api/drive/status"),
        fetch("/api/drive/list"),
      ]);
      const status = await statusRes.json();
      setDriveStatus(status);
      const list = await listRes.json();
      setDriveFiles(list.files ?? []);
      setDriveTotalSize(list.totalSize ?? 0);

      if (status.configured) {
        const [ncrs, incidents, persistent] = await Promise.all([
          supabase.from("ncr_records").select("id, status, pictures, drive_links"),
          supabase.from("incidents").select("id, status, pictures, drive_links"),
          supabase.from("quality_persistent_status").select("branch_id, item, question, resolved"),
        ]);
        const fileMap = new Map<string, "resolved" | "unresolved" | "unknown">();
        const ncrFiles = (ncrs.data ?? []) as NcrRecord[];
        const incidentFiles = (incidents.data ?? []) as IncidentRecord[];
        const persistentFiles = (persistent.data ?? []) as PersistentStatus[];
        for (const f of list.files ?? []) {
          const allDriveLinks: { links: string[] | null; resolved: boolean }[] = [
            ...ncrFiles.map((n) => ({ links: n.drive_links, resolved: n.status === "closed" })),
            ...incidentFiles.map((i) => ({ links: i.drive_links, resolved: i.status === "closed" })),
          ];
          let matched = false;
          for (const entry of allDriveLinks) {
            if (entry.links?.some((l) => l.includes(f.id))) {
              fileMap.set(f.id, entry.resolved ? "resolved" : "unresolved");
              matched = true;
              break;
            }
          }
          if (!matched) {
            const fname = f.name.toLowerCase();
            if (persistentFiles.some((p) => fname.includes(p.item.toLowerCase().slice(0, 10)))) {
              const pEntry = persistentFiles.find((p) => fname.includes(p.item.toLowerCase().slice(0, 10)));
              fileMap.set(f.id, pEntry?.resolved ? "resolved" : "unresolved");
            } else {
              fileMap.set(f.id, "unknown");
            }
          }
        }
        setDriveFileStatusMap(fileMap);
      }
    } catch {
      setDriveStatus({ configured: false, clientId: false, clientSecret: false, refreshToken: false, folderId: "" });
    }
    setDriveLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) loadDriveData();
  }, [loading, loadDriveData]);

  useEffect(() => {
    if (loading) return;
    (async () => {
      const TABLES = [
        "audit_documents",
        "branches",
        "departments",
        "incidents",
        "incident_log",
        "ncr_records",
        "quality_reports",
        "quality_sessions",
        "quality_descriptions",
        "quality_areas",
        "settings",
      ];
      const [tableResults, sizeResult] = await Promise.all([
        Promise.all(
          TABLES.map(async (name) => {
            const { count } = await supabase
              .from(name)
              .select("*", { count: "exact", head: true });
            return { name, rowCount: count ?? 0 };
          }),
        ),
        supabase.rpc("get_database_size"),
      ]);
      setStorageInfo(tableResults.filter((t) => t.rowCount > 0));
      if (sizeResult.data) setDbSizeBytes(Number(sizeResult.data));
      setStorageLoading(false);
    })();
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

  async function deleteDriveFile(fileId: string) {
    if (!confirm("Delete this file from Google Drive? This cannot be undone.")) return;
    setDriveDeleting(fileId);
    try {
      await fetch("/api/drive/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [fileId] }),
      });
      setDriveFiles((prev) => prev.filter((f) => f.id !== fileId));
      setDriveSelected((prev) => { const next = new Set(prev); next.delete(fileId); return next; });
    } finally {
      setDriveDeleting(null);
    }
  }

  async function bulkDeleteDriveFiles() {
    const ids = Array.from(driveSelected);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} file(s) from Google Drive? This cannot be undone.`)) return;
    setDriveBulkDeleting(true);
    try {
      await fetch("/api/drive/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      setDriveFiles((prev) => prev.filter((f) => !driveSelected.has(f.id)));
      setDriveSelected(new Set());
    } finally {
      setDriveBulkDeleting(false);
    }
  }

  async function testDriveUpload() {
    setDriveTestUploading(true);
    try {
      const testFilename = `test-${Date.now()}.txt`;
      const base64 = btoa("compliance-ios test upload");
      const res = await fetch("/api/drive/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: testFilename, base64, mime: "text/plain" }),
      });
      const data = await res.json();
      if (data.id) {
        await fetch("/api/drive/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [data.id] }),
        });
        setMessage({ type: "ok", text: "Test upload successful — Drive is working." });
      } else {
        setMessage({ type: "error", text: `Test upload failed: ${data.error ?? "unknown error"}` });
      }
    } catch (err) {
      setMessage({ type: "error", text: `Test upload failed: ${err instanceof Error ? err.message : "unknown"}` });
    }
    setDriveTestUploading(false);
  }

  function toggleDriveSelectAll() {
    const filtered = getFilteredDriveFiles();
    if (driveSelected.size === filtered.length) {
      setDriveSelected(new Set());
    } else {
      setDriveSelected(new Set(filtered.map((f) => f.id)));
    }
  }

  function toggleDriveSelect(id: string) {
    setDriveSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getFilteredDriveFiles(): DriveFile[] {
    if (driveFilter === "all") return driveFiles;
    return driveFiles.filter((f) => {
      const status = driveFileStatusMap.get(f.id) ?? "unknown";
      if (driveFilter === "resolved") return status === "resolved";
      if (driveFilter === "unresolved") return status === "unresolved" || status === "unknown";
      return true;
    });
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function driveFileIcon(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "\uD83D\uDDBC";
    if (mimeType.includes("pdf")) return "\uD83D\uDCC4";
    if (mimeType.includes("video/")) return "\uD83C\uDFAC";
    return "\uD83D\uDCC1";
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

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Database Usage
              </h3>
              <p className="mb-4 text-xs text-zinc-500">
                Supabase free tier — 500 MB database
              </p>
              {storageLoading ? (
                <p className="text-sm text-zinc-500">Loading stats...</p>
              ) : dbSizeBytes === null ? (
                <p className="text-sm text-zinc-500">Could not retrieve database size.</p>
              ) : (
                <>
                  {(() => {
                    const usedMB = dbSizeBytes / (1024 * 1024);
                    const pct = Math.min(100, (dbSizeBytes / FREE_TIER_BYTES) * 100);
                    const color =
                      pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-400" : "bg-emerald-500";
                    const label =
                      pct > 80
                        ? "text-red-400"
                        : pct > 50
                          ? "text-yellow-300"
                          : "text-emerald-400";
                    return (
                      <div className="mb-5">
                        <div className="mb-1.5 flex items-baseline justify-between">
                          <span className={`text-lg font-semibold ${label}`}>
                            {usedMB < 1
                              ? `${(dbSizeBytes / 1024).toFixed(1)} KB`
                              : `${usedMB.toFixed(2)} MB`}
                          </span>
                          <span className="text-xs text-zinc-500">{pct.toFixed(1)}% of 500 MB</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${color}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                  {storageInfo && storageInfo.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {storageInfo.map((t) => (
                        <div
                          key={t.name}
                          className="flex items-center justify-between gap-3 border-b border-zinc-800/70 py-2.5 last:border-b-0"
                        >
                          <span className="text-sm text-zinc-200">{t.name}</span>
                          <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">
                            {t.rowCount.toLocaleString()} row{t.rowCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Google Drive Storage
              </h3>
              <p className="mb-4 text-xs text-zinc-500">
                Manage photos uploaded to Google Drive from NCR, Incident, HASM, and Audit pages.
              </p>
              {driveLoading ? (
                <p className="text-sm text-zinc-500">Loading Drive info...</p>
              ) : (
                <>
                  <div className="mb-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${driveStatus?.configured ? "bg-emerald-500" : "bg-red-500"}`} />
                      <span className="text-sm text-zinc-200">
                        {driveStatus?.configured ? "Connected" : "Not configured"}
                      </span>
                    </div>
                    {driveStatus?.folderId && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Folder ID:</span>
                        <code className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400 font-mono">{driveStatus.folderId}</code>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Env vars:</span>
                      {[
                        { label: "Client ID", ok: driveStatus?.clientId },
                        { label: "Secret", ok: driveStatus?.clientSecret },
                        { label: "Refresh Token", ok: driveStatus?.refreshToken },
                        { label: "Folder ID", ok: !!driveStatus?.folderId },
                      ].map((v) => (
                        <span key={v.label} className={`rounded px-1.5 py-0.5 text-[10px] ${v.ok ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-400"}`}>
                          {v.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <a
                      href="/api/drive/auth"
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
                    >
                      {driveStatus?.configured ? "Reconnect" : "Connect Google Drive"}
                    </a>
                    <button
                      onClick={testDriveUpload}
                      disabled={driveTestUploading || !driveStatus?.configured}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-40"
                    >
                      {driveTestUploading ? "Testing..." : "Test Upload"}
                    </button>
                    <button
                      onClick={loadDriveData}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
                    >
                      Refresh
                    </button>
                  </div>

                  {driveFiles.length > 0 && (
                    <>
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <span className="text-sm text-zinc-200">
                          {driveFiles.length} file{driveFiles.length !== 1 ? "s" : ""} &middot; {formatBytes(driveTotalSize)}
                        </span>
                        <select
                          value={driveFilter}
                          onChange={(e) => setDriveFilter(e.target.value as typeof driveFilter)}
                          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 outline-none"
                        >
                          <option value="all">All files</option>
                          <option value="resolved">Resolved</option>
                          <option value="unresolved">Unresolved</option>
                        </select>
                        {driveFilter !== "all" && (
                          <span className="text-xs text-zinc-500">
                            {getFilteredDriveFiles().length} shown
                          </span>
                        )}
                      </div>

                      <div className="mb-3 flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={driveSelected.size > 0 && driveSelected.size === getFilteredDriveFiles().length}
                            onChange={toggleDriveSelectAll}
                            className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-amber-500"
                          />
                          <span className="text-xs text-zinc-400">Select all</span>
                        </label>
                        {driveSelected.size > 0 && (
                          <button
                            onClick={bulkDeleteDriveFiles}
                            disabled={driveBulkDeleting}
                            className="rounded-lg border border-red-800 px-2.5 py-1 text-xs text-red-400 transition hover:bg-red-950 disabled:opacity-40"
                          >
                            {driveBulkDeleting ? "Deleting..." : `Delete ${driveSelected.size} file(s)`}
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto rounded-lg border border-zinc-800">
                        {getFilteredDriveFiles().map((f) => {
                          const status = driveFileStatusMap.get(f.id) ?? "unknown";
                          return (
                            <div key={f.id} className="flex items-center gap-3 border-b border-zinc-800/70 px-3 py-2.5 last:border-b-0 hover:bg-zinc-900/40">
                              <input
                                type="checkbox"
                                checked={driveSelected.has(f.id)}
                                onChange={() => toggleDriveSelect(f.id)}
                                className="h-4 w-4 shrink-0 rounded border-zinc-700 bg-zinc-900 accent-amber-500"
                              />
                              <span className="shrink-0 text-lg">{driveFileIcon(f.mimeType)}</span>
                              <div className="min-w-0 flex-1">
                                <a href={f.webViewLink} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-zinc-200 hover:text-zinc-100 hover:underline">
                                  {f.name}
                                </a>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-zinc-500">{formatBytes(f.size)}</span>
                                  {f.createdTime && (
                                    <span className="text-[10px] text-zinc-500">
                                      {new Date(f.createdTime).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                    </span>
                                  )}
                                  {status !== "unknown" && (
                                    <span className={`rounded px-1 py-0.5 text-[9px] uppercase tracking-wide ${status === "resolved" ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-400"}`}>
                                      {status}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => deleteDriveFile(f.id)}
                                disabled={driveDeleting === f.id}
                                className="shrink-0 rounded border border-red-900 px-2 py-1 text-[10px] text-red-400 transition hover:bg-red-950 disabled:opacity-40"
                              >
                                {driveDeleting === f.id ? "..." : "Delete"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {driveFiles.length === 0 && !driveLoading && driveStatus?.configured && (
                    <p className="text-sm text-zinc-500">No files uploaded to Google Drive yet.</p>
                  )}
                </>
              )}
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
