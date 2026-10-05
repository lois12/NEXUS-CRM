import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { updateById } from '../db/sqlBuilder';
import { HttpError } from '../middleware/errorHandler';

// ── Admin CRUD ────────────────────────────────────────────────

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40);
  return base || `s-${Date.now().toString(36)}`;
}

function withQuestions(id: string) {
  return query(
    'SELECT * FROM survey_questions WHERE surveyId = ? ORDER BY position ASC, createdAt ASC',
    [id],
  ).map((q: any) => ({ ...q, options: JSON.parse(q.options || '[]') }));
}

function countResponses(id: string): number {
  return get('SELECT COUNT(*) as c FROM survey_responses WHERE surveyId = ?', [id])?.c || 0;
}

export const getSurveys = (req: AuthRequest, res: Response) => {
  try {
    const rows = query(`
      SELECT s.*, u.fullName as creatorName,
        (SELECT COUNT(*) FROM survey_responses r WHERE r.surveyId = s.id) as responseCount,
        (SELECT COUNT(*) FROM survey_questions q WHERE q.surveyId = s.id) as questionCount
      FROM surveys s
      LEFT JOIN users u ON s.createdBy = u.id
      ORDER BY datetime(s.updatedAt) DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('GetSurveys error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const getSurveyById = (req: AuthRequest, res: Response) => {
  try {
    const row = get('SELECT * FROM surveys WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: 'Опрос не найден' });
    res.json({
      success: true,
      data: {
        ...row,
        isAnonymous: !!row.isAnonymous,
        isPublic: !!row.isPublic,
        questions: withQuestions(row.id),
        responseCount: countResponses(row.id),
      },
    });
  } catch (error) {
    console.error('GetSurvey error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createSurvey = (req: AuthRequest, res: Response) => {
  try {
    const { name, description = '', isAnonymous = false, imageUrl = '' } = req.body || {};
    if (!name || !String(name).trim()) throw new HttpError(400, 'Название обязательно');
    const id = uuidv4();
    run(
      `INSERT INTO surveys (id, name, description, imageUrl, isAnonymous, publicSlug, isPublic, createdBy)
       VALUES (?, ?, ?, ?, ?, NULL, 0, ?)`,
      [id, String(name).trim(), description, imageUrl, isAnonymous ? 1 : 0, req.user!.id],
    );
    const row = get('SELECT * FROM surveys WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: { ...row, isAnonymous: !!row.isAnonymous, questions: [], responseCount: 0 } });
  } catch (error: any) {
    console.error('CreateSurvey error:', error);
    res.status(error instanceof HttpError ? 400 : 500).json({ success: false, error: error?.message || 'Ошибка сервера' });
  }
};

export const updateSurvey = (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const cur = get('SELECT * FROM surveys WHERE id = ?', [id]);
    if (!cur) return res.status(404).json({ success: false, error: 'Опрос не найден' });
    const { name, description, isAnonymous, imageUrl } = req.body || {};
    run(
      `UPDATE surveys SET
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         imageUrl = COALESCE(?, imageUrl),
         isAnonymous = COALESCE(?, isAnonymous),
         updatedAt = datetime('now')
       WHERE id = ?`,
      [
        typeof name === 'string' && name.trim() ? name.trim() : null,
        typeof description === 'string' ? description : null,
        typeof imageUrl === 'string' ? imageUrl : null,
        typeof isAnonymous === 'boolean' ? (isAnonymous ? 1 : 0) : null,
        id,
      ],
    );
    res.json({ success: true, message: 'Обновлено' });
  } catch (error) {
    console.error('UpdateSurvey error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteSurvey = (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const cur = get('SELECT id FROM surveys WHERE id = ?', [id]);
    if (!cur) return res.status(404).json({ success: false, error: 'Опрос не найден' });
    // explicit cascade — old schemas may lack ON DELETE CASCADE
    run('DELETE FROM survey_questions WHERE surveyId = ?', [id]);
    run('DELETE FROM survey_responses WHERE surveyId = ?', [id]);
    run('DELETE FROM surveys WHERE id = ?', [id]);
    res.json({ success: true, message: 'Удалено' });
  } catch (error: any) {
    console.error('DeleteSurvey error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка удаления' });
  }
};

export const togglePublish = (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const cur = get('SELECT * FROM surveys WHERE id = ?', [id]);
    if (!cur) return res.status(404).json({ success: false, error: 'Опрос не найден' });
    if (cur.isPublic) {
      run('UPDATE surveys SET isPublic = 0, updatedAt = datetime(\'now\') WHERE id = ?', [id]);
      return res.json({ success: true, data: { isPublic: false, publicSlug: cur.publicSlug } });
    }
    let slug = cur.publicSlug || slugify(cur.name);
    for (let i = 0; i < 5 && get('SELECT 1 FROM surveys WHERE publicSlug = ? AND id != ?', [slug, id]); i++) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
    }
    run('UPDATE surveys SET isPublic = 1, publicSlug = ?, updatedAt = datetime(\'now\') WHERE id = ?', [slug, id]);
    res.json({ success: true, data: { isPublic: true, publicSlug: slug } });
  } catch (error) {
    console.error('TogglePublish survey error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Questions ─────────────────────────────────────────────────

export const createQuestion = (req: AuthRequest, res: Response) => {
  try {
    const surveyId = req.params.id;
    if (!get('SELECT 1 FROM surveys WHERE id = ?', [surveyId])) {
      return res.status(404).json({ success: false, error: 'Опрос не найден' });
    }
    const { type = 'choice', title, options = [], required = false, position } = req.body || {};
    if (!title || !String(title).trim()) throw new HttpError(400, 'Текст вопроса обязателен');
    if (type !== 'choice' && type !== 'open') throw new HttpError(400, 'Неизвестный тип вопроса');
    const maxPos = get('SELECT MAX(position) as m FROM survey_questions WHERE surveyId = ?', [surveyId])?.m ?? -1;
    const id = uuidv4();
    run(
      `INSERT INTO survey_questions (id, surveyId, type, title, options, required, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, surveyId, type, String(title).trim(), JSON.stringify(Array.isArray(options) ? options : []), required ? 1 : 0,
        typeof position === 'number' ? position : maxPos + 1],
    );
    const q = get('SELECT * FROM survey_questions WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: { ...q, options: JSON.parse(q.options || '[]') } });
  } catch (error: any) {
    console.error('CreateQuestion error:', error);
    res.status(error instanceof HttpError ? 400 : 500).json({ success: false, error: error?.message || 'Ошибка сервера' });
  }
};

export const updateQuestion = (req: AuthRequest, res: Response) => {
  try {
    const { id, questionId } = req.params;
    const cur = get('SELECT * FROM survey_questions WHERE id = ? AND surveyId = ?', [questionId, id]);
    if (!cur) return res.status(404).json({ success: false, error: 'Вопрос не найден' });
    const { title, type, options, required } = req.body || {};
    run(
      `UPDATE survey_questions SET
         title = COALESCE(?, title),
         type = COALESCE(?, type),
         options = COALESCE(?, options),
         required = COALESCE(?, required)
       WHERE id = ?`,
      [
        typeof title === 'string' && title.trim() ? title.trim() : null,
        type === 'choice' || type === 'open' ? type : null,
        Array.isArray(options) ? JSON.stringify(options) : null,
        typeof required === 'boolean' ? (required ? 1 : 0) : null,
        questionId,
      ],
    );
    const q = get('SELECT * FROM survey_questions WHERE id = ?', [questionId]);
    res.json({ success: true, data: { ...q, options: JSON.parse(q.options || '[]') } });
  } catch (error) {
    console.error('UpdateQuestion error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteQuestion = (req: AuthRequest, res: Response) => {
  try {
    run('DELETE FROM survey_questions WHERE id = ? AND surveyId = ?', [req.params.questionId, req.params.id]);
    res.json({ success: true, message: 'Удалено' });
  } catch (error) {
    console.error('DeleteQuestion error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const reorderQuestions = (req: AuthRequest, res: Response) => {
  try {
    const { order } = req.body || {};
    if (!Array.isArray(order)) throw new HttpError(400, 'Нужен массив order');
    order.forEach((qid: string, i: number) => {
      run('UPDATE survey_questions SET position = ? WHERE id = ? AND surveyId = ?', [i, qid, req.params.id]);
    });
    res.json({ success: true, data: withQuestions(req.params.id) });
  } catch (error: any) {
    console.error('ReorderQuestions error:', error);
    res.status(error instanceof HttpError ? 400 : 500).json({ success: false, error: error?.message || 'Ошибка сервера' });
  }
};

// ── Stats ─────────────────────────────────────────────────────

export const getSurveyStats = (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const survey = get('SELECT * FROM surveys WHERE id = ?', [id]);
    if (!survey) return res.status(404).json({ success: false, error: 'Опрос не найден' });

    const questions = withQuestions(id);
    const responses = query(
      'SELECT * FROM survey_responses WHERE surveyId = ? ORDER BY datetime(createdAt) DESC',
      [id],
    );

    const stats = questions.map((q: any) => {
      if (q.type === 'choice') {
        const counts: Record<string, number> = {};
        (q.options as string[]).forEach((o) => { counts[o] = 0; });
        let total = 0;
        for (const r of responses) {
          let a: any = {};
          try { a = JSON.parse(r.answers || '{}'); } catch { /* skip */ }
          const v = a[q.id];
          if (typeof v === 'string' && v in counts) {
            counts[v] += 1;
            total += 1;
          }
        }
        const distribution = (q.options as string[]).map((o) => ({
          option: o,
          count: counts[o] || 0,
          percent: total ? Math.round(((counts[o] || 0) / total) * 1000) / 10 : 0,
        }));
        return { ...q, total, distribution, openAnswers: [] };
      }
      const openAnswers: string[] = [];
      for (const r of responses) {
        let a: any = {};
        try { a = JSON.parse(r.answers || '{}'); } catch { /* skip */ }
        const v = a[q.id];
        if (typeof v === 'string' && v.trim()) openAnswers.push(v.trim());
      }
      return { ...q, total: openAnswers.length, distribution: [], openAnswers };
    });

    res.json({
      success: true,
      data: {
        survey: { ...survey, isAnonymous: !!survey.isAnonymous, isPublic: !!survey.isPublic },
        responseCount: responses.length,
        lastResponseAt: responses[0]?.createdAt || null,
        stats,
        responses: responses.map((r: any) => ({ ...r, answers: JSON.parse(r.answers || '{}') })),
      },
    });
  } catch (error) {
    console.error('GetSurveyStats error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Export ────────────────────────────────────────────────────

export const exportCSV = (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const survey = get('SELECT * FROM surveys WHERE id = ?', [id]);
    if (!survey) return res.status(404).json({ success: false, error: 'Опрос не найден' });
    const questions = withQuestions(id);
    const responses = query('SELECT * FROM survey_responses WHERE surveyId = ? ORDER BY datetime(createdAt) ASC', [id]);

    const head = ['Дата', 'ФИО', 'Телефон', 'Email', ...questions.map((q: any) => q.title)];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.map(esc).join(';')];
    for (const r of responses) {
      let a: any = {};
      try { a = JSON.parse(r.answers || '{}'); } catch { /* skip */ }
      lines.push([
        r.createdAt, r.contactName, r.contactPhone, r.contactEmail,
        ...questions.map((q: any) => (a[q.id] ?? '')),
      ].map(esc).join(';'));
    }
    const csv = '\uFEFF' + lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="survey_${id}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('ExportSurveyCSV error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const exportPDF = (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const survey = get('SELECT * FROM surveys WHERE id = ?', [id]);
    if (!survey) return res.status(404).json({ success: false, error: 'Опрос не найден' });
    const questions = withQuestions(id);
    const responses = query('SELECT * FROM survey_responses WHERE surveyId = ? ORDER BY datetime(createdAt) ASC', [id]);

    const rowsFor = (q: any) => {
      if (q.type === 'choice') {
        const counts: Record<string, number> = {};
        (q.options as string[]).forEach((o) => { counts[o] = 0; });
        let total = 0;
        for (const r of responses) {
          let a: any = {};
          try { a = JSON.parse(r.answers || '{}'); } catch { /* skip */ }
          const v = a[q.id];
          if (typeof v === 'string' && v in counts) { counts[v] += 1; total += 1; }
        }
        return (q.options as string[]).map((o) => {
          const c = counts[o] || 0;
          const pct = total ? Math.round((c / total) * 1000) / 10 : 0;
          return `<tr><td>${o}</td><td>${c}</td><td>${pct}%</td></tr>`;
        }).join('');
      }
      const texts: string[] = [];
      for (const r of responses) {
        let a: any = {};
        try { a = JSON.parse(r.answers || '{}'); } catch { /* skip */ }
        const v = a[q.id];
        if (typeof v === 'string' && v.trim()) texts.push(v.trim());
      }
      return texts.map((t) => `<tr><td colspan="3">${t.replace(/</g, '&lt;')}</td></tr>`).join('') || '<tr><td colspan="3">—</td></tr>';
    };

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${survey.name}</title>
<style>
body{font-family:system-ui,sans-serif;color:#111;padding:32px}
h1{font-size:20px;margin:0 0 4px}
.meta{color:#666;font-size:12px;margin-bottom:20px}
h2{font-size:15px;margin:18px 0 8px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px}
th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
th{background:#f3f4f6}
.bar{height:8px;background:#00ff88;margin-top:4px}
@media print { button{display:none} }
</style></head><body>
<h1>${survey.name}</h1>
<div class="meta">Ответов: ${responses.length} · ${new Date().toLocaleString('ru-RU')}</div>
${questions.map((q: any) => `
<h2>${q.title} <small style="color:#666">(${q.type === 'choice' ? 'варианты' : 'открытый'})</small></h2>
<table><thead><tr>${q.type === 'choice' ? '<th>Вариант</th><th>Шт.</th><th>%</th>' : '<th>Ответ</th>'}</tr></thead>
<tbody>${rowsFor(q)}</tbody></table>`).join('')}
<script>window.onload=()=>window.print()</script>
</body></html>`;
    res.send(html);
  } catch (error) {
    console.error('ExportSurveyPDF error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
