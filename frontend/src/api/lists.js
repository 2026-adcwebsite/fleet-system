import { api } from './client';

// Reference lists used in dropdowns.
// resource is one of: departments, companies, suppliers, fuel-types,
// vehicle-statuses, cities, drivers, vehicle-models
// Items are { id, name }, except vehicle-models: { id, make, model }

export const listItems = (resource, search) =>
  api(`/${resource}`, { query: { search } }); // -> { items }

export const createItem = (resource, body) =>
  api(`/${resource}`, { method: 'POST', body }); // -> { item }

export const updateItem = (resource, id, body) =>
  api(`/${resource}/${id}`, { method: 'PATCH', body }); // -> { item }

export const deleteItem = (resource, id) =>
  api(`/${resource}/${id}`, { method: 'DELETE' }); // 409 if still in use
