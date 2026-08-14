alter table public.ncr_records
  add column if not exists pictures text[] default '{}'::text[];

insert into storage.buckets (id, name, public)
values ('ncr-images', 'ncr-images', true)
on conflict (id) do nothing;

create policy "ncr_images_authenticated_upload" on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'ncr-images');

create policy "ncr_images_authenticated_update" on storage.objects
  for update
  to authenticated
  using (bucket_id = 'ncr-images')
  with check (bucket_id = 'ncr-images');

create policy "ncr_images_authenticated_delete" on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'ncr-images');
