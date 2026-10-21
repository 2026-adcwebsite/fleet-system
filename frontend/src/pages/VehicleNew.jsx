import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createVehicle } from '../api/vehicles';
import VehicleFields from '../components/VehicleFields';
import { EMPTY_FORM, toBody } from '../utils/vehicleForm';
import { t } from '../i18n';

export default function VehicleNew() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [banner, setBanner] = useState('');

  const create = useMutation({
    mutationFn: () => createVehicle(toBody(form, { create: true })),
    onSuccess: ({ vehicle }) => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      navigate(`/vehicles/${vehicle.id}`, { replace: true });
    },
    onError: (err) => {
      setFieldErrors(err.fieldErrors);
      if (Object.keys(err.fieldErrors).length === 0) setBanner(err.message);
    },
  });

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setSelect = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4">
      <Link to="/vehicles" className="text-sm text-blue-700 hover:underline">{t('vehicle.back')}</Link>
      <h1 className="text-xl font-semibold">{t('vehicle.newTitle')}</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFieldErrors({});
          setBanner('');
          create.mutate();
        }}
        className="space-y-4 rounded border border-slate-200 bg-white p-4"
      >
        {banner && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{banner}</p>}
        <VehicleFields form={form} set={set} setSelect={setSelect} errors={fieldErrors} canCreateLists />
        <button disabled={create.isPending} className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
          {create.isPending ? t('vehicle.creating') : t('vehicle.create')}
        </button>
      </form>
    </div>
  );
}
