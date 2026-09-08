import { Router } from 'express';
import { login, register, getMe } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { rateLimitAuth } from '../middleware/rateLimit';

const router = Router();

router.post('/login', rateLimitAuth, login);
router.post('/register', authenticateToken, register);
router.get('/me', authenticateToken, getMe);

export default router;
