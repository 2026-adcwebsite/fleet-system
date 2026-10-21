import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getVehicle, updateVehicle, deleteVehicle } from "../api/vehicles";
import { itemLabel } from "../api/useLists";
import { useCan } from "../auth/usePermission";
import VehicleFields from "../components/VehicleFields";
import PeriodPanel from "../components/PeriodPanel";
import ConfirmDialog from "../components/ConfirmDialog";
import ServiceHistory from "../components/ServiceHistory";
import { toForm, toBody } from "../utils/vehicleForm";
import { t } from "../i18n";

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const can = useCan();
  const canEdit = can("fleet", "edit");

  const { data, isLoading, error } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => getVehicle(id),
  });
  const vehicle = data?.vehicle;

  const [form, setForm] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [banner, setBanner] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (vehicle) setForm(toForm(vehicle));
  }, [vehicle]);

  const save = useMutation({
    mutationFn: () => updateVehicle(id, toBody(form)),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["vehicle"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
    onError: (err) => {
      setFieldErrors(err.fieldErrors);
      if (Object.keys(err.fieldErrors).length === 0) setBanner(err.message);
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteVehicle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      navigate("/vehicles", { replace: true });
    },
  });

  const set = (key) => (e) => {
    setSaved(false);
    setForm((f) => ({
      ...f,
      [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));
  };
  const setSelect = (key) => (value) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  if (isLoading || (vehicle && !form))
    return <p className="text-slate-500">{t("app.loading")}</p>;
  if (error) {
    return (
      <div>
        <Link to="/vehicles" className="text-sm text-blue-700 hover:underline">
          {t("vehicle.back")}
        </Link>
        <p
          role="alert"
          className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700"
        >
          {error.status === 404 ? t("vehicle.notFound") : error.message}
        </p>
      </div>
    );
  }

  const ro = !canEdit; // read-only inputs

  return (
    <div className="space-y-6">
      <div>
        <Link to="/vehicles" className="text-sm text-blue-700 hover:underline">
          {t("vehicle.back")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{vehicle.plate}</h1>
          <span className="text-slate-600">{itemLabel(vehicle.model)}</span>
          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">
            {vehicle.status?.name}
          </span>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFieldErrors({});
          setBanner("");
          setSaved(false);
          save.mutate();
        }}
        className="space-y-4 rounded border border-slate-200 bg-white p-4"
      >
        {banner && (
          <p
            role="alert"
            className="rounded bg-red-50 p-3 text-sm text-red-700"
          >
            {banner}
          </p>
        )}

        <VehicleFields
          form={form}
          set={set}
          setSelect={setSelect}
          errors={fieldErrors}
          readOnly={ro}
          canCreateLists={can("fleet", "create")}
        />

        <div className="flex items-center gap-4">
          {canEdit && (
            <button
              disabled={save.isPending}
              className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {save.isPending ? t("common.saving") : t("common.save")}
            </button>
          )}
          {saved && (
            <span role="status" className="text-sm text-green-700">
              {t("common.saved")}
            </span>
          )}
          {can("fleet", "delete") && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ml-auto text-sm text-red-600 hover:underline"
            >
              {t("vehicle.deleteTitle")}
            </button>
          )}
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PeriodPanel
          title={t("vehicle.insurance")}
          kind="insurances"
          vehicleId={id}
          periods={vehicle.insurances || []}
          canCreate={can("fleet", "create")}
          canEdit={canEdit}
          canDelete={can("fleet", "delete")}
        />
        <PeriodPanel
          title={t("vehicle.inspection")}
          kind="inspections"
          vehicleId={id}
          periods={vehicle.inspections || []}
          canCreate={can("fleet", "create")}
          canEdit={canEdit}
          canDelete={can("fleet", "delete")}
        />
      </div>

      {can("maintenance", "view") && <ServiceHistory vehicle={vehicle} />}

      <ConfirmDialog
        open={confirmDelete}
        title={t("vehicle.deleteTitle")}
        message={t("vehicle.deleteText")}
        error={remove.error?.message}
        hint={t("vehicle.deleteHint")}
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => {
          setConfirmDelete(false);
          remove.reset();
        }}
      />
    </div>
  );
}
