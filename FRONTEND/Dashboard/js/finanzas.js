// js/finanzas.js
import { estado } from './estado.js';
import { formatCurrency } from './utilidades.js';

export function renderFinancialData(period) {
  const data = estado.financialData;

  if (!data || !data.services) {
    console.warn('Datos financieros no disponibles para renderizar.');
    return;
  }

  document.getElementById("total-revenue").textContent = formatCurrency(data.totalRevenue || 0);
  document.getElementById("services-count").textContent = data.services.total || 0;
  document.getElementById("services-revenue").textContent = formatCurrency(data.services.revenue || 0);
  document.getElementById("products-count").textContent = data.products.total || 0;
  document.getElementById("products-revenue").textContent = formatCurrency(data.products.revenue || 0);

  const performance = data.performance || {};
  document.getElementById("avg-service").textContent = formatCurrency(performance.avgService || 0);
  document.getElementById("avg-product").textContent = formatCurrency(performance.avgProduct || 0);
  document.getElementById("services-per-day").textContent = Math.round(performance.servicesPerDay || 0);
  document.getElementById("revenue-per-day").textContent = formatCurrency(performance.revenuePerDay || 0);

  renderServicesBreakdown(data.serviceBreakdown || []);
  renderProductsBreakdown(data.productSales || []);
}

function renderServicesBreakdown(serviceBreakdown) {
  const container = document.getElementById("services-breakdown");
  container.innerHTML = "";

  if (!serviceBreakdown || serviceBreakdown.length === 0) {
    container.innerHTML = "<p>No hay datos de servicios.</p>";
    return;
  }

  serviceBreakdown.forEach((service) => {
    const div = document.createElement("div");
    div.className = "elemento-desglose";
    div.innerHTML = `
      <div class="encabezado-desglose">
        <span class="nombre-desglose">${service.nombre}</span>
        <span class="contador-desglose">${service.count} servicios</span>
      </div>
      <div class="pie-desglose">
        <div class="barra-progreso">
          <div class="relleno-progreso servicios" style="width: ${service.percentage}%"></div>
        </div>
        <span class="ingresos-desglose">${formatCurrency(service.revenue)}</span>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderProductsBreakdown(productSales) {
  const container = document.getElementById("products-breakdown");
  container.innerHTML = "";

  if (!productSales || productSales.length === 0) {
    container.innerHTML = "<p>No hay datos de productos.</p>";
    return;
  }

  productSales.forEach((product) => {
    const div = document.createElement("div");
    div.className = "elemento-desglose";
    div.innerHTML = `
      <div class="encabezado-desglose">
        <span class="nombre-desglose">${product.nombre}</span>
        <span class="contador-desglose">${product.units} unidades</span>
      </div>
      <div class="pie-desglose">
        <div class="barra-progreso">
          <div class="relleno-progreso productos" style="width: ${product.percentage}%"></div>
        </div>
        <span class="ingresos-desglose">${formatCurrency(product.revenue)}</span>
      </div>
    `;
    container.appendChild(div);
  });
}