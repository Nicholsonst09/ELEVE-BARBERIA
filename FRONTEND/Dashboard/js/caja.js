import { estado } from './estado.js'
import { formatCurrency, showNotification, confirmarAccion, setBtnLoading } from './utilidades.js'
import { obtenerSesion } from './auth.js'
import { createCajaVenta, fetchCajaVentas, fetchProductos, anularCajaVenta, reactivarCajaVenta } from './api.js'

/** @type {Array<{key: string, tipo: 'producto'|'servicio', id: number, nombre: string, precio: number, cantidad: number}>} */
let carrito = []
let productosCaja = []
let categoriaActiva = 'todas'
let metodoPagoSeleccionado = 'efectivo'
let carritoMobileAbierto = false
let historialCajaVentas = []
let historialCajaFiltro = 'todos'
let historialCajaBusqueda = ''
let historialCajaFecha = ''

const ETIQUETAS_ESTADO_CAJA = {
  registrada: { txt: 'Registrada', cls: 'estado-realizado' },
  anulada: { txt: 'Anulada', cls: 'estado-anulado' },
}

function esVistaCajaMobile() {
  return window.matchMedia('(max-width: 900px)').matches
}

function obtenerUsuarioIdSesion() {
  const sesion = obtenerSesion?.()
  const usuarioId = Number(sesion?.usuarioId)
  return Number.isFinite(usuarioId) && usuarioId > 0 ? usuarioId : null
}

function obtenerEmpleadoIdSesion() {
  const sesion = obtenerSesion?.()
  const empleadoId = Number(sesion?.empleadoId)
  return Number.isFinite(empleadoId) && empleadoId > 0 ? empleadoId : null
}

function formatearFechaCaja(fechaValor) {
  if (!fechaValor) return ''
  const fecha = new Date(fechaValor)
  if (Number.isNaN(fecha.getTime())) return ''
  return fecha.toISOString().slice(0, 10)
}

function normalizarVentaHistorial(venta = {}) {
  const fechaValor = venta.fecha_hora || venta.fecha || venta.creado || null
  const fecha = formatearFechaCaja(fechaValor)
  const metodoPago = venta.metodo_pago?.nombre || venta.metodoPago || 'Efectivo'
  const cliente = venta.cliente?.nombre || venta.cliente || ''
  const empleado = venta.empleado?.nombre || venta.nombre_empleado || ''
  const usuario = venta.usuario?.nombre || venta.usuario || ''
  const items = (venta.items || []).map((item) => ({
    descripcion: item.descripcion || item.nombre || 'Item',
    cantidad: Number(item.cantidad || 1),
    subtotal: Number(item.subtotal || 0),
    tipo: item.tipo_item || item.tipo || '',
  }))

  return {
    ...venta,
    fecha,
    fecha_valor: fechaValor,
    estado: String(venta.estado || 'registrada').toLowerCase(),
    metodoPago,
    clienteNombre: cliente,
    empleadoNombre: empleado,
    usuarioNombre: usuario,
    items,
  }
}

async function cargarHistorialCajaCompleto() {
  // Solo el empleado queda acotado a sus propias ventas; el admin debe ver
  // las de todo el equipo (igual que el panel "Ventas de hoy", que no filtra).
  const esEmpleado = obtenerSesion?.()?.rol === 'empleado'
  const usuarioId = obtenerUsuarioIdSesion()
  const ventas = await fetchCajaVentas({
    limite: 500,
    ...(esEmpleado && usuarioId ? { usuario_id: usuarioId } : {}),
  })
  return ventas.map(normalizarVentaHistorial)
}

function obtenerCategoriasDesdeProductos(productos = []) {
  return [...new Set(productos.map((p) => p.categoria).filter(Boolean))]
}

