"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

export default function PublicCalendarPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  useEffect(() => {
    (async () => {
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
        setPlans(
          (plansResult.data ?? [])
            .filter((p) => p.start_date && p.end_date)
            .map((p) => ({
              id: p.id,
              title: p.title,
              objective: p.description ?? null,
              start_date: p.start_date,
              end_date: p.end_date,
              department_ids: p.department_ids ?? [],
              content: p.content,
              created_at: p.created_at ?? null,
            })),
        );
      }
      setLoading(false);
    })();
  }, []);

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

  const branchesForEvent = useMemo(() => {
    return (departmentIds: string[]) => {
      const set = new Set<string>();
      for (const id of departmentIds) {
        const branch = deptBranch.get(id);
        if (branch) set.add(branch);
      }
      return [...set];
    };
  }, [deptBranch]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    for (const event of events) {
      for (const key of rangeInMonth(event.start_date, event.end_date, viewYear, viewMonth)) {
        (map[key] ??= []).push({
          id: event.id,
          kind: "event",
          title: event.title,
          objective: event.objective,
          start_date: event.start_date,
          end_date: event.end_date,
          department_ids: event.department_ids,
          created_at: event.created_at,
        });
      }
    }
    for (const plan of plans) {
      if (!plan.start_date || !plan.end_date) continue;
      for (const key of rangeInMonth(plan.start_date, plan.end_date, viewYear, viewMonth)) {
        (map[key] ??= []).push({
          id: plan.id,
          kind: "plan",
          title: plan.title,
          objective: plan.objective,
          start_date: plan.start_date,
          end_date: plan.end_date,
          department_ids: plan.department_ids,
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
          created_at: p.created_at,
        })),
      ].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [events, plans],
  );

  function moveMonth(dir: number) {
    let month = viewMonth + dir;
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-50">Calendar</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Upcoming audit schedules per month
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

      {loading ? (
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
                  className={`min-h-16 border-b border-r border-zinc-800/40 p-1.5 sm:min-h-24 sm:p-2 ${
                    isToday ? "bg-zinc-400/10" : ""
                  }`}
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
                      <div
                        key={`${event.kind}-${event.id}`}
                        className={`truncate rounded border px-1 py-0.5 text-left text-[9px] sm:text-[11px] ${
                          event.kind === "plan"
                            ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                            : "border-zinc-700 bg-zinc-900 text-zinc-200"
                        }`}
                        title={
                          `${event.title}\n${formatRange(event.start_date, event.end_date)}` +
                          (event.objective ? `\nObjective: ${event.objective}` : "") +
                          `\nBranches: ${branchesForEvent(event.department_ids).join(", ") || "—"}`
                        }
                      >
                        {event.kind === "plan" ? "Plan: " : ""}
                        {event.title}
                      </div>
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

      <div className="mt-2">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          All Audits
        </h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-zinc-500">No audits scheduled yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map((event) => (
              <div
                key={`${event.kind}-${event.id}`}
                className={`rounded-xl border p-4 ${
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
                    {(() => {
                      const branches = branchesForEvent(event.department_ids);
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
