# Dólar MZA - Manual técnico y checklist de lanzamiento

Revisión: 26/05/2026  
Dominio productivo: `https://dolarmza.com.ar`  
Repositorio/proyecto: Dólar MZA / Dólar Mendoza  
Stack: Next.js 15, React 19, TypeScript, Supabase, Vercel, Resend, Mercado Pago

## 1. Resumen ejecutivo

Dólar MZA es una plataforma financiera mobile first enfocada en Mendoza y Argentina.

La app busca:

- Mostrar cotizaciones simples y claras.
- Construir valores promedio de referencia usando fuentes externas y criterio propio.
- Permitir alertas personalizadas.
- Capturar usuarios registrados.
- Preparar monetización Premium.
- Permitir administración manual y automática de datos.
- Incorporar comunidad financiera informativa, sin operar como marketplace.

Concepto comercial:

> No vendemos cotizaciones. Vendemos estar un paso antes.

## 2. Estado general actual

### Funcionando en producción

- Home pública.
- Cotizaciones visibles.
- Página de cuenta.
- Página de alertas.
- Página Premium.
- Página Aprender.
- Página Admin carga.
- Manifest/PWA básico.
- Supabase conectado.
- Actualización automática de cotizaciones por endpoint.
- Evaluación backend de alertas.
- Base de datos con RLS.
- Dominio propio `dolarmza.com.ar`.
- Resend con dominio verificado.
- Templates de email cargados en Supabase, según capturas.

### Funcionando localmente, pendiente de deploy o validación final en producción

- Nueva pantalla `/reset-password`.
- Flujo mejorado de recuperación de contraseña.
- Reenvío de email de confirmación.
- Traducción de errores técnicos de login a mensajes simples.
- Mejora del admin para leer emails admin desde Supabase.
- Corrección del endpoint `/api/debug/supabase`.

### No funcionando o no confirmado

- `/reset-password` devolvió `404` en producción durante la última prueba. Eso indica que falta subir cambios y redeployar.
- Envío real de alerta por email no fue confirmado con una alerta disparada.
- Admin puede seguir mostrando “Sin acceso” si no está deployado el último cambio o si el email no coincide.
- Mercado Pago no fue probado end to end en esta revisión.
- WhatsApp no está implementado todavía.

## 3. Arquitectura técnica

### Frontend

Framework:

- Next.js App Router.
- React.
- TypeScript.
- CSS global en `src/app/globals.css`.
- Mobile first con navegación inferior fija.

Pantallas principales:

- `/` Inicio.
- `/alerts` Crear alertas.
- `/learn` Educación financiera.
- `/premium` Planes y conversión Premium.
- `/account` Cuenta privada.
- `/admin` Panel admin.
- `/reset-password` Nueva contraseña.

### Backend

Backend basado en rutas API de Next.js:

- `/api/rates/update`
- `/api/alerts/check`
- `/api/automation/run`
- `/api/community/reports`
- `/api/mercadopago/create-subscription`
- `/api/mercadopago/webhook`
- `/api/debug/supabase`

### Base de datos

Proveedor:

- Supabase Postgres.

Tablas principales:

- `profiles`
- `rates`
- `alerts`
- `alert_logs`
- `education_cards`
- `subscriptions`
- `admin_settings`
- `favorite_rates`
- `notification_jobs`
- `rate_sources`
- `rate_source_readings`
- `rate_history`
- `source_update_logs`
- `community_reports`

Seguridad:

- Row Level Security activado.
- Usuarios solo ven sus datos.
- Admin definido por `admin_settings.admin_emails`.
- Service role usado solo en endpoints backend.

## 4. Variables de entorno necesarias

Estas variables deben existir en Vercel.

