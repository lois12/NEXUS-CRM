import paramiko, json

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('89.108.66.185', username='root', password='WmAyrvzAaj4iQv4c', timeout=15)

# Check how server serves uploads
stdin, stdout, stderr = client.exec_command(
    "grep -n 'uploads\\|UPLOADS\\|static' /var/www/NEXUS-CRM/server/dist/server.js | head -10",
    timeout=10
)
print("SERVER STATIC CONFIG:")
print(stdout.read().decode())

# Check the actual paths.ts compiled output
stdin, stdout, stderr = client.exec_command(
    "cat /var/www/NEXUS-CRM/server/dist/paths.js",
    timeout=10
)
print("\nPATHS.JS:")
print(stdout.read().decode())

# Check what the server logs say about uploads dir
stdin, stdout, stderr = client.exec_command(
    "pm2 logs nexus-crm --lines 30 --nostream 2>&1 | grep -i upload",
    timeout=10
)
print("\nLOGS:")
print(stdout.read().decode())

client.close()
