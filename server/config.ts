import fs from 'fs';
import { ENV_PATH } from './paths';

// Load .env file manually
if (fs.existsSync(ENV_PATH)) {
  const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
}

export const GIGACHAT_API_KEY = process.env.GIGACHAT_API_KEY || '';
export const JWT_SECRET = process.env.JWT_SECRET || '';
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
