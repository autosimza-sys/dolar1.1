# Dólar Mendoza

App mobile first para cotizaciones simples, alertas financieras, educación rápida y suscripciones Premium.

Concepto central: no vendemos cotizaciones, vendemos estar un paso antes.

## 1. Instalar

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`.

Para verificar producción:

```bash
npm run typecheck
npm run build
```

## 2. Configurar Supabase

1. Crear un proyecto nuevo en Supabase.
2. Ir a `SQL Editor`.
3. Ejecutar completo el archivo [`supabase/schema.sql`](./supabase/schema.sql).
4. Ejecutar también [`supabase/financial_upgrade.sql`](./supabase/financial_upgrade.sql) para agregar fuentes, historial y comunidad. No borra datos si el proyecto ya existe.
5. En `Authentication > Providers`, activar Email.
6. En `Authentication > URL Configuration`, cargar:
   - Site URL: `http://localhost:3000` en local.
   - En producción: la URL final de Vercel.

Si Supabase tiene activada la confirmación por email, el usuario deberá abrir el mail y tocar el enlace antes de iniciar sesión. Es lo recomendado para evitar cuentas falsas.

El SQL crea:

- `profiles`
- `rates`
- `alerts`
- `alert_logs`
- `education_cards`
- `subscriptions`
- `admin_settings`
- `favorite_rates`
- `rate_sources`
- `rate_source_readings`
- `rate_history`
- `community_reports`

También activa Row Level Security, carga datos demo y limita usuarios gratis a 1 alerta activa.

## 3. Variables de entorno

Copiar `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Variables:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
NEXT_PUBLIC_ADMIN_EMAILS=admin@dolarmendoza.app
MERCADO_PAGO_ACCESS_TOKEN=APP_USR_xxx
MERCADO_PAGO_PREAPPROVAL_PLAN_ID=
MERCADO_PAGO_WEBHOOK_SECRET=cambiar-este-secreto
PREMIUM_MONTHLY_PRICE=3500
ALERTS_CRON_SECRET=cambiar-este-secreto
CRON_SECRET=cambiar-este-secreto
RATES_UPDATE_SECRET=cambiar-este-secreto
AUTOMATION_SECRET=cambiar-este-secreto
RESEND_API_KEY=re_xxx
ALERT_FROM_EMAIL=Dólar Mendoza <alertas@tudominio.com>
```

## 4. Desplegar en Vercel

1. Subir el repo a GitHub.
2. Importar el proyecto en Vercel.
3. Cargar las mismas variables de `.env.local` en `Project Settings > Environment Variables`.
4. Cambiar `NEXT_PUBLIC_APP_URL` por la URL de producción.
5. Deploy.

Build command: `npm run build`.

## 5. Mercado Pago

La app mantiene integración por variables de entorno.

Si ya tenés Mercado Pago configurado en Vercel, conservá:

- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_PREAPPROVAL_PLAN_ID`, si ya tenés un plan mensual creado.
- `MERCADO_PAGO_WEBHOOK_SECRET`, si usás secreto en la URL del webhook.

Flujo:

- Botón `Probar Premium`.
- Endpoint: `/api/mercadopago/create-subscription`.
- Si existe `MERCADO_PAGO_PREAPPROVAL_PLAN_ID`, crea una suscripción mensual.
- Si no existe, crea una preferencia de checkout mensual como fallback.
- Webhook: `/api/mercadopago/webhook?secret=TU_SECRET`.
- El webhook actualiza `subscriptions` y `profiles.is_premium`.

En Mercado Pago, configurá la notificación webhook apuntando a:

```text
https://TU-DOMINIO.vercel.app/api/mercadopago/webhook?secret=TU_SECRET
```

## 6. Entrar al admin

Admin URL:

```text
/admin
```

Admin demo por defecto:

```text
admin@dolarmendoza.app
```

Para cambiar admins, editá en Supabase:

```sql
update public.admin_settings
set value = '["tu-email@dominio.com"]'::jsonb
where key = 'admin_emails';
```

Y en Vercel/local:

```env
NEXT_PUBLIC_ADMIN_EMAILS=tu-email@dominio.com
```

Después creá una cuenta con ese email desde `/account` o `/admin`.

## 7. Probar alertas

1. Crear cuenta en `/account`.
2. Ir a `/alerts`.
3. Crear una alerta por email.
4. El usuario gratis puede tener 1 alerta activa.
5. WhatsApp y alertas ilimitadas requieren Premium.

Para ejecutar el chequeo manual:

```bash
curl -X POST "http://localhost:3000/api/alerts/check?secret=cambiar-este-secreto"
```

En Vercel podés crear un Cron Job contra:

```text
/api/alerts/check?secret=TU_ALERTS_CRON_SECRET
```

Cuando una alerta se dispara, se guarda en `alert_logs`, se crea un registro en `notification_jobs` y se procesa el envio por email si `RESEND_API_KEY` esta configurada.

## 8. Actualización automática de cotizaciones

La app incluye un actualizador automatico:

```text
/api/rates/update
```

Y una ruta recomendada para produccion que hace el ciclo completo:

```text
/api/automation/run
```

Ese ciclo actualiza cotizaciones, guarda logs en `source_update_logs`, evalua alertas, crea trabajos en `notification_jobs` y procesa emails pendientes con reintentos.

El motor financiero no publica una fuente cruda: construye valores promedio de referencia, guarda lecturas internas, descarta outliers y deja logs para admin.

Fuentes incluidas y configurables:

- DolarAPI para dólar oficial, blue, MEP y monedas oficiales.
- ArgentinaDatos y RatesArg como fuentes alternativas tolerantes a fallos.
- BCRA API para tasa de plazo fijo 30 días y estimaciones mensuales.
- Comunidad anónima de Mendoza como referencia estadística para Blue Mendoza.

Para actualizar cada 3 minutos, usar un cron externo como cron-job.org o Upstash QStash llamando:

```text
https://TU-DOMINIO/api/automation/run?secret=TU_SECRET
```

Para que funcione en producción, cargá en Vercel:

```env
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
CRON_SECRET=un-secreto-largo
RATES_UPDATE_SECRET=un-secreto-largo
ALERTS_CRON_SECRET=un-secreto-largo
AUTOMATION_SECRET=un-secreto-largo
RESEND_API_KEY=re_xxx
ALERT_FROM_EMAIL=Dólar Mendoza <alertas@tudominio.com>
```

Prueba manual:

```bash
curl "https://TU-DOMINIO/api/automation/run?secret=TU_SECRET"
```

Notas:

- Los mercados oficiales promedian compra real y venta real.
- Los mercados blue/paralelos usan promedio validado y criterio propio: compra = promedio - spread, venta = promedio + spread.
- Blue Mendoza respeta prioridad: manual admin, automático comunitario/regional, fallback nacional.
- Si una cotización no tiene fuente confiable, el admin puede marcarla como `Sin fuente confiable` y ocultarla de la home.

## 8.1 Comunidad financiera mendocina

La home incluye una sección anónima para informar operaciones reales ya realizadas. No requiere registro.

Campos:

- compra o venta
- moneda
- monto
- cotización
- departamento
- comentario opcional

El backend bloquea datos de contacto, WhatsApp, Telegram, Instagram, emails, alias, CBU/CVU, URLs y ofertas directas de compra/venta. Si una operación está muy fuera de rango, se guarda como sospechosa y no entra en estadísticas.

Texto legal visible:

```text
Los valores publicados por usuarios corresponden a operaciones informadas de manera independiente y no representan una cotización oficial ni fijan precios de mercado.
```

## 9. Cargar cotizaciones

Desde `/admin`:

- Cargar cotización manual.
- Editar compra, venta, variación y fuente.
- Activar/desactivar moneda visible.
- Marcar fuente como sin fuente confiable.
- Actualizar tasa BCRA.
- Actualizar plazo fijo.
- Activar/desactivar fuentes de datos.
- Ver lecturas aceptadas/rechazadas.
- Activar/desactivar Blue Mendoza manual.
- Moderar reportes comunitarios.
- Activar/desactivar filtros de comunidad.

Regla clave: si una moneda queda con `is_visible = false`, no aparece en la home.

## 10. Estructura

```text
src/app
  page.tsx
  alerts/page.tsx
  learn/page.tsx
  premium/page.tsx
  account/page.tsx
  admin/page.tsx
  api/mercadopago/create-subscription/route.ts
  api/mercadopago/webhook/route.ts
  api/alerts/check/route.ts
  api/automation/run/route.ts
  api/community/reports/route.ts
src/components
src/lib
supabase/schema.sql
supabase/financial_upgrade.sql
```

## 11. Datos demo

El SQL carga:

- Dólar Oficial
- Dólar Blue
- Dólar Blue Mendoza
- Dólar Bolsa / MEP
- Dólar CCL
- Peso chileno oficial y blue
- Real oficial y blue
- Euro oficial y blue
- Tasa BCRA
- Plazo fijo promedio 30 días
- Rendimiento mensual estimado
- Tarjetas de educación financiera

Si Supabase no está configurado todavía, la UI usa datos demo locales para poder revisar el diseño.
