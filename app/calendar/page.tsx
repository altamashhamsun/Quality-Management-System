"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import Header from "@/components/Header";
import Modal from "@/components/Modal";
import { downloadAuditPlanPdf } from "@/lib/auditPlanPdf";

type AuditEvent = {
  id: string;
  title: string;
  objective: string | null;
  start_date: string;
  end_date: string;
  department_ids: string[];
  created_at: string;
};

type PlanDoc = {
  id: string;
  title: string;
  objective: string | null;
  start_date: string | null;
  end_date: string | null;
  department_ids: string[];
  content: Record<string, string> | null;
  created_at: string | null;
};

type CalendarItem = {
  id: string;
  kind: "event" | "plan";
  title: string;
  objective: string | null;
  start_date: string;
  end_date: string;
  department_ids: string[];
  content: Record<string, string> | null;
  created_at: string | null;
};

type Department = {
  id: string;
  name: string;
  branches: { name: string } | { name: string }[] | null;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function rangeInMonth(
  start: string,
  end: string,
  year: number,
  month: number,
): string[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const s = parseKey(start) < first ? first : parseKey(start);
  const e = parseKey(end) > last ? last : parseKey(end);
  const keys: string[] = [];
  for (let d = s; d <= e; d.setDate(d.getDate() + 1)) {
    keys.push(toDateKey(d));
  }
  return keys;
}

function formatRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  return `${parseKey(start).toLocaleDateString(undefined, opts)} — ${parseKey(end).toLocaleDateString(undefined, opts)}`;
}

