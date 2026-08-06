import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' };
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm dark:bg-slate-950/70"
      onClick={onClose}
    >
      <div
        className={`animate-fade-in-up card w-full ${sizes[size]} overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
            <button
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
