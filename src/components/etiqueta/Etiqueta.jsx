import React from 'react';
import './Etiqueta.css';

// 🌟 La fecha de la etiqueta SIEMPRE es la fecha de impresión
const fechaImpresion = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(
    d.getMonth() + 1
  ).padStart(2, '0')}/${d.getFullYear()}`;
};

function Etiqueta({ tipo = 'NORMAL', datos = {} }) {
  const {
    descripcion = 'DESCRIPCIÓN DEL PRODUCTO',
    codigoInterno = '00000',
    codigoBarras = '0000000000000',
    precioUnitario = '0.00',
    precioSinImpuesto = '0.00',
    precioCantidad = '',
    compraMinima = '',
    CantUni = 1
  } = datos;

  // 🌟 Siempre la fecha del día (ignora cualquier 'fecha' que llegue en datos)
  const fecha = fechaImpresion();

  // ============================
  // FORMATO PACK
  // ============================
  if (tipo === 'PACK') {
    return (
      <div className="etiqueta-container formato-pack">
        <div className="header">{descripcion}</div>

        <div className="top-row">
          <span>{fecha}</span>
          <span>Scanner: {codigoBarras}</span>
        </div>

        <div className="sub-header-ci">
          <span>CI: {codigoInterno}</span>
        </div>

        <div className="bottom-row">
          <div className="box-pack">
            <span className="referencia">REFERENCIA:</span>
            <span className="texto-pack">PACK X {CantUni}</span>
          </div>

          <div className="box-precio">
            <span className="precio-titulo">Precio Venta</span>
            <div className="precio-container">
              <span className="simbolo-peso">$</span>
              <span className="precio-grande">{precioUnitario}</span>
            </div>

            <div className="precio-sin-iva-pack">
              <span className="label-sin-iva">Precio S/Imp/Nac</span>
              <span className="valor-sin-iva">${precioSinImpuesto}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================
  // FORMATO CONDICION
  // ============================
  if (tipo === 'CONDICION') {
    return (
      <div className="etiqueta-container formato-normal formato-condicion">
        <div className="header">{descripcion}</div>

        <div className="sub-header">
          <span>{fecha}</span>
          <span>CI: {codigoInterno}</span>
          <span>{codigoBarras}</span>
        </div>

        <div className="body-content">
          <div className="col-izq">
            <span className="titulo-seccion">PRECIO X VOLUMEN</span>

            <div className="precio-container">
              <span className="simbolo-peso">$</span>
              <span className="precio-grande">{precioCantidad || ' '}</span>
            </div>

            <span className="pie-texto">
              {compraMinima ? `COMPRA MINIMA: ${compraMinima}` : ''}
            </span>
          </div>

          <div className="col-der">
            <span className="titulo-seccion">PRECIO UNITARIO</span>

            <div className="precio-container">
              <span className="simbolo-peso">$</span>
              <span className="precio-grande">{precioUnitario}</span>
            </div>

            <div className="pie-derecho">
              <span>Precio S/Imp/Nac</span>
              <span>${precioSinImpuesto}</span>
            </div>
          </div>
        </div>

        {CantUni > 1 && (
          <div className="badge-pack-condicion">
            PACK X {CantUni}
          </div>
        )}
      </div>
    );
  }

  // ============================
  // FORMATO NORMAL (default)
  // ============================
  return (
    <div className="etiqueta-container formato-normal">
      <div className="header">{descripcion}</div>

      <div className="sub-header">
        <span>{fecha}</span>
        <span>CI: {codigoInterno}</span>
        <span>{codigoBarras}</span>
      </div>

      <div className="body-content">
        <div className="col-izq">
          <span className="titulo-seccion">PRECIO X VOLUMEN</span>

          <div className="precio-container">
            <span className="simbolo-peso">$</span>
            <span className="precio-grande">{precioCantidad || ' '}</span>
          </div>

          <span className="pie-texto">
            {compraMinima ? `COMPRA MINIMA: ${compraMinima}` : ''}
          </span>
        </div>

        <div className="col-der">
          <span className="titulo-seccion">PRECIO UNITARIO</span>

          <div className="precio-container">
            <span className="simbolo-peso">$</span>
            <span className="precio-grande">{precioUnitario}</span>
          </div>

          <div className="pie-derecho">
            <span>Precio S/Imp/Nac</span>
            <span>${precioSinImpuesto}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Etiqueta;