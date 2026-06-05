-- Dolar MZA - criterios finales para blue y blue Mendoza.
-- Ejecutar una sola vez en Supabase SQL Editor.

insert into public.rates (code, name, country, flag, type, buy_price, sell_price, variation, source, is_visible)
values
  (
    'USD_BLUE_PROMEDIO_MENDOZA',
    'Dolar Blue Promedio Mendoza',
    'Mendoza',
    'AR US',
    'main',
    null,
    null,
    0,
    'Pendiente promedio Mendoza validado',
    true
  )
on conflict (code) do update
set name = excluded.name,
    country = excluded.country,
    type = excluded.type,
    is_visible = true;

update public.rate_sources
set rate_codes = array['USD_BLUE_MENDOZA','USD_BLUE_PROMEDIO_MENDOZA']
where key = 'comunidad_mendoza';
