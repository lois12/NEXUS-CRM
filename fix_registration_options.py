import sqlite3, json

DB = r'G:\CRT THE NEXUS CRM\server\nexus.db'

def unwrap_json(val, max_depth=5):
    """Recursively unwrap double/triple/etc encoded JSON strings"""
    if not val or not isinstance(val, str):
        return val
    current = val
    for _ in range(max_depth):
        try:
            parsed = json.loads(current)
            if isinstance(parsed, str) and parsed != current:
                current = parsed
            else:
                break
        except:
            break
    return current

conn = sqlite3.connect(DB)
c = conn.cursor()

c.execute("SELECT id, type, options, settings FROM registration_fields")
rows = c.fetchall()

fixed = 0
for row_id, ftype, options, settings in rows:
    new_opts = unwrap_json(options)
    new_sets = unwrap_json(settings)
    
    if new_opts != options or new_sets != settings:
        c.execute("UPDATE registration_fields SET options = ?, settings = ? WHERE id = ?",
                  [new_opts, new_sets, row_id])
        fixed += 1
        print(f"  Fixed {ftype}: opts={new_opts[:60] if new_opts else 'null'}")

conn.commit()

# Verify all
print(f"\n=== Total fixed: {fixed} ===")
print("\nAll fields now:")
c.execute("SELECT type, label, options FROM registration_fields ORDER BY position")
for row in c.fetchall():
    opts = row[2] if row[2] else '[]'
    print(f"  [{row[0]}] {row[1]}: {opts[:80]}")

conn.close()
