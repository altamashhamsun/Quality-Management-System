-- Incident Log: structured incident registration with AI-suggested SOP / ISO
-- clauses and a CAPA plan. Photos are stored in Google Drive.

create table if not exists public.incident_log (
  id uuid primary key default gen_random_uuid(),
  incident_id text not null,
  title text not null,
  incident_type text,
  severity text check (severity in ('minor', 'major', 'critical')),
  occurred_at timestamptz,
  location text,
  branch_id uuid references public.branches(id) on delete set null,
  branch_name text,
  department_id uuid references public.departments(id) on delete set null,
  department_name text,
  description text,
  people_involved text,
  witnesses text,
  pictures text[] default '{}'::text[],
  drive_links text[] default '{}'::text[],
  injury text,
  property_damage text,
  guest_impact text,
  food_safety_impact text,
  operational_impact text,
  immediate_cause text,
  root_cause text,
  contributing_factors text,
  suggested_sop text,
  suggested_sop_clause text,
  suggested_standards text[] default '{}'::text[],
  ai_capa jsonb,
  immediate_correction text,
  corrective_action text,
  preventive_action text,
  responsible_person text,
  deadline timestamptz,
  status text not null default 'unresolved' check (status in ('resolved', 'unresolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.incident_log enable row level security;

create policy "incident_log_shared_authenticated" on public.incident_log
  for all
  to authenticated
  using (true)
  with check (true);

-- Public View portal: visitors can READ incident log entries (read-only).
create policy "public_read_incident_log" on public.incident_log
  for select
  to anon
  using (true);
