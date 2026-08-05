export default function EmptyState({ icon = '🔍', title = 'Nothing here yet', subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-indigo-100 bg-gradient-to-b from-white to-indigo-50/40 px-6 py-14 text-center dark:border-indigo-500/30 dark:from-slate-900 dark:to-indigo-500/10">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-3xl shadow-lg shadow-indigo-600/20">
        <span className="drop-shadow-sm">{icon}</span>
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      {subtitle && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
