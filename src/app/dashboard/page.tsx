"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Plus,
  Trash2,
  RefreshCw,
  LogOut,
  FileCheck,
  Bell,
  ChevronDown,
  Search,
  ClipboardCheck,
  CalendarClock,
  HelpCircle,
  PanelLeft,
  Building2,
  ArrowUpRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

const NOTICE_TYPES = [
  "Nonconformity",
  "Corrective Action",
  "Preventive Action",
  "Risk",
] as const;
type NoticeType = (typeof NOTICE_TYPES)[number];

const STATUS = ["Open", "In Progress", "Closed"] as const;
type Status = (typeof STATUS)[number];

interface QualityRecord {
  id: string;
  title: string;
  type: NoticeType;
  status: Status;
  description: string;
  created_at: string;
  updated_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [records, setRecords] = useState<QualityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<NoticeType>("Nonconformity");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeNav, setActiveNav] = useState("Dashboard");

  const fetchRecords = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("quality_records")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setRecords(data as QualityRecord[]);
      setError(null);
    } else {
      setError(error?.message ?? "Failed to load data");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }
      setUserEmail(user.email ?? null);
      await fetchRecords();
    };
    init();
  }, [router, fetchRecords]);

  const createRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("quality_records")
      .insert([
        { title: title.trim(), type, description: description.trim(), status: "Open" },
      ])
      .select();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) setRecords([data[0] as QualityRecord, ...records]);
    setTitle("");
    setDescription("");
    setError(null);
    setShowForm(false);
  };

  const updateStatus = async (id: string, status: Status) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("quality_records")
      .update({ status })
      .eq("id", id);
    if (!error) {
      setRecords(records.map((r) => (r.id === id ? { ...r, status } : r)));
    }
  };

  const deleteRecord = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("quality_records").delete().eq("id", id);
    if (!error) {
      setRecords(records.filter((r) => r.id !== id));
    }
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const open = records.filter((r) => r.status !== "Closed").length;
  const closed = records.filter((r) => r.status === "Closed").length;
  const nonconformities = records.filter((r) => r.type === "Nonconformity").length;
  const inProgress = records.filter((r) => r.status === "In Progress").length;

  const statusColor: Record<Status, string> = {
    Open: "#e78a07",
    "In Progress": "#2563eb",
    Closed: "#16a34a",
  };

  const typeIcon = {
    Nonconformity: AlertTriangle,
    "Corrective Action": ShieldCheck,
    "Preventive Action": FileCheck,
    Risk: CheckCircle2,
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-blue-600 animate-pulse flex items-center gap-2 text-[15px] font-medium">
          <ShieldCheck className="w-6 h-6" /> Loading Audit Portal...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC] overflow-hidden">
      {/* ===== MODERN HEADER ===== */}
      <header className="bg-[#0B1F3A] text-white h-16 shrink-0 flex items-center px-4 md:px-6 gap-3 shadow-md z-20">
        <button
          onClick={() => setNavOpen(!navOpen)}
          className="p-2 -ml-1 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Toggle navigation"
        >
          <PanelLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/30">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-[15px] tracking-tight">
              Audit Portal
            </span>
            <span className="text-[11px] text-blue-200/60 hidden sm:block">
              Quality · Compliance · Continuous Improvement
            </span>
          </div>
        </div>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5 text-[13px]">
          <Search className="w-4 h-4 text-blue-200/70" />
          <input
            placeholder="Search"
            className="bg-transparent outline-none placeholder-blue-200/60 w-40 text-white"
          />
        </div>

        <button
          className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500" />
        </button>

        <div className="w-px h-6 bg-white/15 mx-1" />

        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
            {userEmail ? userEmail[0].toUpperCase() : "U"}
          </div>
          <div className="hidden lg:block leading-tight">
            <span className="text-[13px] font-medium block">
              {userEmail?.split("@")[0] || "User"}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-blue-200/70" />
        </div>

        <button
          onClick={signOut}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-[13px] font-medium"
          title="Sign out"
        >
          <LogOut className="w-[18px] h-[18px]" />
          <span className="hidden xl:inline">Sign out</span>
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ===== SIDEBAR ===== */}
        <aside
          className={`bg-white border-r border-slate-200 transition-all duration-200 overflow-hidden ${
            navOpen ? "w-60" : "w-0"
          }`}
        >
          <div className="h-full overflow-y-auto py-4">
            <div className="px-5 pb-2 pt-1 text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Workspace
            </div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    setActiveNav(item.label);
                    setShowForm(false);
                  }}
                  className={`w-full flex items-center gap-3 px-5 py-2.5 text-[14px] transition-colors ${
                    active
                      ? "text-blue-600 bg-blue-50 font-medium"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ===== CONTENT ===== */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-5 md:p-8 max-w-[1400px] mx-auto">
            {/* page header */}
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-[12px] text-slate-400 font-medium uppercase tracking-widest mb-1">
                  <ClipboardCheck className="w-3.5 h-3.5" /> Audits
                </div>
                <h1 className="text-[26px] font-bold tracking-tight text-navy">
                  Audit Management
                </h1>
                <p className="text-[14px] text-slate-500 mt-1">
                  Welcome back, {userEmail?.split("@")[0] || "User"} ·{" "}
                  {new Date().toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={fetchRecords}
                className="flex items-center gap-2 text-[13px] font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white hover:shadow-sm transition"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-lg">
                {error}
              </div>
            )}

            {/* ===== TILES ===== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
              <Tile
                icon={ClipboardList}
                label="Quality Records"
                count={records.length}
                color="#2563eb"
                accent="Records across all compliance areas"
              />
              <Tile
                icon={AlertTriangle}
                label="Open Actions"
                count={open}
                color="#e78a07"
                accent="Requiring attention"
              />
              <Tile
                icon={FileCheck}
                label="Nonconformities"
                count={nonconformities}
                color="#d0253c"
                accent="Issues identified"
              />
              <Tile
                icon={CheckCircle2}
                label="Closed"
                count={closed}
                color="#16a34a"
                accent="Successfully resolved"
              />
            </div>

            {/* ===== RECORDS TABLE ===== */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="text-[16px] font-semibold text-navy flex items-center gap-2">
                  <ClipboardList className="w-[18px] h-[18px] text-blue-600" />
                  Quality Records
                </h2>
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-[13px] font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Create
                </button>
              </div>

              {showForm && (
                <form
                  onSubmit={createRecord}
                  className="p-4 border-b border-slate-100 bg-slate-50 grid grid-cols-1 md:grid-cols-3 gap-3"
                >
                  <div className="md:col-span-1">
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Supplier late delivery"
                      className="w-full px-3 py-2 text-[14px] border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 bg-white"
                      required
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                      Type
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as NoticeType)}
                      className="w-full px-3 py-2 text-[14px] border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 bg-white"
                    >
                      {NOTICE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the issue or risk..."
                      rows={2}
                      className="w-full px-3 py-2 text-[14px] border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 resize-none bg-white"
                    />
                  </div>
                  <div className="md:col-span-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 rounded-lg text-[13px] font-semibold border border-slate-200 text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !title.trim()}
                      className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? "Creating..." : "Save"}
                    </button>
                  </div>
                </form>
              )}

              {records.length === 0 ? (
                <div className="p-14 text-center text-slate-400 text-[14px]">
                  <ClipboardList className="w-9 h-9 mx-auto mb-3 opacity-40" />
                  No records found. Click "Create" to add one.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[14px]">
                    <thead>
                      <tr className="bg-slate-50 text-left text-slate-500 text-[12px] uppercase tracking-wider">
                        <th className="px-5 py-3 font-semibold">Title</th>
                        <th className="px-5 py-3 font-semibold">Type</th>
                        <th className="px-5 py-3 font-semibold">Description</th>
                        <th className="px-5 py-3 font-semibold">Created</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record, i) => {
                        const Icon = typeIcon[record.type];
                        return (
                          <tr
                            key={record.id}
                            className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${
                              i % 2 === 1 ? "bg-slate-50/50" : ""
                            }`}
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2.5">
                                <Icon
                                  className="w-[18px] h-[18px] shrink-0"
                                  style={{ color: statusColor[record.status] }}
                                />
                                <span className="font-medium text-navy">
                                  {record.title}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-[12px] font-medium text-blue-700">
                                {record.type}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-slate-500 max-w-[260px] truncate">
                              {record.description || "—"}
                            </td>
                            <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                              {new Date(record.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-5 py-3">
                              <select
                                value={record.status}
                                onChange={(e) =>
                                  updateStatus(record.id, e.target.value as Status)
                                }
                                className="text-[12px] font-medium px-3 py-1.5 rounded-full border border-transparent cursor-pointer focus:outline-none text-white"
                                style={{ backgroundColor: statusColor[record.status] }}
                              >
                                {STATUS.map((s) => (
                                  <option key={s} value={s} className="text-navy bg-white">
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex justify-end">
                                <button
                                  onClick={() => deleteRecord(record.id)}
                                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  aria-label="Delete"
                                >
                                  <Trash2 className="w-[18px] h-[18px]" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { icon: ClipboardList, label: "Dashboard" },
  { icon: ClipboardCheck, label: "Audits" },
  { icon: FileCheck, label: "Quality Records" },
  { icon: AlertTriangle, label: "Nonconformities" },
  { icon: CalendarClock, label: "Calendar" },
  { icon: ShieldCheck, label: "Compliance" },
];

function Tile({
  icon: Icon,
  label,
  count,
  color,
  accent,
}: {
  icon: any;
  label: string;
  count: number;
  color: string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between">
        <div
          className="w-11 h-11 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}14`, color }}
        >
          <Icon className="w-[22px] h-[22px]" />
        </div>
        <button
          className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition opacity-0 group-hover:opacity-100"
          aria-label={`View ${label}`}
        >
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[32px] font-bold text-navy leading-none mt-4">{count}</p>
      <p className="text-[14px] font-semibold text-slate-800 mt-2">{label}</p>
      <p className="text-[12px] text-slate-400 mt-0.5">{accent}</p>
    </div>
  );
}
