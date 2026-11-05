import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from '../condiciones/Condiciones.module.css';
import * as XLSX from 'xlsx';
import Etiqueta from '../etiqueta/Etiqueta';

// 🎯 ORDEN DE PRIORIDAD DE LISTAS PARA SUPER A (11: Oferta, 1: Normal)
const PRIORIDADES_SUPER_A = [11, 1];

function CambiosPrecios({ 
  datosPrecios = [], 
  datosCondiciones = [], 
  cargando, 
  error, 
  onOpenModal 
}) {
  const [busquedaPrecios, setBusquedaPrecios] = useState('');
  const [fechaFiltroPrecio, setFechaFiltroPrecio] = useState(new Date().toISOString().substring(0, 10));
  
  // --- ESTADO PARA MULTISELECCIÓN DE LISTAS ---
  const [listasSeleccionadas, setListasSeleccionadas] = useState([]);
  const [mostrarDropdownListas, setMostrarDropdownListas] = useState(false);
  const dropdownRef = useRef(null);

  // --- ESTADOS PARA OTROS FILTROS ---
  const [filtroDepto, setFiltroDepto] = useState('TODOS');
  const [filtroFamilia, setFiltroFamilia] = useState('TODOS');
  const [filtroSubFamilia, setFiltroSubFamilia] = useState('TODOS');

  const [paginaActual, setPaginaActual] = useState(1);
  const filasPorPagina = 50;

  useEffect(() => {
    setPaginaActual(1);
  }, [busquedaPrecios, fechaFiltroPrecio, listasSeleccionadas, filtroDepto, filtroFamilia, filtroSubFamilia]);

  // Cierra el menú desplegable si se hace clic fuera de él
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMostrarDropdownListas(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 🔍 MAPA DE BÚSQUEDA RÁPIDA DE CONDICIONES
  const mapaCondiciones = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(datosCondiciones)) return map;

    datosCondiciones.forEach(cond => {
      if (cond.IDArticuloReal !== undefined && cond.IDArticuloReal !== null) {
        map.set(String(cond.IDArticuloReal).trim(), cond);
      }
    });

    return map;
  }, [datosCondiciones]);

  // --- EXTRACCIÓN DE OPCIONES PARA DROPDOWNS (SOLO LISTA 1 Y 11) ---
  const opcionesFiltros = useMemo(() => {
    const deptos = new Set();
    const familias = new Set();
    const subFamilias = new Set();

    datosPrecios.forEach(item => {
      const lNum = Number(String(item.Lista).replace(/\D/g, ''));
      if (lNum === 1 || lNum === 11) {
        if (item.Departamento) deptos.add(item.Departamento);
        if (item.Familia) familias.add(item.Familia);
        if (item.SubFamilia) subFamilias.add(item.SubFamilia);
      }
    });

    return {
      listas: [1, 11],
      deptos: Array.from(deptos).sort(),
      familias: Array.from(familias).sort(),
      subFamilias: Array.from(subFamilias).sort()
    };
  }, [datosPrecios]);

  const handleToggleLista = (listaValue) => {
    const strValue = listaValue.toString();
    setListasSeleccionadas(prev => 
      prev.includes(strValue) 
        ? prev.filter(l => l !== strValue) 
        : [...prev, strValue]
    );
  };

  const handleSeleccionarTodasListas = () => {
    setListasSeleccionadas([]);
  };

  const obtenerNombreLista = (listaVal) => {
    const num = Number(String(listaVal).replace(/\D/g, ''));
    if (num === 11) return 'Lista 11 (Oferta)';
    if (num === 1) return 'Lista 1 (Normal)';
    return `Lista ${listaVal}`;
  };

  // --- FILTRADO DE TABLA PARA SUPER A ---
  const datosFiltradosYPagina = useMemo(() => {
    let res = datosPrecios.filter(i => {
      const num = Number(String(i.Lista).replace(/\D/g, ''));
      return num === 1 || num === 11;
    });

    const termino = busquedaPrecios.toLowerCase().trim();

    if (fechaFiltroPrecio) {
      res = res.filter(i => i.FechaPrecio && i.FechaPrecio.substring(0, 10) === fechaFiltroPrecio);
    }

    if (listasSeleccionadas.length > 0) {
      res = res.filter(i => {
        const numStr = String(Number(String(i.Lista).replace(/\D/g, '')));
        return listasSeleccionadas.includes(numStr);
      });
    }

    if (filtroDepto !== 'TODOS') {
      res = res.filter(i => i.Departamento === filtroDepto);
    }
    if (filtroFamilia !== 'TODOS') {
      res = res.filter(i => i.Familia === filtroFamilia);
    }
    if (filtroSubFamilia !== 'TODOS') {
      res = res.filter(i => i.SubFamilia === filtroSubFamilia);
    }

    if (termino) {
      res = res.filter(i => 
        i.IDArticulo?.toString().includes(termino) || 
        i.Descripcion?.toLowerCase().includes(termino) || 
        i.Scanner?.toString().includes(termino)
      );
    }

    // DEDUPLICACIÓN POR PRODUCTO SEGÚN PRIORIDAD (11 > 1)
    const productosAgrupados = new Map();

    res.forEach(item => {
      const idArticulo = String(item.IDArticulo).trim();
      const listaActual = Number(String(item.Lista).replace(/\D/g, ''));

      if (!productosAgrupados.has(idArticulo)) {
        productosAgrupados.set(idArticulo, item);
      } else {
        const itemExistente = productosAgrupados.get(idArticulo);
        const listaExistente = Number(String(itemExistente.Lista).replace(/\D/g, ''));

        const prioridadActual = PRIORIDADES_SUPER_A.indexOf(listaActual);
        const prioridadExistente = PRIORIDADES_SUPER_A.indexOf(listaExistente);

        if (prioridadActual !== -1) {
          if (prioridadExistente === -1 || prioridadActual < prioridadExistente) {
            productosAgrupados.set(idArticulo, item);
          }
        }
      }
    });

    const resDeduplicado = Array.from(productosAgrupados.values());

    const total = resDeduplicado.length;
    const paginados = resDeduplicado.slice((paginaActual - 1) * filasPorPagina, paginaActual * filasPorPagina);
    
    return { total, paginados, todosFiltrados: resDeduplicado };
  }, [
    datosPrecios, 
    busquedaPrecios, 
    fechaFiltroPrecio, 
    listasSeleccionadas, 
    filtroDepto, 
    filtroFamilia, 
    filtroSubFamilia, 
    paginaActual
  ]);

  const totalPaginas = Math.ceil(datosFiltradosYPagina.total / filasPorPagina);

  const formatearFecha = (strFecha) => {
    if (!strFecha) return '—';
    return new Date(strFecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const exportarAExcel = () => {
    if (datosFiltradosYPagina.todosFiltrados.length === 0) return;

    const datosAExportar = datosFiltradosYPagina.todosFiltrados.map(item => ({
      'Código Art.': item.IDArticulo || '—',
      'Scanner / PLU': item.Scanner || '—',
      'Descripción': item.Descripcion || '—',
      'Familia': item.Familia || '—',
      'SubFamilia': item.SubFamilia || '—',
      'Departamento': item.Departamento || '—',
      'Lista ID': obtenerNombreLista(item.Lista),
      'Precio Venta Total ($)': item.PrecioVentaTotal || 0,
      'Hora Cambio': item.FechaPrecio ? new Date(item.FechaPrecio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—',
      'Fecha Aplicación': item.FechaPrecio ? item.FechaPrecio.substring(0, 10) : '—'
    }));

    const worksheet = XLSX.utils.json_to_sheet(datosAExportar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cambios de Precios");

    const fechaNombre = fechaFiltroPrecio || new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Cambios_de_Precios_Super_A_${fechaNombre}.xlsx`);
  };

  const exportarAPDF = () => {
    window.print();
  };

  if (cargando) return <div className={styles.centerMessage}>Cargando datos...</div>;
  if (error) return <div className={styles.centerMessage} style={{color: 'red'}}>Error: {error}</div>;

  return (
    <>
      {/* --- PANEL DE FILTROS --- */}
      <div className={styles.filterPanel} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        
        <div className={styles.filterGroup} style={{ gridColumn: 'span 2' }}>
          <label className={styles.filterLabel}>🔍 Buscar Modificación:</label>
          <input 
            type="text" 
            placeholder="ID Artículo, descripción o scanner..." 
            className={styles.searchInput} 
            value={busquedaPrecios} 
            onChange={(e) => setBusquedaPrecios(e.target.value)} 
          />
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>📅 Fecha Modif:</label>
          <input 
            type="date" 
            className={styles.dateInput} 
            value={fechaFiltroPrecio} 
            onChange={(e) => setFechaFiltroPrecio(e.target.value)} 
            style={{ borderColor: '#C41E3A', backgroundColor: '#fff5f5' }}
          />
        </div>

        <div className={styles.filterGroup} ref={dropdownRef} style={{ position: 'relative' }}>
          <label className={styles.filterLabel}>📋 Filtrar Listas:</label>
          <button 
            type="button"
            onClick={() => setMostrarDropdownListas(!mostrarDropdownListas)}
            className={styles.selectDropdown}
            style={{ 
              textAlign: 'left', 
              background: '#fff', 
              cursor: 'pointer', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {listasSeleccionadas.length === 0 
                ? 'Lista 1 y Lista 11' 
                : listasSeleccionadas.length === 1 
                  ? obtenerNombreLista(listasSeleccionadas[0]) 
                  : `${listasSeleccionadas.length} listas selec.`}
            </span>
            <small>▼</small>
          </button>

          {mostrarDropdownListas && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              padding: '8px',
              maxHeight: '220px',
              overflowY: 'auto'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontWeight: 'bold' }}>
                <input 
                  type="checkbox" 
                  checked={listasSeleccionadas.length === 0} 
                  onChange={handleSeleccionarTodasListas}
                />
                Todas (1 y 11)
              </label>

              {opcionesFiltros.listas.map((l, idx) => {
                const strL = l.toString();
                const isChecked = listasSeleccionadas.includes(strL);
                return (
                  <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={isChecked} 
                      onChange={() => handleToggleLista(l)}
                    />
                    {obtenerNombreLista(l)}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>🏬 Departamento:</label>
          <select className={styles.selectDropdown} value={filtroDepto} onChange={(e) => setFiltroDepto(e.target.value)}>
            <option value="TODOS">Todos</option>
            {opcionesFiltros.deptos.map((d, idx) => <option key={idx} value={d}>{d}</option>)}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>🌿 Familia:</label>
          <select className={styles.selectDropdown} value={filtroFamilia} onChange={(e) => setFiltroFamilia(e.target.value)}>
            <option value="TODOS">Todas</option>
            {opcionesFiltros.familias.map((f, idx) => <option key={idx} value={f}>{f}</option>)}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>🌿 SubFamilia:</label>
          <select className={styles.selectDropdown} value={filtroSubFamilia} onChange={(e) => setFiltroSubFamilia(e.target.value)}>
            <option value="TODOS">Todas</option>
            {opcionesFiltros.subFamilias.map((sf, idx) => <option key={idx} value={sf}>{sf}</option>)}
          </select>
        </div>

        <div className={styles.filterGroup} style={{ justifyContent: 'flex-end', flexDirection: 'row', gap: '8px' }}>
          <button 
            onClick={exportarAPDF}
            disabled={datosFiltradosYPagina.total === 0}
            style={{
              backgroundColor: datosFiltradosYPagina.total === 0 ? '#94a3b8' : '#2563eb',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              cursor: datosFiltradosYPagina.total === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              height: '38px',
              transition: 'background-color 0.2s'
            }}
            title="Imprimir Etiquetas dinámicas de Góndola"
          >
              🖨️ Imprimir Etiquetas
          </button>

          <button 
            onClick={exportarAExcel}
            disabled={datosFiltradosYPagina.total === 0}
            style={{
              backgroundColor: datosFiltradosYPagina.total === 0 ? '#94a3b8' : '#16a34a',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              cursor: datosFiltradosYPagina.total === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              height: '38px',
              transition: 'background-color 0.2s'
            }}
          >
              Excel ({datosFiltradosYPagina.total})
          </button>
        </div>

      </div>

      {/* --- TABLA DE AUDITORÍA --- */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.th}>Código Art.</th>
              <th className={styles.th}>Scanner</th>
              <th className={styles.th}>Descripción</th>
              <th className={styles.th}>Familia / SubFamilia</th>
              <th className={styles.th}>Departamento</th>
              <th className={styles.th} style={{ textAlign: 'center' }}>Lista ID</th>
              <th className={styles.th} style={{ textAlign: 'right' }}>Precio Venta Total</th>
              <th className={styles.th}>Fecha Aplicación</th>
            </tr>
          </thead>
          <tbody>
            {datosFiltradosYPagina.paginados.map((item, idx) => {
              const numLista = Number(String(item.Lista).replace(/\D/g, ''));
              const esOferta = numLista === 11;

              return (
                <tr key={idx} className={styles.tr} onClick={() => onOpenModal({ type: 'PRECIO', data: item })}>
                  <td className={styles.td}>{item.IDArticulo}</td>
                  <td className={styles.td} style={{ fontFamily: 'monospace' }}>{item.Scanner || '—'}</td>
                  <td className={`${styles.td} ${styles.tdBold}`}>{item.Descripcion}</td>
                  <td className={styles.td} style={{ fontSize: '0.85rem' }}>
                    {item.Familia} 
                    <span style={{ display: 'block', color: '#64748b', fontSize: '0.75rem' }}>{item.SubFamilia}</span>
                  </td>
                  <td className={styles.td}>{item.Departamento || '—'}</td>
                  <td className={styles.td} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    <span style={{
                      backgroundColor: esOferta ? '#fef2f2' : '#f8fafc',
                      color: esOferta ? '#dc2626' : '#475569',
                      border: `1px solid ${esOferta ? '#fca5a5' : '#cbd5e1'}`,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.8rem'
                    }}>
                      {obtenerNombreLista(item.Lista)}
                    </span>
                  </td>
                  <td className={styles.td} style={{ textAlign: 'right', color: '#16a34a', fontWeight: '700', fontSize: '1rem' }}>
                    ${Number(item.PrecioVentaTotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={styles.td} style={{ fontSize: '0.85rem', color: '#C41E3A', fontWeight: '500' }}>
                    {new Date(item.FechaPrecio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>{formatearFecha(item.FechaPrecio)}</span>
                  </td>
                </tr>
              );
            })}
            {datosFiltradosYPagina.total === 0 && (
              <tr>
                <td colSpan="8" className={styles.td} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  ⚠️ No se encontraron modificaciones con los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- PAGINACIÓN --- */}
      {totalPaginas > 1 && (
        <div className={styles.paginationContainer}>
          <button disabled={paginaActual === 1} onClick={() => setPaginaActual(p => p - 1)} className={styles.pageButton}>◀ Anterior</button>
          <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: '600' }}>
            Página {paginaActual} de {totalPaginas} ({datosFiltradosYPagina.total} registros)
          </span>
          <button disabled={paginaActual === totalPaginas} onClick={() => setPaginaActual(p => p + 1)} className={styles.pageButton}>Siguiente ▶</button>
        </div>
      )}

      {/* ===== CONTENEDOR PORTAL DE ETIQUETAS PARA IMPRESIÓN ===== */}
      {createPortal(
        <div className="seccion-impresion-portal">
          {(() => {
            const LIMITE_POR_HOJA = 12;

            const etiquetasMapeadas = datosFiltradosYPagina.todosFiltrados.map((item) => {
              const precioListaBase = Number(item.PrecioVentaTotal) || 0;
              const esUnidad = Number(item.IDPresentacion) === 1;
              const tipoEtiquetaCalculado = esUnidad ? 'NORMAL' : 'PACK';

              const idBuscar = String(item.IDArticulo).trim();
              const condicionAsociada = mapaCondiciones.get(idBuscar);

              const porcentajeDescuento = Number(condicionAsociada?.PorDescRec) || 0;
              const tieneCondicion = !!condicionAsociada && (porcentajeDescuento > 0 || condicionAsociada.PrecioFinal !== undefined);

              let precioConDescuento = 0;
              if (tieneCondicion) {
                if (condicionAsociada.PrecioFinal !== undefined && condicionAsociada.PrecioFinal !== null) {
                  precioConDescuento = Number(condicionAsociada.PrecioFinal);
                } else {
                  precioConDescuento = precioListaBase * (1 - (porcentajeDescuento / 100));
                }
              }

              const precioSinIvaCalculado = precioListaBase / 1.21;

              return {
                tipo: tipoEtiquetaCalculado,
                datos: {
                  descripcion: item.Descripcion || 'SIN DESCRIPCIÓN',
                  fecha: item.FechaPrecio ? formatearFecha(item.FechaPrecio) : new Date().toLocaleDateString('es-AR'),
                  codigoInterno: item.IDArticulo || '—',
                  codigoBarras: item.Scanner || item.IDArticulo || '—',
                  scanner: item.Scanner || '—',
                  precioUnitario: precioListaBase.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  precioSinImpuesto: precioSinIvaCalculado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  CantUni: item.CantUni || 1,
                  precioCantidad: tieneCondicion 
                    ? precioConDescuento.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                    : '',
                  compraMinima: tieneCondicion ? (condicionAsociada.Desde || '') : ''
                }
              };
            });

            const paginas = [];
            for (let i = 0; i < etiquetasMapeadas.length; i += LIMITE_POR_HOJA) {
              paginas.push(etiquetasMapeadas.slice(i, i + LIMITE_POR_HOJA));
            }

            return paginas.map((pagina, indexHoja) => (
              <div key={indexHoja} className="hoja-a4">
                <div className="grid-etiquetas">
                  {pagina.map((itemEtiqueta, indexItem) => (
                    <Etiqueta 
                      key={indexItem} 
                      tipo={itemEtiqueta.tipo} 
                      datos={itemEtiqueta.datos} 
                    />
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>,
        document.body
      )}
    </>
  );
}

export default CambiosPrecios;