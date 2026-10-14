import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run, transaction } from '../db/database';
import { AuthRequest } from '../middleware/auth';

function slugify(s: string): string {
  const base = String(s || 'quiz')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'quiz'}-${uuidv4().slice(0, 8)}`;
}

function shapeQuiz(row: any) {
  if (!row) return row;
  let questions = query('SELECT * FROM quiz_questions WHERE quizId = ? ORDER BY position ASC', [row.id]) as any[];
  questions = questions.map((q) => {
    const options = query('SELECT * FROM quiz_options WHERE questionId = ? ORDER BY position ASC', [q.id]);
    return {
      ...q,
      correctText: (q as any).correctText || '',
      isCorrect: !!q.isCorrect,
      options: options.map((o) => ({ ...o, isCorrect: !!o.isCorrect })),
    };
  });
  return {
    ...row,
    questions,
    participantCount: get('SELECT COUNT(*) as c FROM quiz_participants WHERE quizId = ?', [row.id])?.c || 0,
  };
}

export const listQuizzes = (req: AuthRequest, res: Response) => {
  try {
    const rows = query('SELECT * FROM quizzes ORDER BY createdAt DESC');
    res.json({ success: true, data: rows.map((r) => ({ ...r, participantCount: get('SELECT COUNT(*) as c FROM quiz_participants WHERE quizId = ?', [r.id])?.c || 0 })) });
  } catch (e) {
    console.error('ListQuizzes', e);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const getQuiz = (req: AuthRequest, res: Response) => {
  try {
    const row = get('SELECT * FROM quizzes WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: 'Квиз не найден' });
    res.json({ success: true, data: shapeQuiz(row) });
  } catch (e) {
    console.error('GetQuiz', e);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createQuiz = (req: AuthRequest, res: Response) => {
  try {
    const {
      title, description = '', organizer = '', imageUrl = null,
      status = 'draft', startsAt = null, endsAt = null, afterEndText = '',
    } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, error: 'Название обязательно' });
    }
    const id = uuidv4();
    const publicSlug = slugify(title);
    run(`INSERT INTO quizzes (id, title, description, organizer, imageUrl, publicSlug, status, startsAt, endsAt, afterEndText, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, String(title).trim(), description, organizer, imageUrl, publicSlug, status, startsAt, endsAt, afterEndText, req.user!.id]);
    const row = get('SELECT * FROM quizzes WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: shapeQuiz(row) });
  } catch (e) {
    console.error('CreateQuiz', e);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateQuiz = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const b = req.body || {};
    const row = get('SELECT * FROM quizzes WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ success: false, error: 'Квиз не найден' });

    const fields = ['title', 'description', 'organizer', 'imageUrl', 'status', 'startsAt', 'endsAt', 'afterEndText', 'publicSlug'] as const;
    const updates: string[] = [];
    const params: any[] = [];
    for (const f of fields) {
      if (b[f] !== undefined) { updates.push(`${f} = ?`); params.push(b[f]); }
    }
    if (!updates.length) return res.json({ success: true, data: shapeQuiz(row) });
    updates.push("updatedAt = datetime('now')");
    params.push(id);
    run(`UPDATE quizzes SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, data: shapeQuiz(get('SELECT * FROM quizzes WHERE id = ?', [id])) });
  } catch (e) {
    console.error('UpdateQuiz', e);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteQuiz = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    transaction(() => {
      const qs = query('SELECT id FROM quiz_questions WHERE quizId = ?', [id]) as any[];
      for (const q of qs) {
        run('DELETE FROM quiz_options WHERE questionId = ?', [q.id]);
        run('DELETE FROM quiz_answers WHERE questionId = ?', [q.id]);
      }
      run('DELETE FROM quiz_answers WHERE participantId IN (SELECT id FROM quiz_participants WHERE quizId = ?)', [id]);
      run('DELETE FROM quiz_participants WHERE quizId = ?', [id]);
      run('DELETE FROM quiz_questions WHERE quizId = ?', [id]);
      run('DELETE FROM quizzes WHERE id = ?', [id]);
    });
    res.json({ success: true });
  } catch (e) {
    console.error('DeleteQuiz', e);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const duplicateQuiz = (req: AuthRequest, res: Response) => {
  try {
    const src = get('SELECT * FROM quizzes WHERE id = ?', [req.params.id]);
    if (!src) return res.status(404).json({ success: false, error: 'Квиз не найден' });
    const newId = uuidv4();
    const publicSlug = slugify(`${src.title} copy`);
    transaction(() => {
      run(`INSERT INTO quizzes (id, title, description, organizer, imageUrl, publicSlug, status, startsAt, endsAt, afterEndText, createdBy)
           VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL, NULL, ?, ?)`,
        [newId, `${src.title} (копия)`, src.description, src.organizer, src.imageUrl, publicSlug, src.afterEndText, req.user!.id]);
      const qs = query('SELECT * FROM quiz_questions WHERE quizId = ? ORDER BY position', [src.id]) as any[];
      for (const q of qs) {
        const nq = uuidv4();
        run('INSERT INTO quiz_questions (id, quizId, type, text, imageUrl, points, position, correctText) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [nq, newId, q.type, q.text, q.imageUrl, q.points, q.position, (q as any).correctText || '']);
        const opts = query('SELECT * FROM quiz_options WHERE questionId = ? ORDER BY position', [q.id]) as any[];
        for (const o of opts) {
          run('INSERT INTO quiz_options (id, questionId, text, imageUrl, isCorrect, position) VALUES (?, ?, ?, ?, ?, ?)',
            [uuidv4(), nq, o.text, o.imageUrl, o.isCorrect, o.position]);
        }
      }
    });
    res.status(201).json({ success: true, data: shapeQuiz(get('SELECT * FROM quizzes WHERE id = ?', [newId])) });
  } catch (e) {
    console.error('DuplicateQuiz', e);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const saveQuestions = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { questions = [] } = req.body || {};
    const quiz = get('SELECT id FROM quizzes WHERE id = ?', [id]);
    if (!quiz) return res.status(404).json({ success: false, error: 'Квиз не найден' });

    transaction(() => {
      // wipe + replace (builder saves whole set)
      const old = query('SELECT id FROM quiz_questions WHERE quizId = ?', [id]) as any[];
      for (const q of old) {
        run('DELETE FROM quiz_options WHERE questionId = ?', [q.id]);
        run('DELETE FROM quiz_answers WHERE questionId = ?', [q.id]);
      }
      run('DELETE FROM quiz_questions WHERE quizId = ?', [id]);
      questions.forEach((q: any, qi: number) => {
        const qid = uuidv4();
        run('INSERT INTO quiz_questions (id, quizId, type, text, imageUrl, points, position, correctText) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [qid, id, q.type === 'open' ? 'open' : 'choice', String(q.text || ''), q.imageUrl || null, Number(q.points) || 1, qi, String(q.correctText || '')]);
        (q.options || []).forEach((o: any, oi: number) => {
          run('INSERT INTO quiz_options (id, questionId, text, imageUrl, isCorrect, position) VALUES (?, ?, ?, ?, ?, ?)',
            [uuidv4(), qid, String(o.text || ''), o.imageUrl || null, o.isCorrect ? 1 : 0, oi]);
        });
      });
    });

    res.json({ success: true, data: shapeQuiz(get('SELECT * FROM quizzes WHERE id = ?', [id])) });
  } catch (e) {
    console.error('SaveQuestions', e);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const listResults = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const rows = query(`
      SELECT * FROM quiz_participants WHERE quizId = ?
      ORDER BY score DESC, durationMs ASC, finishedAt ASC
    `, [id]);
    res.json({ success: true, data: rows });
  } catch (e) {
    console.error('ListResults', e);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const exportResultsPdf = (req: AuthRequest, res: Response) => {
  try {
    const quiz = get('SELECT * FROM quizzes WHERE id = ?', [req.params.id]);
    if (!quiz) return res.status(404).json({ success: false, error: 'Квиз не найден' });
    const rows = query(`
      SELECT * FROM quiz_participants WHERE quizId = ?
      ORDER BY score DESC, durationMs ASC, finishedAt ASC
    `, [quiz.id]) as any[];

    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const trs = rows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(r.lastName)} ${esc(r.firstName)} ${esc(r.patronymic || '')}</td>
        <td>${esc(r.phone || '')}</td>
        <td>${esc(r.email || '')}</td>
        <td><b>${r.score}/${r.totalPoints}</b></td>
        <td>${Math.round((r.durationMs || 0) / 1000)} с</td>
        <td>${r.finishedAt ? esc(new Date(r.finishedAt).toLocaleString('ru-RU')) : '—'}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>${esc(quiz.title)} — итоги</title>
<style>
  body{font-family:Arial,sans-serif;margin:28px;color:#111;font-size:12px}
  h1{font-size:18px;margin:0 0 6px}
  .sub{color:#555;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
  th{background:#f3f4f6;font-size:10px;text-transform:uppercase}
  .footer{margin-top:18px;color:#888;font-size:10px}
</style></head><body>
  <h1>${esc(quiz.title)}</h1>
  <div class="sub">Организатор: ${esc(quiz.organizer || '—')} · участников: ${rows.length}</div>
  <table>
    <thead><tr><th>#</th><th>Участник</th><th>Телефон</th><th>Email</th><th>Балл</th><th>Время</th><th>Финиш</th></tr></thead>
    <tbody>${trs || '<tr><td colspan="7">нет данных</td></tr>'}</tbody>
  </table>
  <div class="footer">NEXUS CRM · ${new Date().toLocaleString('ru-RU')}</div>
  <script>window.onload = () => window.print();</script>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    console.error('ExportResultsPdf', e);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

/* ── Public API ── */

export const getPublicQuiz = (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug;
    const row = get('SELECT * FROM quizzes WHERE publicSlug = ?', [slug]) || get('SELECT * FROM quizzes WHERE id = ?', [slug]);
    if (!row) return res.status(404).json({ success: false, error: 'Квиз не найден' });

    const now = new Date();
    const starts = row.startsAt ? new Date(row.startsAt) : null;
    const ends = row.endsAt ? new Date(row.endsAt) : null;
    let phase: 'upcoming' | 'open' | 'finished' = 'open';
    if (starts && now.getTime() + 2000 < starts.getTime()) phase = 'upcoming';
    if (ends && now.getTime() > ends.getTime()) phase = 'finished';
    if (row.status === 'draft') phase = 'upcoming';

    const questions = query('SELECT id, type, text, imageUrl, points, position FROM quiz_questions WHERE quizId = ? ORDER BY position', [row.id]) as any[];
    const shaped = questions.map((q) => ({
      ...q,
      options: query('SELECT id, text, imageUrl, position FROM quiz_options WHERE questionId = ? ORDER BY position', [q.id]),
    }));

    res.json({
      success: true,
      data: {
        id: row.id,
        title: row.title,
        description: row.description,
        organizer: row.organizer,
        imageUrl: row.imageUrl,
        publicSlug: row.publicSlug,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        afterEndText: row.afterEndText,
        phase,
        questions: phase === 'finished' ? [] : shaped,
        questionCount: questions.length,
      },
    });
  } catch (e) {
    console.error('GetPublicQuiz', e);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

function gradeQuestion(q: any, answer: any): { isCorrect: boolean; points: number } {
  const pts = Number(q.points) || 1;
  if (q.type === 'open') {
    const text = String(answer?.answerText || '').trim().toLowerCase();
    if (!text) return { isCorrect: false, points: 0 };
    // open: full points if not empty (manual grade later); auto-match list in q.correctText optional
    const correct = String((q as any).correctText || '').trim().toLowerCase();
    if (correct) {
      const ok = correct.split('|').some((c: string) => text === c.trim() || text.includes(c.trim()));
      return { isCorrect: ok, points: ok ? pts : 0 };
    }
    return { isCorrect: true, points: pts };
  }
  const selected: string[] = Array.isArray(answer?.selectedOptionIds) ? answer.selectedOptionIds : [];
  const options = query('SELECT id, isCorrect FROM quiz_options WHERE questionId = ?', [q.id]) as any[];
  const correctIds = options.filter((o) => o.isCorrect).map((o) => o.id).sort();
  const sel = [...selected].sort();
  const ok = correctIds.length === sel.length && correctIds.every((id, i) => id === sel[i]);
  return { isCorrect: ok, points: ok ? pts : 0 };
}

export const submitQuiz = (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const quiz = get('SELECT * FROM quizzes WHERE publicSlug = ?', [slug]) || get('SELECT * FROM quizzes WHERE id = ?', [slug]);
    if (!quiz) return res.status(404).json({ success: false, error: 'Квиз не найден' });

    const now = Date.now();
    if (quiz.startsAt && now + 2000 < new Date(quiz.startsAt).getTime()) {
      return res.status(400).json({ success: false, error: 'Квиз ещё не начался' });
    }
    if (quiz.endsAt && now > new Date(quiz.endsAt).getTime()) {
      return res.status(400).json({ success: false, error: 'Квиз завершён' });
    }

    const {
      participantId, lastName, firstName, patronymic = '', phone = '', email = '',
      consent = true, answers = [], deviceId = '',
    } = req.body || {};
    if (!consent) return res.status(400).json({ success: false, error: 'Нужно согласие на обработку ПД' });
    if (!lastName || !firstName) return res.status(400).json({ success: false, error: 'Фамилия и имя обязательны' });

    const dev = String(deviceId || '').trim().slice(0, 64);
    if (dev) {
      const dup = get('SELECT id FROM quiz_participants WHERE quizId = ? AND deviceId = ?', [quiz.id, dev]);
      if (dup) return res.status(400).json({ success: false, error: 'Вы уже проходили этот квиз' });
    }

    const questions = query('SELECT * FROM quiz_questions WHERE quizId = ?', [quiz.id]) as any[];
    let score = 0;
    let totalPoints = 0;
    const graded: any[] = [];
    for (const q of questions) {
      totalPoints += Number(q.points) || 1;
      const a = answers.find((x: any) => x.questionId === q.id) || {};
      const g = gradeQuestion(q, a);
      score += g.points;
      graded.push({ questionId: q.id, answerText: a.answerText || '', selectedOptionIds: a.selectedOptionIds || [], ...g });
    }

    const consentIp = (req.ip || req.socket?.remoteAddress || '').toString().slice(0, 64);
    let pid = participantId;
    let participant = pid ? get('SELECT * FROM quiz_participants WHERE id = ?', [pid]) : null;

    if (!participant) {
      pid = uuidv4();
      run(`INSERT INTO quiz_participants
        (id, quizId, lastName, firstName, patronymic, phone, email, consent, consentAt, consentIp, startedAt, finishedAt, score, totalPoints, durationMs, deviceId)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), ?, datetime('now'), datetime('now'), ?, ?, 0, ?)`,
        [pid, quiz.id, lastName, firstName, patronymic, phone, email, consentIp, score, totalPoints, dev || null]);
    } else {
      const durationMs = participant.startedAt
        ? Date.now() - new Date(participant.startedAt).getTime()
        : 0;
      run(`UPDATE quiz_participants SET finishedAt = datetime('now'), score = ?, totalPoints = ?, durationMs = ? WHERE id = ?`,
        [score, totalPoints, durationMs, pid]);
    }

    for (const g of graded) {
      run(`INSERT INTO quiz_answers (id, participantId, questionId, answerText, selectedOptionIds, isCorrect, points, answeredAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [uuidv4(), pid, g.questionId, g.answerText, JSON.stringify(g.selectedOptionIds), g.isCorrect ? 1 : 0, g.points]);
    }

    const rank = query(`SELECT id FROM quiz_participants WHERE quizId = ? AND score > ? ORDER BY score DESC, durationMs ASC`, [quiz.id, score]).length + 1;

    res.status(201).json({
      success: true,
      data: {
        participantId: pid,
        score, totalPoints,
        rank,
        afterEndText: quiz.afterEndText,
      },
    });
  } catch (e) {
    console.error('SubmitQuiz', e);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const startQuiz = (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const quiz = get('SELECT * FROM quizzes WHERE publicSlug = ?', [slug]) || get('SELECT * FROM quizzes WHERE id = ?', [slug]);
    if (!quiz) return res.status(404).json({ success: false, error: 'Квиз не найден' });
    const { lastName, firstName, patronymic = '', phone = '', email = '', consent = true, deviceId = '' } = req.body || {};
    if (!consent) return res.status(400).json({ success: false, error: 'Нужно согласие' });
    if (!lastName || !firstName) return res.status(400).json({ success: false, error: 'Фамилия и имя обязательны' });

    const dev = String(deviceId || '').trim().slice(0, 64);
    if (dev) {
      const dup = get('SELECT id, startedAt FROM quiz_participants WHERE quizId = ? AND deviceId = ?', [quiz.id, dev]);
      if (dup) {
        return res.json({ success: true, data: { participantId: dup.id, startedAt: dup.startedAt, resumed: true } });
      }
    }

    const id = uuidv4();
    const consentIp = (req.ip || req.socket?.remoteAddress || '').toString().slice(0, 64);
    run(`INSERT INTO quiz_participants (id, quizId, lastName, firstName, patronymic, phone, email, consent, consentAt, consentIp, startedAt, deviceId)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), ?, datetime('now'), ?)`,
      [id, quiz.id, lastName, firstName, patronymic, phone, email, consentIp, dev || null]);
    res.status(201).json({ success: true, data: { participantId: id, startedAt: new Date().toISOString() } });
  } catch (e) {
    console.error('StartQuiz', e);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const getPublicResults = (req: AuthRequest, res: Response) => {
  try {
    const slug = req.params.slug;
    const quiz = get('SELECT * FROM quizzes WHERE publicSlug = ?', [slug]) || get('SELECT * FROM quizzes WHERE id = ?', [slug]);
    if (!quiz) return res.status(404).json({ success: false, error: 'Квиз не найден' });
    const rows = query(`
      SELECT id, lastName, firstName, patronymic, score, totalPoints, durationMs, finishedAt
      FROM quiz_participants WHERE quizId = ?
      ORDER BY score DESC, durationMs ASC
    `, [quiz.id]);
    res.json({ success: true, data: rows });
  } catch (e) {
    console.error('GetPublicResults', e);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
