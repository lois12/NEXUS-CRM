import { Router } from 'express';
import {
  getRegistrations, getRegistrationById, createRegistration, updateRegistration, deleteRegistration, duplicateRegistration,
  uploadImage, uploadVideo, createField, updateField, deleteField, reorderFields,
  getBySlug, submitRegistration, getSubmissions, cancelSubmission, cancelByToken, deleteSubmission, exportCSV, updateSubmissionStatus,
  getMedia, uploadMedia, deleteMedia,
  checkinGet, checkinPost, checkinByCode, getParticipants, toggleAttended, updateAndNotify,
  getPublicRegistrations, getPublicSubmissions, createAdminSubmission,
  getRegistrationStats, exportPDF, getAllContacts,
} from '../controllers/registrationController';
import { authenticateToken } from '../middleware/auth';
import { requireAnyRole, requireOwnership, ROLE_SUPER, ROLE_BOSS, ROLE_INFO, ROLE_TOURISM } from '../middleware/permissions';
import { controlAuth } from '../middleware/controlAuth';
import { getControlStatus, authControl, setControlPassword } from '../controllers/controlAuthController';
import { upload } from '../middleware/upload';


const router = Router();

// ── Public routes (no auth) ──
router.get('/reg/:slug', getBySlug);
router.post('/reg/:slug', submitRegistration);
router.delete('/reg/cancel/:token', cancelByToken);
router.get('/reg/checkin/:token', checkinGet);
router.post('/reg/checkin/:token', checkinPost);
router.get('/reg/checkin-code/:registrationId/:code', checkinByCode);

// CONTROL page (public, password-gated when set)
router.get('/control/status', getControlStatus);
router.post('/control/auth', authControl);
router.get('/control/registrations', controlAuth, getPublicRegistrations);
router.get('/control/registrations/:id/submissions', controlAuth, getPublicSubmissions);

// ── Authenticated routes ──
const authRouter = Router();
const canWrite = requireAnyRole(ROLE_SUPER, ROLE_BOSS, ROLE_INFO, ROLE_TOURISM);
const ownReg = requireOwnership('registrations', 'createdBy');
authRouter.use(authenticateToken);

// Contacts
authRouter.get('/contacts', getAllContacts);

// CONTROL password management (admin)
authRouter.put('/control-password', canWrite, setControlPassword);

// Registrations CRUD
authRouter.get('/', getRegistrations);
authRouter.get('/:id', getRegistrationById);
authRouter.post('/', canWrite, createRegistration);
authRouter.put('/:id', canWrite, updateRegistration);
authRouter.put('/:id/notify', canWrite, updateAndNotify);
authRouter.delete('/:id', canWrite, deleteRegistration);
authRouter.post('/:id/duplicate', canWrite, duplicateRegistration);
authRouter.post('/:id/image', canWrite, upload.single('file'), uploadImage);
authRouter.post('/:id/video', canWrite, upload.single('file'), uploadVideo);

// Media gallery
authRouter.get('/:id/media', getMedia);
authRouter.post('/:id/media', canWrite, upload.single('file'), uploadMedia);
authRouter.delete('/media/:mediaId', canWrite, deleteMedia);

// Fields CRUD
authRouter.post('/:id/fields', canWrite, createField);
authRouter.put('/:id/fields/:fieldId', canWrite, updateField);
authRouter.delete('/:id/fields/:fieldId', canWrite, deleteField);
authRouter.put('/:id/fields-reorder', canWrite, reorderFields);

// Submissions
authRouter.get('/:id/submissions', getSubmissions);
authRouter.post('/:id/admin-submission', canWrite, createAdminSubmission);
authRouter.patch('/submissions/:subId/status', canWrite, updateSubmissionStatus);
authRouter.delete('/submissions/:subId', cancelSubmission);
authRouter.delete('/submissions/:subId/delete', canWrite, deleteSubmission);
authRouter.get('/:id/submissions/export', exportCSV);
authRouter.get('/:id/stats', getRegistrationStats);
authRouter.get('/:id/submissions/export-pdf', exportPDF);

// Participants
authRouter.get('/:id/participants', getParticipants);
authRouter.post('/:id/participants/:subId/attended', toggleAttended);

export { router as publicRegRouter, authRouter as registrationAuthRouter };
