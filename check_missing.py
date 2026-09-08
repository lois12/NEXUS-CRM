import sqlite3, os

DB = r'G:\CRT THE NEXUS CRM\server\nexus.db'
UPLOADS = r'G:\CRT THE NEXUS CRM\server\uploads'

conn = sqlite3.connect(DB)
c = conn.cursor()

refs = set()

# Scan every table for any column with upload-like values
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in c.fetchall()]

for table in tables:
    c.execute(f"PRAGMA table_info({table})")
    cols = [row[1] for row in c.fetchall()]
    for col in cols:
        try:
            c.execute(f'SELECT "{col}" FROM "{table}" WHERE "{col}" LIKE "/uploads/%" LIMIT 500')
            for r in c.fetchall():
                if r[0]:
                    refs.add(r[0])
        except:
            pass

conn.close()

# Check existence
missing = []
found = []
for ref in refs:
    fname = ref.replace('/uploads/', '')
    local_path = os.path.join(UPLOADS, fname)
    if os.path.exists(local_path):
        found.append(ref)
    else:
        missing.append(ref)

print(f"Total DB references: {len(refs)}")
print(f"Found on disk: {len(found)}")
print(f"MISSING: {len(missing)}")
print(f"\n--- MISSING FILES ---")
for m in sorted(missing):
    print(f"  {m}")
