create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  path text not null,
  referrer text,
  device text,
  browser text,
  country text,
  region text,
  city text,
  source text,
  campaign text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_at_idx on public.analytics_events(created_at desc);
create index if not exists analytics_events_event_name_idx on public.analytics_events(event_name);
create index if not exists analytics_events_path_idx on public.analytics_events(path);

alter table public.analytics_events enable row level security;

drop policy if exists analytics_events_admin_select on public.analytics_events;
create policy analytics_events_admin_select on public.analytics_events
for select using (public.is_admin());

drop policy if exists analytics_events_service_all on public.analytics_events;
create policy analytics_events_service_all on public.analytics_events
for all using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
