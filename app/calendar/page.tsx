"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import Header from "@/components/Header";
import Modal from "@/components/Modal";

type AuditEvent = {
  id: string;
  title: string;
  objective: string | null;
  audit_date: string;
  created_at: string;
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

const COLORS = [
  { badge: "bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20", key: "cyan" },
  { badge: "bg-pink-400/10 text-pink-300 hover:bg-pink-400/20", key: "pink" },
  { badge: "bg-violet-400/10 text-violet-300 hover:bg-violet-400/20", key: "violet" },
  { badge: "bg-amber-400/10 text-amber-300 hover:bg-amber-400/20", key: "amber" },
] as const;

function toLocalDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function CalendarPage() {
  const { loading } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AuditEvent | null>(null);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("audit_events")
      .select("id, title, objective, audit_date, created_at")
      .order("audit_date", { ascending: true });
    if (!error) setEvents(data ?? []);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    (async () => {
      await load();
    })();
  }, [loading, load]);

  function openCreate(dateKey: string) {
    setEditing(null);
    setSelectedDate(dateKey);
    setTitle("");
    setObjective("");
    setError(null);
    setModalOpen(true);
  }

  function openEdit(event: AuditEvent) {
    setEditing(event);
    setSelectedDate(event.audit_date);
    setTitle(event.title);
    setObjective(event.objective ?? "");
    setError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !selectedDate) return;

    setSaving(true);
    setError(null);

    const payload = {
      title: title.trim(),
      objective: objective.trim() === "" ? null : objective.trim(),
      audit_date: selectedDate,
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
    const { error } = await supabase.from("audit_events").delete().eq("id", event.id);
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

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const eventsByDate: Record<string, AuditEvent[]> = {};
  for (const event of events) {
    (eventsByDate[event.audit_date] ??= []).push(event);
  }

  const todayKey = toLocalDateKey(new Date());
  const isCurrentMonth =
    new Date().getFullYear() === viewYear && new Date().getMonth() === viewMonth;

  const cells: (number | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const inputClass =
    "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none transition-colors placeholder:text-zinc-600 focus:border-cyan-400/60";

  return (
    <div className="min-h-full bg-[#050507] font-sans">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="neon-text-violet text-xl font-semibold">Calendar</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Align your audits and set audit objectives
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => moveMonth(-1)}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-cyan-400/60 hover:text-cyan-300"
            >
              &larr; Prev
            </button>
            <span className="min-w-44 text-center text-sm font-medium text-zinc-200">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              onClick={() => moveMonth(1)}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-cyan-400/60 hover:text-cyan-300"
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
                  return <div key={`empty-${i}`} className="min-h-16 border-b border-r border-zinc-800/40 bg-zinc-950/30 sm:min-h-24" />;
                }

                const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayEvents = eventsByDate[dateKey] ?? [];
                const isToday = isCurrentMonth && dateKey === todayKey;

                return (
                  <div
                    key={dateKey}
                    className={`min-h-16 cursor-pointer border-b border-r border-zinc-800/40 p-1.5 transition-colors hover:bg-zinc-900/50 sm:min-h-24 sm:p-2 ${
                      isToday ? "bg-cyan-400/5" : ""
                    }`}
                    onClick={() => openCreate(dateKey)}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] sm:text-xs ${
                          isToday
                            ? "bg-cyan-400 font-bold text-zinc-950 shadow-[0_0_12px_rgba(34,211,238,0.6)]"
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
                      {dayEvents.slice(0, 3).map((event, j) => (
                        <button
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(event);
                          }}
                          className={`truncate rounded px-1 py-0.5 text-left text-[9px] transition-colors sm:text-[11px] ${COLORS[j % COLORS.length].badge}`}
                          title={event.objective ?? event.title}
                        >
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

        <p className="mt-4 text-xs text-zinc-600">
          Click any day to add an audit for that date.
        </p>
      </main>

      <Modal
        open={modalOpen}
        title={editing ? "Edit Audit" : "Add Audit"}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {selectedDate && (
            <p className="text-sm text-zinc-500">
              Date:{" "}
              <span className="font-medium text-zinc-300">
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
                  undefined,
                  { weekday: "long", year: "numeric", month: "long", day: "numeric" },
                )}
              </span>
            </p>
          )}
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
          {error && (
            <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          <div className="mt-2 flex gap-3">
            {editing && (
              <button
                type="button"
                onClick={() => handleDelete(editing)}
                className="rounded-lg bg-red-950/40 px-4 py-2.5 text-sm font-medium text-red-400 transition-all duration-300 hover:bg-red-950/70"
              >
                Delete
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-cyan-400/20 px-4 py-2.5 text-sm font-medium text-cyan-300 transition-all duration-300 hover:bg-cyan-400/30 disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Save Changes" : "Add Audit"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
