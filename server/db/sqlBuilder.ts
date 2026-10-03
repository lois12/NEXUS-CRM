import { query, run, get } from './database';

type ColumnMap = Record<string, unknown>;

/**
 * Build a parameterized UPDATE SET clause from a partial object.
 * Only whitelisted columns are written — unknown keys are ignored,
 * `undefined` values are skipped, `null` is written as NULL.
 *
 * Usage:
 *   const { set, params } = buildUpdate(req.body, ['name', 'description'], {
 *     touch: true, // appends updatedAt = datetime('now')
 *   });
 *   if (set) run(`UPDATE lists SET ${set} WHERE id = ?`, [...params, id]);
 */
export function buildUpdate(
  source: ColumnMap,
  allowedCols: string[],
  opts: { touch?: boolean } = {}
): { set: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];

  for (const col of allowedCols) {
    if (!(col in source)) continue;
    const value = source[col];
    if (value === undefined) continue;
    parts.push(`${col} = ?`);
    params.push(value);
  }

  if (opts.touch) {
    parts.push("updatedAt = datetime('now')");
  }

  return { set: parts.join(', '), params };
}

/**
 * Execute UPDATE with buildUpdate output. No-op when nothing changed.
 * Returns true if a statement was executed.
 */
export function updateById(
  table: string,
  id: string,
  source: ColumnMap,
  allowedCols: string[],
  opts: { touch?: boolean } = {}
): boolean {
  // Whitelist table/id identifiers — never interpolate user input here
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }

  const { set, params } = buildUpdate(source, allowedCols, opts);
  if (!set) return false;
  run(`UPDATE ${table} SET ${set} WHERE id = ?`, [...params, id]);
  return true;
}

/**
 * Build a WHERE clause from equality filters (all AND-ed).
 * `undefined` values are skipped; `null` matches IS NULL.
 */
export function buildWhere(filters: ColumnMap): { where: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];

  for (const [col, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
      throw new Error(`Invalid column name: ${col}`);
    }
    if (value === null) {
      parts.push(`${col} IS NULL`);
    } else {
      parts.push(`${col} = ?`);
      params.push(value);
    }
  }

  return {
    where: parts.length ? `WHERE ${parts.join(' AND ')}` : '',
    params,
  };
}

export { query, run, get };
