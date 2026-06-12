import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { playSound } from '../utils/sound';

const ToastContext = createContext(() => {});

const ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    playSound('notif');
    const id = ++idRef.current;
    setToasts(t => [...t, { id, message, type, leaving: false }]);
    setTimeout(() => setToasts(t => t.map(x => (x.id === id ? { ...x, leaving: true } : x))), duration);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration + 280);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast toast-${t.type === 'warning' ? 'info' : t.type}`}
            style={t.leaving ? { animation: 'slideIn 0.3s ease reverse' } : undefined}
          >
            <span>{ICONS[t.type] || 'ℹ️'}</span> {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
