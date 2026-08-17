"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { IncidentRecord } from "@/lib/incident";

type Branch = { id: string; name: string };

const SEVERITY_COLORS: Record<string, string> = {
  minor: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
  major: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  critical: "border-red-500/40 bg-red-500/10 text-red-300",
};

const SEVERITY_LABEL: Record<string, string> = {
  minor: "Minor",
  major: "Major",
  critical: "Critical",
};

export default function PublicIncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterBranch, setFilterBranch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: i }] = await Promise.all([
        supabase.from("branches").select("id, name").order("name"),
        supabase
          .from("incident_log")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      setBranches(b ?? []);
      setIncidents((i ?? []) as unknown as IncidentRecord[]);
      setLoading(false);
    })();
  }, []);

  const totals = {
    total: incidents.length,
    resolved: incidents.filter((i) => i.status === "resolved").length,
    unresolved: incidents.filter((i) => i.status === "unresolved").length,
  };

  const filtered = incidents.filter((i) => {
    if (filterBranch && i.branch_id !== filterBranch) return false;
    if (filterStatus && i.status !== filterStatus) return false;
    return true;
  });

  function toggle(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  function formatDate(s: string | null) {
    if (!s) return "\u2014";
    return new Date(s).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  }

  function formatTime(s: string | null) {
    if (!s) return "";
    return new Date(s).toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit",
    });
  }

  const Section = ({ label, value }: { label: string; value: string | null }) => {
    if (!value) return null;
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-txt-s">{label}</p>
        <p className="mt-0.5 text-sm text-txt">{value}</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-txt">Incident Log</h2>
        <p className="mt-1 text-sm text-txt-s">
          Reported incidents, investigations and corrective actions
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-bdr bg-card-h px-4 py-3 text-sm text-txt-s">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-lg border border-bdr bg-card px-3 py-1.5 text-txt-s">
          {totals.total} incidents
        </span>
        <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-emerald-300">
          {totals.resolved} resolved
        </span>
        <span className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-red-300">
          {totals.unresolved} unresolved
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value)}
          className="rounded-lg border border-bdr bg-card px-3 py-1.5 text-sm text-txt-s focus:outline-none focus:ring-1 focus:ring-bdr"
        >
          <option value="">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-bdr bg-card px-3 py-1.5 text-sm text-txt-s focus:outline-none focus:ring-1 focus:ring-bdr"
        >
          <option value="">All Status</option>
          <option value="unresolved">Unresolved</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-txt-s">Loading incidents...</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-bdr bg-card p-6 text-sm text-txt-s">
          No incidents found.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((inc) => {
            const isOpen = expanded === inc.id;
            const severity = inc.severity ?? "minor";
            const sevColor = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.minor;
            return (
              <div
                key={inc.id}
                className="rounded-xl border border-bdr bg-card transition-all duration-300 hover:border-bdr-h"
              >
                <button
                  onClick={() => toggle(inc.id)}
                  className="flex w-full items-start justify-between gap-3 p-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-txt">
                        {inc.title || "Untitled Incident"}
                      </h4>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${sevColor}`}>
                        {SEVERITY_LABEL[severity] ?? severity}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        inc.status === "resolved"
                          ? "bg-emerald-950 text-emerald-400"
                          : "bg-red-950 text-red-400"
                      }`}>
                        {inc.status ?? "unresolved"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-txt-s">
                      {inc.incident_id || "\u2014"} &middot;{" "}
                      {formatDate(inc.occurred_at || inc.created_at)}{" "}
                      {formatTime(inc.occurred_at)}
                      {inc.branch_name ? ` \u00b7 ${inc.branch_name}` : ""}
                      {inc.department_name ? ` \u00b7 ${inc.department_name}` : ""}
                    </p>
                  </div>
                  <span className="mt-1 text-txt-s text-xs">{isOpen ? "\u25B2" : "\u25BC"}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-bdr px-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Section label="Description" value={inc.description} />
                      <Section label="Location" value={inc.location} />
                      <Section label="Type" value={inc.incident_type} />
                      <Section label="People Involved" value={inc.people_involved} />
                      <Section label="Witnesses" value={inc.witnesses} />
                      <Section label="Injury" value={inc.injury} />
                      <Section label="Property Damage" value={inc.property_damage} />
                      <Section label="Guest Impact" value={inc.guest_impact} />
                      <Section label="Food Safety Impact" value={inc.food_safety_impact} />
                      <Section label="Operational Impact" value={inc.operational_impact} />
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Section label="Immediate Cause" value={inc.immediate_cause} />
                      <Section label="Root Cause" value={inc.root_cause} />
                      <Section label="Contributing Factors" value={inc.contributing_factors} />
                      <Section label="Suggested SOP" value={inc.suggested_sop} />
                    </div>
                    {(inc.immediate_correction || inc.corrective_action || inc.preventive_action) && (
                      <div className="mt-4 rounded-lg border border-bdr bg-card-h p-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-txt-s">
                          CAPA Actions
                        </p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Section label="Immediate Correction" value={inc.immediate_correction} />
                          <Section label="Corrective Action" value={inc.corrective_action} />
                          <Section label="Preventive Action" value={inc.preventive_action} />
                        </div>
                      </div>
                    )}
                    {(inc.responsible_person || inc.deadline) && (
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-txt-s">
                        {inc.responsible_person && (
                          <span>Responsible: <span className="text-txt">{inc.responsible_person}</span></span>
                        )}
                        {inc.deadline && (
                          <span>Deadline: <span className="text-txt">{formatDate(inc.deadline)}</span></span>
                        )}
                      </div>
                    )}
                    {(inc.pictures ?? []).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(inc.pictures ?? []).map((src, i) => (
                          <span key={i} className="text-[10px] text-txt-s">Photo {i + 1}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
