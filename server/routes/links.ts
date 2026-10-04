import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncAuthHandler } from '../middleware/errorHandler';
import { shortenUrl, listMyLinks, deleteLink } from '../controllers/shortLinkController';

const router = Router();
router.use(authenticateToken);

router.post('/shorten', asyncAuthHandler(shortenUrl));
router.get('/', asyncAuthHandler(listMyLinks));
router.delete('/:id', asyncAuthHandler(deleteLink));

export default router;
