import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Etiqueta from "../etiqueta/Etiqueta";
import styles from "./OfertasComparativas.module.css";
import { API_URL } from "../../config";

const IVA = 1.21;

// ---------- ICONOS SVG PROFESIONALES ----------
const IconoPrinter = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
    <polyline points="6 9 6 2 18 2 18 9"></polyline>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
    <rect x="6" y="14" width="12" height="8"></rect>
  </svg>
);

const IconoError = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="15" y1="9" x2="9" y2="15"></line>
    <line x1="9" y1="9" x2="15" y2="15"></line>
  </svg>
);

const IconoInsignia = ({ color }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill={color} style={{ verticalAlign: 'middle', marginRight: '6px' }}>
    <circle cx="12" cy="12" r="10"></circle>
  </svg>
);

// ---------- HELPERS ----------
const formatoPrecio = (n) =>
  Number(n || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const esPack = (item) =>
  item?.tipoPresentacion === "pack" || item?.itemPresentacion === 2 || item?.itemPresentacion === 3;

const mapearAEtiqueta = (item) => {
  const pack = esPack(item);
  const cantUnidades = item?.cantUnidades || 1;
  const tieneCondicion = item?.tieneCondicion === true;

  let tipo = tieneCondicion ? "CONDICION" : pack ? "PACK" : "NORMAL";

  const precioFinal = Number(item.precioFinal || 0);
  const precioSinImp = precioFinal / IVA;
  const precioCondicion = Number(item.precioCondicion) || 0;

  return {
    tipo,
    datos: {
      descripcion: item.articulo,
      codigoInterno: String(item.idArticulo || ""),
      codigoBarras: item.scanner,
      precioUnitario: formatoPrecio(precioFinal),
      precioSinImpuesto: formatoPrecio(precioSinImp),
      precioCantidad: tieneCondicion ? formatoPrecio(precioCondicion) : "",
      compraMinima: tieneCondicion ? item.condicionTexto : "",
      CantUni: pack ? cantUnidades : 1,
    },
  };
};

const OfertasComparativas = () => {
  const [data, setData] = useState({ nuevas: [], viejas: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // 🎯 ESTADO FILTRO DE IMPRESIÓN
  const [filtroImpresion, setFiltroImpresion] = useState("NUEVAS");

  const sucursalActual = useMemo(
    () => (typeof window !== "undefined" && localStorage.getItem("sucursal")) || "acceso",
    []
  );

  const cargarOfertas = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/ofertas-comparativas?sucursal=${sucursalActual}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setData(result);
    } catch (e) {
      setError(e.message || "Error al cargar comparativa de ofertas");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarOfertas();
  }, [sucursalActual]);

  const imprimirEtiquetas = () => {
    window.print();
  };

  // 🌟 MAPEO DE ETIQUETAS FILTRADAS
  const etiquetasMapeadas = useMemo(() => {
    let listaFiltrada = [];

    if (filtroImpresion === "NUEVAS") {
      listaFiltrada = data.nuevas || [];
    } else if (filtroImpresion === "VIEJAS") {
      listaFiltrada = data.viejas || [];
    } else if (filtroImpresion === "TODAS") {
      listaFiltrada = [...(data.nuevas || []), ...(data.viejas || [])];
    }

    return listaFiltrada
      .filter((item) => item.encontrado)
      .map((item) => mapearAEtiqueta(item));
  }, [data, filtroImpresion]);

  if (cargando) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Cargando comparativa de ofertas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <IconoError />
        <p>Error al cargar ofertas</p>
        <span>{error}</span>
        <button className={styles.btnPrimary} onClick={cargarOfertas}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ---------- HEADER Y CONTROLES DE IMPRESIÓN ---------- */}
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Comparativa de Ofertas</h1>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#475569" }}>
              Modo de Impresión:
            </label>
            <select
              value={filtroImpresion}
              onChange={(e) => setFiltroImpresion(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontWeight: "bold",
                fontSize: "0.9rem",
                color: "#1e293b",
                backgroundColor: "#f8fafc",
                cursor: "pointer",
              }}
            >
              <option value="NUEVAS">Ofertas Nuevas ({data.nuevas?.length || 0})</option>
              <option value="VIEJAS">Ofertas Viejas ({data.viejas?.length || 0})</option>
              <option value="TODAS">
                Todas las Ofertas ({(data.nuevas?.length || 0) + (data.viejas?.length || 0)})
              </option>
            </select>
          </div>

          <button
            className={styles.btnPrimary}
            onClick={imprimirEtiquetas}
            disabled={!etiquetasMapeadas.length}
            style={{ marginTop: "18px", display: "flex", alignItems: "center", gap: "8px" }}
          >
            <IconoPrinter /> Imprimir ({etiquetasMapeadas.length})
          </button>
        </div>
      </div>

      {/* ---------- TABLAS DE OFERTAS ---------- */}
      <div className={styles.comparativaGrid}>
        {/* TABLA OFERTAS NUEVAS */}
        <div>
          <div className={styles.listHeader}>
            <h2 className={styles.listTitleNuevas}>
              <IconoInsignia color="#16a34a" />
              Ofertas Nuevas <span className={styles.counterNuevas}>{data.nuevas.length}</span>
            </h2>
          </div>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead className={styles.theadNuevas}>
                <tr>
                  <th className={styles.th}>Cod. Int</th>
                  <th className={styles.th}>Scanner</th>
                  <th className={styles.th}>Artículo</th>
                  <th className={styles.th} style={{ textAlign: "right" }}>
                    Precio
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.nuevas.map((item, idx) => (
                  <tr key={idx} className={styles.tr}>
                    <td className={`${styles.td} ${styles.tdBold}`}>{item.idArticulo}</td>
                    <td className={styles.td}>{item.scanner}</td>
                    <td className={styles.td}>{item.articulo}</td>
                    <td className={styles.td} style={{ textAlign: "right" }}>
                      ${formatoPrecio(item.precioFinal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLA OFERTAS VIEJAS */}
        <div>
          <div className={styles.listHeader}>
            <h2 className={styles.listTitleViejas}>
              <IconoInsignia color="#dc2626" />
              Ofertas Viejas <span className={styles.counterViejas}>{data.viejas.length}</span>
            </h2>
          </div>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead className={styles.theadViejas}>
                <tr>
                  <th className={styles.th}>Cod. Int</th>
                  <th className={styles.th}>Scanner</th>
                  <th className={styles.th}>Artículo</th>
                  <th className={styles.th} style={{ textAlign: "right" }}>
                    Precio
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.viejas.map((item, idx) => (
                  <tr key={idx} className={styles.tr}>
                    <td className={`${styles.td} ${styles.tdBold}`}>{item.idArticulo}</td>
                    <td className={styles.td}>{item.scanner}</td>
                    <td className={styles.td}>{item.articulo}</td>
                    <td className={styles.td} style={{ textAlign: "right" }}>
                      ${formatoPrecio(item.precioFinal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ---------- SECCIÓN IMPRESIÓN (PORTAL) ---------- */}
      {createPortal(
        <div className="seccion-impresion-portal">
          {(() => {
            const paginas = [];
            const LIMITE_POR_HOJA = 12;

            for (let i = 0; i < etiquetasMapeadas.length; i += LIMITE_POR_HOJA) {
              paginas.push(etiquetasMapeadas.slice(i, i + LIMITE_POR_HOJA));
            }

            return paginas.map((pagina, indexHoja) => (
              <div key={indexHoja} className="hoja-a4">
                <div className="grid-etiquetas">
                  {pagina.map((e, indexItem) => (
                    <Etiqueta key={indexItem} tipo={e.tipo} datos={e.datos} />
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>,
        document.body
      )}
    </div>
  );
};

export default OfertasComparativas;