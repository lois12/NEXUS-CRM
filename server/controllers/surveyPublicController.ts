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

/** Public: live stats page data by slug (no auth, published only) */
export const getPublicSurveyStats = (req: AuthRequest, res: Response) => {
  try {
    const survey = get('SELECT * FROM surveys WHERE publicSlug = ? AND isPublic = 1', [req.params.slug]);
    if (!survey) return res.status(404).json({ success: false, error: 'Опрос не найден или не опубликован' });

    const questions = query(
      'SELECT * FROM survey_questions WHERE surveyId = ? ORDER BY position ASC, createdAt ASC',
      [survey.id],
    ).map((q: any) => ({ ...q, options: safeJson(q.options) }));
    const responses = query(
      'SELECT * FROM survey_responses WHERE surveyId = ? ORDER BY datetime(createdAt) ASC',
      [survey.id],
    );

    const answerOf = (r: any, qid: string) => {
      try {
        const a = JSON.parse(r.answers || '{}');
        return a[qid];
      } catch {
        return undefined;
      }
    };

    const stats = questions.map((q: any) => {
      if (q.type === 'choice') {
        const counts: Record<string, number> = {};
        (q.options as string[]).forEach((o: string) => { counts[o] = 0; });
        let total = 0;
        for (const r of responses) {
          const v = answerOf(r, q.id);
          if (typeof v === 'string' && v in counts) {
            counts[v] += 1;
            total += 1;
          }
        }
        return {
          id: q.id,
          type: 'choice',
          title: q.title,
          total,
          distribution: (q.options as string[]).map((o) => ({
            option: o,
            count: counts[o] || 0,
            percent: total ? Math.round(((counts[o] || 0) / total) * 1000) / 10 : 0,
          })),
          openAnswers: [],
        };
      }
      const openAnswers: string[] = [];
      for (const r of responses) {
        const v = answerOf(r, q.id);
        if (typeof v === 'string' && v.trim()) openAnswers.push(v.trim());
      }
      return { id: q.id, type: 'open', title: q.title, total: openAnswers.length, distribution: [], openAnswers };
    });

    // votes per day (last 30 days)
    const byDay: { date: string; count: number }[] = [];
    const dayMap = new Map<string, number>();
    for (const r of responses) {
      const day = String(r.createdAt || '').slice(0, 10);
      if (!day) continue;
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    }
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDay.push({ date: key, count: dayMap.get(key) || 0 });
    }

    res.json({
      success: true,
      data: {
        name: survey.name,
        description: survey.description,
        responseCount: responses.length,
        updatedAt: survey.updatedAt,
        stats,
        byDay,
      },
    });
  } catch (error) {
    console.error('GetPublicSurveyStats error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

function normalizeStatus(raw: any, isPublic?: any): string {
  const s = String(raw || '').toLowerCase();
  if (s === 'scheduled' || s === 'published' || s === 'completed') return s;
  return isPublic ? 'published' : 'draft';
}

/** Public: survey form by slug (no auth) */
export const getPublicSurvey = (req: AuthRequest, res: Response) => {
  try {
    const row = get('SELECT * FROM surveys WHERE publicSlug = ?', [req.params.slug]);
    if (!row) return res.status(404).json({ success: false, error: 'Опрос не найден' });
    const status = normalizeStatus(row.status, row.isPublic);
    if (status === 'draft') return res.status(404).json({ success: false, error: 'Опрос не найден или не опубликован' });

    const thanksText = row.thanksText || DEFAULT_THANKS;
    const thanksRedirectUrl = row.thanksRedirectUrl || DEFAULT_THANKS_URL;

    if (status === 'completed') {
      return res.json({
        success: true,
        data: {
          mode: 'completed',
          id: row.id,
          name: row.name,
          description: row.description,
          imageUrl: row.imageUrl,
          thanksText,
          thanksRedirectUrl,
          questions: [],
        },
      });
    }

    if (status === 'scheduled') {
      return res.json({
        success: true,
        data: {
          mode: 'scheduled',
          id: row.id,
          name: row.name,
          description: row.description,
          imageUrl: row.imageUrl,
          opensAt: row.opensAt ? new Date(row.opensAt).toISOString() : null,
          thanksText,
          thanksRedirectUrl,
          questions: [],
        },
      });
    }

    const questions = query(
      'SELECT * FROM survey_questions WHERE surveyId = ? ORDER BY position ASC, createdAt ASC',
      [row.id],
    ).map((q: any) => ({ ...q, options: safeJson(q.options) }));
    const responseCount = get('SELECT COUNT(*) as c FROM survey_responses WHERE surveyId = ?', [row.id])?.c || 0;
    res.json({
      success: true,
      data: {
        mode: 'open',
        id: row.id,
        name: row.name,
        description: row.description,
        imageUrl: row.imageUrl,
        isAnonymous: !!row.isAnonymous,
        thanksText,
        thanksRedirectUrl,
        responseCount,
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
    const survey = get('SELECT * FROM surveys WHERE publicSlug = ?', [req.params.slug]);
    if (!survey) return res.status(404).json({ success: false, error: 'Опрос не найден или не опубликован' });
    const status = normalizeStatus(survey.status, survey.isPublic);
    if (status !== 'published') {
      return res.status(400).json({ success: false, error: 'Приём ответов сейчас закрыт' });
    }

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
