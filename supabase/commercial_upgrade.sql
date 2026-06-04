-- Dolar MZA - upgrade comercial
-- Ejecutar una sola vez en Supabase SQL Editor.
-- Agrega planes comerciales, referidos, creditos, prueba gratis y eventos de pago.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by_code text,
  add column if not exists trial_used boolean not null default false,
  add column if not exists login_count integer not null default 0,
  add column if not exists last_login_at timestamptz;

create unique index if not exists profiles_referral_code_key
on public.profiles(referral_code)
where referral_code is not null;

alter table public.education_cards
  add column if not exists level text not null default 'ahorristas';

alter table public.education_cards
  drop constraint if exists education_cards_level_check;

alter table public.education_cards
  add constraint education_cards_level_check
  check (level in ('jovenes', 'ahorristas', 'expertos'));

alter table public.subscriptions
  add column if not exists grace_until timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('pending', 'trial', 'active', 'grace', 'paused', 'suspended', 'cancelled', 'expired'));

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('free', 'essential_monthly', 'tracking_monthly', 'premium_monthly'));

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid references public.profiles(id) on delete set null,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending', 'valid', 'suspicious', 'rejected')),
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  valid_after timestamptz not null default (now() + interval '7 days'),
  unique (referred_user_id)
);

create index if not exists idx_referral_events_referrer_status
on public.referral_events(referrer_user_id, status);

create table if not exists public.referral_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  referral_event_id uuid references public.referral_events(id) on delete set null,
  points integer not null default 0,
  credit_amount numeric(14, 2) not null default 0,
  type text not null default 'earned' check (type in ('earned', 'used', 'expired', 'manual')),
  status text not null default 'active' check (status in ('active', 'used', 'expired', 'cancelled')),
  description text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  applied_at timestamptz
);

create index if not exists idx_referral_credit_ledger_user_status
on public.referral_credit_ledger(user_id, status, expires_at);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  mercado_pago_id text,
  plan text not null default 'tracking_monthly',
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_events_user_created
on public.payment_events(user_id, created_at desc);

create or replace function public.slug_for_email(email_value text, user_id uuid)
returns text
language plpgsql
immutable
as $$
declare
  base text;
