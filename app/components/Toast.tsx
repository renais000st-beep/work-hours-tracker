'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

function Toast({ toast, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, 3500);
    return () => {
      cancelAnimationFrame(show);
      clearTimeout(timer);
    };
  }, [toast.id, onRemove]);

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const icons = {
    success: <CheckCircle className="size-5 text-emerald-400 shrink-0" />,
    error: <XCircle className="size-5 text-red-400 shrink-0" />,
    info: <Info className="size-5 text-zinc-300 shrink-0" />,
  };

  const barColors = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    info: 'bg-zinc-400',
  };

  const borderColors = {
    success: 'border-emerald-500/30',
    error: 'border-red-500/30',
    info: 'border-zinc-700',
  };

  return (
    <div
      className={`relative flex items-center gap-3 bg-zinc-900 border ${borderColors[toast.type]} rounded-2xl px-4 py-3 shadow-2xl min-w-[260px] max-w-sm overflow-hidden`}
      style={{
        transition: 'opacity 0.28s ease-out, transform 0.28s ease-out',
        opacity: visible && !exiting ? 1 : 0,
        transform: visible && !exiting ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.96)',
      }}
    >
      {icons[toast.type]}
      <span className="text-sm text-white flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={dismiss}
        className="text-zinc-500 hover:text-white transition-colors shrink-0 ml-1"
      >
        <X className="size-4" />
      </button>
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${barColors[toast.type]} opacity-50`}
        style={{ animation: 'toast-progress 3.5s linear forwards' }}
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed z-[200] flex flex-col gap-2 items-end pointer-events-none bottom-24 right-4 sm:bottom-6 sm:right-6">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
