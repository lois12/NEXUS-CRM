import paramiko, os

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('89.108.66.185', username='root', password='WmAyrvzAaj4iQv4c', timeout=15)

sftp = client.open_sftp()

LOCAL_DIR = r'G:\CRT THE NEXUS CRM\client\public'
REMOTE_DIR = '/var/www/NEXUS-CRM/client/dist'

files = ['apple-touch-icon.png', 'favicon-16.png', 'favicon-32.png', 'icon-192.png', 'icon-512.png']

for fname in files:
    local = os.path.join(LOCAL_DIR, fname)
    remote = f'{REMOTE_DIR}/{fname}'
    if os.path.exists(local):
        sftp.put(local, remote)
        print(f'Uploaded: {fname}')
    else:
        print(f'Missing locally: {fname}')

sftp.close()

# Also fix .gitignore to include these specific files
stdin, stdout, stderr = client.exec_command('ls -la /var/www/NEXUS-CRM/client/dist/*.png /var/www/NEXUS-CRM/client/dist/*.svg 2>&1', timeout=10)
print('\nVPS dist icons:')
print(stdout.read().decode())

client.close()
