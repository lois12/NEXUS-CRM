import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import jwt from 'jsonwebtoken';
import './config';
import { JWT_SECRET } from './config';
import { Server as SocketIOServer } from 'socket.io';
import { initDatabase } from './db/database';
import { initializeDatabase } from './db/init';
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
import qrAuthRoutes from './routes/qrAuth';
import pushRoutes from './routes/push';
import { publicRegRouter, registrationAuthRouter } from './routes/registrations';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

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
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '1d', etag: true }));

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  }
});

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    await initializeDatabase();

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
        socket.join(`conv:${conversationId}`);
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
