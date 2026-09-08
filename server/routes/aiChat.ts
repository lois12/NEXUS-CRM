import { Router, Response } from 'express';
import https from 'https';
import crypto from 'crypto';
import { GIGACHAT_API_KEY } from '../config';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { query } from '../db/database';

const router = Router();

// TLS verification disabled only for GigaChat API (self-signed cert)
const gigachatAgent = new https.Agent({ rejectUnauthorized: false });

function httpsRequest(options: https.RequestOptions, body?: string): Promise<{ status: number; headers: any; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const opts = { ...options, agent: options.agent || gigachatAgent };
    const req = https.request(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getToken(): Promise<string> {
  const res = await httpsRequest({
    hostname: 'ngw.devices.sberbank.ru',
    port: 9443,
    path: '/api/v2/oauth',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'Authorization': 'Basic ' + GIGACHAT_API_KEY,
      'RqUID': crypto.randomUUID(),
    },
  }, 'scope=GIGACHAT_API_PERS');

  if (res.status !== 200) {
    throw new Error(`OAuth failed: ${res.status}`);
  }

  const json = JSON.parse(res.body.toString());
  return json.access_token;
}

function getNexusContext(): string {
  const parts: string[] = [];

  try {
    // Tasks from Kanban
    const tasks = query("SELECT title, status, priority FROM kanban_tasks ORDER BY createdAt DESC LIMIT 10");
    if (tasks.length > 0) {
      const taskList = tasks.map((t: any) => `- ${t.title} [${t.status}] ${t.priority ? '(' + t.priority + ')' : ''}`).join('\n');
      parts.push(`ЗАДАЧИ (Kanban):\n${taskList}`);
    }
  } catch {}

  try {
    // Content plan - upcoming posts
    const posts = query("SELECT title, platform, status, scheduledDate FROM content_posts WHERE status != 'опубликовано' ORDER BY scheduledDate ASC LIMIT 5");
    if (posts.length > 0) {
      const postList = posts.map((p: any) => `- ${p.title} [${p.platform}] ${p.status} ${p.scheduledDate || ''}`).join('\n');
      parts.push(`КОНТЕНТ-ПЛАН (ближайшие):\n${postList}`);
    }
  } catch {}

  try {
    // Partners
    const partners = query("SELECT name, status FROM partners ORDER BY createdAt DESC LIMIT 5");
    if (partners.length > 0) {
      const partnerList = partners.map((p: any) => `- ${p.name} [${p.status}]`).join('\n');
      parts.push(`ПАРТНЁРЫ:\n${partnerList}`);
    }
  } catch {}

  try {
    // Active projects
    const projects = query("SELECT title, status FROM projects WHERE status != 'завершён' ORDER BY createdAt DESC LIMIT 5");
    if (projects.length > 0) {
      const projectList = projects.map((p: any) => `- ${p.title} [${p.status}]`).join('\n');
      parts.push(`ПРОЕКТЫ:\n${projectList}`);
    }
  } catch {}

  try {
    // Events
    const events = query("SELECT title, date, status FROM events ORDER BY date ASC LIMIT 5");
    if (events.length > 0) {
      const eventList = events.map((e: any) => `- ${e.title} ${e.date || ''} [${e.status}]`).join('\n');
      parts.push(`МЕРОПРИЯТИЯ:\n${eventList}`);
    }
  } catch {}

  try {
    // Online users count
    const users = query("SELECT COUNT(*) as count FROM users");
    if (users.length > 0) {
      parts.push(`ПОЛЬЗОВАТЕЛЕЙ В СИСТЕМЕ: ${users[0].count}`);
    }
  } catch {}

  return parts.join('\n\n');
}

// POST /api/ai-chat
router.post('/ai-chat', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    // Build context-aware system message
    const nexusContext = getNexusContext();
    const contextBlock = nexusContext
      ? `\n\nАКТУАЛЬНЫЕ ДАННЫЕ NEXUS CRM:\n${nexusContext}\n\nИспользуй эти данные для ответов о задачах, контенте, партнёрах и проектах.`
      : '';

    // Inject context into system message
    const messagesWithContext = messages.map((m: any, i: number) => {
      if (i === 0 && m.role === 'system') {
        return { ...m, content: m.content + contextBlock };
      }
      return m;
    });

    const token = await getToken();

    const chatRes = await httpsRequest({
      hostname: 'api.giga.chat',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
    }, JSON.stringify({
      model: 'GigaChat-3-Ultra',
      messages: messagesWithContext,
    }));

    if (chatRes.status !== 200) {
      return res.status(chatRes.status).json({ error: 'GigaChat error', details: chatRes.body.toString().substring(0, 300) });
    }

    const chatJson = JSON.parse(chatRes.body.toString());
    const reply = chatJson.choices?.[0]?.message?.content || 'Нет ответа';

    res.json({ reply });
  } catch (err: any) {
    console.error('AI Chat error:', err);
    res.status(500).json({ error: 'Ошибка AI-сервиса' });
  }
});

export default router;
