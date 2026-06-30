-- Dolar MZA - sistema automatico de sorteos
-- Ejecutar en Supabase SQL Editor despues de tener cargado schema.sql y commercial_upgrade.sql.
-- Agrega sorteos, tickets, resultados, logs y automatizacion por usuario/plan/referidos.

create extension if not exists pgcrypto;

create sequence if not exists public.giveaway_principal_number_seq
  start with 5645
  increment by 1
  minvalue 0
  maxvalue 999999
  cache 1;

create table if not exists public.giveaways (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  type text not null default 'monthly' check (type in ('monthly', 'annual', 'custom')),
  prize_label text not null,
  prize_currency text not null default 'USD',
  prize_amount numeric(14, 2) not null default 0,
  prize_ars_equivalent numeric(14, 2),
  draw_date date not null,
  draw_time time not null default '22:00',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'closed', 'completed')),
  starts_at timestamptz not null default now(),
  closes_at timestamptz,
  selection_method text not null default 'quiniela_mendoza_nocturna',
  max_numbers_per_user integer not null default 12,
  allow_free boolean not null default true,
  allow_tracking boolean not null default true,
  allow_premium boolean not null default false,
  allow_referrals boolean not null default true,
  free_chances integer not null default 1,
  tracking_chances integer not null default 6,
  premium_chances integer not null default 0,
  referral_step integer not null default 10,
  referral_bonus_chances integer not null default 1,
  referral_bonus_max integer not null default 5,
  rules jsonb not null default '{}'::jsonb,
  legal_text text not null default 'Bases y condiciones pendientes de revision legal.',
  legal_version text not null default '1.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_giveaways_status_date
on public.giveaways(status, draw_date);

create table if not exists public.giveaway_user_numbers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  principal_number integer not null unique check (principal_number between 0 and 9999),
  assigned_at timestamptz not null default now()
);

create table if not exists public.giveaway_tickets (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ticket_number integer not null check (ticket_number between 0 and 9999),
  origin text not null default 'registro gratuito' check (
    origin in ('registro gratuito', 'Plan Seguimiento', 'referido', 'ajuste administrativo', 'sorteo automatico', 'otro')
  ),
  origin_detail jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'void', 'winner')),
  assigned_at timestamptz not null default now(),
  unique (giveaway_id, ticket_number)
);

create index if not exists idx_giveaway_tickets_user
on public.giveaway_tickets(user_id, giveaway_id, status);

create index if not exists idx_giveaway_tickets_number
on public.giveaway_tickets(giveaway_id, ticket_number);

