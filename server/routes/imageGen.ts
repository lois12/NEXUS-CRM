import { Router, Response } from 'express';
import https from 'https';
import crypto from 'crypto';
import { GIGACHAT_API_KEY } from '../config';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { get, run, query } from '../db/database';

const router = Router();

// TLS verification disabled only for GigaChat API (self-signed cert)
const gigachatAgent = new https.Agent({ rejectUnauthorized: false });

const MONTHLY_LIMIT = 100;

function httpsRequest(options: https.RequestOptions, body?: string): Promise<{ status: number; headers: any; body: Buffer }> {
  return new Promise((resolve, reject) => {
    // Always use gigachatAgent for GigaChat API (self-signed cert)
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
    throw new Error(`OAuth failed: ${res.status} ${res.body.toString().substring(0, 200)}`);
  }

  const json = JSON.parse(res.body.toString());
  if (!json.access_token) {
    throw new Error('No access_token in response');
  }
  return json.access_token;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthlyCount(userId: string, month: string): number {
  const row = get('SELECT COUNT(*) as count FROM image_gen_log WHERE userId = ? AND month = ?', [userId, month]);
  return row?.count || 0;
}

// POST /api/generate-image
router.post('/generate-image', authenticateToken, async (req: AuthRequest, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  try {
    const { prompt, style } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const userId = req.user!.id;
    const userRoles = req.user!.roles || [req.user!.role];
    const isSuperAdmin = userRoles.includes('super_admin');

    // Check monthly limit (skip for super_admin)
    if (!isSuperAdmin) {
      const month = getCurrentMonth();
      const count = getMonthlyCount(userId, month);
      if (count >= MONTHLY_LIMIT) {
        return res.status(429).json({
          error: `Лимит исчерпан: ${MONTHLY_LIMIT} изображений в месяц. Остаток: 0`,
          limit: MONTHLY_LIMIT,
          used: count,
          remaining: 0,
        });
      }
    }

    const stylePrompts: Record<string, string> = {
      realistic: 'фотореалистичное изображение, высокая детализация, 8k',
      anime: 'в стиле аниме, яркие цвета, японская анимация',
      cyberpunk: 'в стиле киберпанк, неоновые огни, тёмная атмосфера, футуризм',
      cartoon: 'мультяшный стиль, яркий, весёлый, чистые линии',
      watercolor: 'акварельная живопись, мягкие края, текущие краски, текстура бумаги',
      fantasy: 'фэнтези-арт, магия, эпическое свечение, концепт-арт',
      pixel: 'пиксельный арт, ретро-стиль, 16-бит, игровой арт',
      oil_painting: 'масляная живопись, классическое искусство, мазки кисти, ренессанс',
      dark_gothic: 'тёмный готический арт, мрачный, драматичное освещение, тени, мистика',
      minimalism: 'минималистичный дизайн, чистый, простые формы, негативное пространство, современный',
      steampunk: 'стимпанк, латунные шестерни, викторианская эпоха, механика, винтажные технологии',
      vaporwave: 'эстетика вейпорвейв, ретро 80-х, розово-фиолетовый градиент, глитч-арт',
      pencil_sketch: 'карандашный набросок, рисунок от руки, чёрно-белое, детальная штриховка',
      comic: 'стиль комикса, жирные контуры, точки халфтона, динамичный, экшн-арт',
      impressionism: 'импрессионизм, свободные мазки, свет и цвет, стиль Моне',
      synthwave: 'синтвейв, ретро-футуризм, неоновая сетка, закат, эстетика 80-х',
      clay: 'пластилиновый стиль, 3D-рендер, милая пластика, тактильный, стоп-моушн',
      stained_glass: 'витражное окно, цветная мозаика, свинцовые линии',
      ukiyo_e: 'укиё-э, японская гравюра на дереве, традиционный стиль, волны, природа',
      pop_art: 'поп-арт, в стиле Энди Уорхолла, яркие цвета, точки, высокий контраст',
    };

    const systemPrompt = 'Ты — профессиональный художник. Генерируй изображения по описанию пользователя.';
    const fullPrompt = stylePrompts[style || 'cyberpunk']
      ? `${prompt}, ${stylePrompts[style || 'cyberpunk']}`
      : prompt;

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
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Нарисуй: ${fullPrompt}` },
      ],
      function_call: 'auto',
    }));

    if (chatRes.status !== 200) {
      return res.status(chatRes.status).json({ error: 'GigaChat error', details: chatRes.body.toString().substring(0, 500) });
    }

    const chatJson = JSON.parse(chatRes.body.toString());
    const content = chatJson.choices?.[0]?.message?.content || '';

    const match = content.match(/src="([^"]+)"/);
    if (!match) {
      return res.status(500).json({ error: 'No image generated', response: content.substring(0, 300) });
    }

    const fileId = match[1];

    // Download image
    const dlRes = await httpsRequest({
      hostname: 'api.giga.chat',
      path: '/v1/files/' + fileId + '/content',
      method: 'GET',
      headers: {
        'Accept': 'application/jpg',
        'Authorization': 'Bearer ' + token,
      },
    });

    if (dlRes.status !== 200 || dlRes.body.length < 1000) {
      return res.status(500).json({ error: 'Failed to download image' });
    }

    // Log generation
    const month = getCurrentMonth();
    run('INSERT INTO image_gen_log (id, userId, month) VALUES (?, ?, ?)', [crypto.randomUUID(), userId, month]);

    // Return base64
    const base64 = dlRes.body.toString('base64');

    // Send remaining count for non-admins
    const remaining = isSuperAdmin ? -1 : MONTHLY_LIMIT - getMonthlyCount(userId, month);

    res.json({
      image: `data:image/jpeg;base64,${base64}`,
      remaining,
      limit: isSuperAdmin ? 'unlimited' : MONTHLY_LIMIT,
    });
  } catch (err: any) {
    console.error('Image gen error:', err);
    res.status(500).json({ error: 'Ошибка генерации изображения' });
  }
});

export default router;
