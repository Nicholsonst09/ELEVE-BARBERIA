import { showNotification, confirmarAccion, capturarValoresFormulario, restaurarValoresFormulario, setBtnLoading } from './utilidades.js'
import { fetchProfesionales } from './api.js'
import { fetchUsuarios, createUsuario, updateUsuario, deleteUsuario } from './api.js'
import { estado } from './estado.js'

// Estado local del módulo
let usuarios = []
let usuariosFiltrados = [...usuarios]
let empleadosDisponibles = []

// Borrador por usuario (clave = id, o 'nuevo') para no perder lo tipeado si el
// modal se cierra sin guardar. Las contraseñas quedan afuera a propósito.
const CAMPOS_USUARIO = ['usuario-nombre', 'usuario-email', 'usuario-tipo', 'usuario-empleado-id']
const _borradoresUsuario = {}

// ───────────────────────────────────────────────
// INICIALIZACIÓN
// ───────────────────────────────────────────────
export async function inicializarUsuarios() {
  empleadosDisponibles = await fetchProfesionales().catch(() => [])
  usuarios          = await fetchUsuarios()
  usuariosFiltrados = [...usuarios]
  setupEventListeners()
  renderizarUsuarios()
  renderizarMetricas()
}

function poblarSelectEmpleados(empleadoIdSeleccionado = '') {
  const select = document.getElementById('usuario-empleado-id')
  if (!select) return

  const opciones = ['<option value="">Sin asignar</option>']
  empleadosDisponibles.forEach((empleado) => {
    opciones.push(`<option value="${empleado.id}">${empleado.nombre}</option>`)
  })
  select.innerHTML = opciones.join('')

  const valor = String(empleadoIdSeleccionado || '')
  if (valor) select.value = valor
}

// ───────────────────────────────────────────────
// EVENT LISTENERS
// ───────────────────────────────────────────────
function setupEventListeners() {
  // Buscador
  const buscador = document.getElementById('buscador-usuarios')
  if (buscador) {
    buscador.addEventListener('input', (e) => {
      const termino = e.target.value.toLowerCase()
      usuariosFiltrados = usuarios.filter(
        (u) =>
          u.nombre.toLowerCase().includes(termino) ||
          u.tipo.toLowerCase().includes(termino)
      )
      renderizarUsuarios()
    })
  }

  // Botón nuevo usuario
  const btnNuevo = document.getElementById('btn-nuevo-usuario')
  if (btnNuevo) btnNuevo.addEventListener('click', () => abrirModal())

  // Cerrar modal
  const btnCerrar = document.querySelector('#modal-usuario .cerrar-modal')
  if (btnCerrar) btnCerrar.addEventListener('click', cerrarModal)

  const btnCancelar = document.querySelector('.btn-cancelar-usuario')
  if (btnCancelar) btnCancelar.addEventListener('click', cancelarModal)

  // Submit del formulario
  const form = document.getElementById('form-usuario')
  if (form) form.addEventListener('submit', guardarUsuario)

  // Toggle contraseña (visualizar/ocultar)
  const btnToggle = document.getElementById('toggle-password-usuario')
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      const input = document.getElementById('usuario-password')
      const icon  = btnToggle.querySelector('i')
      if (input.type === 'password') {
        input.type = 'text'
        icon.className = 'fas fa-eye-slash'
      } else {
        input.type = 'password'
        icon.className = 'fas fa-eye'
      }
    })
  }

  const btnToggleActual = document.getElementById('toggle-password-actual-usuario')
  if (btnToggleActual) {
    btnToggleActual.addEventListener('click', () => {
      const input = document.getElementById('usuario-password-actual')
      const icon  = btnToggleActual.querySelector('i')
      if (!input || !icon) return
      if (input.type === 'password') {
        input.type = 'text'
        icon.className = 'fas fa-eye-slash'
      } else {
        input.type = 'password'
        icon.className = 'fas fa-eye'
      }
    })
  }
}

