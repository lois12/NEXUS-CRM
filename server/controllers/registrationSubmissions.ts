import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { sendRegistrationConfirm, sendWaitlistPromotion } from '../utils/email';
import { createNotification } from './notificationController';

// ── Public: get registration by slug ──

export const getBySlug = (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const reg = get(`
      SELECT r.*,
        (SELECT COUNT(*) FROM registration_submissions rs WHERE rs.registrationId = r.id AND rs.status IN ('registered', 'confirmed')) as confirmedCount,
        (SELECT COUNT(*) FROM registration_submissions rs WHERE rs.registrationId = r.id AND rs.status = 'waitlist') as waitlistCount
      FROM registrations r WHERE r.publicSlug = ?
    `, [slug]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const fields = query('SELECT * FROM registration_fields WHERE registrationId = ? ORDER BY position ASC', [reg.id]);
    const media = query('SELECT * FROM registration_media WHERE registrationId = ? ORDER BY position ASC', [reg.id]);

    if (reg.status === 'draft') return res.status(200).json({ success: true, data: { ...reg, fields, media }, draft: true });

    res.json({ success: true, data: { ...reg, fields, media } });
  } catch (error) {
    console.error('GetBySlug error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Public: submit registration ──

export const submitRegistration = (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const reg = get('SELECT * FROM registrations WHERE publicSlug = ?', [slug]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });
    if (reg.status !== 'active') return res.status(400).json({ success: false, error: 'Регистрация не активна' });

    // Time window checks disabled — admin controls via status field
    // (datetime-local has no timezone, comparing across machines is unreliable)

    const { answers, contactName, contactLastName, contactFirstName, contactPatronymic, contactEmail, contactPhone } = req.body;

    // ФИО: require lastName + firstName, patronymic optional
    const lastName = (contactLastName || '').trim();
    const firstName = (contactFirstName || '').trim();
    const patronymic = (contactPatronymic || '').trim();
    // Backward compat: if old contactName sent, use as firstName
    const effectiveFirstName = firstName || (contactName || '').trim();
    const effectiveLastName = lastName;
    if (!effectiveLastName) return res.status(400).json({ success: false, error: 'Фамилия обязательна' });
    if (!effectiveFirstName) return res.status(400).json({ success: false, error: 'Имя обязательно' });
    const fullName = [effectiveLastName, effectiveFirstName, patronymic].filter(Boolean).join(' ');

    // Check required fields
    const fields = query('SELECT * FROM registration_fields WHERE registrationId = ? AND required = 1', [reg.id]);
    for (const field of fields) {
      const val = answers?.[field.id];
      if (!val || (typeof val === 'string' && !val.trim())) {
        return res.status(400).json({ success: false, error: `Поле "${field.label}" обязательно` });
      }
    }

    // Check for duplicate registration (same email + same event)
    if (contactEmail) {
      const existing = get("SELECT id, status FROM registration_submissions WHERE registrationId = ? AND contactEmail = ? AND status != 'cancelled'", [reg.id, contactEmail]);
      if (existing) {
        return res.status(400).json({ success: false, error: 'Этот email уже зарегистрирован на мероприятие' });
      }
    }

    // Determine status based on limit
    const registeredCount = get('SELECT COUNT(*) as cnt FROM registration_submissions WHERE registrationId = ? AND status IN (?, ?)', [reg.id, 'registered', 'confirmed'])?.cnt || 0;
    let status = 'registered';
    let position = 0;

    if (reg.maxParticipants > 0 && registeredCount >= reg.maxParticipants) {
      // All spots taken
      if (!reg.waitlistEnabled) {
        // No waitlist — registration is closed
        return res.status(400).json({ success: false, error: 'Все места заняты. Регистрация закрыта.' });
      }

      // Waitlist enabled — check waitlist limit
      const waitlistCount = get('SELECT COUNT(*) as cnt FROM registration_submissions WHERE registrationId = ? AND status = ?', [reg.id, 'waitlist'])?.cnt || 0;

      if (reg.maxWaitlist > 0 && waitlistCount >= reg.maxWaitlist) {
        // Waitlist is also full
        return res.status(400).json({ success: false, error: 'Все места и лист ожидания заполнены. Регистрация закрыта.' });
      }

      status = 'waitlist';
      position = waitlistCount + 1;
    }

    const id = uuidv4();
    const cancelToken = uuidv4();
    const checkinToken = uuidv4();
    const confirmCode = String(Math.floor(1000 + Math.random() * 9000));

    run(`INSERT INTO registration_submissions (id, registrationId, userId, answers, contactName, contactLastName, contactFirstName, contactPatronymic, contactEmail, contactPhone, status, cancelToken, checkinToken, confirmCode, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, reg.id, req.user?.id || null, JSON.stringify(answers || {}), fullName, effectiveLastName, effectiveFirstName, patronymic, contactEmail || '', contactPhone || '', status, cancelToken, checkinToken, confirmCode, position]);

    const submission = get('SELECT * FROM registration_submissions WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: { ...submission, cancelToken, checkinToken, confirmCode } });

    // ── Notifications (fire-and-forget, don't block response) ──
    (async () => {
      try {
        const origin = `${req.protocol}://${req.get('host')}`;

        // 1. Email пользователю
        if (contactEmail) {
          await sendRegistrationConfirm(contactEmail, {
            name: fullName || 'Участник',
            eventTitle: reg.title,
            eventDate: reg.eventDate,
            eventTime: reg.eventTime,
            location: reg.location,
            mapCoords: reg.mapCoords,
            organizer: reg.organizer,
            description: reg.description,
            status: status as 'registered' | 'waitlist',
            position: status === 'waitlist' ? position : undefined,
            checkinToken: status === 'registered' ? checkinToken : undefined,
            confirmCode: status === 'registered' ? confirmCode : undefined,
            cancelToken,
            origin,
          });
        }

        // 2. Уведомить админов (in-app + email)
        const admins = query("SELECT id, username FROM users WHERE role IN ('администратор', 'admin') OR roles LIKE '%admin%'");
        for (const admin of admins) {
          const statusText = status === 'waitlist' ? 'лист ожидания' : 'зарегистрирован';
          createNotification({
            userId: admin.id,
            type: 'registration',
            title: 'Новая регистрация',
            body: `${fullName || 'Участник'} → "${reg.title}" (${statusText})`,
            link: '/registrations',
          });
        }
      } catch (notifErr) {
        console.error('[Registration] notification error:', notifErr);
      }
    })();
  } catch (error) {
    console.error('SubmitRegistration error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Admin: manually create submission (works in any status) ──

export const createAdminSubmission = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT * FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const { contactName, contactLastName, contactFirstName, contactPatronymic, contactEmail, contactPhone, answers, sendEmail } = req.body;

    // ФИО: require lastName + firstName
    const lastName = (contactLastName || '').trim();
    const firstName = (contactFirstName || '').trim();
    const patronymic = (contactPatronymic || '').trim();
    const effectiveFirstName = firstName || (contactName || '').trim();
    const effectiveLastName = lastName;
    if (!effectiveLastName) return res.status(400).json({ success: false, error: 'Фамилия обязательна' });
    if (!effectiveFirstName) return res.status(400).json({ success: false, error: 'Имя обязательно' });
    const fullName = [effectiveLastName, effectiveFirstName, patronymic].filter(Boolean).join(' ');

    // Skip duplicate check — admin can re-add

    const submissionId = uuidv4();
    const cancelToken = uuidv4();
    const checkinToken = uuidv4();
    const confirmCode = String(Math.floor(1000 + Math.random() * 9000));

    run(`INSERT INTO registration_submissions (id, registrationId, userId, answers, contactName, contactLastName, contactFirstName, contactPatronymic, contactEmail, contactPhone, status, cancelToken, checkinToken, confirmCode, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'registered', ?, ?, ?, 0)`,
      [submissionId, id, req.user?.id || null, JSON.stringify(answers || {}), fullName, effectiveLastName, effectiveFirstName, patronymic, contactEmail?.trim() || '', contactPhone?.trim() || '', cancelToken, checkinToken, confirmCode]);

    const submission = get('SELECT * FROM registration_submissions WHERE id = ?', [submissionId]);
    res.status(201).json({ success: true, data: { ...submission, cancelToken, checkinToken, confirmCode } });

    // Send email if requested (fire-and-forget)
    if (sendEmail && contactEmail?.trim()) {
      (async () => {
        try {
          const origin = `${req.protocol}://${req.get('host')}`;
          await sendRegistrationConfirm(contactEmail.trim(), {
            name: fullName || 'Участник',
            eventTitle: reg.title,
            eventDate: reg.eventDate,
            eventTime: reg.eventTime,
            location: reg.location,
            mapCoords: reg.mapCoords,
            organizer: reg.organizer,
            description: reg.description,
            status: 'registered',
            checkinToken,
            confirmCode,
            cancelToken,
            origin,
          });
        } catch (e) {
          console.error('[AdminSubmission] email error:', e);
        }
      })();
    }

    // Notify admins (fire-and-forget)
    (async () => {
      try {
        const admins = query("SELECT id FROM users WHERE role IN ('администратор', 'admin') OR roles LIKE '%admin%'");
        for (const admin of admins) {
          createNotification({
            userId: admin.id,
            type: 'registration',
            title: 'Добавлена заявка вручную',
            body: `${contactName} → "${reg.title}" (добавлено администратором)`,
            link: '/registrations',
          });
        }
      } catch (e) {
        console.error('[AdminSubmission] notification error:', e);
      }
    })();
  } catch (error) {
    console.error('CreateAdminSubmission error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Get submissions ──

export const getSubmissions = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const submissions = query(`
      SELECT rs.*, u.fullName as userName
      FROM registration_submissions rs
      LEFT JOIN users u ON rs.userId = u.id
      WHERE rs.registrationId = ?
      ORDER BY rs.createdAt ASC
    `, [id]);
    res.json({ success: true, data: submissions });
  } catch (error) {
    console.error('GetSubmissions error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Cancel submission ──

export const cancelSubmission = (req: AuthRequest, res: Response) => {
  try {
    const { subId } = req.params;
    const sub = get('SELECT * FROM registration_submissions WHERE id = ?', [subId]);
    if (!sub) return res.status(404).json({ success: false, error: 'Заявка не найдена' });

    // Authorization: only owner or admin can cancel
    const callerRoles = req.user?.roles || [req.user?.role || ''];
    const isAdmin = callerRoles.some((r: string) => ['super_admin', 'руководитель', 'admin'].includes(r));
    if (sub.userId && sub.userId !== req.user?.id && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Нет прав на отмену этой заявки' });
    }

    run("UPDATE registration_submissions SET status = 'cancelled', updatedAt = datetime('now') WHERE id = ?", [subId]);

    // If it was registered, promote first waitlist
    if (sub.status === 'registered') {
      const firstWaitlist = get("SELECT id FROM registration_submissions WHERE registrationId = ? AND status = 'waitlist' ORDER BY position ASC LIMIT 1", [sub.registrationId]);
      if (firstWaitlist) {
        run("UPDATE registration_submissions SET status = 'registered', position = 0, updatedAt = datetime('now') WHERE id = ?", [firstWaitlist.id]);
        // Recalculate waitlist positions
        const waitlist = query("SELECT id FROM registration_submissions WHERE registrationId = ? AND status = 'waitlist' ORDER BY position ASC", [sub.registrationId]);
        waitlist.forEach((w: any, i: number) => {
          run('UPDATE registration_submissions SET position = ? WHERE id = ?', [i + 1, w.id]);
        });

        // Notify promoted user
        const promoted = get('SELECT * FROM registration_submissions WHERE id = ?', [firstWaitlist.id]);
        const regInfo = get('SELECT title, eventDate, eventTime, location, mapCoords, organizer, description FROM registrations WHERE id = ?', [sub.registrationId]);
        if (promoted && regInfo) {
          (async () => {
            try {
              if (promoted.contactEmail) {
                await sendWaitlistPromotion(promoted.contactEmail, {
                  name: promoted.contactName || 'Участник',
                  eventTitle: regInfo.title,
                  eventDate: regInfo.eventDate,
                  eventTime: regInfo.eventTime,
                  location: regInfo.location,
                  mapCoords: regInfo.mapCoords,
                  organizer: regInfo.organizer,
                  description: regInfo.description,
                  checkinToken: promoted.checkinToken || '',
                  confirmCode: promoted.confirmCode || '',
                  cancelToken: promoted.cancelToken || '',
                  origin: `${req.protocol}://${req.get('host')}`,
                });
              }
              if (promoted.userId) {
                createNotification({
                  userId: promoted.userId, type: 'registration',
                  title: 'Вы зарегистрированы!',
                  body: `Место освободилось. Вы переведены из листа ожидания в "${regInfo.title}"`,
                  link: '/registrations',
                });
              }
            } catch (e) { console.error('[Registration] promotion notify error:', e); }
          })();
        }
      }
    }

    res.json({ success: true, message: 'Заявка отменена' });
  } catch (error) {
    console.error('CancelSubmission error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Cancel by token (public) ──

export const cancelByToken = (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const sub = get('SELECT * FROM registration_submissions WHERE cancelToken = ?', [token]);
    if (!sub) return res.status(404).json({ success: false, error: 'Заявка не найдена' });

    run("UPDATE registration_submissions SET status = 'cancelled', updatedAt = datetime('now') WHERE id = ?", [sub.id]);

    // Promote waitlist
    if (sub.status === 'registered') {
      const firstWaitlist = get("SELECT id FROM registration_submissions WHERE registrationId = ? AND status = 'waitlist' ORDER BY position ASC LIMIT 1", [sub.registrationId]);
      if (firstWaitlist) {
        run("UPDATE registration_submissions SET status = 'registered', position = 0, updatedAt = datetime('now') WHERE id = ?", [firstWaitlist.id]);
        const waitlist = query("SELECT id FROM registration_submissions WHERE registrationId = ? AND status = 'waitlist' ORDER BY position ASC", [sub.registrationId]);
        waitlist.forEach((w: any, i: number) => {
          run('UPDATE registration_submissions SET position = ? WHERE id = ?', [i + 1, w.id]);
        });

        // Notify promoted user
        const promoted = get('SELECT * FROM registration_submissions WHERE id = ?', [firstWaitlist.id]);
        const regInfo = get('SELECT title, eventDate, eventTime, location, mapCoords, organizer, description FROM registrations WHERE id = ?', [sub.registrationId]);
        if (promoted && regInfo) {
          (async () => {
            try {
              if (promoted.contactEmail) {
                await sendWaitlistPromotion(promoted.contactEmail, {
                  name: promoted.contactName || 'Участник',
                  eventTitle: regInfo.title,
                  eventDate: regInfo.eventDate,
                  eventTime: regInfo.eventTime,
                  location: regInfo.location,
                  mapCoords: regInfo.mapCoords,
                  organizer: regInfo.organizer,
                  description: regInfo.description,
                  checkinToken: promoted.checkinToken || '',
                  confirmCode: promoted.confirmCode || '',
                  cancelToken: promoted.cancelToken || '',
                  origin: `${req.protocol}://${req.get('host')}`,
                });
              }
              if (promoted.userId) {
                createNotification({
                  userId: promoted.userId, type: 'registration',
                  title: 'Вы зарегистрированы!',
                  body: `Место освободилось. Вы переведены из листа ожидания в "${regInfo.title}"`,
                  link: '/registrations',
                });
              }
            } catch (e) { console.error('[Registration] promotion notify error:', e); }
          })();
        }
      }
    }

    res.json({ success: true, message: 'Регистрация отменена' });
  } catch (error) {
    console.error('CancelByToken error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Update submission status ──

export const updateSubmissionStatus = (req: AuthRequest, res: Response) => {
  try {
    const { subId } = req.params;
    const { status } = req.body;
    
    if (!['registered', 'confirmed', 'waitlist', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Неверный статус' });
    }
    
    const sub = get('SELECT * FROM registration_submissions WHERE id = ?', [subId]);
    if (!sub) return res.status(404).json({ success: false, error: 'Заявка не найдена' });
    
    run('UPDATE registration_submissions SET status = ?, updatedAt = datetime(\'now\') WHERE id = ?', [status, subId]);
    
    // If cancelling and there are waitlisted people, promote the first one
    if (status === 'cancelled' && sub.status !== 'waitlist') {
      const firstWaitlist = get(
        "SELECT id FROM registration_submissions WHERE registrationId = ? AND status = 'waitlist' ORDER BY position ASC LIMIT 1",
        [sub.registrationId]
      );
      if (firstWaitlist) {
        run("UPDATE registration_submissions SET status = 'registered', position = 0, updatedAt = datetime('now') WHERE id = ?", [firstWaitlist.id]);
      }
    }
    
    res.json({ success: true, message: 'Статус обновлён' });
  } catch (error) {
    console.error('UpdateSubmissionStatus error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Delete submission (admin only, permanent) ──

export const deleteSubmission = (req: AuthRequest, res: Response) => {
  try {
    const { subId } = req.params;
    const sub = get('SELECT * FROM registration_submissions WHERE id = ?', [subId]);
    if (!sub) return res.status(404).json({ success: false, error: 'Заявка не найдена' });

    run('DELETE FROM registration_submissions WHERE id = ?', [subId]);
    res.json({ success: true, message: 'Заявка удалена' });
  } catch (error) {
    console.error('DeleteSubmission error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};