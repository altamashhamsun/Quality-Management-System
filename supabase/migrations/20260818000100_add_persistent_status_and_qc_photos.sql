create table if not exists quality_persistent_status (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  report_id uuid references quality_reports(id) on delete cascade,
  item text not null,
  question text not null,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table quality_persistent_status enable row level security;

create policy "Authenticated full access on quality_persistent_status"
  on quality_persistent_status for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Public read on quality_persistent_status"
  on quality_persistent_status for select
  using (true);

create index if not exists idx_persistent_status_branch_item
  on quality_persistent_status(branch_id, item, question);
