create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.branches enable row level security;
alter table public.departments enable row level security;

create policy "branches_shared_authenticated" on public.branches
  for all
  to authenticated
  using (true)
  with check (true);

create policy "departments_shared_authenticated" on public.departments
  for all
  to authenticated
  using (true)
  with check (true);
