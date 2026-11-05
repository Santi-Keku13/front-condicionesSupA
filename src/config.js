// src/config.js
export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8089";

// Endpoints útiles
export const ENDPOINTS = {
  login: `${API_URL}/api/login`,
  condiciones: `${API_URL}/api/condiciones`,
  cambiosPrecios: `${API_URL}/api/cambios-precios`,
  // 🌟 Se define como función para que ColectarPrecios.jsx pueda llamarla sin romper
  productosCache: (sucursal = "super_a") => `${API_URL}/api/productos_cache.json`,
  regenerarCache: `${API_URL}/api/regenerar-cache`,
  ofertasComparativas: `${API_URL}/api/ofertas-comparativas`,
};