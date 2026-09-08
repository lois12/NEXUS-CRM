import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UPLOADS_DIR } from '../paths';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    // Fix Russian/UTF-8 filenames: multer stores them as latin1, need to convert back
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, `${uuidv4()}${ext}`);
    (file as any).decodedOriginalname = decodedName;
  },
});

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
