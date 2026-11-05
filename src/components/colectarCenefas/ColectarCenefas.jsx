import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import Cenefa from "../cenefa/Cenefa";
import styles from "./ColectarCenefas.module.css";
import { ENDPOINTS } from "../../config";

const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const CANTIDAD_MAX = 99;

// ---------- HELPERS ----------
const formatoPrecio = (n) =>
  Number(n || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const extraerCantidadMinima = (texto = "") => {
  const m = texto.match(/LLEVANDO\s+(\d+)/i);
  return m ? m[1] : "2";
};

const mapearACenefa = (item, tipoCenefa) => {
  const precioAntes = Number(item.precio5 ?? item.precio ?? 0);
  const precioAhora = Number(item.precioFinal ?? 0);
  const hayOferta = precioAhora > 0 && precioAntes > 0 && precioAhora < precioAntes;

  const tieneCondicion = item.tieneCondicion === true;
  const cantMinima = item.cantMinima || extraerCantidadMinima(item.condicionTexto || "") || "2";
  const precioCondicionVal = Number(item.precioCondicion || 0);

  return {
    tipo: tipoCenefa,
    hayOferta,
    datos: {
      descripcion: item.articulo || item.descripcion || "DESCRIPCIÓN NO DISPONIBLE",
      precioAntes: formatoPrecio(precioAntes),
      precioAhora: formatoPrecio(precioAhora),
      codigo: item.idArticulo || item.id || item.codigo || "",
      ean: item.scanner || item.ean || "",
      
      // 🌟 Mapeo exacto para el Tipo 5 usando tu objeto JSON
      precioRegular: formatoPrecio(precioAhora > 0 ? precioAhora : precioAntes),
      precioCondicion: tieneCondicion ? formatoPrecio(precioCondicionVal) : formatoPrecio(precioAhora),
      cantMinima: cantMinima,
    },
  };
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
const ColectarCenefas = () => {
  const sucursalActual = useMemo(
    () => localStorage.getItem("sucursal") || "acceso",
    []
  );
  const JSON_URL = useMemo(
    () => ENDPOINTS.productosCache(sucursalActual),
    [sucursalActual]
  );
  const CACHE_KEY = `colector_precios_cache_v1_${sucursalActual}`;

  const [cache, setCache] = useState(null);
  const [cargandoCache, setCargandoCache] = useState(true);
  const [errorCache, setErrorCache] = useState(null);

  // 🌟 Tipo de cenefa seleccionado (1, 2, 3, 4 o 5)
  const [tipoCenefa, setTipoCenefa] = useState(1);

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

  // ---------- Cargar JSON de Precios ----------
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
              return;
            }
          }
        } catch {}
      }

      try {
        const urlFinal = `${JSON_URL}${JSON_URL.includes("?") ? "&" : "?"}t=${Date.now()}`;
        const res = await fetch(urlFinal, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
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

  useEffect(() => {
    cargarJSON(false);
  }, [cargarJSON]);

  useEffect(() => {
    if (!cargandoCache && cache) inputRef.current?.focus();
  }, [cargandoCache, cache]);

  // ---------- Búsqueda y Agregar Producto ----------
  const handleSubmit = (e) => {
    e.preventDefault();
    const codigo = codigoInput.trim();
    if (!codigo) return;

    if (!cache) {
      pushToast("warning", "Precios no cargados", "Esperá a que cargue el JSON");
      return;
    }

    // Verificar si ya existe en la lista de escaneados
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
      pushToast("info", "Cantidad aumentada", `${existente.articulo}`);
      setCodigoInput("");
      inputRef.current?.focus();
      return;
    }

    // Búsqueda flexible en la estructura de items
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
        {
          scanner: codigo,
          idArticulo: "—",
          articulo: "Código no encontrado",
          error: true,
          cantidad: 1,
        },
      ]);
      pushToast("error", "No encontrado", `El código ${codigo} no existe`);
    } else {
      setItems((prev) => [...prev, { ...prod, cantidad: 1 }]);
      pushToast("success", "Agregado", prod.articulo);
    }
    setCodigoInput("");
    inputRef.current?.focus();
  };

  // ---------- Acciones sobre la Lista ----------
  const eliminarItem = (scanner) =>
    setItems((prev) => prev.filter((i) => i.scanner !== scanner));

  const cambiarCantidad = (scanner, delta) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.scanner !== scanner || i.error) return i;
        const nueva = Math.max(
          1,
          Math.min((i.cantidad || 1) + delta, CANTIDAD_MAX)
        );
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

  // ---------- Valores Derivados ----------
  const itemsValidos = useMemo(() => items.filter((i) => !i.error), [items]);

  const totalCenefas = useMemo(
    () => itemsValidos.reduce((acc, i) => acc + (i.cantidad || 1), 0),
    [itemsValidos]
  );

  const totalItems = useMemo(
    () => items.reduce((acc, i) => acc + (i.error ? 1 : i.cantidad || 1), 0),
    [items]
  );

  const cenefasMapeadas = useMemo(() => {
    const result = [];
    itemsValidos.forEach((item) => {
      const cantidad = item.cantidad || 1;
      const cenefa = mapearACenefa(item, tipoCenefa);
      for (let i = 0; i < cantidad; i++) {
        result.push(cenefa);
      }
    });
    return result;
  }, [itemsValidos, tipoCenefa]);

  // ============================================================
  // RENDER
  // ============================================================
  if (cargandoCache && !cache) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Colector de Cenefas</h1>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Cargando precios de {sucursalActual.toUpperCase()}...</p>
        </div>
      </div>
    );
  }

  if (errorCache && !cache) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Colector de Cenefas</h1>
        <div className={styles.errorState}>
          <p>❌ No se pudieron cargar los precios</p>
          <span>{errorCache}</span>
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
        <h1 className={styles.title}>Colector de Cenefas</h1>
        <div className={styles.cacheBadge}>
          <span className={styles.cacheDot} />
          <div className={styles.cacheInfo}>
            <span className={styles.cacheLabel}>Sucursal</span>
            <span className={styles.cacheValue}>{sucursalActual.toUpperCase()}</span>
          </div>
          <span className={styles.cacheDivider} />
          <div className={styles.cacheInfo}>
            <span className={styles.cacheLabel}>Productos</span>
            <span className={styles.cacheValue}>
              {cache?.total_productos?.toLocaleString("es-AR") || 0}
            </span>
          </div>
        </div>
      </div>

      {/* ---------- SELECTOR DE TIPO DE CENEFA ---------- */}
      <div className={styles.tipoSelector}>
        <span className={styles.tipoLabel}>Tipo de cenefa:</span>
        {[1, 2, 3, 4, 5].map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.tipoBtn} ${tipoCenefa === t ? styles.tipoBtnActive : ""}`}
            onClick={() => setTipoCenefa(t)}
          >
            {t === 1 && "Cenefa antes y ahora Cuadradita"}
            {t === 2 && "Cenefa antes y ahora Alargadita"}
            {t === 3 && "Cenefa antes y ahora 3 x 1"}
            {t === 4 && "Cenefa Básica 3 x 1"}
            {t === 5 && "Condición Comercial"}
          </button>
        ))}
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
        <button
          type="submit"
          className={styles.btnPrimary}
          disabled={!codigoInput.trim()}
        >
          Agregar
        </button>
      </form>

      {/* ---------- CABECERA LISTA ---------- */}
      <div className={styles.listHeader}>
        <h2 className={styles.listTitle}>
          Lista de cenefas <span className={styles.counter}>{totalCenefas}</span>
        </h2>
        <div className={styles.listActions}>
          <button onClick={limpiarLista} className={styles.btnGhost} disabled={!items.length}>
            Vaciar
          </button>
          <button onClick={imprimir} className={styles.btnPrimary} disabled={!totalCenefas}>
            🖨️ Imprimir cenefas
          </button>
        </div>
      </div>

      {/* ---------- TABLA DE PRODUCTOS ---------- */}
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
                <th className={styles.th}>EAN / Escáner</th>
                <th className={styles.th}>ID Art.</th>
                <th className={styles.th}>Artículo</th>
                <th className={styles.th}>Antes (L5)</th>
                <th className={styles.th}>Ahora</th>
                <th className={`${styles.th} ${styles.thCenter}`}>Cantidad</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr
                  key={`${item.scanner}-${index}`}
                  className={`${styles.tr} ${item.error ? styles.trError : ""}`}
                >
                  <td className={`${styles.td} ${styles.tdBold}`}>{item.scanner}</td>
                  <td className={styles.td} style={{ fontFamily: "monospace", color: "#555" }}>
                    {item.idArticulo || "—"}
                  </td>
                  <td className={styles.td}>
                    {item.error ? (
                      <span className={styles.errorText}>❌ Código no encontrado</span>
                    ) : (
                      item.articulo
                    )}
                  </td>
                  <td style={{ textDecoration: "line-through", color: "#666" }}>
                    {!item.error && `$${formatoPrecio(item.precio5 ?? item.precio)}`}
                  </td>
                  <td style={{ fontWeight: "bold", color: "#C41E3A" }}>
                    {!item.error && `$${formatoPrecio(item.precioFinal)}`}
                  </td>
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

      {/* ---------- SECCIÓN DE IMPRESIÓN (PORTAL EN BODY) ---------- */}
      {createPortal(
        <div className={`seccion-impresion-portal grid-tipo-${tipoCenefa}`}>
          {cenefasMapeadas.map((c, i) => (
            <Cenefa key={i} tipo={c.tipo} datos={c.datos} />
          ))}
        </div>,
        document.body
      )}

      {/* ---------- TOASTS NOTIFICATIONS ---------- */}
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
                  {totalItems === 1 ? "cenefa" : "cenefas"}?
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

export default ColectarCenefas;