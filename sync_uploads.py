import paramiko, os

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('89.108.66.185', username='root', password='WmAyrvzAaj4iQv4c', timeout=15)

# Stop server and WAIT for full exit (sql.js flushes DB to disk on SIGTERM)
stdin, stdout, stderr = client.exec_command('pm2 stop nexus-crm && sleep 3 && echo "stopped"', timeout=30)
print(stdout.read().decode())

sftp = client.open_sftp()

# Upload DB
LOCAL_DB = r'G:\CRT THE NEXUS CRM\server\nexus.db'
REMOTE_DB = '/var/www/NEXUS-CRM/server/nexus.db'
sftp.put(LOCAL_DB, REMOTE_DB)
print(f"DB uploaded: {os.path.getsize(LOCAL_DB)/1024:.0f}KB")

# Check what files VPS has
existing = set()
for f in sftp.listdir_attr('/var/www/NEXUS-CRM/uploads'):
    if f.filename != 'thumbs':
        existing.add(f.filename)

# Upload missing files from correct dir
LOCAL_UPLOADS = r'G:\CRT THE NEXUS CRM\uploads'
uploaded = 0
for fname in os.listdir(LOCAL_UPLOADS):
    local_path = os.path.join(LOCAL_UPLOADS, fname)
    if os.path.isfile(local_path) and fname not in existing:
        sftp.put(local_path, f'/var/www/NEXUS-CRM/uploads/{fname}')
        uploaded += 1

# Upload thumbs
thumbs_local = os.path.join(LOCAL_UPLOADS, 'thumbs')
if os.path.exists(thumbs_local):
    for fname in os.listdir(thumbs_local):
        local_path = os.path.join(thumbs_local, fname)
        if os.path.isfile(local_path):
            sftp.put(local_path, f'/var/www/NEXUS-CRM/uploads/thumbs/{fname}')

sftp.close()

# Count final
stdin, stdout, stderr = client.exec_command('ls /var/www/NEXUS-CRM/uploads/ | wc -l', timeout=10)
count = stdout.read().decode().strip()
print(f"Uploaded {uploaded} missing files. Total on VPS: {count}")

# Restart
stdin, stdout, stderr = client.exec_command('pm2 restart nexus-crm', timeout=10)
stdout.read()

import time
time.sleep(2)
stdin, stdout, stderr = client.exec_command('curl -sf http://localhost:8080/api/health', timeout=10)
print("Health:", stdout.read().decode())

client.close()
print("Restored!")