```env
NEXT_PUBLIC_APP_URL=https://dolarmza.com.ar

NEXT_PUBLIC_SUPABASE_URL=https://tckgfsczylncpnwydlcd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

NEXT_PUBLIC_ADMIN_EMAILS=autosimza@gmail.com

ALERTS_CRON_SECRET=dolar_mendoza_alertas_2026_seguro
CRON_SECRET=dolar_mendoza_alertas_2026_seguro
RATES_UPDATE_SECRET=dolar_mendoza_alertas_2026_seguro
AUTOMATION_SECRET=dolar_mendoza_alertas_2026_seguro

RESEND_API_KEY=re_...
ALERT_FROM_EMAIL=Dólar MZA <alertas@dolarmza.com.ar>

MERCADO_PAGO_ACCESS_TOKEN=...
MERCADO_PAGO_PREAPPROVAL_PLAN_ID=...
MERCADO_PAGO_WEBHOOK_SECRET=...
PREMIUM_MONTHLY_PRICE=3500
```

Importante:

- No publicar `SUPABASE_SERVICE_ROLE_KEY`.
- No publicar `RESEND_API_KEY`.
- No publicar claves de Mercado Pago.

## 5. Qué hace cada módulo

### Inicio

Archivo principal:

- `src/components/HomeScreen.tsx`

Hace:

- Muestra cotizaciones principales.
- Muestra monedas de viaje/frontera.
- Muestra Argentina hoy.
- Muestra comunidad financiera mendocina.
- Usa tarjetas grandes, oscuras y verdes.
- Mantiene navegación mobile.

Estado:

- Funciona.
- Probado: la home respondió `200 OK`.

### Cotizaciones

Archivos:

- `src/components/RateCard.tsx`
- `src/lib/rate-updater.ts`
- `src/app/api/rates/update/route.ts`

Hace:

- Muestra compra, venta, variación y fecha.
- Actualiza cotizaciones desde fuentes externas.
- Promedia valores.
- Valida outliers.
- Registra lecturas internas.
- Usa fallback si una fuente falla.
- Permite ocultar monedas sin fuente confiable.

Fuentes incluidas:

- DolarAPI.
- ArgentinaDatos.
- RatesArg.
- BCRA API.
- Comunidad/local como referencia para Blue Mendoza.

Estado:

- Funciona.
- Última prueba: `/api/rates/update` respondió `ok:true`.
- Actualizó: `BCRA_RATE`, `FIXED_TERM_30`, `MONTHLY_YIELD`, `USD_OFICIAL`, `USD_BLUE`, `USD_MEP`, `USD_CCL`, `EUR_OFICIAL`, `BRL_OFICIAL`, `CLP_OFICIAL`, `USD_BLUE_MENDOZA`, `CLP_BLUE`, `BRL_BLUE`, `EUR_BLUE`.
- Advertencia: RatesArg respondió `530`, pero la app no se rompió.

### Alertas

Archivos:

- `src/components/AlertBuilder.tsx`
- `src/lib/alert-rules.ts`
- `src/lib/alert-processor.ts`
- `src/lib/notifications.ts`
- `src/app/api/alerts/check/route.ts`
- `src/app/api/automation/run/route.ts`

Hace:

- Permite crear alertas por email o WhatsApp.
- Gratis: 1 alerta activa.
- Premium: alertas ilimitadas.
- Evalúa condiciones contra cotizaciones actuales.
- Guarda logs en `alert_logs`.
- Crea trabajos en `notification_jobs`.
- Procesa emails pendientes con Resend.

Tipos de alerta:

- Dólar supera precio.
- Dólar baja de precio.
- MEP baja.
- MEP supera blue.
- Brecha supera porcentaje.
- Tasa BCRA sube/baja.
- Plazo fijo mejora.
- Comparación dólar/plazo fijo.
- Movimientos fuertes de monedas de viaje.

Estado:

- Backend funciona.
- Última prueba: `/api/alerts/check` respondió `ok:true`.
- Revisó 2 alertas.
- No envió emails porque ninguna alerta se disparó en ese momento.

Pendiente:

- Probar envío real con una alerta que se cumpla.
- Confirmar que `RESEND_API_KEY` está en Vercel.
- Confirmar que `ALERT_FROM_EMAIL` está en Vercel.
- WhatsApp no está implementado.

### Automatización

Endpoint recomendado:

```text
https://dolarmza.com.ar/api/automation/run?secret=dolar_mendoza_alertas_2026_seguro
```

Hace:

