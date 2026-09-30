import { Response } from 'express';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';

// ── Export CSV ──

export const exportCSV = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT * FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const fields = query('SELECT * FROM registration_fields WHERE registrationId = ? ORDER BY position ASC', [id]);
    const submissions = query('SELECT * FROM registration_submissions WHERE registrationId = ? ORDER BY createdAt ASC', [id]);

    // Build CSV header
    const headers = ['№', 'Фамилия', 'Имя', 'Отчество', 'Email', 'Телефон', 'Статус', 'Дата', ...fields.map((f: any) => f.label)];

    const rows = submissions.map((sub: any, i: number) => {
      const answers = JSON.parse(sub.answers || '{}');
      return [
        i + 1,
        sub.contactLastName || '',
        sub.contactFirstName || '',
        sub.contactPatronymic || '',
        sub.contactEmail,
        sub.contactPhone,
        sub.status,
        sub.createdAt,
        ...fields.map((f: any) => answers[f.id] || ''),
      ];
    });

    // BOM for Excel + CSV
    const bom = '\uFEFF';
    const csv = bom + [headers.join(';'), ...rows.map((r: any[]) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="registration-${id}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('ExportCSV error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Check-in: get participant info by token (public) ──

export const checkinGet = (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const sub = get(`
      SELECT rs.*, r.title as regTitle, r.eventDate, r.eventTime, r.location, r.imageUrl as regImageUrl
      FROM registration_submissions rs
      JOIN registrations r ON rs.registrationId = r.id
      WHERE rs.checkinToken = ?
    `, [token]);
    if (!sub) return res.status(404).json({ success: false, error: 'QR-код не найден' });

    res.json({ success: true, data: sub });
  } catch (error) {
    console.error('CheckinGet error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Check-in: confirm attendance (public) ──

export const checkinPost = (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const sub = get('SELECT * FROM registration_submissions WHERE checkinToken = ?', [token]);
    if (!sub) return res.status(404).json({ success: false, error: 'QR-код не найден' });
    if (sub.status === 'cancelled') return res.status(400).json({ success: false, error: 'Заявка отменена' });
    if (sub.status === 'waitlist') return res.status(400).json({ success: false, error: 'Участник в листе ожидания' });
    if (sub.status === 'confirmed') return res.json({ success: true, data: { status: 'confirmed', alreadyCheckedIn: true } });

    run("UPDATE registration_submissions SET status = 'confirmed', updatedAt = datetime('now') WHERE id = ?", [sub.id]);
    const updated = get('SELECT * FROM registration_submissions WHERE id = ?', [sub.id]);
    res.json({ success: true, data: { ...updated, alreadyCheckedIn: false } });
  } catch (error) {
    console.error('CheckinPost error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Checkin by 4-digit code ──

export const checkinByCode = (req: AuthRequest, res: Response) => {
  try {
    const { registrationId, code } = req.params;
    const sub = get(`
      SELECT rs.*, r.title as regTitle, r.eventDate, r.eventTime, r.location, r.imageUrl as regImageUrl
      FROM registration_submissions rs
      JOIN registrations r ON rs.registrationId = r.id
      WHERE rs.registrationId = ? AND rs.confirmCode = ?
    `, [registrationId, code]);
    if (!sub) return res.status(404).json({ success: false, error: 'Код не найден' });
    res.json({ success: true, data: sub });
  } catch (error) {
    console.error('CheckinByCode error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Participants list (auth) ──

export const getParticipants = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const participants = query(`
      SELECT rs.*, u.fullName as userName
      FROM registration_submissions rs
      LEFT JOIN users u ON rs.userId = u.id
      WHERE rs.registrationId = ?
      ORDER BY rs.createdAt ASC
    `, [id]);
    res.json({ success: true, data: participants });
  } catch (error) {
    console.error('GetParticipants error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Toggle attended manually (auth) ──

export const toggleAttended = (req: AuthRequest, res: Response) => {
  try {
    const { subId } = req.params;
    const sub = get('SELECT * FROM registration_submissions WHERE id = ?', [subId]);
    if (!sub) return res.status(404).json({ success: false, error: 'Заявка не найдена' });

    const newAttended = sub.attended ? 0 : 1;
    const attendedAt = newAttended ? new Date().toISOString() : null;
    run('UPDATE registration_submissions SET attended = ?, attendedAt = ? WHERE id = ?', [newAttended, attendedAt, subId]);

    res.json({ success: true, data: { attended: newAttended, attendedAt } });
  } catch (error) {
    console.error('ToggleAttended error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Public: active registrations for CONTROL page (no auth) ──

export const getPublicRegistrations = (req: AuthRequest, res: Response) => {
  try {
    const regs = query(`
      SELECT r.id, r.title, r.eventDate, r.eventTime, r.location, r.status,
        (SELECT COUNT(*) FROM registration_submissions rs WHERE rs.registrationId = r.id AND rs.status IN ('registered', 'confirmed')) as confirmedCount,
        (SELECT COUNT(*) FROM registration_submissions rs WHERE rs.registrationId = r.id) as totalCount
      FROM registrations r
      WHERE r.status = 'active'
      ORDER BY r.eventDate DESC, r.createdAt DESC
    `);
    res.json({ success: true, data: regs });
  } catch (error) {
    console.error('GetPublicRegistrations error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Registration statistics ──

export const getRegistrationStats = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT * FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    // Daily registration counts
    const daily = query(`
      SELECT DATE(createdAt) as date, COUNT(*) as count, status
      FROM registration_submissions
      WHERE registrationId = ?
      GROUP BY DATE(createdAt), status
      ORDER BY date ASC
    `, [id]);

    // Total counts by status
    const totals = query(`
      SELECT status, COUNT(*) as count
      FROM registration_submissions
      WHERE registrationId = ?
      GROUP BY status
    `, [id]);

    // Total views (viewCount from registration if exists)
    const totalSubmissions = get('SELECT COUNT(*) as cnt FROM registration_submissions WHERE registrationId = ?', [id])?.cnt || 0;
    const confirmedCount = get("SELECT COUNT(*) as cnt FROM registration_submissions WHERE registrationId = ? AND status IN ('registered', 'confirmed')", [id])?.cnt || 0;
    const waitlistCount = get("SELECT COUNT(*) as cnt FROM registration_submissions WHERE registrationId = ? AND status = 'waitlist'", [id])?.cnt || 0;
    const cancelledCount = get("SELECT COUNT(*) as cnt FROM registration_submissions WHERE registrationId = ? AND status = 'cancelled'", [id])?.cnt || 0;

    res.json({
      success: true,
      data: {
        daily,
        totals,
        totalSubmissions,
        confirmedCount,
        waitlistCount,
        cancelledCount,
        maxParticipants: reg.maxParticipants,
      }
    });
  } catch (error) {
    console.error('GetRegistrationStats error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Export PDF (printable HTML) ──

export const exportPDF = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT * FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const fields = query('SELECT * FROM registration_fields WHERE registrationId = ? ORDER BY position ASC', [id]);
    const submissions = query(`
      SELECT * FROM registration_submissions 
      WHERE registrationId = ? AND status != 'cancelled'
      ORDER BY createdAt ASC
    `, [id]);

    // Build HTML
    const escapeHtml = (str: string) => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const statusLabels: Record<string, string> = {
      registered: 'Зарегистрирован',
      confirmed: 'Подтверждён',
      waitlist: 'Лист ожидания',
      cancelled: 'Отменён',
    };

    const tableHeaders = ['№', 'ФИО', 'Email', 'Телефон', 'Статус', 'Дата регистрации', ...fields.map((f: any) => escapeHtml(f.label))];
    
    const tableRows = submissions.map((sub: any, i: number) => {
      const answers = JSON.parse(sub.answers || '{}');
      const fullName = [sub.contactLastName, sub.contactFirstName, sub.contactPatronymic].filter(Boolean).join(' ') || sub.contactName || '—';
      const regDate = sub.createdAt ? new Date(sub.createdAt + 'Z').toLocaleString('ru-RU') : '—';
      return [
        i + 1,
        escapeHtml(fullName),
        escapeHtml(sub.contactEmail || '—'),
        escapeHtml(sub.contactPhone || '—'),
        statusLabels[sub.status] || sub.status,
        regDate,
        ...fields.map((f: any) => escapeHtml(answers[f.id] || '—')),
      ];
    });

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(reg.title)} — Список участников</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #333; font-size: 11px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { font-size: 10px; color: #888; margin-bottom: 6px; }
    .stats { font-size: 10px; color: #555; margin-bottom: 16px; padding: 8px 12px; background: #f8f8f8; border-radius: 6px; display: inline-block; }
    .stats span { margin-right: 16px; }
    .stats b { color: #333; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #f0f0f0; text-align: left; padding: 6px 8px; border-bottom: 2px solid #ddd; font-weight: 600; white-space: nowrap; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; }
    tr:hover td { background: #fafafa; }
    .status { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; }
    .status-registered { background: #dbeafe; color: #1d4ed8; }
    .status-confirmed { background: #dcfce7; color: #166534; }
    .status-waitlist { background: #fef3c7; color: #92400e; }
    @media print {
      body { padding: 0; }
      @page { margin: 12mm; }
      table { font-size: 9px; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(reg.title)}</h1>
  <div class="meta">NEXUS CRM • Список участников • ${new Date().toLocaleString('ru-RU')}</div>
  <div class="stats">
    <span>Всего: <b>${submissions.length}</b></span>
    <span>Подтверждено: <b>${submissions.filter((s: any) => s.status === 'registered' || s.status === 'confirmed').length}</b></span>
    <span>Лист ожидания: <b>${submissions.filter((s: any) => s.status === 'waitlist').length}</b></span>
    ${reg.maxParticipants > 0 ? `<span>Лимит: <b>${reg.maxParticipants}</b></span>` : ''}
  </div>
  <table>
    <thead><tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows.map(row => `<tr>${row.map((cell: any, ci: number) => {
      if (ci === 4) { // Status column
        const cls = cell === 'Подтверждён' ? 'status-confirmed' : cell === 'Лист ожидания' ? 'status-waitlist' : 'status-registered';
        return `<td><span class="status ${cls}">${cell}</span></td>`;
      }
      return `<td>${cell}</td>`;
    }).join('')}</tr>`).join('')}</tbody>
  </table>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('ExportPDF error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Public: submissions for CONTROL page (no auth, limited fields) ──

export const getPublicSubmissions = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const submissions = query(`
      SELECT rs.id, rs.contactName, rs.status, rs.attended, rs.attendedAt, rs.createdAt
      FROM registration_submissions rs
      WHERE rs.registrationId = ?
      ORDER BY rs.createdAt ASC
    `, [id]);
    res.json({ success: true, data: submissions });
  } catch (error) {
    console.error('GetPublicSubmissions error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};