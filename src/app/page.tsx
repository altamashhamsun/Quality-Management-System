"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Users,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const NOTICE_TYPES = ["Nonconformity", "Corrective Action", "Preventive Action", "Risk"] as const;
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

export default function Home() {
  const [records, setRecords] = useState<QualityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<NoticeType>("Nonconformity");
  const [description, setDescription] = useState("");
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quality_records")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setRecords(data as QualityRecord[]);
      setDbConnected(true);
    } else {
      setDbConnected(false);
      setError(error?.message ?? "Failed to load data");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const createRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
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
    const { error } = await supabase
      .from("quality_records")
      .update({ status })
      .eq("id", id);
    if (!error) {
      setRecords(
        records.map((r) => (r.id === id ? { ...r, status } : r))
      );
    }
  };

  const deleteRecord = async (id: string) => {
    const { error } = await supabase.from("quality_records").delete().eq("id", id);
    if (!error) {
      setRecords(records.filter((r) => r.id !== id));
    }
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

  return (
    <main className="min-h-screen">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Quality Management System</h1>
              <p className="text-xs text-slate-500">ISO 9001 Compliant</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full border"
              style={{
                background: dbConnected ? "#ecfdf5" : dbConnected === null ? "#f1f5f9" : "#fef2f2",
                color: dbConnected ? "#059669" : dbConnected === null ? "#64748b" : "#dc2626",
                borderColor: dbConnected
                  ? "#a7f3d0"
                  : dbConnected === null
                  ? "#e2e8f0"
                  : "#fecaca",
              }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    dbConnected ? "bg-green-400" : "bg-slate-400"
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    dbConnected ? "bg-green-500" : "bg-slate-400"
                  }`}
                ></span>
              </span>
              {dbConnected === null ? "Connecting..." : dbConnected ? "Connected" : "DB Error"}
            </span>
            <button
              onClick={fetchRecords}
              className="p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              aria-label="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={ClipboardList} label="Total Records" value={records.length} color="blue" />
          <StatCard icon={AlertTriangle} label="Open Actions" value={open} color="yellow" />
          <StatCard icon={CheckCircle2} label="Closed" value={closed} color="green" />
          <StatCard icon={FileCheck} label="Nonconformities" value={nonconformities} color="red" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Quality Records
              </h2>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-1/3 mb-3"></div>
                    <div className="h-3 bg-slate-100 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : records.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500">
                <FileCheck className="w-10 h-10 mx-auto mb-3 text-slate-300" />
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
                              <h3 className="font-semibold text-sm">{record.title}</h3>
                              <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                {record.type}
                              </span>
                            </div>
                            {record.description && (
                              <p className="text-xs text-slate-500 mb-2">{record.description}</p>
                            )}
                            <p className="text-xs text-slate-400">
                              Created {new Date(record.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={record.status}
                            onChange={(e) => updateStatus(record.id, e.target.value as Status)}
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
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              New Record
            </h2>
            <form
              onSubmit={createRecord}
              className="bg-white rounded-xl border border-slate-200 p-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
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
                <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
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
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
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
      </div>
    </main>
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
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
