import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFuelPrice, updateFuelPrice } from '../api/fuel';
import Modal from './Modal';
import FormField from './FormField';
import SelectField from './SelectField';
import { todayTirane } from '../utils/dates';
import { t } from '../i18n';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const toId = (v) => (v === '' ? null : Number.isNaN(Number(v)) ? v : Number(v));

// Add (record = null) or edit a fuel price. Supplier and fuel type cannot change when editing.
export default function PriceModal({ record, onClose }) {
  const qc = useQueryClient();
  const editing = Boolean(record);
  const [form, setForm] = useState({
    supplierId: str(record?.supplier?.id),
    fuelTypeId: str(record?.fuelType?.id),
    effectiveDate: str(record?.effectiveDate) || todayTirane(),
    pricePerL: str(record?.pricePerL),
  });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');

  const save = useMutation({
    mutationFn: () => {
      const price = { effectiveDate: form.effectiveDate, pricePerL: Number(form.pricePerL) };
      return editing
        ? updateFuelPrice(record.id, price)
        : createFuelPrice({ ...price, supplierId: toId(form.supplierId), fuelTypeId: toId(form.fuelTypeId) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fuel-prices'] });
      onClose();
    },
    onError: (err) => {
      setErrors(err.fieldErrors);
      if (Object.keys(err.fieldErrors).length === 0) setBanner(err.message); // 409: duplicate supplier + fuel + date
    },
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setSelect = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal title={editing ? t('prices.editTitle') : t('prices.newTitle')} onClose={onClose}>
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
        <div className="grid grid-cols-2 gap-4">
          <SelectField label={t('prices.field.supplier')} resource="suppliers" required disabled={editing} value={form.supplierId} onChange={setSelect('supplierId')} error={errors.supplierId} />
          <SelectField label={t('prices.field.fuel')} resource="fuel-types" required disabled={editing} value={form.fuelTypeId} onChange={setSelect('fuelTypeId')} error={errors.fuelTypeId} />
          <FormField label={t('prices.field.date')} type="date" required value={form.effectiveDate} onChange={set('effectiveDate')} error={errors.effectiveDate} />
          <FormField label={t('prices.field.price')} type="number" min="0" step="0.0001" required value={form.pricePerL} onChange={set('pricePerL')} error={errors.pricePerL} />
        </div>
        <p className="text-xs text-slate-500">{t('prices.hint')}</p>
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
