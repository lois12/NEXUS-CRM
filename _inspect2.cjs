const fs = require('fs');
const s = fs.readFileSync('G:/CRT THE NEXUS CRM/client/src/pages/Registrations.tsx', 'utf8');
for (const t of ['type="date"', 'type="time"', 'type="datetime-local"']) {
  const i = s.indexOf(t);
  console.log('=====', t, i);
  console.log(s.slice(Math.max(0, i - 500), i + 420));
}
