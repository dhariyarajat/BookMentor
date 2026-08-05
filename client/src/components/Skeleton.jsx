export function SkeletonBox({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-800 ${className}`} />;
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="flex items-center gap-3">
        <SkeletonBox className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonBox className="h-4 w-1/2" />
          <SkeletonBox className="h-3 w-1/3" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <SkeletonBox className="h-3 w-full" />
        <SkeletonBox className="h-3 w-2/3" />
      </div>
      <div className="mt-4 flex gap-2">
        <SkeletonBox className="h-8 w-24" />
        <SkeletonBox className="h-8 w-24" />
      </div>
    </div>
  );
}

export function SkeletonStat({ className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <SkeletonBox className="h-4 w-2/3" />
      <SkeletonBox className="mt-3 h-8 w-16" />
    </div>
  );
}

export default SkeletonBox;
