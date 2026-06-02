type AlertEmailInput = {
  to: string;
  message: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

function getAlertFromEmail() {
  const configuredFrom = process.env.ALERT_FROM_EMAIL?.trim();
  const fallbackFrom = "Dolar MZA <alertas@dolarmza.com.ar>";

  if (!configuredFrom) return fallbackFrom;

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredFrom)) {
    return `Dolar MZA <${configuredFrom}>`;
  }

  return configuredFrom
    .replace(/^Dólar_MZA_</, "Dolar MZA <")
    .replace(/^Dólar MZA </, "Dolar MZA <")
    .replace(/^DÃ³lar_MZA_</, "Dolar MZA <")
    .replace(/^DÃ³lar MZA </, "Dolar MZA <");
}

export async function sendAlertEmail({ to, message }: AlertEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getAlertFromEmail();

  if (!apiKey) {
    return {
      skipped: true,
      reason: "Falta RESEND_API_KEY."
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Alerta de Dolar MZA",
      html: `
        <div style="font-family: Arial, sans-serif; background:#050505; color:#ffffff; padding:24px;">
          <div style="max-width:520px; margin:0 auto; background:#0F1110; border:1px solid #262626; border-radius:8px; padding:22px;">
            <p style="color:#00C853; font-size:13px; font-weight:700; margin:0 0 10px;">Dolar MZA</p>
            <h1 style="font-size:24px; line-height:1.15; margin:0 0 14px;">Hoy hay movimiento importante.</h1>
            <p style="font-size:17px; line-height:1.45; color:#F4F4F4; margin:0 0 18px;">${message}</p>
            <p style="font-size:14px; line-height:1.45; color:#A3A3A3; margin:0;">Entra a tu cuenta para revisar tus alertas y cotizaciones.</p>
          </div>
        </div>
      `,
      text: `Dolar MZA\n\n${message}\n\nEntra a tu cuenta para revisar tus alertas y cotizaciones.`
    })
  });

  const payload = (await response.json().catch(() => ({}))) as ResendResponse;

  if (!response.ok) {
    throw new Error(payload.message || payload.name || "No se pudo enviar el email de alerta.");
  }

  return {
    skipped: false,
    id: payload.id
  };
}
