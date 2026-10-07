#!/usr/bin/env node
/**
 * NEXUS CRM — post-deploy smoke check.
 *
 * Usage:
 *   node scripts/smoke.mjs                          # http://localhost:8080
 *   node scripts/smoke.mjs https://nexus-liberty.online
 *   SMOKE_USER=admin SMOKE_PASS=secret node scripts/smoke.mjs https://...
 *
 * Exit 0 = all critical checks passed; 1 = something failed.
 */

const BASE = (process.argv[2] || process.env.SMOKE_BASE || 'http://localhost:8080').replace(/\/$/, '');
const USER = process.env.SMOKE_USER || '';
const PASS = process.env.SMOKE_PASS || '';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

const results = [];
let token = '';

function log(msg) {
  console.log(msg);
}

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const mark = ok ? '✓' : '✗';
  log(`  ${mark} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(method, path, body, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    let json = null;
    const text = await res.text();
    try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text: text.slice(0, 200) };
  } finally {
    clearTimeout(t);
  }
}

async function check(name, method, path, { body, expect, expectBody, optional = false } = {}) {
  try {
    const res = await req(method, path, body);
    const statusOk = Array.isArray(expect) ? expect.includes(res.status) : res.status === expect;
    let bodyOk = true;
    let detail = `HTTP ${res.status}`;
    if (statusOk && expectBody) {
      bodyOk = expectBody(res.json, res.text);
      if (!bodyOk) detail += ' (body mismatch)';
    }
    const ok = statusOk && bodyOk;
    record(name, ok, ok ? detail : detail + ` ${res.text || ''}`);
    return ok;
  } catch (e) {
    const msg = e.name === 'AbortError' ? `timeout ${TIMEOUT_MS}ms` : (e.message || String(e));
    record(name, optional, msg);
    return false;
  }
}

async function main() {
  log(`\nNEXUS SMOKE → ${BASE}\n`);

  // ── Public / unauthenticated ──
  log('PUBLIC');
  await check('GET /api/health', 'GET', '/api/health', {
    expect: 200,
    expectBody: (j) => j && j.status === 'ok',
  });
  await check('GET / (SPA)', 'GET', '/', {
    expect: 200,
    expectBody: (j, text) => !text || text.includes('<html') || text.includes('<!DOCTYPE'),
  });
  await check('GET /login (SPA)', 'GET', '/login', { expect: 200, optional: true });
  await check('GET /api/docs', 'GET', '/api/docs', { expect: 200, optional: true });
  await check('GET /api/docs.json', 'GET', '/api/docs.json', {
    expect: 200,
    optional: true,
    expectBody: (j) => j && typeof j === 'object',
  });
  await check('POST /api/auth/login (bad creds)', 'POST', '/api/auth/login', {
    body: { username: '___smoke___', password: 'wrong' },
    expect: [400, 401],
    expectBody: (j) => j && j.success === false,
  });

  // ── Optional authenticated smoke ──
  if (USER && PASS) {
    log('\nAUTH');
    const login = await req('POST', '/api/auth/login', { username: USER, password: PASS });
    const okLogin = login.status === 200 && login.json?.success && login.json?.data?.token;
    record('POST /api/auth/login', okLogin, okLogin ? 'HTTP 200' : `HTTP ${login.status} ${login.text}`);
    if (okLogin) {
      token = login.json.data.token;
      await check('GET /api/auth/me', 'GET', '/api/auth/me', {
        expect: 200,
        expectBody: (j) => j?.data?.username === USER || !!j?.data?.id,
      });
      await check('GET /api/content', 'GET', '/api/content', {
        expect: 200,
        expectBody: (j) => Array.isArray(j?.data),
      });
      await check('GET /api/surveys', 'GET', '/api/surveys', { expect: [200, 403], optional: true });
      await check('GET /api/users', 'GET', '/api/users', { expect: [200, 403] });
      await check('GET /api/chat/unread-count', 'GET', '/api/chat/unread-count', {
        expect: 200,
        optional: true,
        expectBody: (j) => typeof j?.data?.count === 'number',
      });
      await check('GET /api/dashboard/health', 'GET', '/api/dashboard/health', {
        expect: [200, 403],
        optional: true,
      });
    }
  } else {
    log('\nAUTH  (skipped — set SMOKE_USER / SMOKE_PASS for full smoke)');
  }

  // ── Summary ──
  const failed = results.filter((r) => !r.ok);
  const passed = results.length - failed.length;
  log(`\n────────────────────────────`);
  log(`RESULT: ${passed}/${results.length} passed${failed.length ? `, ${failed.length} FAILED` : ''}`);
  if (failed.length) {
    for (const f of failed) log(`  FAIL  ${f.name} — ${f.detail}`);
  }
  log('');
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error('SMOKE CRASH:', e);
  process.exit(1);
});