begin
  base := lower(regexp_replace(split_part(coalesce(email_value, 'usuario'), '@', 1), '[^a-z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  if base = '' then
    base := 'usuario';
  end if;
  return left(base, 24) || '-' || left(replace(user_id::text, '-', ''), 5);
end;
$$;

update public.profiles
set referral_code = public.slug_for_email(email, id)
where referral_code is null;

create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
as $$
declare
  generated_code text;
  incoming_ref text;
  referrer_id uuid;
begin
  generated_code := public.slug_for_email(new.email, new.id);
  incoming_ref := lower(nullif(new.raw_user_meta_data ->> 'referred_by_code', ''));

  insert into public.profiles (id, email, phone, full_name, referral_code, referred_by_code)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'full_name',
    generated_code,
    incoming_ref
  )
  on conflict (id) do update
    set email = excluded.email,
        phone = coalesce(public.profiles.phone, excluded.phone),
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        referral_code = coalesce(public.profiles.referral_code, excluded.referral_code),
        referred_by_code = coalesce(public.profiles.referred_by_code, excluded.referred_by_code);

  if incoming_ref is not null then
    select id into referrer_id
    from public.profiles
    where referral_code = incoming_ref
      and id <> new.id
    limit 1;

    if referrer_id is not null then
      insert into public.referral_events (referrer_user_id, referred_user_id, referral_code, status, valid_after)
      values (referrer_id, new.id, incoming_ref, 'pending', now() + interval '7 days')
      on conflict (referred_user_id) do nothing;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.validate_referrals()
returns integer
security definer
set search_path = public, auth
as $$
declare
  validated_count integer := 0;
  row_record record;
begin
  for row_record in
    select
      event.id as referral_event_id,
      event.referrer_user_id,
      event.referred_user_id
    from public.referral_events event
    join public.profiles referred_profile on referred_profile.id = event.referred_user_id
    join auth.users referred_auth on referred_auth.id = event.referred_user_id
    where event.status = 'pending'
      and event.valid_after <= now()
      and referred_auth.email_confirmed_at is not null
      and coalesce(referred_profile.login_count, 0) >= 2
  loop
    update public.referral_events
    set status = 'valid',
        validated_at = now()
    where id = row_record.referral_event_id;

    insert into public.referral_credit_ledger (
      user_id,
      referral_event_id,
      points,
      credit_amount,
      type,
      status,
      description,
      expires_at
    )
    values (
      row_record.referrer_user_id,
      row_record.referral_event_id,
      1000,
      50,
      'earned',
      'active',
      'Credito por referido validado',
      now() + interval '120 days'
    )
    on conflict do nothing;

    validated_count := validated_count + 1;
  end loop;

  update public.referral_credit_ledger
  set status = 'expired',
      type = 'expired'
  where status = 'active'
    and expires_at is not null
    and expires_at < now();

  return validated_count;
end;
$$ language plpgsql;

create or replace function public.apply_referral_credit(p_user_id uuid, p_amount numeric, p_description text default 'Credito usado')
returns numeric
security definer
set search_path = public
as $$
declare
  available_credit numeric(14, 2);
  credit_to_apply numeric(14, 2);
begin
  perform public.validate_referrals();

  select coalesce(sum(credit_amount), 0)
  into available_credit
  from public.referral_credit_ledger
  where user_id = p_user_id
    and status = 'active'
    and type in ('earned', 'manual')
    and (expires_at is null or expires_at > now());

  select greatest(
    available_credit - coalesce((
      select sum(credit_amount)
      from public.referral_credit_ledger
      where user_id = p_user_id
        and status = 'used'
        and type = 'used'
    ), 0),
    0
  )
  into available_credit;

  credit_to_apply := least(coalesce(available_credit, 0), greatest(coalesce(p_amount, 0), 0));

  if credit_to_apply > 0 then
    insert into public.referral_credit_ledger (
      user_id,
      points,
      credit_amount,
      type,
      status,
      description,
      applied_at
    )
    values (
      p_user_id,
      0,
      credit_to_apply,
      'used',
      'used',
      p_description,
      now()
    );
  end if;

  return coalesce(credit_to_apply, 0);
end;
$$ language plpgsql;

create or replace function public.enforce_alert_plan_limits()
returns trigger
security definer
set search_path = public
as $$
declare
  current_plan text := 'free';
  current_status text := 'free';
  active_count integer;
  whatsapp_count integer;
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then
    return new;
  end if;

  select plan, status into current_plan, current_status
  from public.subscriptions
  where user_id = new.user_id
    and status in ('trial', 'active', 'grace')
    and (expires_at is null or expires_at > now())
  order by
    case plan
      when 'premium_monthly' then 3
      when 'tracking_monthly' then 2
      when 'essential_monthly' then 1
      else 0
    end desc,
    started_at desc nulls last
  limit 1;

  current_plan := coalesce(current_plan, 'free');

  if new.channel = 'whatsapp' then
    if current_plan <> 'premium_monthly' then
      raise exception 'WhatsApp esta incluido en Premium WhatsApp.';
    end if;

    select count(*) into whatsapp_count
    from public.alerts
    where user_id = new.user_id
      and is_active = true
      and channel = 'whatsapp'
      and id <> coalesce(new.id, gen_random_uuid());

    if whatsapp_count >= 6 then
      raise exception 'Premium WhatsApp incluye hasta 6 alertas por WhatsApp.';
    end if;
  end if;

  if new.is_active and current_plan <> 'premium_monthly' then
    select count(*) into active_count
    from public.alerts
    where user_id = new.user_id
      and is_active = true
      and id <> coalesce(new.id, gen_random_uuid());

    if current_plan = 'free' and active_count >= 0 then
      raise exception 'La cuenta gratuita no incluye alertas.';
    end if;

    if current_plan = 'essential_monthly' and active_count >= 2 then
      raise exception 'El Plan Basico incluye 2 alertas por email.';
    end if;

    if current_plan = 'tracking_monthly' and active_count >= 4 then
      raise exception 'El Plan Seguimiento incluye hasta 4 alertas.';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists enforce_alert_plan_limits on public.alerts;
create trigger enforce_alert_plan_limits
before insert or update on public.alerts
for each row execute function public.enforce_alert_plan_limits();

insert into public.education_cards (id, title, content, category, level, related_alert_type, is_visible)
values
  ('10000000-0000-0000-0000-000000000001', 'Que es el dolar', 'El dolar es una moneda que mucha gente usa como referencia para ahorrar, viajar o comparar precios.', 'dolar', 'jovenes', 'above', true),
  ('10000000-0000-0000-0000-000000000002', 'Que es inflacion', 'Hay inflacion cuando los precios suben y tu plata compra menos que antes.', 'inflacion', 'jovenes', 'rate_down', true),
  ('10000000-0000-0000-0000-000000000003', 'Compra y venta', 'Compra es lo que te pagan por vender moneda. Venta es lo que pagas si queres comprar.', 'dolar', 'jovenes', 'below', true),
  ('10000000-0000-0000-0000-000000000004', 'Dolar o plazo fijo', 'El plazo fijo puede servir cuando la tasa le gana al movimiento del dolar.', 'plazo fijo', 'ahorristas', 'dollar_vs_fixed_term', true),
  ('10000000-0000-0000-0000-000000000005', 'Como usar alertas', 'Una alerta te ayuda a no mirar la pantalla todo el dia y enterarte cuando cambia lo importante.', 'ahorro', 'ahorristas', 'above', true),
  ('10000000-0000-0000-0000-000000000006', 'Viajes a Chile y Brasil', 'Antes de viajar, mira el cambio. A veces la moneda puede comerse parte del presupuesto.', 'viajes', 'ahorristas', 'travel_opportunity', true),
  ('10000000-0000-0000-0000-000000000007', 'Brecha cambiaria', 'La brecha compara el dolar oficial con otros valores. Si sube mucho, el mercado se pone mas sensible.', 'dolar', 'expertos', 'gap_above', true),
  ('10000000-0000-0000-0000-000000000008', 'MEP y CCL', 'MEP y CCL son referencias financieras. No son lo mismo que el blue ni que el oficial.', 'dolar', 'expertos', 'mep_below', true),
  ('10000000-0000-0000-0000-000000000009', 'Spread', 'El spread es la diferencia entre compra y venta. Si es alto, entrar y salir cuesta mas.', 'errores comunes', 'expertos', 'above', true)
on conflict (id) do update
set title = excluded.title,
    content = excluded.content,
    category = excluded.category,
    level = excluded.level,
    related_alert_type = excluded.related_alert_type,
    is_visible = excluded.is_visible;

alter table public.referral_events enable row level security;
alter table public.referral_credit_ledger enable row level security;
alter table public.payment_events enable row level security;

drop policy if exists referral_events_select_own_or_admin on public.referral_events;
create policy referral_events_select_own_or_admin on public.referral_events
for select using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id or public.is_admin());

drop policy if exists referral_events_admin_all on public.referral_events;
create policy referral_events_admin_all on public.referral_events
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists referral_credit_select_own_or_admin on public.referral_credit_ledger;
create policy referral_credit_select_own_or_admin on public.referral_credit_ledger
for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists referral_credit_admin_all on public.referral_credit_ledger;
create policy referral_credit_admin_all on public.referral_credit_ledger
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists payment_events_select_own_or_admin on public.payment_events;
create policy payment_events_select_own_or_admin on public.payment_events
for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists payment_events_admin_all on public.payment_events;
create policy payment_events_admin_all on public.payment_events
for all using (public.is_admin()) with check (public.is_admin());
