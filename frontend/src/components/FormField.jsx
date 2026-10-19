import { useId } from 'react';

// A label + input + error text, linked for screen readers.
// <FormField label="Email" type="email" value={v} onChange={...} error="Required" />
export default function FormField({ label, error, type = 'text', ...inputProps }) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded border px-3 py-2 text-sm ${
          error ? 'border-red-500' : 'border-slate-300'
        }`}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
