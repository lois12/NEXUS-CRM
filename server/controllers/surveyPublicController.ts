import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { get, query, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';

const DEFAULT_THANKS = 'Спасибо что уделили время и проши опрос, Ваше мнение важно для нас';
const DEFAULT_THANKS_URL = 'https://visit-norilsk.ru';

function safeJson(s: any): any[] {
  try {
    const v = JSON.parse(s || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Public: survey form by slug (no auth) */
export const getPublicSurvey = (req: AuthRequest, res: Response) => {
  try {
    const row = get('SELECT * FROM surveys WHERE publicSlug = ? AND isPublic = 1', [req.params.slug]);
    if (!row) return res.status(404).json({ success: false, error: 'Опрос не найден или не опубликован' });
    const questions = query(
      'SELECT * FROM survey_questions WHERE surveyId = ? ORDER BY position ASC, createdAt ASC',
      [row.id],
    ).map((q: any) => ({ ...q, options: safeJson(q.options) }));
    res.json({
      success: true,
      data: {
        id: row.id,
        name: row.name,
        description: row.description,
        imageUrl: row.imageUrl,
        isAnonymous: !!row.isAnonymous,
        thanksText: row.thanksText || DEFAULT_THANKS,
        thanksRedirectUrl: row.thanksRedirectUrl || DEFAULT_THANKS_URL,
        questions,
      },
    });
  } catch (error) {
    console.error('GetPublicSurvey error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

/** Public: submit response (1 per device per survey) */
export const submitSurveyResponse = (req: AuthRequest, res: Response) => {
  try {
    const survey = get('SELECT * FROM surveys WHERE publicSlug = ? AND isPublic = 1', [req.params.slug]);
    if (!survey) return res.status(404).json({ success: false, error: 'Опрос не найден или не опубликован' });

    const {
      deviceId = '',
      contactName = '',
      contactPhone = '',
      contactEmail = '',
      answers = {},
    } = req.body || {};

    const dev = String(deviceId || '').trim().slice(0, 64);
    if (!dev) throw new HttpError(400, 'Не передан идентификатор устройства');

    if (!survey.isAnonymous) {
      if (!String(contactName).trim()) throw new HttpError(400, 'Укажите ФИО');
      if (!String(contactPhone).trim()) throw new HttpError(400, 'Укажите телефон');
      if (!String(contactEmail).trim()) throw new HttpError(400, 'Укажите email');
    }

    // one response per device
    const existing = get(
      'SELECT id FROM survey_responses WHERE surveyId = ? AND deviceId = ?',
      [survey.id, dev],
    );
    if (existing) throw new HttpError(400, 'Вы уже проходили этот опрос');

    if (!answers || typeof answers !== 'object') throw new HttpError(400, 'Некорректные ответы');

    run(
      `INSERT INTO survey_responses
         (id, surveyId, deviceId, userId, contactName, contactPhone, contactEmail, answers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        survey.id,
        dev,
        null,
        survey.isAnonymous ? '' : String(contactName).trim(),
        survey.isAnonymous ? '' : String(contactPhone).trim(),
        survey.isAnonymous ? '' : String(contactEmail).trim(),
        JSON.stringify(answers),
      ],
    );

    res.status(201).json({
      success: true,
      message: 'Спасибо за ответ!',
      data: {
        thanksText: survey.thanksText || DEFAULT_THANKS,
        thanksRedirectUrl: survey.thanksRedirectUrl || DEFAULT_THANKS_URL,
      },
    });
  } catch (error: any) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ success: false, error: error.message });
    }
    if (String(error?.message || '').includes('UNIQUE')) {
      return res.status(400).json({ success: false, error: 'Вы уже проходили этот опрос' });
    }
    console.error('SubmitSurvey error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка сервера' });
  }
};
