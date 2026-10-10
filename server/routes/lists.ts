import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireAnyRole, requireOwnership, ROLE_SUPER, ROLE_BOSS, ROLE_INFO, ROLE_TOURISM } from '../middleware/permissions';
import {
  getLists, getListById, createList, updateList, deleteList, duplicateList,
  togglePublish, getPublicList,
  createField, updateField, deleteField, reorderFields,
  createEntry, updateEntry, deleteEntry, toggleEntry,
  exportCSV, exportPDF,
  restoreEntry, permanentDelete, emptyTrash, getTrash,
  togglePin, toggleStar, massAction
} from '../controllers/listController';

const router = Router();
router.use(authenticateToken);

const canWrite = requireAnyRole(ROLE_SUPER, ROLE_BOSS, ROLE_INFO, ROLE_TOURISM);
const ownList = requireOwnership('lists', 'createdBy');

// Lists — managers any, others only own
router.get('/', getLists);
router.get('/:id', getListById);
router.post('/', canWrite, createList);
router.put('/:id', canWrite, ownList, updateList);
router.delete('/:id', canWrite, ownList, deleteList);
router.post('/:id/duplicate', canWrite, ownList, duplicateList);
router.post('/:id/toggle-publish', canWrite, ownList, togglePublish);

// Fields
router.post('/:id/fields', canWrite, ownList, createField);
router.put('/:id/fields/:fieldId', canWrite, ownList, updateField);
router.delete('/:id/fields/:fieldId', canWrite, ownList, deleteField);
router.put('/:id/fields-reorder', canWrite, ownList, reorderFields);

// Entries
router.post('/:id/entries', canWrite, ownList, createEntry);
router.put('/:id/entries/:entryId', canWrite, ownList, updateEntry);
router.delete('/:id/entries/:entryId', canWrite, ownList, deleteEntry);
router.patch('/:id/entries/:entryId/toggle', canWrite, ownList, toggleEntry);
router.patch('/:id/entries/:entryId/pin', canWrite, ownList, togglePin);
router.patch('/:id/entries/:entryId/star', canWrite, ownList, toggleStar);
router.post('/:id/entries/:entryId/restore', canWrite, ownList, restoreEntry);
router.delete('/:id/entries/:entryId/permanent', canWrite, ownList, permanentDelete);
router.delete('/:id/trash', canWrite, ownList, emptyTrash);
router.get('/:id/trash', canWrite, ownList, getTrash);
router.post('/:id/mass-action', canWrite, ownList, massAction);

// Export
router.get('/:id/export/csv', exportCSV);
router.get('/:id/export/pdf', exportPDF);

export default router;

// Public (unauthenticated) router
const publicRouter = Router();
publicRouter.get('/lists/public/:slug', getPublicList);

export { publicRouter };
