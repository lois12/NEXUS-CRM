import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('89.108.66.185', username='root', password='WmAyrvzAaj4iQv4c', timeout=15)

script = """const { sendRegistrationConfirm } = require('./dist/utils/email');
sendRegistrationConfirm('89135267702@mail.ru', {
  name: 'Иванов Иван Иванович',
  eventTitle: 'Конференция NEXUS 2026',
  eventDate: '15 сентября 2026',
  eventTime: '14:00',
  location: 'Москва, ул. Тверская, д. 1',
  mapCoords: '{"lat":55.7558,"lng":37.6173}',
  status: 'registered',
  checkinToken: 'test-checkin-token-123',
  cancelToken: 'test-cancel-token-456',
  origin: 'https://nexus-liberty.online',
}).then(r => console.log('RESULT:', r)).catch(e => console.log('ERROR:', e.message));
"""

sftp = client.open_sftp()
with sftp.open('/var/www/NEXUS-CRM/server/test_send.js', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command('cd /var/www/NEXUS-CRM/server && node test_send.js 2>&1', timeout=30)
result = stdout.read().decode() + stderr.read().decode()
print(result)

stdin, stdout, stderr = client.exec_command('rm /var/www/NEXUS-CRM/server/test_send.js', timeout=10)
client.close()
