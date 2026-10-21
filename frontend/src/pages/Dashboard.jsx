import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../api/dashboard';
import { exportUrl } from '../api/exports';
import { useList } from '../api/useLists';
import { useAuth } from '../auth/AuthContext';
import { useCan } from '../auth/usePermission';
import ExpiryPanel from '../components/ExpiryPanel';
import SelectField from '../components/SelectField';
import { formatDate } from '../utils/dates';
import { label } from '../utils/format';
import { t } from '../i18n';

const DAYS = [7, 14, 30, 60, 90];

export default function Dashboard() {
  const { user } = useAuth();
  const can = useCan();
  const [days, setDays] = useState(30);
  const [departmentId, setDepartmentId] = useState('');
  const [make, setMake] = useState('');
  const [modelId, setModelId] = useState('');

  // makes for the filter come from the model list
  const { data: models = [] } = useList('vehicle-models');
  const makes = useMemo(() => [...new Set(models.map((m) => m.make))].sort(), [models]);

  const params = { days, departmentId, make, modelId };
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', params],
    queryFn: () => getDashboard(params),
    placeholderData: (previous) => previous,
  });

  const hasFilters = departmentId || make || modelId;
  const statuses = data?.fleet?.byStatus || [];
  const box = 'w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('nav.dashboard')}</h1>
          {data && <p className="text-sm text-slate-500">{t('dashboard.asOf')} {formatDate(data.asOf)}</p>}
        </div>
        {can('dashboard', 'export') && (
          <a href={exportUrl('/exports/dashboard', params)} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100">
            {t('common.export')}
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-5">
        <div>
          <label htmlFor="dash-days" className="mb-1 block text-sm font-medium text-slate-700">{t('dashboard.days')}</label>
          <select id="dash-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className={box}>
            {DAYS.map((d) => (
              <option key={d} value={d}>{d} {t('dashboard.daysOption')}</option>
            ))}
          </select>
        </div>
        {user.role !== 'dept_manager' && (
          <SelectField label={t('dashboard.department')} resource="departments" emptyLabel={t('dashboard.all')} value={departmentId} onChange={setDepartmentId} />
        )}
        <div>
          <label htmlFor="dash-make" className="mb-1 block text-sm font-medium text-slate-700">{t('dashboard.make')}</label>
          <select id="dash-make" value={make} onChange={(e) => setMake(e.target.value)} className={box}>
            <option value="">{t('dashboard.all')}</option>
            {makes.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <SelectField label={t('dashboard.model')} resource="vehicle-models" emptyLabel={t('dashboard.all')} value={modelId} onChange={setModelId} />
        {hasFilters && (
          <button
            onClick={() => {
              setDepartmentId('');
              setMake('');
              setModelId('');
            }}
            className="pb-2 text-left text-sm text-blue-700 hover:underline"
          >
            {t('dashboard.clear')}
          </button>
        )}
      </div>

      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
      {isLoading && <p className="text-slate-500">{t('app.loading')}</p>}

      {data && (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <div className="rounded border border-slate-200 bg-white px-4 py-3">
              <dt className="text-xs text-slate-500">{t('dashboard.total')}</dt>
              <dd className="text-2xl font-semibold">{data.fleet.total}</dd>
            </div>
            {statuses.map((s) => (
              <div key={s.id} className="rounded border border-slate-200 bg-white px-4 py-3">
                <dt className="text-xs text-slate-500">{s.name}</dt>
                <dd className="text-2xl font-semibold">{s.count}</dd>
              </div>
            ))}
          </dl>

          <section>
            <h2 className="mb-2 font-semibold">{t('dashboard.byModel')}</h2>
            <div className="overflow-x-auto rounded border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">{t('dashboard.colModel')}</th>
                    {statuses.map((s) => (
                      <th key={s.id} scope="col" className="px-3 py-2 text-right font-medium">{s.name}</th>
                    ))}
                    <th scope="col" className="px-3 py-2 text-right font-medium">{t('dashboard.colTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.byModel || []).length === 0 && (
                    <tr>
                      <td colSpan={statuses.length + 2} className="px-3 py-6 text-center text-slate-500">{t('dashboard.noData')}</td>
                    </tr>
                  )}
                  {(data.byModel || []).map((m) => (
                    <tr key={m.modelId} className="border-t border-slate-100">
                      <td className="px-3 py-2">{label({ make: m.make, model: m.model })}</td>
                      {statuses.map((s) => (
                        <td key={s.id} className="px-3 py-2 text-right">{m.byStatus?.[String(s.id)] || 0}</td>
                      ))}
                      <td className="px-3 py-2 text-right font-medium">{m.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ExpiryPanel title={t('dashboard.insurance')} data={data.insurance} days={data.days ?? days} />
            <ExpiryPanel title={t('dashboard.inspection')} data={data.inspection} days={data.days ?? days} />
          </div>
        </>
      )}
    </div>
  );
}
