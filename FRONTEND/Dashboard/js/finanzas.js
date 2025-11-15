// js/finanzas.js
import { estado } from './estado.js';
import { formatCurrency } from './utilidades.js';

/**
 * Datos simulados con claves en español
 */
const datosSimulados = {
    // Datos de KPIs que cambian por período
    kpis: {
        week: { // Dejamos 'week' y 'month' como IDs de filtro
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
    // Turnos por Hora
    turnosPorHora: {
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
    renderizarGraficoIngresosEmpleado(period); 
    renderizarGraficoTurnosPorHora_Linea(period); 
    renderizarGraficoFidelidad(period);
    renderizarGraficoEstadoTurnos(period);

    // 4. Renderizar gráficos estáticos (se renderiza solo una vez)
    renderizarGraficoServiciosPopulares();
}

/**
 * Puebla las 3 tarjetas superiores (Dark Mode).
 */
function renderizarKpisPrincipales(period) {
    const kpiData = datosSimulados.kpis[period];

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
    const kpiData = datosSimulados.kpis[period];
    const fidelidadData = kpiData.fidelidad; // claves 'nuevos', 'recurrentes' ya están OK
    const estadoData = kpiData.estadoTurnos; // claves 'completados', 'cancelados', 'ausentes' ya están OK

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

    // Lee desde las claves 'week' o 'month'
    const empleadosData = datosSimulados.serviciosPorEmpleado[period];
    const maxCount = Math.max(...empleadosData.map(e => e.cantidad));

    container.innerHTML = empleadosData.map(empleado => {
        const altura = (empleado.cantidad / maxCount) * 100;
        return `
          <div class="barra-item">
            <div class="barra" style="height: ${altura > 0 ? altura : 5}%">
              <span class="barra-valor">${empleado.cantidad}</span>
            </div>
            <span class="barra-etiqueta" title="${empleado.nombre}">${empleado.nombre}</span>
          </div>
        `;
    }).join('');
}

/**
 * Renderiza el gráfico de barras de Ingresos por Empleado.
 */
function renderizarGraficoIngresosEmpleado(period) {
    const container = document.getElementById('grafico-ingresos-empleado');
    if (!container) return;

    // Lee desde las claves 'week' o 'month'
    const ingresosData = datosSimulados.ingresosPorEmpleado[period];
    const maxMonto = Math.max(...ingresosData.map(e => e.monto));

    container.innerHTML = ingresosData.map(empleado => {
        const altura = (empleado.monto / maxMonto) * 100;
        return `
          <div class="barra-item">
            <div class="barra" style="height: ${altura > 0 ? altura : 5}%">
              <span class="barra-valor">${formatCurrency(empleado.monto)}</span>
            </div>
            <span class="barra-etiqueta" title="${empleado.nombre}">${empleado.nombre}</span>
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

    // Lee desde las claves 'week' o 'month'
    const horasData = datosSimulados.turnosPorHora[period];
    const maxCount = Math.max(...horasData.map(h => h.cantidad));
    
    const svgWidth = 300; // Ancho fijo del SVG
    const svgHeight = 300; // Alto fijo del SVG
    const padding = 20;
    
    // Normalizar puntos
    const points = horasData.map((data, index) => {
        const x = padding + (index * (svgWidth - 2 * padding) / (horasData.length - 1));
        const y = (svgHeight - padding) - (data.cantidad / maxCount) * (svgHeight - 2 * padding);
        return { x, y, val: data.cantidad, label: data.hora };
    });

    // Crear el string del path (la línea)
    const pathD = points.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x} ${p.y}`).join(' ');
    
    // Crear el string del path del área (sombra)
    const areaD = pathD + ` L ${points[points.length-1].x} ${svgHeight - padding} L ${points[0].x} ${svgHeight - padding} Z`;

    // Crear los elementos SVG
    let svg = `<svg class="grafico-linea-svg" viewBox="0 0 ${svgWidth} ${svgHeight}">`;
    svg += `<path class="area" d="${areaD}" />`; // Sombra
    svg += `<path class="linea" d="${pathD}" />`; // Línea
    
    points.forEach(p => {
        svg += `<circle class="punto" cx="${p.x}" cy="${p.y}" r="4" />`;
        // Etiqueta del eje X
        svg += `<text class="etiqueta-eje-x" x="${p.x}" y="${svgHeight - padding + 15}">${p.label}</text>`;
    });
    
    svg += `</svg>`;
    container.innerHTML = svg;
}


/**
 * Renderiza el gráfico de dona para Servicios Populares.
 */
function renderizarGraficoServiciosPopulares() {
    const container = document.getElementById('dona-servicios-populares');
    if (!container || container.innerHTML.trim() !== "") return; 

    // Lee de 'serviciosPopularesDona' (claves ya ok)
    const data = datosSimulados.serviciosPopularesDona;
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
    const kpiData = datosSimulados.kpis[period].fidelidad;
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
    const kpiData = datosSimulados.kpis[period].estadoTurnos;
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