function renderizarTablaHistorialCaja() {
  const cuerpo = document.getElementById('historialCajaCuerpo')
  if (!cuerpo) return

  const porEstado = historialCajaFiltro === 'todos'
    ? historialCajaVentas
    : historialCajaVentas.filter((venta) => venta.estado === historialCajaFiltro)

  const texto = historialCajaBusqueda.trim().toLowerCase()
  const filtrados = porEstado.filter((venta) => {
    const coincideFecha = !historialCajaFecha || venta.fecha === historialCajaFecha
    if (!coincideFecha) return false

    if (!texto) return true
    const bolsa = [
      venta.fecha,
      venta.metodoPago,
      venta.clienteNombre,
      venta.empleadoNombre,
      venta.usuarioNombre,
      venta.estado,
      ...venta.items.map((item) => item.descripcion),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return bolsa.includes(texto)
  })

  if (filtrados.length === 0) {
    cuerpo.innerHTML = '<p class="historial-vacio">No hay ventas para mostrar con esos filtros.</p>'
    return
  }

  const filas = filtrados.map((venta) => {
    const etiqueta = ETIQUETAS_ESTADO_CAJA[venta.estado] || { txt: venta.estado, cls: '' }
    const idx = historialCajaVentas.indexOf(venta)
    return `<tr>
      <td>${venta.fecha || '-'}</td>
      <td class="col-servicio">${venta.items.map((item) => `${item.cantidad}x ${item.descripcion}`).join(', ')}</td>
      <td class="col-barbero">${venta.empleadoNombre || venta.usuarioNombre || 'Sin asignar'}</td>
      <td class="col-estado"><span class="insignia-estado ${etiqueta.cls}">${etiqueta.txt}</span></td>
      <td class="valor-tabular">${formatCurrency(venta.total || 0)}</td>
      <td class="col-ojo">
        <button type="button" class="btn-ojo-historial" data-idx="${idx}" aria-label="Ver detalle de la venta">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:15px;height:15px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
        </button>
      </td>
    </tr>`
  }).join('')

  cuerpo.innerHTML = `
    <div class="historial-tabla-wrap">
      <table class="historial-tabla historial-tabla-caja">
        <thead>
          <tr>
            <th>Fecha</th>
            <th class="col-servicio">Detalle</th>
            <th class="col-barbero">Empleado</th>
            <th class="col-estado">Estado</th>
            <th>Total</th>
            <th class="col-ojo"></th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`

  cuerpo.querySelectorAll('.btn-ojo-historial').forEach((btn) => {
    btn.addEventListener('click', () => {
      renderizarDetalleHistorialCaja(historialCajaVentas[Number(btn.dataset.idx)])
    })
  })
}

function renderizarDetalleHistorialCaja(venta) {
  const cuerpo = document.getElementById('historialCajaCuerpo')
  if (!cuerpo || !venta) return
  const etiqueta = ETIQUETAS_ESTADO_CAJA[venta.estado] || { txt: venta.estado, cls: '' }
  const hora = venta.fecha_valor
    ? new Date(venta.fecha_valor).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : '--:--'
  const detalleItems = venta.items.map((item) => `${item.cantidad}x ${item.descripcion}`).join(', ')

  const esAdmin = obtenerSesion()?.rol === 'admin'
  const puedeAnular = esAdmin && venta.estado === 'registrada'
  const puedeReactivar = esAdmin && venta.estado === 'anulada'

  cuerpo.innerHTML = `
    <button type="button" class="historial-volver" id="btnVolverHistorialCaja">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      Volver al historial
    </button>
    <div class="historial-detalle">
      <div class="historial-detalle-fila"><span>Fecha</span><strong>${venta.fecha || '-'}</strong></div>
      <div class="historial-detalle-fila"><span>Hora</span><strong>${hora}</strong></div>
      <div class="historial-detalle-fila"><span>Cliente</span><strong>${venta.clienteNombre || 'Mostrador'}</strong></div>
      <div class="historial-detalle-fila"><span>Empleado</span><strong>${venta.empleadoNombre || venta.usuarioNombre || 'Sin asignar'}</strong></div>
      <div class="historial-detalle-fila"><span>Método</span><strong>${venta.metodoPago}</strong></div>
      <div class="historial-detalle-fila"><span>Estado</span><span class="insignia-estado ${etiqueta.cls}">${etiqueta.txt}</span></div>
      <div class="historial-detalle-fila"><span>Items</span><span>${detalleItems || 'Sin items'}</span></div>
      <div class="historial-detalle-fila"><span>Total</span><strong>${formatCurrency(venta.total || 0)}</strong></div>
      ${venta.observaciones ? `<div class="historial-detalle-fila"><span>Notas</span><span>${venta.observaciones}</span></div>` : ''}
    </div>
    ${puedeAnular ? `
      <button type="button" class="boton-secundario eliminar historial-btn-anular" id="btnAnularVentaCaja">
        <i class="fas fa-ban"></i> Anular venta (se cargó por equivocación)
      </button>
    ` : ''}
    ${puedeReactivar ? `
      <button type="button" class="boton-primario historial-btn-anular" id="btnRegistrarVentaCaja">
        <i class="fas fa-rotate-left"></i> Registrar venta
      </button>
    ` : ''}`

  document.getElementById('btnVolverHistorialCaja')?.addEventListener('click', renderizarTablaHistorialCaja)

  document.getElementById('btnAnularVentaCaja')?.addEventListener('click', async (e) => {
    // Ojo: e.currentTarget se resetea a null después de un await (el navegador
    // lo limpia al terminar la fase de despacho del evento), así que hay que
    // guardar la referencia al botón ANTES de esperar la confirmación.
    const btnAnular = e.currentTarget
    const ok = await confirmarAccion(
      `¿Anulás la venta de ${venta.clienteNombre || 'mostrador'} por ${formatCurrency(venta.total || 0)}? Esta acción devuelve el stock de los productos vendidos.`,
      'Anular venta',
      'Sí, anular'
    )
    if (!ok) return

    const restaurar = setBtnLoading(btnAnular, 'Anulando...')
    const resultado = await anularCajaVenta(venta.id)
    restaurar()
    if (resultado) {
      showNotification('Venta anulada correctamente.', 'success')
      historialCajaVentas = await cargarHistorialCajaCompleto()
      renderizarTablaHistorialCaja()
    } else {
      showNotification('No se pudo anular la venta.', 'error')
    }
  })

  document.getElementById('btnRegistrarVentaCaja')?.addEventListener('click', async (e) => {
    const btnRegistrar = e.currentTarget
    const ok = await confirmarAccion(
      `¿Registrás de nuevo la venta de ${venta.clienteNombre || 'mostrador'} por ${formatCurrency(venta.total || 0)}? Esta acción vuelve a descontar el stock de los productos.`,
      'Registrar venta',
      'Sí, registrar'
    )
    if (!ok) return

    const restaurar = setBtnLoading(btnRegistrar, 'Registrando...')
    const resultado = await reactivarCajaVenta(venta.id)
    restaurar()
    if (resultado) {
      showNotification('Venta registrada nuevamente.', 'success')
      historialCajaVentas = await cargarHistorialCajaCompleto()
      renderizarTablaHistorialCaja()
    } else {
      showNotification('No se pudo registrar la venta.', 'error')
    }
  })
}

async function abrirHistorialCaja() {
  const modal = document.getElementById('modalHistorialCaja')
  const cuerpo = document.getElementById('historialCajaCuerpo')
  if (!modal || !cuerpo) return

  modal.hidden = false
  cuerpo.innerHTML = '<p class="historial-cargando">Cargando...</p>'

  historialCajaVentas = await cargarHistorialCajaCompleto()
  historialCajaFiltro = 'todos'
  historialCajaBusqueda = ''
  historialCajaFecha = ''

  const inputBuscar = document.getElementById('historialCajaBuscar')
  const inputFecha = document.getElementById('historialCajaFecha')
  if (inputBuscar) inputBuscar.value = ''
  if (inputFecha) inputFecha.value = ''

  document.querySelectorAll('#historialCajaFiltros .chip-filtro').forEach((btn) => {
    btn.classList.toggle('activo', btn.dataset.estado === 'todos')
  })

  renderizarTablaHistorialCaja()
}

function setupHistorialCajaListeners() {
  const btnAbrir = document.getElementById('btn-historial-caja')
  const btnCerrar = document.getElementById('btnCerrarHistorialCaja')
  const modal = document.getElementById('modalHistorialCaja')

  btnAbrir?.addEventListener('click', abrirHistorialCaja)
  btnCerrar?.addEventListener('click', () => {
    if (modal) modal.hidden = true
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.hidden) modal.hidden = true
  })

  document.getElementById('historialCajaFiltros')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip-filtro')
    if (!chip) return
    document.querySelectorAll('#historialCajaFiltros .chip-filtro').forEach((btn) => btn.classList.remove('activo'))
    chip.classList.add('activo')
    historialCajaFiltro = chip.dataset.estado
    renderizarTablaHistorialCaja()
  })

  document.getElementById('historialCajaBuscar')?.addEventListener('input', (e) => {
    historialCajaBusqueda = e.target.value || ''
    renderizarTablaHistorialCaja()
  })

  document.getElementById('historialCajaFecha')?.addEventListener('change', (e) => {
    historialCajaFecha = e.target.value || ''
    renderizarTablaHistorialCaja()
  })
}

