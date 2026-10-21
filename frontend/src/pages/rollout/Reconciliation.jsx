import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getReconciliation, saveReconciliation } from '../../api/fuel';
import { useAuth } from '../../auth/AuthContext';
import { useCan } from '../../auth/usePermission';
import { useYearMonth } from '../../hooks/useYearMonth';
import MonthPicker from '../../components/MonthPicker';
import Table from '../../components/Table';
import { formatMoney, label } from '../../utils/format';
import { t } from '../../i18n';

// Editable number cell: saves when you leave the field (or press Enter) and the value changed.
function MoneyInput({ value, name, disabled, onCommit }) {
  const [text, setText] = useState(String(value ?? 0));
  useEffect(() => setText(String(value ?? 0)), [value]);

  function commit() {
    const n = Number(text === '' ? 0 : text);
    if (Number.isNaN(n)) return setText(String(value ?? 0));
    if (n !== Number(value ?? 0)) onCommit(n);
  }

  if (disabled) return <span>{formatMoney(value)}</span>;
  return (
    <input
      type="number"
      step="0.01"
      aria-label={name}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm"
    />
  );
}

export default function Reconciliation() {
  const { user } = useAuth();
  const can = useCan();
  const qc = useQueryClient();
  const [ym, setYm] = useYearMonth();
  const [errorTick, setErrorTick] = useState(0); // remounts the inputs after a failed save
  const [banner, setBanner] = useState('');

  // The server answers 403 for department managers: the tab is hidden, so send them back
  if (user.role === 'dept_manager') return <Navigate to="/rollout" replace />;

  const { data, isLoading, error } = useQuery({
    queryKey: ['reconciliation', ym],
    queryFn: () => getReconciliation(ym),
  });

  const save = useMutation({
    mutationFn: (vars) => saveReconciliation({ yearMonth: ym, ...vars }),
    onSuccess: ({ item }) => {
      setBanner('');
      // the other columns are recalculated by the server: replace the row with its answer
      qc.setQueryData(['reconciliation', ym], (old) => ({
        ...old,
        items: old.items.map((r) =>
          r.supplierId === item.supplierId && r.fuelTypeId === item.fuelTypeId ? { ...r, ...item } : r,
        ),
      }));
    },
    onError: (err) => {
      setBanner(err.message);
      setErrorTick((n) => n + 1);
    },
  });

  const canEdit = can('rollout', 'edit');
  const commit = (row, field) => (n) =>
    save.mutate({
      supplierId: row.supplierId,
      fuelTypeId: row.fuelTypeId,
      purchased: field === 'purchased' ? n : Number(row.purchased ?? 0),
      platformAmount: field === 'platformAmount' ? n : Number(row.platformAmount ?? 0),
    });

  const off = (r) => Math.abs(Number(r.errorMargin || 0)) > 0.005;
  const rows = (data?.items || []).map((r) => ({ ...r, id: `${r.supplierId}-${r.fuelTypeId}` }));

  const columns = [
    { key: 'supplier', header: t('recon.supplier'), render: (r) => label(r.supplier) },
    { key: 'fuel', header: t('recon.fuel'), render: (r) => label(r.fuelType) },
    {
      key: 'purchased',
      header: t('recon.purchased'),
      align: 'right',
      render: (r) => <MoneyInput key={`p${errorTick}`} name={t('recon.purchased')} value={r.purchased} disabled={!canEdit} onCommit={commit(r, 'purchased')} />,
    },
    {
      key: 'platformAmount',
      header: t('recon.platform'),
      align: 'right',
      render: (r) => <MoneyInput key={`a${errorTick}`} name={t('recon.platform')} value={r.platformAmount} disabled={!canEdit} onCommit={commit(r, 'platformAmount')} />,
    },
    { key: 'spentAmount', header: t('recon.spentAmount'), align: 'right', render: (r) => formatMoney(r.spentAmount) },
    { key: 'spentLitres', header: t('recon.spentLitres'), align: 'right', render: (r) => formatMoney(r.spentLitres) },
    { key: 'difference', header: t('recon.difference'), align: 'right', render: (r) => formatMoney(r.difference) },
    {
      key: 'errorMargin',
      header: t('recon.errorMargin'),
      align: 'right',
      render: (r) => <span className={off(r) ? 'rounded bg-red-100 px-2 py-0.5 font-semibold text-red-700' : ''}>{formatMoney(r.errorMargin)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <MonthPicker value={ym} onChange={setYm} />
      <p className="text-sm text-slate-500">{t('recon.hint')}</p>
      {banner && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{banner}</p>}
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
      <Table columns={columns} rows={rows} loading={isLoading} emptyText={t('recon.none')} />
    </div>
  );
}
