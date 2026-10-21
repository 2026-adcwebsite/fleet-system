import { api } from './client';

// params: { page, pageSize, yearMonth, search, departmentId, companyId, supplierId,
//           fuelTypeId, vehicleId, sort, order }
// -> { items, total, page, pageSize, pages, yearMonth, summary }
export const listRollouts = (params) => api('/rollouts', { query: params });

// -> { yearMonth, byDepartment, bySupplierFuel }
export const getRolloutSummary = (yearMonth) => api('/rollouts/summary', { query: { yearMonth } });

// -> { rollout, transactions }
export const getRollout = (id) => api(`/rollouts/${id}`);

export const createRollout = (body) => api('/rollouts', { method: 'POST', body });
export const updateRollout = (id, body) => api(`/rollouts/${id}`, { method: 'PATCH', body });
export const deleteRollout = (id) => api(`/rollouts/${id}`, { method: 'DELETE' });

// -> { fromYearMonth, toYearMonth, created, skipped }   (404 if the source month is empty)
export const copyRollouts = (fromYearMonth, toYearMonth) =>
  api('/rollouts/copy', { method: 'POST', body: { fromYearMonth, toYearMonth } });
