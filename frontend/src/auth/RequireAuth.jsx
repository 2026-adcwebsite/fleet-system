import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { t } from '../i18n';

// Wrap protected routes with this.
// - checking session: show "Loading…"
// - logged out: go to /login
// - password change pending: only /change-password is allowed
export default function RequireAuth() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) return <p className="p-8 text-slate-500">{t('app.loading')}</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}
