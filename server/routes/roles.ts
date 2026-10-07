import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { getRoleMatrix, saveRoleMatrix } from '../controllers/roleController';

const router = Router();
router.use(authenticateToken);

router.get('/matrix', getRoleMatrix);
router.put('/matrix', requireRole('super_admin'), saveRoleMatrix);

export default router;