// ───────────────────────────────────────────────
// RENDERIZADO DE LISTA
// ───────────────────────────────────────────────
function renderizarUsuarios() {
  const lista = document.getElementById('lista-usuarios')
  if (!lista) return

  if (usuariosFiltrados.length === 0) {
    lista.innerHTML = '<p class="sin-resultados">No hay usuarios registrados</p>'
    return
  }

  lista.innerHTML = usuariosFiltrados.map((u) => {
    const iniciales = obtenerIniciales(u.nombre)
    const esAdmin   = u.tipo === 'admin'
    const badgeClase = esAdmin ? 'badge-admin' : 'badge-empleado'
    const badgeTexto = esAdmin ? 'Admin' : 'Empleado'

    return `
      <div class="elemento-lista">
        <div class="info-elemento">
          <div class="nombre-con-estado">
            <h4>${u.nombre}</h4>
            <span class="badge-tipo-usuario ${badgeClase}">${badgeTexto}</span>
          </div>
        </div>
        <div class="acciones-elemento">
          <button class="boton-icono" data-id="${u.id}" data-accion="editar" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="boton-icono eliminar" data-id="${u.id}" data-accion="eliminar" title="Eliminar">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    `
  }).join('')

  // Delegación de eventos en la lista
  lista.querySelectorAll('[data-accion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id)
      if (!Number.isInteger(id) || id <= 0) return
      if (btn.dataset.accion === 'editar') abrirModal(id)
      if (btn.dataset.accion === 'eliminar') confirmarEliminar(id)
    })
  })
}

// ───────────────────────────────────────────────
// MÉTRICAS
// ───────────────────────────────────────────────
function renderizarMetricas() {
  const total  = usuarios.length
  const admins = usuarios.filter((u) => u.tipo === 'admin').length
  const emps   = usuarios.filter((u) => u.tipo === 'empleado').length

  const elTotal  = document.getElementById('total-usuarios')
  const elAdmins = document.getElementById('total-admins')
  const elEmps   = document.getElementById('total-empleados-usuarios')

  if (elTotal)  elTotal.textContent  = total
  if (elAdmins) elAdmins.textContent = admins
  if (elEmps)   elEmps.textContent   = emps
}

// ───────────────────────────────────────────────
// MODAL — ABRIR / CERRAR
// ───────────────────────────────────────────────
function abrirModal(id = null) {
  const modal  = document.getElementById('modal-usuario')
  const titulo = document.getElementById('titulo-modal-usuario')
  const form   = document.getElementById('form-usuario')
  const labelPass = document.getElementById('label-password-usuario')
  const inputPass = document.getElementById('usuario-password')
  const grupoPasswordActual = document.getElementById('grupo-password-actual-usuario')
  const inputPassActual = document.getElementById('usuario-password-actual')

  form.reset()
  poblarSelectEmpleados()
  // Resetear visibilidad de contraseña
  if (inputPass) inputPass.type = 'password'
  const icon = document.querySelector('#toggle-password-usuario i')
  if (icon) icon.className = 'fas fa-eye'
  if (inputPassActual) inputPassActual.type = 'password'
  const iconActual = document.querySelector('#toggle-password-actual-usuario i')
  if (iconActual) iconActual.className = 'fas fa-eye'
  if (inputPassActual) inputPassActual.removeAttribute('required')

  if (id) {
    const idNum = Number(id)
    const usuario = usuarios.find((u) => Number(u.id) === idNum)
    if (!usuario) return

    titulo.textContent = 'Editar Usuario'
    if (labelPass) labelPass.textContent = 'Nueva Contraseña (dejar vacío para no cambiar)'
    if (inputPass) inputPass.removeAttribute('required')
    if (grupoPasswordActual) grupoPasswordActual.style.display = ''

    document.getElementById('usuario-id').value       = usuario.id
    document.getElementById('usuario-nombre').value   = usuario.nombre
    document.getElementById('usuario-email').value    = usuario.email  || ''
    document.getElementById('usuario-tipo').value     = usuario.tipo
    document.getElementById('usuario-empleado-id').value = usuario.empleado_id || ''
  } else {
    titulo.textContent = 'Nuevo Usuario'
    if (labelPass) labelPass.textContent = 'Contraseña'
    if (inputPass) inputPass.setAttribute('required', '')
    if (grupoPasswordActual) grupoPasswordActual.style.display = 'none'
    document.getElementById('usuario-id').value       = ''
    document.getElementById('usuario-empleado-id').value = ''
  }

  restaurarValoresFormulario(_borradoresUsuario[String(id || 'nuevo')])

  modal.classList.add('activo')
  document.body.style.overflow = 'hidden'
}

function cerrarModal() {
  const idActual = document.getElementById('usuario-id')?.value || 'nuevo'
  _borradoresUsuario[idActual] = capturarValoresFormulario(CAMPOS_USUARIO)
  _ocultarModal()
}

// Oculta el modal sin capturar borrador (se usa tras guardar con éxito).
function _ocultarModal() {
  const modal = document.getElementById('modal-usuario')
  if (modal) modal.classList.remove('activo')
  document.body.style.overflow = ''
}

