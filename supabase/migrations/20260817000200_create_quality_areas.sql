create table quality_areas (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table quality_areas enable row level security;

create policy "quality_areas_auth" on quality_areas
  for all using (auth.role() = 'authenticated');

create policy "quality_areas_public" on quality_areas
  for select using (true);

create index idx_quality_areas_branch on quality_areas(branch_id);
