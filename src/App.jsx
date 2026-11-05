import React, { useState } from 'react';
import './App.css'; 
import Login from './components/login/Login'; // Importamos el login corporativo
import Condiciones from './components/condiciones/Condiciones';

function App() {
  // Estado global para controlar si el usuario está logueado
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <div className="appContainer">
      
      {/* --- ENCABEZADO CORPORATIVO GENERAL --- */}
      <header className="mainHeader">
        <h1 className="mainTitle">super a</h1>
        <h2 className="mainSubtitle">Tus compras al paso</h2>
      </header>

      {/* --- RENDER DINÁMICO SEGÚN AUTENTICACIÓN --- */}
      <main className="mainContent">
        {isAuthenticated ? (
          // Si está autenticado, ve todo el sistema de supervisión y auditoría
          <Condiciones />
        ) : (
          // Si no, se queda bloqueado en la tarjeta de login
          <Login onLoginSuccess={setIsAuthenticated} />
        )}
      </main>

    </div>
  );
}

export default App;