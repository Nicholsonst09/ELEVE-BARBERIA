// js/finanzas.js
import { estado } from './estado.js';
import { formatCurrency } from './utilidades.js';

/**
 * Datos simulados con claves en español
 */
const datosSimulados = {
    // Datos de KPIs que cambian por período
    kpis: {
        day: {
            ingresosTotales: 1250,
            cambioIngresos: 5.2,
            turnosTotales: 28,
            ingresoPromedioPorTurno: 44,
            tasaOcupacion: 91,
            horasTotales: 18,
            fidelidad: {
                nuevos: 4,
                recurrentes: 24
            },
            estadoTurnos: {
                completados: 26,
                cancelados: 1,
                ausentes: 1
            }
        },
        week: {
            ingresosTotales: 6660,
            cambioIngresos: 10.8,
            turnosTotales: 180,
            ingresoPromedioPorTurno: 37,
            tasaOcupacion: 85,
            horasTotales: 130,
            fidelidad: {
                nuevos: 25,
                recurrentes: 155
            },
            estadoTurnos: {
                completados: 170,
                cancelados: 8,
                ausentes: 2
            }
        },
        month: {
            ingresosTotales: 25400,
            cambioIngresos: 12.5,
            turnosTotales: 720,
            ingresoPromedioPorTurno: 35,
            tasaOcupacion: 78,
            horasTotales: 510,
            fidelidad: {
                nuevos: 95,
                recurrentes: 625
            },
            estadoTurnos: {
                completados: 680,
                cancelados: 30,
                ausentes: 10
            }
        }
    },
    // Datos para el gráfico de barras de empleados
    serviciosPorEmpleado: {
        day: [
            { nombre: 'Ana', cantidad: 7 },
            { nombre: 'Carlos', cantidad: 6 },
            { nombre: 'Lucía', cantidad: 6 },
            { nombre: 'Marcos', cantidad: 5 },
            { nombre: 'Sofía', cantidad: 4 }
        ],
        week: [
            { nombre: 'Ana', cantidad: 45 },
            { nombre: 'Carlos', cantidad: 42 },
            { nombre: 'Lucía', cantidad: 38 },
            { nombre: 'Marcos', cantidad: 35 },
            { nombre: 'Sofía', cantidad: 20 }
        ],
        month: [
            { nombre: 'Ana', cantidad: 180 },
            { nombre: 'Carlos', cantidad: 172 },
            { nombre: 'Lucía', cantidad: 160 },
            { nombre: 'Marcos', cantidad: 155 },
            { nombre: 'Sofía', cantidad: 83 }
        ]
    },
    // Ingresos por Empleado
    ingresosPorEmpleado: {
        day: [
            { nombre: 'Ana', monto: 320 },
            { nombre: 'Carlos', monto: 290 },
            { nombre: 'Lucía', monto: 270 },
            { nombre: 'Marcos', monto: 230 },
            { nombre: 'Sofía', monto: 140 }
        ],
        week: [
            { nombre: 'Ana', monto: 1800 },
            { nombre: 'Carlos', monto: 1650 },
            { nombre: 'Lucía', monto: 1500 },
            { nombre: 'Marcos', monto: 1450 },
            { nombre: 'Sofía', monto: 800 }
        ],
        month: [
            { nombre: 'Ana', monto: 7200 },
            { nombre: 'Carlos', monto: 6900 },
            { nombre: 'Lucía', monto: 6100 },
            { nombre: 'Marcos', monto: 5800 },
            { nombre: 'Sofía', monto: 3100 }
        ]
    },
    // Ocupación por Empleado (%)
    ocupacionPorEmpleado: {
        day: [
            { nombre: 'Ana', porcentaje: 95 },
            { nombre: 'Carlos', porcentaje: 90 },
            { nombre: 'Lucía', porcentaje: 88 },
            { nombre: 'Marcos', porcentaje: 80 },
            { nombre: 'Sofía', porcentaje: 70 }
        ],
        week: [
            { nombre: 'Ana', porcentaje: 92 },
            { nombre: 'Carlos', porcentaje: 87 },
            { nombre: 'Lucía', porcentaje: 78 },
            { nombre: 'Marcos', porcentaje: 72 },
            { nombre: 'Sofía', porcentaje: 65 }
        ],
        month: [
            { nombre: 'Ana', porcentaje: 88 },
            { nombre: 'Carlos', porcentaje: 82 },
            { nombre: 'Lucía', porcentaje: 75 },
            { nombre: 'Marcos', porcentaje: 70 },
            { nombre: 'Sofía', porcentaje: 58 }
        ]
    },
    // Turnos por Hora
    turnosPorHora: {
        day: [
            { hora: '09:00', cantidad: 2 },
            { hora: '10:00', cantidad: 4 },
            { hora: '11:00', cantidad: 5 },
            { hora: '14:00', cantidad: 3 },
            { hora: '15:00', cantidad: 6 },
            { hora: '16:00', cantidad: 7 },
            { hora: '17:00', cantidad: 3 }
        ],
        week: [
            { hora: '09:00', cantidad: 10 },
            { hora: '10:00', cantidad: 25 },
            { hora: '11:00', cantidad: 30 },
            { hora: '14:00', cantidad: 20 },
            { hora: '15:00', cantidad: 35 },
            { hora: '16:00', cantidad: 40 },
            { hora: '17:00', cantidad: 20 }
        ],
        month: [
            { hora: '09:00', cantidad: 40 },
            { hora: '10:00', cantidad: 100 },
            { hora: '11:00', cantidad: 120 },
            { hora: '14:00', cantidad: 80 },
            { hora: '15:00', cantidad: 140 },
            { hora: '16:00', cantidad: 160 },
            { hora: '17:00', cantidad: 80 }
        ]
    },
    // Servicios Populares (Dona)
    serviciosPopularesDona: [
        { nombre: 'Corte Clásico', cantidad: 450, color: '#1a1a1a' },
        { nombre: 'Barba', cantidad: 320, color: '#404040' },
        { nombre: 'Tinte', cantidad: 280, color: '#737373' },
        { nombre: 'Peinado', cantidad: 220, color: '#a3a3a3' },
        { nombre: 'Tratamiento', cantidad: 180, color: '#d4d4d4' }
    ]
};

