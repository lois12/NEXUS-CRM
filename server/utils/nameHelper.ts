/**
 * Извлекает "Имя Отчество" из полного ФИО.
 * "Иванов Иван Иванович" → "Иван Иванович"
 * "Иван Иванович" → "Иван Иванович"
 * "Иван" → "Иван"
 */
export function getDisplayName(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 3) return `${parts[1]} ${parts[2]}`;
  if (parts.length === 2) return `${parts[0]} ${parts[1]}`;
  return parts[0];
}
