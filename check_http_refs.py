import paramiko, re

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('89.108.66.185', username='root', password='WmAyrvzAaj4iQv4c', timeout=15)

# Find all http:// URLs in built JS
stdin, stdout, stderr = client.exec_command(
    r"grep -roE 'http://[^\x22\x27\x20\x60\x3e]+' /var/www/NEXUS-CRM/client/dist/assets/*.js 2>/dev/null | grep -v 'http://www.w3.org' | grep -v 'http://localhost' | head -30",
    timeout=30
)
output = stdout.read().decode()
if output.strip():
    print("HTTP references found in built JS:")
    print(output)
else:
    print("No non-standard http:// references found")

# Also check specifically for http://localhost
stdin, stdout, stderr = client.exec_command(
    r"grep -c 'http://localhost' /var/www/NEXUS-CRM/client/dist/assets/*.js 2>/dev/null | grep -v ':0$'",
    timeout=15
)
output = stdout.read().decode()
if output.strip():
    print("\nhttp://localhost found in:")
    print(output)
else:
    print("\nNo http://localhost in built JS - FIX WORKED!")

client.close()
