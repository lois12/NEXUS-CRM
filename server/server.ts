import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import jwt from 'jsonwebtoken';
import './config';
import { JWT_SECRET } from './config';
import { Server as SocketIOServer } from 'socket.io';
import { initDatabase, get } from './db/database';
import { initializeDatabase } from './db/init';
import { runMigrations } from './db/migrator';
import { startAutoBackup } from './services/autoBackup';
import { PROJECT_ROOT, SERVER_DIR, CLIENT_DIST, UPLOADS_DIR, MODELS_DIR } from './paths';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import contentRoutes from './routes/content';
import materialsRoutes from './routes/materials';
import dashboardRoutes from './routes/dashboard';
import ideasRoutes from './routes/ideas';
import kanbanRoutes from './routes/kanban';
import partnersRoutes from './routes/partners';
import vacationsRoutes from './routes/vacations';
import inventoryRoutes from './routes/inventory';
import eventsRoutes from './routes/events';
import projectsRoutes from './routes/projects';
import knowledgeRoutes from './routes/knowledge';
import brandRoutes from './routes/brand';
import notificationsRoutes from './routes/notifications';
import chatRoutes from './routes/chat';
import imageGenRoutes from './routes/imageGen';
import aiChatRoutes from './routes/aiChat';
import searchRoutes from './routes/search';
import listsRoutes, { publicRouter as publicListsRouter } from './routes/lists';
import converterRoutes from './routes/converter';
import linksRoutes from './routes/links';
import collageRoutes from './routes/collage';
import surveyRoutes, { publicRouter as publicSurveyRouter } from './routes/surveys';
import { redirectLink } from './controllers/shortLinkController';
import qrAuthRoutes from './routes/qrAuth';
import pushRoutes from './routes/push';
import { publicRegRouter, registrationAuthRouter } from './routes/registrations';
import { publicWidgetRouter, widgetAuthRouter } from './routes/widgets';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT: number = Number(process.env.PORT) || 8080;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || true,
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Swagger API docs
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NEXUS CRM API',
      version: '2.12.0',
      description: 'API для CRM системы NEXUS',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [path.join(SERVER_DIR, 'routes', '*.ts'), path.join(SERVER_DIR, 'controllers', '*.ts')],
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customCss: '.swagger-ui .topbar { display: none }', customSiteTitle: 'NEXUS CRM API' }));
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

// Static files for uploads (cache 1 day)
// Security headers: nosniff stops browsers from MIME-sniffing uploaded files
// into executable content (stored XSS mitigation — combined with server-side
// extension allowlist in upload.ts)
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  next();
}, express.static(UPLOADS_DIR, { maxAge: '1d', etag: true }));

// Serve frontend in production (cache hashed assets aggressively, no cache for HTML)
app.use(express.static(CLIENT_DIST, {
  maxAge: '7d',
  etag: true,
  index: 'index.html',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// Serve ML models (cache 30 days — large files)
app.use('/models', express.static(MODELS_DIR, { maxAge: '30d', etag: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ideas', ideasRoutes);
app.use('/api/kanban', kanbanRoutes);
app.use('/api/partners', partnersRoutes);
app.use('/api/vacations', vacationsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/brand', brandRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api', imageGenRoutes);
app.use('/api', aiChatRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/qr-auth', qrAuthRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/registrations', registrationAuthRouter);
app.use('/api', publicRegRouter);
app.use('/api/widgets', widgetAuthRouter);
app.use('/api', publicWidgetRouter);
app.use('/api', publicListsRouter);
app.use('/api/lists', listsRoutes);
app.use('/api/converter', converterRoutes);
app.use('/api/links', linksRoutes);
app.use('/api/collage', collageRoutes);
app.use('/api', publicSurveyRouter);
app.use('/api/surveys', surveyRoutes);

// Public short-link redirect (no auth — anyone with the link opens it)
app.get('/s/:code', redirectLink);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OG meta tags for public widgets — serve dynamic HTML to crawlers/bots
app.get('/w/:slug', (req, res) => {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const isBot = ua.includes('bot') || ua.includes('crawler') || ua.includes('spider') ||
    ua.includes('telegrambot') || ua.includes('vkshare') || ua.includes('whatsapp') ||
    ua.includes('slackbot') || ua.includes('discordbot') || ua.includes('preview');

  if (!isBot) {
    // Regular user — serve SPA
    return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Bot — serve HTML with OG tags
  try {
    // get is already imported at the top of the file
    const widget = get('SELECT title, description, imageUrl FROM widgets WHERE publicSlug = ? AND isPublic = 1', [req.params.slug]);
    if (!widget) {
      return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    }

    const title = escapeHtml(widget.title || 'NEXUS Виджет');
    const description = escapeHtml(widget.description || '');
    const imageUrl = widget.imageUrl ? `https://nexus-liberty.online${escapeHtml(widget.imageUrl)}` : '';

    res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  ${imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : ''}
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://nexus-liberty.online/w/${escapeHtml(req.params.slug)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : ''}
  <title>${title} — NEXUS</title>
  <meta http-equiv="refresh" content="0;url=/w/${escapeHtml(req.params.slug)}" />
</head>
<body></body>
</html>`);
  } catch (e) {
    console.error('OG handler error:', e);
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  }
});

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

// Global error handler — must be last
app.use(errorHandler);

// Initialize database and start server
async function start() {
  try {
    initDatabase();
    initializeDatabase();
    runMigrations();
    startAutoBackup(); // daily 09:00 server-local DB backup

    const server = http.createServer(app);

    // Socket.IO with auth
    const io = new SocketIOServer(server, {
      cors: { origin: process.env.ALLOWED_ORIGIN || true, methods: ['GET', 'POST'] },
    });

    // Socket.IO JWT authentication middleware
    io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        (socket as any).user = decoded;
        next();
      } catch {
        next(new Error('Invalid token'));
      }
    });

    const onlineUsers = new Map<string, string>();

    io.on('connection', (socket) => {
      const user = (socket as any).user;
      if (!user) { socket.disconnect(); return; }

      // Use authenticated user ID instead of client-supplied
      onlineUsers.set(socket.id, user.id);
      socket.join(`user:${user.id}`);
      io.emit('users:online', Array.from(new Set(onlineUsers.values())));

      socket.on('chat:join', (conversationId: string) => {
        // General chat — any authenticated user can join
        if (conversationId === 'general') { socket.join('conv:general'); return; }
        // Verify membership before joining room
        const conv = get('SELECT * FROM chat_conversations WHERE id = ?', [conversationId]);
        if (!conv) return;
        const isMember = conv.user1Id === user.id || conv.user2Id === user.id ||
          (conv.type === 'group' && !!get('SELECT 1 FROM chat_group_members WHERE conversationId = ? AND userId = ?', [conversationId, user.id]));
        if (isMember) socket.join(`conv:${conversationId}`);
      });

      socket.on('chat:leave', (conversationId: string) => {
        socket.leave(`conv:${conversationId}`);
      });

      socket.on('disconnect', () => {
        onlineUsers.delete(socket.id);
        io.emit('users:online', Array.from(new Set(onlineUsers.values())));
      });
    });

    app.set('io', io);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`NEXUS CRM on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
