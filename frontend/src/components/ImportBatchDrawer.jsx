import { useQuery } from '@tanstack/react-query';
import { getImport } from '../api/imports';
import Drawer from './Drawer';
import ImportIssues from './ImportIssues';
import { formatDateTime } from '../utils/dates';
import { label } from '../utils/format';
import { t } from '../i18n';

// Details of one past import. details.errors / warnings are lists; created / updated are counts.
export default function ImportBatchDrawer({ id, onClose }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['import', id], queryFn: () => getImport(id) });
  const batch = data?.batch;
  const d = batch?.details || {};
  const list = (x) => (Array.isArray(x) ? x : []);

  return (
    <Drawer title={batch?.fileName || t('imports.batch')} onClose={onClose}>
      {isLoading && <p className="text-slate-500">{t('app.loading')}</p>}
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
      {batch && (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-slate-500">{t('imports.col.date')}</dt><dd>{formatDateTime(batch.createdAt)}</dd></div>
            <div><dt className="text-xs text-slate-500">{t('imports.col.by')}</dt><dd>{label(batch.uploadedBy)}</dd></div>
            <div><dt className="text-xs text-slate-500">{t('imports.col.ok')}</dt><dd>{batch.rowsOk}</dd></div>
            <div><dt className="text-xs text-slate-500">{t('imports.col.failed')}</dt><dd>{batch.rowsFailed}</dd></div>
            {typeof d.created === 'number' && <div><dt className="text-xs text-slate-500">{t('imports.stat.created')}</dt><dd>{d.created}</dd></div>}
            {typeof d.updated === 'number' && <div><dt className="text-xs text-slate-500">{t('imports.stat.updated')}</dt><dd>{d.updated}</dd></div>}
          </dl>
          <ImportIssues title={t('imports.errors')} tone="red" items={list(d.errors)} />
          <ImportIssues title={t('imports.warnings')} tone="amber" items={list(d.warnings)} />
        </div>
      )}
    </Drawer>
  );
}
