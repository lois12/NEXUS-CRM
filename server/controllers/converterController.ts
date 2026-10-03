import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/auth';
import {
  ensureLibreOffice, convertWithLibreOffice, prepareJobDir,
  registerJob, getJob, removeJob, pendingCount, ConvJob,
} from '../utils/libreoffice';
import { pdfToXlsxBuffer } from '../utils/pdfTableExtract';

const OFFICE_EXTS = new Set(['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.odt', '.ods', '.odp', '.rtf', '.csv', '.txt']);

/** Cross-device safe move: copy + unlink (uploads/ and /tmp may be different filesystems). */
function moveFile(src: string, dest: string): void {
  fs.copyFileSync(src, dest);
  try { fs.unlinkSync(src); } catch {}
}

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

function jobResponse(job: ConvJob) {
  return {
    jobId: job.jobId,
    filename: job.originalName,
    size: job.size,
    downloadUrl: `/api/converter/download/${job.jobId}`,
  };
}

/** GET /api/converter/health */
export const health = async (req: AuthRequest, res: Response) => {
  const info = await ensureLibreOffice();
  res.json({ success: true, data: { libreoffice: info.ok, version: info.version, pending: pendingCount() } });
};

/** POST /api/converter/office-to-pdf — docx/xlsx/pptx/odt/rtf/csv/txt → PDF */
export const officeToPdf = async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) return fail(res, 400, 'Файл не загружен');

    const ext = path.extname(file.originalname).toLowerCase();
    if (!OFFICE_EXTS.has(ext)) return fail(res, 400, 'Неподдерживаемый тип файла');

    const lo = await ensureLibreOffice();
    if (!lo.ok) return fail(res, 503, 'LibreOffice не установлен на сервере');

    const { jobDir, inputPath } = prepareJobDir(file.originalname);
    moveFile(file.path, inputPath);

    const originalBase = path.basename(file.originalname, ext);
    try {
      const result = await convertWithLibreOffice(inputPath, 'pdf', originalBase);
      const job = registerJob(result.outPath, `${originalBase}.pdf`, req.user!.id);
      res.json({ success: true, data: jobResponse(job) });
    } catch (e: any) {
      try { fs.rmSync(jobDir, { recursive: true, force: true }); } catch {}
      if (e?.message === 'QUEUE_FULL') return fail(res, 429, 'Сервер перегружен, попробуйте позже');
      if (e?.message === 'CONVERT_FAILED') return fail(res, 500, 'Не удалось сконвертировать файл');
      if (e?.killed) return fail(res, 500, 'Конвертация не завершилась за 60 сек');
      console.error('officeToPdf error:', e);
      return fail(res, 500, 'Ошибка конвертации');
    }
  } catch (error) {
    console.error('officeToPdf error:', error);
    return fail(res, 500, 'Ошибка сервера');
  }
};

/** POST /api/converter/pdf-to-docx */
export const pdfToDocx = async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) return fail(res, 400, 'Файл не загружен');
    if (path.extname(file.originalname).toLowerCase() !== '.pdf') return fail(res, 400, 'Ожидается PDF-файл');

    const lo = await ensureLibreOffice();
    if (!lo.ok) return fail(res, 503, 'LibreOffice не установлен на сервере');

    const { jobDir, inputPath } = prepareJobDir(file.originalname);
    moveFile(file.path, inputPath);

    const originalBase = path.basename(file.originalname, '.pdf');
    try {
      const result = await convertWithLibreOffice(inputPath, 'docx:"MS Word 2007 XML"', originalBase);
      const job = registerJob(result.outPath, `${originalBase}.docx`, req.user!.id);
      res.json({ success: true, data: jobResponse(job) });
    } catch (e: any) {
      try { fs.rmSync(jobDir, { recursive: true, force: true }); } catch {}
      if (e?.message === 'QUEUE_FULL') return fail(res, 429, 'Сервер перегружен, попробуйте позже');
      if (e?.killed) return fail(res, 500, 'Конвертация не завершилась за 60 сек');
      console.error('pdfToDocx error:', e);
      return fail(res, 500, 'Ошибка конвертации');
    }
  } catch (error) {
    console.error('pdfToDocx error:', error);
    return fail(res, 500, 'Ошибка сервера');
  }
};

/** POST /api/converter/pdf-to-xlsx — table extraction via pdfjs text layer */
export const pdfToXlsx = async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) return fail(res, 400, 'Файл не загружен');
    if (path.extname(file.originalname).toLowerCase() !== '.pdf') return fail(res, 400, 'Ожидается PDF-файл');

    const { jobDir } = prepareJobDir(file.originalname);
    const originalBase = path.basename(file.originalname, '.pdf');
    try {
      const buf = await pdfToXlsxBuffer(file.path);
      const outPath = path.join(jobDir, `${originalBase}.xlsx`);
      fs.writeFileSync(outPath, buf);
      const job = registerJob(outPath, `${originalBase}.xlsx`, req.user!.id);
      res.json({ success: true, data: jobResponse(job) });
    } catch (e: any) {
      try { fs.rmSync(jobDir, { recursive: true, force: true }); } catch {}
      console.error('pdfToXlsx error:', e);
      return fail(res, 500, 'Не удалось извлечь таблицы из PDF');
    } finally {
      // input copy no longer needed
      try { fs.unlinkSync(file.path); } catch {}
    }
  } catch (error) {
    console.error('pdfToXlsx error:', error);
    return fail(res, 500, 'Ошибка сервера');
  }
};

/** GET /api/converter/download/:jobId */
export const downloadJob = async (req: AuthRequest, res: Response) => {
  try {
    const job = getJob(req.params.jobId);
    if (!job) return fail(res, 404, 'Файл не найден или устарел');
    if (!fs.existsSync(job.filePath)) {
      removeJob(job.jobId);
      return fail(res, 404, 'Файл не найден или устарел');
    }

    res.download(job.filePath, job.originalName, (err) => {
      if (err) console.error('download error:', err);
      // Clean up after the download completes (or fails)
      removeJob(job.jobId);
    });
  } catch (error) {
    console.error('downloadJob error:', error);
    return fail(res, 500, 'Ошибка сервера');
  }
};
