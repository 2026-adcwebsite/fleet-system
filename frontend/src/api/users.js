import { api } from './client';

// -> { roles: [{id,name}], departments: [{id,name}], statuses: ['active', ...] }
export const getUserOptions = () => api('/users/options');

// -> { users: [{ id, name, surname, email, position, status, roleId, role, departmentId, lastLoginAt, createdAt }] }
export const listUsers = () => api('/users');

export const createUser = (body) => api('/users', { method: 'POST', body }); // 409: email in use
export const updateUser = (id, body) => api(`/users/${id}`, { method: 'PATCH', body });
export const resetPassword = (id, password) => api(`/users/${id}/reset-password`, { method: 'POST', body: { password } });
export const deleteUser = (id) => api(`/users/${id}`, { method: 'DELETE' });

// -> { roles, modules, permissions: [{ id, roleId, moduleId, canView, canCreate, canEdit, canDelete, canUpload, canExport }] }
export const getPermissions = () => api('/permissions');

// body: any of the six booleans
export const setPermission = (roleId, moduleId, body) => api(`/permissions/${roleId}/${moduleId}`, { method: 'PUT', body });
