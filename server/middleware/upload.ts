import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UPLOADS_DIR } from '../paths';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Fix Russian/UTF-8 filenames: multer stores them as latin1, need to convert back
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    // H1 (security): extension comes from a SERVER-SIDE allowlist keyed by the
    // validated MIME — never from client-controlled originalname. Prevents
    // uploading poc.html/.svg with a spoofed Content-Type (stored XSS via /uploads).
    const ext = mimeToExt[file.mimetype] || '.bin';
    cb(null, `${uuidv4()}${ext}`);
    (file as any).decodedOriginalname = decodedName;
  },
});

// Server-side extension map — one safe ext per allowed MIME
const mimeToExt: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.ms-powerpoint': '.ppt',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/webm': '.weba',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/json': '.json',
};

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow images, documents, videos, and audio
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // SVG removed — stored XSS vector
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    // application/octet-stream removed — bypasses type filter
    'text/plain',
    'text/csv',
    // Archives removed — potential malware vector
    'application/json',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Неподдерживаемый тип файла'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// Media-only filter (images + videos)
const mediaMimes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
];

const mediaFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (mediaMimes.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Только изображения и видео'));
};

export const uploadMedia = multer({
  storage,
  fileFilter: mediaFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Document-only filter
const docMimes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'text/csv',
  'application/json',
];

const docFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (docMimes.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Только документы (PDF, Word, Excel, текст)'));
};

export const uploadDoc = multer({
  storage,
  fileFilter: docFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});
