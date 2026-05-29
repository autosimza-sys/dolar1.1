-- Dólar MZA - ajustes finales para beta cerrada
-- Ejecutar una vez en Supabase SQL Editor después de subir estos cambios a producción.
-- No borra datos existentes.

alter table public.subscriptions
drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
add constraint subscriptions_plan_check
check (plan in ('free', 'essential_monthly', 'tracking_monthly', 'premium_monthly'));

insert into public.admin_settings(key, value)
values ('admin_emails', '["autosimza@gmail.com"]'::jsonb)
on conflict (key) do update
set value =
  case
    when jsonb_typeof(public.admin_settings.value) <> 'array' then '["autosimza@gmail.com"]'::jsonb
    when public.admin_settings.value @> '["autosimza@gmail.com"]'::jsonb then public.admin_settings.value
    else public.admin_settings.value || '["autosimza@gmail.com"]'::jsonb
  end;

create or replace function public.enforce_alert_plan_limits()
returns trigger
security definer
set search_path = public
as $$
declare
  active_count integer;
  whatsapp_count integer;
  active_plan text;
  active_limit integer;
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then
    return new;
  end if;

  select coalesce(
    (
      select s.plan
      from public.subscriptions s
      where s.user_id = new.user_id
        and s.status = 'active'
        and (s.expires_at is null or s.expires_at >= now())
      order by
        case s.plan
          when 'premium_monthly' then 3
          when 'tracking_monthly' then 2
          when 'essential_monthly' then 1
          else 0
        end desc,
        s.started_at desc nulls last
      limit 1
    ),
    case when coalesce(p.is_premium, false) then 'premium_monthly' else 'free' end
  )
  into active_plan
  from public.profiles p
  where p.id = new.user_id;

  if active_plan is null then
    active_plan := 'free';
  end if;

  if new.channel = 'whatsapp' and active_plan <> 'premium_monthly' then
    raise exception 'WhatsApp está incluido en el plan Premium.';
  end if;

  if not new.is_active then
    return new;
  end if;

  if active_plan = 'tracking_monthly' then
    active_limit := 4;
  elsif active_plan = 'premium_monthly' then
    active_limit := null;
  else
    active_limit := 1;
  end if;

  if active_limit is not null then
    select count(*) into active_count
    from public.alerts
    where user_id = new.user_id
      and is_active = true
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if active_count >= active_limit then
      if active_plan = 'tracking_monthly' then
        raise exception 'El plan Seguimiento incluye hasta 4 alertas activas.';
      end if;

      raise exception 'Este plan incluye 1 alerta activa.';
    end if;
  end if;

  if active_plan = 'premium_monthly' and new.channel = 'whatsapp' then
    select count(*) into whatsapp_count
    from public.alerts
    where user_id = new.user_id
      and is_active = true
      and channel = 'whatsapp'
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if whatsapp_count >= 6 then
      raise exception 'El plan Premium incluye hasta 6 alertas por WhatsApp.';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists enforce_alert_plan_limits on public.alerts;
create trigger enforce_alert_plan_limits
before insert or update on public.alerts
for each row execute function public.enforce_alert_plan_limits();
