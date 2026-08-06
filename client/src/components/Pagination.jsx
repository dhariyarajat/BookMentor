import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;

  const items = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) items.push(i);
    else if (items[items.length - 1] !== '…') items.push('…');
  }

  const arrowBtn =
    'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
      <button className={arrowBtn} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </button>
      {items.map((it, i) =>
        it === '…' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-sm text-slate-400">
            …
          </span>
        ) : (
          <button
            key={it}
            onClick={() => onChange(it)}
            aria-label={`Page ${it}`}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition ${
              it === page
                ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-indigo-300 hover:text-indigo-700'
            }`}
          >
            {it}
          </button>
        )
      )}
      <button className={arrowBtn} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
