// js/finanzas.js
import { estado } from './estado.js';
import { formatCurrency } from './utilidades.js';

function obtenerFuenteFinanciera(period) {
    return estado.financialData || {};
}

// El centro de la dona tiene un hueco angosto (~108px): un valor largo
// (montos en pesos) necesita una fuente más chica que uno corto (un conteo)
// para no desbordarse del círculo.
function claseTamanoValorDona(texto) {
    const largo = String(texto).length;
    if (largo > 8) return 'grafico-dona-valor--xs';
    if (largo > 5) return 'grafico-dona-valor--sm';
    return '';
}

// Contenido del círculo "barra-avatar": la foto del empleado si tiene una
// guardada, o sus iniciales como antes.
function avatarBarraHtml(nombre, avatarUrl) {
    if (avatarUrl) {
        return `<img src="${avatarUrl}" alt="${nombre}" class="barra-avatar-img">`;
    }
    return (nombre || '').charAt(0).toUpperCase();
}


/**
 * Función principal que renderiza TODOS los componentes de la pestaña.
 */
export function renderFinancialData(period) {
    // 1. Renderizar KPIs principales (Tarjetas)
    renderizarKpisPrincipales(period);
    // 2. Renderizar NUEVA fila de Métricas Clave
    renderizarMetricasClave(period);

    // 3. Renderizar gráficos que dependen del filtro
    renderizarGraficoServiciosEmpleado(period);
    renderizarGraficoServiciosPorEmpleado(period);
    renderizarGraficoTurnosPorHora_Barras(period);
    renderizarHoraPico(period);
    renderizarGraficoFidelidad(period);
    renderizarGraficoIngresosPorEmpleadoDona(period);

    renderizarGraficoServiciosPopulares(period);
}

/**
 * Reescribe icono + label del encabezado de una tarjeta financiera.
 */
function setEncabezadoFinanciero(idTarjeta, icono, label) {
    const tarjeta = document.getElementById(idTarjeta);
    if (!tarjeta) return;
    const i = tarjeta.querySelector('.encabezado-financiero i');
    const span = tarjeta.querySelector('.encabezado-financiero span');
    if (i) i.className = icono;
    if (span) span.textContent = label;
}

/**
 * Puebla las 3 tarjetas superiores (Dark Mode) con indicadores basados en turnos.
 */
function renderizarKpisPrincipales(period) {
    const fuente = obtenerFuenteFinanciera(period);
    const kpiData = fuente.kpis?.[period] || {
        turnosRegistrados: 0,
        turnosReservados: 0,
        turnosCompletados: 0,
        turnosCancelados: 0,
        servicioMasSolicitado: null,
        horaPico: null,
    };

    setEncabezadoFinanciero('tarjeta-kpi-1', 'fas fa-calendar-check', 'Turnos Totales');
    document.getElementById('kpi-total-revenue').textContent = String(kpiData.turnosRegistrados ?? 0);
    document.getElementById('kpi-revenue-change').innerHTML = `<span>Reservados: ${kpiData.turnosReservados ?? 0}</span>`;

    setEncabezadoFinanciero('tarjeta-kpi-2', 'fas fa-calendar-check', 'Turnos Completados');
    document.getElementById('kpi-total-appts').textContent = Number(kpiData.turnosCompletados ?? 0);
    document.getElementById('kpi-avg-revenue-appt').textContent = `Cancelados: ${Number(kpiData.turnosCancelados ?? 0)}`;

    setEncabezadoFinanciero('tarjeta-kpi-3', 'fas fa-clock', 'Hora Pico');
    document.getElementById('kpi-occupancy-rate').textContent = kpiData.horaPico || '--:--';
    document.getElementById('kpi-total-hours').textContent = kpiData.servicioMasSolicitado
        ? `Más solicitado: ${kpiData.servicioMasSolicitado}`
        : 'Sin datos de servicios';
}

/**
 * Puebla la fila de 4 tarjetas de métricas, basadas en datos de turnos.
 */
function renderizarMetricasClave(period) {
    const fuente = obtenerFuenteFinanciera(period);
    const kpiData = fuente.kpis?.[period] || {};
    const turnosCompletados = Number(kpiData.turnosCompletados ?? 0);
    const turnosCancelados = Number(kpiData.turnosCancelados ?? 0);
    const tasaCancelacionTurnos = Number(kpiData.tasaCancelacionTurnos ?? 0);
    const tasaOcupacion = Number(kpiData.tasaOcupacion ?? 0);

    document.getElementById('metric-turnos-completados').textContent = turnosCompletados;
    document.getElementById('metric-ocupacion-kpi').textContent = `${tasaOcupacion.toFixed(1)}%`;
    document.getElementById('metric-cancelacion-kpi').textContent = `${tasaCancelacionTurnos.toFixed(1)}%`;
    document.getElementById('metric-turnos-cancelados').textContent = turnosCancelados;
}

