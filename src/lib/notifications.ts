type AlertEmailInput = {
  to: string;
  message: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://dolarmza.com.ar").replace(/\/$/, "");
}

function getAlertFromEmail() {
  const configuredFrom = process.env.ALERT_FROM_EMAIL?.trim();
  const fallbackFrom = "Dolar MZA <alertas@dolarmza.com.ar>";

  if (!configuredFrom) return fallbackFrom;

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredFrom)) {
    return `Dolar MZA <${configuredFrom}>`;
  }

  return configuredFrom
    .replace(/^DÃ³lar_MZA_</, "Dolar MZA <")
    .replace(/^DÃ³lar MZA </, "Dolar MZA <")
    .replace(/^DÃƒÂ³lar_MZA_</, "Dolar MZA <")
    .replace(/^DÃƒÂ³lar MZA </, "Dolar MZA <");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emailSubject(message: string) {
  const title = message
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!title) return "Alerta de Dolar MZA";
  return title.length > 78 ? `${title.slice(0, 75)}...` : title;
}

function messageHtml(message: string) {
  const lines = message.split("\n");

  return lines
    .map((line) => {
      const cleanLine = line.trim();
      if (!cleanLine) return `<div style="height:8px"></div>`;

      const isLabel = cleanLine.endsWith(":");
      return `<p style="margin:${isLabel ? "14px 0 3px" : "0 0 6px"}; color:${
        isLabel ? "#A3A3A3" : "#F4F4F4"
      }; font-size:${isLabel ? "12px" : "16px"}; line-height:1.45; font-weight:${isLabel ? "800" : "500"};">${escapeHtml(
        cleanLine
      )}</p>`;
    })
    .join("");
}

export async function sendAlertEmail({ to, message }: AlertEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getAlertFromEmail();
  const baseUrl = appUrl();
  const subject = emailSubject(message);

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
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; background:#050505; color:#ffffff; padding:24px;">
          <div style="max-width:560px; margin:0 auto; background:#0F1110; border:1px solid #262626; border-radius:8px; overflow:hidden;">
            <div style="padding:22px 22px 12px; border-bottom:1px solid #262626;">
              <p style="color:#00C853; font-size:13px; font-weight:800; margin:0 0 8px;">Dolar MZA</p>
              <h1 style="font-size:24px; line-height:1.15; margin:0; color:#FFFFFF;">${escapeHtml(subject)}</h1>
            </div>
            <div style="padding:20px 22px 8px;">
              ${messageHtml(message)}
            </div>
            <div style="display:grid; gap:10px; padding:12px 22px 22px;">
              <a href="${baseUrl}" style="background:#00C853; border-radius:8px; color:#031209; display:block; font-size:15px; font-weight:900; padding:14px 16px; text-align:center; text-decoration:none;">Ver todas las cotizaciones</a>
              <a href="${baseUrl}/alerts" style="border:1px solid #262626; border-radius:8px; color:#F4F4F4; display:block; font-size:14px; font-weight:800; padding:12px 16px; text-align:center; text-decoration:none;">Gestionar mis alertas</a>
            </div>
            <div style="border-top:1px solid #262626; padding:14px 22px 18px;">
              <p style="color:#A3A3A3; font-size:12px; line-height:1.45; margin:0;">Dolar MZA te avisa cuando pasa algo importante. Revisa siempre las cotizaciones antes de decidir.</p>
            </div>
          </div>
        </div>
      `,
      text: `Dolar MZA\n\n${message}\n\nVer todas las cotizaciones: ${baseUrl}\nGestionar mis alertas: ${baseUrl}/alerts`
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