- Actualiza cotizaciones.
- Guarda logs.
- Evalúa alertas.
- Crea notificaciones.
- Procesa emails pendientes.

Estado:

- Código implementado.
- Debe ejecutarse con cron externo cada 3 minutos.

Pendiente:

- Confirmar configuración activa en cron-job.org, Upstash o similar.
- Monitorear logs.

### Registro y login

Archivos:

- `src/components/AuthForm.tsx`
- `src/components/AuthModal.tsx`
- `src/components/AccountScreen.tsx`

Hace:

- Registro con email y contraseña.
- WhatsApp opcional.
- Confirmación de email por Supabase.
- Login.
- Mensajes simples para usuario.
- Reenvío de email de confirmación.

Estado:

- Código nuevo implementado localmente.
- Falta confirmar si está deployado en producción.

Pendiente:

- Subir/redeployar si todavía no aparece “¿Olvidaste tu contraseña?”.
- Probar registro nuevo completo.
- Probar confirmación desde Gmail.

### Recuperación de contraseña

Archivos:

- `src/components/ResetPasswordScreen.tsx`
- `src/app/reset-password/page.tsx`

Hace:

- Solicita email.
- Envía link de recuperación.
- Permite cargar nueva contraseña.
- Valida mínimo 6 caracteres.
- Valida confirmación de contraseña.
- Redirige a cuenta.

Estado:

- Funciona localmente.
- En producción `/reset-password` dio `404`, por lo que falta deployar.

Pendiente:

- Subir archivos.
- Redeploy.
- Probar email de recuperación.

### Emails transaccionales

Proveedor:

- Resend.

Remitente recomendado:

```text
Dólar MZA <no-reply@dolarmza.com.ar>
```

o para alertas:

```text
Dólar MZA <alertas@dolarmza.com.ar>
```

Templates:

- `supabase/email-templates/confirm-account.html`
- `supabase/email-templates/reset-password.html`

Hace:

- Email de confirmación en español.
- Email de recuperación en español.
- Diseño oscuro/verde.
- Compatible con Gmail.

Estado:

- Dominio Resend verificado según capturas.
- Templates cargados según capturas.

Pendiente:

- Prueba real de registro.
- Prueba real de recuperación.
- Prueba real de alerta por email.

### Cuenta privada

Archivo:

- `src/components/AccountScreen.tsx`

Hace:

- Muestra usuario.
- Muestra estado Gratis/Premium.
- Muestra alertas activas.
- Permite editar alerta.
- Permite eliminar alerta.
- Muestra monedas favoritas.
- Muestra historial de alertas recibidas.
- Botón Premium.

Estado:

- Funciona.
- Requiere login.

### Admin

Archivo:

- `src/components/AdminScreen.tsx`

Hace:

- Carga y edición manual de cotizaciones.
- Ocultar/mostrar monedas.
- Marcar sin fuente confiable.
- Ver usuarios.
- Ver alertas.
- Ver suscripciones.
- Ver trabajos de notificación.
- Ver logs de fuentes.
- Activar/desactivar fuentes.
- Moderar comunidad.
- Editar Blue Mendoza manual.

Estado:

- Página carga.
- Acceso depende de email admin.

Pendiente:

- Confirmar que el último cambio de admin está deployado.
- Confirmar que `admin_settings` tiene el email correcto.
- Confirmar que el usuario está logueado con ese mismo email.

SQL para admin:

```sql
update public.admin_settings
set value = '["autosimza@gmail.com"]'::jsonb
where key = 'admin_emails';
```

Verificación:

```sql
select key, value
from public.admin_settings
where key = 'admin_emails';
```

### Comunidad financiera mendocina

Archivos:

- `src/components/CommunityReports.tsx`
- `src/app/api/community/reports/route.ts`

Hace:

- Permite informar operación real de forma anónima.
- No requiere registro.
- Pide tipo, moneda, monto, cotización, departamento y comentario opcional.
- Muestra texto legal.
- Bloquea datos de contacto.
- Bloquea intentos de compra/venta directa.
- Marca valores sospechosos.

Estado:

- Implementado.

