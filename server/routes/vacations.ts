import { Router } from 'express';
import { getVacations, createVacation, updateVacation, deleteVacation } from '../controllers/vacationsController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', getVacations);
router.post('/', createVacation); // any user can request vacation
router.put('/:id', requireRole('super_admin', 'руководитель'), updateVacation);
router.delete('/:id', requireRole('super_admin', 'руководитель'), deleteVacation);

export default router;
