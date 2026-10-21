import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserOptions, listUsers, deleteUser } from '../../api/users';
import { useAuth } from '../../auth/AuthContext';
import { useCan } from '../../auth/usePermission';
import Table from '../../components/Table';
import UserModal from '../../components/UserModal';
import ResetPasswordModal from '../../components/ResetPasswordModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { formatDateTime } from '../../utils/dates';
import { t } from '../../i18n';

const STATUS_CLASS = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-slate-200 text-slate-700',
  pending: 'bg-amber-100 text-amber-800',
};

export default function Users() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const can = useCan();
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | user (edit)
  const [resetFor, setResetFor] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const users = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const options = useQuery({ queryKey: ['user-options'], queryFn: getUserOptions, staleTime: 5 * 60 * 1000 });

  const remove = useMutation({
    mutationFn: () => deleteUser(toDelete.id),
    onSuccess: () => {
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const departments = useMemo(() => Object.fromEntries((options.data?.departments || []).map((d) => [d.id, d.name])), [options.data]);
  const rows = (users.data?.users || []).filter((u) =>
    `${u.name} ${u.surname} ${u.email} ${u.role}`.toLowerCase().includes(filter.toLowerCase()),
  );

  const columns = [
    {
      key: 'name',
      header: t('admin.users.col.name'),
      render: (u) => (
        <span>
          {u.name} {u.surname}
          {u.id === me.id && <span className="ml-2 text-xs text-slate-500">({t('admin.users.you')})</span>}
        </span>
      ),
    },
    { key: 'email', header: t('admin.users.col.email') },
    { key: 'role', header: t('admin.users.col.role') },
    { key: 'department', header: t('admin.users.col.department'), render: (u) => departments[u.departmentId] ?? '—' },
    {
      key: 'status',
      header: t('admin.users.col.status'),
      render: (u) => (
        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLASS[u.status] || 'bg-slate-100'}`}>{t(`admin.users.status.${u.status}`)}</span>
      ),
    },
    { key: 'lastLoginAt', header: t('admin.users.col.lastLogin'), render: (u) => formatDateTime(u.lastLoginAt) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (u) => (
        <span className="flex justify-end gap-3">
          {can('system', 'edit') && (
            <>
              <button onClick={() => setModal(u)} className="text-blue-700 hover:underline">{t('common.edit')}</button>
              <button onClick={() => setResetFor(u)} className="text-blue-700 hover:underline">{t('admin.users.reset')}</button>
            </>
          )}
          {can('system', 'delete') && u.id !== me.id && (
            <button onClick={() => setToDelete(u)} className="text-red-600 hover:underline">{t('common.delete')}</button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('admin.users.title')}</h1>
        {can('system', 'create') && options.data && (
          <button onClick={() => setModal('new')} className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
            {t('admin.users.add')}
          </button>
        )}
      </div>

      {(users.error || options.error) && (
        <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{(users.error || options.error).message}</p>
      )}

      <input
        type="search"
        aria-label={t('admin.search')}
        placeholder={t('admin.search')}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-4 w-full max-w-sm rounded border border-slate-300 bg-white px-3 py-2 text-sm"
      />

      <Table columns={columns} rows={rows} loading={users.isLoading} />

      {modal && options.data && (
        <UserModal user={modal === 'new' ? null : modal} options={options.data} isSelf={modal !== 'new' && modal.id === me.id} onClose={() => setModal(null)} />
      )}
      {resetFor && <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} />}

      <ConfirmDialog
        open={toDelete !== null}
        title={t('admin.users.deleteTitle')}
        message={`${t('admin.users.deleteText')} (${toDelete?.name} ${toDelete?.surname})`}
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
