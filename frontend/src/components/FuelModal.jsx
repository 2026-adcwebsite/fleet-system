import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFuelTransaction, updateFuelTransaction } from '../api/fuel';
import { listRollouts } from '../api/rollouts';
import Modal from './Modal';
import FormField from './FormField';
import SelectField from './SelectField';
import VehiclePicker from './VehiclePicker';
import { todayTirane } from '../utils/dates';
import { t } from '../i18n';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const toId = (v) => (v === '' ? null : Number.isNaN(Number(v)) ? v : Number(v));
const monthOf = (date) => Number(date.slice(0, 4)) * 100 + Number(date.slice(5, 7));

// Add (record = null) or edit a fuel transaction.
// onSaved(result) is called after a successful save (result.noPrice is set on create).
export default function FuelModal({ record, onClose, onSaved }) {
  const qc = useQueryClient();
  const editing = Boolean(record);
  const [vehicle, setVehicle] = useState(record ? record.vehicle : null);
  const [form, setForm] = useState({
    date: str(record?.date) || todayTirane(),
    litres: str(record?.litres),
    unitPrice: str(record?.unitPrice),
    supplierId: str(record?.supplier?.id),
    fuelTypeId: str(record?.fuelType?.id),
  });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');

  // Supplier and fuel type default from the vehicle's rollout of that month.
  // If the vehicle has none, they are required: ask the server and show the fields.
  const ym = form.date.length === 10 ? monthOf(form.date) : null;
  const check = useQuery({
    queryKey: ['rollout-check', vehicle?.id, ym],
    queryFn: () => listRollouts({ vehicleId: vehicle.id, yearMonth: ym, pageSize: 1 }),
    enabled: !editing && Boolean(vehicle && ym),
  });
  const noRollout = check.data?.total === 0;
  const showSupplier = editing || noRollout || Boolean(errors.supplierId || errors.fuelTypeId);

  const save = useMutation({
    mutationFn: () => {
      const body = { date: form.date, litres: Number(form.litres) };
      if (form.unitPrice !== '') body.unitPrice = Number(form.unitPrice);
      if (showSupplier) {
        if (form.supplierId) body.supplierId = toId(form.supplierId);
        if (form.fuelTypeId) body.fuelTypeId = toId(form.fuelTypeId);
      }
      return editing ? updateFuelTransaction(record.id, body) : createFuelTransaction({ ...body, vehicleId: vehicle?.id });
    },
    onSuccess: (res) => {
      for (const key of ['fuel-transactions', 'rollouts', 'rollout', 'rollout-summary', 'reconciliation']) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      onSaved?.(res);
      onClose();
    },
    onError: (err) => {
      setErrors(err.fieldErrors);
      if (Object.keys(err.fieldErrors).length === 0) setBanner(err.message);
    },
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setSelect = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal title={editing ? t('fuel.editTitle') : t('fuel.newTitle')} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErrors({});
          setBanner('');
          save.mutate();
        }}
        className="space-y-4"
      >
        {banner && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{banner}</p>}

        <VehiclePicker label={t('fuel.field.vehicle')} value={vehicle} onChange={setVehicle} disabled={editing} error={errors.vehicleId} />
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('fuel.field.date')} type="date" required value={form.date} onChange={set('date')} error={errors.date} />
          <FormField label={t('fuel.field.litres')} type="number" min="0" step="0.01" required value={form.litres} onChange={set('litres')} error={errors.litres} />
        </div>
        <FormField label={t('fuel.field.unitPrice')} type="number" min="0" step="0.0001" value={form.unitPrice} onChange={set('unitPrice')} error={errors.unitPrice} />
        <p className="-mt-2 text-xs text-slate-500">{t('fuel.priceHint')}</p>

        {showSupplier && (
          <div className="space-y-3">
            {!editing && noRollout && <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">{t('fuel.needsSupplier')}</p>}
            <div className="grid grid-cols-2 gap-4">
              <SelectField label={t('fuel.field.supplier')} resource="suppliers" value={form.supplierId} onChange={setSelect('supplierId')} error={errors.supplierId} />
              <SelectField label={t('fuel.field.fuel')} resource="fuel-types" value={form.fuelTypeId} onChange={setSelect('fuelTypeId')} error={errors.fuelTypeId} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">{t('common.cancel')}</button>
          <button disabled={save.isPending} className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
