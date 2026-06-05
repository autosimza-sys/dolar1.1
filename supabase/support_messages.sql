create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  reason text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_messages_created_at_idx
on public.support_messages (created_at desc);

create index if not exists support_messages_status_idx
on public.support_messages (status);

alter table public.support_messages enable row level security;

drop policy if exists support_messages_insert_own_or_guest on public.support_messages;
create policy support_messages_insert_own_or_guest on public.support_messages
for insert with check (user_id is null or auth.uid() = user_id or public.is_admin());

drop policy if exists support_messages_select_own_or_admin on public.support_messages;
create policy support_messages_select_own_or_admin on public.support_messages
for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists support_messages_admin_update on public.support_messages;
create policy support_messages_admin_update on public.support_messages
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists support_messages_admin_delete on public.support_messages;
create policy support_messages_admin_delete on public.support_messages
for delete using (public.is_admin());
