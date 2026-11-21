const fs = require('fs');
const p = 'G:/CRT THE NEXUS CRM/client/src/pages/Registrations.tsx';
let s = fs.readFileSync(p, 'utf8');

// 1. Wrapper cells for date/time get overflow clamp
s = s.split('<div className="grid grid-cols-2 gap-2 sm:gap-3 min-w-0">')
  .join('<div className="grid grid-cols-2 gap-2 sm:gap-3 min-w-0 overflow-hidden">');
s = s.split('<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 min-w-0">')
  .join('<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 min-w-0 overflow-hidden">');

// 2. Inline clamp on every date/time input (inline style wins over any stylesheet)
const types = ['date', 'time', 'datetime-local'];
for (const t of types) {
  const needle = `type="${t}"`;
  let idx = 0;
  while ((idx = s.indexOf(needle, idx)) !== -1) {
    // insert style attr right after the type attr if not already present nearby
    const after = s.indexOf('value=', idx);
    const styleIdx = s.indexOf('style=', idx);
    if (after !== -1 && (styleIdx === -1 || styleIdx > after)) {
      const inject = ' style={{ width: \'100%\', minWidth: 0, maxWidth: \'100%\', boxSizing: \'border-box\' }}';
      s = s.slice(0, after) + inject + ' ' + s.slice(after);
      idx = after + inject.length + 6;
    } else {
      idx += needle.length;
    }
  }
}
console.log('OK clamped date/time inputs');

fs.writeFileSync(p, s, 'utf8');
console.log('DONE');
