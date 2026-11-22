/* E2E: real server conversion -> history list must contain the file */
const fs = require('fs');
const path = require('path');
const jwt = require('./server/node_modules/jsonwebtoken');

const BASE = 'http://localhost:8080';
const USER_ID = 'real-user-' + Date.now();
const token = jwt.sign(
  { id: USER_ID, username: 't', role: 'super_admin', roles: ['super_admin'] },
  'nexus-crm-secret-key-2024', { expiresIn: '1h' }
);

async function main() {
  const { Document, Packer, Paragraph, TextRun } = require('./server/node_modules/docx');
  const doc = new Document({ sections: [{ children: [new Paragraph({ children: [new TextRun('Тест конвертера')] })] }] });
  const buf = await Packer.toBuffer(doc);

  // 1) server conversion office-to-pdf
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'Проверка.docx');
  const r = await fetch(`${BASE}/api/converter/office-to-pdf`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
  });
  const j = await r.json();
  console.log('convert:', r.status, j.success ? 'OK' : j.error, '->', j.data && j.data.filename);
  if (!j.success) return;

  // 2) give the client-side saveToHistory a moment (it downloads + posts)
  //    simulate it exactly like the browser does:
  const rr = await fetch(`${BASE}${j.data.downloadUrl}`, { headers: { Authorization: `Bearer ${token}` } });
  const blob = await rr.blob();
  const fd2 = new FormData();
  fd2.append('file', blob, j.data.filename);
  fd2.append('toolId', 'office-to-pdf');
  fd2.append('origName', j.data.filename);
  const h = await fetch(`${BASE}/api/converter/history`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd2,
  });
  const hj = await h.json();
  console.log('history POST:', h.status, hj.success ? 'OK' : hj.error);

  // 3) list as the panel does
  const l = await fetch(`${BASE}/api/converter/history?toolId=office-to-pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const lj = await l.json();
  console.log('history GET:', l.status, 'rows:', (lj.data || []).length);
  console.log('row:', JSON.stringify((lj.data || [])[0]));
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
