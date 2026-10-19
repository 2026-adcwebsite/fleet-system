import { useId } from 'react';
import { useList } from '../api/useLists';
import { itemLabel } from '../api/useLists';

// A dropdown filled from a reference list.
// <SelectField label="City" resource="cities" value={cityId} onChange={setCityId} />
// value / onChange use the item id as a string ('' = nothing selected).
export default function SelectField({
  label,
  resource,
  value,
  onChange,
  error,
  emptyLabel = '—',
  allowEmpty = true,
  ...selectProps
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const { data: items = [], isLoading } = useList(resource);

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded border bg-white px-3 py-2 text-sm ${
          error ? 'border-red-500' : 'border-slate-300'
        }`}
        {...selectProps}
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {itemLabel(item)}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
