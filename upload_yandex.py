import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('89.108.66.185', username='root', password='WmAyrvzAaj4iQv4c', timeout=15)

sftp = client.open_sftp()
with sftp.open('/var/www/NEXUS-CRM/client/dist/yandex_585a750873daf44a.html', 'w') as f:
    f.write("""<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    </head>
    <body>Verification: 585a750873daf44a</body>
</html>
""")
sftp.close()

# Also copy to public for future builds
stdin, stdout, stderr = client.exec_command(
    'cp /var/www/NEXUS-CRM/client/dist/yandex_585a750873daf44a.html /var/www/NEXUS-CRM/client/public/yandex_585a750873daf44a.html',
    timeout=10
)

# Verify
stdin, stdout, stderr = client.exec_command(
    'curl -sk "https://localhost/yandex_585a750873daf44a.html" -H "Host: nexus-liberty.online"',
    timeout=10
)
print("Response:", stdout.read().decode())

client.close()
print("Yandex verification file uploaded!")
