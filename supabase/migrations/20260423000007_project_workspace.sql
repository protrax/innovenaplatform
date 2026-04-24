-- Phase 4: project workspace — tasks, files, messaging
-- Brings agencies and customers into one shared surface per project.

-------------------------------------------------------------------------------
-- project_tasks
-------------------------------------------------------------------------------
create type task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
create type task_visibility as enum ('shared', 'internal');

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  status task_status not null default 'todo',
  visibility task_visibility not null default 'shared',
  due_date date,
  sort_order int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_tasks_project_idx on public.project_tasks(project_id, sort_order);
create index project_tasks_tenant_idx on public.project_tasks(tenant_id);
create index project_tasks_assigned_idx on public.project_tasks(assigned_to) where assigned_to is not null;

create trigger project_tasks_updated_at before update on public.project_tasks
  for each row execute function public.set_updated_at();

alter table public.project_tasks enable row level security;

-- Task visibility rules:
--   shared  → customer + any tenant member on the project + admin
--   internal → only the tenant that created it + admin (hidden from customer)
create policy "tasks_select" on public.project_tasks
  for select using (
    public.is_admin()
    or public.is_tenant_member(tenant_id)
    or (
      visibility = 'shared'
      and exists (
        select 1 from public.projects p
        where p.id = project_tasks.project_id and p.customer_id = auth.uid()
      )
    )
  );

create policy "tasks_insert_tenant" on public.project_tasks
  for insert with check (
    public.is_tenant_member(tenant_id)
  );

create policy "tasks_update_tenant" on public.project_tasks
  for update using (public.is_tenant_member(tenant_id) or public.is_admin());

create policy "tasks_delete_tenant" on public.project_tasks
  for delete using (public.is_tenant_member(tenant_id) or public.is_admin());

-------------------------------------------------------------------------------
-- project_files — metadata rows; actual bytes live in Supabase Storage
-------------------------------------------------------------------------------
create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  uploaded_by uuid not null references public.profiles(id) on delete set null,
  -- Storage bucket + object path (bucket is always "project-files")
  storage_path text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  visibility task_visibility not null default 'shared',
  created_at timestamptz not null default now()
);

create index project_files_project_idx on public.project_files(project_id, created_at desc);
create index project_files_tenant_idx on public.project_files(tenant_id);

alter table public.project_files enable row level security;

create policy "files_select" on public.project_files
  for select using (
    public.is_admin()
    or (tenant_id is not null and public.is_tenant_member(tenant_id))
    or (
      visibility = 'shared'
      and exists (
        select 1 from public.projects p
        where p.id = project_files.project_id and p.customer_id = auth.uid()
      )
    )
  );

-- Any participant (tenant member or the customer) can upload a file record
create policy "files_insert_participant" on public.project_files
  for insert with check (
    (tenant_id is not null and public.is_tenant_member(tenant_id))
    or exists (
      select 1 from public.projects p
      where p.id = project_files.project_id and p.customer_id = auth.uid()
    )
  );

create policy "files_delete_uploader" on public.project_files
  for delete using (
    uploaded_by = auth.uid() or public.is_admin()
  );

-------------------------------------------------------------------------------
-- Storage bucket for project files — create policies via SQL
-- NOTE: the bucket itself must be created via the Supabase dashboard or CLI:
--   insert into storage.buckets (id, name, public) values ('project-files', 'project-files', false);
-- Running this insert is idempotent with on conflict, so we include it here.
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('project-files', 'project-files', false)
  on conflict (id) do nothing;

-- Storage RLS policies: allow authenticated participants to read, upload, delete
-- their own uploads. The object path convention is: {project_id}/{random_id}_{filename}
create policy "project_files_read" on storage.objects
  for select using (
    bucket_id = 'project-files'
    and auth.uid() is not null
    and exists (
      select 1 from public.project_files pf
      where pf.storage_path = storage.objects.name
        and (
          public.is_admin()
          or (pf.tenant_id is not null and public.is_tenant_member(pf.tenant_id))
          or (pf.visibility = 'shared' and exists (
            select 1 from public.projects p
            where p.id = pf.project_id and p.customer_id = auth.uid()
          ))
        )
    )
  );

create policy "project_files_insert" on storage.objects
  for insert with check (
    bucket_id = 'project-files'
    and auth.uid() is not null
  );

create policy "project_files_delete" on storage.objects
  for delete using (
    bucket_id = 'project-files'
    and auth.uid() is not null
    and exists (
      select 1 from public.project_files pf
      where pf.storage_path = storage.objects.name
        and (pf.uploaded_by = auth.uid() or public.is_admin())
    )
  );
