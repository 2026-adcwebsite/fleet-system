import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listVehicles } from '../api/vehicles';
import { itemLabel } from '../api/useLists';
import { useDebounce } from '../hooks/useDebounce';
import { t } from '../i18n';

// Search-as-you-type vehicle chooser.
// value: { id, plate, model? } | null     onChange(vehicle | null)
export default function VehiclePicker({ label, value, onChange, error, disabled }) {
  const id = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const search = useDebounce(text, 300);

  const { data, isFetching } = useQuery({
    queryKey: ['vehicle-picker', search],
    queryFn: () => listVehicles({ search, pageSize: 10, sort: 'plate' }),
    enabled: open && search.length > 0,
  });

  const choose = (v) => {
    onChange({ id: v.id, plate: v.plate, model: v.model });
    setText('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>

      {value ? (
        <div className="flex items-center justify-between rounded border border-slate-300 bg-white px-3 py-2 text-sm">
          <span>
            {value.plate} {value.model ? <span className="text-slate-500">{itemLabel(value.model)}</span> : null}
          </span>
          {!disabled && (
            <button type="button" onClick={() => onChange(null)} className="text-blue-700 hover:underline">
              {t('common.clear')}
            </button>
          )}
        </div>
      ) : (
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-invalid={error ? 'true' : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={t('maintenance.vehicleSearch')}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className={`w-full rounded border px-3 py-2 text-sm ${error ? 'border-red-500' : 'border-slate-300'}`}
        />
      )}

      {!value && open && search.length > 0 && (
        <ul role="listbox" className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-slate-200 bg-white text-sm shadow">
          {data?.items.map((v) => (
            <li key={v.id} role="option" aria-selected="false">
              <button type="button" onMouseDown={() => choose(v)} className="block w-full px-3 py-2 text-left hover:bg-slate-100">
                {v.plate} <span className="text-slate-500">{itemLabel(v.model)}</span>
              </button>
            </li>
          ))}
          {data && data.items.length === 0 && !isFetching && (
            <li className="px-3 py-2 text-slate-500">{t('maintenance.vehicleNone')}</li>
          )}
        </ul>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
