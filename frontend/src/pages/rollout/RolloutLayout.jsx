import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { t } from "../../i18n";

// Tabs for all rollout screens. The selected month (?ym=) is kept when switching tabs.
const TABS = [
  { to: "/rollout", end: true, label: "rollout.tab.sheet" },
  { to: "/rollout/recap", end: false, label: "rollout.tab.recap" },
  { to: "/rollout/fuel", end: false, label: "rollout.tab.fuel" },
  { to: "/rollout/prices", end: false, label: "rollout.tab.prices" },
  {
    to: "/rollout/reconciliation",
    end: false,
    label: "rollout.tab.reconciliation",
    hideFor: "dept_manager",
  },
];

export default function RolloutLayout() {
  const { search } = useLocation();
  const { user } = useAuth();
  const tabs = TABS.filter((tab) => tab.hideFor !== user.role);
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">{t("rollout.title")}</h1>
      <nav
        aria-label={t("rollout.title")}
        className="mb-5 flex gap-1 border-b border-slate-200"
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={{ pathname: tab.to, search }}
            end={tab.end}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-4 py-2 text-sm ${
                isActive
                  ? "border-blue-700 font-medium text-blue-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`
            }
          >
            {t(tab.label)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
