// Datas são strings locais YYYY-MM-DD e meses YYYY-MM, sem conversão de fuso.

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, '0');

/** Data local de `date` como YYYY-MM-DD. */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isValidISODate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** "2026-10-23" -> "2026-10" */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** addMonths("2026-01", -1) -> "2025-12" */
export function addMonths(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number) as [number, number];
  const total = year * 12 + (monthIndex - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Os `count` meses que terminam em `last`, do mais antigo para o mais recente. */
export function lastMonths(last: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(last, i - count + 1));
}

/** "2026-10-23" -> "23/10/2026" */
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/** "2026-10" -> "Outubro 2026" */
export function formatMonth(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number) as [number, number];
  return `${MONTH_NAMES[monthIndex - 1] ?? ''} ${year}`;
}

/** "2026-10" -> "Outubro" */
export function monthName(month: string): string {
  return MONTH_NAMES[Number(month.split('-')[1]) - 1] ?? '';
}
