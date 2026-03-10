'use client';

import { useToast } from '@/lib/toast-context';

const typeStyles = {
  success: 'bg-green-600/90 border-green-500',
  error: 'bg-red-600/90 border-red-500',
  info: 'bg-indigo-600/90 border-indigo-500',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg border text-white text-sm animate-fade-in cursor-pointer ${typeStyles[toast.type]}`}
          onClick={() => removeToast(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
