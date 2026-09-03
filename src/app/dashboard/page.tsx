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
  LayoutDashboard,
  Settings,
  User,
  Bell,
  Menu,
  ChevronDown,
  Search,
  Factory,
  Users,
  CalendarClock,
  ClipboardCheck,
  Home,
  FolderOpen,
  Database,
  FileText,
  HelpCircle,
  PanelLeft,
  Minimize2,
  Maximize2,
  Building2,
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

const SAP_NAV = [
  { icon: Home, label: "Home", active: true },
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: ClipboardList, label: "Quality Records" },
  { icon: ClipboardCheck, label: "Audits" },
  { icon: FileCheck, label: "NCR" },
  { icon: CalendarClock, label: "Calendar" },
  { icon: Factory, label: "Branches" },
  { icon: Users, label: "Users" },
  { icon: Database, label: "Data" },
  { icon: Settings, label: "Settings" },
];

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
  const [activeNav, setActiveNav] = useState("Home");

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
    "In Progress": "#0070f2",
    Closed: "#107e3e",
  };

  const typeIcon = {
    Nonconformity: AlertTriangle,
    "Corrective Action": ShieldCheck,
    "Preventive Action": FileCheck,
    Risk: CheckCircle2,
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-sap-bg">
        <div className="text-blue-600 animate-pulse flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" /> Loading QMS...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-sap-bg overflow-hidden">
      {/* ===== SAP SHELL BAR (top) ===== */}
      <header className="bg-sap-header text-white h-12 shrink-0 flex items-center px-3 gap-2 shadow-md z-20">
        <button
          onClick={() => setNavOpen(!navOpen)}
          className="p-1.5 rounded hover:bg-sap-header-hover"
          aria-label="Toggle navigation"
        >
          {navOpen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-2 border-r border-sap-header-hover pr-3">
          <Building2 className="w-5 h-5 text-sap-accent" />
          <span className="font-semibold tracking-wide text-[15px]">QMS Portal</span>
        </div>

        <nav className="hidden lg:flex items-center gap-1 ml-2 text-[13px]">
          {["Home", "Dashboard", "Quality", "Reports", "Administration"].map((item) => (
            <button
              key={item}
              className="px-3 py-1.5 rounded-sm hover:bg-sap-header-hover whitespace-nowrap"
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-2 bg-sap-header-hover rounded px-2 py-1 text-[13px]">
          <Search className="w-4 h-4 text-sap-accent" />
          <input
            placeholder="Search"
            className="bg-transparent outline-none placeholder-sap-accent w-40"
          />
        </div>

        <button className="p-1.5 rounded hover:bg-sap-header-hover ml-1" aria-label="Notifications">
          <Bell className="w-5 h-5" />
        </button>
        <div className="w-px h-6 bg-sap-header-hover mx-1" />
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-sap-accent text-sap-header flex items-center justify-center text-sm font-semibold">
            {userEmail ? userEmail[0].toUpperCase() : "U"}
          </div>
          <ChevronDown className="w-4 h-4 text-sap-accent" />
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1 p-1.5 rounded hover:bg-sap-header-hover ml-1"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden xl:inline text-[13px]">Sign out</span>
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ===== SAP NAVIGATION (left) ===== */}
        <aside
          className={`bg-white border-r border-sap-border transition-all duration-200 overflow-hidden ${
            navOpen ? "w-56" : "w-0"
          }`}
        >
          <div className="h-full overflow-y-auto py-2">
            <div className="px-4 pb-2 pt-1 text-[11px] font-bold text-sap-muted uppercase tracking-wide flex items-center gap-1">
              <PanelLeft className="w-3.5 h-3.5" /> Navigation
            </div>
            {SAP_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    setActiveNav(item.label);
                    if (item.label !== "Home") setShowForm(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-[13px] transition-colors border-l-[3px] ${
                    activeNav === item.label
                      ? "text-sap-primary border-sap-primary bg-sap-item-active font-semibold"
                      : "border-transparent text-sap-text hover:bg-sap-item-hover"
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ===== SAP CONTENT ===== */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-5">
            {/* SAP-style breadcrumb/context header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[11px] text-sap-muted flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5" /> / {activeNav}
              </div>
              <button
                onClick={fetchRecords}
                className="flex items-center gap-1.5 text-[12px] px-2 py-1 rounded hover:bg-sap-item-hover text-sap-text"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>

            <h1 className="text-[20px] font-semibold text-sap-primary mb-1">
              Home
            </h1>
            <p className="text-[13px] text-sap-muted mb-5">
              Welcome back, {userEmail?.split("@")[0] || "User"} ·{" "}
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded">
                {error}
              </div>
            )}

            {/* ===== SAP TILES ===== */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
              <Tile
                icon={ClipboardList}
                label="Quality Records"
                count={records.length}
                color="#0070f2"
                onClick={() => setActiveNav("Quality Records")}
              />
              <Tile
                icon={AlertTriangle}
                label="Open Actions"
                count={open}
                color="#e78a07"
                onClick={() => setActiveNav("Quality Records")}
              />
              <Tile
                icon={CheckCircle2}
                label="Closed"
                count={closed}
                color="#107e3e"
                onClick={() => setActiveNav("Quality Records")}
              />
              <Tile
                icon={FileCheck}
                label="Nonconformities"
                count={nonconformities}
                color="#d0253c"
                onClick={() => setActiveNav("Quality Records")}
              />
              <Tile
                icon={CalendarClock}
                label="In Progress"
                count={inProgress}
                color="#5a5a5a"
                onClick={() => setActiveNav("Quality Records")}
              />
            </div>

            {/* ===== SAP LIST REPORT ===== */}
            <div className="bg-white rounded shadow-sm border border-sap-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-sap-border">
                <h2 className="text-[14px] font-semibold text-sap-text flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-sap-primary" />
                  Quality Records
                </h2>
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] font-semibold bg-sap-primary text-white hover:bg-sap-primary-hover"
                >
                  <Plus className="w-4 h-4" /> Create
                </button>
              </div>

              {showForm && (
                <form
                  onSubmit={createRecord}
                  className="p-3 border-b border-sap-border bg-sap-form-bg grid grid-cols-1 md:grid-cols-3 gap-3"
                >
                  <div className="md:col-span-1">
                    <label className="block text-[12px] font-semibold text-sap-text mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Supplier late delivery"
                      className="w-full px-2.5 py-1.5 text-[13px] border border-sap-border rounded focus:outline-none focus:border-sap-primary focus:ring-1 focus:ring-sap-primary"
                      required
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[12px] font-semibold text-sap-text mb-1">
                      Type
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as NoticeType)}
                      className="w-full px-2.5 py-1.5 text-[13px] border border-sap-border rounded focus:outline-none focus:border-sap-primary"
                    >
                      {NOTICE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[12px] font-semibold text-sap-text mb-1">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the issue or risk..."
                      rows={2}
                      className="w-full px-2.5 py-1.5 text-[13px] border border-sap-border rounded focus:outline-none focus:border-sap-primary resize-none"
                    />
                  </div>
                  <div className="md:col-span-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-3 py-1.5 rounded text-[13px] font-semibold border border-sap-border text-sap-text hover:bg-sap-item-hover"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !title.trim()}
                      className="px-4 py-1.5 rounded text-[13px] font-semibold bg-sap-primary text-white hover:bg-sap-primary-hover disabled:opacity-50"
                    >
                      {saving ? "Creating..." : "Save"}
                    </button>
                  </div>
                </form>
              )}

              {records.length === 0 ? (
                <div className="p-10 text-center text-sap-muted text-[13px]">
                  <ClipboardList className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  No records found. Click "Create" to add one.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-sap-table-head text-left text-sap-muted text-[12px] uppercase tracking-wide">
                        <th className="px-3 py-2 font-semibold">Title</th>
                        <th className="px-3 py-2 font-semibold">Type</th>
                        <th className="px-3 py-2 font-semibold">Description</th>
                        <th className="px-3 py-2 font-semibold">Created</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record, i) => {
                        const Icon = typeIcon[record.type];
                        return (
                          <tr
                            key={record.id}
                            className={`border-t border-sap-border hover:bg-sap-item-hover ${
                              i % 2 === 1 ? "bg-sap-row-alt" : ""
                            }`}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Icon
                                  className="w-4 h-4 shrink-0"
                                  style={{ color: statusColor[record.status] }}
                                />
                                <span className="font-medium text-sap-text">
                                  {record.title}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 rounded bg-sap-badge text-[11px] font-medium text-sap-primary">
                                {record.type}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sap-muted max-w-[260px] truncate">
                              {record.description || "—"}
                            </td>
                            <td className="px-3 py-2 text-sap-muted whitespace-nowrap">
                              {new Date(record.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={record.status}
                                onChange={(e) =>
                                  updateStatus(record.id, e.target.value as Status)
                                }
                                className="text-[12px] font-medium px-2 py-1 rounded border border-transparent cursor-pointer focus:outline-none focus:border-sap-primary"
                                style={{
                                  color: "#fff",
                                  backgroundColor: statusColor[record.status],
                                }}
                              >
                                {STATUS.map((s) => (
                                  <option key={s} value={s} className="text-sap-text">
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex justify-end">
                                <button
                                  onClick={() => deleteRecord(record.id)}
                                  className="p-1.5 rounded text-sap-muted hover:text-red-600 hover:bg-red-50"
                                  aria-label="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
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

      {/* ===== SAP STATUS BAR (bottom) ===== */}
      <footer className="h-7 bg-sap-status text-white text-[11px] flex items-center px-3 gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-sap-accent" />
          Help
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-sap-accent" />
          {userEmail}
        </div>
        <span className="text-sap-accent/70">QMS © {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  count,
  color,
  onClick,
}: {
  icon: any;
  label: string;
  count: number;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded shadow-sm border border-sap-border p-3 text-left hover:shadow-md transition-shadow flex items-center gap-3"
    >
      <div
        className="w-11 h-11 rounded flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}1a`, color }}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div className="overflow-hidden">
        <p className="text-[20px] font-bold text-sap-text leading-none">{count}</p>
        <p className="text-[12px] text-sap-muted truncate">{label}</p>
      </div>
    </button>
  );
}
