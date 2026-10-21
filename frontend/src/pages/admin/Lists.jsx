import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteItem } from '../../api/lists';
import { itemLabel, useList } from '../../api/useLists';
import { useCan } from '../../auth/usePermission';
import Table from '../../components/Table';
import ListItemModal from '../../components/ListItemModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { t } from '../../i18n';

// [resource, module that controls writing to it]
const RESOURCES = [
  ['departments', 'system'],
  ['companies', 'system'],
  ['suppliers', 'system'],
  ['fuel-types', 'system'],
  ['vehicle-statuses', 'system'],
  ['cities', 'fleet'],
  ['drivers', 'fleet'],
  ['vehicle-models', 'fleet'],
];

export default function Lists() {
  const qc = useQueryClient();
  const can = useCan();
  const [resource, setResource] = useState(RESOURCES[0][0]);
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | item (rename)
  const [toDelete, setToDelete] = useState(null);

  const writeModule = RESOURCES.find(([r]) => r === resource)[1];
  const { data: items = [], isLoading, error } = useList(resource);

  const remove = useMutation({
    mutationFn: () => deleteItem(resource, toDelete.id), // 409 when the item is still in use
    onSuccess: () => {
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ['list', resource] });
    },
  });

  const rows = items
    .filter((i) => itemLabel(i).toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => itemLabel(a).localeCompare(itemLabel(b)));

  const columns = [
    { key: 'label', header: t('admin.lists.name'), render: (i) => itemLabel(i) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (i) => (
        <span className="flex justify-end gap-3">
          {can(writeModule, 'edit') && <button onClick={() => setModal(i)} className="text-blue-700 hover:underline">{t('common.edit')}</button>}
          {can(writeModule, 'delete') && <button onClick={() => setToDelete(i)} className="text-red-600 hover:underline">{t('common.delete')}</button>}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('admin.lists.title')}</h1>
        {can(writeModule, 'create') && (
          <button onClick={() => setModal('new')} className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
            + {t('admin.lists.add')}
          </button>
        )}
      </div>

      <div role="tablist" aria-label={t('admin.lists.title')} className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {RESOURCES.map(([r]) => (
          <button
            key={r}
            role="tab"
            aria-selected={r === resource}
            onClick={() => {
              setResource(r);
              setFilter('');
            }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              r === resource ? 'border-blue-700 font-medium text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t(`admin.lists.resource.${r}`)}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}

      <div className="mb-3 flex items-center gap-4">
        <input
          type="search"
          aria-label={t('admin.search')}
          placeholder={t('admin.search')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full max-w-sm rounded border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <span className="text-sm text-slate-500">{rows.length} {t('admin.lists.count')}</span>
      </div>

      <Table columns={columns} rows={rows} loading={isLoading} emptyText={t('admin.lists.none')} />

      {modal && <ListItemModal key={resource} resource={resource} record={modal === 'new' ? null : modal} onClose={() => setModal(null)} />}

      <ConfirmDialog
        open={toDelete !== null}
        title={t('admin.lists.deleteTitle')}
        message={`${t('admin.lists.deleteText')} (${toDelete ? itemLabel(toDelete) : ''})`}
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
