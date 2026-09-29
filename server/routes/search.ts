import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { searchAll } from '../controllers/searchController';

const router = Router();

router.get('/', authenticateToken, searchAll);

export default router;