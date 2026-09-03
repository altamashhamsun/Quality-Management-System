-- Quality Management System Database Schema

-- Quality records table
create table if not exists public.quality_records (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null check (type in ('Nonconformity', 'Corrective Action', 'Preventive Action', 'Risk')),
  status text not null default 'Open' check (status in ('Open', 'In Progress', 'Closed')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS (Row Level Security) for anonymity - public read/write for this demo
alter table public.quality_records enable row level security;

-- Allow anyone to read records
create policy "Allow public read access" on public.quality_records
  for select using (true);

-- Allow anyone to insert records
create policy "Allow public insert" on public.quality_records
  for insert with check (true);

-- Allow anyone to update records
create policy "Allow public update" on public.quality_records
  for update using (true);

-- Allow anyone to delete records
create policy "Allow public delete" on public.quality_records
  for delete using (true);
