const fs = require('fs');
const s = fs.readFileSync('G:/CRT THE NEXUS CRM/client/src/pages/PublicRegistration.tsx', 'utf8');
let i = s.indexOf('eventDate');
console.log('eventDate at', i);
// find the meta/info band rendering
i = s.indexOf('МЕСТО');
console.log('МЕСТО at', i);
if (i !== -1) console.log(s.slice(i - 800, i + 500));
else {
  i = s.indexOf('location');
  console.log('location at', i);
  console.log(s.slice(i - 400, i + 400));
}
