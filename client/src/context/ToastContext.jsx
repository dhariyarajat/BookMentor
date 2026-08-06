import { createContext, useContext, useCallback } from 'react';
import { Info } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  // Keeps the app-wide `toast(message, type)` API used everywhere.
  const notify = useCallback((message, type = 'success') => {
    if (type === 'error') toast.error(message);
    else if (type === 'info') toast(message, { icon: <Info className="h-4 w-4 text-indigo-500" /> });
    else toast.success(message);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <Toaster
        position="top-right"
        gutter={8}
        containerStyle={{ zIndex: 99999, top: 80 }}
        toastOptions={{
          duration: 4200,
          className:
            '!rounded-xl !border !border-slate-200 !bg-white !px-4 !py-3 !text-sm !font-medium !text-slate-800 !shadow-lg dark:!border-slate-700 dark:!bg-slate-800 dark:!text-slate-100',
          success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
          error: { iconTheme: { primary: '#e11d48', secondary: '#fff' } },
        }}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
