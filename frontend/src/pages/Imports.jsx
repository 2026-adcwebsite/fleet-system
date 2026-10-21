import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { importFleet, listImports } from '../api/imports';
import { exportUrl } from '../api/exports';
import FileDrop from '../components/FileDrop';
import SelectField from '../components/SelectField';
import ImportIssues from '../components/ImportIssues';
import ImportBatchDrawer from '../components/ImportBatchDrawer';
import Table from '../components/Table';
import Pagination from '../components/Pagination';
import { formatDateTime } from '../utils/dates';
import { label } from '../utils/format';
import { t } from '../i18n';

function Stat({ name, value, tone }) {
  const color = tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : '';
  return (
    <div className="rounded border border-slate-200 bg-white px-4 py-3">
      <dt className="text-xs text-slate-500">{name}</dt>
      <dd className={`text-xl font-semibold ${color}`}>{value}</dd>
    </div>
  );
}

export default function Imports() {
  const qc = useQueryClient();
  const [file, setFile] = useState(null);
  const [departmentId, setDepartmentId] = useState('');
  const [final, setFinal] = useState(null); // result of the real import
  const [page, setPage] = useState(1);
  const [batchId, setBatchId] = useState(null);

  // Step 1: dry run. Nothing is saved.
  const preview = useMutation({
    mutationFn: ({ file, dept }) => importFleet(file, { dryRun: true, defaultDepartmentId: dept }),
  });

  // Step 2: the same file again, for real. Only reachable after a preview.
  const commit = useMutation({
    mutationFn: () => importFleet(file, { dryRun: false, defaultDepartmentId: departmentId }),
    onSuccess: (res) => {
      setFinal(res);
      preview.reset();
      setFile(null);
      for (const key of ['imports', 'vehicles', 'vehicle', 'dashboard']) qc.invalidateQueries({ queryKey: [key] });
    },
  });

  function chooseFile(f) {
    setFinal(null);
    commit.reset();
    setFile(f);
    preview.mutate({ file: f, dept: departmentId });
  }

  function changeDepartment(value) {
    setDepartmentId(value);
    if (file) preview.mutate({ file, dept: value }); // the preview depends on it
  }

  function reset() {
    setFile(null);
    setFinal(null);
    preview.reset();
    commit.reset();
  }

  const history = useQuery({ queryKey: ['imports', page], queryFn: () => listImports({ page, pageSize: 10 }) });
  const result = preview.data;
  const toImport = result ? result.created + result.updated : 0;

  const columns = [
    { key: 'createdAt', header: t('imports.col.date'), render: (b) => formatDateTime(b.createdAt) },
    { key: 'fileName', header: t('imports.col.file') },
    { key: 'rowsOk', header: t('imports.col.ok'), align: 'right' },
    { key: 'rowsFailed', header: t('imports.col.failed'), align: 'right' },
    { key: 'uploadedBy', header: t('imports.col.by'), render: (b) => label(b.uploadedBy) },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">{t('imports.title')}</h1>

      <section className="space-y-4">
        <div className="rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">{t('imports.rulesTitle')}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <li key={n}>{t(`imports.rule${n}`)}</li>
            ))}
          </ul>
          <a href={exportUrl('/imports/fleet/template')} className="mt-3 inline-block text-sm text-blue-700 hover:underline">
            {t('imports.template')}
          </a>
        </div>

        <div className="max-w-md">
          <SelectField label={t('imports.defaultDepartment')} resource="departments" value={departmentId} onChange={changeDepartment} disabled={commit.isPending} />
        </div>

        {!result && !final && (
          <FileDrop
            accept=".xlsx"
            text={t('imports.dropText')}
            activeText={t('imports.dropActive')}
            disabled={preview.isPending}
            onFile={chooseFile}
          />
        )}

        {preview.isPending && <p className="text-slate-500">{t('imports.checking')}</p>}
        {preview.error && (
          <div className="space-y-3">
            <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{preview.error.message}</p>
            <button onClick={reset} className="text-sm text-blue-700 hover:underline">{t('imports.chooseAnother')}</button>
          </div>
        )}
        {commit.error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{commit.error.message}</p>}

        {result && !preview.isPending && (
          <div className="space-y-4">
            <h2 className="font-semibold">{t('imports.preview')}: {file?.name}</h2>
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Stat name={t('imports.stat.rows')} value={result.rows} />
              <Stat name={t('imports.stat.created')} value={result.created} />
              <Stat name={t('imports.stat.updated')} value={result.updated} />
              <Stat name={t('imports.stat.failed')} value={result.failed} tone={result.failed > 0 ? 'red' : undefined} />
              <Stat name={t('imports.stat.warnings')} value={result.warningCount} tone={result.warningCount > 0 ? 'amber' : undefined} />
            </dl>

            <ImportIssues title={t('imports.errors')} tone="red" items={result.errors || []} />
            <ImportIssues title={t('imports.warnings')} tone="amber" items={result.warnings || []} />

            <div className="flex items-center gap-4">
              <button
                onClick={() => commit.mutate()}
                disabled={commit.isPending || toImport === 0}
                className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {commit.isPending ? t('imports.importing') : `${t('imports.import')} ${toImport} ${t('imports.rowsWord')}`}
              </button>
              <button onClick={reset} disabled={commit.isPending} className="text-sm text-slate-600 hover:underline">
                {t('imports.chooseAnother')}
              </button>
            </div>
          </div>
        )}

        {final && (
          <div className="space-y-3">
            <p role="status" className="rounded bg-green-50 p-3 text-sm text-green-800">
              {t('imports.done')}: {t('imports.stat.created')} {final.created} · {t('imports.stat.updated')} {final.updated} · {t('imports.stat.failed')} {final.failed}
            </p>
            {final.failed > 0 && <ImportIssues title={t('imports.errors')} tone="red" items={final.errors || []} />}
            <button onClick={reset} className="text-sm text-blue-700 hover:underline">{t('imports.another')}</button>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">{t('imports.history')}</h2>
        {history.error && <p role="alert" className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">{history.error.message}</p>}
        <Table
          columns={columns}
          rows={history.data?.items}
          loading={history.isLoading}
          emptyText={t('imports.noHistory')}
          onRowClick={(b) => setBatchId(b.id)}
        />
        {history.data && (
          <Pagination page={history.data.page} pageSize={history.data.pageSize} pages={history.data.pages} total={history.data.total} onPage={setPage} />
        )}
      </section>

      {batchId && <ImportBatchDrawer id={batchId} onClose={() => setBatchId(null)} />}
    </div>
  );
}