Pendiente:

- Probar envíos reales en producción.
- Probar filtros con casos malos.
- Definir política de moderación diaria.

### Premium

Archivos:

- `src/components/PremiumScreen.tsx`
- `src/app/api/mercadopago/create-subscription/route.ts`
- `src/app/api/mercadopago/webhook/route.ts`

Hace:

- Muestra planes Gratis y Premium.
- Botón Probar Premium.
- Crea preferencia o suscripción en Mercado Pago.
- Webhook actualiza suscripciones y `profiles.is_premium`.

Estado:

- Código implementado.

Pendiente:

- Probar pago real o sandbox.
- Confirmar variables de Mercado Pago en Vercel.
- Confirmar webhook en Mercado Pago.
- Confirmar cambio real a Premium después de pago.

### WhatsApp

Estado:

- No implementado.
- En el código se reconoce canal `whatsapp`, pero los trabajos quedan omitidos si no hay proveedor configurado.

Pendiente:

- Elegir proveedor: WhatsApp Business Cloud API, Twilio, Zenvia, WATI u otro.
- Crear templates aprobados.
- Implementar envío real.
- Definir costos y límites.

## 6. Endpoints importantes

### Cotizaciones

```text
GET /api/rates/update?secret=...
```

Uso:

- Actualiza cotizaciones.
- Se puede ejecutar manualmente.

### Alertas

```text
GET /api/alerts/check?secret=...
```

Uso:

- Evalúa alertas activas.
- Crea notificaciones.
- Procesa emails.

### Automatización completa

```text
GET /api/automation/run?secret=...
```

Uso recomendado:

- Cron cada 3 minutos.
- Hace actualización + alertas.

### Diagnóstico

```text
GET /api/debug/supabase?secret=...
```

Uso:

- Verifica variables Supabase.
- Prueba lectura y escritura.

Estado:

- Tenía bug menor por `type = debug`.
- Corregido localmente usando `type = indicator`.
- Requiere deploy.

## 7. Pruebas realizadas

### Producción

Probado el 26/05/2026:

```text
https://dolarmza.com.ar/ -> 200 OK
https://dolarmza.com.ar/account -> 200 OK
https://dolarmza.com.ar/admin -> 200 OK
https://dolarmza.com.ar/alerts -> 200 OK
https://dolarmza.com.ar/reset-password -> 404
https://dolarmza.com.ar/manifest.webmanifest -> 200 OK
```

APIs:

```text
/api/alerts/check -> ok:true, checked:2, queued:[], processed:[]
/api/rates/update -> ok:true, updated:14, readings:20, rejected:0
```

### Local

Comandos:

```bash
npm run lint
npm run typecheck
npm run build
```

Estado:

- OK.

## 8. Qué todavía no hace la app

### Producto

- No envía WhatsApp real.
- No tiene tablero personal avanzado.
- No tiene historial gráfico completo de cada moneda en frontend.
- No tiene comparador dólar/plazo fijo visual completo.
- No tiene señales Premium avanzadas reales más allá de alertas base.
- No tiene onboarding guiado paso a paso.
- No tiene analítica de usuarios integrada.
- No tiene panel de soporte o tickets.

### Backend

- No tiene monitoreo externo con alertas de caída.
- No tiene retry visual para fuentes fallidas desde admin.
- No tiene cola externa robusta tipo QStash/Redis/worker dedicado.
- No tiene tests automatizados unitarios/e2e.
- No tiene rate limiting propio por IP para formularios públicos.
- No tiene backup/restore documentado.

### Legal/compliance

- Falta revisar términos y condiciones.
- Falta política de privacidad.
- Falta disclaimer financiero general en footer o página legal.
- Falta definir responsabilidad sobre datos de comunidad.
- Falta definir texto legal para Premium/pagos.

### Monetización

- Mercado Pago no confirmado end to end.
- No está confirmado el plan mensual real.
- No hay pantalla de facturación/gestión de baja.
- No hay comprobante o historial de pagos visible al usuario.

## 9. Riesgos antes de lanzamiento

### Riesgo alto

