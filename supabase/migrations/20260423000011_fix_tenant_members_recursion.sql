-- Fix the same RLS recursion shape we just fixed on projects: the
-- tenant_members_manage_owner policy queries tenant_members directly in an
-- EXISTS subquery, which triggers RLS on tenant_members, which triggers the
-- policy again. Postgres does not always raise an explicit recursion error
-- here — sometimes it just returns zero rows, which is why new byrå users
-- see "tenantIds: []" even when tenant_members has a row for them.
--
-- Fix: wrap the "is this user an owner/admin of tenant" check in a
-- SECURITY DEFINER helper so the inner query bypasses RLS. Also add an
-- explicit "user_id = auth.uid()" fast path to tenant_members_select so a
-- user can always see their own membership row regardless of helper eval.

create or replace function public.is_tenant_owner_or_admin(
  tid uuid,
  uid uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = tid
      and user_id = uid
      and role in ('owner', 'admin')
  );
$$;

drop policy if exists "tenant_members_select" on public.tenant_members;
create policy "tenant_members_select" on public.tenant_members
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_tenant_member(tenant_id)
  );

drop policy if exists "tenant_members_manage_owner" on public.tenant_members;
create policy "tenant_members_manage_owner" on public.tenant_members
  for all using (
    public.is_admin() or public.is_tenant_owner_or_admin(tenant_id)
  ) with check (
    public.is_admin() or public.is_tenant_owner_or_admin(tenant_id)
  );
