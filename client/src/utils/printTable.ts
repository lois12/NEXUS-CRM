import { formatDateKR } from './timezone';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function printTable(title: string, headers: string[], rows: string[][]) {
  const safeTitle = escapeHtml(title);
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { font-size: 11px; color: #888; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f5f5f5; text-align: left; padding: 8px 12px; border-bottom: 2px solid #ddd; font-weight: 600; }
    td { padding: 6px 12px; border-bottom: 1px solid #eee; }
    tr:hover td { background: #fafafa; }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <div class="meta">NEXUS CRM • ${formatDateKR(new Date(), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
  <table>
    <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell ? escapeHtml(cell) : '—'}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.print();
  }
}