- `/reset-password` no está en producción.
- Admin puede bloquearse si el email no coincide.
- Emails de alerta no fueron probados con alerta real disparada.
- Mercado Pago no fue probado end to end.

### Riesgo medio

- Una fuente externa puede fallar, como RatesArg con error 530.
- Cron externo debe estar bien configurado.
- Los emails pueden caer en spam si falta reputación o configuración.
- Comunidad puede recibir intentos de contacto o spam.

### Riesgo bajo

- Ajustes visuales desktop.
- Textos comerciales Premium.
- Pequeñas mejoras en mensajes de usuario.

## 10. Checklist para poner fecha de lanzamiento

Usar esta tabla para asignar fecha objetivo.

| Prioridad | Tarea | Estado actual | Responsable | Fecha objetivo | Listo |
|---|---|---|---|---|---|
| P0 | Subir últimos archivos a GitHub | Pendiente confirmar | Técnico | ___/___/____ | No |
| P0 | Redeploy en Vercel | Pendiente confirmar | Técnico | ___/___/____ | No |
| P0 | Verificar que `/reset-password` deje de dar 404 | Pendiente | Técnico | ___/___/____ | No |
| P0 | Ejecutar SQL de admin con email correcto | Pendiente confirmar | Admin | ___/___/____ | No |
| P0 | Entrar al admin con `autosimza@gmail.com` | Pendiente | Admin/Técnico | ___/___/____ | No |
| P0 | Confirmar registro nuevo completo | Pendiente | QA | ___/___/____ | No |
| P0 | Confirmar recuperación de contraseña | Pendiente | QA | ___/___/____ | No |
| P0 | Confirmar alerta real por email | Pendiente | QA/Técnico | ___/___/____ | No |
| P0 | Confirmar cron cada 3 minutos | Pendiente confirmar | Técnico | ___/___/____ | No |
| P0 | Probar `/api/automation/run` manual | Parcial | Técnico | ___/___/____ | No |
| P0 | Confirmar variables Vercel | Parcial | Técnico | ___/___/____ | No |
| P0 | Confirmar Resend `RESEND_API_KEY` en Vercel | Pendiente confirmar | Técnico | ___/___/____ | No |
| P0 | Confirmar Mercado Pago checkout | Pendiente | Técnico | ___/___/____ | No |
| P0 | Confirmar Mercado Pago webhook | Pendiente | Técnico | ___/___/____ | No |
| P1 | Revisar textos legales mínimos | Pendiente | Legal/Negocio | ___/___/____ | No |
| P1 | Crear política de privacidad | Pendiente | Legal/Negocio | ___/___/____ | No |
| P1 | Crear términos y condiciones | Pendiente | Legal/Negocio | ___/___/____ | No |
| P1 | Probar comunidad con reporte válido | Pendiente | QA | ___/___/____ | No |
| P1 | Probar comunidad con datos de contacto prohibidos | Pendiente | QA | ___/___/____ | No |
| P1 | Revisar admin en mobile y desktop | Pendiente | QA | ___/___/____ | No |
| P1 | Revisar home en mobile real | Parcial | QA | ___/___/____ | No |
| P1 | Revisar home en desktop real | Parcial | QA | ___/___/____ | No |
| P1 | Preparar mensaje de lanzamiento | Pendiente | Marketing | ___/___/____ | No |
| P1 | Preparar contenido redes/WhatsApp comunidad | Pendiente | Marketing | ___/___/____ | No |
| P2 | Implementar WhatsApp real | No implementado | Técnico | ___/___/____ | No |
| P2 | Agregar analytics | No implementado | Técnico | ___/___/____ | No |
| P2 | Agregar gráficos históricos | No implementado | Técnico | ___/___/____ | No |
| P2 | Tablero Premium avanzado | No implementado | Producto/Técnico | ___/___/____ | No |

## 11. Propuesta de fases de lanzamiento

### Fase 1 - Cierre técnico mínimo

Objetivo:

- Que registro, login, recuperación, admin, cotizaciones y alertas por email funcionen.

Condición para pasar:

- Todos los P0 en “Listo”.

Fecha sugerida:

