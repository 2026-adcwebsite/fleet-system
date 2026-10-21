import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listFuelTransactions, deleteFuelTransaction } from '../../api/fuel';
import { useCan } from '../../auth/usePermission';
import Table from '../../components/Table';
import Pagination from '../../components/Pagination';
import VehiclePicker from '../../components/VehiclePicker';
import SelectField from '../../components/SelectField';
import FormField from '../../components/FormField';
import FuelModal from '../../components/FuelModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { formatDate } from '../../utils/dates';
import { formatMoney, label } from '../../utils/format';
import { t } from '../../i18n';

export default function FuelTransactions() {
  const qc = useQueryClient();
  const can = useCan();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState('date');
  const [order, setOrder] = useState('desc');
  const [vehicle, setVehicle] = useState(null);
  const [supplierId, setSupplierId] = useState('');
  const [fuelTypeId, setFuelTypeId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | record
  const [toDelete, setToDelete] = useState(null);
  const [warning, setWarning] = useState('');

  const filters = { vehicleId: vehicle?.id, supplierId, fuelTypeId, dateFrom, dateTo };
  const hasFilters = vehicle || supplierId || fuelTypeId || dateFrom || dateTo;

  const { data, isLoading, error } = useQuery({
    queryKey: ['fuel-transactions', { page, pageSize, sort, order, ...filters }],
    queryFn: () => listFuelTransactions({ page, pageSize, sort, order, ...filters }),
    placeholderData: (previous) => previous,
  });

  const remove = useMutation({
    mutationFn: () => deleteFuelTransaction(toDelete.id),
    onSuccess: () => {
      setToDelete(null);
      for (const key of ['fuel-transactions', 'rollouts', 'rollout', 'rollout-summary', 'reconciliation']) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });

  const reset = (setter) => (value) => {
    setter(value);
    setPage(1);
  };
  function clearFilters() {
    setVehicle(null);
    setSupplierId('');
    setFuelTypeId('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }
  function handleSort(key) {
    if (key === sort) setOrder(order === 'asc' ? 'desc' : 'asc');
    else {
      setSort(key);
      setOrder('asc');
    }
    setPage(1);
  }

  const columns = [
    { key: 'date', header: t('fuel.col.date'), sortKey: 'date', render: (r) => formatDate(r.date) },
    { key: 'plate', header: t('fuel.col.plate'), render: (r) => r.vehicle?.plate },
    { key: 'litres', header: t('fuel.col.litres'), sortKey: 'litres', align: 'right', render: (r) => formatMoney(r.litres) },
    {
      key: 'unitPrice',
      header: t('fuel.col.unitPrice'),
      align: 'right',
      render: (r) => (
        <span>
          {r.unitPrice ?? '—'}
          {r.priceEstimated && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">{t('fuel.estimated')}</span>}
        </span>
      ),
    },
    {
      key: 'amount',
      header: t('fuel.col.amount'),
      sortKey: 'amount',
      align: 'right',
      render: (r) => (r.amount === null || r.amount === undefined ? <span className="text-red-600">{t('fuel.noPrice')}</span> : formatMoney(r.amount)),
    },
    { key: 'supplier', header: t('fuel.col.supplier'), render: (r) => label(r.supplier) },
    { key: 'fuel', header: t('fuel.col.fuel'), render: (r) => label(r.fuelType) },
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
      <div className="mb-4 flex justify-end">
        {can('rollout', 'create') && (
          <button onClick={() => { setWarning(''); setModal('new'); }} className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
            {t('fuel.add')}
          </button>
        )}
      </div>

      {warning && <p role="status" className="mb-4 rounded bg-amber-50 p-3 text-sm text-amber-800">{warning}</p>}
      {error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}

      <div className="mb-3 grid grid-cols-1 items-end gap-3 md:grid-cols-5">
        <VehiclePicker label={t('fuel.field.vehicle')} value={vehicle} onChange={reset(setVehicle)} />
        <SelectField label={t('fuel.col.supplier')} resource="suppliers" value={supplierId} onChange={reset(setSupplierId)} />
        <SelectField label={t('fuel.col.fuel')} resource="fuel-types" value={fuelTypeId} onChange={reset(setFuelTypeId)} />
        <FormField label={t('fuel.from')} type="date" value={dateFrom} onChange={(e) => reset(setDateFrom)(e.target.value)} />
        <FormField label={t('fuel.to')} type="date" value={dateTo} onChange={(e) => reset(setDateTo)(e.target.value)} />
      </div>
      {hasFilters && <button onClick={clearFilters} className="mb-3 text-sm text-blue-700 hover:underline">{t('fuel.clearFilters')}</button>}

      {data && (
        <p className="mb-3 flex gap-6 text-sm text-slate-700">
          <span>{t('fuel.totalLitres')}: <span className="font-semibold">{formatMoney(data.totalLitres)}</span></span>
          <span>{t('fuel.totalAmount')}: <span className="font-semibold">{formatMoney(data.totalAmount)}</span></span>
        </p>
      )}

      <Table columns={columns} rows={data?.items} loading={isLoading} sort={sort} order={order} onSort={handleSort} />

      {data && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          pages={data.pages}
          total={data.total}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}

      {modal && (
        <FuelModal
          record={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={(res) => setWarning(res?.noPrice ? t('fuel.noPriceWarning') : '')}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title={t('fuel.deleteTitle')}
        message={t('fuel.deleteText')}
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
