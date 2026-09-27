import { Router } from 'express';
import {
  getWidgets, getWidgetById, createWidget, updateWidget, deleteWidget,
  uploadImage, togglePublish, togglePin, duplicateWidget,
  updatePublishSettings, getPublicWidget,
} from '../controllers/widgetController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// ── Public route ──
router.get('/w/:slug', getPublicWidget);

// ── Authenticated routes ──
const authRouter = Router();
authRouter.use(authenticateToken);

authRouter.get('/', getWidgets);
authRouter.get('/:id', getWidgetById);
authRouter.post('/', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), createWidget);
authRouter.put('/:id', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), updateWidget);
authRouter.delete('/:id', requireRole('super_admin', 'руководитель', 'редактор'), deleteWidget);
authRouter.post('/:id/image', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), upload.single('file'), uploadImage);
authRouter.put('/:id/publish', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), togglePublish);
authRouter.put('/:id/pin', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), togglePin);
authRouter.post('/:id/duplicate', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), duplicateWidget);
authRouter.put('/:id/publish-settings', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), updatePublishSettings);

export { router as publicWidgetRouter, authRouter as widgetAuthRouter };