```text
___/___/____
```

### Fase 2 - Beta cerrada

Objetivo:

- Probar con 10 a 30 usuarios conocidos.
- Detectar errores de mails, cotizaciones, alertas y UX.

Duración sugerida:

```text
7 días
```

Fecha sugerida:

```text
___/___/____
```

### Fase 3 - Lanzamiento público suave

Objetivo:

- Compartir con comunidad chica.
- No activar publicidad fuerte todavía.
- Medir registros, alertas creadas y errores.

Duración sugerida:

```text
7 a 14 días
```

Fecha sugerida:

```text
___/___/____
```

### Fase 4 - Lanzamiento comercial

Objetivo:

- Activar Premium.
- Activar comunicación comercial.
- Empezar captación más fuerte.

Condición:

- Mercado Pago probado.
- Emails confiables.
- Cron estable.
- Admin operativo.

Fecha sugerida:

```text
___/___/____
```

## 12. Pruebas obligatorias antes de publicar

### Registro

- Crear usuario nuevo.
- Ver pantalla “Revisá tu email”.
- Recibir email de confirmación.
- Confirmar cuenta.
- Entrar normalmente.

### Recuperación

- Tocar “¿Olvidaste tu contraseña?”.
- Recibir email.
- Abrir link.
- Cargar nueva contraseña.
- Entrar con contraseña nueva.

### Admin

- Login con email admin.
- Entrar a `/admin`.
- Editar una cotización.
- Ocultar y volver a mostrar una moneda.
- Revisar logs.

### Cotizaciones

- Ejecutar:

```text
https://dolarmza.com.ar/api/rates/update?secret=dolar_mendoza_alertas_2026_seguro
```

- Confirmar `ok:true`.
- Confirmar que precios no quedan absurdos.

### Alertas

- Crear alerta de prueba por email.
- Usar condición fácil de cumplir.
- Ejecutar:

```text
https://dolarmza.com.ar/api/alerts/check?secret=dolar_mendoza_alertas_2026_seguro
```

- Confirmar email recibido.
- Confirmar `alert_logs`.
- Confirmar `notification_jobs`.

### Automatización

- Configurar cron cada 3 minutos:

```text
https://dolarmza.com.ar/api/automation/run?secret=dolar_mendoza_alertas_2026_seguro
```

- Confirmar ejecuciones exitosas.

### Premium

- Probar botón Premium.
- Probar checkout.
- Confirmar webhook.
- Confirmar usuario pasa a Premium.

## 13. Recomendación de fecha de lanzamiento

No conviene fijar lanzamiento público hasta cerrar P0.

Recomendación:

- Fecha de beta cerrada: después de que `/reset-password`, admin y alerta por email funcionen.
- Fecha de lanzamiento público: 7 días después de beta cerrada sin errores graves.
- Fecha de Premium comercial: después de Mercado Pago probado end to end.

Propuesta editable:

```text
Beta cerrada: ___/___/____
Lanzamiento público suave: ___/___/____
Premium activo: ___/___/____
Lanzamiento comercial completo: ___/___/____
```

## 14. Archivos críticos para subir antes de la próxima prueba

```text
src/components/AuthForm.tsx
src/components/ResetPasswordScreen.tsx
src/app/reset-password/page.tsx
src/app/globals.css
src/components/AdminScreen.tsx
src/app/api/debug/supabase/route.ts
supabase/email-templates/confirm-account.html
supabase/email-templates/reset-password.html
supabase/email-templates/README.md
README.md
docs/manual-tecnico-lanzamiento.md
```

## 15. Criterio de “listo para salir”

La app está lista para salir cuando:

- Home carga rápido.
- Cotizaciones se actualizan solas.
- Registro confirma por email.
- Recuperación de contraseña funciona.
- Admin entra con email correcto.
- Alertas por email llegan.
- Cron corre cada 3 minutos.
- Mercado Pago está probado o Premium queda desactivado comercialmente.
- Textos legales mínimos están publicados.
- Hay una persona responsable de revisar admin y logs todos los días.

## 16. Actualización de cierre beta - 26/05/2026

