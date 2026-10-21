import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listRollouts, copyRollouts } from '../../api/rollouts';
import { exportUrl } from '../../api/exports';
import { useAuth } from '../../auth/AuthContext';
import { useCan } from '../../auth/usePermission';
import { useYearMonth } from '../../hooks/useYearMonth';
import { useDebounce } from '../../hooks/useDebounce';
import MonthPicker from '../../components/MonthPicker';
import Table from '../../components/Table';
import Pagination from '../../components/Pagination';
import SelectField from '../../components/SelectField';
import ConfirmDialog from '../../components/ConfirmDialog';
import RolloutModal from '../../components/RolloutModal';
import RolloutDrawer from '../../components/RolloutDrawer';
import { formatMoney, label } from '../../utils/format';
import { formatMonth, shiftMonth } from '../../utils/months';
import { t } from '../../i18n';

const NO_FILTERS = { departmentId: '', companyId: '', supplierId: '', fuelTypeId: '' };

const FILTERS = [
  ['departmentId', 'departments', 'rollout.col.department'],
  ['companyId', 'companies', 'rollout.col.company'],
  ['supplierId', 'suppliers', 'rollout.col.supplier'],
  ['fuelTypeId', 'fuel-types', 'rollout.col.fuel'],
];

function Summary({ summary }) {
  const items = [
    [t('rollout.summary.limit'), formatMoney(summary.totalLimitL), false],
    [t('rollout.summary.spent'), formatMoney(summary.totalSpentL), false],
    [t('rollout.summary.remaining'), formatMoney(summary.remainingL), summary.remainingL < 0],
    [t('rollout.summary.amount'), formatMoney(summary.totalAmount), false],
  ];
  return (
    <dl className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(([name, value, red]) => (
        <div key={name} className="rounded border border-slate-200 bg-white px-4 py-3">
          <dt className="text-xs text-slate-500">{name}</dt>
          <dd className={`text-lg font-semibold ${red ? 'text-red-600' : ''}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function RolloutSheet() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const can = useCan();
  const [ym, setYm] = useYearMonth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState('department');
  const [order, setOrder] = useState('asc');
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null); // null | 'new' | rollout (edit)
  const [copyOpen, setCopyOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const search = useDebounce(searchText, 300);

  const filterList = FILTERS.filter(([key]) => !(key === 'departmentId' && user.role === 'dept_manager'));
  const hasFilters = searchText !== '' || Object.values(filters).some(Boolean);

  const params = { yearMonth: ym, page, pageSize, sort, order, search, ...filters };
  const { data, isLoading, error } = useQuery({
    queryKey: ['rollouts', params],
    queryFn: () => listRollouts(params),
    // keep old rows while paging, but not while switching to another month
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1]?.yearMonth === ym ? previous : undefined),
  });

  const copy = useMutation({
    mutationFn: () => copyRollouts(shiftMonth(ym, -1), ym),
    onSuccess: (res) => {
      setCopyOpen(false);
      setNotice(`${t('rollout.created')}: ${res.created} · ${t('rollout.skipped')}: ${res.skipped}`);
      qc.invalidateQueries({ queryKey: ['rollouts'] });
      qc.invalidateQueries({ queryKey: ['rollout-summary'] });
    },
  });

  const changeMonth = (next) => {
    setYm(next);
    setPage(1);
    setNotice('');
  };
  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters(NO_FILTERS);
    setSearchText('');
    setPage(1);
  };
  function handleSort(key) {
    if (key === sort) setOrder(order === 'asc' ? 'desc' : 'asc');
    else {
      setSort(key);
      setOrder('asc');
    }
    setPage(1);
  }

  const num = (r) => formatMoney(r);
  const columns = [
    { key: 'plate', header: t('rollout.col.plate'), sortKey: 'plate', render: (r) => r.vehicle?.plate },
    { key: 'city', header: t('rollout.col.city'), render: (r) => label(r.vehicle?.city) },
    { key: 'model', header: t('rollout.col.model'), render: (r) => label(r.vehicle?.model) },
    { key: 'driver', header: t('rollout.col.driver'), render: (r) => label(r.vehicle?.driver) },
    { key: 'chip', header: t('rollout.col.chip') },
    { key: 'company', header: t('rollout.col.company'), render: (r) => label(r.company) },
    { key: 'department', header: t('rollout.col.department'), sortKey: 'department', render: (r) => label(r.department) },
    { key: 'supplier', header: t('rollout.col.supplier'), render: (r) => label(r.supplier) },
    { key: 'fuel', header: t('rollout.col.fuel'), render: (r) => label(r.fuelType) },
    { key: 'limitL', header: t('rollout.col.limit'), sortKey: 'limitL', align: 'right', render: (r) => num(r.limitL) },
    { key: 'w1', header: t('rollout.col.w1'), align: 'right', render: (r) => num(r.weeks?.[0]) },
    { key: 'w2', header: t('rollout.col.w2'), align: 'right', render: (r) => num(r.weeks?.[1]) },
    { key: 'w3', header: t('rollout.col.w3'), align: 'right', render: (r) => num(r.weeks?.[2]) },
    { key: 'w4', header: t('rollout.col.w4'), align: 'right', render: (r) => num(r.weeks?.[3]) },
    { key: 'totalL', header: t('rollout.col.total'), align: 'right', render: (r) => num(r.totalL) },
    {
      key: 'remainingL',
      header: t('rollout.col.remaining'),
      align: 'right',
      render: (r) => <span className={r.remainingL < 0 ? 'font-medium text-red-600' : ''}>{num(r.remainingL)}</span>,
    },
    { key: 'amount', header: t('rollout.col.amount'), align: 'right', render: (r) => num(r.amount) },
  ];

  const isEmptyMonth = data && data.total === 0 && !hasFilters;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MonthPicker value={ym} onChange={changeMonth} />
        <div className="flex flex-wrap gap-3">
          {can('rollout', 'create') && (
            <button onClick={() => setCopyOpen(true)} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100">
              {t('rollout.copy')}
            </button>
          )}
          {can('rollout', 'export') && (
            <a
              href={exportUrl('/exports/rollout', { yearMonth: ym, search, ...filters })}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100"
            >
              {t('common.export')}
            </a>
          )}
          {can('rollout', 'create') && (
            <button onClick={() => setModal('new')} className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
              {t('rollout.add')}
            </button>
          )}
        </div>
      </div>

      {notice && <p role="status" className="mb-4 rounded bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}

      {isEmptyMonth ? (
        <div className="rounded border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="mb-4 text-slate-600">
            {t('rollout.emptyTitle')} ({formatMonth(ym)})
          </p>
          {can('rollout', 'create') && (
            <div className="flex justify-center gap-3">
              <button onClick={() => setCopyOpen(true)} className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
                {t('rollout.copy')}
              </button>
              <button onClick={() => setModal('new')} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
                {t('rollout.add')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 space-y-3">
            <input
              type="search"
              aria-label={t('rollout.search')}
              placeholder={t('rollout.search')}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setPage(1);
              }}
              className="w-full max-w-sm rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-5">
              {filterList.map(([key, resource, labelKey]) => (
                <SelectField key={key} label={t(labelKey)} resource={resource} value={filters[key]} onChange={(v) => setFilter(key, v)} />
              ))}
              {hasFilters && (
                <button onClick={clearFilters} className="pb-2 text-left text-sm text-blue-700 hover:underline">{t('rollout.clearFilters')}</button>
              )}
            </div>
          </div>

          {data?.summary && <Summary summary={data.summary} />}

          <Table
            columns={columns}
            rows={data?.items}
            loading={isLoading}
            sort={sort}
            order={order}
            onSort={handleSort}
            onRowClick={(r) => setSelectedId(r.id)}
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
        </>
      )}

      {selectedId && <RolloutDrawer id={selectedId} onClose={() => setSelectedId(null)} onEdit={(r) => setModal(r)} />}
      {modal && <RolloutModal record={modal === 'new' ? null : modal} yearMonth={ym} onClose={() => setModal(null)} />}

      <ConfirmDialog
        open={copyOpen}
        variant="primary"
        title={`${t('rollout.copyTitle')}: ${formatMonth(shiftMonth(ym, -1))} → ${formatMonth(ym)}`}
        message={t('rollout.copyText')}
        confirmLabel={t('rollout.copyConfirm')}
        busyLabel={t('rollout.copying')}
        error={copy.error?.message}
        busy={copy.isPending}
        onConfirm={() => copy.mutate()}
        onCancel={() => {
          setCopyOpen(false);
          copy.reset();
        }}
      />
    </div>
  );
}