// "Cancelar" es una acción explícita de descarte: a diferencia de la X, borra
// cualquier borrador pendiente para este formulario.
function cancelarModal() {
  const idActual = document.getElementById('usuario-id')?.value || 'nuevo'
  delete _borradoresUsuario[idActual]
  _ocultarModal()
}

// ───────────────────────────────────────────────
// GUARDAR (CREAR / ACTUALIZAR)
// ───────────────────────────────────────────────
async function guardarUsuario(e) {
  e.preventDefault()

  const idValor  = document.getElementById('usuario-id').value
  const id       = idValor ? Number(idValor) : null
  const nombre   = document.getElementById('usuario-nombre').value.trim()
  const email    = document.getElementById('usuario-email').value.trim().toLowerCase()
  const passwordActual = document.getElementById('usuario-password-actual')?.value || ''
  const passwordNueva = document.getElementById('usuario-password').value
  const tipo     = document.getElementById('usuario-tipo').value
  const empleadoIdValor = document.getElementById('usuario-empleado-id').value
  const empleado_id = empleadoIdValor ? Number(empleadoIdValor) : null

  if (!nombre || !email || !tipo) {
    showNotification('Nombre, email y tipo son obligatorios', 'error')
    return
  }

  if (tipo === 'empleado' && !empleado_id) {
    showNotification('Los usuarios de tipo empleado deben estar asociados a un empleado', 'error')
    return
  }

  if (empleadoIdValor && !Number.isInteger(empleado_id)) {
    showNotification('El empleado asociado no es válido', 'error')
    return
  }

  // Validar que el email no esté tomado por otro usuario
  const duplicado = usuarios.find((u) => (u.email || '').toLowerCase() === email && Number(u.id) !== Number(id || 0))
  if (duplicado) {
    showNotification(`El email "${email}" ya está en uso`, 'error')
    return
  }

  const esEdicion = Number.isInteger(id) && id > 0

  if (!esEdicion && !passwordNueva) {
    showNotification('La contraseña es obligatoria al crear un usuario', 'error')
    return
  }

  if (esEdicion && passwordNueva && !passwordActual) {
    showNotification('Para cambiar la contraseña, ingresá la contraseña actual', 'error')
    return
  }

  if (esEdicion && passwordActual && !passwordNueva) {
    showNotification('Ingresá la nueva contraseña para completar el cambio', 'error')
    return
  }

  const payload = {
    nombre,
    email,
    tipo,
    empleado_id,
    ...(passwordNueva ? { password: passwordNueva } : {}),
    ...(esEdicion && passwordActual ? { password_actual: passwordActual, current_password: passwordActual } : {}),
    ...(esEdicion && passwordNueva ? { password_nueva: passwordNueva, new_password: passwordNueva } : {}),
  }

  const btn = e.target.closest('form')?.querySelector('[type="submit"]') ||
               document.querySelector('#modal-usuario [type="submit"]')
  const restaurar = setBtnLoading(btn)

  const resultado = esEdicion
    ? await updateUsuario(id, payload)
    : await createUsuario(payload)

  restaurar()
  if (!resultado) {
    showNotification(estado.error || `No se pudo ${esEdicion ? 'actualizar' : 'crear'} el usuario`, 'error')
    return
  }

  delete _borradoresUsuario[id || 'nuevo']
  usuarios = await fetchUsuarios()
  usuariosFiltrados = [...usuarios]
  _ocultarModal()
  renderizarUsuarios()
  renderizarMetricas()
  showNotification(esEdicion ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente', 'success')
}

// ───────────────────────────────────────────────
// ELIMINAR
// ───────────────────────────────────────────────
async function confirmarEliminar(id) {
  const idNum = Number(id)
  if (!Number.isInteger(idNum) || idNum <= 0) return

  const usuario = usuarios.find((u) => Number(u.id) === idNum)
  if (!usuario) return

  const ok = await confirmarAccion(
    `¿Eliminar al usuario "${usuario.nombre}"? Esta acción no se puede deshacer.`,
    'Eliminar usuario',
    'Sí, eliminar'
  )
  if (!ok) return

  const resultado = await deleteUsuario(idNum)
  if (!resultado) {
    showNotification('No se pudo desactivar el usuario', 'error')
    return
  }

  usuarios = await fetchUsuarios()
  usuariosFiltrados = [...usuarios]
  renderizarUsuarios()
  renderizarMetricas()
  showNotification('Usuario desactivado correctamente', 'success')
}

// ───────────────────────────────────────────────
// UTILIDADES
// ───────────────────────────────────────────────
function obtenerIniciales(nombre) {
  return nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

function formatearFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}
