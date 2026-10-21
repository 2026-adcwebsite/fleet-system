import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listVehicles } from "../api/vehicles";
import { exportUrl } from "../api/exports";
import { itemLabel } from "../api/useLists";
import { useAuth } from "../auth/AuthContext";
import { useCan } from "../auth/usePermission";
import Table from "../components/Table";
import Pagination from "../components/Pagination";
import SelectField from "../components/SelectField";
import { useDebounce } from "../hooks/useDebounce";
import { formatDate, expiryStatus, EXPIRY_CLASS } from "../utils/dates";
import { t } from "../i18n";

const NO_FILTERS = {
  cityId: "",
  departmentId: "",
  companyId: "",
  statusId: "",
  modelId: "",
  driverId: "",
};

// [filter key, list resource, label key]
const FILTERS = [
  ["cityId", "cities", "fleet.filter.city"],
  ["departmentId", "departments", "fleet.filter.department"],
  ["companyId", "companies", "fleet.filter.company"],
  ["statusId", "vehicle-statuses", "fleet.filter.status"],
  ["modelId", "vehicle-models", "fleet.filter.model"],
  ["driverId", "drivers", "fleet.filter.driver"],
];

export default function Vehicles() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const can = useCan();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState("plate");
  const [order, setOrder] = useState("asc");
  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState(NO_FILTERS);
  const search = useDebounce(searchText, 300);

  // A department manager only gets their own department: a department filter would do nothing
  const filterList = FILTERS.filter(
    ([key]) => !(key === "departmentId" && user.role === "dept_manager"),
  );
  const hasFilters = searchText !== "" || Object.values(filters).some(Boolean);

  const { data, isLoading, error } = useQuery({
    queryKey: ["vehicles", { page, pageSize, sort, order, search, ...filters }],
    queryFn: () =>
      listVehicles({ page, pageSize, sort, order, search, ...filters }),
    placeholderData: (previous) => previous, // keep old rows while the next page loads
  });

  function handleSort(key) {
    if (key === sort) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setOrder("asc");
    }
    setPage(1);
  }

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(NO_FILTERS);
    setSearchText("");
    setPage(1);
  }

  const dateCell = (value) => (
    <span className={EXPIRY_CLASS[expiryStatus(value)]}>
      {formatDate(value)}
    </span>
  );

  const columns = [
    { key: "plate", header: t("fleet.col.plate"), sortKey: "plate" },
    {
      key: "city",
      header: t("fleet.col.city"),
      render: (v) => v.city?.name ?? "—",
    },
    {
      key: "model",
      header: t("fleet.col.model"),
      render: (v) => itemLabel(v.model) || "—",
    },
    {
      key: "driver",
      header: t("fleet.col.driver"),
      render: (v) => v.driver?.name ?? "—",
    },
    {
      key: "department",
      header: t("fleet.col.department"),
      render: (v) => v.department?.name ?? "—",
    },
    {
      key: "status",
      header: t("fleet.col.status"),
      render: (v) => v.status?.name ?? "—",
    },
    {
      key: "mileageKm",
      header: t("fleet.col.mileage"),
      sortKey: "mileageKm",
      align: "right",
    },
    {
      key: "insuranceEnd",
      header: t("fleet.col.insuranceEnd"),
      render: (v) => dateCell(v.insuranceEnd),
    },
    {
      key: "inspectionEnd",
      header: t("fleet.col.inspectionEnd"),
      render: (v) => dateCell(v.inspectionEnd),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("fleet.title")}</h1>
        <div className="flex gap-3">
          {can("fleet", "export") && (
            <a
              href={exportUrl("/exports/fleet", { search, ...filters })}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100"
            >
              {t("common.export")}
            </a>
          )}
          {can("fleet", "upload") && (
            <Link
              to="/imports"
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100"
            >
              {t("fleet.import")}
            </Link>
          )}
          {can("fleet", "create") && (
            <Link
              to="/vehicles/new"
              className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              {t("fleet.add")}
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700"
        >
          {error.message}
        </p>
      )}

      <div className="mb-4 space-y-3">
        <input
          type="search"
          aria-label={t("fleet.search")}
          placeholder={t("fleet.search")}
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setPage(1);
          }}
          className="w-full max-w-sm rounded border border-slate-300 bg-white px-3 py-2 text-sm"
        />

        <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-4 xl:grid-cols-7">
          {filterList.map(([key, resource, labelKey]) => (
            <SelectField
              key={key}
              label={t(labelKey)}
              resource={resource}
              value={filters[key]}
              onChange={(value) => setFilter(key, value)}
            />
          ))}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="pb-2 text-left text-sm text-blue-700 hover:underline"
            >
              {t("fleet.filter.clear")}
            </button>
          )}
        </div>
      </div>

      <Table
        columns={columns}
        rows={data?.items}
        loading={isLoading}
        sort={sort}
        order={order}
        onSort={handleSort}
        onRowClick={(v) => navigate(`/vehicles/${v.id}`)}
      />

      {data && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          pages={data.pages}
          total={data.total}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
