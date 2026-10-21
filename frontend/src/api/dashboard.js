import { api } from './client';

// params: { days, departmentId, make, modelId }
// -> { asOf, days, fleet, byModel, insurance, inspection }
export const getDashboard = (params) => api('/dashboard', { query: params });
