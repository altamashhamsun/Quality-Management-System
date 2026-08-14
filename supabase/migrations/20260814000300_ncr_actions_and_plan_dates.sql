-- NCR: replace recommendations with corrective/preventive actions, root cause, consequences
alter table public.ncr_records
  drop column if exists recommendations;

alter table public.ncr_records
  add column if not exists corrective_action text,
  add column if not exists preventive_action text,
  add column if not exists root_cause text,
  add column if not exists consequences text;

-- Audit plans/reports: calendar duration + linked departments + report->plan reference
alter table public.audit_documents
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists department_ids uuid[] not null default '{}',
  add column if not exists plan_id uuid references public.audit_documents(id);
