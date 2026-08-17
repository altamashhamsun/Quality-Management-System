"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Modal from "@/components/Modal";
import { downloadQualityReportPdf } from "@/lib/qualityReportPdf";

type Branch = { id: string; name: string };
type QCReport = {
  id: string;
  branch_id: string;
  title: string;
  status: string;
  items: Record<string, string[]>;
  created_at: string;
  closed_at: string | null;
};
type QCSession = {
  id: string;
  report_id: string;
  round_number: number;
  status: string;
  checklist: QCItem[] | null;
  created_at: string;
  closed_at: string | null;
};
type QCItem = {
  id: string;
  item: string;
  question: string;
  found_issue: string;
  answer?: boolean;
};
type DescRow = {
  id: string;
  session_id: string;
  item_name: string;
  content: string;
};
type QCArea = {
  id: string;
  branch_id: string;
  name: string;
  items: string[];
  sort_order: number;
};

const STORAGE_BRANCH = "qcBranchId";

const FALLBACK_ITEMS: Record<string, string[]> = {
  "Front Desk & Reception": ["Reception Area", "Check-in Counter", "Waiting Area"],
  "Lobby & Entrance": ["Main Entrance", "Lobby Floor", "Seating Area"],
  "Guest Rooms": ["Bedroom Cleanliness", "Bathroom", "Amenities & Supplies"],
  "Dining": ["Restaurant Area", "Kitchen", "Bar & Lounge"],
  "Facilities": ["Pool Area", "Gym", "Spa"],
  "Back of House": ["Laundry", "Store Room", "Loading Dock"],
  "Safety & Systems": ["Fire Safety", "Electrical", "HVAC", "CCTV"],
};

function flattenAreas(items: Record<string, string[]>): string[] {
  const out: string[] = [];
  for (const [area, areaItems] of Object.entries(items)) {
    for (const item of areaItems) out.push(area + " / " + item);
  }
  return out;
}

function areaItemKey(area: string, item: string) {
  return area + " / " + item;
}

