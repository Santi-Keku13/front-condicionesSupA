import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom"; // 🌟 IMPORTANTE: Agregado createPortal
import Etiqueta from "../etiqueta/Etiqueta";
import styles from "./ColectarPrecios.module.css";
import { API_URL, ENDPOINTS } from "../../config";

const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const IVA = 1.21;
const CANTIDAD_MAX = 99;

// ---------- HELPERS ----------
const formatoPrecio = (n) =>
  Number(n || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const esPackPorDescripcion = (desc = "") =>
  /(^|\s)PACK(\s|$|\s?X\s?\d+)/i.test(desc);

const extraerCantidadMinima = (texto = "") => {
  const m = texto.match(/LLEVANDO\s+(\d+)/i);
  return m ? m[1] : "";
};

const esPack = (item) =>
  item?.tipoPresentacion === "pack" ||
  item?.itemPresentacion === 2 ||
  item?.itemPresentacion === 3 ||
  esPackPorDescripcion(item?.articulo || "");

const cantUnidadesDe = (item) => {
  const n = Number(item?.cantUnidades);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

const etiquetaTipo = (item) => {
  if (item?.tieneCondicion) return "CONDICIÓN";
  if (!esPack(item)) return "NORMAL";
  return `PACK x${cantUnidadesDe(item)}`;
};

const mapearAEtiqueta = (item) => {
  const pack = esPack(item);
  const cantUnidades = cantUnidadesDe(item);

  const tieneCondicion = item.tieneCondicion === true;

  let tipo;
  if (tieneCondicion) {
    tipo = "CONDICION";
  } else if (pack) {
    tipo = "PACK";
  } else {
    tipo = "NORMAL";
  }

  const precioFinal = Number(item.precioFinal || item.precioLista5 || 0);
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
      compraMinima: tieneCondicion
        ? extraerCantidadMinima(item.condicionTexto)
        : "",
      CantUni: pack ? cantUnidades : 1,
    },
  };
};

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
const ColectarPrecios = () => {
  const sucursalActual = useMemo(
    () => (typeof window !== "undefined" && localStorage.getItem("sucursal")) || "acceso",
    []
  );

  const JSON_URL = useMemo(
    () => ENDPOINTS.productosCache(sucursalActual),
    [sucursalActual]
  );
  const REGENERAR_URL = ENDPOINTS.regenerarCache;
  const CACHE_KEY = `colector_precios_cache_v1_${sucursalActual}`;

  const [cache, setCache] = useState(null);
  const [cargandoCache, setCargandoCache] = useState(true);
  const [errorCache, setErrorCache] = useState(null);
  const [regenerando, setRegenerando] = useState(false);

  const [codigoInput, setCodigoInput] = useState("");
  const [items, setItems] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [confirmarVaciar, setConfirmarVaciar] = useState(false);

  const inputRef = useRef(null);

  // ---------- Toast Notifications ----------
  const pushToast = useCallback((tipo, titulo, mensaje) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tipo, titulo, mensaje }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  // ---------- Cargar JSON ----------
  const cargarJSON = useCallback(
    async (forzar = false) => {
      setCargandoCache(true);
      setErrorCache(null);

      if (!forzar) {
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL_MS) {
              setCache(parsed.data);
              setCargandoCache(false);
              pushToast(
                "info",
                "Cache cargado",
                `${parsed.data.total_productos} productos (${sucursalActual})`
              );
              return;
            }
          }
        } catch {}
      }

      try {
        const urlFinal = `${JSON_URL}${JSON_URL.includes("?") ? "&" : "?"}t=${Date.now()}`;
        const res = await fetch(urlFinal, { cache: "no-store" });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!data?.items) throw new Error("JSON sin campo 'items'");

        setCache(data);
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ ts: Date.now(), data })
          );
        } catch {}

        pushToast(
          "success",
          "Precios cargados",
          `${data.total_productos} productos · ${sucursalActual.toUpperCase()}`
        );
      } catch (e) {
        setErrorCache(e.message || "Error al cargar precios");
        pushToast("error", "Error al cargar precios", e.message);
      } finally {
        setCargandoCache(false);
      }
    },
    [pushToast, JSON_URL, CACHE_KEY, sucursalActual]
  );

  // ---------- Regenerar cache ----------
  const regenerarYRecargar = useCallback(async () => {
    setRegenerando(true);
    try {
      pushToast("info", "Actualizando", "Regenerando precios en el servidor...");
      const res = await fetch(REGENERAR_URL, { method: "POST" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      await res.json();
      await cargarJSON(true);
    } catch (e) {
      pushToast("error", "Error al regenerar", e.message);
    } finally {
      setRegenerando(false);
    }
  }, [cargarJSON, pushToast]);

  useEffect(() => {
    cargarJSON(false);
  }, [cargarJSON]);

  useEffect(() => {
    if (!cargandoCache && cache) inputRef.current?.focus();
  }, [cargandoCache, cache]);

  // ---------- Búsqueda y Submit ----------
  const handleSubmit = (e) => {
    e.preventDefault();
    const codigo = codigoInput.trim();
    if (!codigo) return;

    if (!cache) {
      pushToast("warning", "Precios no cargados", "Esperá a que cargue el JSON");
      return;
    }

    const existente = items.find(
      (i) => (i.scanner === codigo || String(i.idArticulo) === codigo) && !i.error
    );

    if (existente) {
      setItems((prev) =>
        prev.map((i) =>
          (i.scanner === codigo || String(i.idArticulo) === codigo) && !i.error
            ? { ...i, cantidad: Math.min((i.cantidad || 1) + 1, CANTIDAD_MAX) }
            : i
        )
      );
      pushToast(
        "info",
        "Cantidad aumentada",
        `${existente.articulo} → ${(existente.cantidad || 1) + 1}`
      );
      setCodigoInput("");
      inputRef.current?.focus();
      return;
    }

    let prod = cache.items[codigo];
    if (!prod && typeof cache.items === "object") {
      const listaValores = Array.isArray(cache.items)
        ? cache.items
        : Object.values(cache.items);

      prod = listaValores.find(
        (p) => String(p.scanner) === codigo || String(p.idArticulo) === codigo
      );
    }

    if (!prod) {
      setItems((prev) => [
        ...prev,
        { scanner: codigo, articulo: "Código no encontrado", error: true, cantidad: 1 },
      ]);
      pushToast("error", "No encontrado", `El código ${codigo} no existe`);
    } else {
      setItems((prev) => [...prev, { ...prod, cantidad: 1 }]);
      pushToast("success", "Agregado", `${prod.articulo} · ${etiquetaTipo(prod)}`);
    }
    setCodigoInput("");
    inputRef.current?.focus();
  };

  // ---------- Acciones ----------
  const eliminarItem = (scanner) =>
    setItems((prev) => prev.filter((i) => i.scanner !== scanner));

  const cambiarCantidad = (scanner, delta) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.scanner !== scanner || i.error) return i;
        const nueva = Math.max(1, Math.min((i.cantidad || 1) + delta, CANTIDAD_MAX));
        return { ...i, cantidad: nueva };
      })
    );
  };

  const setearCantidad = (scanner, valor) => {
    const num = parseInt(valor, 10);
    if (isNaN(num)) return;
    const nueva = Math.max(1, Math.min(num, CANTIDAD_MAX));
    setItems((prev) =>
      prev.map((i) =>
        i.scanner === scanner && !i.error ? { ...i, cantidad: nueva } : i
      )
    );
  };

  const limpiarLista = () => {
    if (!items.length) return;
    setConfirmarVaciar(true);
  };

  const confirmarLimpiar = () => {
    setItems([]);
    setConfirmarVaciar(false);
    pushToast("info", "Lista vaciada", "Se eliminaron todos los códigos");
  };

  const imprimir = () => {
    if (!items.filter((i) => !i.error).length) {
      pushToast("warning", "Nada para imprimir", "Escaneá al menos un código válido");
      return;
    }
    window.print();
  };

  // ---------- Derivados ----------
  const itemsValidos = useMemo(() => items.filter((i) => !i.error), [items]);

  const totalEtiquetas = useMemo(
    () => itemsValidos.reduce((acc, i) => acc + (i.cantidad || 1), 0),
    [itemsValidos]
  );

  const totalItems = useMemo(
    () => items.reduce((acc, i) => acc + (i.error ? 1 : i.cantidad || 1), 0),
    [items]
  );

  const etiquetasMapeadas = useMemo(() => {
    const result = [];
    itemsValidos.forEach((item) => {
      const cantidad = item.cantidad || 1;
      const etiqueta = mapearAEtiqueta(item);
      for (let i = 0; i < cantidad; i++) result.push(etiqueta);
    });
    return result;
  }, [itemsValidos]);

  // ============================================================
  // RENDER
  // ============================================================
  if (cargandoCache && !cache) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Colector de Precios</h1>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Cargando lista de precios de <strong>{sucursalActual.toUpperCase()}</strong>...</p>
        </div>
      </div>
    );
  }

  if (errorCache && !cache) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Colector de Precios</h1>
        <div className={styles.errorState}>
          <p>❌ No se pudieron cargar los precios de <strong>{sucursalActual.toUpperCase()}</strong></p>
          <span>{errorCache}</span>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "8px" }}>
            URL: {JSON_URL}
          </span>
          <button className={styles.btnPrimary} onClick={() => cargarJSON(true)}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ---------- HEADER ---------- */}
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Colector de Precios</h1>
        {cache && (
          <div className={styles.cacheBadge}>
            <span className={styles.cacheDot} />
            <div className={styles.cacheInfo}>
              <span className={styles.cacheLabel}>Sucursal</span>
              <span className={styles.cacheValue}>{sucursalActual.toUpperCase()}</span>
            </div>
            <span className={styles.cacheDivider} />
            <div className={styles.cacheInfo}>
              <span className={styles.cacheLabel}>Última actualización</span>
              <span className={styles.cacheValue}>{cache.ultima_actualizacion}</span>
            </div>
            <span className={styles.cacheDivider} />
            <div className={styles.cacheInfo}>
              <span className={styles.cacheLabel}>Productos</span>
              <span className={styles.cacheValue}>
                {cache.total_productos.toLocaleString("es-AR")}
              </span>
            </div>
            <button
              className={styles.btnRefresh}
              onClick={() => cargarJSON(true)}
              disabled={cargandoCache || regenerando}
              title="Recargar JSON"
            >
              {cargandoCache ? "..." : "↻"}
            </button>
            <button
              className={styles.btnRefresh}
              onClick={regenerarYRecargar}
              disabled={cargandoCache || regenerando}
              title="Regenerar precios desde la BD"
            >
              {regenerando ? "..." : "⟳"}
            </button>
          </div>
        )}
      </div>

      {/* ---------- INPUT DE ESCANEO ---------- */}
      <form onSubmit={handleSubmit} className={styles.scanPanel}>
        <div className={styles.scanGroup}>
          <label className={styles.scanLabel} htmlFor="scanner-input">
            Escaneá o escribí el código de barras
          </label>
          <input
            id="scanner-input"
            ref={inputRef}
            type="text"
            value={codigoInput}
            onChange={(e) => setCodigoInput(e.target.value)}
            placeholder="Esperando lectura del scanner..."
            className={styles.scanInput}
            autoComplete="off"
          />
        </div>
        <button type="submit" className={styles.btnPrimary} disabled={!codigoInput.trim()}>
          Agregar
        </button>
      </form>

      {/* ---------- CABECERA DE LISTA ---------- */}
      <div className={styles.listHeader}>
        <h2 className={styles.listTitle}>
          Lista de etiquetas <span className={styles.counter}>{totalEtiquetas}</span>
        </h2>
        <div className={styles.listActions}>
          <button onClick={limpiarLista} className={styles.btnGhost} disabled={!items.length}>
            Vaciar
          </button>
          <button onClick={imprimir} className={styles.btnPrimary} disabled={!totalEtiquetas}>
            🖨️ Imprimir etiquetas
          </button>
        </div>
      </div>

      {/* ---------- LISTA DE PRODUCTOS ---------- */}
      {items.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Aún no escaneaste ningún código.</p>
          <span>Los productos aparecerán acá a medida que los escanees.</span>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th}>Scanner</th>
                {/* 🌟 NUEVA COLUMNA: IDARTICULO */}
                <th className={styles.th}>Cod. Int</th>
                <th className={styles.th}>Artículo</th>
                <th className={styles.th}>Precio final</th>
                <th className={styles.th}>Condición</th>
                <th className={styles.th}>Tipo</th>
                <th className={`${styles.th} ${styles.thCenter}`}>Cantidad</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.scanner}
                  className={`${styles.tr} ${item.error ? styles.trError : ""}`}
                >
                  {/* Código de Barras / Scanner */}
                  <td className={`${styles.td} ${styles.tdBold}`}>{item.scanner}</td>

                  {/* 🌟 NUEVA CELDA: IDArticulo al lado de Scanner */}
                  <td className={styles.td}>
                    {item.error ? "-" : item.idArticulo || "-"}
                  </td>

                  {/* Descripción del Artículo */}
                  <td className={styles.td}>
                    {item.error ? (
                      <span className={styles.errorText}>❌ Código no encontrado</span>
                    ) : (
                      item.articulo
                    )}
                  </td>

                  {/* Precio Final */}
                  <td className={styles.td}>
                    {!item.error && (
                      <span className={styles.precioFinal}>
                        ${formatoPrecio(item.precioFinal)}
                      </span>
                    )}
                  </td>

                  {/* Badge Condición */}
                  <td className={styles.td}>
                    {!item.error && item.tieneCondicion && (
                      <span className={styles.badgeCondicion}>{item.condicionTexto}</span>
                    )}
                  </td>

                  {/* Tipo de Etiqueta */}
                  <td className={styles.td}>
                    {!item.error && (
                      (() => {
                        if (item.tieneCondicion) {
                          return <span className={styles.badgeCondicion}>CONDICIÓN</span>;
                        }
                        if (esPack(item)) {
                          return <span className={styles.badgePack}>{etiquetaTipo(item)}</span>;
                        }
                        return <span className={styles.badgeNormal}>NORMAL</span>;
                      })()
                    )}
                  </td>

                  {/* Controles de Cantidad */}
                  <td className={styles.td}>
                    {!item.error && (
                      <div className={styles.cantidadControl}>
                        <button
                          type="button"
                          className={styles.cantidadBtn}
                          onClick={() => cambiarCantidad(item.scanner, -1)}
                          disabled={(item.cantidad || 1) <= 1}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          className={styles.cantidadInput}
                          value={item.cantidad || 1}
                          onChange={(e) => setearCantidad(item.scanner, e.target.value)}
                          min="1"
                          max={CANTIDAD_MAX}
                        />
                        <button
                          type="button"
                          className={styles.cantidadBtn}
                          onClick={() => cambiarCantidad(item.scanner, 1)}
                          disabled={(item.cantidad || 1) >= CANTIDAD_MAX}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Botón Eliminar */}
                  <td className={styles.td}>
                    <button
                      className={styles.btnDelete}
                      onClick={() => eliminarItem(item.scanner)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- SECCIÓN DE IMPRESIÓN (PAGINACIÓN A4 EN BLOQUES DE 12) ---------- */}
      {createPortal(
        <div className="seccion-impresion-portal">
          {(() => {
            const paginas = [];
            const LIMITE_POR_HOJA = 12; // 🌟 CAMBIADO A 12 ETIQUETAS POR HOJA

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

      {/* ---------- TOASTS ---------- */}
      <div className={styles.toastContainer}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${styles["toast" + capitalize(t.tipo)]}`}
          >
            <div className={styles.toastContent}>
              <span className={styles.toastTitle}>{t.titulo}</span>
              <span className={styles.toastMessage}>{t.mensaje}</span>
            </div>
            <button className={styles.toastClose} onClick={() => removeToast(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>

      {/* ---------- MODAL CONFIRMAR VACIAR ---------- */}
      {confirmarVaciar && (
        <div className={styles.modalOverlay} onClick={() => setConfirmarVaciar(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Confirmar acción</h2>
              <button className={styles.closeButton} onClick={() => setConfirmarVaciar(false)}>
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalBlockFull}>
                <div className={styles.modalBlockLabel}>Vaciar lista</div>
                <div className={styles.modalBlockValue}>
                  ¿Estás seguro que querés eliminar los{" "}
                  <strong style={{ color: "#C41E3A" }}>{totalItems}</strong>{" "}
                  {totalItems === 1 ? "código cargado" : "códigos cargados"}?
                  Esta acción no se puede deshacer.
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => setConfirmarVaciar(false)}>
                Cancelar
              </button>
              <button className={styles.btnDanger} onClick={confirmarLimpiar}>
                Sí, vaciar lista
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColectarPrecios;