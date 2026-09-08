import sqlite3, os

DB = r'G:\CRT THE NEXUS CRM\server\nexus.db'
UPLOADS = r'G:\CRT THE NEXUS CRM\server\uploads'

conn = sqlite3.connect(DB)
c = conn.cursor()

def file_exists(path):
    if not path:
        return False
    fname = path.replace('/uploads/', '').replace('/uploads\\', '')
    return os.path.exists(os.path.join(UPLOADS, fname))

total = 0

# Materials - delete entries with missing files
c.execute('SELECT rowid, url, name FROM materials WHERE url LIKE "/uploads/%" OR url = "" OR url IS NULL')
rows = c.fetchall()
deleted = 0
for rowid, url, name in rows:
    if not url or not file_exists(url):
        c.execute('DELETE FROM materials WHERE rowid = ?', (rowid,))
        deleted += 1
if deleted:
    print(f"materials: {deleted} deleted (missing files)")
total += deleted

# Project documents - delete entries with missing files
c.execute('SELECT rowid, filePath, fileName FROM project_documents WHERE filePath LIKE "/uploads/%" OR filePath = "" OR filePath IS NULL')
rows = c.fetchall()
deleted = 0
for rowid, fpath, fname in rows:
    if not fpath or not file_exists(fpath):
        c.execute('DELETE FROM project_documents WHERE rowid = ?', (rowid,))
        deleted += 1
if deleted:
    print(f"project_documents: {deleted} deleted")
total += deleted

# Task attachments - delete entries with missing files
c.execute('PRAGMA table_info(task_attachments)')
cols = [r[1] for r in c.fetchall()]
for col in cols:
    if 'path' in col.lower():
        c.execute(f'SELECT rowid, "{col}" FROM task_attachments WHERE "{col}" LIKE "/uploads/%" OR "{col}" = ""')
        rows = c.fetchall()
        deleted = 0
        for rowid, val in rows:
            if not val or not file_exists(val):
                c.execute('DELETE FROM task_attachments WHERE rowid = ?', (rowid,))
                deleted += 1
        if deleted:
            print(f"task_attachments.{col}: {deleted} deleted")
        total += deleted

# Idea attachments
c.execute('PRAGMA table_info(idea_attachments)')
cols = [r[1] for r in c.fetchall()]
for col in cols:
    if 'path' in col.lower():
        c.execute(f'SELECT rowid, "{col}" FROM idea_attachments WHERE "{col}" LIKE "/uploads/%" OR "{col}" = ""')
        rows = c.fetchall()
        deleted = 0
        for rowid, val in rows:
            if not val or not file_exists(val):
                c.execute('DELETE FROM idea_attachments WHERE rowid = ?', (rowid,))
                deleted += 1
        if deleted:
            print(f"idea_attachments.{col}: {deleted} deleted")
        total += deleted

# Chat attachments
c.execute('PRAGMA table_info(chat_attachments)')
cols = [r[1] for r in c.fetchall()]
for col in cols:
    if 'path' in col.lower() or 'url' in col.lower():
        c.execute(f'SELECT rowid, "{col}" FROM chat_attachments WHERE "{col}" LIKE "/uploads/%" OR "{col}" = ""')
        rows = c.fetchall()
        deleted = 0
        for rowid, val in rows:
            if not val or not file_exists(val):
                c.execute('DELETE FROM chat_attachments WHERE rowid = ?', (rowid,))
                deleted += 1
        if deleted:
            print(f"chat_attachments.{col}: {deleted} deleted")
        total += deleted

# Registration media
c.execute('PRAGMA table_info(registration_media)')
cols = [r[1] for r in c.fetchall()]
for col in cols:
    if 'path' in col.lower() or 'file' in col.lower():
        c.execute(f'SELECT rowid, "{col}" FROM registration_media WHERE "{col}" LIKE "/uploads/%" OR "{col}" = ""')
        rows = c.fetchall()
        deleted = 0
        for rowid, val in rows:
            if not val or not file_exists(val):
                c.execute('DELETE FROM registration_media WHERE rowid = ?', (rowid,))
                deleted += 1
        if deleted:
            print(f"registration_media.{col}: {deleted} deleted")
        total += deleted

conn.commit()
conn.close()

print(f"\nTotal deleted: {total}")

# Sync to VPS
print("\nSyncing to VPS...")
import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('89.108.66.185', username='root', password='WmAyrvzAaj4iQv4c', timeout=15)
stdin, stdout, stderr = client.exec_command('pm2 stop nexus-crm', timeout=10)
stdout.read()

sftp = client.open_sftp()
sftp.put(DB, '/var/www/NEXUS-CRM/server/nexus.db')
sftp.close()
print("DB synced")

stdin, stdout, stderr = client.exec_command('pm2 restart nexus-crm', timeout=10)
stdout.read()

import time
time.sleep(2)
stdin, stdout, stderr = client.exec_command('curl -sf http://localhost:8080/api/health', timeout=10)
print("Health:", stdout.read().decode())

client.close()
print("Done!")
