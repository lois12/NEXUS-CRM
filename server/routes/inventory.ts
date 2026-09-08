import { Router } from 'express';
import { getInventory, createItem, updateItem, deleteItem } from '../controllers/inventoryController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', getInventory);
router.post('/', requireRole('super_admin', 'руководитель', 'мол'), createItem);
router.put('/:id', requireRole('super_admin', 'руководитель', 'мол'), updateItem);
router.delete('/:id', requireRole('super_admin', 'руководитель'), deleteItem);

export default router;
