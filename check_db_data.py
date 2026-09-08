import sqlite3

DB = r'G:\CRT THE NEXUS CRM\server\nexus.db'
conn = sqlite3.connect(DB)
c = conn.cursor()

print("=== USERS ===")
c.execute("SELECT id, username, fullName, avatar FROM users")
for r in c.fetchall():
    print(f"  {r[1]} ({r[2]}): avatar={r[3]}")

print("\n=== MATERIALS (first 5) ===")
c.execute("PRAGMA table_info(materials)")
cols = [r[1] for r in c.fetchall()]
print(f"  Columns: {cols}")
c.execute("SELECT * FROM materials LIMIT 5")
for r in c.fetchall():
    print(f"  {dict(zip(cols, r))}")

print("\n=== CONTENT POSTS (first 3) ===")
c.execute("SELECT id, title, imageUrl FROM content_posts LIMIT 3")
for r in c.fetchall():
    print(f"  {r[1]}: imageUrl={r[2]}")

conn.close()
