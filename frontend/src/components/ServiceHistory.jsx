import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listServiceRecords } from '../api/serviceRecords';
import { useCan } from '../auth/usePermission';
import ServiceModal from './ServiceModal';
import { formatDate } from '../utils/dates';
import { formatMoney } from '../utils/format';
import { t } from '../i18n';

// Service history list on the vehicle detail page. vehicle: { id, plate, model }
export default function ServiceHistory({ vehicle }) {
  const can = useCan();
  const [modal, setModal] = useState(null); // null | 'new' | record

  const { data, isLoading, error } = useQuery({
    queryKey: ['service-records', { vehicleId: vehicle.id, history: true }],
    queryFn: () => listServiceRecords({ vehicleId: vehicle.id, pageSize: 100, sort: 'serviceDate', order: 'desc' }),
  });

  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{t('maintenance.history')}</h2>
        {can('maintenance', 'create') && (
          <button onClick={() => setModal('new')} className="text-sm text-blue-700 hover:underline">
            + {t('maintenance.add')}
          </button>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error.message}</p>}
      {isLoading && <p className="text-sm text-slate-500">{t('app.loading')}</p>}
      {data && data.items.length === 0 && <p className="text-sm text-slate-500">{t('maintenance.noRecords')}</p>}

      {data && data.items.length > 0 && (
        <>
          <ul className="divide-y divide-slate-100 text-sm">
            {data.items.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="text-slate-500">{formatDate(r.serviceDate)}</span> · {r.service}
                  {r.provider ? <span className="text-slate-500"> · {r.provider}</span> : null}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span>{formatMoney(r.cost)}</span>
                  {can('maintenance', 'edit') && (
                    <button onClick={() => setModal(r)} className="text-blue-700 hover:underline">{t('common.edit')}</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-slate-700">
            {t('maintenance.totalCost')}: <span className="font-semibold">{formatMoney(data.totalCost)}</span>
          </p>
        </>
      )}

      {modal && (
        <ServiceModal
          record={modal === 'new' ? null : modal}
          defaultVehicle={{ id: vehicle.id, plate: vehicle.plate, model: vehicle.model }}
          onClose={() => setModal(null)}
        />
      )}
    </section>
  );
}
