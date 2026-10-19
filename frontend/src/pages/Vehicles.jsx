import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listVehicles } from '../api/vehicles';
import { itemLabel } from '../api/useLists';
import Table from '../components/Table';
import Pagination from '../components/Pagination';
import { t } from '../i18n';

// "2026-10-19" -> "19/10/2026"
function formatDate(value) {
  if (!value) return '—';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}

export default function Vehicles() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState('plate');
  const [order, setOrder] = useState('asc');

  const { data, isLoading, error } = useQuery({
    queryKey: ['vehicles', { page, pageSize, sort, order }],
    queryFn: () => listVehicles({ page, pageSize, sort, order }),
    placeholderData: (previous) => previous, // keep old rows while the next page loads
  });

  function handleSort(key) {
    if (key === sort) setOrder(order === 'asc' ? 'desc' : 'asc');
    else {
      setSort(key);
      setOrder('asc');
    }
    setPage(1);
  }

  const columns = [
    { key: 'plate', header: t('fleet.col.plate'), sortKey: 'plate' },
    { key: 'city', header: t('fleet.col.city'), render: (v) => v.city?.name ?? '—' },
    { key: 'model', header: t('fleet.col.model'), render: (v) => itemLabel(v.model) || '—' },
    { key: 'driver', header: t('fleet.col.driver'), render: (v) => v.driver?.name ?? '—' },
    { key: 'department', header: t('fleet.col.department'), render: (v) => v.department?.name ?? '—' },
    { key: 'status', header: t('fleet.col.status'), render: (v) => v.status?.name ?? '—' },
    { key: 'mileageKm', header: t('fleet.col.mileage'), sortKey: 'mileageKm', align: 'right' },
    { key: 'insuranceEnd', header: t('fleet.col.insuranceEnd'), render: (v) => formatDate(v.insuranceEnd) },
    { key: 'inspectionEnd', header: t('fleet.col.inspectionEnd'), render: (v) => formatDate(v.inspectionEnd) },
  ];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">{t('fleet.title')}</h1>

      {error && (
        <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </p>
      )}

      <Table
        columns={columns}
        rows={data?.items}
        loading={isLoading}
        sort={sort}
        order={order}
        onSort={handleSort}
      />

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
    </div>
  );
}
