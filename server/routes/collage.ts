import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  listProjects, getProject, createProject, saveProject, patchMeta,
  removeProject, addVersion, removeVersion,
} from '../controllers/collageController';

const router = Router();
router.use(authenticateToken);

router.get('/projects', listProjects);
router.post('/projects', createProject);
router.get('/projects/:id', getProject);
router.put('/projects/:id', saveProject);
router.patch('/projects/:id/meta', patchMeta);
router.delete('/projects/:id', removeProject);
router.post('/projects/:id/versions', addVersion);
router.delete('/projects/:id/versions/:vid', removeVersion);

export default router;
