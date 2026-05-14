// =============================================================================
// MotoGuard IoT — Serviço: Email (Emergência via Resend)
// =============================================================================
// Envia email ao contacto de emergência quando CRASH_DETECTED é confirmado.
// Usa a API key Resend do próprio utilizador (guardada encriptada na BD).
// Se não estiver configurada, regista no log (modo dev).
// =============================================================================

import { Resend } from "resend";
import { env } from "../config/env";

interface CrashEmailPayload {
  toEmail: string;
  riderName: string;
  timestamp: string;
  latitude?: number | null;
  longitude?: number | null;
  tripId?: string | null;
  deviceId: string;
  /** API key Resend já desencriptada do utilizador */
  resendApiKey?: string | null;
}

function buildHtml(payload: CrashEmailPayload): string {
  const { riderName, timestamp, latitude, longitude, tripId, deviceId } = payload;

  const dateStr = new Date(timestamp).toLocaleString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const mapsLink =
    latitude != null && longitude != null
      ? `https://maps.google.com/?q=${latitude},${longitude}`
      : null;

  const tripLink = tripId ? `${env.APP_URL}/trips/${tripId}` : null;

  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:2px solid #ef4444;border-radius:12px">
      <h2 style="color:#ef4444;margin:0 0 16px">🚨 Alerta de Emergência — MotoGuard</h2>
      <p style="margin:0 0 12px;font-size:15px">
        O motociclista <strong>${riderName}</strong> pode ter sofrido uma queda.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#666">Data/Hora</td><td style="padding:6px 0"><strong>${dateStr}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666">Dispositivo</td><td style="padding:6px 0"><code>${deviceId}</code></td></tr>
        ${latitude != null ? `<tr><td style="padding:6px 0;color:#666">Coordenadas</td><td style="padding:6px 0">${latitude.toFixed(6)}, ${longitude?.toFixed(6)}</td></tr>` : ""}
      </table>
      ${mapsLink ? `<p style="margin:16px 0 8px"><a href="${mapsLink}" style="background:#ef4444;color:white;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">📍 Ver no Google Maps</a></p>` : ""}
      ${tripLink ? `<p style="margin:8px 0"><a href="${tripLink}" style="background:#3b82f6;color:white;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">🏍️ Ver viagem</a></p>` : ""}
      <p style="margin:20px 0 0;font-size:12px;color:#999">Este email foi enviado automaticamente pelo sistema MotoGuard IoT.</p>
    </div>
  `;
}

export async function sendCrashAlert(payload: CrashEmailPayload): Promise<void> {
  // Validação redundante do email (defense in depth)
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(payload.toEmail)) {
    console.warn(`[email.service] Email de emergência inválido: "${payload.toEmail}". Email NÃO enviado.`);
    return;
  }

  // Prioridade: key do utilizador → fallback para variável de ambiente
  const apiKey = payload.resendApiKey || env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn(`[email.service] Resend API key não configurada. Email NÃO enviado para ${payload.toEmail}.`);
    console.warn(`[email.service] Payload: ${JSON.stringify({ toEmail: payload.toEmail, riderName: payload.riderName, timestamp: payload.timestamp })}`);
    return;
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from: env.RESEND_FROM,
    to: payload.toEmail,
    subject: `🚨 Alerta de Emergência — ${payload.riderName} pode ter sofrido uma queda`,
    html: buildHtml(payload),
  });

  console.log(`[email.service] Email de emergência enviado para ${payload.toEmail} (rider: ${payload.riderName})`);
}
