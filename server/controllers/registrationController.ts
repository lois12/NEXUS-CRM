import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { UPLOADS_DIR } from '../paths';
import { sendRegistrationConfirm, sendAdminNotification, sendWaitlistPromotion, sendEventUpdate } from '../utils/email';
import { createNotification } from './notificationController';

// ── Registrations CRUD ──

export const getRegistrations = (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const regs = query(`
      SELECT r.*, u.fullName as creatorName,
        (SELECT COUNT(*) FROM registration_submissions rs WHERE rs.registrationId = r.id AND rs.status IN ('registered', 'confirmed')) as confirmedCount,
        (SELECT COUNT(*) FROM registration_submissions rs WHERE rs.registrationId = r.id AND rs.status = 'waitlist') as waitlistCount
      FROM registrations r
      LEFT JOIN users u ON r.createdBy = u.id
      ORDER BY r.createdAt DESC LIMIT ?
    `, [limit]);
    res.json({ success: true, data: regs });
  } catch (error) {
    console.error('GetRegistrations error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const getRegistrationById = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get(`
      SELECT r.*, u.fullName as creatorName,
        (SELECT COUNT(*) FROM registration_submissions rs WHERE rs.registrationId = r.id AND rs.status IN ('registered', 'confirmed')) as confirmedCount,
        (SELECT COUNT(*) FROM registration_submissions rs WHERE rs.registrationId = r.id AND rs.status = 'waitlist') as waitlistCount
      FROM registrations r
      LEFT JOIN users u ON r.createdBy = u.id
      WHERE r.id = ?
    `, [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const fields = query('SELECT * FROM registration_fields WHERE registrationId = ? ORDER BY position ASC', [id]);
    res.json({ success: true, data: { ...reg, fields } });
  } catch (error) {
    console.error('GetRegistrationById error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createRegistration = (req: AuthRequest, res: Response) => {
  try {
    const { title, description, eventDate, eventTime, location, videoUrl, maxParticipants, status, registrationStart, registrationEnd, closedMessage, mapCoords, showLimit, showTimer, organizer } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Название обязательно' });

    const id = uuidv4();
    const slug = uuidv4().slice(0, 8);
    run(`INSERT INTO registrations (id, title, description, eventDate, eventTime, location, videoUrl, maxParticipants, status, publicSlug, createdBy, registrationStart, registrationEnd, closedMessage, mapCoords, showLimit, showTimer, organizer)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description || '', eventDate || '', eventTime || '', location || '', videoUrl || '', maxParticipants || 0, status || 'draft', slug, req.user?.id, registrationStart || '', registrationEnd || '', closedMessage || '', mapCoords || '', showLimit ?? 1, showTimer ?? 1, organizer || '']);

    const reg = get('SELECT * FROM registrations WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: reg });
  } catch (error) {
    console.error('CreateRegistration error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateRegistration = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT * FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const { title, description, eventDate, eventTime, location, videoUrl, maxParticipants, status, imageUrl, registrationStart, registrationEnd, closedMessage, mapCoords, showLimit, showTimer, organizer } = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (eventDate !== undefined) { updates.push('eventDate = ?'); params.push(eventDate); }
    if (eventTime !== undefined) { updates.push('eventTime = ?'); params.push(eventTime); }
    if (location !== undefined) { updates.push('location = ?'); params.push(location); }
    if (videoUrl !== undefined) { updates.push('videoUrl = ?'); params.push(videoUrl); }
    if (maxParticipants !== undefined) { updates.push('maxParticipants = ?'); params.push(maxParticipants); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (imageUrl !== undefined) { updates.push('imageUrl = ?'); params.push(imageUrl); }
    if (registrationStart !== undefined) { updates.push('registrationStart = ?'); params.push(registrationStart); }
    if (registrationEnd !== undefined) { updates.push('registrationEnd = ?'); params.push(registrationEnd); }
    if (closedMessage !== undefined) { updates.push('closedMessage = ?'); params.push(closedMessage); }
    if (mapCoords !== undefined) { updates.push('mapCoords = ?'); params.push(mapCoords); }
    if (showLimit !== undefined) { updates.push('showLimit = ?'); params.push(showLimit); }
    if (showTimer !== undefined) { updates.push('showTimer = ?'); params.push(showTimer); }
    if (organizer !== undefined) { updates.push('organizer = ?'); params.push(organizer); }

    updates.push("updatedAt = datetime('now')");
    params.push(id);

    if (updates.length > 1) {
      run(`UPDATE registrations SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Обновлено' });
  } catch (error) {
    console.error('UpdateRegistration error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Update and notify all registered participants ──

export const updateAndNotify = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT * FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    // Track what changed
    const changes: string[] = [];
    const { title, description, eventDate, eventTime, location, videoUrl, maxParticipants, status, imageUrl, registrationStart, registrationEnd, closedMessage, mapCoords, showLimit, showTimer, organizer } = req.body;

    if (eventDate !== undefined && eventDate !== reg.eventDate) changes.push(`Дата проведения изменена на "${eventDate}"`);
    if (eventTime !== undefined && eventTime !== reg.eventTime) changes.push(`Время проведения изменено на "${eventTime}"`);
    if (location !== undefined && location !== reg.location) changes.push(`Место проведения изменено на "${location}"`);
    if (title !== undefined && title !== reg.title) changes.push(`Название изменено на "${title}"`);
    if (organizer !== undefined && organizer !== reg.organizer) changes.push(`Организатор изменён на "${organizer}"`);
    if (description !== undefined && description !== reg.description) changes.push(`Описание мероприятия обновлено`);
    if (maxParticipants !== undefined && maxParticipants !== reg.maxParticipants) changes.push(`Лимит участников изменён на ${maxParticipants}`);

    if (changes.length === 0) {
      return res.json({ success: true, message: 'Нет изменений для уведомления', notified: 0 });
    }

    // Apply changes
    const updates: string[] = [];
    const params: any[] = [];
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (eventDate !== undefined) { updates.push('eventDate = ?'); params.push(eventDate); }
    if (eventTime !== undefined) { updates.push('eventTime = ?'); params.push(eventTime); }
    if (location !== undefined) { updates.push('location = ?'); params.push(location); }
    if (videoUrl !== undefined) { updates.push('videoUrl = ?'); params.push(videoUrl); }
    if (maxParticipants !== undefined) { updates.push('maxParticipants = ?'); params.push(maxParticipants); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (imageUrl !== undefined) { updates.push('imageUrl = ?'); params.push(imageUrl); }
    if (registrationStart !== undefined) { updates.push('registrationStart = ?'); params.push(registrationStart); }
    if (registrationEnd !== undefined) { updates.push('registrationEnd = ?'); params.push(registrationEnd); }
    if (closedMessage !== undefined) { updates.push('closedMessage = ?'); params.push(closedMessage); }
    if (mapCoords !== undefined) { updates.push('mapCoords = ?'); params.push(mapCoords); }
    if (showLimit !== undefined) { updates.push('showLimit = ?'); params.push(showLimit); }
    if (showTimer !== undefined) { updates.push('showTimer = ?'); params.push(showTimer); }
    if (organizer !== undefined) { updates.push('organizer = ?'); params.push(organizer); }
    updates.push("updatedAt = datetime('now')");
    params.push(id);

    if (updates.length > 1) {
      run(`UPDATE registrations SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Get updated registration
    const updatedReg = get('SELECT * FROM registrations WHERE id = ?', [id]);

    // Send emails to all registered/waitlisted participants
    const participants = query(
      "SELECT contactName, contactEmail, cancelToken FROM registration_submissions WHERE registrationId = ? AND status IN ('registered', 'waitlist') AND contactEmail != ''",
      [id]
    );

    let notified = 0;
    const origin = `${req.protocol}://${req.get('host')}`;

    for (const p of participants) {
      try {
        await sendEventUpdate(p.contactEmail, {
          name: p.contactName || 'Участник',
          eventTitle: updatedReg.title,
          eventDate: updatedReg.eventDate,
          eventTime: updatedReg.eventTime,
          location: updatedReg.location,
          mapCoords: updatedReg.mapCoords,
          organizer: updatedReg.organizer,
          description: updatedReg.description,
          changes,
          cancelToken: p.cancelToken,
          origin,
        });
        notified++;
      } catch (e) {
        console.error(`[UpdateNotify] Failed for ${p.contactEmail}:`, e);
      }
    }

    // Also notify admins
    const admins = query("SELECT id FROM users WHERE role IN ('администратор', 'admin') OR roles LIKE '%admin%'");
    for (const admin of admins) {
      createNotification({
        userId: admin.id,
        type: 'registration',
        title: 'Мероприятие обновлено',
        body: `"${updatedReg.title}" — ${changes.join(', ')}. Уведомлено ${notified} участников.`,
        link: '/registrations',
      });
    }

    res.json({ success: true, message: `Обновлено. Уведомлено ${notified} участников.`, notified, changes });
  } catch (error) {
    console.error('UpdateAndNotify error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteRegistration = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT id, imageUrl FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });
    if (reg.imageUrl) {
      const filePath = path.join(UPLOADS_DIR, path.basename(reg.imageUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    run('DELETE FROM registrations WHERE id = ?', [id]);
    res.json({ success: true, message: 'Удалено' });
  } catch (error) {
    console.error('DeleteRegistration error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const uploadImage = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT id FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

    const imageUrl = `/uploads/${file.filename}`;
    run("UPDATE registrations SET imageUrl = ?, updatedAt = datetime('now') WHERE id = ?", [imageUrl, id]);
    res.json({ success: true, data: { imageUrl } });
  } catch (error) {
    console.error('UploadImage error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const uploadVideo = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT id FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

    const videoUrl = `/uploads/${file.filename}`;
    run("UPDATE registrations SET videoUrl = ?, updatedAt = datetime('now') WHERE id = ?", [videoUrl, id]);
    res.json({ success: true, data: { videoUrl } });
  } catch (error) {
    console.error('UploadVideo error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Media Gallery CRUD ──

export const getMedia = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const media = query('SELECT * FROM registration_media WHERE registrationId = ? ORDER BY position ASC', [id]);
    res.json({ success: true, data: media });
  } catch (error) {
    console.error('GetMedia error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const uploadMedia = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT id FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

    const mediaId = uuidv4();
    const type = file.mimetype.startsWith('video/') ? 'video' : 'image';
    const maxPos = get('SELECT MAX(position) as maxPos FROM registration_media WHERE registrationId = ?', [id]);
    const pos = (maxPos?.maxPos ?? -1) + 1;

    run('INSERT INTO registration_media (id, registrationId, type, url, filename, size, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [mediaId, id, type, `/uploads/${file.filename}`, file.originalname || file.filename, file.size, pos]);

    const media = get('SELECT * FROM registration_media WHERE id = ?', [mediaId]);
    res.status(201).json({ success: true, data: media });
  } catch (error) {
    console.error('UploadMedia error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteMedia = (req: AuthRequest, res: Response) => {
  try {
    const { mediaId } = req.params;
    const media = get('SELECT * FROM registration_media WHERE id = ?', [mediaId]);
    if (!media) return res.status(404).json({ success: false, error: 'Файл не найден' });

    const filePath = path.join(UPLOADS_DIR, path.basename(media.url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    run('DELETE FROM registration_media WHERE id = ?', [mediaId]);
    res.json({ success: true, message: 'Удалено' });
  } catch (error) {
    console.error('DeleteMedia error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createField = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT id FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const { type, label, placeholder, required, options, settings, position } = req.body;
    if (!type || !label) return res.status(400).json({ success: false, error: 'Тип и название обязательны' });

    const fieldId = uuidv4();
    const maxPos = get('SELECT MAX(position) as maxPos FROM registration_fields WHERE registrationId = ?', [id]);
    const pos = position ?? ((maxPos?.maxPos ?? -1) + 1);

    const optStr = typeof options === 'string' ? options : JSON.stringify(options || []);
    const setStr = typeof settings === 'string' ? settings : JSON.stringify(settings || {});
    run('INSERT INTO registration_fields (id, registrationId, type, label, placeholder, required, options, settings, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [fieldId, id, type, label, placeholder || '', required ? 1 : 0, optStr, setStr, pos]);

    const field = get('SELECT * FROM registration_fields WHERE id = ?', [fieldId]);
    res.status(201).json({ success: true, data: field });
  } catch (error) {
    console.error('CreateField error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateField = (req: AuthRequest, res: Response) => {
  try {
    const { fieldId } = req.params;
    const field = get('SELECT * FROM registration_fields WHERE id = ?', [fieldId]);
    if (!field) return res.status(404).json({ success: false, error: 'Поле не найдено' });

    const { type, label, placeholder, required, options, settings, position } = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (label !== undefined) { updates.push('label = ?'); params.push(label); }
    if (placeholder !== undefined) { updates.push('placeholder = ?'); params.push(placeholder); }
    if (required !== undefined) { updates.push('required = ?'); params.push(required ? 1 : 0); }
    if (options !== undefined) { updates.push('options = ?'); params.push(typeof options === 'string' ? options : JSON.stringify(options)); }
    if (settings !== undefined) { updates.push('settings = ?'); params.push(typeof settings === 'string' ? settings : JSON.stringify(settings)); }
    if (position !== undefined) { updates.push('position = ?'); params.push(position); }

    params.push(fieldId);

    if (updates.length > 0) {
      run(`UPDATE registration_fields SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Поле обновлено' });
  } catch (error) {
    console.error('UpdateField error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteField = (req: AuthRequest, res: Response) => {
  try {
    const { fieldId } = req.params;
    const field = get('SELECT id FROM registration_fields WHERE id = ?', [fieldId]);
    if (!field) return res.status(404).json({ success: false, error: 'Поле не найдено' });
    run('DELETE FROM registration_fields WHERE id = ?', [fieldId]);
    res.json({ success: true, message: 'Поле удалено' });
  } catch (error) {
    console.error('DeleteField error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const reorderFields = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { order } = req.body; // string[] of field IDs
    if (!Array.isArray(order)) return res.status(400).json({ success: false, error: 'order массив обязателен' });

    order.forEach((fieldId: string, index: number) => {
      run('UPDATE registration_fields SET position = ? WHERE id = ? AND registrationId = ?', [index, fieldId, id]);
    });

    res.json({ success: true, message: 'Порядок обновлён' });
  } catch (error) {
    console.error('ReorderFields error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

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

    const { answers, contactName, contactEmail, contactPhone } = req.body;

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
      status = 'waitlist';
      const waitlistCount = get('SELECT COUNT(*) as cnt FROM registration_submissions WHERE registrationId = ? AND status = ?', [reg.id, 'waitlist'])?.cnt || 0;
      position = waitlistCount + 1;
    }

    const id = uuidv4();
    const cancelToken = uuidv4();
    const checkinToken = uuidv4();
    const confirmCode = String(Math.floor(1000 + Math.random() * 9000));

    run(`INSERT INTO registration_submissions (id, registrationId, userId, answers, contactName, contactEmail, contactPhone, status, cancelToken, checkinToken, confirmCode, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, reg.id, req.user?.id || null, JSON.stringify(answers || {}), contactName || '', contactEmail || '', contactPhone || '', status, cancelToken, checkinToken, confirmCode, position]);

    const submission = get('SELECT * FROM registration_submissions WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: { ...submission, cancelToken, checkinToken, confirmCode } });

    // ── Notifications (fire-and-forget, don't block response) ──
    (async () => {
      try {
        const origin = `${req.protocol}://${req.get('host')}`;

        // 1. Email пользователю
        if (contactEmail) {
          await sendRegistrationConfirm(contactEmail, {
            name: contactName || 'Участник',
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
            body: `${contactName || 'Участник'} → "${reg.title}" (${statusText})`,
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

// ── Export CSV ──

export const exportCSV = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT * FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const fields = query('SELECT * FROM registration_fields WHERE registrationId = ? ORDER BY position ASC', [id]);
    const submissions = query('SELECT * FROM registration_submissions WHERE registrationId = ? ORDER BY createdAt ASC', [id]);

    // Build CSV header
    const headers = ['№', 'Имя', 'Email', 'Телефон', 'Статус', 'Дата', ...fields.map((f: any) => f.label)];

    const rows = submissions.map((sub: any, i: number) => {
      const answers = JSON.parse(sub.answers || '{}');
      return [
        i + 1,
        sub.contactName,
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
