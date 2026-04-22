import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import './ToastContext.css';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

type ToastItem = {
  id: string;
  title: string;
  body: string;
  variant: ToastVariant;
};

type ToastContextType = {
  pushToast: (message: string, options?: { title?: string; variant?: ToastVariant }) => void;
};

const ToastContext = createContext<ToastContextType>({
  pushToast: () => {},
});

const resolveVariant = (title: string, body: string): ToastVariant => {
  const value = `${title} ${body}`.toLowerCase();
  if (/(error|denegad|incorrect|imposible|ocupad)/.test(value)) return 'error';
  if (/(éxito|exito|actualiz|guard|cread|eliminad|concedid|activad)/.test(value)) return 'success';
  if (/(aviso|atención|atencion|sin cambios|completo)/.test(value)) return 'warning';
  return 'info';
};

const parseAlertMessage = (value: unknown) => {
  const message = typeof value === 'string' ? value : String(value ?? '');
  const parts = message.split(/\n\s*\n/).filter(Boolean);
  const [rawTitle, ...rest] = parts.length > 1 ? parts : ['Aviso', message];
  const title = rawTitle.replace(/^[^a-zA-Z0-9ÁÉÍÓÚÜÑáéíóúüñ]+/, '').trim() || 'Aviso';
  const body = rest.join('\n\n').trim();

  return {
    title,
    body,
    variant: resolveVariant(title, body),
  };
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const originalAlertRef = useRef<typeof window.alert | null>(null);

  const pushToast = useCallback((message: string, options?: { title?: string; variant?: ToastVariant }) => {
    const parsed = parseAlertMessage(message);
    const title = options?.title || parsed.title;
    const body = parsed.body || message;
    const variant = options?.variant || parsed.variant;
    const toast: ToastItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title,
      body,
      variant,
    };

    setToasts((previous) => [...previous.slice(-3), toast]);
    window.setTimeout(() => {
      setToasts((previous) => previous.filter((entry) => entry.id !== toast.id));
    }, variant === 'error' ? 6000 : 4200);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    originalAlertRef.current = window.alert.bind(window);
    window.alert = (message?: any) => {
      pushToast(typeof message === 'string' ? message : String(message ?? ''));
    };

    return () => {
      if (originalAlertRef.current) {
        window.alert = originalAlertRef.current;
      }
    };
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-card toast-${toast.variant}`}>
            <div className="toast-title">{toast.title}</div>
            {toast.body && <div className="toast-body">{toast.body}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
