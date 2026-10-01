import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { UPLOADS_DIR } from '../paths';
import { sendEventUpdate } from '../utils/email';
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
    const { title, description, eventDate, eventTime, location, videoUrl, maxParticipants, status, registrationStart, registrationEnd, closedMessage, mapCoords, showLimit, showTimer, organizer, color, theme, waitlistEnabled, maxWaitlist } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Название обязательно' });

    const id = uuidv4();
    const slug = uuidv4().slice(0, 8);
    run(`INSERT INTO registrations (id, title, description, eventDate, eventTime, location, videoUrl, maxParticipants, status, publicSlug, createdBy, registrationStart, registrationEnd, closedMessage, mapCoords, showLimit, showTimer, organizer, color, theme, waitlistEnabled, maxWaitlist)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description || '', eventDate || '', eventTime || '', location || '', videoUrl || '', maxParticipants || 0, status || 'draft', slug, req.user?.id, registrationStart || '', registrationEnd || '', closedMessage || '', mapCoords || '', showLimit ?? 1, showTimer ?? 1, organizer || '', color || '', theme || 'cyberpunk', waitlistEnabled ?? 1, maxWaitlist ?? 0]);

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

    const { title, description, eventDate, eventTime, location, videoUrl, maxParticipants, status, imageUrl, registrationStart, registrationEnd, closedMessage, mapCoords, showLimit, showTimer, organizer, color, theme, waitlistEnabled, maxWaitlist } = req.body;
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
    if (color !== undefined) { updates.push('color = ?'); params.push(color); }
    if (theme !== undefined) { updates.push('theme = ?'); params.push(theme); }
    if (waitlistEnabled !== undefined) { updates.push('waitlistEnabled = ?'); params.push(waitlistEnabled); }
    if (maxWaitlist !== undefined) { updates.push('maxWaitlist = ?'); params.push(maxWaitlist); }

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

export const duplicateRegistration = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT * FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const newId = uuidv4();

    run(`INSERT INTO registrations (id, title, description, eventDate, eventTime, location, videoUrl, maxParticipants, status, publicSlug, createdBy, registrationStart, registrationEnd, closedMessage, mapCoords, showLimit, showTimer, organizer, color, theme, waitlistEnabled, maxWaitlist) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, reg.title + ' (копия)', reg.description, reg.eventDate, reg.eventTime, reg.location, reg.videoUrl, reg.maxParticipants, req.user?.id, reg.registrationStart, reg.registrationEnd, reg.closedMessage, reg.mapCoords, reg.showLimit, reg.showTimer, reg.organizer, reg.color, reg.theme || 'cyberpunk', reg.waitlistEnabled ?? 1, reg.maxWaitlist ?? 0]);

    // Copy all fields
    const fields = query('SELECT * FROM registration_fields WHERE registrationId = ? ORDER BY position', [id]);
    for (const field of fields) {
      run('INSERT INTO registration_fields (id, registrationId, type, label, placeholder, required, options, settings, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), newId, field.type, field.label, field.placeholder, field.required, field.options, field.settings, field.position]);
    }

    // Return the new registration with fields
    const newReg = get('SELECT * FROM registrations WHERE id = ?', [newId]);
    const newFields = query('SELECT * FROM registration_fields WHERE registrationId = ? ORDER BY position', [newId]);
    res.status(201).json({ success: true, data: { ...newReg, fields: newFields } });
  } catch (error) {
    console.error('DuplicateRegistration error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};