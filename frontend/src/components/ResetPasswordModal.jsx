import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { resetPassword } from '../api/users';
import Modal from './Modal';
import FormField from './FormField';
import { t } from '../i18n';

export default function ResetPasswordModal({ user, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');

  const reset = useMutation({
    mutationFn: () => resetPassword(user.id, password),
    onSuccess: onClose,
    onError: (err) => (err.fieldErrors.password ? setError(err.fieldErrors.password) : setBanner(err.message)),
  });

  return (
    <Modal title={`${t('admin.users.resetTitle')}: ${user.name} ${user.surname}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          setBanner('');
          if (password.length < 10) return setError(t('admin.users.tooShort'));
          reset.mutate();
        }}
        className="space-y-4"
      >
        {banner && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{banner}</p>}
        <FormField label={t('admin.users.newPassword')} type="text" autoComplete="off" required value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
        <p className="text-xs text-slate-500">{t('admin.users.resetHint')}</p>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">{t('common.cancel')}</button>
          <button disabled={reset.isPending} className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
            {reset.isPending ? t('common.saving') : t('admin.users.reset')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
