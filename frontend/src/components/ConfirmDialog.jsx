import { t } from '../i18n';

// <ConfirmDialog open title message error busy confirmLabel onConfirm onCancel />
export default function ConfirmDialog({ open, title, message, error, hint, busy, busyLabel, confirmLabel, variant = 'danger', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded bg-white p-6 shadow">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-slate-700">{message}</p>
        {error && (
          <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {error && hint && <p className="mt-2 text-sm text-slate-600">{hint}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button autoFocus onClick={onCancel} className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
              variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            {busy ? busyLabel || t('common.deleting') : confirmLabel || t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
