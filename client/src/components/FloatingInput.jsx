import { useState } from 'react';

function EyeIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l14 14" />
      <path d="M10.6 5.1A8.9 8.9 0 0110 5c-5.5 0-9 6-9 6a17 17 0 002.7 3.1M6.6 6.6a5 5 0 006.8 6.8M10 15.5A9.6 9.6 0 0110 16c5.5 0 9-6 9-6a17.6 17.6 0 00-2.6-3" />
      <path d="M14.1 8.1a3 3 0 01-4.1 4.1" />
    </svg>
  );
}

export default function FloatingInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  required,
  minLength,
  maxLength,
  autoComplete,
  error,
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';

  return (
    <div>
      <div className="field">
        <input
          id={id}
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={onChange}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
          placeholder=" "
          aria-invalid={!!error}
          className={`field-input ${isPassword ? 'pr-11' : ''}`}
        />
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
          >
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-rose-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
