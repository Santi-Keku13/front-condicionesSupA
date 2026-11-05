import React, { useState } from 'react';
import styles from './Login.module.css'; 
import { useNotification } from '../../utilidades/useNotification';
import stylesCondiciones from '../condiciones/Condiciones.module.css';
import { ENDPOINTS } from '../../config';

function Login({ onLoginSuccess }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [errorLogin, setErrorLogin] = useState('');
  const [cargando, setCargando] = useState(false);

  const { showToast, NotificationComponent } = useNotification();

  const manejarEnvio = async (e) => {
    e.preventDefault();
    setErrorLogin('');
    setCargando(true);

    showToast("Autenticando", `Intentando conectar para el usuario: ${usuario}`, "info", 3000);

    try {
      const response = await fetch(ENDPOINTS.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: usuario.trim(),
          password: password.trim()
        })
      });

      const resultado = await response.json();

      if (response.ok && resultado.auth) {
        localStorage.setItem('operador_nombre', resultado.nombre || 'Super A');
        localStorage.setItem('operador_usuario', usuario.trim().toLowerCase());

        // Configuración fija para la sucursal Super A
        localStorage.setItem('sucursal', 'super_a');
        localStorage.setItem('archivo_json', resultado.archivo_json || 'productos_cache.json');
        localStorage.setItem('listas', JSON.stringify(resultado.listas || ['Lista 1', 'Lista 11']));

        // Limpiar caches viejos
        Object.keys(localStorage)
          .filter((k) => k.startsWith('colector_precios_cache_v1'))
          .forEach((k) => localStorage.removeItem(k));

        setCargando(false);
        onLoginSuccess(true); 
      } else {
        setCargando(false);
        setErrorLogin(`⚠️ ${resultado.detail || 'Credenciales incorrectas.'}`);
      }
    } catch (err) {
      setCargando(false);
      setErrorLogin('❌ Error de conexión con el servidor. El Backend de Python no respondió.');
    }
  };

  return (
    <div className={styles.loginWrapper}>
      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <h2>CONTROL DE ACCESO</h2>
          <p>Sistema Interno de Gestión de Precios - Super A</p>
        </div>

        <form onSubmit={manejarEnvio} className={styles.loginForm}>
          {errorLogin && (
            <div className={styles.errorAlert}>{errorLogin}</div>
          )}

          <div className={stylesCondiciones.filterGroup} style={{ marginBottom: '20px', width: '100%' }}>
            <label className={stylesCondiciones.filterLabel} style={{ fontSize: '0.85rem', marginBottom: '6px' }}>
              👤 Usuario Operador:
            </label>
            <input 
              type="text"
              placeholder="Ingrese su usuario..."
              className={stylesCondiciones.searchInput}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              style={{ width: '100%', boxSizing: 'border-box', height: '42px' }}
            />
          </div>

          <div className={stylesCondiciones.filterGroup} style={{ marginBottom: '25px', width: '100%' }}>
            <label className={stylesCondiciones.filterLabel} style={{ fontSize: '0.85rem', marginBottom: '6px' }}>
              🔒 Contraseña Corporativa:
            </label>
            <input 
              type="password"
              placeholder="••••••••••••"
              className={stylesCondiciones.searchInput}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', boxSizing: 'border-box', height: '42px' }}
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className={`${styles.submitButton} ${cargando ? styles.submitButtonDisabled : styles.submitButtonActive}`}
          >
            {cargando ? 'Autenticando...' : 'Ingresar al Panel'}
          </button>

          <div className={styles.footerText}>
            Super A © 2026 • Todos los derechos reservados
          </div>
        </form>
      </div>
      <NotificationComponent />
    </div>
  );
}

export default Login;