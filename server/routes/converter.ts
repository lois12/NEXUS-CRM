import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncAuthHandler } from '../middleware/errorHandler';
import { uploadDoc } from '../middleware/upload';
import {
  health, officeToPdf, pdfToDocx, pdfToXlsx, downloadJob,
} from '../controllers/converterController';

const router = Router();
router.use(authenticateToken);

// LibreOffice availability probe
router.get('/health', asyncAuthHandler(health));

// Office → PDF (docx/xlsx/pptx/odt/rtf/csv/txt)
router.post('/office-to-pdf', uploadDoc.single('file'), asyncAuthHandler(officeToPdf));

// PDF → DOCX (LibreOffice)
router.post('/pdf-to-docx', uploadDoc.single('file'), asyncAuthHandler(pdfToDocx));

// PDF → XLSX (table extraction)
router.post('/pdf-to-xlsx', uploadDoc.single('file'), asyncAuthHandler(pdfToXlsx));

// Download converted result
router.get('/download/:jobId', asyncAuthHandler(downloadJob));

export default router;
