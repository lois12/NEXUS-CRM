import paramiko, os

VPS_HOST = '89.108.66.185'
VPS_USER = 'root'
VPS_PASS = 'WmAyrvzAaj4iQv4c'
LOCAL_DIR = r'G:\CRT THE NEXUS CRM\uploads'
REMOTE_DIR = '/var/www/NEXUS-CRM/uploads'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)

stdin, stdout, stderr = client.exec_command('pm2 stop nexus-crm', timeout=10)
stdout.read()

sftp = client.open_sftp()

# Clean old wrong uploads
stdin, stdout, stderr = client.exec_command(f'rm -rf {REMOTE_DIR}/*', timeout=10)
stdout.read()

# Create thumbs dir
try:
    sftp.mkdir(f'{REMOTE_DIR}/thumbs')
except:
    pass

# Upload all files
uploaded = 0
for fname in os.listdir(LOCAL_DIR):
    local_path = os.path.join(LOCAL_DIR, fname)
    if os.path.isfile(local_path):
        remote_path = f'{REMOTE_DIR}/{fname}'
        sftp.put(local_path, remote_path)
        uploaded += 1
        if uploaded % 20 == 0:
            print(f'  [{uploaded}] {fname}')

# Upload thumbs
thumbs_local = os.path.join(LOCAL_DIR, 'thumbs')
if os.path.exists(thumbs_local):
    for fname in os.listdir(thumbs_local):
        local_path = os.path.join(thumbs_local, fname)
        if os.path.isfile(local_path):
            remote_path = f'{REMOTE_DIR}/thumbs/{fname}'
            sftp.put(local_path, remote_path)
            uploaded += 1

sftp.close()

# Verify
stdin, stdout, stderr = client.exec_command(f'ls {REMOTE_DIR}/ | wc -l && echo "---" && du -sh {REMOTE_DIR}/', timeout=10)
print(f'\nUploaded {uploaded} files')
print(stdout.read().decode())

# Restart
stdin, stdout, stderr = client.exec_command('pm2 restart nexus-crm', timeout=10)
stdout.read()

import time
time.sleep(2)
stdin, stdout, stderr = client.exec_command('curl -sf http://localhost:8080/api/health', timeout=10)
print("Health:", stdout.read().decode())

client.close()
print("Done!")
