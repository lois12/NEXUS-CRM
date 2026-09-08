import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { UPLOADS_DIR } from '../paths';

const THUMB_DIR = path.join(UPLOADS_DIR, 'thumbs');
const THUMB_WIDTH = 400;
const THUMB_QUALITY = 70;

// Ensure thumbs directory exists
if (!fs.existsSync(THUMB_DIR)) {
  fs.mkdirSync(THUMB_DIR, { recursive: true });
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

export async function generateThumbnail(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (!IMAGE_EXTS.includes(ext)) return null;

  const filename = path.basename(filePath);
  const thumbPath = path.join(THUMB_DIR, filename);

  // Skip if thumbnail already exists
  if (fs.existsSync(thumbPath)) return `/uploads/thumbs/${filename}`;

  try {
    await sharp(filePath)
      .resize(THUMB_WIDTH, null, { withoutEnlargement: true })
      .jpeg({ quality: THUMB_QUALITY })
      .toFile(thumbPath);
    return `/uploads/thumbs/${filename}`;
  } catch (err) {
    console.error('Thumbnail generation failed:', err);
    return null;
  }
}
