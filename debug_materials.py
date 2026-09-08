import paramiko, json

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('89.108.66.185', username='root', password='WmAyrvzAaj4iQv4c', timeout=15)

# Check materials data
stdin, stdout, stderr = client.exec_command(
    'curl -sk "https://localhost/api/materials" -H "Host: nexus-liberty.online" 2>&1 | head -500',
    timeout=15
)
data = stdout.read().decode()
print("MATERIALS API RESPONSE (first 500 chars):")
print(data[:500])

# Check uploads dir structure
stdin, stdout, stderr = client.exec_command(
    'ls -la /var/www/NEXUS-CRM/uploads/ | wc -l && echo "---" && ls /var/www/NEXUS-CRM/uploads/ | head -10',
    timeout=10
)
print("\nUPLOADS DIR:")
print(stdout.read().decode())

# Check if server logs show 404s for uploads
stdin, stdout, stderr = client.exec_command(
    'pm2 logs nexus-crm --lines 50 --nostream 2>&1 | grep -i "404\\|error\\|upload" | tail -10',
    timeout=10
)
print("\nSERVER LOGS (errors):")
print(stdout.read().decode())

client.close()
