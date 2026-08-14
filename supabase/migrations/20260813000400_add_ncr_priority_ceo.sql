alter table public.ncr_records
  add column if not exists priority text,
  add column if not exists reported_to_ceo boolean default false;
