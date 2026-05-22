# Templates de email para Supabase

Estos HTML se pegan en Supabase Dashboard, en `Authentication > Emails > Templates`.

## Confirm signup

Subject:

```text
Confirmá tu cuenta en Dólar MZA
```

HTML:

```text
supabase/email-templates/confirm-account.html
```

## Reset password

Subject:

```text
Restablecé tu contraseña en Dólar MZA
```

HTML:

```text
supabase/email-templates/reset-password.html
```

Los botones usan `{{ .ConfirmationURL }}`, que es la variable oficial de Supabase para el enlace de confirmación o recuperación.
