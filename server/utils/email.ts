import { Resend } from 'resend';
import { RESEND_API_KEY } from '../config';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const FROM = 'NEXUS CRM <onboarding@resend.dev>';

function isEnabled(): boolean {
  return !!resend;
}

// ── Email подтверждения регистрации ──

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

    const body = data.status === 'waitlist'
      ? `<p>Здравствуйте, ${data.name}!</p>
         <p>Вы зарегистрировались на <strong>${data.eventTitle}</strong>${data.eventDate ? ` (${data.eventDate})` : ''}.</p>
         <p>В данный момент все места заняты. Вы в листе ожидания <strong>под номером ${data.position}</strong>.</p>
         <p>Мы уведомим вас, если место освободится.</p>`
      : `<p>Здравствуйте, ${data.name}!</p>
         <p>Ваша регистрация на <strong>${data.eventTitle}</strong>${data.eventDate ? ` (${data.eventDate})` : ''} подтверждена.</p>
         <p>Ждём вас!</p>`;

    await resend!.emails.send({
      from: FROM,
      to,
      subject,
      html: `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">${body}<hr style="border:none;border-top:1px solid #eee;margin:20px 0"><p style="font-size:12px;color:#999">NEXUS CRM — ${data.eventTitle}</p></body></html>`,
    });
    return true;
  } catch (err) {
    console.error('[Email] sendRegistrationConfirm failed:', err);
    return false;
  }
}

// ── Email админу о новой заявке ──

export async function sendAdminNotification(to: string, data: {
  participantName: string;
  eventTitle: string;
  status: 'confirmed' | 'waitlist';
}): Promise<boolean> {
  if (!isEnabled()) return false;
  try {
    const statusText = data.status === 'waitlist' ? 'лист ожидания' : 'подтверждена';
    await resend!.emails.send({
      from: FROM,
      to,
      subject: `Новая регистрация: ${data.participantName} — ${data.eventTitle}`,
      html: `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#00ff88">Новая регистрация</h2>
        <p><strong>${data.participantName}</strong> зарегистрировался на <strong>${data.eventTitle}</strong></p>
        <p>Статус: <strong>${statusText}</strong></p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="font-size:12px;color:#999">NEXUS CRM</p>
      </body></html>`,
    });
    return true;
  } catch (err) {
    console.error('[Email] sendAdminNotification failed:', err);
    return false;
  }
}

// ── Email при повышении из waitlist ──

export async function sendWaitlistPromotion(to: string, data: {
  name: string;
  eventTitle: string;
  eventDate?: string;
}): Promise<boolean> {
  if (!isEnabled()) return false;
  try {
    await resend!.emails.send({
      from: FROM,
      to,
      subject: `Место освободилось! ${data.eventTitle}`,
      html: `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#00ff88">Вы в активном списке!</h2>
        <p>Здравствуйте, ${data.name}!</p>
        <p>Место на <strong>${data.eventTitle}</strong>${data.eventDate ? ` (${data.eventDate})` : ''} освободилось.</p>
        <p>Вы переведены из листа ожидания в активный список участников.</p>
        <p>Ждём вас!</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="font-size:12px;color:#999">NEXUS CRM</p>
      </body></html>`,
    });
    return true;
  } catch (err) {
    console.error('[Email] sendWaitlistPromotion failed:', err);
    return false;
  }
}
