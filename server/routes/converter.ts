import { Router } from 'express';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth';
import { asyncAuthHandler } from '../middleware/errorHandler';
import { uploadDoc } from '../middleware/upload';
import { UPLOADS_DIR } from '../paths';
import {
  health, officeToPdf, pdfToDocx, pdfToXlsx, pdfToPptx, protectPdf, downloadJob,
} from '../controllers/converterController';
import { uploadResult, listHistory, downloadHistory } from '../controllers/converterHistory';

const router = Router();
router.use(authenticateToken);

// ── Сохранённые результаты конвертации (последние 5 на юзера на инструмент) ──
const RESULT_EXTS = new Set(['.pdf', '.xlsx', '.csv', '.zip', '.txt']);
const uploadConvResult = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOADS_DIR, 'conv');
      try { require('fs').mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `up-${uuidv4()}${RESULT_EXTS.has(ext) ? ext : '.bin'}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, RESULT_EXTS.has(ext));
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.get('/history', asyncAuthHandler(listHistory));
router.post('/history', uploadConvResult.single('file'), asyncAuthHandler(uploadResult));
router.get('/history/:id', asyncAuthHandler(downloadHistory));

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
