import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('89.108.66.185', username='root', password='WmAyrvzAaj4iQv4c', timeout=15)

# Check for HTTP resources in HTML
stdin, stdout, stderr = client.exec_command(
    "curl -sk 'https://localhost/' -H 'Host: nexus-liberty.online' | grep -oE 'http://[^ \\\"\\x27]+' | head -20",
    timeout=15
)
print("HTTP resources in HTML:")
print(stdout.read().decode())

# Check JS/CSS files for HTTP refs
stdin, stdout, stderr = client.exec_command(
    "curl -sk 'https://localhost/' -H 'Host: nexus-liberty.online' | grep -oE 'src=\"http://[^\"]+\"|href=\"http://[^\"]+\"' | head -10",
    timeout=15
)
print("\nHTTP in src/href:")
print(stdout.read().decode())

# Check if service worker or manifest references HTTP
stdin, stdout, stderr = client.exec_command(
    "curl -sk 'https://localhost/sw.js' -H 'Host: nexus-liberty.online' | grep -i 'http://' | head -5",
    timeout=15
)
print("\nHTTP in service worker:")
print(stdout.read().decode())

# Check manifest
stdin, stdout, stderr = client.exec_command(
    "curl -sk 'https://localhost/manifest.json' -H 'Host: nexus-liberty.online'",
    timeout=15
)
print("\nManifest:")
print(stdout.read().decode())

client.close()
