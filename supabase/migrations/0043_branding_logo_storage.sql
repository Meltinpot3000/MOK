-- 0043_branding_logo_storage.sql
-- Create storage bucket + tenant-scoped policies for branding logo uploads.
-- migrate:up

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-branding',
  'tenant-branding',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tenant_branding_logo_select on storage.objects;
create policy tenant_branding_logo_select on storage.objects
for select
using (
  bucket_id = 'tenant-branding'
  and split_part(name, '/', 1) = 'organizations'
  and exists (
    select 1
    from app.organization_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and split_part(name, '/', 2) = m.organization_id::text
  )
);

drop policy if exists tenant_branding_logo_insert on storage.objects;
create policy tenant_branding_logo_insert on storage.objects
for insert
with check (
  bucket_id = 'tenant-branding'
  and split_part(name, '/', 1) = 'organizations'
  and exists (
    select 1
    from app.organization_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and split_part(name, '/', 2) = m.organization_id::text
  )
);

drop policy if exists tenant_branding_logo_update on storage.objects;
create policy tenant_branding_logo_update on storage.objects
for update
using (
  bucket_id = 'tenant-branding'
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
  bucket_id = 'tenant-branding'
  and split_part(name, '/', 1) = 'organizations'
  and exists (
    select 1
    from app.organization_memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and split_part(name, '/', 2) = m.organization_id::text
  )
);

drop policy if exists tenant_branding_logo_delete on storage.objects;
create policy tenant_branding_logo_delete on storage.objects
for delete
using (
  bucket_id = 'tenant-branding'
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
drop policy if exists tenant_branding_logo_delete on storage.objects;
drop policy if exists tenant_branding_logo_update on storage.objects;
drop policy if exists tenant_branding_logo_insert on storage.objects;
drop policy if exists tenant_branding_logo_select on storage.objects;

