const fs = require('fs');
const p = 'G:/CRT THE NEXUS CRM/client/src/styles/globals.css';
let s = fs.readFileSync(p, 'utf8');

const add = `
/* ===== Нативные date/time на мобильных =====
   Причина вылезания: медиа-правило выше ставит input { font-size: 16px !important },
   а контрол шёл моноширинным JetBrains Mono + padding у сегментов — суммарно шире контейнера.
   16px оставляем (иначе iOS зумит при фокусе), но шрифт — узкий системный, паддинги убраны. */
@media (max-width: 768px) {
  input[type="date"],
  input[type="time"],
  input[type="datetime-local"],
  input[type="month"],
  input[type="week"] {
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif !important;
    letter-spacing: 0 !important;
    width: 100% !important;
    min-width: 0 !important;
  }
}
input[type="date"]::-webkit-datetime-edit-text,
input[type="time"]::-webkit-datetime-edit-text,
input[type="datetime-local"]::-webkit-datetime-edit-text,
input[type="month"]::-webkit-datetime-edit-text,
input[type="week"]::-webkit-datetime-edit-text {
  padding: 0;
}
input[type="date"]::-webkit-datetime-edit-fields-wrapper,
input[type="time"]::-webkit-datetime-edit-fields-wrapper,
input[type="datetime-local"]::-webkit-datetime-edit-fields-wrapper {
  padding: 0;
}
`;

if (s.includes('Нативные date/time на мобильных')) { console.log('ALREADY'); process.exit(0); }
fs.writeFileSync(p, s + add, 'utf8');
console.log('OK appended');
