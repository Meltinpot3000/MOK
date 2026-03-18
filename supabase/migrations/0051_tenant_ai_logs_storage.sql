-- 0051_tenant_ai_logs_storage.sql
-- Create storage bucket + tenant-scoped policies for AI action logs.
-- migrate:up

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-ai-logs',
  'tenant-ai-logs',
  false,
  10485760,
  array['application/json', 'text/plain']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tenant_ai_logs_select on storage.objects;
create policy tenant_ai_logs_select on storage.objects
for select
using (
  bucket_id = 'tenant-ai-logs'
  and split_part(name, '/', 1) = 'organizations'
  and exists (
    select 1
    from app.organization_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and split_part(name, '/', 2) = m.organization_id::text
  )
);

drop policy if exists tenant_ai_logs_insert on storage.objects;
create policy tenant_ai_logs_insert on storage.objects
for insert
with check (
  bucket_id = 'tenant-ai-logs'
  and split_part(name, '/', 1) = 'organizations'
  and exists (
    select 1
    from app.organization_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and split_part(name, '/', 2) = m.organization_id::text
  )
);

drop policy if exists tenant_ai_logs_update on storage.objects;
create policy tenant_ai_logs_update on storage.objects
for update
using (
  bucket_id = 'tenant-ai-logs'
  and split_part(name, '/', 1) = 'organizations'
  and exists (
    select 1
    from app.organization_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and split_part(name, '/', 2) = m.organization_id::text
  )
)
with check (
  bucket_id = 'tenant-ai-logs'
  and split_part(name, '/', 1) = 'organizations'
  and exists (
    select 1
    from app.organization_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and split_part(name, '/', 2) = m.organization_id::text
  )
);

drop policy if exists tenant_ai_logs_delete on storage.objects;
create policy tenant_ai_logs_delete on storage.objects
for delete
using (
  bucket_id = 'tenant-ai-logs'
  and split_part(name, '/', 1) = 'organizations'
  and exists (
    select 1
    from app.organization_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and split_part(name, '/', 2) = m.organization_id::text
  )
);

-- migrate:down
drop policy if exists tenant_ai_logs_delete on storage.objects;
drop policy if exists tenant_ai_logs_update on storage.objects;
drop policy if exists tenant_ai_logs_insert on storage.objects;
drop policy if exists tenant_ai_logs_select on storage.objects;
