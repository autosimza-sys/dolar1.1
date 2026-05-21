-- Dolar MZA - upgrade financiero, fuentes y comunidad
-- Ejecutar una sola vez en Supabase SQL Editor.
-- No borra datos existentes.

create table if not exists public.rate_sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  provider text not null,
  endpoint text,
  parser_type text not null,
  priority integer not null default 100,
  enabled boolean not null default true,
  rate_codes text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rate_source_readings (
  id uuid primary key default gen_random_uuid(),
  rate_code text not null,
  source_key text not null,
  source_name text not null,
  buy_price numeric(14, 4),
  sell_price numeric(14, 4),
  midpoint numeric(14, 4),
  status text not null default 'accepted' check (status in ('accepted', 'rejected', 'fallback')),
  reason text,
  payload jsonb,
  fetched_at timestamptz not null default now()
);

create table if not exists public.rate_history (
  id uuid primary key default gen_random_uuid(),
  rate_code text not null references public.rates(code) on update cascade on delete cascade,
  buy_price numeric(14, 4),
  sell_price numeric(14, 4),
  variation numeric(8, 2) not null default 0,
  source_count integer not null default 0,
  confidence_score integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null check (operation_type in ('buy', 'sell')),
  currency text not null,
  amount numeric(14, 4) not null check (amount > 0),
  rate numeric(14, 4) not null check (rate > 0),
  department text not null,
  comment text,
  status text not null default 'approved' check (status in ('approved', 'pending', 'suspicious', 'rejected')),
  moderation_reason text,
  include_in_stats boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_sources_enabled_priority on public.rate_sources(enabled, priority);
create index if not exists idx_rate_source_readings_code_fetched on public.rate_source_readings(rate_code, fetched_at desc);
create index if not exists idx_rate_history_code_created on public.rate_history(rate_code, created_at desc);
create index if not exists idx_community_reports_status_created on public.community_reports(status, created_at desc);
create index if not exists idx_community_reports_currency_created on public.community_reports(currency, created_at desc);

alter table public.rate_sources enable row level security;
alter table public.rate_source_readings enable row level security;
alter table public.rate_history enable row level security;
alter table public.community_reports enable row level security;

drop trigger if exists rate_sources_set_updated_at on public.rate_sources;
create trigger rate_sources_set_updated_at
before update on public.rate_sources
for each row execute function public.set_updated_at();

drop policy if exists rate_sources_admin_all on public.rate_sources;
create policy rate_sources_admin_all on public.rate_sources
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists rate_source_readings_admin_select on public.rate_source_readings;
create policy rate_source_readings_admin_select on public.rate_source_readings
for select using (public.is_admin());

drop policy if exists rate_source_readings_admin_all on public.rate_source_readings;
create policy rate_source_readings_admin_all on public.rate_source_readings
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists rate_history_admin_select on public.rate_history;
create policy rate_history_admin_select on public.rate_history
for select using (public.is_admin());

drop policy if exists rate_history_admin_all on public.rate_history;
create policy rate_history_admin_all on public.rate_history
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists community_reports_public_approved_select on public.community_reports;
create policy community_reports_public_approved_select on public.community_reports
for select using (status = 'approved');

drop policy if exists community_reports_admin_all on public.community_reports;
create policy community_reports_admin_all on public.community_reports
for all using (public.is_admin()) with check (public.is_admin());

insert into public.rate_sources(key, name, provider, endpoint, parser_type, priority, enabled, rate_codes, notes)
values
  ('dolarapi_dolares', 'DolarAPI Dólares', 'DolarAPI', 'https://dolarapi.com/v1/dolares', 'dolarapi_dolares', 10, true, array['USD_OFICIAL','USD_BLUE','USD_MEP','USD_CCL'], 'Fuente pública general'),
  ('dolarapi_cotizaciones', 'DolarAPI Cotizaciones', 'DolarAPI', 'https://dolarapi.com/v1/cotizaciones', 'dolarapi_cotizaciones', 20, true, array['CLP_OFICIAL','BRL_OFICIAL','EUR_OFICIAL'], 'Monedas oficiales'),
  ('argentina_datos_dolares', 'ArgentinaDatos Dólares', 'ArgentinaDatos', 'https://api.argentinadatos.com/v1/cotizaciones/dolares', 'argentina_datos_dolares', 30, true, array['USD_OFICIAL','USD_BLUE','USD_MEP','USD_CCL'], 'Fuente alternativa'),
  ('ratesarg_cotizaciones', 'RatesArg Cotizaciones', 'RatesArg', 'https://ratesarg.com/api/cotizaciones', 'ratesarg_cotizaciones', 40, true, array['USD_OFICIAL','USD_BLUE','USD_MEP','USD_CCL','BRL_OFICIAL','EUR_OFICIAL'], 'Fuente alternativa tolerante a fallos'),
  ('bcra_plazo_fijo', 'BCRA Plazo Fijo 30 días', 'BCRA', 'https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/1207?limit=2', 'bcra_plazo_fijo', 5, true, array['BCRA_RATE','FIXED_TERM_30','MONTHLY_YIELD'], 'Dato oficial BCRA'),
  ('comunidad_mendoza', 'Comunidad anónima Mendoza', 'Dólar MZA', null, 'community_blue_mendoza', 60, true, array['USD_BLUE_MENDOZA'], 'Operaciones reales anonimas, solo estadistica')
on conflict (key) do update
set name = excluded.name,
    provider = excluded.provider,
    endpoint = excluded.endpoint,
    parser_type = excluded.parser_type,
    priority = excluded.priority,
    rate_codes = excluded.rate_codes,
    notes = excluded.notes;

insert into public.admin_settings(key, value)
values
  ('blue_mendoza_manual', '{"enabled": false, "buy_price": null, "sell_price": null, "note": ""}'::jsonb),
  ('community_filters_enabled', 'true'::jsonb)
on conflict (key) do nothing;

insert into public.rates (code, name, country, flag, type, buy_price, sell_price, variation, source, is_visible)
values
  ('USD_BLUE_MENDOZA', 'Dólar Blue Mendoza', 'Mendoza', '🇦🇷🇺🇸', 'main', null, null, 0, 'Pendiente promedio validado', true),
  ('USD_CCL', 'Dólar CCL', 'Argentina / Estados Unidos', '🇦🇷🇺🇸', 'main', null, null, 0, 'Pendiente promedio validado', true),
  ('COUNTRY_RISK', 'Riesgo país', 'Argentina', '🇦🇷', 'indicator', null, null, 0, 'Pendiente fuente confiable', false)
on conflict (code) do update
set name = excluded.name,
    country = excluded.country,
    flag = excluded.flag,
    type = excluded.type,
    is_visible = excluded.is_visible;
