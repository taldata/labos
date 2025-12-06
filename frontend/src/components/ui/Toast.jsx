import React, { createContext, useContext, useState, useCallback } from 'react';
import './Toast.css';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const Toast = ({ id, type, message, onDismiss }) => {
  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  };

  return (
    <div className={`toast toast-${type}`} role="alert">
      <i className={`toast-icon ${icons[type]}`}></i>
      <span className="toast-message">{message}</span>
      <button className="toast-dismiss" onClick={() => onDismiss(id)} aria-label="Dismiss">
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, message, duration = 5000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, message }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((message, duration) => addToast('success', message, duration), [addToast]);
  const error = useCallback((message, duration) => addToast('error', message, duration), [addToast]);
  const warning = useCallback((message, duration) => addToast('warning', message, duration), [addToast]);
  const info = useCallback((message, duration) => addToast('info', message, duration), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error, warning, info, addToast, dismissToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            onDismiss={dismissToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default Toast;
