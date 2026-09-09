import { Resend } from 'resend';
import QRCode from 'qrcode';
import { RESEND_API_KEY } from '../config';
import { getDisplayName } from './nameHelper';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const FROM = 'NEXUS CRM <noreply@nexus-liberty.online>';

function isEnabled(): boolean { return !!resend; }

async function generateQRDataURL(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 200, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
}

function buildMapUrl(mapCoords?: string, location?: string): { text: string; url: string } | null {
  if (mapCoords) {
    try {
      const { lat, lng } = JSON.parse(mapCoords);
      if (lat && lng) return { text: location || 'Место проведения', url: `https://www.google.com/maps?q=${lat},${lng}` };
    } catch {}
  }
  if (location) return { text: location, url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` };
  return null;
}

function wrap(title: string, content: string, accent: string = '#00ff88'): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#111120;border:1px solid rgba(0,255,136,0.1);border-radius:16px;overflow:hidden;margin-top:20px;margin-bottom:20px;">
  <div style="background:linear-gradient(135deg,rgba(0,255,136,0.08),rgba(0,212,255,0.05));padding:28px 32px;border-bottom:1px solid rgba(0,255,136,0.1);text-align:center;">
    <div style="font-family:monospace;font-size:10px;color:#4a4a60;letter-spacing:3px;margin-bottom:8px;">NEXUS</div>
    <h1 style="margin:0;font-size:22px;font-weight:700;color:${accent};font-family:monospace;letter-spacing:1px;">${title}</h1>
  </div>
  <div style="padding:28px 32px;color:#c0c0d0;font-size:15px;line-height:1.7;">
    ${content}
  </div>
  <div style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
    <p style="margin:0 0 4px;font-size:16px;color:#e0e0e0;font-weight:600;">Мы всегда с вами!</p>
    <p style="margin:0;font-size:11px;color:#4a4a60;font-family:monospace;">Платформа NEXUS</p>
  </div>
</div>
</body>
</html>`;
}

function eventBlock(title: string, date?: string, time?: string, mapCoords?: string, location?: string): string {
  const map = buildMapUrl(mapCoords, location);
  let html = `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;margin:20px 0;">
    <div style="font-family:monospace;font-size:11px;color:#4a4a60;letter-spacing:2px;margin-bottom:12px;">МЕРОПРИЯТИЕ</div>
    <div style="font-size:18px;font-weight:700;color:#e0e0e0;margin-bottom:16px;">${title}</div>`;

  if (date || time) {
    html += `<div style="display:flex;gap:20px;margin-bottom:12px;">`;
    if (date) html += `<div><span style="font-family:monospace;font-size:10px;color:#4a4a60;">ДАТА</span><div style="color:#e0e0e0;font-weight:600;">${date}</div></div>`;
    if (time) html += `<div><span style="font-family:monospace;font-size:10px;color:#4a4a60;">ВРЕМЯ</span><div style="color:#e0e0e0;font-weight:600;">${time}</div></div>`;
    html += `</div>`;
  }

  if (map) {
    html += `<div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:12px;">
      <span style="font-family:monospace;font-size:10px;color:#4a4a60;">МЕСТО ПРОВЕДЕНИЯ</span>
      <div style="color:#e0e0e0;margin-top:4px;">${map.text}</div>
      <a href="${map.url}" target="_blank" style="display:inline-block;margin-top:8px;padding:8px 16px;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.3);border-radius:8px;color:#00d4ff;font-family:monospace;font-size:12px;text-decoration:none;">Показать на карте</a>
    </div>`;
  }

  html += `</div>`;
  return html;
}

// ── Письмо 1: Зарегистрирован ──

export async function sendRegistrationConfirm(to: string, data: {
  name: string;
  eventTitle: string;
  eventDate?: string;
  eventTime?: string;
  location?: string;
  mapCoords?: string;
  status: 'registered' | 'waitlist';
  position?: number;
  checkinToken?: string;
  confirmCode?: string;
  cancelToken?: string;
  origin: string;
}): Promise<boolean> {
  if (!isEnabled()) return false;
  try {
    const displayName = getDisplayName(data.name);
    const cancelUrl = `${data.origin}/reg/cancel/${data.cancelToken}`;

    if (data.status === 'waitlist') {
      const subject = `${data.eventTitle} — вы в листе ожидания`;
      const content = `
        <p style="margin:0 0 16px;">Здравствуйте, <strong style="color:#e0e0e0;">${displayName}</strong>!</p>
        <p style="margin:0 0 16px;">К сожалению, все места на мероприятие уже заняты.</p>
        <div style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.2);border-radius:10px;padding:16px;margin:20px 0;text-align:center;">
          <div style="font-family:monospace;font-size:11px;color:#eab308;letter-spacing:2px;margin-bottom:6px;">ОЖИДАНИЕ</div>
          <div style="font-size:32px;font-weight:700;color:#eab308;font-family:monospace;">#${data.position}</div>
        </div>
        <p style="margin:0 0 20px;color:#8888a0;">Мы уведомим вас, если место освободится.</p>
        ${eventBlock(data.eventTitle, data.eventDate, data.eventTime, data.mapCoords, data.location)}
        <div style="text-align:center;margin:24px 0 0;">
          <a href="${cancelUrl}" style="display:inline-block;padding:12px 32px;background:rgba(255,59,48,0.1);border:1px solid rgba(255,59,48,0.3);border-radius:10px;color:#ff6b6b;font-family:monospace;font-size:13px;font-weight:600;text-decoration:none;">Отменить регистрацию</a>
        </div>`;
      await resend!.emails.send({ from: FROM, to, subject, html: wrap('ВЫ В ОЧЕРЕДИ', content, '#eab308') });
    } else {
      const subject = `${data.eventTitle} — регистрация подтверждена`;
      const qrUrl = `${data.origin}/reg/checkin/${data.checkinToken}`;
      const qrDataUrl = await generateQRDataURL(qrUrl);
      const content = `
        <p style="margin:0 0 16px;">Здравствуйте, <strong style="color:#e0e0e0;">${displayName}</strong>!</p>
        <p style="margin:0 0 16px;">Платформа NEXUS оповещает вас о том, что ваша регистрация на мероприятие подтверждена.</p>
        <div style="background:rgba(0,255,136,0.06);border:1px solid rgba(0,255,136,0.15);border-radius:10px;padding:16px;margin:20px 0;text-align:center;">
          <div style="font-family:monospace;font-size:11px;color:#00ff88;letter-spacing:2px;margin-bottom:6px;">СТАТУС</div>
          <div style="font-size:18px;font-weight:700;color:#00ff88;font-family:monospace;">ЗАРЕГИСТРИРОВАН ✓</div>
        </div>
        ${eventBlock(data.eventTitle, data.eventDate, data.eventTime, data.mapCoords, data.location)}
        <div style="text-align:center;margin:24px 0;padding:20px;background:rgba(255,255,255,0.03);border-radius:12px;">
          <p style="font-family:monospace;font-size:11px;color:#4a4a60;margin:0 0 12px;">Покажите этот QR-код организатору при входе:</p>
          <img src="${qrDataUrl}" alt="QR Code" width="160" height="160" style="display:block;margin:0 auto;border-radius:8px;" />
        </div>
        ${data.confirmCode ? `<div style="text-align:center;margin:16px 0;padding:16px;background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.15);border-radius:12px;">
          <p style="font-family:monospace;font-size:11px;color:#4a4a60;margin:0 0 8px;">Или назовите этот код организатору:</p>
          <div style="font-size:32px;font-weight:700;color:#00d4ff;font-family:monospace;letter-spacing:0.3em;">${data.confirmCode}</div>
        </div>` : ''}
        <div style="text-align:center;margin:24px 0 0;">
          <a href="${cancelUrl}" style="display:inline-block;padding:12px 32px;background:rgba(255,59,48,0.1);border:1px solid rgba(255,59,48,0.3);border-radius:10px;color:#ff6b6b;font-family:monospace;font-size:13px;font-weight:600;text-decoration:none;">Отменить регистрацию</a>
        </div>`;
      await resend!.emails.send({ from: FROM, to, subject, html: wrap('ВЫ ЗАРЕГИСТРИРОВАНЫ', content) });
    }
    return true;
  } catch (err) {
    console.error('[Email] sendRegistrationConfirm failed:', err);
    return false;
  }
}

// ── Письмо 2: Админу о новой заявке ──

export async function sendAdminNotification(to: string, data: {
  participantName: string;
  eventTitle: string;
  status: 'registered' | 'waitlist';
}): Promise<boolean> {
  if (!isEnabled()) return false;
  try {
    const displayName = getDisplayName(data.participantName);
    const statusText = data.status === 'waitlist' ? 'ОЖИДАНИЕ' : 'ЗАРЕГИСТРИРОВАН';
    const statusColor = data.status === 'waitlist' ? '#eab308' : '#00ff88';
    const content = `
      <p style="margin:0 0 16px;">Новая заявка на регистрацию:</p>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:16px;margin:20px 0;">
        <div style="margin-bottom:12px;"><span style="color:#4a4a60;font-family:monospace;font-size:11px;">УЧАСТНИК</span><div style="color:#e0e0e0;font-size:16px;font-weight:600;margin-top:4px;">${displayName}</div></div>
        <div><span style="color:#4a4a60;font-family:monospace;font-size:11px;">МЕРОПРИЯТИЕ</span><div style="color:#00d4ff;font-size:14px;font-weight:600;margin-top:4px;">${data.eventTitle}</div></div>
      </div>
      <div style="text-align:center;margin:16px 0;">
        <span style="display:inline-block;padding:6px 20px;border-radius:20px;font-family:monospace;font-size:12px;font-weight:700;letter-spacing:1px;background:${statusColor}15;color:${statusColor};border:1px solid ${statusColor}40;">${statusText}</span>
      </div>`;
    await resend!.emails.send({ from: FROM, to, subject: `[NEXUS] ${displayName} → ${data.eventTitle}`, html: wrap('НОВАЯ ЗАЯВКА', content, '#00d4ff') });
    return true;
  } catch (err) {
    console.error('[Email] sendAdminNotification failed:', err);
    return false;
  }
}

// ── Письмо 3: Повышение из waitlist ──

export async function sendWaitlistPromotion(to: string, data: {
  name: string;
  eventTitle: string;
  eventDate?: string;
  eventTime?: string;
  location?: string;
  mapCoords?: string;
  checkinToken: string;
  confirmCode?: string;
  cancelToken: string;
  origin: string;
}): Promise<boolean> {
  if (!isEnabled()) return false;
  try {
    const displayName = getDisplayName(data.name);
    const cancelUrl = `${data.origin}/reg/cancel/${data.cancelToken}`;
    const qrUrl = `${data.origin}/reg/checkin/${data.checkinToken}`;
    const qrDataUrl = await generateQRDataURL(qrUrl);

    const content = `
      <p style="margin:0 0 16px;">Здравствуйте, <strong style="color:#e0e0e0;">${displayName}</strong>!</p>
      <p style="margin:0 0 16px;">Платформа NEXUS оповещает вас о том, что место освободилось и вы переведены из листа ожидания в статус участника мероприятия.</p>
      <div style="background:rgba(0,255,136,0.06);border:1px solid rgba(0,255,136,0.15);border-radius:10px;padding:20px;margin:20px 0;text-align:center;">
        <div style="font-family:monospace;font-size:11px;color:#00ff88;letter-spacing:2px;margin-bottom:8px;">СТАТУС ОБНОВЛЁН</div>
        <div style="font-size:18px;font-weight:700;color:#00ff88;font-family:monospace;">ВЫ ЗАРЕГИСТРИРОВАНЫ ✓</div>
      </div>
      ${eventBlock(data.eventTitle, data.eventDate, data.eventTime, data.mapCoords, data.location)}
      <div style="text-align:center;margin:24px 0;padding:20px;background:rgba(255,255,255,0.03);border-radius:12px;">
        <p style="font-family:monospace;font-size:11px;color:#4a4a60;margin:0 0 12px;">Покажите этот QR-код организатору при входе:</p>
        <img src="${qrDataUrl}" alt="QR Code" width="160" height="160" style="display:block;margin:0 auto;border-radius:8px;" />
      </div>
      ${data.confirmCode ? `<div style="text-align:center;margin:16px 0;padding:16px;background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.15);border-radius:12px;">
        <p style="font-family:monospace;font-size:11px;color:#4a4a60;margin:0 0 8px;">Или назовите этот код организатору:</p>
        <div style="font-size:32px;font-weight:700;color:#00d4ff;font-family:monospace;letter-spacing:0.3em;">${data.confirmCode}</div>
      </div>` : ''}
      <div style="text-align:center;margin:24px 0 0;">
        <a href="${cancelUrl}" style="display:inline-block;padding:12px 32px;background:rgba(255,59,48,0.1);border:1px solid rgba(255,59,48,0.3);border-radius:10px;color:#ff6b6b;font-family:monospace;font-size:13px;font-weight:600;text-decoration:none;">Отменить регистрацию</a>
      </div>`;

    await resend!.emails.send({ from: FROM, to, subject: `Место освободилось! ${data.eventTitle}`, html: wrap('ВЫ ЗАРЕГИСТРИРОВАНЫ!', content) });
    return true;
  } catch (err) {
    console.error('[Email] sendWaitlistPromotion failed:', err);
    return false;
  }
}