function abrirCarritoMobile() {
  if (!esVistaCajaMobile()) return
  carritoMobileAbierto = true
  document.getElementById('caja-carrito-panel')?.classList.add('abierto')
  const overlay = document.getElementById('caja-carrito-overlay')
  if (overlay) overlay.hidden = false
  document.getElementById('btn-toggle-carrito-mobile')?.setAttribute('aria-expanded', 'true')
  document.body.classList.add('caja-carrito-abierto')
}

function cerrarCarritoMobile() {
  carritoMobileAbierto = false
  document.getElementById('caja-carrito-panel')?.classList.remove('abierto')
  const overlay = document.getElementById('caja-carrito-overlay')
  if (overlay) overlay.hidden = true
  document.getElementById('btn-toggle-carrito-mobile')?.setAttribute('aria-expanded', 'false')
  document.body.classList.remove('caja-carrito-abierto')
}

function toggleCarritoMobile() {
  if (carritoMobileAbierto) cerrarCarritoMobile()
  else abrirCarritoMobile()
}

export async function inicializarCaja() {
  const dataProductos = await fetchProductos()
  productosCaja = (dataProductos?.productos || []).filter((p) => p.activo)
  setupCajaListeners()
  setupHistorialCajaListeners()
  renderizarEstadoCaja()
  renderizarCatalogoCaja()
  renderizarCarrito()
  renderizarVentasDia()
}

