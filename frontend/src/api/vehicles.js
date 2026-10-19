import { api } from './client';

// params: { page, pageSize, search, cityId, departmentId, companyId, statusId,
//           modelId, driverId, sort, order }
// -> { items, total, page, pageSize, pages }
export const listVehicles = (params) => api('/vehicles', { query: params });

// -> { vehicle } with insurances[] and inspections[]
export const getVehicle = (id) => api(`/vehicles/${id}`);

export const createVehicle = (body) => api('/vehicles', { method: 'POST', body });

export const updateVehicle = (id, body) => api(`/vehicles/${id}`, { method: 'PATCH', body });

// 409 if the vehicle has fuel records
export const deleteVehicle = (id) => api(`/vehicles/${id}`, { method: 'DELETE' });

// Insurance and inspection periods have the same API.
// kind is 'insurances' or 'inspections'. Body: { startDate, endDate }
export const createPeriod = (vehicleId, kind, body) =>
  api(`/vehicles/${vehicleId}/${kind}`, { method: 'POST', body });

export const updatePeriod = (vehicleId, kind, id, body) =>
  api(`/vehicles/${vehicleId}/${kind}/${id}`, { method: 'PATCH', body });

export const deletePeriod = (vehicleId, kind, id) =>
  api(`/vehicles/${vehicleId}/${kind}/${id}`, { method: 'DELETE' });
