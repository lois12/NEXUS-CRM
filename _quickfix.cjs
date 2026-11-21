const fs = require('fs');
const p = 'G:/CRT THE NEXUS CRM/client/src/pages/Registrations.tsx';
let s = fs.readFileSync(p, 'utf8');

// 1. Location textarea: auto-resize with content
const locOld = '<textarea data-field="location" rows={2} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="// МЕСТО ПРОВЕДЕНИЯ"';
const locNew = `<textarea data-field="location" rows={2} value={form.location} onChange={e => {
                  const el = e.target as HTMLTextAreaElement;
                  setForm({ ...form, location: el.value });
                  // поле растягивается под содержимое
                  requestAnimationFrame(() => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; });
                }}
                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                placeholder="// МЕСТО ПРОВЕДЕНИЯ"`;
if (s.includes(locOld)) {
  s = s.replace(locOld, locNew);
  console.log('OK location autosize');
} else console.log('MISS location');

// 2. Time/datetime inputs: stronger mobile clamp (labels + inputs)
// ensure every datetime/time input has compact type + no-min-width
s = s.replace(
  /className=\{`w-full min-w-0 px-2 sm:px-3 py-2 rounded-xl font-mono text-\[12px\] sm:text-sm bg-black\/30 border border-gray-700 text-gray-200 focus:outline-none \[box-shadow:var\(--depth-rim-top\),var\(--depth-rim-bottom\)\] \[&::-webkit-datetime-edit\]:text-\[11px\] \[&::-webkit-calendar-picker-indicator\]:opacity-60\$\{errCls\('([^']+)'\)\}`\}/g,
  "className={`w-full min-w-0 max-w-full px-2 py-2 rounded-xl font-mono text-[11px] sm:text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none [box-shadow:var(--depth-rim-top),var(--depth-rim-bottom)] [&::-webkit-datetime-edit]:text-[10px] [&::-webkit-datetime-edit-fields-wrapper]:min-w-0 [&::-webkit-calendar-picker-indicator]:opacity-60${errCls('$1')}`}"
);
console.log('OK datetime clamp');

// 3. Field labels: allow wrap so плашки не вылезают
s = s.split('className="font-mono text-[10px] text-gray-500 mb-1 block"')
  .join('className="font-mono text-[9px] sm:text-[10px] text-gray-500 mb-1 block break-words"');

fs.writeFileSync(p, s, 'utf8');
console.log('DONE');
