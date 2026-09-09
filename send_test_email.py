import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('89.108.66.185', username='root', password='WmAyrvzAaj4iQv4c', timeout=15)

script = """const { sendRegistrationConfirm } = require('./dist/utils/email');
sendRegistrationConfirm('89135267702@mail.ru', {
  name: 'Иванов Иван Иванович',
  eventTitle: 'Экспедиция на Плато Путорана',
  eventDate: '15 октября 2026',
  eventTime: '09:00',
  location: 'Норильск, Кайеркан, аэропорт Алыкель',
  mapCoords: '{"lat":69.3137,"lng":88.1628}',
  status: 'registered',
  checkinToken: 'test-checkin-token-789',
  confirmCode: '7391',
  cancelToken: 'test-cancel-token-012',
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
