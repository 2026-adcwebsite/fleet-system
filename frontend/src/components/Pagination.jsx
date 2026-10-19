import { t } from '../i18n';

const SIZES = [25, 50, 100, 200];

// Uses the page info every list endpoint returns: { page, pageSize, pages, total }
// <Pagination page={1} pageSize={25} pages={4} total={92} onPage={setPage} onPageSize={setSize} />
export default function Pagination({ page, pageSize, pages, total, onPage, onPageSize }) {
  const btn =
    'rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-slate-600">
      <span>
        {total} {t('table.rows')}
      </span>

      <div className="flex items-center gap-3">
        {onPageSize && (
          <label className="flex items-center gap-2">
            {t('table.perPage')}
            <select
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              className="rounded border border-slate-300 px-2 py-1"
            >
              {SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t('table.previous')}
        </button>
        <span>
          {t('table.page')} {page} {t('table.of')} {Math.max(pages, 1)}
        </span>
        <button className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {t('table.next')}
        </button>
      </div>
    </div>
  );
}
