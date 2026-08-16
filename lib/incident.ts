export type IncidentSeverity = "minor" | "major" | "critical";
export type IncidentStatus = "resolved" | "unresolved";

export type IncidentRecord = {
  id: string;
  incident_id: string | null;
  title: string | null;
  incident_type: string | null;
  severity: IncidentSeverity | null;
  occurred_at: string | null;
  location: string | null;
  branch_id: string | null;
  branch_name: string | null;
  department_id: string | null;
  department_name: string | null;
  description: string | null;
  people_involved: string | null;
  witnesses: string | null;
  pictures: string[] | null;
  drive_links: string[] | null;
  injury: string | null;
  property_damage: string | null;
  guest_impact: string | null;
  food_safety_impact: string | null;
  operational_impact: string | null;
  immediate_cause: string | null;
  root_cause: string | null;
  contributing_factors: string | null;
  suggested_sop: string | null;
  suggested_sop_clause: string | null;
  suggested_standards: string[] | null;
  ai_capa: {
    immediate_correction: string;
    corrective_action: string;
    preventive_action: string;
  } | null;
  immediate_correction: string | null;
  corrective_action: string | null;
  preventive_action: string | null;
  responsible_person: string | null;
  deadline: string | null;
  status: IncidentStatus | null;
  created_at: string;
  resolved_at: string | null;
};

export const INCIDENT_TYPES = [
  "Health & Safety",
  "Fire & Emergency",
  "Food Safety",
  "Guest Incident",
  "Employee Incident",
  "Property",
  "Security",
  "Environmental",
  "Equipment/Technical",
  "Near Miss",
  "Other",
] as const;

export const SEVERITIES = ["minor", "major", "critical"] as const;

export const INCIDENT_STATUS = ["unresolved", "resolved"] as const;

export function isResolved(record: {
  status: string | null;
  resolved_at: string | null;
}): boolean {
  return record.status === "resolved" || !!record.resolved_at;
}

export function severityClass(severity: string | null): string {
  switch (severity) {
    case "critical":
      return "border-red-500/70 bg-red-500/15 text-red-300";
    case "major":
      return "border-orange-500/70 bg-orange-500/15 text-orange-300";
    case "minor":
      return "border-yellow-500/70 bg-yellow-500/15 text-yellow-300";
    default:
      return "border-zinc-700 bg-zinc-800 text-zinc-300";
  }
}

export function severityLabel(severity: string | null): string {
  if (!severity) return "—";
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

/** A short human-friendly identifier, e.g. INC-20260816-004-7K2Q. */
export function makeIncidentId(seed: number): string {
  const d = new Date();
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const seq = String(Math.max(0, seed + 1)).padStart(3, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INC-${y}${mm}${dd}-${seq}-${rand}`;
}