function setupCajaListeners() {
  document.getElementById('buscador-caja')?.addEventListener('input', renderizarCatalogoCaja)
  document.getElementById('filtros-categoria-caja')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-categoria]')
    if (!chip) return
    categoriaActiva = chip.dataset.categoria
    document.querySelectorAll('#filtros-categoria-caja .chip-filtro').forEach((b) => {
      b.classList.toggle('activo', b.dataset.categoria === categoriaActiva)
    })
    renderizarCatalogoCaja()
  })

  document.getElementById('grid-productos-caja')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-agregar-producto]')
    if (card) agregarAlCarrito('producto', Number(card.dataset.agregarProducto))
  })

  document.getElementById('carrito-items')?.addEventListener('click', (e) => {
    const btnMas = e.target.closest('[data-mas]')
    const btnMenos = e.target.closest('[data-menos]')
    const btnQuitar = e.target.closest('[data-quitar]')
    if (btnMas) cambiarCantidad(btnMas.dataset.mas, 1)
    if (btnMenos) cambiarCantidad(btnMenos.dataset.menos, -1)
    if (btnQuitar) quitarDelCarrito(btnQuitar.dataset.quitar)
  })

  document.getElementById('btn-vaciar-carrito')?.addEventListener('click', () => {
    carrito = []
    renderizarCarrito()
    showNotification('Carrito vaciado', 'info')
  })

  document.getElementById('btn-cobrar-caja')?.addEventListener('click', abrirModalCobro)
  document.querySelector('#modal-cobro-caja .cerrar-modal')?.addEventListener('click', cerrarModalCobro)
  document.querySelector('#modal-cobro-caja .btn-cancelar-cobro')?.addEventListener('click', cerrarModalCobro)

  document.getElementById('metodos-pago-caja')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-metodo]')
    if (!btn) return
    metodoPagoSeleccionado = btn.dataset.metodo
    document.querySelectorAll('#metodos-pago-caja .btn-metodo-pago').forEach((b) => {
      b.classList.toggle('activo', b.dataset.metodo === metodoPagoSeleccionado)
    })
  })

  document.getElementById('btn-confirmar-cobro')?.addEventListener('click', confirmarCobro)

  document.getElementById('btn-ver-ventas-dia')?.addEventListener('click', renderizarVentasDia)

  document.getElementById('btn-toggle-carrito-mobile')?.addEventListener('click', toggleCarritoMobile)
  document.getElementById('btn-cerrar-carrito-mobile')?.addEventListener('click', cerrarCarritoMobile)
  document.getElementById('caja-carrito-overlay')?.addEventListener('click', cerrarCarritoMobile)
  document.getElementById('btn-cobrar-caja-mobile')?.addEventListener('click', abrirModalCobro)

  window.addEventListener('resize', () => {
    if (!esVistaCajaMobile()) cerrarCarritoMobile()
  })
}

