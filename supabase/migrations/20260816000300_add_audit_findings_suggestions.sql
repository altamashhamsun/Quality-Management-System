alter table public.audit_findings
  add column if not exists suggestions jsonb;
