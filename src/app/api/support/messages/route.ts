import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SUPPORT_TO_EMAIL = "autosimza@gmail.com";
const reasons = new Set([
  "Problema con mi cuenta",
  "Problema con contrasena",
  "Problema con alertas",
  "Problema con pago",
  "Otro"
]);

type SupportBody = {
  name?: unknown;
  email?: unknown;
  reason?: unknown;
  message?: unknown;
};

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://dolarmza.com.ar").replace(/\/$/, "");
}

function getFromEmail() {
  const configuredFrom = process.env.ALERT_FROM_EMAIL?.trim();
  const fallbackFrom = "Dolar MZA <alertas@dolarmza.com.ar>";

  if (!configuredFrom) return fallbackFrom;

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredFrom)) {
    return `Dolar MZA <${configuredFrom}>`;
  }

  return configuredFrom;
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanMessage(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, 2000);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendSupportEmail(input: { name: string; email: string; reason: string; message: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: "Falta RESEND_API_KEY." };
  }

  const htmlMessage = escapeHtml(input.message).replace(/\n/g, "<br />");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: getFromEmail(),
      to: SUPPORT_TO_EMAIL,
      reply_to: input.email,
      subject: `Soporte Dolar MZA: ${input.reason}`,
      html: `
        <div style="font-family: Arial, sans-serif; background:#050505; color:#ffffff; padding:24px;">
          <div style="max-width:560px; margin:0 auto; background:#0F1110; border:1px solid #262626; border-radius:8px; overflow:hidden;">
            <div style="padding:22px; border-bottom:1px solid #262626;">
              <p style="color:#00C853; font-size:13px; font-weight:800; margin:0 0 8px;">Dolar MZA</p>
              <h1 style="font-size:22px; line-height:1.2; margin:0; color:#FFFFFF;">Nuevo mensaje de soporte</h1>
            </div>
            <div style="padding:20px 22px;">
              <p style="color:#A3A3A3; font-size:12px; font-weight:800; margin:0 0 4px;">Nombre</p>
              <p style="color:#F4F4F4; font-size:16px; margin:0 0 14px;">${escapeHtml(input.name)}</p>
              <p style="color:#A3A3A3; font-size:12px; font-weight:800; margin:0 0 4px;">Email</p>
              <p style="color:#F4F4F4; font-size:16px; margin:0 0 14px;">${escapeHtml(input.email)}</p>
              <p style="color:#A3A3A3; font-size:12px; font-weight:800; margin:0 0 4px;">Motivo</p>
              <p style="color:#F4F4F4; font-size:16px; margin:0 0 14px;">${escapeHtml(input.reason)}</p>
              <p style="color:#A3A3A3; font-size:12px; font-weight:800; margin:0 0 4px;">Mensaje</p>
              <p style="color:#F4F4F4; font-size:16px; line-height:1.45; margin:0;">${htmlMessage}</p>
            </div>
            <div style="border-top:1px solid #262626; padding:14px 22px 18px;">
              <a href="${appUrl()}/admin" style="color:#00C853; font-size:14px; font-weight:800;">Abrir panel admin</a>
            </div>
          </div>
        </div>
      `,
      text: `Nuevo mensaje de soporte Dolar MZA\n\nNombre: ${input.name}\nEmail: ${input.email}\nMotivo: ${input.reason}\n\n${input.message}\n\nAdmin: ${appUrl()}/admin`
    })
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };

  if (!response.ok) {
    return { skipped: false, error: payload.message || payload.name || "No se pudo enviar el email." };
  }

  return { skipped: false, id: payload.id };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as SupportBody;
  const name = cleanText(body.name, 90);
  const email = cleanText(body.email, 120).toLowerCase();
  const reason = cleanText(body.reason, 80);
  const message = cleanMessage(body.message);

  if (!name) return NextResponse.json({ error: "Ingresa tu nombre." }, { status: 400 });
  if (!isEmail(email)) return NextResponse.json({ error: "Ingresa un email valido." }, { status: 400 });
  if (!reasons.has(reason)) return NextResponse.json({ error: "Elegi un motivo." }, { status: 400 });
  if (message.length < 8) return NextResponse.json({ error: "Contanos un poco mas para poder ayudarte." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const supabaseAdmin = createSupabaseAdminClient();
  const {
    data: { user }
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  let stored = false;
  let storageError: string | null = null;

  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.from("support_messages").insert({
      user_id: user?.id ?? null,
      name,
      email,
      reason,
      message,
      status: "new"
    });

    if (error) {
      storageError = error.message;
    } else {
      stored = true;
    }
  } else {
    storageError = "Falta SUPABASE_SERVICE_ROLE_KEY.";
  }

  const emailResult = await sendSupportEmail({ name, email, reason, message });
  const emailError = "error" in emailResult ? emailResult.error : null;
  const emailed = !emailResult.skipped && !emailError;

  if (!stored && !emailed) {
    return NextResponse.json(
      {
        error: "No se pudo enviar el mensaje. Proba nuevamente en unos minutos.",
        detail: emailError ?? emailResult.reason ?? "No se pudo guardar ni enviar el mensaje.",
        storageError
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    stored,
    emailed,
    storageError
  });
}
