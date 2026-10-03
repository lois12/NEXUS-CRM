import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncAuthHandler } from '../middleware/errorHandler';
import { uploadDoc } from '../middleware/upload';
import {
  health, officeToPdf, pdfToDocx, pdfToXlsx, pdfToPptx, protectPdf, downloadJob,
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

// PDF → PPTX (LibreOffice Draw → Impress)
router.post('/pdf-to-pptx', uploadDoc.single('file'), asyncAuthHandler(pdfToPptx));

// Protect PDF with password (qpdf AES-256) — password arrives in a text field alongside the file
router.post('/protect-pdf', uploadDoc.single('file'), asyncAuthHandler(protectPdf));

// Download converted result
router.get('/download/:jobId', asyncAuthHandler(downloadJob));

export default router;
