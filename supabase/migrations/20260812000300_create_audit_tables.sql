create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  objective text,
  audit_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_documents (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('plan', 'report', 'capa')),
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.audit_events enable row level security;
alter table public.audit_documents enable row level security;

create policy "audit_events_shared_authenticated" on public.audit_events
  for all
  to authenticated
  using (true)
  with check (true);

create policy "audit_documents_shared_authenticated" on public.audit_documents
  for all
  to authenticated
  using (true)
  with check (true);
