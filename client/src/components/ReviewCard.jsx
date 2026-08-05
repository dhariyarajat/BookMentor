import Avatar from './Avatar.jsx';
import StarRating from './StarRating.jsx';

/** Formats an ISO date string to e.g. "12 Aug 2026". */
function formatReviewDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ReviewCard({ review }) {
  const reviewer = review.student || {};
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-indigo-100 hover:bg-white hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-indigo-500/40 dark:hover:bg-slate-800">
      <div className="flex items-center gap-2.5">
        <Avatar name={reviewer.name} src={reviewer.avatar} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {reviewer.name || 'Anonymous'}
          </p>
          <StarRating value={review.rating} size="text-xs" />
        </div>
        <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
          {formatReviewDate(review.createdAt)}
        </span>
      </div>
      {review.comment && (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {review.comment}
        </p>
      )}
    </div>
  );
}
