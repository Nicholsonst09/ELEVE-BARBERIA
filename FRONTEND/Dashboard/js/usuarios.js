import { showNotification, confirmarAccion } from './utilidades.js'

// ───────────────────────────────────────────────
// PERSISTENCIA LOCAL (localStorage)
// ───────────────────────────────────────────────
const LS_KEY        = 'eleve_usuarios'
const LS_SEEDED_KEY = 'eleve_db_seeded'

function cargarDesdeStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function guardarEnStorage(usuarios) {
  localStorage.setItem(LS_KEY, JSON.stringify(usuarios))
}

// Estado local del módulo
let usuarios = cargarDesdeStorage()
let usuariosFiltrados = [...usuarios]

// ───────────────────────────────────────────────
// SIEMBRA INICIAL DESDE JSON (simula BD)
// Solo ocurre la primera vez (flag en localStorage)
// ───────────────────────────────────────────────
async function sembrarDesdeJSON() {
  if (localStorage.getItem(LS_SEEDED_KEY)) return
  try {
    const res   = await fetch('./data/usuarios.json')
    const datos = await res.json()
    guardarEnStorage(datos)
    localStorage.setItem(LS_SEEDED_KEY, '1')
    usuarios          = datos
    usuariosFiltrados = [...datos]
  } catch (e) {
    console.warn('[Eleve] No se pudo cargar usuarios.json:', e)
  }
}

// ───────────────────────────────────────────────
// INICIALIZACIÓN
// ───────────────────────────────────────────────
export async function inicializarUsuarios() {
  await sembrarDesdeJSON()
  usuarios          = cargarDesdeStorage()
  usuariosFiltrados = [...usuarios]
  setupEventListeners()
  renderizarUsuarios()
  renderizarMetricas()
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
  if (btnCancelar) btnCancelar.addEventListener('click', cerrarModal)

  // Cerrar al hacer clic en fondo oscuro
  const modal = document.getElementById('modal-usuario')
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cerrarModal()
    })
  }

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
          ${u.username ? `<p>@${u.username}</p>` : ''}
        </div>
        <div class="acciones-elemento">
          <button class="boton-icono" data-id="${u.id}" data-accion="editar" title="Editar">
            <i class="fas fa-pencil-alt"></i>
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
      const id = btn.dataset.id
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

  form.reset()
  // Resetear visibilidad de contraseña
  if (inputPass) inputPass.type = 'password'
  const icon = document.querySelector('#toggle-password-usuario i')
  if (icon) icon.className = 'fas fa-eye'

  if (id) {
    const usuario = usuarios.find((u) => u.id === id)
    if (!usuario) return

    titulo.textContent = 'Editar Usuario'
    if (labelPass) labelPass.textContent = 'Nueva Contraseña (dejar vacío para no cambiar)'
    if (inputPass) inputPass.removeAttribute('required')

    document.getElementById('usuario-id').value       = usuario.id
    document.getElementById('usuario-nombre').value   = usuario.nombre
    document.getElementById('usuario-username').value = usuario.username || ''
    document.getElementById('usuario-email').value    = usuario.email  || ''
    document.getElementById('usuario-tipo').value     = usuario.tipo
  } else {
    titulo.textContent = 'Nuevo Usuario'
    if (labelPass) labelPass.textContent = 'Contraseña'
    if (inputPass) inputPass.setAttribute('required', '')
    document.getElementById('usuario-id').value       = ''
    document.getElementById('usuario-username').value = ''
  }

  modal.classList.add('activo')
  document.body.style.overflow = 'hidden'
}

function cerrarModal() {
  const modal = document.getElementById('modal-usuario')
  if (modal) modal.classList.remove('activo')
  document.body.style.overflow = ''
}

// ───────────────────────────────────────────────
// GUARDAR (CREAR / ACTUALIZAR)
// ───────────────────────────────────────────────
async function guardarUsuario(e) {
  e.preventDefault()

  const id       = document.getElementById('usuario-id').value
  const nombre   = document.getElementById('usuario-nombre').value.trim()
  const username = document.getElementById('usuario-username').value.trim().toLowerCase()
  const email    = document.getElementById('usuario-email').value.trim()
  const password = document.getElementById('usuario-password').value
  const tipo     = document.getElementById('usuario-tipo').value

  if (!nombre || !tipo || !username) {
    showNotification('Nombre, usuario y tipo son obligatorios', 'error')
    return
  }

  // Validar que el username no esté tomado por otro usuario
  const duplicado = usuarios.find((u) => u.username === username && u.id !== id)
  if (duplicado) {
    showNotification(`El nombre de usuario "${username}" ya está en uso`, 'error')
    return
  }

  const esEdicion = !!id

  if (!esEdicion && !password) {
    showNotification('La contraseña es obligatoria al crear un usuario', 'error')
    return
  }

  if (esEdicion) {
    // Actualizar
    const idx = usuarios.findIndex((u) => u.id === id)
    if (idx === -1) return

    usuarios[idx] = {
      ...usuarios[idx],
      nombre,
      username,
      email,
      tipo,
      modificado: new Date().toISOString(),
      // Solo actualiza la contraseña si se ingresó una nueva
      ...(password ? { passwordHash: btoa(password) } : {}),
    }

    showNotification('Usuario actualizado correctamente', 'success')
  } else {
    // Crear nuevo
    const nuevoUsuario = {
      id:           crypto.randomUUID(),
      nombre,
      username,
      email,
      tipo,
      passwordHash: btoa(password), // Codificación básica (no criptografía real)
      creado:       new Date().toISOString(),
      modificado:   new Date().toISOString(),
    }
    usuarios.push(nuevoUsuario)
    showNotification('Usuario creado correctamente', 'success')
  }

  guardarEnStorage(usuarios)
  usuariosFiltrados = [...usuarios]
  cerrarModal()
  renderizarUsuarios()
  renderizarMetricas()
}

// ───────────────────────────────────────────────
// ELIMINAR
// ───────────────────────────────────────────────
async function confirmarEliminar(id) {
  const usuario = usuarios.find((u) => u.id === id)
  if (!usuario) return

  const ok = await confirmarAccion(
    `¿Eliminar al usuario "${usuario.nombre}"? Esta acción no se puede deshacer.`,
    'Eliminar usuario',
    'Sí, eliminar'
  )
  if (!ok) return

  usuarios = usuarios.filter((u) => u.id !== id)
  usuariosFiltrados = usuariosFiltrados.filter((u) => u.id !== id)
  guardarEnStorage(usuarios)
  renderizarUsuarios()
  renderizarMetricas()
  showNotification('Usuario eliminado correctamente', 'success')
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
