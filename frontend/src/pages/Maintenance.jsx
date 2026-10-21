import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listServiceRecords, deleteServiceRecord } from '../api/serviceRecords';
import { exportUrl } from '../api/exports';
import { useCan } from '../auth/usePermission';
import Table from '../components/Table';
import Pagination from '../components/Pagination';
import VehiclePicker from '../components/VehiclePicker';
import ServiceModal from '../components/ServiceModal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField from '../components/FormField';
import { useDebounce } from '../hooks/useDebounce';
import { formatDate } from '../utils/dates';
import { formatMoney } from '../utils/format';
import { t } from '../i18n';

export default function Maintenance() {
  const qc = useQueryClient();
  const can = useCan();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState('serviceDate');
  const [order, setOrder] = useState('desc');
  const [searchText, setSearchText] = useState('');
  const [vehicle, setVehicle] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | record
  const [toDelete, setToDelete] = useState(null);
  const search = useDebounce(searchText, 300);

  const filters = { search, vehicleId: vehicle?.id, dateFrom, dateTo };
  const hasFilters = searchText || vehicle || dateFrom || dateTo;

  const { data, isLoading, error } = useQuery({
    queryKey: ['service-records', { page, pageSize, sort, order, ...filters }],
    queryFn: () => listServiceRecords({ page, pageSize, sort, order, ...filters }),
    placeholderData: (previous) => previous,
  });

  const remove = useMutation({
    mutationFn: () => deleteServiceRecord(toDelete.id),
    onSuccess: () => {
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ['service-records'] });
    },
  });

  function handleSort(key) {
    if (key === sort) setOrder(order === 'asc' ? 'desc' : 'asc');
    else {
      setSort(key);
      setOrder('asc');
    }
    setPage(1);
  }

  const reset = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  function clearFilters() {
    setSearchText('');
    setVehicle(null);
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  const columns = [
    { key: 'serviceDate', header: t('maintenance.col.date'), sortKey: 'serviceDate', render: (r) => formatDate(r.serviceDate) },
    { key: 'plate', header: t('maintenance.col.plate'), render: (r) => r.vehicle?.plate },
    { key: 'service', header: t('maintenance.col.service') },
    { key: 'provider', header: t('maintenance.col.provider') },
    { key: 'cost', header: t('maintenance.col.cost'), sortKey: 'cost', align: 'right', render: (r) => formatMoney(r.cost) },
    { key: 'description', header: t('maintenance.col.description'), render: (r) => <span className="line-clamp-2 max-w-xs">{r.description ?? '—'}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <span className="flex justify-end gap-3">
          {can('maintenance', 'edit') && (
            <button onClick={() => setModal(r)} className="text-blue-700 hover:underline">{t('common.edit')}</button>
          )}
          {can('maintenance', 'delete') && (
            <button onClick={() => setToDelete(r)} className="text-red-600 hover:underline">{t('common.delete')}</button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('maintenance.title')}</h1>
        <div className="flex gap-3">
          {can('maintenance', 'export') && (
            <a
              href={exportUrl('/exports/maintenance', { search, vehicleId: vehicle?.id, dateFrom, dateTo })}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100"
            >
              {t('common.export')}
            </a>
          )}
          {can('maintenance', 'create') && (
            <button onClick={() => setModal('new')} className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
              {t('maintenance.add')}
            </button>
          )}
        </div>
      </div>

      {error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}

      <div className="mb-4 grid grid-cols-1 items-end gap-3 md:grid-cols-4">
        <input
          type="search"
          aria-label={t('maintenance.search')}
          placeholder={t('maintenance.search')}
          value={searchText}
          onChange={(e) => reset(setSearchText)(e.target.value)}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <VehiclePicker label={t('maintenance.field.vehicle')} value={vehicle} onChange={reset(setVehicle)} />
        <FormField label={t('maintenance.from')} type="date" value={dateFrom} onChange={(e) => reset(setDateFrom)(e.target.value)} />
        <FormField label={t('maintenance.to')} type="date" value={dateTo} onChange={(e) => reset(setDateTo)(e.target.value)} />
      </div>
      {hasFilters && (
        <button onClick={clearFilters} className="mb-3 text-sm text-blue-700 hover:underline">{t('maintenance.clearFilters')}</button>
      )}

      {data && (
        <p className="mb-3 text-sm text-slate-700">
          {t('maintenance.totalCost')}: <span className="font-semibold">{formatMoney(data.totalCost)}</span>
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

      {modal && <ServiceModal record={modal === 'new' ? null : modal} onClose={() => setModal(null)} />}

      <ConfirmDialog
        open={toDelete !== null}
        title={t('maintenance.deleteTitle')}
        message={t('maintenance.deleteText')}
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
