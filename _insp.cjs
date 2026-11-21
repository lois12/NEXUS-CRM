const fs = require('fs');
const s = fs.readFileSync('G:/CRT THE NEXUS CRM/client/src/pages/Registrations.tsx', 'utf8');
// show all date/time inputs with their surrounding divs
const re = /type="(datetime-local|time|date)"/g;
let m;
while ((m = re.exec(s)) !== null) {
  const start = Math.max(0, m.index - 260);
  console.log('=====', m[1], 'at', m.index);
  console.log(s.slice(start, m.index + 260));
}
