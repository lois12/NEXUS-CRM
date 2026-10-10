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
export const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

/** Cloudflare Workers AI (free tier ~10k neurons/day) */
export const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
export const CF_API_TOKEN = process.env.CF_API_TOKEN || '';

// ── Startup validation ──
if (!JWT_SECRET || JWT_SECRET.length < 16 || JWT_SECRET === 'CHANGE_ME_TO_RANDOM_STRING') {
  console.error('\x1b[31mFATAL: JWT_SECRET is not set or too short. Set it in .env (min 16 chars).\x1b[0m');
  process.exit(1);
}
if (JWT_SECRET === 'nexus-crm-secret-key-2024') {
  console.warn('\x1b[33mWARNING: JWT_SECRET is a known weak default. Change it in .env to a random string.\x1b[0m');
}
