create table if not exists public.audit_sessions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  branch_name text,
  department_name text,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.audit_sessions(id) on delete cascade,
  raw text,
  rephrased text,
  clause_number text,
  clause_name text,
  corrective_action text,
  preventive_action text,
  root_cause text,
  consequences text,
  standard text,
  pictures text[] default '{}'::text[],
  drive_links text[] default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.audit_sessions enable row level security;
alter table public.audit_findings enable row level security;

create policy "audit_sessions_shared_authenticated" on public.audit_sessions
  for all
  to authenticated
  using (true)
  with check (true);

create policy "audit_findings_shared_authenticated" on public.audit_findings
  for all
  to authenticated
  using (true)
  with check (true);
