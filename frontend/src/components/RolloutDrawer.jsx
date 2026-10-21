import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRollout, deleteRollout } from '../api/rollouts';
import { createFuelTransaction } from '../api/fuel';
import { useCan } from '../auth/usePermission';
import Drawer from './Drawer';
import FormField from './FormField';
import ConfirmDialog from './ConfirmDialog';
import { formatDate } from '../utils/dates';
import { formatMoney, label } from '../utils/format';
import { defaultFillDate, formatMonth } from '../utils/months';
import { t } from '../i18n';

function Stat({ name, value, red }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{name}</dt>
      <dd className={`text-sm font-medium ${red ? 'text-red-600' : ''}`}>{value}</dd>
    </div>
  );
}

// Detail of one rollout row: numbers, its fuel transactions and a quick "Add fill-up".
export default function RolloutDrawer({ id, onClose, onEdit }) {
  const qc = useQueryClient();
  const can = useCan();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fill, setFill] = useState(null); // null = form closed
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null); // { kind: 'ok' | 'warn', text }

  const { data, isLoading, error } = useQuery({ queryKey: ['rollout', id], queryFn: () => getRollout(id) });
  const rollout = data?.rollout;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['rollouts'] });
    qc.invalidateQueries({ queryKey: ['rollout'] });
    qc.invalidateQueries({ queryKey: ['rollout-summary'] });
  };

  const addFill = useMutation({
    mutationFn: () =>
      createFuelTransaction({
        vehicleId: rollout.vehicle.id,
        date: fill.date,
        litres: Number(fill.litres),
        ...(fill.unitPrice !== '' ? { unitPrice: Number(fill.unitPrice) } : {}),
        supplierId: rollout.supplier.id,
        fuelTypeId: rollout.fuelType.id,
      }),
    onSuccess: (res) => {
      setNotice(res.noPrice ? { kind: 'warn', text: t('rollout.fillUp.noPrice') } : { kind: 'ok', text: t('rollout.fillUp.added') });
      setFill(null);
      refresh();
    },
    onError: (err) => {
      setErrors(err.fieldErrors);
      if (Object.keys(err.fieldErrors).length === 0) setNotice({ kind: 'error', text: err.message });
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteRollout(id),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });

  const noticeClass = { ok: 'bg-green-50 text-green-800', warn: 'bg-amber-50 text-amber-800', error: 'bg-red-50 text-red-700' };

  return (
    <Drawer title={rollout ? `${rollout.vehicle.plate} · ${formatMonth(rollout.yearMonth)}` : t('rollout.title')} onClose={onClose}>
      {isLoading && <p className="text-slate-500">{t('app.loading')}</p>}
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}

      {rollout && (
        <div className="space-y-6">
          <dl className="grid grid-cols-3 gap-4">
            <Stat name={t('rollout.col.city')} value={label(rollout.vehicle.city)} />
            <Stat name={t('rollout.col.model')} value={label(rollout.vehicle.model)} />
            <Stat name={t('rollout.col.driver')} value={label(rollout.vehicle.driver)} />
            <Stat name={t('rollout.col.chip')} value={rollout.chip || '—'} />
            <Stat name={t('rollout.col.company')} value={label(rollout.company)} />
            <Stat name={t('rollout.col.department')} value={label(rollout.department)} />
            <Stat name={t('rollout.col.supplier')} value={label(rollout.supplier)} />
            <Stat name={t('rollout.col.fuel')} value={label(rollout.fuelType)} />
            <Stat name={t('rollout.col.limit')} value={formatMoney(rollout.limitL)} />
            <Stat name={t('rollout.col.total')} value={formatMoney(rollout.totalL)} />
            <Stat name={t('rollout.col.remaining')} value={formatMoney(rollout.remainingL)} red={rollout.remainingL < 0} />
            <Stat name={t('rollout.col.amount')} value={formatMoney(rollout.amount)} />
          </dl>

          <div className="flex gap-4 text-sm">
            {can('rollout', 'edit') && (
              <button onClick={() => onEdit(rollout)} className="text-blue-700 hover:underline">{t('common.edit')}</button>
            )}
            {can('rollout', 'delete') && (
              <button onClick={() => setConfirmDelete(true)} className="text-red-600 hover:underline">{t('common.delete')}</button>
            )}
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">{t('rollout.transactions')}</h3>
              {can('rollout', 'create') && !fill && (
                <button
                  onClick={() => {
                    setNotice(null);
                    setErrors({});
                    setFill({ date: defaultFillDate(rollout.yearMonth), litres: '', unitPrice: '' });
                  }}
                  className="text-sm text-blue-700 hover:underline"
                >
                  + {t('rollout.addFillUp')}
                </button>
              )}
            </div>

            {notice && <p role="status" className={`mb-3 rounded p-3 text-sm ${noticeClass[notice.kind]}`}>{notice.text}</p>}

            {fill && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setErrors({});
                  setNotice(null);
                  addFill.mutate();
                }}
                className="mb-4 grid grid-cols-3 items-start gap-3 rounded border border-slate-200 bg-slate-50 p-3"
              >
                <FormField label={t('rollout.fillUp.date')} type="date" required value={fill.date} onChange={(e) => setFill({ ...fill, date: e.target.value })} error={errors.date} />
                <FormField label={t('rollout.fillUp.litres')} type="number" min="0" step="0.01" required value={fill.litres} onChange={(e) => setFill({ ...fill, litres: e.target.value })} error={errors.litres} />
                <FormField label={t('rollout.fillUp.price')} type="number" min="0" step="0.0001" value={fill.unitPrice} onChange={(e) => setFill({ ...fill, unitPrice: e.target.value })} error={errors.unitPrice} />
                <div className="col-span-3 flex gap-3">
                  <button disabled={addFill.isPending} className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-60">
                    {addFill.isPending ? t('common.saving') : t('common.save')}
                  </button>
                  <button type="button" onClick={() => setFill(null)} className="text-sm text-slate-600 hover:underline">{t('common.cancel')}</button>
                </div>
              </form>
            )}

            {data.transactions.length === 0 ? (
              <p className="text-sm text-slate-500">{t('rollout.noTransactions')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-1 font-medium">{t('rollout.fillUp.date')}</th>
                    <th className="py-1 text-right font-medium">{t('rollout.fillUp.litres')}</th>
                    <th className="py-1 text-right font-medium">{t('rollout.fillUp.price')}</th>
                    <th className="py-1 text-right font-medium">{t('rollout.col.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((x) => (
                    <tr key={x.id} className="border-t border-slate-100">
                      <td className="py-1.5">{formatDate(x.date)}</td>
                      <td className="py-1.5 text-right">{formatMoney(x.litres)}</td>
                      <td className="py-1.5 text-right">
                        {x.unitPrice ?? '—'}
                        {x.priceEstimated && (
                          <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">{t('rollout.fillUp.estimated')}</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right">{formatMoney(x.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t('rollout.deleteTitle')}
        message={t('rollout.deleteText')}
        error={remove.error?.message}
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => {
          setConfirmDelete(false);
          remove.reset();
        }}
      />
    </Drawer>
  );
}
