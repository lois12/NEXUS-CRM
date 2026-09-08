import { Router } from 'express';
import { getAllMaterials, uploadMaterial, updateMaterial, deleteMaterial } from '../controllers/materialsController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();
router.use(authenticateToken);

router.get('/', getAllMaterials);
router.post('/upload', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), upload.single('file'), uploadMaterial);
router.put('/:id', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), updateMaterial);
router.delete('/:id', requireRole('super_admin', 'руководитель'), deleteMaterial);

export default router;
