import { useState } from 'react';

const SIZE_MAP = {
  'text-xs': 'h-3.5 w-3.5',
  'text-sm': 'h-4 w-4',
  'text-base': 'h-5 w-5',
  'text-lg': 'h-6 w-6',
  'text-xl': 'h-6 w-6',
  'text-2xl': 'h-7 w-7',
  'text-3xl': 'h-8 w-8',
};

export default function StarRating({ value = 0, onChange, size = 'text-base' }) {
  const [hover, setHover] = useState(null);
  const shown = hover ?? value;
  const box = SIZE_MAP[size] || 'h-5 w-5';

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHover(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={`${onChange ? 'cursor-pointer transition-transform duration-150 hover:scale-125 active:scale-95' : 'cursor-default'}`}
        >
          <svg
            viewBox="0 0 20 20"
            className={`${box} transition-colors duration-150 ${
              n <= shown ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'
            }`}
          >
            <path d="M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z" />
          </svg>
        </button>
      ))}
    </div>
  );
}
