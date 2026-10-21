import { useId } from 'react';

// A select with fixed options: options = [{ value, label }]
export default function OptionSelect({ label, value, onChange, options, error, emptyLabel, disabled }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <select
        id={id}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? 'true' : undefined}
        className={`w-full rounded border bg-white px-3 py-2 text-sm ${error ? 'border-red-500' : 'border-slate-300'}`}
      >
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
