import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUser, updateUser } from '../api/users';
import Modal from './Modal';
import FormField from './FormField';
import OptionSelect from './OptionSelect';
import { t } from '../i18n';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const toId = (v) => (v === '' ? null : Number.isNaN(Number(v)) ? v : Number(v));

// Add (user = null) or edit a user. options: { roles, departments, statuses } from /users/options
export default function UserModal({ user, options, isSelf, onClose }) {
  const qc = useQueryClient();
  const editing = Boolean(user);
  const initial = {
    name: str(user?.name),
    surname: str(user?.surname),
    email: str(user?.email),
    position: str(user?.position),
    departmentId: str(user?.departmentId),
    roleId: str(user?.roleId),
    status: str(user?.status) || 'active',
    password: '',
  };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');

  const save = useMutation({
    mutationFn: () => {
      if (!editing) {
        const body = { name: form.name, surname: form.surname, email: form.email, roleId: toId(form.roleId), password: form.password };
        if (form.position) body.position = form.position;
        if (form.departmentId) body.departmentId = toId(form.departmentId);
        return createUser(body);
      }
      // Edit: send only what changed ("Nothing to update" is an error)
      const body = {};
      for (const k of ['name', 'surname', 'email', 'position']) if (form[k] !== initial[k]) body[k] = form[k];
      if (form.departmentId !== initial.departmentId) body.departmentId = toId(form.departmentId);
      if (!isSelf) {
        if (form.roleId !== initial.roleId) body.roleId = toId(form.roleId);
        if (form.status !== initial.status) body.status = form.status;
      }
      return Object.keys(body).length ? updateUser(user.id, body) : Promise.resolve(null);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err) => {
      setErrors(err.fieldErrors);
      if (Object.keys(err.fieldErrors).length === 0) setBanner(err.message); // e.g. 409: email in use
    },
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setSelect = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const roleOptions = options.roles.map((r) => ({ value: String(r.id), label: r.name }));
  const deptOptions = options.departments.map((d) => ({ value: String(d.id), label: d.name }));
  const statusOptions = options.statuses.map((s) => ({ value: s, label: t(`admin.users.status.${s}`) }));

  return (
    <Modal title={editing ? t('admin.users.editTitle') : t('admin.users.newTitle')} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErrors({});
          setBanner('');
          if (!editing && form.password.length < 10) return setErrors({ password: t('admin.users.tooShort') });
          save.mutate();
        }}
        className="space-y-4"
      >
        {banner && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{banner}</p>}

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('admin.users.field.name')} required value={form.name} onChange={set('name')} error={errors.name} />
          <FormField label={t('admin.users.field.surname')} required value={form.surname} onChange={set('surname')} error={errors.surname} />
        </div>
        <FormField label={t('admin.users.field.email')} type="email" required value={form.email} onChange={set('email')} error={errors.email} />
        {!editing && (
          <FormField label={t('admin.users.tempPassword')} type="text" autoComplete="off" required value={form.password} onChange={set('password')} error={errors.password} />
        )}
        <FormField label={t('admin.users.field.position')} value={form.position} onChange={set('position')} error={errors.position} />

        <div className="grid grid-cols-2 gap-4">
          <OptionSelect label={t('admin.users.field.role')} value={form.roleId} onChange={setSelect('roleId')} options={roleOptions} emptyLabel={editing ? undefined : '—'} disabled={isSelf} error={errors.roleId} />
          <OptionSelect label={t('admin.users.field.department')} value={form.departmentId} onChange={setSelect('departmentId')} options={deptOptions} emptyLabel="—" error={errors.departmentId} />
          {editing && (
            <OptionSelect label={t('admin.users.field.status')} value={form.status} onChange={setSelect('status')} options={statusOptions} disabled={isSelf} error={errors.status} />
          )}
        </div>

        {editing && <p className="text-xs text-slate-500">{isSelf ? t('admin.users.selfNote') : t('admin.users.sessionNote')}</p>}

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
