import { api } from './client';

// dryRun: true = preview only, nothing is saved. false = really import.
// Returns { dryRun, batchId, rows, created, updated, failed, warningCount, errors, warnings }
export function importFleet(file, { dryRun, defaultDepartmentId } = {}) {
  const form = new FormData();
  form.append('dryRun', dryRun ? 'true' : 'false');
  if (defaultDepartmentId) form.append('defaultDepartmentId', defaultDepartmentId);
  form.append('file', file);
  return api('/imports/fleet', { method: 'POST', form });
}

// -> { items: [{ id, module, fileName, rowsOk, rowsFailed, createdAt, uploadedBy }], total, page, pages, ... }
export const listImports = (params) => api('/imports', { query: params });

// -> { batch: { ..., details: { created, updated, errors, warnings } } }
export const getImport = (id) => api(`/imports/${id}`);
