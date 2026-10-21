import { useQuery } from '@tanstack/react-query';
import { getRolloutSummary } from '../../api/rollouts';
import { useYearMonth } from '../../hooks/useYearMonth';
import MonthPicker from '../../components/MonthPicker';
import { formatMoney, label } from '../../utils/format';
import { t } from '../../i18n';

// Small table with a totals row. columns: [{ key, header, render?(row), align? }]
function RecapTable({ title, columns, rows, litresKey = 'litres', amountKey = 'amount' }) {
  const sum = (key) => rows.reduce((total, r) => total + Number(r[key] || 0), 0);
  const align = (c) => (c.align === 'right' ? 'text-right' : 'text-left');

  return (
    <section>
      <h2 className="mb-2 font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`px-3 py-2 font-medium ${align(c)}`}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">{t('rollout.recap.none')}</td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 ${align(c)}`}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td className="px-3 py-2" colSpan={columns.length - 2}>{t('rollout.recap.total')}</td>
                <td className="px-3 py-2 text-right">{formatMoney(sum(litresKey))}</td>
                <td className="px-3 py-2 text-right">{formatMoney(sum(amountKey))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

export default function RolloutRecap() {
  const [ym, setYm] = useYearMonth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['rollout-summary', ym],
    queryFn: () => getRolloutSummary(ym),
  });

  const money = { align: 'right' };
  const departmentCols = [
    { key: 'department', header: t('rollout.col.department'), render: (r) => label(r.department) },
    { key: 'company', header: t('rollout.col.company'), render: (r) => label(r.company) },
    { key: 'supplier', header: t('rollout.col.supplier'), render: (r) => label(r.supplier) },
    { key: 'litres', header: t('rollout.recap.litres'), ...money, render: (r) => formatMoney(r.litres) },
    { key: 'amount', header: t('rollout.recap.amount'), ...money, render: (r) => formatMoney(r.amount) },
  ];
  const supplierCols = [
    { key: 'supplier', header: t('rollout.col.supplier'), render: (r) => label(r.supplier) },
    { key: 'fuelType', header: t('rollout.col.fuel'), render: (r) => label(r.fuelType) },
    { key: 'litres', header: t('rollout.recap.litres'), ...money, render: (r) => formatMoney(r.litres) },
    { key: 'amount', header: t('rollout.recap.amount'), ...money, render: (r) => formatMoney(r.amount) },
  ];

  return (
    <div className="space-y-6">
      <MonthPicker value={ym} onChange={setYm} />
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
      {isLoading && <p className="text-slate-500">{t('app.loading')}</p>}
      {data && (
        <>
          <RecapTable title={t('rollout.recap.byDepartment')} columns={departmentCols} rows={data.byDepartment || []} />
          <RecapTable title={t('rollout.recap.bySupplierFuel')} columns={supplierCols} rows={data.bySupplierFuel || []} />
        </>
      )}
    </div>
  );
}
