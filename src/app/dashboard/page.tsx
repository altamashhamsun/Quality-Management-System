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

  const statusColor: Record<Status, string> = {
    Open: "bg-yellow-100 text-yellow-800",
    "In Progress": "bg-blue-100 text-blue-800",
    Closed: "bg-green-100 text-green-800",
  };

  const typeIcon = {
    Nonconformity: AlertTriangle,
    "Corrective Action": ShieldCheck,
    "Preventive Action": FileCheck,
    Risk: CheckCircle2,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-blue-600 animate-pulse flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" /> Loading portal...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden md:flex w-64 bg-blue-700 text-white flex-col">
        <div className="p-5 flex items-center gap-3 border-b border-blue-600">
          <div className="bg-white/15 p-2 rounded-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold text-sm">QMS Portal</p>
            <p className="text-xs text-blue-200">Quality Management</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavItem active icon={LayoutDashboard} label="Dashboard" />
          <NavItem icon={ClipboardList} label="Quality Records" />
          <NavItem icon={FileCheck} label="Audits" />
          <NavItem icon={Settings} label="Settings" />
        </nav>
        <div className="p-4 border-t border-blue-600 flex items-center gap-3">
          <div className="bg-white/15 p-2 rounded-full">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userEmail}</p>
            <p className="text-xs text-blue-200">Administrator</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 md:hidden">
              <div className="bg-blue-600 text-white p-1.5 rounded-lg">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="font-semibold">QMS Portal</span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchRecords}
                className="p-2 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100"
                aria-label="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                className="p-2 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 relative"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>

        <main className="p-6 flex-1">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">
              Quality Dashboard
            </h1>
            <p className="text-slate-500 text-sm">
              Overview of your organization&apos;s quality management activities
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={ClipboardList}
              label="Total Records"
              value={records.length}
              color="blue"
            />
            <StatCard
              icon={AlertTriangle}
              label="Open Actions"
              value={open}
              color="yellow"
            />
            <StatCard icon={CheckCircle2} label="Closed" value={closed} color="green" />
            <StatCard
              icon={FileCheck}
              label="Nonconformities"
              value={nonconformities}
              color="red"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg text-slate-900">
                  Quality Records
                </h2>
              </div>

              {records.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500">
                  <ClipboardList className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  No records yet. Create your first quality record.
                </div>
              ) : (
                <div className="space-y-3">
                  {records.map((record) => {
                    const Icon = typeIcon[record.type];
                    return (
                      <div
                        key={record.id}
                        className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <Icon className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                            <div>
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-semibold text-sm text-slate-900">
                                  {record.title}
                                </h3>
                                <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                  {record.type}
                                </span>
                              </div>
                              {record.description && (
                                <p className="text-xs text-slate-500 mb-2">
                                  {record.description}
                                </p>
                              )}
                              <p className="text-xs text-slate-400">
                                Created {new Date(record.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={record.status}
                              onChange={(e) =>
                                updateStatus(record.id, e.target.value as Status)
                              }
                              className={`text-xs font-medium px-3 py-1.5 rounded-full border border-transparent cursor-pointer focus:outline-none ${statusColor[record.status]}`}
                            >
                              {STATUS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => deleteRecord(record.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                              aria-label="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h2 className="font-semibold text-lg text-slate-900 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                New Record
              </h2>
              <form
                onSubmit={createRecord}
                className="bg-white rounded-xl border border-slate-200 p-4 space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Supplier late delivery"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as NoticeType)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {NOTICE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the issue or risk..."
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving || !title.trim()}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Creating..." : "Create Record"}
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
}: {
  icon: any;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-white text-blue-700"
          : "text-blue-100 hover:bg-blue-600 hover:text-white"
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: "blue" | "yellow" | "green" | "red";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    yellow: "bg-yellow-50 text-yellow-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
