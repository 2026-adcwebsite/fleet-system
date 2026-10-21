import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createItem, updateItem } from '../api/lists';
import Modal from './Modal';
import FormField from './FormField';
import { t } from '../i18n';

// Add (record = null) or rename an item of a reference list.
// Vehicle models have two fields (make, model); everything else has a name.
export default function ListItemModal({ resource, record, onClose }) {
  const qc = useQueryClient();
  const isModel = resource === 'vehicle-models';
  const [name, setName] = useState(record?.name ?? '');
  const [make, setMake] = useState(record?.make ?? '');
  const [model, setModel] = useState(record?.model ?? '');
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');

  const save = useMutation({
    mutationFn: () => {
      const body = isModel ? { make, model } : { name };
      return record ? updateItem(resource, record.id, body) : createItem(resource, isModel && !model ? { make } : body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['list', resource] });
      onClose();
    },
    onError: (err) => {
      setErrors(err.fieldErrors);
      if (Object.keys(err.fieldErrors).length === 0) setBanner(err.message);
    },
  });

  return (
    <Modal title={record ? t('admin.lists.editTitle') : t('admin.lists.newTitle')} onClose={onClose}>
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
        {isModel ? (
          <>
            <FormField label={t('admin.lists.make')} required value={make} onChange={(e) => setMake(e.target.value)} error={errors.make} />
            <FormField label={t('admin.lists.model')} value={model} onChange={(e) => setModel(e.target.value)} error={errors.model} />
          </>
        ) : (
          <FormField label={t('admin.lists.name')} required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">{t('common.cancel')}</button>
          <button disabled={save.isPending} className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
