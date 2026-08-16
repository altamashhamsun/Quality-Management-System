-- Public View portal: allow anonymous (public) visitors to READ data only.
-- Writes remain restricted to authenticated users only.
-- No anon policy grants INSERT/UPDATE/DELETE anywhere.

create policy "public_read_branches" on public.branches
  for select
  to anon
  using (true);

create policy "public_read_departments" on public.departments
  for select
  to anon
  using (true);

create policy "public_read_ncr_records" on public.ncr_records
  for select
  to anon
  using (true);

create policy "public_read_audit_events" on public.audit_events
  for select
  to anon
  using (true);

create policy "public_read_audit_documents" on public.audit_documents
  for select
  to anon
  using (true);
