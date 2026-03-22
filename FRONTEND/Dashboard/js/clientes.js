import { estado } from "./estado.js"
import { showNotification, confirmarAccion, setBtnLoading } from "./utilidades.js"
import { fetchClientes, updateCliente, deleteCliente } from "./api.js"

let clientesFiltrados = []

export async function inicializarClientes() {
  await cargarClientes()
  setupClientesEventListeners()
  renderizarClientes()
  actualizarMetricasClientes()
}

async function cargarClientes() {
  try {
    estado.clientes = await fetchClientes()
    clientesFiltrados = [...estado.clientes]
  } catch (error) {
    console.error("Error al cargar clientes", error)
    showNotification("Error al cargar clientes", "error")
  }
}

function setupClientesEventListeners() {
  const buscadorClientes = document.getElementById("buscador-clientes")
  if (buscadorClientes) {
    buscadorClientes.addEventListener("input", (e) => {
      const termino = e.target.value.toLowerCase()
      clientesFiltrados = estado.clientes.filter(
        (cliente) =>
          cliente.nombre.toLowerCase().includes(termino) ||
          cliente.telefono.toLowerCase().includes(termino) ||
          (cliente.preferencias && cliente.preferencias.toLowerCase().includes(termino)),
      )
      renderizarClientes()
    })
  }

  const btnNuevoCliente = document.getElementById("btn-nuevo-cliente")
  if (btnNuevoCliente) {
    btnNuevoCliente.addEventListener("click", () => {
      abrirModalCliente()
    })
  }
  
  const btnCerrarModal = document.querySelector('#modal-cliente .cerrar-modal')
  if (btnCerrarModal) {
    btnCerrarModal.addEventListener('click', cerrarModalCliente)
  }

  const formCliente = document.getElementById('form-cliente')
  if (formCliente) {
    formCliente.addEventListener('submit', guardarCliente)
  }
}

function renderizarClientes() {
  const listaClientes = document.getElementById('lista-clientes')
  if (!listaClientes) return

  if (clientesFiltrados.length === 0) {
    listaClientes.innerHTML = '<p class="sin-resultados">No hay clientes registrados</p>'
    return
  }

  listaClientes.innerHTML = clientesFiltrados.map(cliente => `
    <div class="elemento-lista" data-id="${cliente.id}">
      <div class="info-elemento">
        <h4>${cliente.nombre}</h4>
        <p>${cliente.telefono || 'Sin teléfono'}</p>
        ${cliente.preferencias ? `<small>${cliente.preferencias}</small>` : ''}
      </div>
      <div class="acciones-elemento">
        <button class="boton-icono editar" data-cliente-id="${cliente.id}" title="Editar">
          <i class="fas fa-pencil-alt"></i>
        </button>
        <button class="boton-icono eliminar" data-cliente-id="${cliente.id}" title="Eliminar">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </div>
  `).join('')

  listaClientes.querySelectorAll('.boton-icono').forEach(btn => {
    btn.addEventListener('click', () => {
      const clienteId = parseInt(btn.dataset.clienteId)
      if (btn.classList.contains('editar')) {
        abrirModalCliente(clienteId)
      } else if (btn.classList.contains('eliminar')) {
        eliminarClienteConfirm(clienteId)
      }
    })
  })
}

export function abrirModalCliente(clienteId = null) {
  const modal = document.getElementById("modal-cliente")
  const titulo = document.getElementById("titulo-modal-cliente")
  const form = document.getElementById("form-cliente")

  if (clienteId) {
    const cliente = estado.clientes.find((c) => c.id === clienteId)
    if (!cliente) return

    titulo.textContent = "Editar Cliente"
    document.getElementById("cliente-id").value = cliente.id
    document.getElementById("cliente-nombre").value = cliente.nombre
    document.getElementById("cliente-telefono").value = cliente.telefono
    document.getElementById("cliente-notas").value = cliente.preferencias || ""
  } else {
    titulo.textContent = "Nuevo Cliente"
    form.reset()
    document.getElementById("cliente-id").value = ""
  }

  modal.classList.add("activo")
  document.body.style.overflow = "hidden"
}

export function cerrarModalCliente() {
  const modal = document.getElementById("modal-cliente")
  modal.classList.remove("activo")
  document.body.style.overflow = ""
}

export async function guardarCliente(e) {
  e.preventDefault()

  const btn = e.target.closest('form')?.querySelector('[type="submit"]') ||
               document.querySelector('#modal-cliente [type="submit"]')
  const restaurar = setBtnLoading(btn)

  const clienteData = {
    id: document.getElementById("cliente-id").value || null,
    nombre: document.getElementById("cliente-nombre").value.trim(),
    telefono: document.getElementById("cliente-telefono").value.trim(),
    preferencias: document.getElementById("cliente-notas").value.trim(),
  }

  const resultado = await updateCliente(clienteData)
  restaurar()
  if (resultado) {
    showNotification(clienteData.id ? "Cliente actualizado correctamente" : "Cliente creado correctamente", "success")
    cerrarModalCliente()
    await cargarClientes()
    renderizarClientes()
    actualizarMetricasClientes()
  } else {
    showNotification("Error al guardar cliente", "error")
  }
}

export async function eliminarClienteConfirm(clienteId) {
  const ok = await confirmarAccion(
    '¿Estás seguro? Se eliminará el cliente y todos sus turnos asociados. Esta acción no se puede deshacer.',
    'Eliminar cliente',
    'Sí, eliminar'
  )
  if (!ok) return

  const resultado = await deleteCliente(clienteId)
  if (resultado) {
    showNotification("Cliente eliminado correctamente", "success")
    await cargarClientes()
    renderizarClientes()
    actualizarMetricasClientes()
  } else {
    showNotification("Error al eliminar cliente", "error")
  }
}

function actualizarMetricasClientes() {
  const clientes = estado.clientes || [];
  const totalClientes = clientes.length;
  
  // Datos simulados - reemplazar con datos reales del backend
  const clientesMes = 8;
  const clientesFrecuentes = 12;

  const totalClientesEl = document.getElementById('total-clientes');
  const clientesMesEl = document.getElementById('clientes-mes');
  const clientesFrecuentesEl = document.getElementById('clientes-frecuentes');

  if (totalClientesEl) totalClientesEl.textContent = totalClientes;
  if (clientesMesEl) clientesMesEl.textContent = clientesMes;
  if (clientesFrecuentesEl) clientesFrecuentesEl.textContent = clientesFrecuentes;
}