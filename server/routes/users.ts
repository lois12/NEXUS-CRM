import { Router } from 'express';
import { getAllUsers, getUserById, createUser, updateUser, deleteUser, uploadAvatar, updateMyAvatar, updateMyProfile } from '../controllers/usersController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authenticateToken);

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', requireRole('super_admin', 'руководитель'), createUser);
router.put('/:id', requireRole('super_admin', 'руководитель'), updateUser);
router.delete('/:id', requireRole('super_admin', 'руководитель'), deleteUser);

// Avatar upload
router.post('/me/avatar', upload.single('avatar'), updateMyAvatar);
router.post('/:id/avatar', requireRole('super_admin', 'руководитель'), upload.single('avatar'), uploadAvatar);

// Profile update
router.put('/me/profile', updateMyProfile);

export default router;