function obtenerFuenteFinanciera(period) {
    const data = estado.financialData || {};
    const tieneKpis = Boolean(data.kpis && data.kpis[period]);
    return tieneKpis ? data : datosSimulados;
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
    renderizarGraficoOcupacionEmpleado(period); 
    renderizarGraficoTurnosPorHora_Linea(period); 
    renderizarGraficoFidelidad(period);
    renderizarGraficoEstadoTurnos(period);

    renderizarGraficoServiciosPopulares(period);
}

/**
 * Puebla las 3 tarjetas superiores (Dark Mode).
 */
function renderizarKpisPrincipales(period) {
    const fuente = obtenerFuenteFinanciera(period);
    const kpiData = fuente.kpis?.[period] || {
        ingresosTotales: 0,
        cambioIngresos: 0,
        turnosTotales: 0,
        ingresoPromedioPorTurno: 0,
        tasaOcupacion: 0,
        horasTotales: 0,
    };

    // Claves actualizadas al español
    document.getElementById('kpi-total-revenue').textContent = formatCurrency(kpiData.ingresosTotales);
    document.getElementById('kpi-revenue-change').innerHTML = `<span>↗ ${kpiData.cambioIngresos}%</span>`;
    document.getElementById('kpi-total-appts').textContent = kpiData.turnosTotales;
    document.getElementById('kpi-avg-revenue-appt').textContent = `${formatCurrency(kpiData.ingresoPromedioPorTurno)} por turno`;
    document.getElementById('kpi-occupancy-rate').textContent = `${kpiData.tasaOcupacion}%`;
    document.getElementById('kpi-total-hours').textContent = `${kpiData.horasTotales} horas`;
}

/**
 * Puebla la fila de 4 tarjetas de métricas.
 */
function renderizarMetricasClave(period) {
    const fuente = obtenerFuenteFinanciera(period);
    const kpiData = fuente.kpis?.[period] || {};
    const fidelidadData = kpiData.fidelidad || { nuevos: 0, recurrentes: 0 };
    const estadoData = kpiData.estadoTurnos || { completados: 0, cancelados: 0, ausentes: 0 };

    const totalClientes = fidelidadData.nuevos + fidelidadData.recurrentes;
    const tasaFidelidad = (fidelidadData.recurrentes / totalClientes * 100).toFixed(0);
    
    const totalTurnos = estadoData.completados + estadoData.cancelados + estadoData.ausentes;
    const tasaCancelacion = (estadoData.cancelados / totalTurnos * 100).toFixed(0);

    document.getElementById('metric-nuevos-clientes').textContent = fidelidadData.nuevos;
    document.getElementById('metric-fidelidad-kpi').textContent = `${tasaFidelidad}%`;
    document.getElementById('metric-cancelacion-kpi').textContent = `${tasaCancelacion}%`;
    document.getElementById('metric-ausentes-kpi').textContent = estadoData.ausentes;
}

