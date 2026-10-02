import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';

// ── Lists CRUD ──

export const getLists = (req: AuthRequest, res: Response) => {
  try {
    const lists = query(`
      SELECT l.*, u.fullName as creatorName,
        (SELECT COUNT(*) FROM list_entries le WHERE le.listId = l.id) as entryCount
      FROM lists l
      LEFT JOIN users u ON l.createdBy = u.id
      ORDER BY l.createdAt DESC
    `);
    res.json({ success: true, data: lists });
  } catch (error) {
    console.error('GetLists error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const getListById = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const list = get(`
      SELECT l.*, u.fullName as creatorName
      FROM lists l
      LEFT JOIN users u ON l.createdBy = u.id
      WHERE l.id = ?
    `, [id]);
    if (!list) return res.status(404).json({ success: false, error: 'Список не найден' });

    const fields = query('SELECT * FROM list_fields WHERE listId = ? ORDER BY position ASC', [id]);
    const entries = query('SELECT * FROM list_entries WHERE listId = ? ORDER BY createdAt DESC', [id]);
    res.json({ success: true, data: { ...list, fields, entries } });
  } catch (error) {
    console.error('GetListById error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createList = (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Название обязательно' });

    const id = uuidv4();
    run('INSERT INTO lists (id, name, description, createdBy) VALUES (?, ?, ?, ?)',
      [id, name, description || '', req.user?.id]);

    const list = get('SELECT * FROM lists WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: list });
  } catch (error) {
    console.error('CreateList error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateList = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const list = get('SELECT * FROM lists WHERE id = ?', [id]);
    if (!list) return res.status(404).json({ success: false, error: 'Список не найден' });

    const { name, description } = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }

    updates.push("updatedAt = datetime('now')");
    params.push(id);

    if (updates.length > 1) {
      run(`UPDATE lists SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Обновлено' });
  } catch (error) {
    console.error('UpdateList error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteList = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const list = get('SELECT id FROM lists WHERE id = ?', [id]);
    if (!list) return res.status(404).json({ success: false, error: 'Список не найден' });

    run('DELETE FROM lists WHERE id = ?', [id]);
    res.json({ success: true, message: 'Удалено' });
  } catch (error) {
    console.error('DeleteList error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const duplicateList = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const list = get('SELECT * FROM lists WHERE id = ?', [id]);
    if (!list) return res.status(404).json({ success: false, error: 'Список не найден' });

    const newId = uuidv4();
    run('INSERT INTO lists (id, name, description, createdBy) VALUES (?, ?, ?, ?)',
      [newId, list.name + ' (копия)', list.description, req.user?.id]);

    // Copy all fields
    const fields = query('SELECT * FROM list_fields WHERE listId = ? ORDER BY position', [id]);
    for (const field of fields) {
      run('INSERT INTO list_fields (id, listId, type, label, placeholder, required, options, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), newId, field.type, field.label, field.placeholder, field.required, field.options, field.position]);
    }

    // Copy all entries
    const entries = query('SELECT * FROM list_entries WHERE listId = ? ORDER BY createdAt ASC', [id]);
    for (const entry of entries) {
      run('INSERT INTO list_entries (id, listId, lastName, firstName, patronymic, phone, email, comment, called, visited, answers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), newId, entry.lastName, entry.firstName, entry.patronymic, entry.phone, entry.email, entry.comment, entry.called, entry.visited, entry.answers]);
    }

    const newList = get('SELECT * FROM lists WHERE id = ?', [newId]);
    const newFields = query('SELECT * FROM list_fields WHERE listId = ? ORDER BY position', [newId]);
    const newEntries = query('SELECT * FROM list_entries WHERE listId = ? ORDER BY createdAt DESC', [newId]);
    res.status(201).json({ success: true, data: { ...newList, fields: newFields, entries: newEntries } });
  } catch (error) {
    console.error('DuplicateList error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const togglePublish = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const list = get('SELECT * FROM lists WHERE id = ?', [id]);
    if (!list) return res.status(404).json({ success: false, error: 'Список не найден' });

    if (list.isPublic) {
      run("UPDATE lists SET isPublic = 0, publicSlug = NULL, updatedAt = datetime('now') WHERE id = ?", [id]);
    } else {
      const slug = uuidv4().slice(0, 8);
      run("UPDATE lists SET isPublic = 1, publicSlug = ?, updatedAt = datetime('now') WHERE id = ?", [slug, id]);
    }

    const updated = get('SELECT * FROM lists WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('TogglePublish error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const getPublicList = (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const list = get(`
      SELECT l.*, u.fullName as creatorName
      FROM lists l
      LEFT JOIN users u ON l.createdBy = u.id
      WHERE l.publicSlug = ? AND l.isPublic = 1
    `, [slug]);
    if (!list) return res.status(404).json({ success: false, error: 'Список не найден' });

    const fields = query('SELECT * FROM list_fields WHERE listId = ? ORDER BY position ASC', [list.id]);
    const entries = query('SELECT * FROM list_entries WHERE listId = ? ORDER BY createdAt ASC', [list.id]);

    res.json({ success: true, data: { ...list, fields, entries } });
  } catch (error) {
    console.error('GetPublicList error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Fields CRUD ──

export const createField = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const list = get('SELECT id FROM lists WHERE id = ?', [id]);
    if (!list) return res.status(404).json({ success: false, error: 'Список не найден' });

    const { type, label, placeholder, required, options, position } = req.body;
    if (!type || !label) return res.status(400).json({ success: false, error: 'Тип и название обязательны' });

    const fieldId = uuidv4();
    const maxPos = get('SELECT MAX(position) as maxPos FROM list_fields WHERE listId = ?', [id]);
    const pos = position ?? ((maxPos?.maxPos ?? -1) + 1);

    const optStr = typeof options === 'string' ? options : JSON.stringify(options || []);
    run('INSERT INTO list_fields (id, listId, type, label, placeholder, required, options, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [fieldId, id, type, label, placeholder || '', required ? 1 : 0, optStr, pos]);

    const field = get('SELECT * FROM list_fields WHERE id = ?', [fieldId]);
    res.status(201).json({ success: true, data: field });
  } catch (error) {
    console.error('CreateField error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateField = (req: AuthRequest, res: Response) => {
  try {
    const { fieldId } = req.params;
    const field = get('SELECT * FROM list_fields WHERE id = ?', [fieldId]);
    if (!field) return res.status(404).json({ success: false, error: 'Поле не найдено' });

    const { label, placeholder, required, options } = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (label !== undefined) { updates.push('label = ?'); params.push(label); }
    if (placeholder !== undefined) { updates.push('placeholder = ?'); params.push(placeholder); }
    if (required !== undefined) { updates.push('required = ?'); params.push(required ? 1 : 0); }
    if (options !== undefined) { updates.push('options = ?'); params.push(typeof options === 'string' ? options : JSON.stringify(options)); }

    params.push(fieldId);

    if (updates.length > 0) {
      run(`UPDATE list_fields SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Поле обновлено' });
  } catch (error) {
    console.error('UpdateField error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteField = (req: AuthRequest, res: Response) => {
  try {
    const { id, fieldId } = req.params;
    const field = get('SELECT * FROM list_fields WHERE id = ? AND listId = ?', [fieldId, id]);
    if (!field) return res.status(404).json({ success: false, error: 'Поле не найдено' });

    // Remove field values from all entries' answers JSON
    const entries = query('SELECT id, answers FROM list_entries WHERE listId = ?', [id]);
    for (const entry of entries) {
      try {
        const answers = JSON.parse(entry.answers || '{}');
        if (answers[fieldId] !== undefined) {
          delete answers[fieldId];
          run('UPDATE list_entries SET answers = ? WHERE id = ?', [JSON.stringify(answers), entry.id]);
        }
      } catch {}
    }

    run('DELETE FROM list_fields WHERE id = ?', [fieldId]);
    res.json({ success: true, message: 'Поле удалено' });
  } catch (error) {
    console.error('DeleteField error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const reorderFields = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ success: false, error: 'order массив обязателен' });

    order.forEach((fieldId: string, index: number) => {
      run('UPDATE list_fields SET position = ? WHERE id = ? AND listId = ?', [index, fieldId, id]);
    });

    res.json({ success: true, message: 'Порядок обновлён' });
  } catch (error) {
    console.error('ReorderFields error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Entries CRUD ──

export const createEntry = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const list = get('SELECT id FROM lists WHERE id = ?', [id]);
    if (!list) return res.status(404).json({ success: false, error: 'Список не найден' });

    const { lastName, firstName, patronymic, phone, email, comment, called, visited, answers } = req.body;

    const entryId = uuidv4();
    const answersStr = typeof answers === 'string' ? answers : JSON.stringify(answers || {});
    run('INSERT INTO list_entries (id, listId, lastName, firstName, patronymic, phone, email, comment, called, visited, answers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [entryId, id, lastName || '', firstName || '', patronymic || '', phone || '', email || '', comment || '', called ? 1 : 0, visited ? 1 : 0, answersStr]);

    const entry = get('SELECT * FROM list_entries WHERE id = ?', [entryId]);
    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    console.error('CreateEntry error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateEntry = (req: AuthRequest, res: Response) => {
  try {
    const { entryId } = req.params;
    const entry = get('SELECT * FROM list_entries WHERE id = ?', [entryId]);
    if (!entry) return res.status(404).json({ success: false, error: 'Запись не найдена' });

    const { lastName, firstName, patronymic, phone, email, comment, called, visited, answers } = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (lastName !== undefined) { updates.push('lastName = ?'); params.push(lastName); }
    if (firstName !== undefined) { updates.push('firstName = ?'); params.push(firstName); }
    if (patronymic !== undefined) { updates.push('patronymic = ?'); params.push(patronymic); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (comment !== undefined) { updates.push('comment = ?'); params.push(comment); }
    if (called !== undefined) { updates.push('called = ?'); params.push(called ? 1 : 0); }
    if (visited !== undefined) { updates.push('visited = ?'); params.push(visited ? 1 : 0); }
    if (answers !== undefined) { updates.push('answers = ?'); params.push(typeof answers === 'string' ? answers : JSON.stringify(answers)); }

    updates.push("updatedAt = datetime('now')");
    params.push(entryId);

    if (updates.length > 1) {
      run(`UPDATE list_entries SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updated = get('SELECT * FROM list_entries WHERE id = ?', [entryId]);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('UpdateEntry error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteEntry = (req: AuthRequest, res: Response) => {
  try {
    const { entryId } = req.params;
    const entry = get('SELECT id FROM list_entries WHERE id = ?', [entryId]);
    if (!entry) return res.status(404).json({ success: false, error: 'Запись не найдена' });

    run('DELETE FROM list_entries WHERE id = ?', [entryId]);
    res.json({ success: true, message: 'Удалено' });
  } catch (error) {
    console.error('DeleteEntry error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const toggleEntry = (req: AuthRequest, res: Response) => {
  try {
    const { entryId } = req.params;
    const { field } = req.body;
    if (field !== 'called' && field !== 'visited') {
      return res.status(400).json({ success: false, error: 'Поле должно быть called или visited' });
    }

    const entry = get(`SELECT * FROM list_entries WHERE id = ?`, [entryId]);
    if (!entry) return res.status(404).json({ success: false, error: 'Запись не найдена' });

    const newValue = entry[field] ? 0 : 1;
    run(`UPDATE list_entries SET ${field} = ?, updatedAt = datetime('now') WHERE id = ?`, [newValue, entryId]);

    res.json({ success: true, data: { [field]: newValue } });
  } catch (error) {
    console.error('ToggleEntry error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Export CSV ──

export const exportCSV = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const list = get('SELECT * FROM lists WHERE id = ?', [id]);
    if (!list) return res.status(404).json({ success: false, error: 'Список не найден' });

    const fields = query('SELECT * FROM list_fields WHERE listId = ? ORDER BY position ASC', [id]);
    const entries = query('SELECT * FROM list_entries WHERE listId = ? ORDER BY createdAt ASC', [id]);

    const hasCalled = fields.some((f: any) => f.type === 'toggle_called');
    const hasVisited = fields.some((f: any) => f.type === 'toggle_visited');
    const customFields = fields.filter((f: any) => f.type !== 'toggle_called' && f.type !== 'toggle_visited');

    const headers = ['№', 'Фамилия', 'Имя', 'Отчество', 'Телефон', 'Email', 'Комментарий',
      ...(hasCalled ? ['Обзвон'] : []), ...(hasVisited ? ['Посещение'] : []),
      ...customFields.map((f: any) => f.label)];

    const rows = entries.map((entry: any, i: number) => {
      const answers = JSON.parse(entry.answers || '{}');
      return [
        i + 1,
        entry.lastName || '',
        entry.firstName || '',
        entry.patronymic || '',
        entry.phone || '',
        entry.email || '',
        entry.comment || '',
        ...(hasCalled ? [entry.called ? 'Да' : 'Нет'] : []),
        ...(hasVisited ? [entry.visited ? 'Да' : 'Нет'] : []),
        ...customFields.map((f: any) => answers[f.id] || ''),
      ];
    });

    const bom = '\uFEFF';
    const csv = bom + [headers.join(';'), ...rows.map((r: any[]) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="list-${id}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('ExportCSV error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Export PDF (printable HTML) ──

export const exportPDF = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const list = get('SELECT * FROM lists WHERE id = ?', [id]);
    if (!list) return res.status(404).json({ success: false, error: 'Список не найден' });

    const fields = query('SELECT * FROM list_fields WHERE listId = ? ORDER BY position ASC', [id]);
    const entries = query('SELECT * FROM list_entries WHERE listId = ? ORDER BY createdAt ASC', [id]);
    const theme = req.query.theme === 'dark' ? 'dark' : 'light';

    const escapeHtml = (str: string) => (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Check if toggle fields are configured
    const hasCalled = fields.some((f: any) => f.type === 'toggle_called');
    const hasVisited = fields.some((f: any) => f.type === 'toggle_visited');
    const customFields = fields.filter((f: any) => f.type !== 'toggle_called' && f.type !== 'toggle_visited');

    const totalEntries = entries.length;
    const calledCount = entries.filter((e: any) => e.called).length;
    const visitedCount = entries.filter((e: any) => e.visited).length;

    const tableHeaders = ['№', 'Фамилия', 'Имя', 'Отчество', 'Телефон', 'Email', 'Комментарий',
      ...(hasCalled ? ['Обзон'] : []), ...(hasVisited ? ['Посещение'] : []),
      ...customFields.map((f: any) => escapeHtml(f.label))];

    const tableRows = entries.map((entry: any, i: number) => {
      const answers = JSON.parse(entry.answers || '{}');
      return [
        i + 1,
        escapeHtml(entry.lastName || '—'),
        escapeHtml(entry.firstName || '—'),
        escapeHtml(entry.patronymic || '—'),
        escapeHtml(entry.phone || '—'),
        escapeHtml(entry.email || '—'),
        escapeHtml(entry.comment || '—'),
        ...(hasCalled ? [entry.called ? 'Да' : 'Нет'] : []),
        ...(hasVisited ? [entry.visited ? 'Да' : 'Нет'] : []),
        ...customFields.map((f: any) => escapeHtml(answers[f.id] || '—')),
      ];
    });

    const lightStyles = `
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #333; font-size: 11px; background: #fff; }
      h1 { font-size: 18px; margin-bottom: 4px; color: #000; }
      .meta { font-size: 10px; color: #888; margin-bottom: 6px; }
      .stats { font-size: 10px; color: #555; margin-bottom: 16px; padding: 8px 12px; background: #f8f8f8; border-radius: 6px; display: inline-block; }
      .stats span { margin-right: 16px; }
      .stats b { color: #333; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th { background: #f0f0f0; text-align: left; padding: 6px 8px; border-bottom: 2px solid #ddd; font-weight: 600; white-space: nowrap; color: #333; }
      td { padding: 5px 8px; border-bottom: 1px solid #eee; color: #333; }
      tr:hover td { background: #fafafa; }
      .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; }
      .badge-yes { background: #dcfce7; color: #166534; }
      .badge-no { background: #fee2e2; color: #991b1b; }
    `;

    const darkStyles = `
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #e0e0e0; font-size: 11px; background: #0a0a0f; }
      h1 { font-size: 18px; margin-bottom: 4px; color: #00f0ff; text-shadow: 0 0 10px rgba(0,240,255,0.3); }
      .meta { font-size: 10px; color: #666; margin-bottom: 6px; }
      .stats { font-size: 10px; color: #aaa; margin-bottom: 16px; padding: 8px 12px; background: rgba(0,240,255,0.05); border: 1px solid rgba(0,240,255,0.15); border-radius: 6px; display: inline-block; }
      .stats span { margin-right: 16px; }
      .stats b { color: #00f0ff; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th { background: rgba(0,240,255,0.08); text-align: left; padding: 6px 8px; border-bottom: 1px solid rgba(0,240,255,0.2); font-weight: 600; white-space: nowrap; color: #00f0ff; }
      td { padding: 5px 8px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #ccc; }
      tr:hover td { background: rgba(0,240,255,0.04); }
      .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; }
      .badge-yes { background: rgba(0,255,136,0.15); color: #00ff88; }
      .badge-no { background: rgba(255,60,60,0.12); color: #ff6b6b; }
    `;

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(list.name)} — Список</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    ${theme === 'dark' ? darkStyles : lightStyles}
    @media print {
      body { padding: 0; }
      @page { margin: 12mm; }
      table { font-size: 9px; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(list.name)}</h1>
  <div class="meta">NEXUS CRM • Список${list.description ? ' • ' + escapeHtml(list.description) : ''} • ${new Date().toLocaleString('ru-RU')}</div>
  <div class="stats">
    <span>Всего записей: <b>${totalEntries}</b></span>
    ${hasCalled ? `<span>Обзвон: <b>${calledCount}</b></span>` : ''}
    ${hasVisited ? `<span>Посещение: <b>${visitedCount}</b></span>` : ''}
  </div>
  <table>
    <thead><tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows.map(row => {
      const calledIdx = hasCalled ? 7 : -1;
      const visitedIdx = hasVisited ? (hasCalled ? 8 : 7) : -1;
      return `<tr>${row.map((cell: any, ci: number) => {
        if (ci === calledIdx || ci === visitedIdx) {
          const cls = cell === 'Да' ? 'badge-yes' : 'badge-no';
          return `<td><span class="badge ${cls}">${cell}</span></td>`;
        }
        return `<td>${cell}</td>`;
      }).join('')}</tr>`;
    }).join('')}</tbody>
  </table>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('ExportPDF error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};