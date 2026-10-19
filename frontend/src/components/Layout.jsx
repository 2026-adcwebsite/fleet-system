import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCan } from '../auth/usePermission';
import { t } from '../i18n';

const linkClass = ({ isActive }) =>
  `block rounded px-3 py-2 text-sm ${
    isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'
  }`;

// Sidebar + top bar. Pages render inside <Outlet />.
// Menu items appear only when the user's permissions allow them.
export default function Layout() {
  const { user, logout } = useAuth();
  const can = useCan();

  const main = [
    can('dashboard', 'view') && ['/dashboard', t('nav.dashboard')],
    can('fleet', 'view') && ['/vehicles', t('nav.fleet')],
    can('maintenance', 'view') && ['/maintenance', t('nav.maintenance')],
    can('rollout', 'view') && ['/rollout', t('nav.rollout')],
    can('fleet', 'upload') && ['/imports', t('nav.imports')],
  ].filter(Boolean);

  const admin = can('system', 'view')
    ? [
        ['/users', t('nav.users')],
        ['/permissions', t('nav.permissions')],
        ['/lists', t('nav.lists')],
      ]
    : [];

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-slate-900 p-3">
        <p className="mb-4 px-3 text-base font-semibold text-white">{t('app.name')}</p>
        <nav aria-label="Main" className="space-y-1">
          {main.map(([to, label]) => (
            <NavLink key={to} to={to} className={linkClass}>
              {label}
            </NavLink>
          ))}
          {admin.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-4 text-xs text-slate-400">{t('nav.admin')}</p>
              {admin.map(([to, label]) => (
                <NavLink key={to} to={to} className={linkClass}>
                  {label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-6 py-3 text-sm">
          <span>
            {user.name} {user.surname} <span className="text-slate-500">({user.role})</span>
          </span>
          <NavLink to="/change-password" className="text-blue-700 hover:underline">
            {t('topbar.changePassword')}
          </NavLink>
          <button onClick={logout} className="text-blue-700 hover:underline">
            {t('topbar.logout')}
          </button>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
