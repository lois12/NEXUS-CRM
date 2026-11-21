const fs = require('fs');
const p = 'G:/CRT THE NEXUS CRM/client/src/pages/Quizzes.tsx';
let s = fs.readFileSync(p, 'utf8');

// work on LF-normalized content, then restore CRLF at the end if needed
const crlf = s.includes('\r\n');
let t = s.replace(/\r\n/g, '\n');

function rep(oldStr, newStr, tag) {
  if (t.includes(oldStr)) { t = t.replace(oldStr, newStr); console.log('OK', tag); }
  else console.log('MISS', tag);
}

// 1. question text input -> textarea
rep(`<input
                              value={q.text}
                              onChange={(e) => setQuestions((p) => p.map((x, i) => i === qi ? { ...x, text: e.target.value } : x))}
                              placeholder="Текст вопроса…"
                              className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-200 mb-2 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]"
                            />`,
`<textarea
                              value={q.text}
                              onChange={(e) => { const v = e.target.value; setQuestions((p) => p.map((x, i) => i === qi ? { ...x, text: v } : x)); autoGrow(e.target); }}
                              placeholder="Текст вопроса…"
                              rows={1}
                              ref={autoGrow}
                              className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-200 mb-2 resize-none overflow-hidden [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]"
                            />`, 'question text');

// 2. comment input -> textarea
rep(`<input
                              value={q.comment || ''}
                              onChange={(e) => setQuestions((p) => p.map((x, i) => i === qi ? { ...x, comment: e.target.value } : x))}
                              placeholder="Комментарий к вопросу (мелким шрифтом под вопросом)"
                              className="w-full px-3 py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-gray-400 mb-2 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]"
                            />`,
`<textarea
                              value={q.comment || ''}
                              onChange={(e) => { const v = e.target.value; setQuestions((p) => p.map((x, i) => i === qi ? { ...x, comment: v } : x)); autoGrow(e.target); }}
                              placeholder="Комментарий к вопросу (мелким шрифтом под вопросом)"
                              rows={1}
                              ref={autoGrow}
                              className="w-full px-3 py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-gray-400 mb-2 resize-none overflow-hidden [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]"
                            />`, 'comment');

// 3. description textarea -> auto-grow
rep(`<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2} className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200 [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />`,
`<textarea value={form.description} onChange={(e) => { const v = e.target.value; setForm({ ...form, description: v }); autoGrow(e.target); }}
                    rows={2} ref={autoGrow} className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-gray-200 resize-none overflow-hidden [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)]" />`, 'description');

// 4. afterEndText -> auto-grow
rep(`onChange={(e) => setForm({ ...form, afterEndText: e.target.value })}`,
    `onChange={(e) => { const v = e.target.value; setForm({ ...form, afterEndText: v }); autoGrow(e.target); }}`, 'afterEndText onchange');
rep(`rows={2} placeholder="Благодарим за участие…"`,
    `rows={2} ref={autoGrow} placeholder="Благодарим за участие…"`, 'afterEndText ref');

t = t.split('<div className="px-3 pb-3">').join('<div className="px-3 pb-3 min-w-0">');

if (crlf) t = t.replace(/\n/g, '\r\n');
fs.writeFileSync(p, t, 'utf8');
console.log('DONE');