function itemKey(tipo, id, turnoId = null) {
  return turnoId ? `${tipo}-${id}-t${turnoId}` : `${tipo}-${id}`
}

function agregarAlCarrito(tipo, id, extra = {}) {
  if (tipo === 'producto') {
    const prod = productosCaja.find((p) => p.id === id)
    if (!prod) return
    const key = itemKey('producto', id)
    const existente = carrito.find((i) => i.key === key)
    const cantidadActual = existente ? existente.cantidad : 0
    // Acá sí mostramos cartel: es el único punto donde no hay un botón
    // deshabilitado avisando (la card del catálogo no tiene ese estado).
    if (cantidadActual + 1 > prod.stock) {
      showNotification(`No queda stock de "${prod.nombre}" (disponible: ${prod.stock}).`, 'warning')
      return
    }
    if (existente) {
      existente.cantidad += 1
    } else {
      carrito.push({
        key,
        tipo: 'producto',
        id,
        nombre: prod.nombre,
        precio: Number(prod.precio),
        cantidad: 1,
      })
    }
  } else {
    const key = itemKey('servicio', id, extra.turnoId)
    if (carrito.some((i) => i.key === key)) return
    carrito.push({
      key,
      tipo: 'servicio',
      id,
      turnoId: extra.turnoId || null,
      nombre: extra.nombre,
      precio: extra.precio,
      cantidad: 1,
    })
  }
  renderizarCarrito()
  if (esVistaCajaMobile() && tipo === 'producto') {
    const nombre = productosCaja.find((p) => p.id === id)?.nombre
    if (nombre) showNotification(`${nombre} agregado`, 'success')
  }
}

function cambiarCantidad(key, delta) {
  const item = carrito.find((i) => i.key === key)
  if (!item) return
  if (item.tipo === 'servicio') return
  if (delta > 0) {
    const prod = productosCaja.find((p) => p.id === item.id)
    // El botón "+" ya queda deshabilitado sin stock (ver renderizarCarrito);
    // este chequeo es solo una red de seguridad, sin cartel.
    if (prod && item.cantidad + delta > prod.stock) return
  }
  item.cantidad += delta
  if (item.cantidad <= 0) carrito = carrito.filter((i) => i.key !== key)
  renderizarCarrito()
}

function quitarDelCarrito(key) {
  carrito = carrito.filter((i) => i.key !== key)
  renderizarCarrito()
}

function calcularSubtotal() {
  return carrito.reduce((s, i) => s + i.precio * i.cantidad, 0)
}

function renderizarEstadoCaja() {
  const hoy = new Date().toISOString().slice(0, 10)
  const badge = document.getElementById('estado-caja-badge')
  const totalDia = document.getElementById('caja-total-dia')
  const cantVentas = document.getElementById('caja-cant-ventas')

  if (badge) {
    badge.textContent = 'Caja lista'
    badge.className = 'estado-caja-badge abierta'
  }
  fetchCajaVentas({ desde: `${hoy}T00:00:00.000Z`, hasta: `${hoy}T23:59:59.999Z` })
    .then((ventas) => {
      const registradas = ventas.filter((v) => (v.estado || 'registrada').toLowerCase() !== 'anulada')
      const total = registradas.reduce((acc, venta) => acc + Number(venta.total || 0), 0)
      if (totalDia) totalDia.textContent = formatCurrency(total)
      if (cantVentas) cantVentas.textContent = registradas.length
    })
    .catch(() => {
      if (totalDia) totalDia.textContent = formatCurrency(0)
      if (cantVentas) cantVentas.textContent = '0'
    })
}

