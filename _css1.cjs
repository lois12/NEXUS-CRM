const fs = require('fs');
const s = fs.readFileSync('G:/CRT THE NEXUS CRM/client/src/styles/globals.css', 'utf8');
// find mobile font-size rule and date input rules
let i = s.indexOf('Prevent zoom on input focus');
console.log('=== mobile zoom rule ===');
console.log(s.slice(i - 200, i + 300));
i = s.indexOf('Cyberpunk Date/Time');
console.log('=== date rules ===');
console.log(s.slice(i, i + 700));
i = s.indexOf('::-webkit-datetime-edit-text');
console.log('=== edit-text padding ===');
console.log(s.slice(i - 100, i + 250));
