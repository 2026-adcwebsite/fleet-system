import { api } from './client';

// params: { page, pageSize, search, vehicleId, dateFrom, dateTo, sort, order }
// -> { items, total, page, pageSize, pages, totalCost }
export const listServiceRecords = (params) => api('/service-records', { query: params });

export const createServiceRecord = (body) => api('/service-records', { method: 'POST', body });

export const updateServiceRecord = (id, body) => api(`/service-records/${id}`, { method: 'PATCH', body });

export const deleteServiceRecord = (id) => api(`/service-records/${id}`, { method: 'DELETE' });
