import { useRef, useState } from 'react';

// Drop zone + click to choose. onFile(file) is called with the chosen file.
export default function FileDrop({ onFile, accept, text, activeText, disabled }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);

  const pick = (file) => file && onFile(file);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={text}
      aria-disabled={disabled}
      onClick={() => !disabled && input.current.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          input.current.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) pick(e.dataTransfer.files[0]);
      }}
      className={`cursor-pointer rounded border-2 border-dashed px-6 py-10 text-center text-sm ${
        over ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-600'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-slate-400'}`}
    >
      {over ? activeText : text}
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          pick(e.target.files[0]);
          e.target.value = ''; // lets the user choose the same file again
        }}
      />
    </div>
  );
}
