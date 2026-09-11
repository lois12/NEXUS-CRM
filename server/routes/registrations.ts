import { Router } from 'express';
import {
  getRegistrations, getRegistrationById, createRegistration, updateRegistration, deleteRegistration,
  uploadImage, uploadVideo, createField, updateField, deleteField, reorderFields,
  getBySlug, submitRegistration, getSubmissions, cancelSubmission, cancelByToken, deleteSubmission, exportCSV,
  getMedia, uploadMedia, deleteMedia,
  checkinGet, checkinPost, checkinByCode, getParticipants, toggleAttended, updateAndNotify,
} from '../controllers/registrationController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { rateLimitRegistration } from '../middleware/rateLimit';

const router = Router();

// ── Public routes (no auth) ──
router.get('/reg/:slug', getBySlug);
router.post('/reg/:slug', rateLimitRegistration, submitRegistration);
router.delete('/reg/cancel/:token', cancelByToken);
router.get('/reg/checkin/:token', checkinGet);
router.post('/reg/checkin/:token', checkinPost);
router.get('/reg/checkin-code/:registrationId/:code', checkinByCode);

// ── Authenticated routes ──
const authRouter = Router();
authRouter.use(authenticateToken);

// Registrations CRUD
authRouter.get('/', getRegistrations);
authRouter.get('/:id', getRegistrationById);
authRouter.post('/', requireRole('super_admin', 'руководитель', 'редактор'), createRegistration);
authRouter.put('/:id', requireRole('super_admin', 'руководитель', 'редактор'), updateRegistration);
authRouter.put('/:id/notify', requireRole('super_admin', 'руководитель', 'редактор'), updateAndNotify);
authRouter.delete('/:id', requireRole('super_admin', 'руководитель'), deleteRegistration);
authRouter.post('/:id/image', requireRole('super_admin', 'руководитель', 'редактор'), upload.single('file'), uploadImage);
authRouter.post('/:id/video', requireRole('super_admin', 'руководитель', 'редактор'), upload.single('file'), uploadVideo);

// Media gallery
authRouter.get('/:id/media', getMedia);
authRouter.post('/:id/media', requireRole('super_admin', 'руководитель', 'редактор'), upload.single('file'), uploadMedia);
authRouter.delete('/media/:mediaId', requireRole('super_admin', 'руководитель', 'редактор'), deleteMedia);

// Fields CRUD
authRouter.post('/:id/fields', requireRole('super_admin', 'руководитель', 'редактор'), createField);
authRouter.put('/:id/fields/:fieldId', requireRole('super_admin', 'руководитель', 'редактор'), updateField);
authRouter.delete('/:id/fields/:fieldId', requireRole('super_admin', 'руководитель', 'редактор'), deleteField);
authRouter.put('/:id/fields-reorder', requireRole('super_admin', 'руководитель', 'редактор'), reorderFields);

// Submissions
authRouter.get('/:id/submissions', getSubmissions);
authRouter.delete('/submissions/:subId', cancelSubmission);
authRouter.delete('/submissions/:subId/delete', requireRole('super_admin', 'руководитель'), deleteSubmission);
authRouter.get('/:id/submissions/export', exportCSV);

// Participants
authRouter.get('/:id/participants', getParticipants);
authRouter.post('/:id/participants/:subId/attended', toggleAttended);

export { router as publicRegRouter, authRouter as registrationAuthRouter };
