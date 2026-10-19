import { Navigate, Outlet } from 'react-router-dom';
import { useCan } from './usePermission';

// Wrap routes that need a permission. If the user lacks it, go home.
// <Route element={<RequirePermission module="fleet" action="view" />}> ...routes... </Route>
export default function RequirePermission({ module, action = 'view' }) {
  const can = useCan();
  return can(module, action) ? <Outlet /> : <Navigate to="/" replace />;
}
