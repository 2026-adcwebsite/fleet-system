import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useList, itemLabel } from "../api/useLists";
import { createItem } from "../api/lists";
import { t } from "../i18n";

const NEW = "__new__";
const input = "w-full rounded border border-slate-300 px-3 py-2 text-sm";

// A dropdown filled from a reference list.
// <SelectField label="City" resource="cities" value={cityId} onChange={setCityId} />
// value / onChange use the item id as a string ('' = nothing selected).
// creatable: adds "+ Create new…" so the user can add an item without leaving the form.
export default function SelectField({
  label,
  resource,
  value,
  onChange,
  error,
  emptyLabel = "—",
  allowEmpty = true,
  creatable = false,
  ...selectProps
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useList(resource);

  const isModel = resource === "vehicle-models";
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [make, setMake] = useState("");
  const [createError, setCreateError] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createItem(
        resource,
        isModel ? { make, ...(name ? { model: name } : {}) } : { name },
      ),
    onSuccess: ({ item }) => {
      qc.invalidateQueries({ queryKey: ["list", resource] });
      onChange(String(item.id));
      closeCreate();
    },
    onError: (err) => setCreateError(err.message),
  });

  function closeCreate() {
    setCreating(false);
    setName("");
    setMake("");
    setCreateError("");
  }

  // Enter inside the mini form must not submit the outer form
  const onEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      create.mutate();
    }
  };

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) =>
          e.target.value === NEW ? setCreating(true) : onChange(e.target.value)
        }
        disabled={isLoading}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded border bg-white px-3 py-2 text-sm ${
          error ? "border-red-500" : "border-slate-300"
        }`}
        {...selectProps}
      >
        {(allowEmpty || !value) && <option value="">{emptyLabel}</option>}
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {itemLabel(item)}
          </option>
        ))}
        {creatable && <option value={NEW}>{t("common.createNew")}</option>}
      </select>

      {creating && (
        <div className="mt-2 space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
          {isModel && (
            <input
              aria-label={t("vehicle.make")}
              placeholder={t("vehicle.make")}
              className={input}
              value={make}
              onChange={(e) => setMake(e.target.value)}
              onKeyDown={onEnter}
              autoFocus
            />
          )}
          <input
            aria-label={isModel ? t("vehicle.modelName") : t("common.name")}
            placeholder={isModel ? t("vehicle.modelName") : t("common.name")}
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onEnter}
            autoFocus={!isModel}
          />
          {createError && (
            <p role="alert" className="text-sm text-red-600">
              {createError}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="rounded bg-blue-700 px-3 py-1 text-sm text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {create.isPending ? t("common.saving") : t("common.add")}
            </button>
            <button
              type="button"
              onClick={closeCreate}
              className="text-sm text-slate-600 hover:underline"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
