import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRollout, updateRollout } from '../api/rollouts';
import Modal from './Modal';
import FormField from './FormField';
import SelectField from './SelectField';
import VehiclePicker from './VehiclePicker';
import { formatMonth } from '../utils/months';
import { t } from '../i18n';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const toId = (v) => (v === '' ? null : Number.isNaN(Number(v)) ? v : Number(v));

// Add (record = null) or edit a rollout. Vehicle and month cannot change when editing.
export default function RolloutModal({ record, yearMonth, onClose }) {
  const qc = useQueryClient();
  const editing = Boolean(record);
  const [vehicle, setVehicle] = useState(record ? record.vehicle : null);
  const [form, setForm] = useState({
    chip: str(record?.chip),
    limitL: str(record?.limitL),
    supplierId: str(record?.supplier?.id),
    fuelTypeId: str(record?.fuelType?.id),
    departmentId: str(record?.department?.id),
    companyId: str(record?.company?.id),
  });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');

  const save = useMutation({
    mutationFn: () => {
      const body = {
        limitL: Number(form.limitL),
        supplierId: toId(form.supplierId),
        fuelTypeId: toId(form.fuelTypeId),
        departmentId: toId(form.departmentId),
        companyId: toId(form.companyId),
        chip: form.chip,
      };
      if (editing) return updateRollout(record.id, body);
      // Create: leave out empty optional fields; the server uses the vehicle's department and company
      for (const k of ['chip', 'departmentId', 'companyId']) if (body[k] === '' || body[k] === null) delete body[k];
      return createRollout({ ...body, vehicleId: vehicle?.id, yearMonth });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rollouts'] });
      qc.invalidateQueries({ queryKey: ['rollout'] });
      qc.invalidateQueries({ queryKey: ['rollout-summary'] });
      onClose();
    },
    onError: (err) => {
      setErrors(err.fieldErrors);
      if (Object.keys(err.fieldErrors).length === 0) setBanner(err.message); // e.g. 409: already has a rollout this month
    },
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setSelect = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal title={`${editing ? t('rollout.editTitle') : t('rollout.newTitle')} · ${formatMonth(yearMonth)}`} onClose={onClose}>
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

        <VehiclePicker label={t('rollout.field.vehicle')} value={vehicle} onChange={setVehicle} disabled={editing} error={errors.vehicleId} />
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('rollout.field.limit')} type="number" min="0" step="0.01" required value={form.limitL} onChange={set('limitL')} error={errors.limitL} />
          <FormField label={t('rollout.field.chip')} value={form.chip} onChange={set('chip')} error={errors.chip} />
          <SelectField label={t('rollout.field.supplier')} resource="suppliers" required value={form.supplierId} onChange={setSelect('supplierId')} error={errors.supplierId} />
          <SelectField label={t('rollout.field.fuel')} resource="fuel-types" required value={form.fuelTypeId} onChange={setSelect('fuelTypeId')} error={errors.fuelTypeId} />
          <SelectField label={t('rollout.field.department')} resource="departments" value={form.departmentId} onChange={setSelect('departmentId')} error={errors.departmentId} />
          <SelectField label={t('rollout.field.company')} resource="companies" value={form.companyId} onChange={setSelect('companyId')} error={errors.companyId} />
        </div>

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