create table if not exists public.giveaway_results (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  source text not null default 'quiniela_mendoza_nocturna',
  official_draw_date date,
  official_numbers jsonb not null default '[]'::jsonb,
  winning_number integer check (winning_number between 0 and 9999),
  winning_prize_position integer,
  winner_user_id uuid references public.profiles(id) on delete set null,
  winning_ticket_id uuid references public.giveaway_tickets(id) on delete set null,
  method text not null default 'official_exact' check (method in ('official_exact', 'automatic_fallback', 'manual_admin')),
  participant_ticket_count integer not null default 0,
  seed text,
  random_index integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_giveaway_results_giveaway
on public.giveaway_results(giveaway_id, created_at desc);

create table if not exists public.giveaway_logs (
  id uuid primary key default gen_random_uuid(),
  giveaway_id uuid references public.giveaways(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  ticket_id uuid references public.giveaway_tickets(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_giveaway_logs_giveaway
on public.giveaway_logs(giveaway_id, created_at desc);

create or replace function public.set_giveaways_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists giveaways_set_updated_at on public.giveaways;
create trigger giveaways_set_updated_at
before update on public.giveaways
for each row execute function public.set_giveaways_updated_at();

create or replace function public.giveaway_assign_principal_number(p_user_id uuid)
returns integer
security definer
set search_path = public
language plpgsql
as $$
declare
  existing_number integer;
  candidate integer;
  tries integer := 0;
begin
  select principal_number
  into existing_number
  from public.giveaway_user_numbers
  where user_id = p_user_id;

  if existing_number is not null then
    return existing_number;
  end if;

  loop
    tries := tries + 1;

    if tries < 6000 then
      candidate := nextval('public.giveaway_principal_number_seq')::integer;
      if candidate > 9999 then
        candidate := floor(random() * 10000)::integer;
      end if;
    else
      candidate := floor(random() * 10000)::integer;
    end if;

    begin
      insert into public.giveaway_user_numbers(user_id, principal_number)
      values (p_user_id, candidate);

      return candidate;
    exception
      when unique_violation then
        if tries > 10000 then
          raise exception 'No quedan numeros principales disponibles para sorteos.';
        end if;
    end;
  end loop;
end;
$$;

create or replace function public.giveaway_random_ticket_number(p_giveaway_id uuid)
returns integer
security definer
set search_path = public
language plpgsql
as $$
declare
  candidate integer;
  tries integer := 0;
begin
  loop
    tries := tries + 1;
    candidate := floor(random() * 10000)::integer;

    if not exists (
      select 1
      from public.giveaway_tickets
      where giveaway_id = p_giveaway_id
        and ticket_number = candidate
    ) then
      return candidate;
    end if;

    if tries > 10000 then
      raise exception 'No quedan numeros disponibles para este sorteo.';
    end if;
  end loop;
end;
$$;

create or replace function public.giveaway_user_has_tracking(p_user_id uuid)
returns boolean
security definer
set search_path = public
language sql
stable
as $$
  select exists (
    select 1
    from public.subscriptions
    where user_id = p_user_id
      and plan = 'tracking_monthly'
      and status in ('trial', 'active', 'grace')
      and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.giveaway_user_has_premium(p_user_id uuid)
returns boolean
security definer
set search_path = public
language sql
stable
as $$
  select exists (
    select 1
    from public.subscriptions
    where user_id = p_user_id
      and plan = 'premium_monthly'
      and status in ('trial', 'active', 'grace')
      and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.giveaway_valid_referral_count(p_user_id uuid)
returns integer
security definer
set search_path = public
language sql
stable
as $$
  select count(*)::integer
  from public.referral_events
  where referrer_user_id = p_user_id
    and status = 'valid';
$$;

create or replace function public.sync_giveaway_tickets(p_user_id uuid default null)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  draw_record record;
  profile_record record;
  principal_number integer;
  tracking_extra_target integer;
  referral_valid_count integer;
  referral_extra_target integer;
  existing_tracking integer;
  existing_referral integer;
  existing_total integer;
  generated_ticket_number integer;
  inserted_count integer := 0;
  ticket_id uuid;
begin
  for draw_record in
    select *
    from public.giveaways
    where status = 'active'
      and starts_at <= now()
      and (closes_at is null or closes_at >= now())
    order by draw_date asc, draw_time asc
  loop
    for profile_record in
      select id
      from public.profiles
      where p_user_id is null or id = p_user_id
    loop
      principal_number := public.giveaway_assign_principal_number(profile_record.id);

      if draw_record.allow_free then
        ticket_id := null;
        insert into public.giveaway_tickets(giveaway_id, user_id, ticket_number, origin, origin_detail)
        values (
          draw_record.id,
          profile_record.id,
          principal_number,
          'registro gratuito',
          jsonb_build_object('reason', 'Numero principal automatico')
        )
        on conflict (giveaway_id, ticket_number) do nothing
        returning id into ticket_id;

        if ticket_id is not null then
          inserted_count := inserted_count + 1;
          insert into public.giveaway_logs(giveaway_id, user_id, ticket_id, action, detail)
          values (draw_record.id, profile_record.id, ticket_id, 'ticket_assigned', jsonb_build_object('origin', 'registro gratuito', 'ticket_number', principal_number));
        end if;
      end if;

      existing_total := (
        select count(*)
        from public.giveaway_tickets
        where giveaway_id = draw_record.id
          and user_id = profile_record.id
          and status = 'active'
      );

      if draw_record.allow_tracking and public.giveaway_user_has_tracking(profile_record.id) then
        tracking_extra_target := greatest(coalesce(draw_record.tracking_chances, 6) - 1, 0);
        existing_tracking := (
          select count(*)
          from public.giveaway_tickets
          where giveaway_id = draw_record.id
            and user_id = profile_record.id
            and origin = 'Plan Seguimiento'
            and status = 'active'
        );

        while existing_tracking < tracking_extra_target and existing_total < draw_record.max_numbers_per_user loop
          ticket_id := null;
          generated_ticket_number := public.giveaway_random_ticket_number(draw_record.id);
          insert into public.giveaway_tickets(giveaway_id, user_id, ticket_number, origin, origin_detail)
          values (
            draw_record.id,
            profile_record.id,
            generated_ticket_number,
            'Plan Seguimiento',
            jsonb_build_object('plan', 'tracking_monthly')
          )
          returning id into ticket_id;

          existing_tracking := existing_tracking + 1;
          existing_total := existing_total + 1;
          inserted_count := inserted_count + 1;

          insert into public.giveaway_logs(giveaway_id, user_id, ticket_id, action, detail)
          values (draw_record.id, profile_record.id, ticket_id, 'ticket_assigned', jsonb_build_object('origin', 'Plan Seguimiento', 'ticket_number', generated_ticket_number));
        end loop;
      end if;

      if draw_record.allow_premium and public.giveaway_user_has_premium(profile_record.id) and coalesce(draw_record.premium_chances, 0) > 0 then
        existing_tracking := (
          select count(*)
          from public.giveaway_tickets
          where giveaway_id = draw_record.id
            and user_id = profile_record.id
            and origin = 'otro'
            and origin_detail ->> 'plan' = 'premium_monthly'
            and status = 'active'
        );

        while existing_tracking < draw_record.premium_chances and existing_total < draw_record.max_numbers_per_user loop
          ticket_id := null;
          generated_ticket_number := public.giveaway_random_ticket_number(draw_record.id);
          insert into public.giveaway_tickets(giveaway_id, user_id, ticket_number, origin, origin_detail)
          values (
            draw_record.id,
            profile_record.id,
            generated_ticket_number,
            'otro',
            jsonb_build_object('plan', 'premium_monthly')
          )
          returning id into ticket_id;

          existing_tracking := existing_tracking + 1;
          existing_total := existing_total + 1;
          inserted_count := inserted_count + 1;

          insert into public.giveaway_logs(giveaway_id, user_id, ticket_id, action, detail)
          values (draw_record.id, profile_record.id, ticket_id, 'ticket_assigned', jsonb_build_object('origin', 'premium_preparado', 'ticket_number', generated_ticket_number));
        end loop;
      end if;

      if draw_record.allow_referrals then
        referral_valid_count := public.giveaway_valid_referral_count(profile_record.id);
        referral_extra_target := least(
          floor(referral_valid_count::numeric / greatest(draw_record.referral_step, 1))::integer * greatest(draw_record.referral_bonus_chances, 1),
          draw_record.referral_bonus_max
        );

        existing_referral := (
          select count(*)
          from public.giveaway_tickets
          where giveaway_id = draw_record.id
            and user_id = profile_record.id
            and origin = 'referido'
            and status = 'active'
        );

        while existing_referral < referral_extra_target and existing_total < draw_record.max_numbers_per_user loop
          ticket_id := null;
          generated_ticket_number := public.giveaway_random_ticket_number(draw_record.id);
          insert into public.giveaway_tickets(giveaway_id, user_id, ticket_number, origin, origin_detail)
          values (
            draw_record.id,
            profile_record.id,
            generated_ticket_number,
            'referido',
            jsonb_build_object('valid_referrals', referral_valid_count)
          )
          returning id into ticket_id;

          existing_referral := existing_referral + 1;
          existing_total := existing_total + 1;
          inserted_count := inserted_count + 1;

          insert into public.giveaway_logs(giveaway_id, user_id, ticket_id, action, detail)
          values (draw_record.id, profile_record.id, ticket_id, 'ticket_assigned', jsonb_build_object('origin', 'referido', 'ticket_number', generated_ticket_number, 'valid_referrals', referral_valid_count));
        end loop;
      end if;
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'inserted', inserted_count);
end;
$$;

create or replace function public.on_profile_sync_giveaways()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  perform public.sync_giveaway_tickets(new.id);
  return new;
end;
$$;

drop trigger if exists profiles_sync_giveaways on public.profiles;
create trigger profiles_sync_giveaways
after insert on public.profiles
for each row execute function public.on_profile_sync_giveaways();

create or replace function public.on_subscription_sync_giveaways()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  perform public.sync_giveaway_tickets(new.user_id);
  return new;
end;
$$;

drop trigger if exists subscriptions_sync_giveaways on public.subscriptions;
create trigger subscriptions_sync_giveaways
after insert or update on public.subscriptions
for each row execute function public.on_subscription_sync_giveaways();

create or replace function public.on_referral_sync_giveaways()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  if new.status = 'valid' then
    perform public.sync_giveaway_tickets(new.referrer_user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists referrals_sync_giveaways on public.referral_events;
create trigger referrals_sync_giveaways
after insert or update on public.referral_events
for each row execute function public.on_referral_sync_giveaways();

insert into public.giveaways (
  slug,
  name,
  type,
  prize_label,
  prize_currency,
  prize_amount,
  draw_date,
  draw_time,
  status,
  starts_at,
  closes_at,
  selection_method,
  allow_free,
  allow_tracking,
  allow_premium,
  allow_referrals,
  legal_text
)
values
  (
    'sorteo-mensual-base',
    'Sorteo mensual Dolar MZA',
    'monthly',
    'USD 100 o equivalente en pesos',
    'USD',
    100,
    (date_trunc('month', now()) + interval '1 month - 1 day')::date,
    '22:00',
    'active',
    date_trunc('month', now()),
    (date_trunc('month', now()) + interval '1 month') - interval '1 second',
    'quiniela_mendoza_nocturna',
    true,
    true,
    false,
    true,
    'Participan usuarios registrados de Dolar MZA segun las reglas configuradas. El resultado se define con referencia a la Quiniela Nocturna de Mendoza. Si no hay coincidencia entre premios oficiales y tickets activos, se realiza sorteo automatico auditable entre tickets activos.'
  ),
  (
    'sorteo-anual-base',
    'Sorteo anual Dolar MZA',
    'annual',
    'USD 1.000 o equivalente en pesos',
    'USD',
    1000,
    make_date(extract(year from now())::integer, 12, 31),
    '22:00',
    'active',
    date_trunc('year', now()),
    make_timestamptz(extract(year from now())::integer, 12, 31, 23, 59, 59),
    'quiniela_mendoza_nocturna',
    true,
    true,
    false,
    true,
    'Participan usuarios registrados de Dolar MZA segun las reglas configuradas. El resultado se define con referencia a la Quiniela Nocturna de Mendoza. Si no hay coincidencia entre premios oficiales y tickets activos, se realiza sorteo automatico auditable entre tickets activos.'
  )
on conflict (slug) do update
set name = excluded.name,
    prize_label = excluded.prize_label,
    prize_currency = excluded.prize_currency,
    prize_amount = excluded.prize_amount,
    selection_method = excluded.selection_method,
    allow_free = excluded.allow_free,
    allow_tracking = excluded.allow_tracking,
    allow_premium = excluded.allow_premium,
    allow_referrals = excluded.allow_referrals,
    legal_text = excluded.legal_text;

select public.sync_giveaway_tickets(null);

alter table public.giveaways enable row level security;
alter table public.giveaway_user_numbers enable row level security;
alter table public.giveaway_tickets enable row level security;
alter table public.giveaway_results enable row level security;
alter table public.giveaway_logs enable row level security;

drop policy if exists giveaways_select_active_or_admin on public.giveaways;
create policy giveaways_select_active_or_admin on public.giveaways
for select using (status in ('active', 'closed', 'completed') or public.is_admin());

drop policy if exists giveaways_admin_all on public.giveaways;
create policy giveaways_admin_all on public.giveaways
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists giveaway_user_numbers_select_own_or_admin on public.giveaway_user_numbers;
create policy giveaway_user_numbers_select_own_or_admin on public.giveaway_user_numbers
for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists giveaway_user_numbers_admin_all on public.giveaway_user_numbers;
create policy giveaway_user_numbers_admin_all on public.giveaway_user_numbers
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists giveaway_tickets_select_own_or_admin on public.giveaway_tickets;
create policy giveaway_tickets_select_own_or_admin on public.giveaway_tickets
for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists giveaway_tickets_admin_all on public.giveaway_tickets;
create policy giveaway_tickets_admin_all on public.giveaway_tickets
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists giveaway_results_select_related_or_admin on public.giveaway_results;
create policy giveaway_results_select_related_or_admin on public.giveaway_results
for select using (winner_user_id = auth.uid() or public.is_admin());

drop policy if exists giveaway_results_admin_all on public.giveaway_results;
create policy giveaway_results_admin_all on public.giveaway_results
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists giveaway_logs_admin_all on public.giveaway_logs;
create policy giveaway_logs_admin_all on public.giveaway_logs
for all using (public.is_admin()) with check (public.is_admin());
