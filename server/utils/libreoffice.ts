import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const CONV_ROOT = path.join(os.tmpdir(), 'nexus-conv');
const JOB_TIMEOUT_MS = 60_000;
const MAX_CONCURRENT = 2;
const MAX_PENDING = 10;

export interface ConvJob {
  jobId: string;
  filePath: string;
  originalName: string;
  size: number;
  createdAt: number;
  userId: string;
}

// ── Job registry (in-memory) ──
const jobs = new Map<string, ConvJob>();

export function registerJob(filePath: string, originalName: string, userId: string): ConvJob {
  const jobId = uuidv4();
  const job: ConvJob = { jobId, filePath, originalName, size: safeSize(filePath), createdAt: Date.now(), userId };
  jobs.set(jobId, job);
  return job;
}

export function getJob(jobId: string): ConvJob | undefined {
  return jobs.get(jobId);
}

export function removeJob(jobId: string): void {
  const job = jobs.get(jobId);
  if (job) {
    try { fs.rmSync(path.dirname(job.filePath), { recursive: true, force: true }); } catch {}
    jobs.delete(jobId);
  }
}

function safeSize(p: string): number {
  try { return fs.statSync(p).size; } catch { return 0; }
}

// TTL sweep: drop jobs older than 1 hour
setInterval(() => {
  const cutoff = Date.now() - 3_600_000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) removeJob(id);
  }
}, 30 * 60_000).unref?.();

// ── LibreOffice availability ──
let loInfo: { ok: boolean; version?: string; checked: boolean } = { ok: false, checked: false };

export async function ensureLibreOffice(): Promise<{ ok: boolean; version?: string }> {
  if (loInfo.checked) return { ok: loInfo.ok, version: loInfo.version };
  try {
    const version = await execFileAsync('soffice', ['--version'], { timeout: 10_000 });
    loInfo = { ok: true, version: version.trim().split('\n')[0], checked: true };
  } catch {
    loInfo = { ok: false, checked: true };
    console.warn('[converter] LibreOffice (soffice) not found — Office conversion disabled');
  }
  return { ok: loInfo.ok, version: loInfo.version };
}

// ── Simple in-memory queue (max 2 concurrent) ──
let active = 0;
const waitQueue: Array<() => void> = [];

export function pendingCount(): number {
  return waitQueue.length;
}

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (waitQueue.length >= MAX_PENDING) {
      reject(new Error('QUEUE_FULL'));
      return;
    }
    waitQueue.push(() => {
      active++;
      resolve();
    });
  });
}

function release(): void {
  active--;
  const next = waitQueue.shift();
  if (next) next();
}

// ── Core conversion ──
function execFileAsync(cmd: string, args: string[], opts: { timeout?: number } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: opts.timeout ?? JOB_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve(stdout || stderr || '');
    });
  });
}

export interface ConvertResult {
  outPath: string;
  outFileBase: string;
}

/**
 * Convert a document with LibreOffice headless.
 * @param inputPath  absolute path to source file (inside job dir)
 * @param targetFormat  e.g. 'pdf', 'docx:"MS Word 2007 XML"', 'xlsx'
 * @param originalBase  original filename without extension (for output naming)
 */
export async function convertWithLibreOffice(
  inputPath: string,
  targetFormat: string,
  originalBase: string
): Promise<ConvertResult> {
  await acquire();
  const jobDir = path.dirname(inputPath);
  const profileDir = path.join(os.tmpdir(), `lo_profile_${uuidv4()}`);
  try {
    const outDir = jobDir;
    const args = [
      '--headless', '--norestore', '--nolockcheck', '--nodefault', '--nofirststartwizard',
      `-env:UserInstallation=file://${profileDir.replace(/\\/g, '/')}`,
      '--convert-to', targetFormat,
      '--outdir', outDir,
      inputPath,
    ];
    await execFileAsync('soffice', args, { timeout: JOB_TIMEOUT_MS });

    // LibreOffice names output after the input file stem
    const inBase = path.basename(inputPath, path.extname(inputPath));
    const ext = targetFormat.startsWith('pdf') ? 'pdf'
      : targetFormat.startsWith('docx') ? 'docx'
      : targetFormat.startsWith('xlsx') ? 'xlsx'
      : targetFormat.startsWith('csv') ? 'csv' : 'txt';
    const produced = path.join(outDir, `${inBase}.${ext}`);
    if (!fs.existsSync(produced)) {
      throw new Error('CONVERT_FAILED');
    }
    const finalPath = path.join(outDir, `${sanitize(originalBase)}.${ext}`);
    if (finalPath !== produced) {
      fs.renameSync(produced, finalPath);
    }
    return { outPath: finalPath, outFileBase: path.basename(finalPath) };
  } finally {
    release();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
  }
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || 'file';
}

/** Create a fresh job work dir and copy the uploaded file into it. */
export function prepareJobDir(originalName: string): { jobDir: string; inputPath: string } {
  const jobId = uuidv4();
  const jobDir = path.join(CONV_ROOT, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  const ext = path.extname(originalName).toLowerCase() || '.bin';
  const inputPath = path.join(jobDir, `input${ext}`);
  return { jobDir, inputPath };
}
