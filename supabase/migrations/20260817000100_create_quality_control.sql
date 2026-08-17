create table quality_reports (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete cascade,
  title text not null default 'Quality Report',
  status text not null default 'active' check (status in ('active', 'closed')),
  items jsonb not null default '[]',
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table quality_sessions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references quality_reports(id) on delete cascade,
  round_number integer not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  checklist jsonb,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table quality_descriptions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quality_sessions(id) on delete cascade,
  item_name text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table quality_reports enable row level security;
alter table quality_sessions enable row level security;
alter table quality_descriptions enable row level security;

create policy "quality_reports_auth" on quality_reports for all using (auth.role() = 'authenticated');
create policy "quality_reports_public" on quality_reports for select using (true);
create policy "quality_sessions_auth" on quality_sessions for all using (auth.role() = 'authenticated');
create policy "quality_sessions_public" on quality_sessions for select using (true);
create policy "quality_descriptions_auth" on quality_descriptions for all using (auth.role() = 'authenticated');
create policy "quality_descriptions_public" on quality_descriptions for select using (true);

create index idx_quality_sessions_report on quality_sessions(report_id);
create index idx_quality_descriptions_session on quality_descriptions(session_id);

create trigger quality_descriptions_set_updated_at
  before update on quality_descriptions
  for each row execute function public.set_updated_at();