/**
 * Puebla el badge de "Hora Pico" en la tarjeta de Turnos por Hora.
 */
function renderizarHoraPico(period) {
    const badge = document.getElementById('hora-pico-badge');
    if (!badge) return;
    const fuente = obtenerFuenteFinanciera(period);
    const kpiData = fuente.kpis?.[period] || {};
    badge.textContent = kpiData.horaPico ? `Pico: ${kpiData.horaPico}` : 'Pico: --:--';
}

/**
 * Renderiza el gráfico de barras de "Ocupación por Empleado" (se calcula
 * solo con datos de turnos/horarios).
 */
function renderizarGraficoServiciosEmpleado(period) {
    const container = document.getElementById('grafico-servicios-empleado');
    if (!container) return;

    const fuente = obtenerFuenteFinanciera(period);

    const encabezado = document.getElementById('tarjeta-grafico-empleado-1');
    if (encabezado) encabezado.innerHTML = '<i class="fas fa-chart-pie"></i><h4>Ocupación por Empleado</h4>';

    const empleadosData = fuente.ocupacionPorEmpleado?.[period] || [];
    if (empleadosData.length === 0) {
        container.innerHTML = '<p class="sin-horarios">Sin datos para este período.</p>';
        return;
    }

    container.innerHTML = empleadosData.map((empleado, index) => {
        const porcentaje = Number(empleado.cantidad ?? 0);
        const rankClass = index < 3 ? `top-${index + 1}` : '';

        return `
          <div class="barra-item">
            <div class="barra-avatar">
              ${avatarBarraHtml(empleado.nombre, empleado.avatar_url)}
              <span class="barra-ranking ${rankClass}">${index + 1}</span>
            </div>
            <div class="barra-info">
              <div class="barra-top-row">
                <span class="barra-etiqueta">${empleado.nombre}</span>
                <span class="barra-valor">${porcentaje}%</span>
              </div>
              <div class="barra-track">
                <div class="barra" style="width: ${Math.min(porcentaje, 100)}%"></div>
              </div>
            </div>
          </div>
        `;
    }).join('');
}

/**
 * Renderiza el gráfico de barras de Servicios por Empleado (cantidad de turnos completados).
 */
function renderizarGraficoServiciosPorEmpleado(period) {
    const container = document.getElementById('grafico-servicios-por-empleado');
    if (!container) return;

    const fuente = obtenerFuenteFinanciera(period);
    const empleadosData = fuente.cantidadServiciosPorEmpleado?.[period] || [];
    if (empleadosData.length === 0) {
        container.innerHTML = '<p class="sin-horarios">Sin datos para este período.</p>';
        return;
    }
    const maxCantidad = Math.max(...empleadosData.map(e => Number(e.cantidad ?? 0)));

    container.innerHTML = empleadosData.map((empleado, index) => {
        const cantidad = Number(empleado.cantidad ?? 0);
        const porcentaje = maxCantidad > 0 ? (cantidad / maxCantidad) * 100 : 0;
        const rankClass = index < 3 ? `top-${index + 1}` : '';

        return `
          <div class="barra-item">
            <div class="barra-avatar">
              ${avatarBarraHtml(empleado.nombre, empleado.avatar_url)}
              <span class="barra-ranking ${rankClass}">${index + 1}</span>
            </div>
            <div class="barra-info">
              <div class="barra-top-row">
                <span class="barra-etiqueta">${empleado.nombre}</span>
                <span class="barra-valor">${cantidad} servicios</span>
              </div>
              <div class="barra-track">
                <div class="barra" style="width: ${porcentaje}%"></div>
              </div>
            </div>
          </div>
        `;
    }).join('');
}

/**
 * Renderiza el gráfico de BARRAS de Turnos por Hora. Son franjas horarias
 * discretas (no una serie continua), así que una barra por franja comunica
 * la magnitud mejor que una línea: cada punto se lee de forma independiente,
 * sin sugerir una tendencia/interpolación entre horarios que no existe.
 */
