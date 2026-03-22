// ===================================================
// auth.js — Sistema de autenticación (DEMO / FRONTEND)
// TODO: reemplazar lógica por JWT real en producción
// ===================================================
import { confirmarAccion } from './utilidades.js'

const SESSION_KEY     = 'eleve_session'
const LS_USUARIOS_KEY = 'eleve_usuarios'

// Módulos permitidos según rol
const MODULOS_POR_ROL = {
  admin:    ['agenda', 'financiero', 'clientes', 'servicios', 'empleados', 'usuarios'],
  empleado: ['agenda', 'clientes'],
}

// ─────────────────────────────────────────────────
// HELPERS DE SESIÓN (sessionStorage → se borra al cerrar pestaña)
// ─────────────────────────────────────────────────
export function obtenerSesion() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function guardarSesion(datosUsuario) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(datosUsuario))
}

export function cerrarSesion() {
  sessionStorage.removeItem(SESSION_KEY)
  location.reload()
}

// ─────────────────────────────────────────────────
// INICIALIZACIÓN — llama esto en main.js ANTES de
// cargar cualquier otro módulo
// ─────────────────────────────────────────────────
export function inicializarAuth() {
  const sesion = obtenerSesion()

  if (sesion) {
    // Ya hay sesión activa: ocultar overlay y aplicar permisos
    _ocultarOverlay()
    _aplicarPermisos(sesion)
    _mostrarUsuarioEnHeader(sesion)
  } else {
    // Sin sesión: mostrar overlay de login
    _mostrarOverlay()
  }

  _setupLoginForm()
  _setupLogout()
}

// ─────────────────────────────────────────────────
// MOSTRAR / OCULTAR OVERLAY
// ─────────────────────────────────────────────────
function _mostrarOverlay() {
  const overlay = document.getElementById('login-overlay')
  if (overlay) overlay.classList.add('activo')
  document.body.style.overflow = 'hidden'
}

function _ocultarOverlay() {
  const overlay = document.getElementById('login-overlay')
  if (overlay) overlay.classList.remove('activo')
  document.body.style.overflow = ''
}

// ─────────────────────────────────────────────────
// FORMULARIO DE LOGIN
// ─────────────────────────────────────────────────
function _setupLoginForm() {
  const form    = document.getElementById('form-login')
  const btnToggle = document.getElementById('toggle-login-password')
  const inputPw   = document.getElementById('login-password')
  const errorDiv  = document.getElementById('login-error')

  if (!form) return

  // Toggle visibilidad contraseña
  if (btnToggle && inputPw) {
    btnToggle.addEventListener('click', () => {
      const visible = inputPw.type === 'text'
      inputPw.type = visible ? 'password' : 'text'
      btnToggle.querySelector('i').className = visible ? 'fas fa-eye' : 'fas fa-eye-slash'
    })
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()

    const usuarioIngresado  = document.getElementById('login-usuario').value.trim()
    const passwordIngresada = inputPw ? inputPw.value : ''

    // Buscar en la "BD" (localStorage, sembrado desde usuarios.json)
    let sesionData = null
    try {
      const raw = localStorage.getItem(LS_USUARIOS_KEY)
      const storedUsers = raw ? JSON.parse(raw) : []
      const match = storedUsers.find(
        (u) => u.username === usuarioIngresado &&
               u.passwordHash &&
               atob(u.passwordHash) === passwordIngresada
      )
      if (match) {
        sesionData = {
          usuario: match.username,
          nombre:  match.nombre,
          rol:     match.tipo,
          modulos: MODULOS_POR_ROL[match.tipo] || MODULOS_POR_ROL.empleado,
        }
      }
    } catch { /* localStorage inaccesible */ }

    if (!sesionData) {
      if (errorDiv) {
        errorDiv.textContent = 'Usuario o contraseña incorrectos'
        errorDiv.classList.add('visible')
        // Shake en la tarjeta
        const card = document.querySelector('.login-card')
        if (card) {
          card.classList.add('shake')
          card.addEventListener('animationend', () => card.classList.remove('shake'), { once: true })
        }
      }
      return
    }

    // Credenciales correctas
    if (errorDiv) errorDiv.classList.remove('visible')

    guardarSesion(sesionData)

    // Animación de exit antes de ocultar
    const overlay = document.getElementById('login-overlay')
    if (overlay) {
      overlay.classList.add('saliendo')
      overlay.addEventListener('animationend', () => {
        _ocultarOverlay()
        overlay.classList.remove('saliendo')
        _aplicarPermisos(sesionData)
        _mostrarUsuarioEnHeader(sesionData)
      }, { once: true })
    }
  })
}

// ─────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────
function _setupLogout() {
  const btnLogout = document.getElementById('btn-logout')
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      const ok = await confirmarAccion(
        'Tu sesión se cerrará y tendrás que volver a ingresar.',
        'Cerrar sesión',
        'Sí, salir'
      )
      if (ok) cerrarSesion()
    })
  }
}

// ─────────────────────────────────────────────────
// PERMISOS — mostrar/ocultar pestañas según rol
// ─────────────────────────────────────────────────
function _aplicarPermisos(sesion) {
  const botones = document.querySelectorAll('.boton-navegacion[data-tab]')

  botones.forEach((btn) => {
    const tab = btn.dataset.tab
    if (sesion.modulos.includes(tab)) {
      btn.style.display = ''
    } else {
      btn.style.display = 'none'
      // Si la pestaña activa ahora no está permitida, redirigir a la primera permitida
      const contenidoActivo = document.getElementById(tab)
      if (contenidoActivo && contenidoActivo.classList.contains('activo')) {
        const primerPermitido = sesion.modulos[0]
        _activarTab(primerPermitido, botones)
      }
    }
  })
}

function _activarTab(tabId, botones) {
  // Ocultar todas las pestañas
  document.querySelectorAll('.contenido-pestana').forEach((p) => p.classList.remove('activo'))
  botones.forEach((b) => b.classList.remove('activo'))

  // Activar la solicitada
  const contenido = document.getElementById(tabId)
  if (contenido) contenido.classList.add('activo')

  const btnTarget = Array.from(botones).find((b) => b.dataset.tab === tabId)
  if (btnTarget) btnTarget.classList.add('activo')
}

// ─────────────────────────────────────────────────
// UI HEADER — nombre de usuario y badge de rol
// ─────────────────────────────────────────────────
function _mostrarUsuarioEnHeader(sesion) {
  const contenedor = document.getElementById('info-usuario-header')
  if (!contenedor) return

  const esAdmin = sesion.rol === 'admin'
  contenedor.innerHTML = `
    <div class="usuario-header-info">
      <span class="usuario-header-nombre">${sesion.nombre}</span>
      <span class="usuario-header-badge ${esAdmin ? 'badge-admin' : 'badge-empleado'}">
        ${esAdmin ? 'Admin' : 'Empleado'}
      </span>
    </div>
  `
}