Cambios aplicados en esta revisión:

- `/reset-password` existe y compila localmente. En producción sigue en `404` hasta redeploy.
- Alertas de horario agregadas: apertura/cierre mercado oficial y apertura/cierre mercado informal.
- El paso 3 de alertas ya no pide precio cuando la alerta es de horario.
- Paso 2 de alertas mantiene dropdown compacto.
- Banderas se mantienen como emoji rectangular/horizontal, no avatar circular.
- Planes actualizados:
  - Esencial: `$500/mes`, 1 alerta por email, 7 días gratis.
  - Seguimiento: `$1.500/mes`, hasta 4 alertas por email, 7 días gratis.
  - Premium: `$35.000/mes`, email ilimitado, hasta 6 WhatsApp, sin prueba gratis.
- Mercado Pago ahora recibe el plan seleccionado.
- `.env.example` incluye variables de precio y preapproval por plan.
- `supabase/launch_ready_upgrade.sql` agrega planes nuevos, habilita `autosimza@gmail.com` como admin y actualiza límites por plan.
- Email de alertas usa branding `Dólar MZA`.

Validaciones locales:

```text
npm run lint -> OK
npm run build -> OK
npm run typecheck -> OK
```

Rutas locales probadas con `next start`:

```text
/ -> 200
/alerts -> 200
/premium -> 200
/account -> 200
/admin -> 200
/reset-password -> 200
```

Producción probada:

```text
https://dolarmza.com.ar/ -> 200
https://dolarmza.com.ar/account -> 200
https://dolarmza.com.ar/admin -> 200
https://dolarmza.com.ar/alerts -> 200
https://dolarmza.com.ar/premium -> 200
https://dolarmza.com.ar/reset-password -> 404 pendiente de deploy
```

APIs producción:

```text
/api/rates/update -> ok:true, actualizó 14 cotizaciones
/api/alerts/check -> ok:true, checked:2, sin envíos porque no había alerta disparada
/api/automation/run -> ok:true, actualizó cotizaciones y revisó alertas
```

Próximo paso obligatorio:

1. Subir todos los archivos modificados a GitHub.
2. Redeploy en Vercel.
3. Ejecutar `supabase/launch_ready_upgrade.sql` en Supabase.
4. Probar `/reset-password` en producción.
5. Crear una alerta de prueba que se cumpla y confirmar email recibido.

## 17. WhatsApp - recomendación para beta

Estado actual:

- WhatsApp no está implementado como envío real.
- El sistema ya reconoce el canal `whatsapp`, pero los trabajos quedan omitidos si no hay proveedor configurado.
- No conviene activarlo comercialmente hasta tener número, templates aprobados y costo controlado.

Opción recomendada:

1. Beta cerrada solo con email.
2. Activar WhatsApp después de validar:
   - alertas por email,
   - cron estable,
   - usuarios reales creando alertas,
   - Mercado Pago probado.
3. Usar WhatsApp Cloud API directo si se busca menor costo técnico a largo plazo.
4. Usar Twilio si se prefiere onboarding más simple y soporte, aceptando una comisión extra por mensaje.
5. Dejar Zenvia como alternativa si se necesita soporte comercial regional o una bandeja multicanal.

Credenciales necesarias para WhatsApp Cloud API:

```text
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ALERT_TEMPLATE_NAME=
WHATSAPP_VERIFY_TOKEN=
```

Templates mínimos a pedir:

- `alerta_precio_dolar`
- `alerta_movimiento_mercado`
- `alerta_tasa_interes`
- `alerta_horario_mercado`

Ejemplo de texto de template:

```text
Dólar MZA: {{1}}
Revisá tu cuenta para ver el detalle de la alerta.
```

Fuentes de referencia:

- Meta WhatsApp Business Platform Pricing: `https://business.whatsapp.com/products/platform-pricing`
- Twilio WhatsApp Pricing: `https://www.twilio.com/en-us/whatsapp/pricing`
- Twilio WhatsApp Docs: `https://www.twilio.com/docs/whatsapp`
- Zenvia pricing/support: `https://www.zenvia.com/en/prices/`
