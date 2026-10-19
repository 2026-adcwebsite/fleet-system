import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import RequirePermission from "./auth/RequirePermission";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import Vehicles from "./pages/Vehicles";
import { t } from "./i18n";

// TEMPORARY home: shows the permissions the server sent.
// Replaced by the dashboard / first allowed page later.
function Home() {
  const { permissions } = useAuth();
  return (
    <div>
      <h1 className="text-xl font-semibold">{t("app.name")}</h1>
      <pre className="mt-4 overflow-auto rounded bg-slate-100 p-3 text-xs">
        {JSON.stringify(permissions, null, 2)}
      </pre>
    </div>
  );
}

// Already logged in? Skip the login page.
function LoginRoute() {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : <Login />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<RequireAuth />}>
        {/* standalone page: no sidebar, so a locked user has nowhere else to go */}
        <Route path="/change-password" element={<ChangePassword />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route element={<RequirePermission module="fleet" action="view" />}>
            <Route path="/vehicles" element={<Vehicles />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
