import paramiko, os

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('89.108.66.185', username='root', password='WmAyrvzAaj4iQv4c', timeout=15)

sftp = client.open_sftp()

LOCAL_DB = r'G:\CRT THE NEXUS CRM\server\nexus.db'
REMOTE_DB = '/var/www/NEXUS-CRM/server/nexus.db'

local_size = os.path.getsize(LOCAL_DB)
print(f"Local DB: {local_size/1024:.0f}KB")

# Check remote DB before upload
try:
    remote_stat = sftp.stat(REMOTE_DB)
    print(f"Remote DB before: {remote_stat.st_size/1024:.0f}KB")
except:
    print("Remote DB: not found")

# Upload
sftp.put(LOCAL_DB, REMOTE_DB)
print(f"Uploaded!")

# Verify
remote_stat = sftp.stat(REMOTE_DB)
print(f"Remote DB after: {remote_stat.st_size/1024:.0f}KB")

sftp.close()

# Start server
stdin, stdout, stderr = client.exec_command('pm2 start nexus-crm 2>&1 | tail -5', timeout=15)
print(stdout.read().decode())

import time
time.sleep(3)
stdin, stdout, stderr = client.exec_command('curl -sf http://localhost:8080/api/health', timeout=10)
print("Health:", stdout.read().decode())

client.close()
print("DB restored!")
