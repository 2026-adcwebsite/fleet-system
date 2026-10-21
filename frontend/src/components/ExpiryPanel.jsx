import { Link } from 'react-router-dom';
import { useCan } from '../auth/usePermission';
import { formatDate } from '../utils/dates';
import { label } from '../utils/format';
import { t } from '../i18n';

// "daysLeft" is decided by the server (Europe/Tirane); negative = already expired
function timeText(daysLeft) {
  if (daysLeft === 0) return t('dashboard.today');
  return daysLeft < 0 ? `${-daysLeft} ${t('dashboard.daysAgo')}` : `${daysLeft} ${t('dashboard.daysLeft')}`;
}

function VehicleList({ title, tone, items, emptyText }) {
  const can = useCan();
  const color = tone === 'red' ? 'text-red-700' : 'text-amber-700';
  return (
    <div>
      <h3 className={`mb-2 text-sm font-semibold ${color}`}>
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1 pr-3 font-medium">{t('dashboard.colPlate')}</th>
                <th className="py-1 pr-3 font-medium">{t('dashboard.colModelShort')}</th>
                <th className="py-1 pr-3 font-medium">{t('dashboard.colDepartment')}</th>
                <th className="py-1 pr-3 font-medium">{t('dashboard.colEnd')}</th>
                <th className="py-1 font-medium">{t('dashboard.colDays')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v.vehicleId} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3">
                    {can('fleet', 'view') ? (
                      <Link to={`/vehicles/${v.vehicleId}`} className="text-blue-700 hover:underline">{v.plate}</Link>
                    ) : (
                      v.plate
                    )}
                  </td>
                  <td className="py-1.5 pr-3">{label(v.model)}</td>
                  <td className="py-1.5 pr-3">{label(v.department)}</td>
                  <td className="py-1.5 pr-3">{formatDate(v.endDate)}</td>
                  <td className={`py-1.5 font-medium ${color}`}>{timeText(v.daysLeft)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// One panel (insurance or inspection): expired list, expiring list, and how many have no record.
export default function ExpiryPanel({ title, data, days }) {
  return (
    <section className="space-y-5 rounded border border-slate-200 bg-white p-4">
      <h2 className="font-semibold">{title}</h2>
      <VehicleList title={t('dashboard.expired')} tone="red" items={data.expired || []} emptyText={t('dashboard.nothingExpired')} />
      <VehicleList title={`${t('dashboard.expiring')} ${days} ${t('dashboard.daysOption')}`} tone="amber" items={data.expiring || []} emptyText={t('dashboard.nothingExpiring')} />
      <p className="border-t border-slate-100 pt-3 text-sm text-slate-600">
        {t('dashboard.missing')}: <span className="font-semibold">{data.missing ?? 0}</span> {t('dashboard.vehicles')}
      </p>
    </section>
  );
}
