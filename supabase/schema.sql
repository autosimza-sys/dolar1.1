-- Dólar Mendoza - esquema limpio para Supabase
-- Ejecutar en SQL Editor. Si querés reset total, descomentá los DROP.

-- drop table if exists public.favorite_rates cascade;
-- drop table if exists public.alert_logs cascade;
-- drop table if exists public.alerts cascade;
-- drop table if exists public.subscriptions cascade;
-- drop table if exists public.education_cards cascade;
-- drop table if exists public.rates cascade;
-- drop table if exists public.admin_settings cascade;
-- drop table if exists public.profiles cascade;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  phone text,
  full_name text,
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.rates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  country text not null,
  flag text not null,
  type text not null check (type in ('main', 'travel', 'indicator')),
  buy_price numeric(14, 4),
  sell_price numeric(14, 4),
  variation numeric(8, 2) not null default 0,
  source text,
  is_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rate_code text not null references public.rates(code) on update cascade,
  condition_type text not null,
  target_value numeric(14, 4) not null,
  channel text not null check (channel in ('email', 'whatsapp')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.alert_logs (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  sent_at timestamptz not null default now()
);

create table if not exists public.education_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null check (category in ('dolar', 'plazo fijo', 'inflacion', 'ahorro', 'viajes', 'errores comunes')),
  related_alert_type text not null,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mercado_pago_payment_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'cancelled', 'expired')),
  plan text not null default 'premium_monthly' check (plan in ('free', 'premium_monthly')),
  started_at timestamptz,
  expires_at timestamptz,
  unique (user_id, plan)
);

create table if not exists public.admin_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.favorite_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rate_code text not null references public.rates(code) on update cascade,
  created_at timestamptz not null default now(),
  unique (user_id, rate_code)
);

create index if not exists idx_rates_visible_type on public.rates(is_visible, type);
create index if not exists idx_alerts_user_active on public.alerts(user_id, is_active);
create index if not exists idx_alert_logs_user_sent on public.alert_logs(user_id, sent_at desc);
create index if not exists idx_subscriptions_user_status on public.subscriptions(user_id, status);

create or replace function public.set_updated_at()
returns trigger
as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists rates_set_updated_at on public.rates;
create trigger rates_set_updated_at
before update on public.rates
for each row execute function public.set_updated_at();

drop trigger if exists admin_settings_set_updated_at on public.admin_settings;
create trigger admin_settings_set_updated_at
before update on public.admin_settings
for each row execute function public.set_updated_at();

insert into public.admin_settings(key, value)
values ('admin_emails', '["admin@dolarmendoza.app"]'::jsonb)
on conflict (key) do nothing;

create or replace function public.is_admin()
returns boolean
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.admin_settings settings
      cross join lateral jsonb_array_elements_text(
        case
          when jsonb_typeof(settings.value) = 'array' then settings.value
          else '[]'::jsonb
        end
      ) as admin_email(value)
      where settings.key = 'admin_emails'
        and lower(admin_email.value) = lower(coalesce(auth.jwt() ->> 'email', ''))
    ),
    false
  );
$$ language sql;

create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do update
    set email = excluded.email,
        phone = coalesce(public.profiles.phone, excluded.phone),
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.protect_profile_subscription_fields()
returns trigger
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    new.is_premium = old.is_premium;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists protect_profile_subscription_fields on public.profiles;
create trigger protect_profile_subscription_fields
before update on public.profiles
for each row execute function public.protect_profile_subscription_fields();

create or replace function public.enforce_alert_plan_limits()
returns trigger
security definer
set search_path = public
as $$
declare
  user_is_premium boolean;
  active_count integer;
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then
    return new;
  end if;

  select is_premium into user_is_premium
  from public.profiles
  where id = new.user_id;

  if coalesce(user_is_premium, false) then
    return new;
  end if;

  if new.channel = 'whatsapp' then
    raise exception 'WhatsApp está incluido en Premium.';
  end if;

  if new.is_active then
    select count(*) into active_count
    from public.alerts
    where user_id = new.user_id
      and is_active = true
      and id <> coalesce(new.id, gen_random_uuid());

    if active_count >= 1 then
      raise exception 'El plan gratis incluye 1 alerta activa.';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists enforce_alert_plan_limits on public.alerts;
create trigger enforce_alert_plan_limits
before insert or update on public.alerts
for each row execute function public.enforce_alert_plan_limits();

