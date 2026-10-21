import { t } from '../i18n';

// Table of import errors or warnings: [{ row, plate, message }]
export default function ImportIssues({ title, tone, items }) {
  const color = tone === 'red' ? 'text-red-700' : 'text-amber-700';
  return (
    <section>
      <h3 className={`mb-2 text-sm font-semibold ${color}`}>
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{t('imports.noIssues')}</p>
      ) : (
        <div className="max-h-72 overflow-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">{t('imports.row')}</th>
                <th className="px-3 py-2 font-medium">{t('imports.plate')}</th>
                <th className="px-3 py-2 font-medium">{t('imports.message')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">{x.row}</td>
                  <td className="px-3 py-1.5">{x.plate || '—'}</td>
                  <td className="px-3 py-1.5">{x.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items.length >= 500 && <p className="mt-1 text-xs text-slate-500">{t('imports.capped')}</p>}
    </section>
  );
}
