import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
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

// Lists
router.get('/', getLists);
router.get('/:id', getListById);
router.post('/', requireRole('super_admin', 'руководитель', 'редактор'), createList);
router.put('/:id', requireRole('super_admin', 'руководитель', 'редактор'), updateList);
router.delete('/:id', requireRole('super_admin', 'руководитель'), deleteList);
router.post('/:id/duplicate', requireRole('super_admin', 'руководитель', 'редактор'), duplicateList);
router.post('/:id/toggle-publish', requireRole('super_admin', 'руководитель', 'редактор'), togglePublish);

// Fields
router.post('/:id/fields', requireRole('super_admin', 'руководитель', 'редактор'), createField);
router.put('/:id/fields/:fieldId', requireRole('super_admin', 'руководитель', 'редактор'), updateField);
router.delete('/:id/fields/:fieldId', requireRole('super_admin', 'руководитель', 'редактор'), deleteField);
router.put('/:id/fields-reorder', requireRole('super_admin', 'руководитель', 'редактор'), reorderFields);

// Entries
router.post('/:id/entries', requireRole('super_admin', 'руководитель', 'редактор'), createEntry);
router.put('/:id/entries/:entryId', requireRole('super_admin', 'руководитель', 'редактор'), updateEntry);
router.delete('/:id/entries/:entryId', requireRole('super_admin', 'руководитель', 'редактор'), deleteEntry);
router.patch('/:id/entries/:entryId/toggle', requireRole('super_admin', 'руководитель', 'редактор'), toggleEntry);
router.patch('/:id/entries/:entryId/pin', requireRole('super_admin', 'руководитель', 'редактор'), togglePin);
router.patch('/:id/entries/:entryId/star', requireRole('super_admin', 'руководитель', 'редактор'), toggleStar);
router.post('/:id/entries/:entryId/restore', requireRole('super_admin', 'руководитель', 'редактор'), restoreEntry);
router.delete('/:id/entries/:entryId/permanent', requireRole('super_admin', 'руководитель'), permanentDelete);
router.delete('/:id/trash', requireRole('super_admin', 'руководитель'), emptyTrash);
router.get('/:id/trash', requireRole('super_admin', 'руководитель', 'редактор'), getTrash);
router.post('/:id/mass-action', requireRole('super_admin', 'руководитель', 'редактор'), massAction);

// Export
router.get('/:id/export/csv', exportCSV);
router.get('/:id/export/pdf', exportPDF);

export default router;

// Public (unauthenticated) router
const publicRouter = Router();
publicRouter.get('/lists/public/:slug', getPublicList);

export { publicRouter };