export default function CalendarPage() {
  const { loading } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AuditEvent | null>(null);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadAuditor, setLeadAuditor] = useState("");

  const load = useCallback(async () => {
    const [eventsResult, deptsResult, plansResult] = await Promise.all([
      supabase
        .from("audit_events")
        .select("id, title, objective, start_date, end_date, department_ids, created_at")
        .order("start_date", { ascending: true }),
      supabase.from("departments").select("id, name, branches(name)"),
      supabase
        .from("audit_documents")
        .select("id, title, description, content, start_date, end_date, department_ids, created_at")
        .eq("category", "plan")
        .order("start_date", { ascending: true }),
    ]);

    if (!eventsResult.error) setEvents(eventsResult.data ?? []);
    if (!deptsResult.error) setDepartments(deptsResult.data ?? []);
    if (!plansResult.error) {
      const withDates: PlanDoc[] = (plansResult.data ?? [])
        .filter(
          (p) =>
            p.start_date &&
            p.end_date &&
            typeof p.department_ids !== "undefined",
        )
        .map((p) => ({
          id: p.id,
          title: p.title,
          objective: p.description ?? null,
          start_date: p.start_date,
          end_date: p.end_date,
          department_ids: p.department_ids ?? [],
          content: p.content,
          created_at: p.created_at ?? null,
        }));
      setPlans(withDates);
    }
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    (async () => {
      await load();
    })();
  }, [loading, load]);

  useEffect(() => {
    if (loading) return;
    supabase
      .from("settings")
      .select("owner_name")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.owner_name) setLeadAuditor(data.owner_name);
      });
  }, [loading]);

  const departmentsByBranch = useMemo(() => {
    const groups: { branch: string; items: Department[] }[] = [];
    const map = new Map<string, Department[]>();
    for (const dept of departments) {
      const branch = Array.isArray(dept.branches)
        ? (dept.branches[0]?.name ?? "Other")
        : (dept.branches?.name ?? "Other");
      if (!map.has(branch)) map.set(branch, []);
      map.get(branch)!.push(dept);
    }
    for (const [branch, items] of map) groups.push({ branch, items });
    return groups;
  }, [departments]);

  const deptName = useMemo(() => {
    const map = new Map(departments.map((d) => [d.id, d.name]));
    return (id: string) => map.get(id) ?? "Unknown";
  }, [departments]);

  const deptBranch = useMemo(() => {
    const map = new Map<string, string>();
    for (const dept of departments) {
      const branch = Array.isArray(dept.branches)
        ? (dept.branches[0]?.name ?? "Other")
        : (dept.branches?.name ?? "Other");
      map.set(dept.id, branch);
    }
    return map;
  }, [departments]);

  const branchesForEvent = useCallback(
    (event: { department_ids: string[] }) => {
      const set = new Set<string>();
      for (const id of event.department_ids) {
        const branch = deptBranch.get(id);
        if (branch) set.add(branch);
      }
      return [...set];
    },
    [deptBranch],
  );

  function openCreate(dateKey: string) {
    setEditing(null);
    setStartDate(dateKey);
    setEndDate(dateKey);
    setTitle("");
    setObjective("");
    setSelectedDepts([]);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(event: AuditEvent) {
    setEditing(event);
    setTitle(event.title);
    setObjective(event.objective ?? "");
    setStartDate(event.start_date);
    setEndDate(event.end_date);
    setSelectedDepts(event.department_ids);
    setError(null);
    setModalOpen(true);
  }

  function toggleDept(id: string) {
    setSelectedDepts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;
    if (endDate < startDate) {
      setError("End date cannot be before start date.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      title: title.trim(),
      objective: objective.trim() === "" ? null : objective.trim(),
      start_date: startDate,
      end_date: endDate,
      department_ids: selectedDepts,
    };

    let result;
    if (editing) {
      result = await supabase
        .from("audit_events")
        .update(payload)
        .eq("id", editing.id);
    } else {
      result = await supabase.from("audit_events").insert(payload);
    }

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setModalOpen(false);
    load();
  }

  async function handleDelete(event: AuditEvent) {
    if (!confirm(`Delete audit "${event.title}"?`)) return;
    const { error } = await supabase
      .from("audit_events")
      .delete()
      .eq("id", event.id);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  }

  function moveMonth(delta: number) {
    let month = viewMonth + delta;
    let year = viewYear;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    setViewMonth(month);
    setViewYear(year);
  }

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    for (const event of events) {
      for (const key of rangeInMonth(
        event.start_date,
        event.end_date,
        viewYear,
        viewMonth,
      )) {
        (map[key] ??= []).push({
          id: event.id,
          kind: "event",
          title: event.title,
          objective: event.objective,
          start_date: event.start_date,
          end_date: event.end_date,
          department_ids: event.department_ids,
          content: null,
          created_at: event.created_at,
        });
      }
    }
    for (const plan of plans) {
      for (const key of rangeInMonth(
        plan.start_date!,
        plan.end_date!,
        viewYear,
        viewMonth,
      )) {
        (map[key] ??= []).push({
          id: plan.id,
          kind: "plan",
          title: plan.title,
          objective: plan.objective,
          start_date: plan.start_date!,
          end_date: plan.end_date!,
          department_ids: plan.department_ids,
          content: plan.content,
          created_at: plan.created_at,
        });
      }
    }
    return map;
  }, [events, plans, viewYear, viewMonth]);

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const todayKey = toDateKey(new Date());
  const isCurrentMonth =
    new Date().getFullYear() === viewYear && new Date().getMonth() === viewMonth;

  const cells: (number | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const upcoming = useMemo(
    () =>
      [
        ...events.map<CalendarItem>((e) => ({
          id: e.id,
          kind: "event",
          title: e.title,
          objective: e.objective,
          start_date: e.start_date,
          end_date: e.end_date,
          department_ids: e.department_ids,
          content: null,
          created_at: e.created_at,
        })),
        ...plans.map<CalendarItem>((p) => ({
          id: p.id,
          kind: "plan",
          title: p.title,
          objective: p.objective,
          start_date: p.start_date!,
          end_date: p.end_date!,
          department_ids: p.department_ids,
          content: p.content,
          created_at: p.created_at,
        })),
      ].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [events, plans],
  );

  function handlePlanPdf(item: CalendarItem) {
    downloadAuditPlanPdf({
      title: item.title,
      reference: `AUD-${item.id.slice(0, 8)}`,
      dateRange: formatRange(item.start_date, item.end_date),
      departments: item.department_ids.map(deptName),
      content: item.content,
      leadAuditor,
    });
  }

  const inputClass =
    "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-300";

  return (
    <div className="min-h-full bg-[#050507] font-sans">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-50">Calendar</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Schedule audit date ranges with objectives and departments to check
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => moveMonth(-1)}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
            >
              &larr; Prev
            </button>
            <span className="min-w-44 text-center text-sm font-medium text-zinc-200">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              onClick={() => moveMonth(1)}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
            >
              Next &rarr;
            </button>
          </div>
        </div>

        {dataLoading ? (
          <p className="text-sm text-zinc-500">Loading calendar...</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60">
            <div className="grid grid-cols-7 border-b border-zinc-800">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-xs"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                if (day === null) {
                  return (
                    <div
                      key={`empty-${i}`}
                      className="min-h-16 border-b border-r border-zinc-800/40 bg-zinc-950/30 sm:min-h-24"
                    />
                  );
                }

                const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayEvents = eventsByDate[dateKey] ?? [];
                const isToday = isCurrentMonth && dateKey === todayKey;

                return (
                  <div
                    key={dateKey}
                    className={`min-h-16 cursor-pointer border-b border-r border-zinc-800/40 p-1.5 transition-colors hover:bg-zinc-900/50 sm:min-h-24 sm:p-2 ${
                      isToday ? "bg-zinc-400/10" : ""
                    }`}
                    onClick={() => openCreate(dateKey)}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] sm:text-xs ${
                          isToday
                            ? "bg-zinc-50 font-bold text-zinc-950"
                            : "text-zinc-400"
                        }`}
                      >
                        {day}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[9px] text-zinc-500">
                          {dayEvents.length} audit{dayEvents.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <button
                          key={`${event.kind}-${event.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (event.kind === "plan") {
                              handlePlanPdf(event);
                            } else {
                              openEdit(event as AuditEvent);
                            }
                          }}
                          className={`truncate rounded border px-1 py-0.5 text-left text-[9px] transition-colors hover:border-zinc-400 hover:text-white sm:text-[11px] ${
                            event.kind === "plan"
                              ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                              : "border-zinc-700 bg-zinc-900 text-zinc-200"
                          }`}
                          title={
                            `${event.title}\n${formatRange(event.start_date, event.end_date)}` +
                            (event.objective ? `\nObjective: ${event.objective}` : "") +
                            `\nBranches: ${branchesForEvent(event).join(", ") || "—"}` +
                            (event.department_ids.length
                              ? `\nDepartments: ${event.department_ids.map(deptName).join(", ")}`
                              : "") +
                            (event.kind === "plan" ? "\n\nClick to download plan PDF" : "")
                          }
                        >
                          {event.kind === "plan" ? "Plan: " : ""}
                          {event.title}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="px-1 text-[9px] text-zinc-500">
                          +{dayEvents.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-8">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            All Audits
          </h3>
          {upcoming.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No audits scheduled yet. Click any day to add one.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {upcoming.map((event) => (
                <div
                  key={`${event.kind}-${event.id}`}
                  className={`rounded-xl border p-4 transition-colors hover:border-zinc-600 ${
                    event.kind === "plan"
                      ? "border-indigo-500/40 bg-indigo-500/[0.06]"
                      : "border-zinc-800 bg-zinc-950/60"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-zinc-100">
                          {event.title}
                        </h4>
                        {event.kind === "plan" && (
                          <span className="rounded border border-indigo-500/50 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-indigo-300">
                            Audit Plan
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {formatRange(event.start_date, event.end_date)}
                      </p>
                      {event.objective && (
                        <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                          <span className="text-zinc-500">Objective: </span>
                          {event.objective}
                        </p>
                      )}
                      {(() => {
                        const branches = branchesForEvent(event);
                        return branches.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                              Branch{event.department_ids.length > 1 ? "es" : ""}:
                            </span>
                            {branches.map((branch) => (
                              <span
                                key={branch}
                                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-200"
                              >
                                {branch}
                              </span>
                            ))}
                          </div>
                        ) : null;
                      })()}
                      {event.department_ids.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {event.department_ids.map((id) => (
                            <span
                              key={id}
                              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300"
                            >
                              {deptName(id)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {event.kind === "plan" ? (
                        <button
                          onClick={() => handlePlanPdf(event)}
                          className="rounded-lg border border-indigo-500/50 bg-indigo-500/10 px-2.5 py-1.5 text-xs text-indigo-200 transition-colors hover:bg-indigo-500/20"
                        >
                          Plan PDF
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => openEdit(event as AuditEvent)}
                            className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(event as AuditEvent)}
                            className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-300 hover:text-white"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Modal
        open={modalOpen}
        title={editing ? "Edit Audit" : "Add Audit"}
        onClose={() => setModalOpen(false)}
        wide
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
            Audit Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Internal Quality Audit"
              autoFocus
              required
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
              Start Date
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
                required
                className={`${inputClass} [color-scheme:dark]`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
              End Date
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                min={startDate}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
            Audit Objective
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Verify compliance with ISO 9001:2015 requirements"
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </label>

          <div>
            <p className="mb-2 text-sm font-medium text-zinc-300">
              Departments to check
            </p>
            {departmentsByBranch.length === 0 ? (
              <p className="text-xs text-zinc-500">
                No departments found. Add departments under Branches first.
              </p>
            ) : (
              <div className="flex max-h-56 flex-col gap-4 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                {departmentsByBranch.map((group) => (
                  <div key={group.branch}>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      {group.branch}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map((dept) => {
                        const selected = selectedDepts.includes(dept.id);
                        return (
                          <button
                            type="button"
                            key={dept.id}
                            onClick={() => toggleDept(dept.id)}
                            className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                              selected
                                ? "border-zinc-200 bg-zinc-100 text-zinc-950"
                                : "border-zinc-700 text-zinc-300 hover:border-zinc-400 hover:text-white"
                            }`}
                          >
                            {dept.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
              {error}
            </p>
          )}
          <div className="mt-2 flex gap-3">
            {editing && (
              <button
                type="button"
                onClick={() => handleDelete(editing)}
                className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all duration-300 hover:border-zinc-300 hover:text-white"
              >
                Delete
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 transition-all duration-300 hover:bg-white disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Save Changes" : "Add Audit"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
