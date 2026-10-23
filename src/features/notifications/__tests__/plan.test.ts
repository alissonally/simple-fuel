import { planMonthClosing } from '../plan';

const records = [
  { date: '2026-09-30', totalCents: 10000 },
  { date: '2026-10-01', totalCents: 20000 },
  { date: '2026-10-15', totalCents: 28730 },
];

describe('planMonthClosing', () => {
  it('summarizes the current month and fires on day 1 of the next month at 9h', () => {
    expect(planMonthClosing(new Date(2026, 9, 23, 15), records)).toEqual({
      month: '2026-10',
      fireAt: new Date(2026, 10, 1, 9, 0, 0, 0),
      title: 'Fechamento do mês',
      body: 'Outubro: você gastou R$ 487,30 em combustível',
      url: '/monthly?month=2026-10',
    });
  });

  it('does not schedule anything for a month without records', () => {
    expect(planMonthClosing(new Date(2026, 10, 5), records)).toBeNull();
    expect(planMonthClosing(new Date(2026, 9, 23), [])).toBeNull();
  });

  it('before 9h on day 1 still covers the month that just closed', () => {
    const plan = planMonthClosing(new Date(2026, 10, 1, 8, 30), records);
    expect(plan?.month).toBe('2026-10');
    expect(plan?.fireAt).toEqual(new Date(2026, 10, 1, 9));
  });

  it('crosses the year boundary', () => {
    const plan = planMonthClosing(new Date(2026, 11, 10), [
      { date: '2026-12-02', totalCents: 100 },
    ]);
    expect(plan?.fireAt).toEqual(new Date(2027, 0, 1, 9));
    expect(plan?.body).toBe('Dezembro: você gastou R$ 1,00 em combustível');
  });
});
