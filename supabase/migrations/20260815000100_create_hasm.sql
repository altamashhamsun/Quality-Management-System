-- HASM: Hazard Analysis and Safety Management
-- AI-generated hazard reports with photos stored in Google Drive.

create table if not exists public.hasm_records (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  status text not null default 'unresolved' check (status in ('resolved', 'unresolved')),
  report text,
  ai_json jsonb,
  pictures text[] default '{}'::text[],
  drive_links text[] default '{}'::text[],
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.hasm_records enable row level security;

create policy "hasm_records_shared_authenticated" on public.hasm_records
  for all
  to authenticated
  using (true)
  with check (true);

-- Public View portal: visitors can READ hazard reports (read-only).
create policy "public_read_hasm_records" on public.hasm_records
  for select
  to anon
  using (true);
