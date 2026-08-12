create table if not exists public.ncr_records (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  ncr_number text,
  description text,
  branch text,
  clause text,
  opening_ncs integer default 0,
  closing_ncs integer default 0,
  recommendations text,
  status text,
  hod_name text,
  hod_comments text,
  branch_manager text,
  branch_manager_comments text,
  hr text,
  hr_comments text,
  ceo text,
  ceo_comments text,
  created_at timestamptz not null default now()
);

alter table public.ncr_records enable row level security;

create policy "ncr_records_shared_authenticated" on public.ncr_records
  for all
  to authenticated
  using (true)
  with check (true);
