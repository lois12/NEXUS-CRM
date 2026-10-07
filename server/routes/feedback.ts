import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { createFeedback, listFeedback, resolveFeedback, deleteFeedback } from '../controllers/feedbackController';

const router = Router();
router.use(authenticateToken);

// any user
router.post('/', createFeedback);

// admin inbox
router.get('/', requireRole('super_admin'), listFeedback);
router.post('/:id/resolve', requireRole('super_admin'), resolveFeedback);
router.delete('/:id', requireRole('super_admin'), deleteFeedback);

export default router;
