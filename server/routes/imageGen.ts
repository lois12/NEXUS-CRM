import { Router, Response } from 'express';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { get, run, query } from '../db/database';
import { generateImageBuffer, hasCloudflare } from '../utils/imageGenProviders';

const router = Router();

const MONTHLY_LIMIT = 100;

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
  try {
    const { prompt, style, provider, width, height } = req.body;
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

    const styleSuffix = stylePrompts[style || 'cyberpunk'] || stylePrompts.cyberpunk;
    const fullPrompt = `${prompt}, ${styleSuffix}`;

    const { buf, provider: used } = await generateImageBuffer(fullPrompt, {
      width: Number(width) || 1024,
      height: Number(height) || 1024,
      provider: provider === 'cloudflare' || provider === 'pollinations' ? provider : undefined,
    });

    // Log generation
    const month = getCurrentMonth();
    run('INSERT INTO image_gen_log (id, userId, month) VALUES (?, ?, ?)', [crypto.randomUUID(), userId, month]);

    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    const mime = isPng ? 'image/png' : 'image/jpeg';
    const base64 = buf.toString('base64');
    const remaining = isSuperAdmin ? -1 : MONTHLY_LIMIT - getMonthlyCount(userId, month);

    res.json({
      image: `data:${mime};base64,${base64}`,
      provider: used,
      cloudflareConfigured: hasCloudflare(),
      remaining,
      limit: isSuperAdmin ? 'unlimited' : MONTHLY_LIMIT,
    });
  } catch (err: any) {
    console.error('Image gen error:', err);
    res.status(500).json({ error: 'Ошибка генерации изображения', detail: err?.message });
  }
});

/** Provider status for UI */
router.get('/image-providers', authenticateToken, (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      cloudflare: hasCloudflare(),
      pollinations: true,
    },
  });
});

export default router;
