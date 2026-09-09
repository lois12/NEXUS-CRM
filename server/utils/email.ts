import { Resend } from 'resend';
import { RESEND_API_KEY } from '../config';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const FROM = 'NEXUS CRM <noreply@nexus-liberty.online>';
// When domain verified: const FROM = 'NEXUS CRM <noreply@nexus-liberty.online>';

function isEnabled(): boolean {
  return !!resend;
}

// ── Common template wrapper ──

function wrap(title: string, content: string, accent: string = '#00ff88'): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#111120;border:1px solid rgba(0,255,136,0.1);border-radius:16px;overflow:hidden;margin-top:20px;margin-bottom:20px;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,rgba(0,255,136,0.08),rgba(0,212,255,0.05));padding:28px 32px;border-bottom:1px solid rgba(0,255,136,0.1);text-align:center;">
    <div style="font-family:monospace;font-size:10px;color:#4a4a60;letter-spacing:3px;margin-bottom:8px;">NEXUS CRM</div>
    <h1 style="margin:0;font-size:22px;font-weight:700;color:${accent};font-family:monospace;letter-spacing:1px;">${title}</h1>
  </div>

  <!-- Body -->
  <div style="padding:28px 32px;color:#c0c0d0;font-size:15px;line-height:1.7;">
    ${content}
  </div>

  <!-- Footer -->
  <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
    <p style="margin:0;font-size:11px;color:#4a4a60;font-family:monospace;">NEXUS CRM // Автоматическое уведомление</p>
    <p style="margin:4px 0 0;font-size:11px;color:#3a3a50;">Если вы не ожидайте данного письма — просто игнорируйте его.</p>
  </div>

