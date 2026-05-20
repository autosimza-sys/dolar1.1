-- Dolar Mendoza - upgrade de automatizacion robusta
-- Ejecutar una sola vez en Supabase SQL Editor.
-- No pisa cotizaciones existentes.

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  recipient text not null,
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.source_update_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null check (status in ('success', 'partial', 'failed')),
  updated_codes text[] not null default '{}',
  errors text[] not null default '{}',
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now()
);

create index if not exists idx_notification_jobs_status_created on public.notification_jobs(status, created_at);
create index if not exists idx_notification_jobs_user_created on public.notification_jobs(user_id, created_at desc);
create index if not exists idx_source_update_logs_finished on public.source_update_logs(finished_at desc);

alter table public.notification_jobs enable row level security;
alter table public.source_update_logs enable row level security;

drop policy if exists notification_jobs_select_own_or_admin on public.notification_jobs;
create policy notification_jobs_select_own_or_admin on public.notification_jobs
for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists notification_jobs_admin_all on public.notification_jobs;
create policy notification_jobs_admin_all on public.notification_jobs
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists source_update_logs_admin_select on public.source_update_logs;
create policy source_update_logs_admin_select on public.source_update_logs
for select using (public.is_admin());

drop policy if exists source_update_logs_admin_all on public.source_update_logs;
create policy source_update_logs_admin_all on public.source_update_logs
for all using (public.is_admin()) with check (public.is_admin());
