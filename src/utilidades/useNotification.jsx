import React, { useState, useCallback } from 'react';
import styles from '../components/condiciones/Condiciones.module.css';

export function useNotification() {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((t) => t.id !== id));
  }, []);

  // Función principal para disparar carteles
  const showToast = useCallback((title, message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    
    setToasts((prevToasts) => [...prevToasts, { id, title, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  // Componente visual contenedor que renderizaremos al final de la pantalla
  const NotificationComponent = () => {
    if (toasts.length === 0) return null;

    return (
      <div className={styles.toastContainer}>
        {toasts.map((toast) => {
          // Determinar estilo según tipo
          let classType = styles.toastInfo;
          if (toast.type === 'success') classType = styles.toastSuccess;
          if (toast.type === 'error') classType = styles.toastError;
          if (toast.type === 'warning') classType = styles.toastWarning;

          return (
            <div key={toast.id} className={`${styles.toast} ${classType}`}>
              <div className={toast.type === 'success' ? styles.toastSuccessText : ''}>
                <div className={styles.toastContent}>
                  <span className={styles.toastTitle}>{toast.title}</span>
                  <span className={styles.toastMessage}>{toast.message}</span>
                </div>
              </div>
              <button className={styles.toastClose} onClick={() => removeToast(toast.id)}>
                &times;
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return { showToast, NotificationComponent };
}