alter table public.profiles enable row level security;
alter table public.rates enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_logs enable row level security;
alter table public.education_cards enable row level security;
alter table public.subscriptions enable row level security;
alter table public.admin_settings enable row level security;
alter table public.favorite_rates enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_insert_own_or_admin on public.profiles;
create policy profiles_insert_own_or_admin on public.profiles
for insert with check (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin on public.profiles
for update using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists rates_select_visible_or_admin on public.rates;
create policy rates_select_visible_or_admin on public.rates
for select using (is_visible = true or public.is_admin());

drop policy if exists rates_admin_all on public.rates;
create policy rates_admin_all on public.rates
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists alerts_select_own_or_admin on public.alerts;
create policy alerts_select_own_or_admin on public.alerts
for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists alerts_insert_own_or_admin on public.alerts;
create policy alerts_insert_own_or_admin on public.alerts
for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists alerts_update_own_or_admin on public.alerts;
create policy alerts_update_own_or_admin on public.alerts
for update using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists alerts_delete_own_or_admin on public.alerts;
create policy alerts_delete_own_or_admin on public.alerts
for delete using (auth.uid() = user_id or public.is_admin());

drop policy if exists alert_logs_select_own_or_admin on public.alert_logs;
create policy alert_logs_select_own_or_admin on public.alert_logs
for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists alert_logs_admin_insert on public.alert_logs;
create policy alert_logs_admin_insert on public.alert_logs
for insert with check (public.is_admin());

drop policy if exists education_cards_select_visible_or_admin on public.education_cards;
create policy education_cards_select_visible_or_admin on public.education_cards
for select using (is_visible = true or public.is_admin());

drop policy if exists education_cards_admin_all on public.education_cards;
create policy education_cards_admin_all on public.education_cards
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists subscriptions_select_own_or_admin on public.subscriptions;
create policy subscriptions_select_own_or_admin on public.subscriptions
for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists subscriptions_admin_all on public.subscriptions;
create policy subscriptions_admin_all on public.subscriptions
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_settings_admin_all on public.admin_settings;
create policy admin_settings_admin_all on public.admin_settings
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists favorite_rates_select_own_or_admin on public.favorite_rates;
create policy favorite_rates_select_own_or_admin on public.favorite_rates
for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists favorite_rates_insert_own_or_admin on public.favorite_rates;
create policy favorite_rates_insert_own_or_admin on public.favorite_rates
for insert with check (auth.uid() = user_id or public.is_admin());

drop policy if exists favorite_rates_delete_own_or_admin on public.favorite_rates;
create policy favorite_rates_delete_own_or_admin on public.favorite_rates
for delete using (auth.uid() = user_id or public.is_admin());

insert into public.rates (code, name, country, flag, type, buy_price, sell_price, variation, source, is_visible)
values
  ('USD_OFICIAL', 'Dólar Oficial', 'Argentina / Estados Unidos', '🇦🇷🇺🇸', 'main', 1095, 1135, 0.8, 'Carga demo', true),
  ('USD_BLUE', 'Dólar Blue', 'Argentina / Estados Unidos', '🇦🇷🇺🇸', 'main', 1180, 1210, 1.4, 'Carga demo', true),
  ('USD_MEP', 'Dólar Bolsa / MEP', 'Argentina / Estados Unidos', '🇦🇷🇺🇸', 'main', 1162, 1175, -0.2, 'Carga demo', true),
  ('CLP_OFICIAL', 'Peso chileno oficial', 'Chile', '🇨🇱', 'travel', 1.08, 1.18, 0.3, 'Carga demo', true),
  ('CLP_BLUE', 'Peso chileno blue', 'Chile', '🇨🇱', 'travel', 1.22, 1.34, 1.7, 'Carga demo', true),
  ('BRL_OFICIAL', 'Real oficial', 'Brasil', '🇧🇷', 'travel', 205, 224, -0.4, 'Carga demo', true),
  ('BRL_BLUE', 'Real blue', 'Brasil', '🇧🇷', 'travel', 220, 242, 0.9, 'Carga demo', true),
  ('EUR_OFICIAL', 'Euro oficial', 'Europa', '🇪🇺', 'travel', 1240, 1320, 0.6, 'Carga demo', true),
  ('EUR_BLUE', 'Euro blue', 'Europa', '🇪🇺', 'travel', 1308, 1395, 1.1, 'Carga demo', true),
  ('BCRA_RATE', 'Tasa BCRA', 'Argentina', '🇦🇷', 'indicator', null, 40, 0.5, 'Carga demo', true),
  ('FIXED_TERM_30', 'Plazo fijo promedio 30 días', 'Argentina', '🇦🇷', 'indicator', null, 3.15, 0.1, 'Carga demo', true),
  ('MONTHLY_YIELD', 'Rendimiento mensual estimado', 'Argentina', '🇦🇷', 'indicator', null, 3.35, 0.2, 'Carga demo', true)
on conflict (code) do update
set name = excluded.name,
    country = excluded.country,
    flag = excluded.flag,
    type = excluded.type,
    buy_price = excluded.buy_price,
    sell_price = excluded.sell_price,
    variation = excluded.variation,
    source = excluded.source,
    is_visible = excluded.is_visible;

insert into public.education_cards (id, title, content, category, related_alert_type, is_visible)
values
  ('00000000-0000-0000-0000-000000000001', 'No compres por susto', 'Si el dólar sube fuerte, no siempre conviene comprar desesperado.', 'dolar', 'above', true),
  ('00000000-0000-0000-0000-000000000002', 'Tasa contra dólar', 'El plazo fijo sirve cuando la tasa le gana al movimiento del dólar.', 'plazo fijo', 'dollar_vs_fixed_term', true),
  ('00000000-0000-0000-0000-000000000003', 'Mirar tarde sale caro', 'El que mira el dólar una vez por semana llega tarde.', 'errores comunes', 'gap_above', true),
  ('00000000-0000-0000-0000-000000000004', 'Una alerta vale más', 'Una alerta a tiempo puede ahorrarte más que una suscripción.', 'ahorro', 'below', true),
  ('00000000-0000-0000-0000-000000000005', 'Viajar también es tipo de cambio', 'Antes de viajar, mirá la moneda. A veces el cambio te come el presupuesto.', 'viajes', 'travel_opportunity', true),
  ('00000000-0000-0000-0000-000000000006', 'Inflación sin vueltas', 'Si todo sube más rápido que tu rendimiento, estás perdiendo poder de compra.', 'inflacion', 'rate_down', true)
on conflict (id) do update
set title = excluded.title,
    content = excluded.content,
    category = excluded.category,
    related_alert_type = excluded.related_alert_type,
    is_visible = excluded.is_visible;
