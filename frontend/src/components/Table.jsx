import { t } from '../i18n';

// columns: [{ key, header, render?(row), sortKey?, align? }]
// <Table columns={cols} rows={items} loading={isLoading} onRowClick={fn}
//        sort="plate" order="asc" onSort={(sortKey) => ...} />
export default function Table({
  columns,
  rows = [],
  loading = false,
  onRowClick,
  sort,
  order,
  onSort,
  emptyText,
}) {
  const cell = (col) => (col.align === 'right' ? 'text-right' : 'text-left');

  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            {columns.map((col) => {
              const active = col.sortKey && sort === col.sortKey;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (order === 'desc' ? 'descending' : 'ascending') : undefined}
                  className={`whitespace-nowrap px-3 py-2 font-medium ${cell(col)}`}
                >
                  {col.sortKey && onSort ? (
                    <button onClick={() => onSort(col.sortKey)} className="hover:underline">
                      {col.header}
                      {active ? (order === 'desc' ? ' ↓' : ' ↑') : ''}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {loading &&
            Array.from({ length: 5 }, (_, i) => (
              <tr key={i} className="border-t border-slate-100">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-3">
                    <div className="h-4 animate-pulse rounded bg-slate-200" />
                  </td>
                ))}
              </tr>
            ))}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-500">
                {emptyText || t('table.empty')}
              </td>
            </tr>
          )}

          {!loading &&
            rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-t border-slate-100 ${
                  onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-3 py-2 ${cell(col)}`}>
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
