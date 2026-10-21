import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createServiceRecord, updateServiceRecord } from '../api/serviceRecords';
import Modal from './Modal';
import FormField from './FormField';
import VehiclePicker from './VehiclePicker';
import { t } from '../i18n';

const str = (v) => (v === null || v === undefined ? '' : String(v));

// Add or edit a service record.
// record: existing record (edit) or null (add). defaultVehicle: preselected vehicle for add.
export default function ServiceModal({ record, defaultVehicle, onClose }) {
  const qc = useQueryClient();
  const editing = Boolean(record);
  const [vehicle, setVehicle] = useState(record ? record.vehicle : defaultVehicle || null);
  const [form, setForm] = useState({
    service: str(record?.service),
    serviceDate: str(record?.serviceDate),
    provider: str(record?.provider),
    cost: str(record?.cost),
    description: str(record?.description),
  });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');

  const save = useMutation({
    mutationFn: () => {
      const body = {
        vehicleId: vehicle?.id,
        service: form.service,
        serviceDate: form.serviceDate || null,
        provider: form.provider,
        description: form.description,
      };
      if (form.cost !== '') body.cost = Number(form.cost);
      else if (editing) body.cost = null;
      if (!editing) {
        for (const k of ['provider', 'description']) if (body[k] === '') delete body[k];
        if (body.serviceDate === null) delete body.serviceDate;
      }
      return editing ? updateServiceRecord(record.id, body) : createServiceRecord(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-records'] });
      onClose();
    },
    onError: (err) => {
      setErrors(err.fieldErrors);
      if (Object.keys(err.fieldErrors).length === 0) setBanner(err.message);
    },
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Modal title={editing ? t('maintenance.editTitle') : t('maintenance.newTitle')} onClose={onClose}>
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

        <VehiclePicker label={t('maintenance.field.vehicle')} value={vehicle} onChange={setVehicle} error={errors.vehicleId} />
        <FormField label={t('maintenance.field.service')} required maxLength={200} value={form.service} onChange={set('service')} error={errors.service} />
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('maintenance.field.date')} type="date" value={form.serviceDate} onChange={set('serviceDate')} error={errors.serviceDate} />
          <FormField label={t('maintenance.field.cost')} type="number" min="0" step="0.01" value={form.cost} onChange={set('cost')} error={errors.cost} />
        </div>
        <FormField label={t('maintenance.field.provider')} value={form.provider} onChange={set('provider')} error={errors.provider} />

        <div>
          <label htmlFor="svc-desc" className="mb-1 block text-sm font-medium text-slate-700">{t('maintenance.field.description')}</label>
          <textarea
            id="svc-desc"
            rows={3}
            maxLength={2000}
            value={form.description}
            onChange={set('description')}
            aria-invalid={errors.description ? 'true' : undefined}
            className={`w-full rounded border px-3 py-2 text-sm ${errors.description ? 'border-red-500' : 'border-slate-300'}`}
          />
          {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
            {t('common.cancel')}
          </button>
          <button disabled={save.isPending} className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