</div>
</body>
</html>`;
}

// ── 1. Подтверждение регистрации ──

export async function sendRegistrationConfirm(to: string, data: {
  name: string;
  eventTitle: string;
  eventDate?: string;
  status: 'confirmed' | 'waitlist';
  position?: number;
}): Promise<boolean> {
  if (!isEnabled()) return false;
  try {
    const subject = data.status === 'waitlist'
      ? `${data.eventTitle} — вы в листе ожидания`
      : `${data.eventTitle} — регистрация подтверждена`;

    const dateBlock = data.eventDate
      ? `<div style="background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.1);border-radius:10px;padding:12px 16px;margin:16px 0;">
           <span style="color:#4a4a60;font-family:monospace;font-size:11px;">ДАТА</span>
           <div style="color:#e0e0e0;font-size:16px;font-weight:600;margin-top:4px;">${data.eventDate}</div>
         </div>`
      : '';

    const content = data.status === 'waitlist'
      ? `<p style="margin:0 0 16px;">Здравствуйте, <strong style="color:#e0e0e0;">${data.name}</strong>!</p>
         <p style="margin:0 0 16px;">Вы зарегистрировались на <strong style="color:#e0e0e0;">${data.eventTitle}</strong>, но, к сожалению, все места уже заняты.</p>
         <div style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.2);border-radius:10px;padding:16px;margin:20px 0;text-align:center;">
           <div style="font-family:monospace;font-size:11px;color:#eab308;letter-spacing:2px;margin-bottom:6px;">ЛИСТ ОЖИДАНИЯ</div>
           <div style="font-size:32px;font-weight:700;color:#eab308;font-family:monospace;">#${data.position}</div>
         </div>
         ${dateBlock}
         <p style="margin:16px 0 0;color:#8888a0;">Мы автоматически уведомим вас, если место освободится.</p>`
      : `<p style="margin:0 0 16px;">Здравствуйте, <strong style="color:#e0e0e0;">${data.name}</strong>!</p>
         <p style="margin:0 0 16px;">Ваша регистрация на <strong style="color:#e0e0e0;">${data.eventTitle}</strong> успешно подтверждена.</p>
         <div style="background:rgba(0,255,136,0.06);border:1px solid rgba(0,255,136,0.15);border-radius:10px;padding:16px;margin:20px 0;text-align:center;">
           <div style="font-family:monospace;font-size:11px;color:#00ff88;letter-spacing:2px;margin-bottom:6px;">СТАТУС</div>
           <div style="font-size:18px;font-weight:700;color:#00ff88;font-family:monospace;">ПОДТВЕРЖДЕНО ✓</div>
         </div>
         ${dateBlock}
         <p style="margin:16px 0 0;color:#8888a0;">Ждём вас на мероприятии!</p>`;

    await resend!.emails.send({ from: FROM, to, subject, html: wrap(subject, content) });
    return true;
  } catch (err) {
    console.error('[Email] sendRegistrationConfirm failed:', err);
    return false;
  }
}

// ── 2. Email админу о новой заявке ──

export async function sendAdminNotification(to: string, data: {
  participantName: string;
  eventTitle: string;
  status: 'confirmed' | 'waitlist';
}): Promise<boolean> {
  if (!isEnabled()) return false;
  try {
    const statusText = data.status === 'waitlist' ? 'ЛИСТ ОЖИДАНИЯ' : 'ПОДТВЕРЖДЕНО';
    const statusColor = data.status === 'waitlist' ? '#eab308' : '#00ff88';
    const content = `
      <p style="margin:0 0 16px;">Новая заявка на регистрацию:</p>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:16px;margin:20px 0;">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="color:#4a4a60;font-family:monospace;font-size:11px;">УЧАСТНИК</span>
          <span style="color:#4a4a60;font-family:monospace;font-size:11px;">МЕРОПРИЯТИЕ</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#e0e0e0;font-size:16px;font-weight:600;">${data.participantName}</span>
          <span style="color:#00d4ff;font-size:14px;font-weight:600;">${data.eventTitle}</span>
        </div>
      </div>
      <div style="text-align:center;margin:16px 0;">
        <span style="display:inline-block;padding:6px 20px;border-radius:20px;font-family:monospace;font-size:12px;font-weight:700;letter-spacing:1px;background:${statusColor}15;color:${statusColor};border:1px solid ${statusColor}40;">${statusText}</span>
      </div>`;

    await resend!.emails.send({
      from: FROM, to,
      subject: `[NEXUS] ${data.participantName} → ${data.eventTitle}`,
      html: wrap('НОВАЯ ЗАЯВКА', content, '#00d4ff'),
    });
    return true;
  } catch (err) {
    console.error('[Email] sendAdminNotification failed:', err);
    return false;
  }
}

// ── 3. Email при повышении из waitlist ──

export async function sendWaitlistPromotion(to: string, data: {
  name: string;
  eventTitle: string;
  eventDate?: string;
}): Promise<boolean> {
  if (!isEnabled()) return false;
  try {
    const dateBlock = data.eventDate
      ? `<div style="background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.1);border-radius:10px;padding:12px 16px;margin:16px 0;">
           <span style="color:#4a4a60;font-family:monospace;font-size:11px;">ДАТА</span>
           <div style="color:#e0e0e0;font-size:16px;font-weight:600;margin-top:4px;">${data.eventDate}</div>
         </div>`
      : '';

    const content = `
      <p style="margin:0 0 16px;">Здравствуйте, <strong style="color:#e0e0e0;">${data.name}</strong>!</p>
      <p style="margin:0 0 16px;">Отличные новости! Место на <strong style="color:#e0e0e0;">${data.eventTitle}</strong> освободилось.</p>
      <div style="background:rgba(0,255,136,0.06);border:1px solid rgba(0,255,136,0.15);border-radius:10px;padding:20px;margin:20px 0;text-align:center;">
        <div style="font-family:monospace;font-size:11px;color:#00ff88;letter-spacing:2px;margin-bottom:8px;">ПЕРЕВЕДЕНЫ В АКТИВНЫЙ СПИСОК</div>
        <div style="font-size:28px;margin-bottom:4px;">🎉</div>
        <div style="font-size:16px;font-weight:700;color:#00ff88;font-family:monospace;">ВЫ В СПИСКЕ УЧАСТНИКОВ</div>
      </div>
      ${dateBlock}
      <p style="margin:16px 0 0;color:#8888a0;">Ждём вас на мероприятии!</p>`;

    await resend!.emails.send({
      from: FROM, to,
      subject: `🎉 Место освободилось! ${data.eventTitle}`,
      html: wrap('ВЫ В АКТИВНОМ СПИСКЕ!', content),
    });
    return true;
  } catch (err) {
    console.error('[Email] sendWaitlistPromotion failed:', err);
    return false;
  }
}
