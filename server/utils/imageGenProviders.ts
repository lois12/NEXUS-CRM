/**
 * Image generation providers (free tiers first).
 * 1) Cloudflare Workers AI  — needs CF_ACCOUNT_ID + CF_API_TOKEN
 * 2) Pollinations.ai       — no key, URL-based
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CF_ACCOUNT_ID, CF_API_TOKEN } from '../config';
import { UPLOADS_DIR } from '../paths';

export type ImageProvider = 'cloudflare' | 'pollinations';

export function hasCloudflare(): boolean {
  return !!(CF_ACCOUNT_ID && CF_API_TOKEN);
}

/** Cloudflare Workers AI — flux-1-schnell (free quota). Returns JPEG/PNG buffer. */
export async function generateWithCloudflare(prompt: string, opts?: { width?: number; height?: number }): Promise<Buffer> {
  const width = opts?.width || 1024;
  const height = opts?.height || 1024;
  // flux-1-schnell: cheap + fast on free tier
  const model = '@cf/black-forest-labs/flux-1-schnell';
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${model}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      width,
      height,
      steps: 4,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cloudflare AI ${res.status}: ${text.slice(0, 200)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) throw new Error('Cloudflare AI: empty image');
  return buf;
}

/** Pollinations.ai — free, no API key. Returns JPEG buffer. */
export async function generateWithPollinations(prompt: string, opts?: { width?: number; height?: number }): Promise<Buffer> {
  const width = opts?.width || 1024;
  const height = opts?.height || 1024;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${Date.now() % 1e9}`;

  const res = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(120000),
    headers: { 'User-Agent': 'NEXUS-CRM/1.0' },
  });

  if (!res.ok) {
    throw new Error(`Pollinations ${res.status}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) throw new Error('Pollinations: empty image');
  return buf;
}

/** Save buffer to uploads/ and return public URL path. */
export function saveGeneratedImage(buf: Buffer, ext = 'jpg'): string {
  const name = `gen_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const full = path.join(UPLOADS_DIR, name);
  fs.writeFileSync(full, buf);
  return `/uploads/${name}`;
}

/** Preferred order: cloudflare (if keyed) → pollinations */
export async function generateImageBuffer(
  prompt: string,
  opts?: { width?: number; height?: number; provider?: ImageProvider }
): Promise<{ buf: Buffer; provider: ImageProvider }> {
  const preferred = opts?.provider;
  const order: ImageProvider[] = preferred
    ? [preferred]
    : hasCloudflare()
      ? ['cloudflare', 'pollinations']
      : ['pollinations'];

  let lastErr: Error | null = null;
  for (const p of order) {
    try {
      const buf = p === 'cloudflare' && hasCloudflare()
        ? await generateWithCloudflare(prompt, opts)
        : await generateWithPollinations(prompt, opts);
      return { buf, provider: p };
    } catch (e) {
      lastErr = e as Error;
      console.warn(`[imageGen] ${p} failed:`, (e as Error).message);
    }
  }
  throw lastErr || new Error('No image provider available');
}
