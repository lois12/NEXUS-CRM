/** Маскирование персональных данных для «PDF с блюром»:
 *  телефон — последние 4 цифры скрыты, остальное видно,
 *  email — видны только первые 4 символа,
 *  фамилия — целиком. */

export function maskPhone(v?: string | null): string {
  if (!v) return '';
  const s = String(v);
  // прячем последние 4 цифры, остальные символы оставляем как есть
  const digitIdx: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] >= '0' && s[i] <= '9') digitIdx.push(i);
  }
  const hide = new Set(digitIdx.slice(-4));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    out += hide.has(i) ? '•' : s[i];
  }
  return out;
}

export function maskEmail(v?: string | null): string {
  if (!v) return '';
  const s = String(v);
  return s.slice(0, 4) + '•'.repeat(Math.max(s.length - 4, 0));
}

export function maskSurname(v?: string | null): string {
  if (!v) return '';
  return '•'.repeat(String(v).length);
}

/** ФИО одной строкой — блюрим первое слово (фамилию) */
export function maskFullName(v?: string | null): string {
  if (!v) return '';
  const s = String(v).trim();
  const idx = s.indexOf(' ');
  if (idx <= 0) return maskSurname(s);
  return maskSurname(s.slice(0, idx)) + ' ' + s.slice(idx + 1);
}

/** Свободный текст (открытые ответы) — маскируем email и телефоны по правилам выше */
export function maskTextPII(v: string): string {
  if (!v) return '';
  return String(v)
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => maskEmail(m))
    .replace(/\+?[\d\s\-().]{7,}/g, (m) => (m.replace(/\D/g, '').length >= 7 ? maskPhone(m) : m));
}
