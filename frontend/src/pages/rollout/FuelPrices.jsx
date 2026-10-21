import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listFuelPrices, deleteFuelPrice } from '../../api/fuel';
import { useCan } from '../../auth/usePermission';
import Table from '../../components/Table';
import SelectField from '../../components/SelectField';
import PriceModal from '../../components/PriceModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { formatDate } from '../../utils/dates';
import { label } from '../../utils/format';
import { t } from '../../i18n';

export default function FuelPrices() {
  const qc = useQueryClient();
  const can = useCan();
  const [supplierId, setSupplierId] = useState('');
  const [fuelTypeId, setFuelTypeId] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | record
  const [toDelete, setToDelete] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['fuel-prices', { supplierId, fuelTypeId }],
    queryFn: () => listFuelPrices({ supplierId, fuelTypeId }),
  });

  const remove = useMutation({
    mutationFn: () => deleteFuelPrice(toDelete.id),
    onSuccess: () => {
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ['fuel-prices'] });
    },
  });

  // Grouped by supplier, then fuel, newest price first (the list is not paginated)
  const rows = [...(data?.items || [])].sort(
    (a, b) =>
      label(a.supplier).localeCompare(label(b.supplier)) ||
      label(a.fuelType).localeCompare(label(b.fuelType)) ||
      String(b.effectiveDate).localeCompare(String(a.effectiveDate)),
  );

  const columns = [
    { key: 'supplier', header: t('prices.col.supplier'), render: (r) => label(r.supplier) },
    { key: 'fuel', header: t('prices.col.fuel'), render: (r) => label(r.fuelType) },
    { key: 'effectiveDate', header: t('prices.col.date'), render: (r) => formatDate(r.effectiveDate) },
    { key: 'pricePerL', header: t('prices.col.price'), align: 'right' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <span className="flex justify-end gap-3">
          {can('rollout', 'edit') && <button onClick={() => setModal(r)} className="text-blue-700 hover:underline">{t('common.edit')}</button>}
          {can('rollout', 'delete') && <button onClick={() => setToDelete(r)} className="text-red-600 hover:underline">{t('common.delete')}</button>}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label={t('prices.col.supplier')} resource="suppliers" value={supplierId} onChange={setSupplierId} />
          <SelectField label={t('prices.col.fuel')} resource="fuel-types" value={fuelTypeId} onChange={setFuelTypeId} />
        </div>
        {can('rollout', 'create') && (
          <button onClick={() => setModal('new')} className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
            {t('prices.add')}
          </button>
        )}
      </div>

      <p className="mb-3 text-sm text-slate-500">{t('prices.hint')}</p>
      {error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}

      <Table columns={columns} rows={rows} loading={isLoading} />

      {modal && <PriceModal record={modal === 'new' ? null : modal} onClose={() => setModal(null)} />}

      <ConfirmDialog
        open={toDelete !== null}
        title={t('prices.deleteTitle')}
        message={t('prices.deleteText')}
        error={remove.error?.message}
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => {
          setToDelete(null);
          remove.reset();
        }}
      />
    </div>
  );
}
