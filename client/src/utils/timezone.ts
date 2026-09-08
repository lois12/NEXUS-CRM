// Auto-detect user timezone from browser
const USER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function formatTimeKR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: USER_TZ });
}

export function formatDateKR(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ru-RU', { timeZone: USER_TZ, ...options });
}

export function formatDateTimeKR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: USER_TZ });
}

export function formatLastSeenKR(lastSeen?: string): string {
  if (!lastSeen) return 'Нет данных';
  const diff = Date.now() - new Date(lastSeen).getTime();
  if (diff < 60000) return 'только что';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
  return formatDateTimeKR(lastSeen);
}

export function isTodayKR(date: Date | string): boolean {
  const d = new Date(date);
  const now = new Date();
  const dLocal = new Date(d.toLocaleString('en-US', { timeZone: USER_TZ }));
  const nowLocal = new Date(now.toLocaleString('en-US', { timeZone: USER_TZ }));
  return dLocal.toDateString() === nowLocal.toDateString();
}

export function isYesterdayKR(date: Date | string): boolean {
  const d = new Date(date);
  const now = new Date();
  const dLocal = new Date(d.toLocaleString('en-US', { timeZone: USER_TZ }));
  const yesterdayLocal = new Date(now.toLocaleString('en-US', { timeZone: USER_TZ }));
  yesterdayLocal.setDate(yesterdayLocal.getDate() - 1);
  return dLocal.toDateString() === yesterdayLocal.toDateString();
}