/**
 * Renderiza el gráfico de barras de Servicios por Empleado.
 */
function renderizarGraficoServiciosEmpleado(period) {
    const container = document.getElementById('grafico-servicios-empleado');
    if (!container) return;

    const fuente = obtenerFuenteFinanciera(period);
    const empleadosData = fuente.serviciosPorEmpleado?.[period] || [];
    if (empleadosData.length === 0) {
        container.innerHTML = '<p class="sin-horarios">Sin datos para este período.</p>';
        return;
    }
    const maxCount = Math.max(...empleadosData.map(e => e.cantidad));

    container.innerHTML = empleadosData.map((empleado, index) => {
        const porcentaje = (empleado.cantidad / maxCount) * 100;
        const iniciales = empleado.nombre.charAt(0).toUpperCase();
        const rankClass = index < 3 ? `top-${index + 1}` : '';
        
        return `
          <div class="barra-item">
            <div class="barra-avatar">
              ${iniciales}
              <span class="barra-ranking ${rankClass}">${index + 1}</span>
            </div>
            <div class="barra-info">
              <div class="barra-top-row">
                <span class="barra-etiqueta">${empleado.nombre}</span>
                <span class="barra-valor">${empleado.cantidad} servicios</span>
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
 * Renderiza el gráfico de Ocupación por Empleado con círculos de progreso.
 */
function renderizarGraficoOcupacionEmpleado(period) {
    const container = document.getElementById('grafico-ocupacion-empleado');
    if (!container) return;

    const fuente = obtenerFuenteFinanciera(period);
    const ocupacionData = fuente.ocupacionPorEmpleado?.[period] || [];
    if (ocupacionData.length === 0) {
        container.innerHTML = '<p class="sin-horarios">Sin datos para este período.</p>';
        return;
    }
    const circumference = 2 * Math.PI * 32; // Radio 32

    container.innerHTML = ocupacionData.map((empleado, index) => {
        const offset = circumference - (empleado.porcentaje / 100) * circumference;
        const iniciales = empleado.nombre.charAt(0).toUpperCase();
        
        // Color según rendimiento
        let color = '#16a34a'; // Verde alto
        if (empleado.porcentaje < 70) color = '#d97706'; // Naranja medio
        if (empleado.porcentaje < 50) color = '#dc2626'; // Rojo bajo
        
        return `
          <div class="ocupacion-item">
            <div class="ocupacion-ring">
              <svg viewBox="0 0 80 80">
                <circle class="ring-bg" cx="40" cy="40" r="32" />
                <circle class="ring-progress" cx="40" cy="40" r="32" 
                  stroke="${color}"
                  stroke-dasharray="${circumference}" 
                  stroke-dashoffset="${offset}" />
              </svg>
              <div class="ring-center">
                <span class="ring-value">${empleado.porcentaje}</span>
                <span class="ring-percent">%</span>
              </div>
            </div>
            <span class="ocupacion-nombre">${empleado.nombre}</span>
          </div>
        `;
    }).join('');
}

/**
 * Renderiza el gráfico de LÍNEA de Turnos por Hora.
 */
function renderizarGraficoTurnosPorHora_Linea(period) {
    const container = document.getElementById('grafico-turnos-hora-contenedor');
    if (!container) return;

    const fuente = obtenerFuenteFinanciera(period);
    const horasData = fuente.turnosPorHora?.[period] || [];
    if (horasData.length === 0) {
        container.innerHTML = '<p class="sin-horarios">Sin datos para este período.</p>';
        return;
    }
    const maxCount = Math.max(...horasData.map(h => h.cantidad));
    
    const svgWidth = 300; // Ancho fijo del SVG
    const svgHeight = 300; // Alto fijo del SVG
    const paddingX = 20;
    const paddingTop = 20;
    const paddingBottom = 42; // espacio para etiquetas del eje X
    const areaWidth = svgWidth - (paddingX * 2);
    const areaHeight = svgHeight - paddingTop - paddingBottom;
    
    // Normalizar puntos
    const points = horasData.map((data, index) => {
        const divisor = Math.max(horasData.length - 1, 1);
        const x = paddingX + (index * areaWidth / divisor);
        const y = (svgHeight - paddingBottom) - (data.cantidad / maxCount) * areaHeight;
        return { x, y, val: data.cantidad, label: data.hora };
    });

    // Crear el string del path (la línea)
    const pathD = points.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x} ${p.y}`).join(' ');
    
    // Crear el string del path del área (sombra)
    const baseY = svgHeight - paddingBottom;
    const areaD = pathD + ` L ${points[points.length-1].x} ${baseY} L ${points[0].x} ${baseY} Z`;

    // Mostrar menos etiquetas cuando hay muchos puntos para evitar solapamientos
    const maxEtiquetas = 8;
    const saltoEtiquetas = Math.max(1, Math.ceil(points.length / maxEtiquetas));

    // Crear los elementos SVG
    let svg = `<svg class="grafico-linea-svg" viewBox="0 0 ${svgWidth} ${svgHeight}">`;
    svg += `<path class="area" d="${areaD}" />`; // Sombra
    svg += `<path class="linea" d="${pathD}" />`; // Línea
    
    points.forEach((p, index) => {
        svg += `<circle class="punto" cx="${p.x}" cy="${p.y}" r="4" />`;

        const esPrimero = index === 0;
        const esUltimo = index === points.length - 1;
        const mostrarEtiqueta = esPrimero || esUltimo || (index % saltoEtiquetas === 0);
        if (mostrarEtiqueta) {
            svg += `<text class="etiqueta-eje-x" x="${p.x}" y="${svgHeight - 12}">${p.label}</text>`;
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
    const data = (fuente.serviciosPopularesDona && fuente.serviciosPopularesDona.length > 0)
        ? fuente.serviciosPopularesDona
        : datosSimulados.serviciosPopularesDona;
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
                <div class="grafico-dona-valor">${total}</div>
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
 * Renderiza el gráfico de dona para Fidelidad de Clientes.
 */
function renderizarGraficoFidelidad(period) {
    const container = document.getElementById('dona-fidelidad-clientes');
    if (!container) return;
    const fuente = obtenerFuenteFinanciera(period);
    const kpiData = fuente.kpis?.[period]?.fidelidad || { nuevos: 0, recurrentes: 0 };
    const data = [
        { nombre: 'Recurrentes', cantidad: kpiData.recurrentes, color: '#1a1a1a' },
        { nombre: 'Nuevos', cantidad: kpiData.nuevos, color: '#a3a3a3' }
    ];
    const total = data.reduce((sum, item) => sum + item.cantidad, 0);

    const { svg, offsets } = createDonutSVG(data, total, 'fidelidad');

    const leyenda = data.map((item) => `
        <div class="item-leyenda">
            <div class="item-leyenda-info">
                <div class="indicador-leyenda" style="background: ${item.color};"></div>
                <span class="item-leyenda-nombre">${item.nombre}</span>
            </div>
            <span class="item-leyenda-valor">${item.cantidad}</span>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="grafico-dona" id="dona-fidelidad-svg">
            ${svg}
            <div class="grafico-dona-centro">
                <div class="grafico-dona-valor">${((kpiData.recurrentes / total) * 100).toFixed(0)}%</div>
                <div class="grafico-dona-etiqueta">Fidelidad</div>
            </div>
        </div>
        <div class="leyenda-dona">
            ${leyenda}
        </div>
    `;

    applyDonutOffsets(offsets, 'fidelidad');
}

/**
 * Renderiza el gráfico de dona para Estado de Turnos.
 */
function renderizarGraficoEstadoTurnos(period) {
    const container = document.getElementById('dona-estado-turnos');
    if (!container) return;
    const fuente = obtenerFuenteFinanciera(period);
    const kpiData = fuente.kpis?.[period]?.estadoTurnos || { completados: 0, cancelados: 0, ausentes: 0 };
    const data = [
        { nombre: 'Completados', cantidad: kpiData.completados, color: '#1a1a1a' },
        { nombre: 'Cancelados', cantidad: kpiData.cancelados, color: '#737373' },
        { nombre: 'Ausentes', cantidad: kpiData.ausentes, color: '#d97706' } // (Usando la etiqueta 'Ausentes')
    ];
    const total = data.reduce((sum, item) => sum + item.cantidad, 0);

    const { svg, offsets } = createDonutSVG(data, total, 'estado');

    const leyenda = data.map((item) => `
        <div class="item-leyenda">
            <div class="item-leyenda-info">
                <div class="indicador-leyenda" style="background: ${item.color};"></div>
                <span class="item-leyenda-nombre">${item.nombre}</span>
            </div>
            <span class="item-leyenda-valor">${item.cantidad}</span>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="grafico-dona" id="dona-estado-svg">
            ${svg}
            <div class="grafico-dona-centro">
                <div class="grafico-dona-valor">${total}</div>
                <div class="grafico-dona-etiqueta">Turnos</div>
            </div>
        </div>
        <div class="leyenda-dona">
            ${leyenda}
        </div>
    `;
    
    applyDonutOffsets(offsets, 'estado');
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