import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { useCan } from "./auth/usePermission";
import RequireAuth from "./auth/RequireAuth";
import RequirePermission from "./auth/RequirePermission";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import Dashboard from "./pages/Dashboard";
import Vehicles from "./pages/Vehicles";
import VehicleDetail from "./pages/VehicleDetail";
import VehicleNew from "./pages/VehicleNew";
import Maintenance from "./pages/Maintenance";
import Imports from "./pages/Imports";
import Users from "./pages/admin/Users";
import Permissions from "./pages/admin/Permissions";
import Lists from "./pages/admin/Lists";
import RolloutLayout from "./pages/rollout/RolloutLayout";
import RolloutSheet from "./pages/rollout/RolloutSheet";
import RolloutRecap from "./pages/rollout/RolloutRecap";
import FuelTransactions from "./pages/rollout/FuelTransactions";
import FuelPrices from "./pages/rollout/FuelPrices";
import Reconciliation from "./pages/rollout/Reconciliation";
import { t } from "./i18n";

// "/" sends the user to the first module they may view
function Home() {
  const can = useCan();
  const first = [
    ["dashboard", "/dashboard"],
    ["fleet", "/vehicles"],
    ["maintenance", "/maintenance"],
    ["rollout", "/rollout"],
  ].find(([module]) => can(module, "view"));

  if (first) return <Navigate to={first[1]} replace />;
  return <p className="text-slate-600">{t("app.noAccess")}</p>;
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

          <Route
            element={<RequirePermission module="dashboard" action="view" />}
          >
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          <Route element={<RequirePermission module="fleet" action="view" />}>
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/vehicles/:id" element={<VehicleDetail />} />
          </Route>
          <Route element={<RequirePermission module="fleet" action="create" />}>
            <Route path="/vehicles/new" element={<VehicleNew />} />
          </Route>

          <Route element={<RequirePermission module="fleet" action="upload" />}>
            <Route path="/imports" element={<Imports />} />
          </Route>

          <Route
            element={<RequirePermission module="maintenance" action="view" />}
          >
            <Route path="/maintenance" element={<Maintenance />} />
          </Route>

          <Route element={<RequirePermission module="rollout" action="view" />}>
            <Route path="/rollout" element={<RolloutLayout />}>
              <Route index element={<RolloutSheet />} />
              <Route path="recap" element={<RolloutRecap />} />
              <Route path="fuel" element={<FuelTransactions />} />
              <Route path="prices" element={<FuelPrices />} />
              <Route path="reconciliation" element={<Reconciliation />} />
            </Route>
          </Route>

          <Route element={<RequirePermission module="system" action="view" />}>
            <Route path="/users" element={<Users />} />
            <Route path="/permissions" element={<Permissions />} />
            <Route path="/lists" element={<Lists />} />
          </Route>

          <Route path="*" element={<Home />} />
        </Route>
      </Route>
    </Routes>
  );
}