function renderizarCatalogoCaja() {
  const grid = document.getElementById('grid-productos-caja')
  const filtros = document.getElementById('filtros-categoria-caja')
  if (!grid) return

  const texto = (document.getElementById('buscador-caja')?.value || '').toLowerCase()
  const cats = ['todas', ...obtenerCategoriasDesdeProductos(productosCaja)]

  if (filtros && !filtros.dataset.rendered) {
    filtros.innerHTML = cats.map((c) => `
      <button type="button" class="chip-filtro ${c === categoriaActiva ? 'activo' : ''}" data-categoria="${c}">
        ${c === 'todas' ? 'Todos' : c}
      </button>
    `).join('')
    filtros.dataset.rendered = '1'
  }

  const filtrados = productosCaja.filter((p) => {
    const okCat = categoriaActiva === 'todas' || p.categoria === categoriaActiva
    const okTexto = !texto || p.nombre.toLowerCase().includes(texto)
    return okCat && okTexto
  })

  if (filtrados.length === 0) {
    grid.innerHTML = '<p class="sin-resultados caja-sin-productos">No hay productos activos</p>'
    return
  }

  grid.innerHTML = filtrados.map((p) => `
    <button type="button" class="tarjeta-producto-caja" data-agregar-producto="${p.id}">
      ${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}" class="producto-caja-imagen">` : '<div class="producto-caja-sin-imagen"></div>'}
      <span class="producto-caja-cat">${p.categoria || 'General'}</span>
      <h4>${p.nombre}</h4>
      <p class="producto-caja-precio">${formatCurrency(p.precio)}</p>
    </button>
  `).join('')
}

function renderizarCarrito() {
  const contenedor = document.getElementById('carrito-items')
  const subtotalEl = document.getElementById('carrito-subtotal')
  const totalEl = document.getElementById('carrito-total')
  const btnCobrar = document.getElementById('btn-cobrar-caja')
  const btnCobrarMobile = document.getElementById('btn-cobrar-caja-mobile')
  const contador = document.getElementById('carrito-contador')

  const subtotal = calcularSubtotal()
  const itemsCount = carrito.reduce((s, i) => s + i.cantidad, 0)
  const totalFmt = formatCurrency(subtotal)
  const vacio = carrito.length === 0

  if (contador) contador.textContent = itemsCount
  if (subtotalEl) subtotalEl.textContent = totalFmt
  if (totalEl) totalEl.textContent = totalFmt
  if (btnCobrar) btnCobrar.disabled = vacio
  if (btnCobrarMobile) btnCobrarMobile.disabled = vacio

  const dockTotal = document.getElementById('caja-dock-total')
  const dockItems = document.getElementById('caja-dock-items')
  const dockBadge = document.getElementById('caja-dock-badge')
  if (dockTotal) dockTotal.textContent = totalFmt
  if (dockItems) dockItems.textContent = itemsCount === 0 ? 'Sin ítems' : `${itemsCount} ítem${itemsCount === 1 ? '' : 's'}`
  if (dockBadge) {
    dockBadge.textContent = itemsCount
    dockBadge.hidden = itemsCount === 0
  }
  const headerCount = document.getElementById('carrito-header-count')
  if (headerCount) headerCount.textContent = itemsCount > 0 ? `(${itemsCount})` : ''

  if (!contenedor) return

  if (vacio) {
    contenedor.innerHTML = `
      <div class="carrito-vacio">
        <p>Sin productos</p>
        <small>Tocá un producto para agregarlo</small>
      </div>`
    return
  }

  contenedor.innerHTML = carrito.map((item) => {
    const stockProducto = item.tipo === 'producto'
      ? productosCaja.find((p) => p.id === item.id)?.stock ?? Infinity
      : null
    const sinMasStock = item.tipo === 'producto' && item.cantidad >= stockProducto

    return `
    <article class="carrito-item ${item.tipo}">
      <div class="carrito-item-top">
        <div class="carrito-item-info">
          <span class="carrito-item-tipo">${item.tipo === 'servicio' ? 'Servicio' : 'Producto'}</span>
          <span class="carrito-item-nombre">${item.nombre}</span>
        </div>
        <span class="carrito-item-subtotal valor-tabular">${formatCurrency(item.precio * item.cantidad)}</span>
      </div>
      <div class="carrito-item-bottom">
        ${item.tipo === 'producto' ? `
          <div class="carrito-cantidad" role="group" aria-label="Cantidad">
            <button type="button" class="btn-cantidad" data-menos="${item.key}" aria-label="Menos">−</button>
            <span>${item.cantidad}</span>
            <button type="button" class="btn-cantidad" data-mas="${item.key}" aria-label="Más"
              ${sinMasStock ? 'disabled title="No queda más stock"' : ''}>+</button>
          </div>
        ` : '<span class="carrito-item-unitario">×1 · ${formatCurrency(item.precio)}</span>'}
        <button type="button" class="carrito-btn-quitar" data-quitar="${item.key}" aria-label="Quitar ${item.nombre}">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </article>
  `
  }).join('')
}

function abrirModalCobro() {
  if (carrito.length === 0) return

  const total = calcularSubtotal()
  document.getElementById('cobro-total-monto').textContent = formatCurrency(total)
  document.getElementById('cobro-resumen-items').textContent =
    `${carrito.reduce((s, i) => s + i.cantidad, 0)} ítem(s)`

  const modal = document.getElementById('modal-cobro-caja')
  modal?.classList.add('activo')
  document.body.style.overflow = 'hidden'
}

function cerrarModalCobro() {
  document.getElementById('modal-cobro-caja')?.classList.remove('activo')
  document.body.style.overflow = ''
}

function confirmarCobro() {
  const total = calcularSubtotal()
  const clienteInput = document.getElementById('carrito-cliente')
  const usuarioId = obtenerUsuarioIdSesion()
  const empleadoId = obtenerEmpleadoIdSesion()

  const items = carrito.map((i) => ({
    tipo_item: i.tipo,
    referencia_id: i.id,
    descripcion: i.nombre,
    cantidad: i.cantidad,
    precio_unitario: i.precio,
    subtotal: Number((i.precio * i.cantidad).toFixed(2)),
  }))

  if (usuarioId && !empleadoId) {
    showNotification('El usuario actual no tiene un empleado asociado. Vinculalo desde Usuarios para registrar ventas.', 'error')
    return
  }

  if (!usuarioId) {
    showNotification('Sesion invalida. Volve a iniciar sesion para registrar ventas.', 'error')
    return
  }

  const restaurar = setBtnLoading(document.getElementById('btn-confirmar-cobro'))

  createCajaVenta({
    usuario_id: usuarioId,
    empleado_id: empleadoId,
    cliente_id: null,
    metodo_pago: metodoPagoSeleccionado,
    subtotal: total,
    descuento: 0,
    total,
    observaciones: clienteInput?.value.trim() || null,
    items,
  })
    .then((resultado) => {
      if (!resultado?.venta) {
        showNotification('No se pudo registrar la venta', 'error')
        return
      }
      cerrarModalCobro()
      carrito = []
      if (clienteInput) clienteInput.value = ''
      cerrarCarritoMobile()
      renderizarCarrito()
      renderizarEstadoCaja()
      renderizarVentasDia()
      showNotification(`Venta registrada — ${formatCurrency(total)} (${metodoPagoSeleccionado})`, 'success')
    })
    .catch(() => {
      showNotification('No se pudo registrar la venta', 'error')
    })
    .finally(() => restaurar())
}

function renderizarVentasDia() {
  const panel = document.getElementById('ventas-dia-lista')
  if (!panel) return

  const hoy = new Date().toISOString().slice(0, 10)
  const cargarVentas = fetchCajaVentas({ desde: `${hoy}T00:00:00.000Z`, hasta: `${hoy}T23:59:59.999Z` })

  cargarVentas.then((ventas) => {
  const registradas = ventas.filter((v) => (v.estado || 'registrada').toLowerCase() !== 'anulada')
  const countEl = document.getElementById('ventas-dia-count')
  if (countEl) countEl.textContent = registradas.length

  if (registradas.length === 0) {
    panel.innerHTML = '<p class="sin-resultados">Sin ventas registradas hoy</p>'
    return
  }

  panel.innerHTML = registradas.map((v) => {
    const fechaVenta = v.fecha_hora || v.fecha
    const hora = new Date(fechaVenta).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    const itemsTxt = (v.items || []).map((i) => `${i.cantidad}× ${i.descripcion || i.nombre}`).join(', ')
    return `
      <div class="venta-dia-item">
        <div class="venta-dia-detalle">
          <p>${itemsTxt}</p>
          <small>${hora} · ${(v.metodo_pago?.nombre || v.metodoPago || 'Efectivo')}${v.cliente ? ` · ${v.cliente.nombre || v.cliente}` : ''}</small>
        </div>
        <div class="venta-dia-total valor-tabular">${formatCurrency(v.total)}</div>
      </div>`
  }).join('')
  })
}

export async function refrescarCaja() {
  const dataProductos = await fetchProductos()
  productosCaja = (dataProductos?.productos || []).filter((p) => p.activo)
  document.getElementById('filtros-categoria-caja')?.removeAttribute('data-rendered')
  categoriaActiva = 'todas'
  cerrarCarritoMobile()
  renderizarCatalogoCaja()
  renderizarEstadoCaja()
  renderizarVentasDia()
}
