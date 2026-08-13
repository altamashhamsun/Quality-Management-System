alter table public.audit_events
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists department_ids uuid[] not null default '{}';

update public.audit_events
set start_date = audit_date, end_date = audit_date
where start_date is null;

alter table public.audit_events
  alter column start_date set not null,
  alter column end_date set not null;

alter table public.audit_events drop column if exists audit_date;
