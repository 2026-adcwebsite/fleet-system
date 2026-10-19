import { api } from './client';

export const login = (email, password) =>
  api('/auth/login', { method: 'POST', body: { email, password } });

export const logout = () => api('/auth/logout', { method: 'POST' });

export const getMe = () => api('/auth/me');

export const getMyPermissions = () => api('/me/permissions');

export const changePassword = (currentPassword, newPassword) =>
  api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
