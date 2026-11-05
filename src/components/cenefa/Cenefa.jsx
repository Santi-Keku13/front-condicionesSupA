import React from 'react';
import './Cenefa.css';

function Cenefa({ tipo = 1, datos = {}, mostrarAntes = true }) {
  const tipoNum = Number(tipo);

  const {
    descripcion = 'DESCRIPCIÓN DEL PRODUCTO',
    precioAntes = '',
    precioAhora = '0',
    codigo = '',
    ean = '',
    // 🌟 Campos para Condición Comercial (Tipo 5)
    precioRegular = '',
    precioCondicion = '',
    cantMinima = '2',
  } = datos;

  // 🎯 TIPO 5: Condición Comercial (Totalmente limpia, sin fondo de líneas rojas ni cartel de OFERTA)
  if (tipoNum === 5) {
    return (
      <div className="cenefa cenefa-tipo-5">
        <div className="cenefa-caja-condicion">
          {/* Descripción arriba en grande */}
          <div className="cenefa-condicion-descripcion">{descripcion}</div>

          {/* Cuerpo principal con los bloques de precios */}
          <div className="cenefa-condicion-cuerpo">
            {/* Esquina Izquierda: Precio unitario regular */}
            <div className="cenefa-condicion-izquierda">
              <span className="cenefa-label-regular">P. UNITARIO REGULAR</span>
              <span className="cenefa-precio-regular">${precioRegular || precioAhora}</span>
            </div>

            {/* Esquina Derecha: Leyenda + Precio gigante por cantidad */}
            <div className="cenefa-condicion-derecha">
              <span className="cenefa-leyenda-condicion">
                LLEVANDO <strong>{cantMinima}</strong> UNIDADES O MÁS A TAN SOLO
              </span>
              <span className="cenefa-precio-condicion">
                ${precioCondicion || precioAhora}
              </span>
            </div>
          </div>

          {/* Códigos al pie */}
          <div className="cenefa-codigos-t5">
            <span><strong>Cod.</strong> {codigo}</span>
            <span><strong>EAN:</strong> {ean}</span>
          </div>
        </div>
      </div>
    );
  }

  // 🎯 TIPO 4: 180x65mm Sin precio antes (Precio Gigante Centrado)
  if (tipoNum === 4) {
    return (
      <div className="cenefa cenefa-tipo-4">
        <div className="cenefa-fondo" />
        <div className="cenefa-caja">
          <div className="cenefa-descripcion">{descripcion}</div>

          <div className="cenefa-codigos-t4">
            <span><strong>Cod.</strong> {codigo}</span>
            <span><strong>EAN:</strong> {ean}</span>
          </div>

          <div className="cenefa-precio-centrado">
            <span className="cenefa-ahora-gigante">
              ${precioAhora}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 🎯 TIPO 2: Layout compacto
  if (tipoNum === 2) {
    return (
      <div className="cenefa cenefa-tipo-2">
        <div className="cenefa-fondo" />
        <div className="cenefa-caja-t2">
          <div className="cenefa-t2-top">
            <div className="cenefa-descripcion-t2">{descripcion}</div>
            <div className="cenefa-precios-t2">
              {mostrarAntes && precioAntes && (
                <span className="cenefa-antes-t2">
                  <s>${precioAntes}</s>
                </span>
              )}
              <span className="cenefa-ahora-t2">
                <strong>${precioAhora}</strong>
              </span>
            </div>
          </div>
          <div className="cenefa-codigos-t2">
            <span><strong>Cod.</strong> {codigo}</span>
            <span><strong>EAN:</strong> {ean}</span>
          </div>
        </div>
        <div className="cenefa-oferta-t2">
          <span>OFERTA</span>
        </div>
      </div>
    );
  }

  // 🎯 TIPOS 1 Y 3 (Estándar con franjas rojas y badge OFERTA)
  return (
    <div className={`cenefa cenefa-tipo-${tipoNum}`}>
      <div className="cenefa-fondo" />
      <div className="cenefa-caja">
        <div className="cenefa-descripcion">{descripcion}</div>
        <div className="cenefa-precios">
          {mostrarAntes && precioAntes && (
            <span className="cenefa-antes">
              <s>${precioAntes}</s> /
            </span>
          )}
          <span className="cenefa-ahora">
            <strong>${precioAhora}</strong>
          </span>
        </div>
        <div className="cenefa-codigos">
          <span><strong>Cod.</strong> {codigo}</span>
          <span><strong>EAN:</strong> {ean}</span>
        </div>
      </div>
      <div className="cenefa-oferta">
        <span>OFERTA</span>
      </div>
    </div>
  );
}

export default Cenefa;