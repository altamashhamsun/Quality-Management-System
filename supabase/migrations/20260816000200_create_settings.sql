-- App settings: owner profile + which public pages visitors may see.
create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  owner_name text not null default '',
  secondary_email text,
  public_ncrs boolean not null default true,
  public_performances boolean not null default true,
  public_calendar boolean not null default true,
  public_audit boolean not null default true,
  public_hasm boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values (1)
  on conflict (id) do nothing;

alter table public.settings enable row level security;

create policy "settings_authenticated_access" on public.settings
  for all
  to authenticated
  using (true)
  with check (true);

create policy "settings_public_read" on public.settings
  for select
  to anon
  using (true);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger settings_set_updated_at
  before update on public.settings
  for each row
  execute function public.set_updated_at();
