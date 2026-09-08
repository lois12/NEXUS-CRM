import { Router, Response } from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { get, query } from '../db/database';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { DB_PATH, UPLOADS_DIR } from '../paths';

const router = Router();

// Maintenance mode — public, no auth
let maintenanceMode = false;

router.get('/maintenance', (req, res) => {
  res.json({ success: true, data: { active: maintenanceMode } });
});

// All other routes require auth
router.use(authenticateToken);

router.post('/maintenance/toggle', requireRole('super_admin'), (req: AuthRequest, res: Response) => {
  maintenanceMode = !maintenanceMode;
  res.json({ success: true, data: { active: maintenanceMode } });
});

const startTime = Date.now();

router.get('/stats', (req: AuthRequest, res: Response) => {
  try {
    const totalUsers = get('SELECT COUNT(*) as count FROM users');
    const totalPosts = get('SELECT COUNT(*) as count FROM content_posts');
    const totalMaterials = get('SELECT COUNT(*) as count FROM materials');
    const publishedPosts = get("SELECT COUNT(*) as count FROM content_posts WHERE status = 'опубликован'");
    const scheduledPosts = get("SELECT COUNT(*) as count FROM content_posts WHERE status = 'запланирован'");

    const recentActivities = query(`
      SELECT a.*, u.fullName as userName, u.avatar as userAvatar
      FROM activities a
      LEFT JOIN users u ON a.userId = u.id
      ORDER BY a.createdAt DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        totalUsers: totalUsers?.count || 0,
        totalPosts: totalPosts?.count || 0,
        totalMaterials: totalMaterials?.count || 0,
        publishedPosts: publishedPosts?.count || 0,
        scheduledPosts: scheduledPosts?.count || 0,
        recentActivities,
      },
    });
  } catch (error) {
    console.error('GetDashboardStats error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Analytics — posts by day (last 7 days)
router.get('/analytics/posts-by-day', (req: AuthRequest, res: Response) => {
  try {
    const rows = query(`
      SELECT DATE(createdAt) as date, COUNT(*) as count
      FROM content_posts
      WHERE createdAt >= datetime('now', '-7 days')
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `);
    // Fill in missing days
    const days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = rows.find((r: any) => r.date === dateStr);
      days.push({ date: dateStr, count: found?.count || 0 });
    }
    res.json({ success: true, data: days });
  } catch (error) {
    console.error('PostsByDay error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Analytics — posts by platform
router.get('/analytics/by-platform', (req: AuthRequest, res: Response) => {
  try {
    const rows = query(`
      SELECT platform, COUNT(*) as count
      FROM content_posts
      GROUP BY platform
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('ByPlatform error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Analytics — posts by status
router.get('/analytics/by-status', (req: AuthRequest, res: Response) => {
  try {
    const rows = query(`
      SELECT status, COUNT(*) as count
      FROM content_posts
      GROUP BY status
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('ByStatus error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Server health — super_admin only
router.get('/health', requireRole('super_admin'), (req: AuthRequest, res: Response) => {
  try {
    const uptimeMs = Date.now() - startTime;
    const uptimeSec = Math.floor(uptimeMs / 1000);
    const uptimeMin = Math.floor(uptimeSec / 60);
    const uptimeHrs = Math.floor(uptimeMin / 60);
    const uptimeDays = Math.floor(uptimeHrs / 24);

    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    // DB size
    let dbSize = 0;
    try { dbSize = fs.statSync(DB_PATH).size; } catch {}

    // Uploads size
    let uploadsSize = 0;
    let uploadsCount = 0;
    try {
      const files = fs.readdirSync(UPLOADS_DIR);
      uploadsCount = files.length;
      uploadsSize = files.reduce((sum, f) => {
        try { return sum + fs.statSync(path.join(UPLOADS_DIR, f)).size; } catch { return sum; }
      }, 0);
    } catch {}

    // Table counts
    const tables = [
      'users', 'content_posts', 'materials', 'ideas', 'kanban_tasks',
      'partners', 'vacations', 'inventory', 'events', 'projects',
      'knowledge_base', 'brand_assets', 'chat_messages', 'chat_conversations',
    ];
    const tableStats: Record<string, number> = {};
    for (const t of tables) {
      try { tableStats[t] = get(`SELECT COUNT(*) as count FROM ${t}`)?.count || 0; } catch { tableStats[t] = 0; }
    }

    res.json({
      success: true,
      data: {
        uptime: {
          ms: uptimeMs,
          formatted: `${uptimeDays}д ${uptimeHrs % 24}ч ${uptimeMin % 60}м ${uptimeSec % 60}с`,
        },
        memory: {
          rss: memUsage.rss,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          systemTotal: totalMem,
          systemFree: freeMem,
          systemUsed: totalMem - freeMem,
        },
        cpu: {
          model: os.cpus()[0]?.model || 'Unknown',
          cores: os.cpus().length,
          loadAvg: os.loadavg(),
        },
        database: {
          size: dbSize,
          tables: tableStats,
        },
        uploads: {
          count: uploadsCount,
          size: uploadsSize,
        },
        platform: {
          os: os.platform(),
          arch: os.arch(),
          hostname: os.hostname(),
          nodeVersion: process.version,
        },
      },
    });
  } catch (error) {
    console.error('GetHealth error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

export default router;
