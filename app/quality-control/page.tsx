"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Modal from "@/components/Modal";

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

function areaItemKey(area: string, item: string) {
  return area + " / " + item;
}

const LazyQCChart = dynamic(() => import("@/components/QCChart"), { ssr: false });

type EvalItem = { item: string; question: string; found_issue: string; resolvedAt?: string };
type EvalData = {
  resolved: EvalItem[];
  unresolved: EvalItem[];
  totalResolved: number;
  totalUnresolved: number;
  totalAnswered: number;
};

export default function QualityControlPage() {
  const { loading: authLoading } = useAuth();

  const [view, setView] = useState<"list" | "report" | "round">("list");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [reports, setReports] = useState<QCReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<QCReport | null>(null);
  const [sessions, setSessions] = useState<QCSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<QCSession | null>(null);
  const [descriptions, setDescriptions] = useState<
    Record<string, { id: string | null; content: string }>
  >({});
  const [dataLoading, setDataLoading] = useState(true);
  const [closingRound, setClosingRound] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [createBranchId, setCreateBranchId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [savingAnswer, setSavingAnswer] = useState<string | null>(null);
  const [chartData, setChartData] = useState<
    { round: number; [branch: string]: number | string }[] | null
  >(null);
  const [branchRankings, setBranchRankings] = useState<
    { rank: number; name: string; totalIssues: number; resolved: number; unresolved: number; rounds: number; resolvedR1: number; resolutionRate: number }[]
  >([]);
  const [areasModal, setAreasModal] = useState(false);
  const [areasBranchId, setAreasBranchId] = useState("");
  const [areas, setAreas] = useState<QCArea[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);

  const creating = useRef(false);
  const [regenerating, setRegenerating] = useState(false);
  const [evalModal, setEvalModal] = useState(false);
  const [evalData, setEvalData] = useState<EvalData | null>(null);
  const [deletingRound, setDeletingRound] = useState<string | null>(null);
  const [selectedUnresolvedBranch, setSelectedUnresolvedBranch] = useState<string | null>(null);
  const [persistentUnresolved, setPersistentUnresolved] = useState<
    { branch: string; reportTitle: string; item: string; question: string; foundIssue: string; foundAt: string; lastCheckedAt: string; roundFound: number; roundLast: number }[]
  >([]);
  const [prevUnresolved, setPrevUnresolved] = useState<QCItem[]>([]);
  const [prevResolutions, setPrevResolutions] = useState<Record<string, { id: string | null; solved: boolean; note: string }>>({});
  const prevResolutionsRef = useRef(prevResolutions);
  prevResolutionsRef.current = prevResolutions;

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
    if (reports.length === 0) return;
    (async () => {
      const { data: allSessions } = await supabase
        .from("quality_sessions")
        .select("id, report_id, round_number, checklist, created_at, closed_at");

      if (!allSessions) return;

      const branchMap = new Map(branches.map((b) => [b.id, b.name]));
      const branchRoundResolved = new Map<string, Map<number, number>>();
      const branchRoundUnresolved = new Map<string, Map<number, number>>();
      const branchTotalResolved = new Map<string, number>();
      const branchTotalUnresolved = new Map<string, number>();
      const branchRounds = new Map<string, number>();
      const branchResolvedR1 = new Map<string, number>();

      for (const s of allSessions as { report_id: string; round_number: number; checklist: QCItem[] | null }[]) {
        const report = reports.find((r) => r.id === s.report_id);
        if (!report) continue;
        const branch = branchMap.get(report.branch_id) ?? "Unknown";
        if (!branchRoundResolved.has(branch)) branchRoundResolved.set(branch, new Map());
        if (!branchRoundUnresolved.has(branch)) branchRoundUnresolved.set(branch, new Map());
        const resolved = (s.checklist ?? []).filter((i) => i.answer === true).length;
        const unresolved = (s.checklist ?? []).filter((i) => i.answer === false).length;
        const rMap = branchRoundResolved.get(branch)!;
        const uMap = branchRoundUnresolved.get(branch)!;
        rMap.set(s.round_number, (rMap.get(s.round_number) ?? 0) + resolved);
        uMap.set(s.round_number, (uMap.get(s.round_number) ?? 0) + unresolved);
        branchTotalResolved.set(branch, (branchTotalResolved.get(branch) ?? 0) + resolved);
        branchTotalUnresolved.set(branch, (branchTotalUnresolved.get(branch) ?? 0) + unresolved);
        branchRounds.set(branch, Math.max(branchRounds.get(branch) ?? 0, s.round_number));
        if (s.round_number === 1) {
          branchResolvedR1.set(branch, (branchResolvedR1.get(branch) ?? 0) + resolved);
        }
      }

      const maxRound = Math.max(
        1,
        ...[...branchRoundResolved.values()].flatMap((m) => [...m.keys()]),
      );
      const data: { round: number; [branch: string]: number | string }[] = [];
      for (let r = 1; r <= maxRound; r++) {
        const row: { round: number; [branch: string]: number | string } = { round: r };
        for (const [branch, rounds] of branchRoundResolved) {
          row[branch] = rounds.get(r) ?? 0;
        }
        data.push(row);
      }
      setChartData(data);

      const rankings = [...branchTotalResolved.entries()].map(([name, resolved]) => {
        const unresolved = branchTotalUnresolved.get(name) ?? 0;
        const total = resolved + unresolved;
        return {
          rank: 0,
          name,
          totalIssues: total,
          resolved,
          unresolved,
          rounds: branchRounds.get(name) ?? 0,
          resolvedR1: branchResolvedR1.get(name) ?? 0,
          resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
        };
      });
      rankings.sort((a, b) => {
        if (b.resolutionRate !== a.resolutionRate) return b.resolutionRate - a.resolutionRate;
        return a.rounds - b.rounds;
      });
      rankings.forEach((r, i) => { r.rank = i + 1; });
      setBranchRankings(rankings);

      const sessionsByReport = new Map<string, { report_id: string; round_number: number; checklist: QCItem[] | null; created_at: string; closed_at: string | null }[]>();
      for (const s of allSessions as { report_id: string; round_number: number; checklist: QCItem[] | null; created_at: string; closed_at: string | null }[]) {
        if (!sessionsByReport.has(s.report_id)) sessionsByReport.set(s.report_id, []);
        sessionsByReport.get(s.report_id)!.push(s);
      }
      const persistent: typeof persistentUnresolved = [];
      for (const [reportId, reportSessions] of sessionsByReport) {
        const report = reports.find((r) => r.id === reportId);
        if (!report) continue;
        const branch = branchMap.get(report.branch_id) ?? "Unknown";
        const sorted = [...reportSessions].sort((a, b) => a.round_number - b.round_number);
        if (sorted.length < 2) continue;
        const lastSession = sorted[sorted.length - 1];
        const lastChecklist = lastSession.checklist ?? [];
        if (lastChecklist.length === 0) continue;
        const firstSession = sorted.find((s) => (s.checklist ?? []).length > 0 && s.round_number !== lastSession.round_number);
        const foundChecklist = firstSession?.checklist ?? [];
        const foundMap = new Map<string, QCItem>();
        for (const fi of foundChecklist) {
          if (fi.found_issue) foundMap.set(fi.item + "|" + fi.question, fi);
        }
        for (const li of lastChecklist) {
          if (li.answer === true) continue;
          const foundIssueText = foundMap.get(li.item + "|" + li.question)?.found_issue ?? li.found_issue;
          if (!foundIssueText) continue;
          const foundAt = firstSession?.created_at
            ? new Date(firstSession.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
            : "—";
          const lastCheckedAt = lastSession.created_at
            ? new Date(lastSession.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
            : "—";
          persistent.push({
            branch,
            reportTitle: report.title,
            item: li.item,
            question: li.question,
            foundIssue: foundIssueText,
            foundAt,
            lastCheckedAt,
            roundFound: firstSession?.round_number ?? lastSession.round_number,
            roundLast: lastSession.round_number,
          });
        }
      }
      setPersistentUnresolved(persistent);
    })();
  }, [reports, branches]);

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

  useEffect(() => {
    if (view !== "round" || !selectedSession || selectedSession.round_number !== 1) return;
    if (Object.keys(prevResolutionsRef.current).length === 0) return;
    if (prevSaveTimer.current) clearTimeout(prevSaveTimer.current);
    prevSaveTimer.current = window.setTimeout(async () => {
      const session = sessionRef.current;
      if (!session) return;
      const res = prevResolutionsRef.current;
      for (const [key, data] of Object.entries(res)) {
        if (!data.note.trim() && !data.solved) continue;
        const itemName = `__prev__${key}`;
        const content = JSON.stringify({ solved: data.solved, note: data.note });
        if (data.id) {
          await supabase.from("quality_descriptions").update({ content }).eq("id", data.id);
        } else {
          const { data: ins } = await supabase
            .from("quality_descriptions")
            .insert({ session_id: session.id, item_name: itemName, content })
            .select("id")
            .single();
          if (ins) {
            prevResolutionsRef.current = { ...prevResolutionsRef.current, [key]: { ...data, id: ins.id } };
          }
        }
      }
    }, 800);
    return () => { if (prevSaveTimer.current) clearTimeout(prevSaveTimer.current); };
  }, [prevResolutions, view]);

  const branchName = (id: string) =>
    branches.find((b) => b.id === id)?.name ?? "\u2014";
  const todayStr = () =>
    new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  const hasActiveSession = sessions.some((s) => s.status === "active");

  const prevSaveTimer = useRef<number | null>(null);
  const loadPrevUnresolved = useCallback(async (branchId: string, sessionId: string) => {
    const prevReports = reports
      .filter((r) => r.branch_id === branchId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (prevReports.length < 2) { setPrevUnresolved([]); return; }
    const prevReport = prevReports.find((r) => r.id !== prevReports[0]?.id && r.status === "closed");
    if (!prevReport) { setPrevUnresolved([]); return; }
    const { data: prevSessions } = await supabase
      .from("quality_sessions")
      .select("id, round_number, checklist")
      .eq("report_id", prevReport.id)
      .order("round_number", { ascending: false });
    if (!prevSessions || prevSessions.length === 0) { setPrevUnresolved([]); return; }
    let lastChecklist: QCItem[] = [];
    for (const s of prevSessions) {
      if (s.checklist && s.checklist.length > 0) { lastChecklist = s.checklist; break; }
    }
    const unresolved = lastChecklist.filter((i) => i.answer === false);
    setPrevUnresolved(unresolved);
    const { data: existingDescs } = await supabase
      .from("quality_descriptions")
      .select("id, item_name, content")
      .eq("session_id", sessionId);
    const resMap: Record<string, { id: string | null; solved: boolean; note: string }> = {};
    for (const item of unresolved) {
      const key = item.item + "|" + item.question;
      const existing = (existingDescs ?? []).find((d) => d.item_name === `__prev__${key}`);
      if (existing) {
        try { const parsed = JSON.parse(existing.content); resMap[key] = { id: existing.id, solved: parsed.solved, note: parsed.note }; } catch { resMap[key] = { id: existing.id, solved: false, note: existing.content }; }
      } else {
        resMap[key] = { id: null, solved: false, note: "" };
      }
    }
    setPrevResolutions(resMap);
  }, [reports]);

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
    if (!createBranchId || creating.current) return;
    creating.current = true;
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
    creating.current = false;
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
      loadPrevUnresolved(selectedReport.branch_id, session.id);
    } else {
      setPrevUnresolved([]);
      setPrevResolutions({});
    }
    setView("round");
  }

  function openSession(s: QCSession) {
    setSelectedSession(s);
    setView("round");
    if (s.round_number === 1 && selectedReport) {
      loadPrevUnresolved(selectedReport.branch_id, s.id);
    } else {
      setPrevUnresolved([]);
      setPrevResolutions({});
    }
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
        const prevResolved: { item: string; question: string; found_issue: string; solved: boolean; note: string }[] = [];
        for (const item of prevUnresolved) {
          const key = item.item + "|" + item.question;
          const res = prevResolutionsRef.current[key];
          if (res) {
            prevResolved.push({ item: item.item, question: item.question, found_issue: item.found_issue, solved: res.solved, note: res.note });
          }
        }
        const res = await fetch("/api/ai/quality-checklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ round: 1, descriptions: descs, previousUnresolved: prevResolved.length > 0 ? prevResolved : undefined }),
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

  async function deleteRound(session: QCSession) {
    if (!window.confirm(`Delete Round ${session.round_number} and its data? This cannot be undone.`)) return;
    setDeletingRound(session.id);
    await supabase.from("quality_descriptions").delete().eq("session_id", session.id);
    await supabase.from("quality_sessions").delete().eq("id", session.id);
    setSessions((p) => p.filter((s) => s.id !== session.id));
    if (selectedSession?.id === session.id) {
      setSelectedSession(null);
      setView("report");
    }
    setDeletingRound(null);
  }

  async function regenerateChecklist() {
    const r1Session = sessions.find((s) => s.round_number === 1 && s.status === "closed");
    const r2Session = sessions.find((s) => s.round_number === 2);
    if (!r1Session || !r2Session || !selectedReport) return;
    setRegenerating(true);
    try {
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
      if (!result.checklist?.length) {
        alert("AI returned no checklist items from the updated descriptions.");
        return;
      }
      const oldChecklist = r2Session.checklist ?? [];
      const oldAnswerMap = new Map(
        oldChecklist.filter((i) => i.answer !== undefined).map((i) => [i.item + "|" + i.question, i.answer])
      );
      const mergedChecklist = (result.checklist as QCItem[]).map((item) => ({
        ...item,
        answer: oldAnswerMap.get(item.item + "|" + item.question) ?? undefined,
      }));
      await supabase
        .from("quality_sessions")
        .update({ checklist: mergedChecklist })
        .eq("id", r2Session.id);
      setSessions((p) =>
        p.map((s) => (s.id === r2Session.id ? { ...s, checklist: mergedChecklist } : s)),
      );
      setView("report");
      setSelectedSession(null);
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRegenerating(false);
    }
  }

  function computeEvaluation() {
    if (!selectedReport) return null;
    const allResolved: EvalItem[] = [];
    const allUnresolved: EvalItem[] = [];
    for (const session of sessions) {
      if (session.round_number === 1) continue;
      const closedAt = session.closed_at
        ? new Date(session.closed_at).toLocaleString(undefined, {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: true,
          })
        : undefined;
      for (const item of session.checklist ?? []) {
        if (item.answer === true) {
          allResolved.push({ item: item.item, question: item.question, found_issue: item.found_issue, resolvedAt: closedAt });
        } else if (item.answer === false) {
          allUnresolved.push({ item: item.item, question: item.question, found_issue: item.found_issue });
        }
      }
    }
    return {
      resolved: allResolved,
      unresolved: allUnresolved,
      totalResolved: allResolved.length,
      totalUnresolved: allUnresolved.length,
      totalAnswered: allResolved.length + allUnresolved.length,
    };
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
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
      });
      if (session.round_number === 1) {
        const { data } = await supabase
          .from("quality_descriptions")
          .select("item_name, content, updated_at")
          .eq("session_id", session.id);
        const descs: Record<string, { text: string; writtenAt: string }> = {};
        for (const d of (data ?? []) as {
          item_name: string; content: string; updated_at: string;
        }[])
          descs[d.item_name] = {
            text: d.content,
            writtenAt: new Date(d.updated_at).toLocaleString(undefined, {
              day: "numeric", month: "short", year: "numeric",
              hour: "2-digit", minute: "2-digit", hour12: true,
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
    const { downloadQualityReportPdf } = await import("@/lib/qualityReportPdf");
    downloadQualityReportPdf({      title: selectedReport.title,
      branchName: branchName(selectedReport.branch_id),
      date: todayStr(),
      auditor: settings?.owner_name || undefined,
      rounds,
    });
  }

  function handleCloseReport() {
    const data = computeEvaluation();
    if (!data) return;
    setEvalData(data);
    setEvalModal(true);
  }

  async function confirmCloseReport() {
    if (!selectedReport) return;
    setEvalModal(false);
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
          <p className="py-20 text-center text-sm text-zinc-500">Loading\u2026</p>
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
                <h2 className="text-xl font-semibold text-zinc-50">Quality Control</h2>
                <p className="mt-1 text-sm text-zinc-500">Manage quality inspection reports</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setAreasBranchId(selectedBranchId || branches[0]?.id || ""); setAreasModal(true); }}
                  className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:bg-zinc-900/60"
                >
                  Manage Areas
                </button>
                <button
                  onClick={() => { setCreateBranchId(selectedBranchId || branches[0]?.id || ""); setCreateModal(true); }}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-900/60"
                >
                  Create Report
                </button>
              </div>
            </div>
            <div className="mb-4">
              <select
                value={selectedBranchId}
                onChange={(e) => { setSelectedBranchId(e.target.value); window.localStorage.setItem(STORAGE_BRANCH, e.target.value); }}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
              </select>
            </div>
            {chartData && chartData.length > 0 && (
              <LazyQCChart data={chartData} />
            )}
            {branchRankings.length > 0 && (
              <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-400">Branch Rankings</h3>
                <p className="mb-4 text-xs text-zinc-500">Ranked by resolution rate and speed of resolution</p>
                <div className="space-y-3">
                  {branchRankings.map((br) => (
                    <div key={br.name} className="flex items-center gap-4 rounded-lg border border-zinc-800/50 bg-zinc-900/40 p-4">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold"
                        style={{ backgroundColor: br.rank === 1 ? "#16a34a" : br.rank === 2 ? "#2563eb" : br.rank === 3 ? "#d97706" : "#3f3f46", color: br.rank <= 3 ? "#fff" : "#a1a1aa" }}
                      >{br.rank}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-100">{br.name}</span>
                          {br.rank === 1 && <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-400">Best</span>}
                          {br.rank === branchRankings.length && branchRankings.length > 1 && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-400">Needs Improvement</span>}
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-xs text-zinc-500">
                          <span>{br.resolved}/{br.totalIssues} resolved</span>
                          <span>\u00b7</span>
                          <span>{br.resolutionRate}%</span>
                          <span>\u00b7</span>
                          <span>{br.rounds} round{br.rounds !== 1 ? "s" : ""}</span>
                          <span>\u00b7</span>
                          <span>{br.resolvedR1} resolved in R1</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                          <div className="h-full rounded-full transition-all" style={{ width: `${br.resolutionRate}%`, backgroundColor: br.resolutionRate >= 80 ? "#16a34a" : br.resolutionRate >= 50 ? "#d97706" : "#dc2626" }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {persistentUnresolved.length > 0 && (() => {
              const branchGroups = new Map<string, typeof persistentUnresolved>();
              for (const item of persistentUnresolved) {
                const list = branchGroups.get(item.branch) ?? [];
                list.push(item);
                branchGroups.set(item.branch, list);
              }
              const sortedBranches = [...branchGroups.keys()].sort();
              return (
                <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
                  <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-400">Persistent Unresolved Issues</h3>
                  <p className="mb-4 text-xs text-zinc-500">Issues found in round 1 that remain unresolved — not fixed after multiple rounds</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {sortedBranches.map((b) => (
                      <button
                        key={b}
                        onClick={() => setSelectedUnresolvedBranch(selectedUnresolvedBranch === b ? null : b)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          selectedUnresolvedBranch === b
                            ? "border-amber-600 bg-amber-500/10 text-amber-400"
                            : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                        }`}
                      >
                        {b}
                        <span className="ml-1.5 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">{branchGroups.get(b)!.length}</span>
                      </button>
                    ))}
                  </div>
                  {selectedUnresolvedBranch && (
                    <div className="space-y-2">
                      {(branchGroups.get(selectedUnresolvedBranch) ?? []).map((item, idx) => (
                        <div key={idx} className="rounded-lg border border-red-900/30 bg-red-950/20 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-zinc-100">{item.item}</p>
                              <p className="text-xs text-zinc-400 mt-0.5">{item.question}</p>
                            </div>
                            <span className="shrink-0 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-400">Unresolved</span>
                          </div>
                          <p className="mt-2 text-xs text-zinc-500">Found: {item.foundIssue}</p>
                          <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-zinc-500">
                            <span>Found in R{item.roundFound} — {item.foundAt}</span>
                            <span>Last checked R{item.roundLast} — {item.lastCheckedAt}</span>
                          </div>
                          <p className="mt-1 text-[10px] text-zinc-600">Report: {item.reportTitle}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            {filteredReports.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 py-12 text-center text-sm text-zinc-500">
                No reports yet. Click &quot;Create Report&quot; to begin.
              </p>
            ) : (
              <div className="space-y-6">
                {sortedBranchIds.map((branchId) => {
                  const branchReports = reportsByBranch.get(branchId) ?? [];
                  return (
                    <div key={branchId}>
                      <h3 className="mb-3 text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                        {branchName(branchId)}
                        <span className="ml-2 text-zinc-600 normal-case tracking-normal">({branchReports.length})</span>
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {branchReports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((report) => (
                          <div key={report.id} className="group rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/40">
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <h3 className="text-sm font-semibold text-zinc-50">{report.title}</h3>
                              <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${report.status === "active" ? "bg-emerald-950 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>{report.status}</span>
                            </div>
                            <p className="text-xs text-zinc-500">{new Date(report.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                            <div className="mt-3 flex justify-end gap-2">
                              <button onClick={() => deleteReport(report.id)} className="rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-red-400 transition hover:bg-red-950 hover:border-red-800">Delete</button>
                              <button onClick={() => { setSelectedReport(report); setView("report"); }} className="rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-900/60">Open</button>
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
                <h2 className="text-xl font-semibold text-zinc-50">{selectedReport.title}</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {branchName(selectedReport.branch_id)} &middot;{" "}
                  {new Date(selectedReport.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setView("list"); setSelectedReport(null); setSelectedSession(null); }} className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-900/60">Back</button>
                <button onClick={endDay} disabled={sessions.length === 0} className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-900/60 disabled:opacity-40">End Day</button>
                {selectedReport.status === "active" && (
                  <button onClick={addRound} disabled={hasActiveSession} title={hasActiveSession ? "Close the active round first" : ""} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-900/60 disabled:opacity-40">Add Round</button>
                )}
                {selectedReport.status === "active" && (
                  <button onClick={handleCloseReport} className="rounded-lg border border-red-800 px-3 py-2 text-sm text-red-400 transition hover:bg-red-950">Close Report</button>
                )}
                <button onClick={() => deleteReport(selectedReport.id)} className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-400 transition hover:bg-red-950">Delete</button>
              </div>
            </div>
            {sessions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 py-12 text-center text-sm text-zinc-500">
                No rounds yet. Click &quot;Add Round&quot; to begin.
              </p>
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => {
                  const r2Session = sessions.find((ss) => ss.round_number === 2);
                  return (
                    <div key={s.id} className="flex items-stretch gap-2">
                      <button
                        onClick={() => openSession(s)}
                        className={`flex-1 rounded-xl border p-4 text-left transition-all duration-300 ${
                          s.status === "active" ? "border-zinc-700 bg-zinc-900/60 hover:border-zinc-700" : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-zinc-50">Round {s.round_number}</h3>
                            <p className="text-xs text-zinc-500">
                              {new Date(s.created_at).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {s.round_number === 1 ? "Item descriptions" : `${(s.checklist ?? []).length} checklist items`}
                            </p>
                            {s.round_number === 1 && s.status === "closed" && r2Session && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openSession(s); }}
                                className="mt-2 rounded-lg border border-amber-800 px-2 py-1 text-[10px] font-medium text-amber-400 transition hover:bg-amber-950"
                              >
                                Edit descriptions &amp; regenerate
                              </button>
                            )}
                          </div>
                          <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${s.status === "active" ? "bg-emerald-950 text-emerald-400" : "bg-zinc-900/60 text-zinc-500"}`}>{s.status}</span>
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteRound(s); }}
                        disabled={deletingRound === s.id}
                        className="self-center rounded-lg border border-zinc-800 px-2 py-3 text-xs text-red-400 transition hover:bg-red-950 hover:border-red-800 disabled:opacity-40"
                        title="Delete this round"
                      >
                        {deletingRound === s.id ? "\u2026" : "\u2715"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {view === "round" && selectedSession && (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-50">Round {selectedSession.round_number}</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {new Date(selectedSession.created_at).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
                  {" \u00b7 "}
                  {isRound1 ? (isClosed ? "Editing descriptions (round already closed)" : "Write descriptions for each area below") : `${resolved} resolved \u00b7 ${unresolved} unresolved`}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setView("report"); setSelectedSession(null); }} className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-900/60">Back</button>
                {isRound1 && isClosed && (
                  <button onClick={regenerateChecklist} disabled={regenerating} className="rounded-lg border border-amber-700 px-3 py-2 text-sm font-medium text-amber-400 transition hover:bg-amber-950 disabled:opacity-40">
                    {regenerating ? "Regenerating\u2026" : "Regenerate Checklist"}
                  </button>
                )}
                {!isClosed && (
                  <button onClick={closeRound} disabled={closingRound} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-900/60 disabled:opacity-40">
                    {closingRound ? "Generating\u2026" : "Close Round"}
                  </button>
                )}
              </div>
            </div>

            {isRound1 && (
              <div className="space-y-6">
                {prevUnresolved.length > 0 && (
                  <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-5">
                    <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-amber-400">Previous Day — Unresolved Issues</h3>
                    <p className="mb-4 text-xs text-zinc-500">Issues from the previous report that were not resolved. Mark each as solved or add notes.</p>
                    <div className="space-y-3">
                      {prevUnresolved.map((item) => {
                        const key = item.item + "|" + item.question;
                        const res = prevResolutions[key] ?? { id: null, solved: false, note: "" };
                        return (
                          <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-zinc-100">{item.item}</p>
                                <p className="text-xs text-zinc-400 mt-0.5">{item.question}</p>
                                <p className="text-xs text-zinc-500 mt-1">Found: {item.found_issue}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  onClick={() => setPrevResolutions((p) => ({ ...p, [key]: { ...res, solved: true } }))}
                                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${res.solved ? "bg-emerald-600 text-white" : "border border-zinc-800 text-zinc-500 hover:bg-zinc-900/60"}`}
                                >Solved</button>
                                <button
                                  onClick={() => setPrevResolutions((p) => ({ ...p, [key]: { ...res, solved: false } }))}
                                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${res.solved === false && (res.note || prevUnresolved.some((u) => u.item === item.item)) ? "bg-red-600 text-white" : "border border-zinc-800 text-zinc-500 hover:bg-zinc-900/60"}`}
                                >Not Solved</button>
                              </div>
                            </div>
                            <textarea
                              value={res.note}
                              onChange={(e) => setPrevResolutions((p) => ({ ...p, [key]: { ...res, note: e.target.value } }))}
                              placeholder="Add notes about this issue (optional)..."
                              rows={2}
                              className="mt-3 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {Object.entries(reportAreas).map(([area, areaItems]) => (
                  <div key={area}>
                    <h3 className="mb-3 text-sm font-semibold text-zinc-500 uppercase tracking-wider">{area}</h3>
                    <div className="space-y-3">
                      {areaItems.map((item) => {
                        const key = areaItemKey(area, item);
                        return (
                          <div key={key} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                            <label className="mb-2 block text-sm font-medium text-zinc-500">{item}</label>
                            <textarea
                              value={descriptions[key]?.content ?? ""}
                              onChange={(e) => setDescriptions((prev) => ({ ...prev, [key]: { ...prev[key], content: e.target.value } }))}
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

            {!isRound1 && (
              activeChecklist.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 py-12 text-center text-sm text-zinc-500">No checklist items.</p>
              ) : (
                <div className="space-y-3">
                  {activeChecklist.map((item) => (
                    <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-medium text-zinc-500">{item.item}</h4>
                          <p className="text-xs text-zinc-500">{item.question}</p>
                          <p className="mt-1 text-xs text-zinc-500">Found: {item.found_issue}</p>
                        </div>
                        {!isClosed && (
                          <div className="flex shrink-0 items-center gap-2">
                            {savingAnswer === item.id && <span className="text-[10px] text-zinc-500">saving...</span>}
                            <div className="flex gap-1">
                              <button onClick={() => answerItem(item.id, true)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${item.answer === true ? "bg-emerald-600 text-white" : "border border-zinc-800 text-zinc-500 hover:bg-zinc-900/60"}`}>Yes</button>
                              <button onClick={() => answerItem(item.id, false)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${item.answer === false ? "bg-red-600 text-white" : "border border-zinc-800 text-zinc-500 hover:bg-zinc-900/60"}`}>No</button>
                            </div>
                          </div>
                        )}
                        {isClosed && item.answer !== undefined && (
                          <span className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${item.answer ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-400"}`}>
                            {item.answer ? "Resolved" : "Unresolved"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </main>

      <Modal open={createModal} title="Create Quality Report" onClose={() => setCreateModal(false)}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-500">Branch</label>
            <select value={createBranchId} onChange={(e) => setCreateBranchId(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-700">
              <option value="">Select branch</option>
              {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-500">Title (optional)</label>
            <input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder={`Auto: Branch Quality Report \u2014 ${todayStr()}`} className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700" />
          </div>
          <button onClick={createReport} disabled={!createBranchId} className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-900/60 disabled:opacity-40">Create</button>
        </div>
      </Modal>

      <Modal open={areasModal} title="Manage Areas & Items" onClose={() => setAreasModal(false)} wide>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-500">Branch</label>
            <select value={areasBranchId} onChange={(e) => setAreasBranchId(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-700">
              <option value="">Select branch</option>
              {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
            </select>
          </div>
          {areasBranchId && (
            <>
              {areasLoading ? (
                <p className="py-4 text-center text-sm text-zinc-500">Loading...</p>
              ) : (
                <div className="space-y-4">
                  {areas.map((area) => (
                    <div key={area.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <input value={area.name} onChange={(e) => updateAreaName(area.id, e.target.value)} className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-sm font-medium text-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-700" />
                        <button onClick={() => deleteArea(area.id)} className="rounded-lg border border-red-900 px-2 py-1.5 text-xs text-red-400 transition hover:bg-red-950">Delete</button>
                      </div>
                      <div className="space-y-2">
                        {area.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="w-5 text-center text-[10px] text-zinc-500">{idx + 1}</span>
                            <input value={item} onChange={(e) => { const newItems = [...area.items]; newItems[idx] = e.target.value; updateAreaItems(area.id, newItems); }} className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700" placeholder="Item name" />
                            <button onClick={() => { const newItems = area.items.filter((_, i) => i !== idx); updateAreaItems(area.id, newItems); }} className="text-xs text-zinc-500 hover:text-red-400">x</button>
                          </div>
                        ))}
                        <button onClick={() => updateAreaItems(area.id, [...area.items, ""])} className="text-xs text-zinc-500 hover:text-zinc-500">+ Add item</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={addArea} className="w-full rounded-xl border border-dashed border-zinc-800 py-3 text-sm text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-500">+ Add Area</button>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      <Modal open={evalModal} title="Final Evaluation" onClose={() => setEvalModal(false)}>
        {evalData && (
          <div className="space-y-5">
            <p className="text-sm text-zinc-400">
              Here&apos;s the summary for <span className="font-semibold text-zinc-200">{selectedReport?.title}</span>:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {}}
                className="rounded-xl border border-emerald-800/50 bg-emerald-950/40 p-5 text-left transition hover:border-emerald-700"
              >
                <p className="text-3xl font-bold text-emerald-400">{evalData.totalResolved}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-emerald-500/80">Resolved</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">Issues fixed during inspection</p>
              </button>
              <button
                onClick={() => {}}
                className="rounded-xl border border-red-800/50 bg-red-950/40 p-5 text-left transition hover:border-red-700"
              >
                <p className="text-3xl font-bold text-red-400">{evalData.totalUnresolved}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-red-500/80">Unresolved</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">Issues still pending</p>
              </button>
            </div>
            <p className="text-xs text-zinc-500">{evalData.totalAnswered} total items answered across all rounds</p>

            {evalData.resolved.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-400">Resolved Issues</h4>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {evalData.resolved.map((item, i) => (
                    <div key={i} className="rounded-lg border border-emerald-900/30 bg-emerald-950/20 p-3">
                      <p className="text-xs font-medium text-emerald-300">{item.item}</p>
                      <p className="text-[11px] text-zinc-400">{item.question}</p>
                      <p className="text-[10px] text-zinc-500 mt-1">Found: {item.found_issue}</p>
                      {item.resolvedAt && <p className="text-[10px] text-zinc-600 mt-0.5">Resolved at: {item.resolvedAt}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {evalData.unresolved.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-400">Unresolved Issues</h4>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {evalData.unresolved.map((item, i) => (
                    <div key={i} className="rounded-lg border border-red-900/30 bg-red-950/20 p-3">
                      <p className="text-xs font-medium text-red-300">{item.item}</p>
                      <p className="text-[11px] text-zinc-400">{item.question}</p>
                      <p className="text-[10px] text-zinc-500 mt-1">Found: {item.found_issue}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEvalModal(false)} className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:bg-zinc-900/60">Cancel</button>
              <button onClick={confirmCloseReport} className="rounded-lg border border-red-800 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-950">Close Report</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
