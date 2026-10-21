import { formatMonth, monthName, shiftMonth, currentYearMonth } from '../utils/months';
import { t } from '../i18n';

// value / onChange use integers like 202610
export default function MonthPicker({ value, onChange }) {
  const year = Math.floor(value / 100);
  const month = value % 100;
  const nowYear = Math.floor(currentYearMonth() / 100);
  const years = [];
  for (let y = Math.min(nowYear - 5, year); y <= Math.max(nowYear + 2, year); y++) years.push(y);

  const box = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';
  return (
    <div className="flex items-center gap-2" title={formatMonth(value)}>
      <button type="button" aria-label={t('rollout.prevMonth')} onClick={() => onChange(shiftMonth(value, -1))} className={`${box} hover:bg-slate-100`}>
        ‹
      </button>
      <select aria-label={t('rollout.month')} value={month} onChange={(e) => onChange(year * 100 + Number(e.target.value))} className={box}>
        {Array.from({ length: 12 }, (_, i) => (
          <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>
        ))}
      </select>
      <select aria-label={t('rollout.year')} value={year} onChange={(e) => onChange(Number(e.target.value) * 100 + month)} className={box}>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <button type="button" aria-label={t('rollout.nextMonth')} onClick={() => onChange(shiftMonth(value, 1))} className={`${box} hover:bg-slate-100`}>
        ›
      </button>
    </div>
  );
}