function renderizarGraficoTurnosPorHora_Barras(period) {
    const container = document.getElementById('grafico-turnos-hora-contenedor');
    if (!container) return;

    const fuente = obtenerFuenteFinanciera(period);
    const horasData = fuente.turnosPorHora?.[period] || [];
    if (horasData.length === 0) {
        container.innerHTML = '<p class="sin-horarios">Sin datos para este período.</p>';
        return;
    }
    const maxCount = Math.max(...horasData.map(h => Number(h.cantidad) || 0), 1);

    const svgWidth = 300; // Ancho fijo del SVG
    const svgHeight = 300; // Alto fijo del SVG
    const paddingX = 20;
    const paddingTop = 20;
    const paddingBottom = 42; // espacio para etiquetas del eje X
    const areaWidth = svgWidth - (paddingX * 2);
    const areaHeight = svgHeight - paddingTop - paddingBottom;
    const baseY = svgHeight - paddingBottom;

    const n = horasData.length;
    const slotWidth = areaWidth / n;
    const barWidth = Math.min(24, slotWidth * 0.55); // tope de 24px, resto queda como aire
    const radioMax = 4; // esquina redondeada arriba, cuadrada en la base

    // Mostrar menos etiquetas cuando hay muchas franjas para evitar solapamientos
    const maxEtiquetas = 8;
    const saltoEtiquetas = Math.max(1, Math.ceil(n / maxEtiquetas));

    let svg = `<svg class="grafico-barras-svg" viewBox="0 0 ${svgWidth} ${svgHeight}">`;

    horasData.forEach((data, index) => {
        const cantidad = Number(data.cantidad) || 0;
        const cx = paddingX + slotWidth * (index + 0.5);
        const x = cx - barWidth / 2;
        const alto = (cantidad / maxCount) * areaHeight;
        const y = baseY - alto;
        const r = Math.min(radioMax, barWidth / 2, alto);

        if (alto > 0) {
            svg += `<path class="barra-svg" d="
                M${x},${baseY}
                L${x},${y + r}
                Q${x},${y} ${x + r},${y}
                L${x + barWidth - r},${y}
                Q${x + barWidth},${y} ${x + barWidth},${y + r}
                L${x + barWidth},${baseY}
                Z"><title>${data.hora} — ${cantidad} turno${cantidad === 1 ? '' : 's'}</title></path>`;
        }

        const esPrimero = index === 0;
        const esUltimo = index === n - 1;
        const mostrarEtiqueta = esPrimero || esUltimo || (index % saltoEtiquetas === 0);
        if (mostrarEtiqueta) {
            svg += `<text class="etiqueta-eje-x" x="${cx}" y="${svgHeight - 12}">${data.hora}</text>`;
        }
    });

    svg += `</svg>`;
    container.innerHTML = svg;
}


/**
 * Renderiza el gráfico de dona para Servicios Populares.
 */
