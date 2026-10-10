import { Router } from 'express';
import { getAllMaterials, uploadMaterial, updateMaterial, deleteMaterial } from '../controllers/materialsController';
import { authenticateToken } from '../middleware/auth';
import { requireAnyRole, requireOwnership, ROLE_SUPER, ROLE_BOSS, ROLE_INFO, ROLE_TOURISM } from '../middleware/permissions';
import { upload } from '../middleware/upload';

const router = Router();
router.use(authenticateToken);

// all 4 roles can upload; managers edit/delete any, others only own files
const canWrite = requireAnyRole(ROLE_SUPER, ROLE_BOSS, ROLE_INFO, ROLE_TOURISM);
const ownOnly = requireOwnership('materials', 'uploadedBy');

router.get('/', getAllMaterials);
router.post('/upload', canWrite, upload.single('file'), uploadMaterial);
router.put('/:id', canWrite, ownOnly, updateMaterial);
router.delete('/:id', canWrite, ownOnly, deleteMaterial);

export default router;
