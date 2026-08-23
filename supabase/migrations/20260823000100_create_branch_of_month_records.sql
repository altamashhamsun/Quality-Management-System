create table public.branch_of_month_records (
  id uuid primary key default gen_random_uuid(),
  month int not null,
  year int not null,
  branch_id uuid not null references branches(id),
  branch_name text not null,
  resolved int not null default 0,
  total int not null default 0,
  pct int not null default 0,
  ncrs int not null default 0,
  incidents int not null default 0,
  qc int not null default 0,
  include_qc boolean not null default true,
  created_at timestamptz not null default now(),
  unique (month, year)
);

alter table public.branch_of_month_records enable row level security;

create policy "Authenticated users can manage branch of month records"
  on public.branch_of_month_records
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Public can read branch of month records"
  on public.branch_of_month_records
  for select
  using (true);
