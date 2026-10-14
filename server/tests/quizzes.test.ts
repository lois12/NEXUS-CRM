import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { setupTestDb, adminTokenPayload, TEST_ADMIN_ID } from './helpers/testDb';
import { run, get } from '../db/database';
import {
  getPublicQuiz, startQuiz, submitQuiz, createQuiz, listResults, deleteResult,
} from '../controllers/quizController';

const app = express();
app.use(express.json());
app.post('/api/quizzes', (req, res, next) => {
  (req as any).user = adminTokenPayload();
  next();
}, createQuiz as any);
app.get('/api/quizzes/public/:slug', getPublicQuiz as any);
app.post('/api/quizzes/public/:slug/start', startQuiz as any);
app.post('/api/quizzes/public/:slug/submit', submitQuiz as any);
app.get('/api/quizzes/:id/results', (req, res, next) => {
  (req as any).user = adminTokenPayload();
  next();
}, listResults as any);
app.delete('/api/quizzes/:id/results/:participantId', (req, res, next) => {
  (req as any).user = adminTokenPayload();
  next();
}, deleteResult as any);

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

function seedQuiz(id: string, status: string, startsAt: string | null = null, endsAt: string | null = null) {
  run(`INSERT INTO quizzes (id, title, publicSlug, status, startsAt, endsAt, createdBy)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, `Quiz ${id}`, `slug-${id}`, status, startsAt, endsAt, TEST_ADMIN_ID]);
  run(`INSERT INTO quiz_questions (id, quizId, type, text, points, position, correctText)
       VALUES (?, ?, 'open', 'Q1', 1, 0, '')`, [`q-${id}`, id]);
}

beforeAll(() => {
  setupTestDb();
  process.env.JWT_SECRET = JWT_SECRET;
});

describe('Public quiz statuses', () => {
  it('draft — 404', async () => {
    seedQuiz('draft1', 'draft');
    const res = await request(app).get('/api/quizzes/public/slug-draft1?deviceId=dev-a');
    expect(res.status).toBe(404);
  });

  it('scheduled + startsAt future — upcoming (timer)', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    seedQuiz('sch1', 'scheduled', future);
    const res = await request(app).get('/api/quizzes/public/slug-sch1?deviceId=dev-b');
    expect(res.status).toBe(200);
    expect(res.body.data.phase).toBe('upcoming');
  });

  it('conducted — finished («мероприятие завершено»)', async () => {
    seedQuiz('cond1', 'conducted');
    const res = await request(app).get('/api/quizzes/public/slug-cond1?deviceId=dev-c');
    expect(res.status).toBe(200);
    expect(res.body.data.phase).toBe('finished');
  });

  it('conducted blocks start', async () => {
    seedQuiz('cond2', 'conducted');
    const res = await request(app)
      .post('/api/quizzes/public/slug-cond2/start')
      .send({ lastName: 'И', firstName: 'О', consent: true, deviceId: 'dev-d' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/завершено/i);
  });
});

describe('One attempt per device', () => {
  it('start then refresh GET → alreadyParticipated', async () => {
    seedQuiz('once1', 'scheduled', null, null);
    const start = await request(app)
      .post('/api/quizzes/public/slug-once1/start')
      .send({ lastName: 'Иванов', firstName: 'Иван', consent: true, deviceId: 'dev-once' });
    expect(start.status).toBe(201);

    const get1 = await request(app).get('/api/quizzes/public/slug-once1?deviceId=dev-once');
    expect(get1.body.data.alreadyParticipated).toBe(true);
    expect(get1.body.data.questions).toEqual([]);
  });

  it('second start from same device — 403', async () => {
    seedQuiz('once2', 'scheduled', null, null);
    await request(app)
      .post('/api/quizzes/public/slug-once2/start')
      .send({ lastName: 'И', firstName: 'О', consent: true, deviceId: 'dev-2' });
    const again = await request(app)
      .post('/api/quizzes/public/slug-once2/start')
      .send({ lastName: 'И', firstName: 'О', consent: true, deviceId: 'dev-2' });
    expect(again.status).toBe(403);
    expect(again.body.error).toMatch(/уже приняли участие/i);
  });

  it('submit without start from new device is allowed once; second submit — 403', async () => {
    seedQuiz('once3', 'scheduled', null, null);
    const s1 = await request(app)
      .post('/api/quizzes/public/slug-once3/submit')
      .send({
        lastName: 'Т', firstName: 'Т', consent: true, deviceId: 'dev-3',
        answers: [{ questionId: 'q-once3', answerText: 'ok', selectedOptionIds: [] }],
      });
    expect(s1.status).toBe(201);

    const s2 = await request(app)
      .post('/api/quizzes/public/slug-once3/submit')
      .send({
        lastName: 'Т', firstName: 'Т', consent: true, deviceId: 'dev-3',
        answers: [{ questionId: 'q-once3', answerText: 'ok', selectedOptionIds: [] }],
      });
    expect(s2.status).toBe(403);
    expect(s2.body.error).toMatch(/уже приняли участие/i);
  });

  it('submit after start with matching participantId completes', async () => {
    seedQuiz('once4', 'scheduled', null, null);
    const start = await request(app)
      .post('/api/quizzes/public/slug-once4/start')
      .send({ lastName: 'К', firstName: 'К', consent: true, deviceId: 'dev-4' });
    const pid = start.body.data.participantId;

    const done = await request(app)
      .post('/api/quizzes/public/slug-once4/submit')
      .send({
        participantId: pid,
        lastName: 'К', firstName: 'К', consent: true, deviceId: 'dev-4',
        answers: [{ questionId: 'q-once4', answerText: 'ок', selectedOptionIds: [] }],
      });
    expect(done.status).toBe(201);
  });
});

describe('Delete participant (admin)', () => {
  it('removes participant + answers; device can pass again', async () => {
    seedQuiz('del1', 'scheduled', null, null);
    const start = await request(app)
      .post('/api/quizzes/public/slug-del1/start')
      .send({ lastName: 'Тест', firstName: 'Тест', consent: true, deviceId: 'dev-del' });
    const pid = start.body.data.participantId;

    await request(app)
      .post('/api/quizzes/public/slug-del1/submit')
      .send({
        participantId: pid,
        lastName: 'Тест', firstName: 'Тест', consent: true, deviceId: 'dev-del',
        answers: [{ questionId: 'q-del1', answerText: 'тест', selectedOptionIds: [] }],
      });

    const list1 = await request(app).get('/api/quizzes/del1/results');
    expect(list1.body.data).toHaveLength(1);

    const del = await request(app).delete(`/api/quizzes/del1/results/${pid}`);
    expect(del.status).toBe(200);

    const list2 = await request(app).get('/api/quizzes/del1/results');
    expect(list2.body.data).toHaveLength(0);
    expect(get('SELECT id FROM quiz_answers WHERE participantId = ?', [pid])).toBeFalsy();

    // после удаления тестовой позиции можно пройти заново
    const again = await request(app)
      .post('/api/quizzes/public/slug-del1/start')
      .send({ lastName: 'Тест2', firstName: 'Тест2', consent: true, deviceId: 'dev-del' });
    expect(again.status).toBe(201);
  });

  it('404 for unknown participant', async () => {
    seedQuiz('del2', 'scheduled', null, null);
    const del = await request(app).delete('/api/quizzes/del2/results/nope');
    expect(del.status).toBe(404);
  });
});
