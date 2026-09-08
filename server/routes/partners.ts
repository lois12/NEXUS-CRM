import { Router } from 'express';
import { getPartners, createPartner, updatePartner, deletePartner } from '../controllers/partnersController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', getPartners);
router.post('/', requireRole('super_admin', 'руководитель', 'редактор'), createPartner);
router.put('/:id', requireRole('super_admin', 'руководитель', 'редактор'), updatePartner);
router.delete('/:id', requireRole('super_admin', 'руководитель'), deletePartner);

export default router;
