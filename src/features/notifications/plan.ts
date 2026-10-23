import { addMonths, monthName, monthOf, toISODate } from '@/domain/dates';
import { formatBRL } from '@/domain/money';

export const NOTIFICATION_HOUR = 9;

export interface MonthClosingPlan {
  /** Mês resumido (YYYY-MM). */
  month: string;
  /** Dia 1 do mês seguinte, às 9h (hora local). */
  fireAt: Date;
  title: string;
  body: string;
  /** Deep link para o Resumo do mês. */
  url: string;
}

function firstDayAt9(month: string): Date {
  const [year, monthIndex] = month.split('-').map(Number) as [number, number];
  return new Date(year, monthIndex - 1, 1, NOTIFICATION_HOUR, 0, 0, 0);
}

/**
 * Próxima notificação de fechamento. Normalmente resume o mês atual e dispara no dia 1
 * do mês seguinte. Antes das 9h do dia 1, ainda resume o mês que acabou de fechar.
 * Sem gasto no mês resumido, não agenda nada.
 */
export function planMonthClosing(
  now: Date,
  records: { date: string; totalCents: number }[],
): MonthClosingPlan | null {
  const current = monthOf(toISODate(now));
  const month = now < firstDayAt9(current) ? addMonths(current, -1) : current;
  const spentCents = records
    .filter((r) => monthOf(r.date) === month)
    .reduce((sum, r) => sum + r.totalCents, 0);
  if (spentCents <= 0) return null;

  return {
    month,
    fireAt: firstDayAt9(addMonths(month, 1)),
    title: 'Fechamento do mês',
    body: `${monthName(month)}: você gastou ${formatBRL(spentCents)} em combustível`,
    url: `/monthly?month=${month}`,
  };
}