export default function QualityControlPage() {
  const { loading: authLoading } = useAuth();

  const [view, setView] = useState<"list" | "report" | "round">("list");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [reports, setReports] = useState<QCReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<QCReport | null>(null);
  const [sessions, setSessions] = useState<QCSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<QCSession | null>(
    null,
  );
  const [descriptions, setDescriptions] = useState<
    Record<string, { id: string | null; content: string }>
  >({});
  const [dataLoading, setDataLoading] = useState(true);
  const [closingRound, setClosingRound] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [createBranchId, setCreateBranchId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [savingAnswer, setSavingAnswer] = useState<string | null>(null);

  const [areasModal, setAreasModal] = useState(false);
  const [areasBranchId, setAreasBranchId] = useState("");
  const [areas, setAreas] = useState<QCArea[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);

  const saveTimer = useRef<number | null>(null);
  const descriptionsRef = useRef(descriptions);
  const sessionRef = useRef(selectedSession);
  descriptionsRef.current = descriptions;
  sessionRef.current = selectedSession;

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      const [{ data: b }, { data: r }] = await Promise.all([
        supabase.from("branches").select("id, name").order("name"),
        supabase
          .from("quality_reports")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      setBranches(b ?? []);
      setReports((r ?? []) as unknown as QCReport[]);
      const stored = window.localStorage.getItem(STORAGE_BRANCH);
      if (stored) setSelectedBranchId(stored);
      setDataLoading(false);
    })();
  }, [authLoading]);

  useEffect(() => {
    if (!selectedReport) return;
    (async () => {
      const { data } = await supabase
        .from("quality_sessions")
        .select("*")
        .eq("report_id", selectedReport.id)
        .order("round_number");
      setSessions((data as QCSession[]) ?? []);
    })();
  }, [selectedReport?.id]);

  useEffect(() => {
    if (
      !selectedSession ||
      selectedSession.round_number !== 1 ||
      !selectedReport
    )
      return;
    (async () => {
      const { data } = await supabase
        .from("quality_descriptions")
        .select("*")
        .eq("session_id", selectedSession.id);
      const map = new Map(
        ((data as DescRow[]) ?? []).map((d) => [d.item_name, d]),
      );
      const items = selectedReport.items ?? FALLBACK_ITEMS;
      const descs: Record<string, { id: string | null; content: string }> = {};
      for (const [area, areaItems] of Object.entries(items)) {
        for (const item of areaItems) {
          const key = areaItemKey(area, item);
          const found = map.get(key);
          descs[key] = found
            ? { id: found.id, content: found.content }
            : { id: null, content: "" };
        }
      }
      setDescriptions(descs);
    })();
  }, [selectedSession?.id, selectedReport?.id]);

  useEffect(() => {
    if (
      view !== "round" ||
      !sessionRef.current ||
      sessionRef.current.round_number !== 1
    )
      return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const session = sessionRef.current;
      if (!session) return;
      const descs = descriptionsRef.current;
      for (const [itemName, desc] of Object.entries(descs)) {
        if (!desc.content.trim()) continue;
        if (desc.id) {
          await supabase
            .from("quality_descriptions")
            .update({ content: desc.content })
            .eq("id", desc.id);
        } else {
          const { data } = await supabase
            .from("quality_descriptions")
            .insert({
              session_id: session.id,
              item_name: itemName,
              content: desc.content,
            })
            .select("id")
            .single();
          if (data) {
            descriptionsRef.current = {
              ...descriptionsRef.current,
              [itemName]: { id: data.id, content: desc.content },
            };
          }
        }
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [descriptions, view]);

  const branchName = (id: string) =>
    branches.find((b) => b.id === id)?.name ?? "\u2014";
  const todayStr = () =>
    new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  const hasActiveSession = sessions.some((s) => s.status === "active");

  const loadAreas = useCallback(async (branchId: string) => {
    if (!branchId) { setAreas([]); return; }
    setAreasLoading(true);
    const { data } = await supabase
      .from("quality_areas")
      .select("*")
      .eq("branch_id", branchId)
      .order("sort_order");
    setAreas(
      ((data ?? []) as unknown[]).map((a: any) => ({
        id: a.id,
        branch_id: a.branch_id,
        name: a.name,
        items: Array.isArray(a.items) ? a.items : [],
        sort_order: a.sort_order ?? 0,
      })),
    );
    setAreasLoading(false);
  }, []);

  useEffect(() => {
    if (areasModal && areasBranchId) loadAreas(areasBranchId);
  }, [areasModal, areasBranchId, loadAreas]);

  async function addArea() {
    if (!areasBranchId) return;
    const { data } = await supabase
      .from("quality_areas")
      .insert({
        branch_id: areasBranchId,
        name: "New Area",
        items: [],
        sort_order: areas.length,
      })
      .select()
      .single();
    if (data) {
      setAreas((p) => [
        ...p,
        { id: data.id, branch_id: data.branch_id, name: "New Area", items: [], sort_order: data.sort_order },
      ]);
    }
  }

  async function updateAreaName(id: string, name: string) {
    setAreas((p) => p.map((a) => (a.id === id ? { ...a, name } : a)));
    await supabase.from("quality_areas").update({ name }).eq("id", id);
  }

  async function deleteArea(id: string) {
    setAreas((p) => p.filter((a) => a.id !== id));
    await supabase.from("quality_areas").delete().eq("id", id);
  }

  async function updateAreaItems(id: string, items: string[]) {
    setAreas((p) => p.map((a) => (a.id === id ? { ...a, items } : a)));
    await supabase.from("quality_areas").update({ items }).eq("id", id);
  }

  async function createReport() {
    if (!createBranchId) return;
    const title =
      createTitle.trim() ||
      `${branchName(createBranchId)} Quality Report \u2014 ${todayStr()}`;
    const { data: areaData } = await supabase
      .from("quality_areas")
      .select("name, items")
      .eq("branch_id", createBranchId)
      .order("sort_order");
    const items: Record<string, string[]> = {};
    if (areaData && areaData.length > 0) {
      for (const a of areaData) {
        const aItems = Array.isArray(a.items) ? a.items : [];
        if (aItems.length > 0) items[a.name] = aItems;
      }
    }
    if (Object.keys(items).length === 0) {
      Object.assign(items, FALLBACK_ITEMS);
    }
    const { data, error } = await supabase
      .from("quality_reports")
      .insert({ branch_id: createBranchId, title, items })
      .select()
      .single();
    if (error || !data) return;
    const report = data as unknown as QCReport;
    setReports((p) => [report, ...p]);
    setSelectedReport(report);
    setSelectedBranchId(createBranchId);
    window.localStorage.setItem(STORAGE_BRANCH, createBranchId);
    setSessions([]);
    setView("report");
    setCreateModal(false);
    setCreateTitle("");
  }

  async function addRound() {
    if (!selectedReport) return;
    const roundNumber = sessions.length + 1;
    const { data, error } = await supabase
      .from("quality_sessions")
      .insert({ report_id: selectedReport.id, round_number: roundNumber })
      .select()
      .single();
    if (error || !data) return;
    const session = data as QCSession;
    setSessions((p) => [...p, session]);
    setSelectedSession(session);
    if (roundNumber === 1) {
      const items = selectedReport.items ?? FALLBACK_ITEMS;
      const descs: Record<string, { id: string | null; content: string }> = {};
      for (const [area, areaItems] of Object.entries(items)) {
        for (const item of areaItems) {
          descs[areaItemKey(area, item)] = { id: null, content: "" };
        }
      }
      setDescriptions(descs);
    }
    setView("round");
  }

  function openSession(s: QCSession) {
    setSelectedSession(s);
    setView("round");
  }

  async function forceSaveDescriptions() {
    const session = sessionRef.current;
    if (!session) return;
    const descs = descriptionsRef.current;
    for (const [itemName, desc] of Object.entries(descs)) {
      if (!desc.content.trim()) continue;
      if (desc.id) {
        await supabase
          .from("quality_descriptions")
          .update({ content: desc.content })
          .eq("id", desc.id);
      } else {
        await supabase.from("quality_descriptions").insert({
          session_id: session.id,
          item_name: itemName,
          content: desc.content,
        });
      }
    }
  }

  async function closeRound() {
    if (!selectedSession || !selectedReport) return;
    setClosingRound(true);
    try {
      if (selectedSession.round_number === 1) {
        await forceSaveDescriptions();
        const descs: Record<string, string> = {};
        for (const [k, v] of Object.entries(descriptionsRef.current)) {
          if (v.content.trim()) descs[k] = v.content.trim();
        }
        const res = await fetch("/api/ai/quality-checklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ round: 1, descriptions: descs }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "AI failed");
        await supabase
          .from("quality_sessions")
          .update({ status: "closed", closed_at: new Date().toISOString() })
          .eq("id", selectedSession.id);
        setSessions((p) =>
          p.map((s) =>
            s.id === selectedSession.id ? { ...s, status: "closed" } : s,
          ),
        );
        if (result.checklist?.length > 0) {
          const { data } = await supabase
            .from("quality_sessions")
            .insert({
              report_id: selectedReport.id,
              round_number: 2,
              checklist: result.checklist,
            })
            .select()
            .single();
          if (data) setSessions((p) => [...p, data as QCSession]);
        }
      } else {
        const prev = selectedSession.checklist ?? [];
        const answers: Record<string, boolean> = {};
        for (const item of prev)
          if (item.answer !== undefined) answers[item.id] = item.answer;
        const res = await fetch("/api/ai/quality-checklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            round: selectedSession.round_number,
            previousChecklist: prev,
            previousAnswers: answers,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "AI failed");
        await supabase
          .from("quality_sessions")
          .update({ status: "closed", closed_at: new Date().toISOString() })
          .eq("id", selectedSession.id);
        setSessions((p) =>
          p.map((s) =>
            s.id === selectedSession.id ? { ...s, status: "closed" } : s,
          ),
        );
        if (result.checklist?.length > 0) {
          const { data } = await supabase
            .from("quality_sessions")
            .insert({
              report_id: selectedReport.id,
              round_number: selectedSession.round_number + 1,
              checklist: result.checklist,
            })
            .select()
            .single();
          if (data) setSessions((p) => [...p, data as QCSession]);
        }
      }
      setView("report");
      setSelectedSession(null);
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setClosingRound(false);
    }
  }

  async function endDay() {
    if (!selectedReport) return;
    const rounds: {
      roundNumber: number;
      createdAt?: string;
      descriptions: Record<string, { text: string; writtenAt: string }>;
      checklist?: QCItem[];
    }[] = [];
    for (const session of sessions) {
      const roundTime = new Date(session.created_at).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      if (session.round_number === 1) {
        const { data } = await supabase
          .from("quality_descriptions")
          .select("item_name, content, updated_at")
          .eq("session_id", session.id);
        const descs: Record<string, { text: string; writtenAt: string }> = {};
        for (const d of (data ?? []) as {
          item_name: string;
          content: string;
          updated_at: string;
        }[])
          descs[d.item_name] = {
            text: d.content,
            writtenAt: new Date(d.updated_at).toLocaleString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
        rounds.push({ roundNumber: 1, createdAt: roundTime, descriptions: descs });
      } else {
        rounds.push({
          roundNumber: session.round_number,
          createdAt: roundTime,
          descriptions: {},
          checklist: session.checklist ?? [],
        });
      }
    }
    const { data: settings } = await supabase
      .from("settings")
      .select("owner_name")
      .eq("id", 1)
      .maybeSingle();
    downloadQualityReportPdf({
      title: selectedReport.title,
      branchName: branchName(selectedReport.branch_id),
      date: todayStr(),
      auditor: settings?.owner_name || undefined,
      rounds,
    });
  }

  async function closeReport() {
    if (!selectedReport) return;
    await supabase
      .from("quality_reports")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", selectedReport.id);
    setReports((p) =>
      p.map((r) =>
        r.id === selectedReport.id ? { ...r, status: "closed" } : r,
      ),
    );
    setView("list");
    setSelectedReport(null);
    setSelectedSession(null);
  }

  async function deleteReport(reportId: string) {
    if (!window.confirm("Delete this report and all its rounds? This cannot be undone.")) return;
    const { data: sessList } = await supabase
      .from("quality_sessions")
      .select("id")
      .eq("report_id", reportId);
    for (const s of sessList ?? []) {
      await supabase.from("quality_descriptions").delete().eq("session_id", s.id);
    }
    await supabase.from("quality_sessions").delete().eq("report_id", reportId);
    await supabase.from("quality_reports").delete().eq("id", reportId);
    setReports((p) => p.filter((r) => r.id !== reportId));
    if (selectedReport?.id === reportId) {
      setSelectedReport(null);
      setSelectedSession(null);
      setView("list");
    }
  }

  async function answerItem(itemId: string, answer: boolean) {
    if (!selectedSession) return;
    const updated = (selectedSession.checklist ?? []).map((i) =>
      i.id === itemId ? { ...i, answer } : i,
    );
    const newSession = { ...selectedSession, checklist: updated };
    setSelectedSession(newSession);
    setSessions((p) =>
      p.map((s) => (s.id === selectedSession.id ? newSession : s)),
    );
    setSavingAnswer(itemId);
    await supabase
      .from("quality_sessions")
      .update({ checklist: updated })
      .eq("id", selectedSession.id);
    setSavingAnswer(null);
  }

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-full bg-[#050507]">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <p className="py-20 text-center text-sm text-zinc-500">
            Loading\u2026
          </p>
        </main>
      </div>
    );
  }

  const filteredReports = selectedBranchId
    ? reports.filter((r) => r.branch_id === selectedBranchId)
    : reports;

  const reportsByBranch = new Map<string, QCReport[]>();
  for (const report of filteredReports) {
    const list = reportsByBranch.get(report.branch_id) ?? [];
    list.push(report);
    reportsByBranch.set(report.branch_id, list);
  }
  const sortedBranchIds = [...reportsByBranch.keys()].sort((a, b) =>
    branchName(a).localeCompare(branchName(b)),
  );

  const isRound1 = selectedSession?.round_number === 1;
  const activeChecklist = selectedSession?.checklist ?? [];
  const isClosed = selectedSession?.status === "closed";
  const resolved = activeChecklist.filter((i) => i.answer === true).length;
  const unresolved = activeChecklist.filter((i) => i.answer === false).length;

  const reportAreas = selectedReport?.items ?? FALLBACK_ITEMS;

  return (
    <div className="min-h-full bg-[#050507] font-sans">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {view === "list" && (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-50">
                  Quality Control
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Manage quality inspection reports
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setAreasBranchId(
                      selectedBranchId || branches[0]?.id || "",
                    );
                    setAreasModal(true);
                  }}
                  className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:bg-zinc-900/60"
                >
                  Manage Areas
                </button>
                <button
                  onClick={() => {
                    setCreateBranchId(
                      selectedBranchId || branches[0]?.id || "",
                    );
                    setCreateModal(true);
                  }}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-900/60"
                >
                  Create Report
                </button>
              </div>
            </div>
            <div className="mb-4">
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  window.localStorage.setItem(
                    STORAGE_BRANCH,
                    e.target.value,
                  );
                }}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            {filteredReports.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 py-12 text-center text-sm text-zinc-500">
                No reports yet. Click &quot;Create Report&quot; to
                begin.
              </p>
            ) : (
              <div className="space-y-6">
                {sortedBranchIds.map((branchId) => {
                  const branchReports = reportsByBranch.get(branchId) ?? [];
                  return (
                    <div key={branchId}>
                      <h3 className="mb-3 text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                        {branchName(branchId)}
                        <span className="ml-2 text-zinc-600 normal-case tracking-normal">
                          ({branchReports.length})
                        </span>
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {branchReports
                          .sort(
                            (a, b) =>
                              new Date(b.created_at).getTime() -
                              new Date(a.created_at).getTime(),
                          )
                          .map((report) => (
                            <div
                              key={report.id}
                              className="group rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/40"
                            >
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <h3 className="text-sm font-semibold text-zinc-50">
                                  {report.title}
                                </h3>
                                <span
                                  className={`shrink-0 rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                                    report.status === "active"
                                      ? "bg-emerald-950 text-emerald-400"
                                      : "bg-zinc-800 text-zinc-500"
                                  }`}
                                >
                                  {report.status}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-500">
                                {new Date(
                                  report.created_at,
                                ).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </p>
                              <div className="mt-3 flex justify-end gap-2">
                                <button
                                  onClick={() => deleteReport(report.id)}
                                  className="rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-red-400 transition hover:bg-red-950 hover:border-red-800"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedReport(report);
                                    setView("report");
                                  }}
                                  className="rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-900/60"
                                >
                                  Open
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {view === "report" && selectedReport && (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-50">
                  {selectedReport.title}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {branchName(selectedReport.branch_id)} &middot;{" "}
                  {new Date(
                    selectedReport.created_at,
                  ).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setView("list");
                    setSelectedReport(null);
                    setSelectedSession(null);
                  }}
                  className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-900/60"
                >
                  Back
                </button>
                <button
                  onClick={endDay}
                  disabled={sessions.length === 0}
                  className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-900/60 disabled:opacity-40"
                >
                  End Day
                </button>
                {selectedReport.status === "active" && (
                  <button
                    onClick={addRound}
                    disabled={hasActiveSession}
                    title={
                      hasActiveSession
                        ? "Close the active round first"
                        : ""
                    }
                    className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-900/60 disabled:opacity-40"
                  >
                    Add Round
                  </button>
                )}
                {selectedReport.status === "active" && (
                  <button
                    onClick={closeReport}
                    className="rounded-lg border border-red-800 px-3 py-2 text-sm text-red-400 transition hover:bg-red-950"
                  >
                    Close Report
                  </button>
                )}
                <button
                  onClick={() => deleteReport(selectedReport.id)}
                  className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-400 transition hover:bg-red-950"
                >
                  Delete
                </button>
              </div>
            </div>
            {sessions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 py-12 text-center text-sm text-zinc-500">
                No rounds yet. Click &quot;Add Round&quot; to begin.
              </p>
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openSession(s)}
                    className={`w-full rounded-xl border p-4 text-left transition-all duration-300 ${
                      s.status === "active"
                        ? "border-zinc-700 bg-zinc-900/60 hover:border-zinc-700"
                        : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-50">
                          Round {s.round_number}
                        </h3>
                        <p className="text-xs text-zinc-500">
                          {s.round_number === 1
                            ? "Item descriptions"
                            : `${(s.checklist ?? []).length} checklist items`}
                        </p>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                          s.status === "active"
                            ? "bg-emerald-950 text-emerald-400"
                            : "bg-zinc-900/60 text-zinc-500"
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {view === "round" && selectedSession && (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-50">
                  Round {selectedSession.round_number}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {isRound1
                    ? "Write descriptions for each area below"
                    : `${resolved} resolved \u00b7 ${unresolved} unresolved`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setView("report");
                    setSelectedSession(null);
                  }}
                  className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-900/60"
                >
                  Back
                </button>
                {!isClosed && (
                  <button
                    onClick={closeRound}
                    disabled={closingRound}
                    className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-900/60 disabled:opacity-40"
                  >
                    {closingRound
                      ? "Generating\u2026"
                      : "Close Round"}
                  </button>
                )}
              </div>
            </div>

            {isRound1 && (
              <div className="space-y-6">
                {Object.entries(reportAreas).map(([area, areaItems]) => (
                  <div key={area}>
                    <h3 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                      {area}
                    </h3>
                    <div className="space-y-3">
                      {areaItems.map((item) => {
                        const key = areaItemKey(area, item);
                        return (
                          <div
                            key={key}
                            className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                          >
                            <label className="mb-2 block text-sm font-medium text-zinc-500">
                              {item}
                            </label>
                            <textarea
                              value={descriptions[key]?.content ?? ""}
                              onChange={(e) =>
                                setDescriptions((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...prev[key],
                                    content: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Describe what you observed\u2026"
                              rows={2}
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isRound1 &&
              (activeChecklist.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 py-12 text-center text-sm text-zinc-500">
                  No checklist items.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeChecklist.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-medium text-zinc-500">
                            {item.item}
                          </h4>
                          <p className="text-xs text-zinc-500">
                            {item.question}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Found: {item.found_issue}
                          </p>
                        </div>
                        {!isClosed && (
                          <div className="flex shrink-0 items-center gap-2">
                            {savingAnswer === item.id && (
                              <span className="text-[10px] text-zinc-500">
                                saving...
                              </span>
                            )}
                            <div className="flex gap-1">
                              <button
                                onClick={() =>
                                  answerItem(item.id, true)
                                }
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                  item.answer === true
                                    ? "bg-emerald-600 text-white"
                                    : "border border-zinc-800 text-zinc-500 hover:bg-zinc-900/60"
                                }`}
                              >
                                Yes
                              </button>
                              <button
                                onClick={() =>
                                  answerItem(item.id, false)
                                }
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                  item.answer === false
                                    ? "bg-red-600 text-white"
                                    : "border border-zinc-800 text-zinc-500 hover:bg-zinc-900/60"
                                }`}
                              >
                                No
                              </button>
                            </div>
                          </div>
                        )}
                        {isClosed && item.answer !== undefined && (
                          <span
                            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                              item.answer
                                ? "bg-emerald-950 text-emerald-400"
                                : "bg-red-950 text-red-400"
                            }`}
                          >
                            {item.answer
                              ? "Resolved"
                              : "Unresolved"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </>
        )}
      </main>

      <Modal
        open={createModal}
        title="Create Quality Report"
        onClose={() => setCreateModal(false)}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-500">
              Branch
            </label>
            <select
              value={createBranchId}
              onChange={(e) => setCreateBranchId(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-700"
            >
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-500">
              Title (optional)
            </label>
            <input
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder={`Auto: Branch Quality Report \u2014 ${todayStr()}`}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700"
            />
          </div>
          <button
            onClick={createReport}
            disabled={!createBranchId}
            className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-900/60 disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </Modal>

      <Modal
        open={areasModal}
        title="Manage Areas & Items"
        onClose={() => setAreasModal(false)}
        wide
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-500">
              Branch
            </label>
            <select
              value={areasBranchId}
              onChange={(e) => setAreasBranchId(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-700"
            >
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {areasBranchId && (
            <>
              {areasLoading ? (
                <p className="py-4 text-center text-sm text-zinc-500">
                  Loading...
                </p>
              ) : (
                <div className="space-y-4">
                  {areas.map((area) => (
                    <div
                      key={area.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <input
                          value={area.name}
                          onChange={(e) =>
                            updateAreaName(area.id, e.target.value)
                          }
                          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-sm font-medium text-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                        />
                        <button
                          onClick={() => deleteArea(area.id)}
                          className="rounded-lg border border-red-900 px-2 py-1.5 text-xs text-red-400 transition hover:bg-red-950"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="space-y-2">
                        {area.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2"
                          >
                            <span className="w-5 text-center text-[10px] text-zinc-500">
                              {idx + 1}
                            </span>
                            <input
                              value={item}
                              onChange={(e) => {
                                const newItems = [...area.items];
                                newItems[idx] = e.target.value;
                                updateAreaItems(area.id, newItems);
                              }}
                              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                              placeholder="Item name"
                            />
                            <button
                              onClick={() => {
                                const newItems = area.items.filter(
                                  (_, i) => i !== idx,
                                );
                                updateAreaItems(area.id, newItems);
                              }}
                              className="text-xs text-zinc-500 hover:text-red-400"
                            >
                              x
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() =>
                            updateAreaItems(area.id, [
                              ...area.items,
                              "",
                            ])
                          }
                          className="text-xs text-zinc-500 hover:text-zinc-500"
                        >
                          + Add item
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addArea}
                    className="w-full rounded-xl border border-dashed border-zinc-800 py-3 text-sm text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-500"
                  >
                    + Add Area
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
