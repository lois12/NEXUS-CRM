import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('89.108.66.185', username='root', password='WmAyrvzAaj4iQv4c', timeout=15)

cmds = [
    "grep -iE 'src=|href=' /var/www/NEXUS-CRM/client/dist/index.html",
    "cat /var/www/NEXUS-CRM/client/dist/index.html",
    "grep -ri 'iframe' /var/www/NEXUS-CRM/client/dist/index.html 2>/dev/null",
]

for i, cmd in enumerate(cmds):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
    out = stdout.read().decode().strip()
    if out:
        print(f"=== CMD {i+1} ===")
        print(out[:2000])
        print()

client.close()
