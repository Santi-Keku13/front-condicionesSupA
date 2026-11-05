import React, { useState, useEffect, useMemo, useRef } from 'react';
import styles from './Condiciones.module.css';
import CambiosPrecios from '../cambiosPrecios/CambiosPrecios';
import ColectarPrecios from '../colectar/ColectarPrecios';
import ColectarCenefas from '../colectarCenefas/ColectarCenefas';
import OfertasComparativa from '../ofertasComparativas/OfertasComparativas';
import { useNotification } from '../../utilidades/useNotification';
import { API_URL, ENDPOINTS } from "../../config";

function Condiciones() {
  const [pestanaActiva, setPestanaActiva] = useState('CONDICIONES');
  const { showToast, NotificationComponent } = useNotification();

  // Estados Datos
  const [datosCondiciones, setDatosCondiciones] = useState([]);
  const [datosPrecios, setDatosPrecios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Filtros Pestaña 1
  const [busquedaInput, setBusquedaInput] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [listasSeleccionadas, setListasSeleccionadas] = useState([]);
  const [menuListasAbierto, setMenuListasAbierto] = useState(false);
  const dropdownListasRef = useRef(null);

  const [tipoFiltroFecha, setTipoFiltroFecha] = useState('FechaModif');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Paginación Pestaña 1
  const [paginaActual, setPaginaActual] = useState(1);
  const filasPorPagina = 50;

  // Estado Modal compartido
  const [modalData, setModalData] = useState(null);

  // Listas activas para Super A
  const opcionesListas = ['Lista 1', 'Lista 11'];

  // Carga inicial paralela
  useEffect(() => {
    setCargando(true);
    Promise.all([
      fetch(ENDPOINTS.condiciones).then(res => {
        if (!res.ok) throw new Error("Error cargando condiciones");
        return res.json();
      }),
      fetch(ENDPOINTS.cambiosPrecios).then(res => {
        if (!res.ok) throw new Error("Error cargando cambios de precios");
        return res.json();
      }).catch(() => [])
    ])
    .then(([dataCondiciones, dataPrecios]) => {
      setDatosCondiciones(dataCondiciones);
      setDatosPrecios(dataPrecios);
      setCargando(false);
      showToast("Sincronización Exitosa", "Los datos comerciales de Super A se han actualizado correctamente.", "success");
    })
    .catch((err) => {
      setError(err.message);
      setCargando(false);
      showToast("Error de Conexión", `No se pudieron obtener los datos de Super A: ${err.message}`, "error", 6000);
    });
  }, [showToast]);

  // Cierra el menú desplegable si se hace clic fuera de él
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownListasRef.current && !dropdownListasRef.current.contains(event.target)) {
        setMenuListasAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setPaginaActual(1);
  }, [busquedaInput, filtroEstado, listasSeleccionadas, fechaDesde, fechaHasta, tipoFiltroFecha, pestanaActiva]);

  // Lógica Semáforo Pestaña 1
  const obtenerEstadoVigencia = (fechaLimite) => {
    if (!fechaLimite) return { id: 'SIN_LIMITE', texto: 'Sin Límite', clase: styles.statusSinLimite };
    const hoy = new Date();
    const fechaVence = new Date(fechaLimite);
    const diferenciaDias = Math.ceil((fechaVence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

    if (diferenciaDias < 0) return { id: 'VENCIDO', texto: '🔴 Vencido', clase: styles.statusVencido };
    if (diferenciaDias <= 30) return { id: 'POR_VENCER', texto: `🟡 Por Vencer (${diferenciaDias}d)`, clase: styles.statusPorVencer };
    return { id: 'AL_DIA', texto: '🟢 Al Día', clase: styles.statusVigente };
  };

  // Lógica Precios Cascadas para Super A (Lista 11: Oferta ➔ Lista 1: Normal)
  const calcularPrecioSucursal = (item) => {
    let precioBase = 0;
    let listaUtilizada = 'Lista 1';

    if (item.PrecioL11 > 0) {
      precioBase = item.PrecioL11;
      listaUtilizada = 'Lista 11';
    } else {
      precioBase = item.PrecioL1;
      listaUtilizada = 'Lista 1';
    }

    return {
      base: precioBase,
      final: Math.round((precioBase * (1 - (item.PorDescRec / 100.0))) * 100) / 100,
      lista: listaUtilizada
    };
  };

  const toggleSeleccionLista = (lista) => {
    setListasSeleccionadas(prev =>
      prev.includes(lista)
        ? prev.filter(item => item !== lista)
        : [...prev, lista]
    );
  };

  const seleccionarTodasLasListas = () => setListasSeleccionadas([]);

  const condicionesFiltradas = useMemo(() => {
    let res = [...datosCondiciones];
    const termino = busquedaInput.toLowerCase().trim();

    if (termino) {
      res = res.filter(i =>
        i.IDCondicionComercial?.toString().includes(termino) ||
        i.IDArticuloReal?.toString().includes(termino) ||
        i.Descripcion?.toLowerCase().includes(termino) ||
        i.DescripcionCondicion?.toLowerCase().includes(termino) ||
        i.ScannerReal?.toString().includes(termino)
      );
    }
    if (filtroEstado !== 'TODOS') {
      res = res.filter(i => obtenerEstadoVigencia(i.VigenciaHasta).id === filtroEstado);
    }

    if (listasSeleccionadas.length > 0) {
      res = res.filter(i => {
        const calc = calcularPrecioSucursal(i);
        return listasSeleccionadas.includes(calc.lista);
      });
    }

    if (fechaDesde) res = res.filter(i => i[tipoFiltroFecha] && i[tipoFiltroFecha].substring(0, 10) >= fechaDesde);
    if (fechaHasta) res = res.filter(i => i[tipoFiltroFecha] && i[tipoFiltroFecha].substring(0, 10) <= fechaHasta);

    res.sort((a, b) => new Date(b.FechaModif) - new Date(a.FechaModif));

    return {
      total: res.length,
      paginados: res.slice((paginaActual - 1) * filasPorPagina, paginaActual * filasPorPagina)
    };
  }, [datosCondiciones, busquedaInput, filtroEstado, listasSeleccionadas, fechaDesde, fechaHasta, tipoFiltroFecha, paginaActual]);

  const totalPaginasP1 = Math.ceil(condicionesFiltradas.total / filasPorPagina);

  return (
    <div className={styles.container}>

      {/* --- SELECTOR DE PESTAÑAS --- */}
      <div className={styles.tabsContainer}>
        <button
          onClick={() => setPestanaActiva('CONDICIONES')}
          className={`${styles.tabLink} ${pestanaActiva === 'CONDICIONES' ? styles.tabLinkActive : ''}`}
        >
          Panel Supervisor de Condiciones Comerciales
        </button>
        <button
          onClick={() => setPestanaActiva('CAMBIOS_DIA')}
          className={`${styles.tabLink} ${pestanaActiva === 'CAMBIOS_DIA' ? styles.tabLinkActive : ''}`}
        >
          Cambios de Precios del Día
        </button>

        <button
          onClick={() => setPestanaActiva('COLECTOR')}
          className={`${styles.tabLink} ${pestanaActiva === 'COLECTOR' ? styles.tabLinkActive : ''}`}
        >
          Colector de Precios
        </button>

        <button
          onClick={() => setPestanaActiva('CENEFAS')}
          className={`${styles.tabLink} ${pestanaActiva === 'CENEFAS' ? styles.tabLinkActive : ''}`}
        >
          Colector de Cenefas
        </button>

        <button
          onClick={() => setPestanaActiva('OFERTAS')}
          className={`${styles.tabLink} ${pestanaActiva === 'OFERTAS' ? styles.tabLinkActive : ''}`}
        >
          Ofertas Comparativas
        </button>
      </div>

      {/* --- CONTENIDO DE PESTAÑA 1 --- */}
      {pestanaActiva === 'CONDICIONES' && (
        <>
          <div className={styles.filterPanel}>
            <div className={styles.filterGroup} ref={dropdownListasRef} style={{ position: 'relative' }}>
              <label className={styles.filterLabel}>📋 Listas de Precios:</label>
              <button
                type="button"
                className={styles.selectDropdown}
                style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => setMenuListasAbierto(prev => !prev)}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {listasSeleccionadas.length === 0
                    ? 'Lista 1 y Lista 11'
                    : listasSeleccionadas.length === 1
                      ? listasSeleccionadas[0]
                      : `${listasSeleccionadas.length} listas sel.`}
                </span>
                <span style={{ fontSize: '0.7rem', marginLeft: '5px' }}>{menuListasAbierto ? '▲' : '▼'}</span>
              </button>

              {menuListasAbierto && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  zIndex: 50,
                  padding: '8px',
                  marginTop: '4px'
                }}>
                  <div
                    onClick={seleccionarTodasLasListas}
                    style={{
                      padding: '4px 6px',
                      cursor: 'pointer',
                      fontWeight: listasSeleccionadas.length === 0 ? 'bold' : 'normal',
                      backgroundColor: listasSeleccionadas.length === 0 ? '#f1f5f9' : 'transparent',
                      borderRadius: '4px',
                      fontSize: '0.85rem'
                    }}
                  >
                    <input type="checkbox" checked={listasSeleccionadas.length === 0} readOnly style={{ marginRight: '8px' }} />
                    Todas (1 y 11)
                  </div>
                  <hr style={{ margin: '6px 0', borderColor: '#e2e8f0' }} />
                  {opcionesListas.map(lista => (
                    <div
                      key={lista}
                      onClick={() => toggleSeleccionLista(lista)}
                      style={{
                        padding: '4px 6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.85rem'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={listasSeleccionadas.includes(lista)}
                        readOnly
                        style={{ marginRight: '8px' }}
                      />
                      {lista}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>🔍 Buscar Artículo:</label>
              <input type="text" placeholder="ID Condición, ID Artículo..." className={styles.searchInput} value={busquedaInput} onChange={(e) => setBusquedaInput(e.target.value)} />
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>🚦 Filtra por Estados:</label>
              <select className={styles.selectDropdown} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="TODOS">Todos los Estados</option>
                <option value="AL_DIA">🟢 Al Día</option>
                <option value="POR_VENCER">🟡 Por Vencer (≤30d)</option>
                <option value="VENCIDO">🔴 Vencidos</option>
                <option value="SIN_LIMITE">⚪ Sin Límite</option>
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Fechas por:</label>
              <select className={styles.selectDropdown} value={tipoFiltroFecha} onChange={(e) => setTipoFiltroFecha(e.target.value)}>
                <option value="FechaModif">Modificación</option>
                <option value="VigenciaHasta">Vencimiento</option>
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Desde:</label>
              <input type="date" className={styles.dateInput} value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            </div>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Hasta:</label>
              <input type="date" className={styles.dateInput} value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead className={styles.thead}>
                <tr>
                  <th className={styles.th}>Código</th>
                  <th className={styles.th}>Scanner (PLU)</th>
                  <th className={styles.th}>Descripción</th>
                  <th className={styles.th} style={{textAlign: 'center'}}>Mínimo</th>
                  <th className={styles.th}>Desc.</th>
                  <th className={styles.th}>Precio Base</th>
                  <th className={styles.th}>Precio Final</th>
                  <th className={styles.th}>Modificado</th>
                  <th className={styles.th}>Vence Hasta</th>
                  <th className={styles.th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {condicionesFiltradas.paginados.map((item, idx) => {
                  const estado = obtenerEstadoVigencia(item.VigenciaHasta);
                  const calc = calcularPrecioSucursal(item);
                  return (
                    <tr key={idx} className={styles.tr} onClick={() => setModalData({ type: 'CONDICION', data: item, calc })}>
                      <td className={styles.td}>{item.IDCondicionComercial}</td>
                      <td className={styles.td} style={{fontFamily: 'monospace'}}>{item.ScannerReal || '—'}</td>
                      <td className={`${styles.td} ${styles.tdBold}`}>{item.Descripcion || item.DescripcionCondicion}</td>
                      <td className={styles.td} style={{textAlign: 'center'}}>{item.Desde} un.</td>
                      <td className={styles.td} style={{color: '#d97706', fontWeight: 'bold'}}>{item.PorDescRec}%</td>
                      <td className={styles.td} style={{fontSize: '0.85rem'}}>
                        ${calc.base.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                        <span style={{display: 'block', fontSize: '0.7rem', color: '#C41E3A', fontWeight: 'bold'}}>{calc.lista}</span>
                      </td>
                      <td className={styles.td} style={{color: '#C41E3A', fontWeight: '700'}}>${calc.final.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                      <td className={styles.td}>{item.FechaModif && new Date(item.FechaModif).toLocaleDateString('es-AR')}</td>
                      <td className={styles.td}>{item.VigenciaHasta && new Date(item.VigenciaHasta).toLocaleDateString('es-AR')}</td>
                      <td className={styles.td}><span className={estado.clase}>{estado.texto}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPaginasP1 > 1 && (
            <div className={styles.paginationContainer}>
              <button disabled={paginaActual === 1} onClick={() => setPaginaActual(p => p - 1)} className={styles.pageButton}>◀ Anterior</button>
              <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: '600' }}>
                Página {paginaActual} de {totalPaginasP1} ({condicionesFiltradas.total} registros)
              </span>
              <button disabled={paginaActual === totalPaginasP1} onClick={() => setPaginaActual(p => p + 1)} className={styles.pageButton}>Siguiente ▶</button>
            </div>
          )}
        </>
      )}

      {/* --- CONTENIDO DE PESTAÑA 2 --- */}
      {pestanaActiva === 'CAMBIOS_DIA' && (
        <CambiosPrecios
          datosPrecios={datosPrecios}
          datosCondiciones={datosCondiciones}
          cargando={cargando}
          error={error}
          onOpenModal={setModalData}
        />
      )}

      {/* --- CONTENIDO DE PESTAÑA 3: COLECTOR --- */}
      {pestanaActiva === 'COLECTOR' && (
        <ColectarPrecios apiBase={API_URL} />
      )}

      {/* --- CONTENIDO DE PESTAÑA 4: CENEFAS --- */}
      {pestanaActiva === 'CENEFAS' && (
        <ColectarCenefas />
      )}

      {/* --- CONTENIDO DE PESTAÑA 5: OFERTAS COMPARATIVAS --- */}
      {pestanaActiva === 'OFERTAS' && (
        <OfertasComparativa />
      )}

      {/* --- MODAL COMPARTIDO Y DINÁMICO --- */}
      {modalData && (
        <div className={styles.modalOverlay} onClick={() => setModalData(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{modalData.type === 'CONDICION' ? 'Ficha Condición - Super A' : 'Auditoría de Cambio de Precio'}</h2>
              <button className={styles.closeButton} onClick={() => setModalData(null)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalBlockFull}>
                <div className={styles.modalBlockLabel}>Artículo Comercial</div>
                <div className={styles.modalBlockValue}>
                  {modalData.data.Descripcion || modalData.data.DescripcionCondicion}
                  <span className={styles.badgePlu}>
                    ID Art: {modalData.data.IDArticuloReal || modalData.data.IDArticulo || modalData.data.IDCondicionComercial || '—'} |
                    Ref Scanner: {modalData.data.ScannerReal || modalData.data.Scanner || modalData.data.PLU || '—'}
                  </span>
                </div>
              </div>

              {modalData.type === 'CONDICION' ? (
                <div className={styles.modalGrid}>
                  <div className={styles.modalBlock}><div className={styles.modalBlockLabel}>Lista Base</div><div className={styles.modalBlockValue}>{modalData.calc.lista}</div></div>
                  <div className={styles.modalBlock}><div className={styles.modalBlockLabel}>Precio Lista</div><div className={styles.modalBlockValue}>${modalData.calc.base}</div></div>
                  <div className={styles.modalBlock}><div className={styles.modalBlockLabel}>Descuento</div><div className={styles.modalBlockValue} style={{color: '#dc2626'}}>{modalData.data.PorDescRec}%</div></div>
                  <div className={styles.modalBlock}><div className={styles.modalBlockLabel}>Precio Final</div><div className={styles.modalPrecioDestacado}>${modalData.calc.final}</div></div>
                </div>
              ) : (
                <div className={styles.modalGrid}>
                  <div className={styles.modalBlock}><div className={styles.modalBlockLabel}>Familia / Depto</div><div className={styles.modalBlockValue} style={{fontSize:'0.85rem'}}>{modalData.data.Familia} / {modalData.data.Departamento}</div></div>
                  <div className={styles.modalBlock}><div className={styles.modalBlockLabel}>N° Lista </div><div className={styles.modalBlockValue}>Lista {modalData.data.Lista}</div></div>
                  <div className={styles.modalBlock}><div className={styles.modalBlockLabel}>Hora del Cambio</div><div className={styles.modalBlockValue}>{new Date(modalData.data.FechaPrecio).toLocaleTimeString('es-AR')} hs</div></div>
                  <div className={styles.modalBlock}><div className={styles.modalBlockLabel}>Precio Venta Final</div><div className={styles.modalPrecioDestacado} style={{color: '#16a34a'}}>${modalData.data.PrecioVentaTotal}</div></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- NOTIFICACIONES --- */}
      <NotificationComponent />

    </div>
  );
}

export default Condiciones;