function renderizarGraficoServiciosPopulares(period) {
    const container = document.getElementById('dona-servicios-populares');
    if (!container) return;

    const fuente = obtenerFuenteFinanciera(period);
    const data = fuente.serviciosPopularesDona || [];
    if (data.length === 0) {
        container.innerHTML = '<p class="sin-horarios">Sin datos para este período.</p>';
        return;
    }
    const total = data.reduce((sum, item) => sum + item.cantidad, 0);
    
    const { svg, offsets } = createDonutSVG(data, total, 'servicios');
    
    const leyenda = data.map((item, index) => `
        <div class="item-leyenda">
            <div class="item-leyenda-info">
                <div class="indicador-leyenda" style="background: ${item.color};"></div>
                <span class="item-leyenda-nombre">${item.nombre}</span>
            </div>
            <span class="item-leyenda-valor">${((item.cantidad / total) * 100).toFixed(0)}%</span>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="grafico-dona" id="dona-servicios-svg">
            ${svg}
            <div class="grafico-dona-centro">
                <div class="grafico-dona-valor ${claseTamanoValorDona(total)}">${total}</div>
                <div class="grafico-dona-etiqueta">Servicios</div>
            </div>
        </div>
        <div class="leyenda-dona">
            ${leyenda}
        </div>
    `;

    applyDonutOffsets(offsets, 'servicios');
}

/**
 * Renderiza el gráfico de dona de Métodos de Pago (pagos de turnos).
 */
function renderizarGraficoFidelidad(period) {
    const container = document.getElementById('dona-fidelidad-clientes');
    if (!container) return;
    const fuente = obtenerFuenteFinanciera(period);
    const data = (fuente.metodosPagoDona && fuente.metodosPagoDona.length > 0)
        ? fuente.metodosPagoDona
        : [];
    if (data.length === 0) {
        container.innerHTML = '<p class="sin-horarios">Sin datos para este período.</p>';
        return;
    }
    const total = data.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);

    const { svg, offsets } = createDonutSVG(data, total, 'fidelidad');

    const leyenda = data.map((item) => `
        <div class="item-leyenda">
            <div class="item-leyenda-info">
                <div class="indicador-leyenda" style="background: ${item.color};"></div>
                <span class="item-leyenda-nombre">${item.nombre}</span>
            </div>
            <span class="item-leyenda-valor">${formatCurrency(item.cantidad)}</span>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="grafico-dona" id="dona-fidelidad-svg">
            ${svg}
            <div class="grafico-dona-centro">
                <div class="grafico-dona-valor ${claseTamanoValorDona(formatCurrency(total))}">${formatCurrency(total)}</div>
                <div class="grafico-dona-etiqueta">Métodos de Pago</div>
            </div>
        </div>
        <div class="leyenda-dona">
            ${leyenda}
        </div>
    `;

    applyDonutOffsets(offsets, 'fidelidad');
}

/**
 * Renderiza la dona de participación de Ingresos por Empleado (turnos
 * completados, con su comisión ya calculada en el backend).
 */
function renderizarGraficoIngresosPorEmpleadoDona(period) {
    const container = document.getElementById('dona-ingresos-empleado');
    if (!container) return;

    const fuente = obtenerFuenteFinanciera(period);
    const encabezado = document.getElementById('encabezado-ingresos-empleado-dona');
    if (encabezado) encabezado.innerHTML = '<i class="fas fa-user-tie"></i><h4>Ingresos por Empleado</h4>';

    const data = fuente.ingresosPorEmpleadoDona || [];
    if (data.length === 0) {
        container.innerHTML = '<p class="sin-horarios">Sin datos para este período.</p>';
        return;
    }
    const total = data.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);

    const { svg, offsets } = createDonutSVG(data, total, 'ingresos-empleado');

    const leyenda = data.map((item) => `
        <div class="item-leyenda">
            <div class="item-leyenda-info">
                <div class="indicador-leyenda" style="background: ${item.color};"></div>
                <span class="item-leyenda-nombre">${item.nombre}</span>
            </div>
            <span class="item-leyenda-valor">${formatCurrency(item.cantidad)}</span>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="grafico-dona" id="dona-ingresos-empleado-svg">
            ${svg}
            <div class="grafico-dona-centro">
                <div class="grafico-dona-valor ${claseTamanoValorDona(formatCurrency(total))}">${formatCurrency(total)}</div>
                <div class="grafico-dona-etiqueta">Ingresos</div>
            </div>
        </div>
        <div class="leyenda-dona">
            ${leyenda}
        </div>
    `;

    applyDonutOffsets(offsets, 'ingresos-empleado');
}


/**
 * Helper para crear el SVG de una dona y calcular sus segmentos.
 */
function createDonutSVG(data, total, idPrefix = 'dona') {
    const circunferencia = 502; // 2 * PI * 80 (radio)
    let acumuladoOffset = 0;
    let svg = `<svg width="200" height="200" viewbox="0 0 200 200">
                   <circle cx="100" cy="100" r="80" fill="none" stroke="#e5e5e5" stroke-width="30" />`;
    
    const offsets = data.map((item, index) => {
        const porcentaje = (item.cantidad / total);
        const dashArray = porcentaje * circunferencia;
        const dashOffset = -acumuladoOffset;
        
        svg += `<circle id="dona-${idPrefix}-circulo-${index}"
                        cx="100" cy="100" r="80" fill="none" 
                        stroke="${item.color}" stroke-width="30" 
                        stroke-dasharray="0 502" 
                        stroke-dashoffset="0" 
                        stroke-linecap="round" 
                        style="transition: stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease;" />`;

        acumuladoOffset += dashArray;
        return { dashArray, dashOffset, id: `dona-${idPrefix}-circulo-${index}` };
    });

    svg += `</svg>`;
    return { svg, offsets };
}

/**
 * Helper para aplicar los offsets a los círculos de la dona (para animación)
 */
function applyDonutOffsets(offsets, idPrefix) {
    offsets.forEach((offset, index) => {
        setTimeout(() => {
            const circle = document.getElementById(offset.id);
            if (circle) {
                circle.style.strokeDasharray = `${offset.dashArray} 502`;
                circle.style.strokeDashoffset = `${offset.dashOffset}`;
            }
        }, 10 * (index + 1));
    });
}