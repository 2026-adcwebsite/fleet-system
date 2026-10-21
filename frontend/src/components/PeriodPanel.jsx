import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPeriod, updatePeriod, deletePeriod } from '../api/vehicles';
import FormField from './FormField';
import ConfirmDialog from './ConfirmDialog';
import { formatDate } from '../utils/dates';
import { t } from '../i18n';

// History + add/edit/delete for insurance or inspection periods.
// kind: 'insurances' | 'inspections'
export default function PeriodPanel({ title, kind, vehicleId, periods, canCreate, canEdit, canDelete }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // null | 'new' | period id
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['vehicle'] });
    qc.invalidateQueries({ queryKey: ['vehicles'] }); // list shows the latest end dates
  };

  const save = useMutation({
    mutationFn: () => {
      const body = { startDate: start, endDate: end };
      return editing === 'new' ? createPeriod(vehicleId, kind, body) : updatePeriod(vehicleId, kind, editing, body);
    },
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
    onError: (err) => setError(err.fieldErrors.endDate || err.fieldErrors.startDate || err.message),
  });

  const remove = useMutation({
    mutationFn: () => deletePeriod(vehicleId, kind, toDelete),
    onSuccess: () => {
      setToDelete(null);
      refresh();
    },
  });

  function open(period) {
    setError('');
    setEditing(period ? period.id : 'new');
    setStart(period ? period.startDate : '');
    setEnd(period ? period.endDate : '');
  }

  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {canCreate && editing === null && (
          <button onClick={() => open(null)} className="text-sm text-blue-700 hover:underline">
            + {t('common.add')}
          </button>
        )}
      </div>

      {editing !== null && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            save.mutate();
          }}
          className="mb-3 grid grid-cols-2 items-start gap-3"
        >
          <FormField label={t('vehicle.start')} type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
          <FormField label={t('vehicle.end')} type="date" required value={end} onChange={(e) => setEnd(e.target.value)} error={error} />
          <div className="col-span-2 flex gap-3">
            <button disabled={save.isPending} className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-60">
              {save.isPending ? t('common.saving') : t('common.save')}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="text-sm text-slate-600 hover:underline">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {periods.length === 0 ? (
        <p className="text-sm text-slate-500">{t('vehicle.noPeriods')}</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {periods.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span>
                {formatDate(p.startDate)} → {formatDate(p.endDate)}
              </span>
              <span className="flex gap-3">
                {canEdit && (
                  <button onClick={() => open(p)} className="text-blue-700 hover:underline">
                    {t('common.edit')}
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => setToDelete(p.id)} className="text-red-600 hover:underline">
                    {t('common.delete')}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={t('common.delete')}
        message={t('vehicle.removePeriod')}
        error={remove.error?.message}
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}
