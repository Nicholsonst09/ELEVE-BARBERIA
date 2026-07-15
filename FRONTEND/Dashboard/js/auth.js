// ===================================================
// auth.js — Autenticación real contra backend + Supabase Auth
// La UI de login vive en login.html / js/login.js. Este módulo se encarga
// de la sesión, la validación contra el backend y los permisos del panel.
// ===================================================
import { confirmarAccion } from './utilidades.js'
import { API_BASE_URL } from './config.js?v=2'

const SESSION_KEY     = 'eleve_session'
const LOGIN_URL        = 'login.html'

// Módulos permitidos según rol
const MODULOS_POR_ROL = {
  admin:    ['agenda', 'financiero', 'clientes', 'servicios', 'caja', 'productos', 'negocio', 'empleados', 'usuarios'],
  empleado: ['agenda', 'caja'],
}

function _modulosParaRol(rol) {
  return MODULOS_POR_ROL[rol] || MODULOS_POR_ROL.empleado
}

/** Mantiene modulos al día si la sesión quedó guardada antes de agregar pestañas nuevas */
function _sincronizarSesion(sesion) {
  const actualizada = { ...sesion, modulos: _modulosParaRol(sesion.rol) }
  guardarSesion(actualizada)
  return actualizada
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

export function guardarSesion(datosUsuario) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(datosUsuario))
}

export function cerrarSesion() {
  sessionStorage.removeItem(SESSION_KEY)
  window.location.href = LOGIN_URL
}

function limpiarSesionSilenciosa() {
  sessionStorage.removeItem(SESSION_KEY)
}

// ─────────────────────────────────────────────────
// INICIALIZACIÓN — llama esto en main.js ANTES de
// cargar cualquier otro módulo. Si no hay sesión válida,
// redirige a login.html en lugar de mostrar un overlay.
// ─────────────────────────────────────────────────
async function obtenerPerfilActual(accessToken) {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) return null
  const data = await response.json()
  return data?.usuario || null
}

export function construirSesionDesdeRespuesta(usuario, session) {
  return {
    usuario: usuario.username || usuario.email,
    nombre: usuario.nombre,
    usuarioId: usuario.id,
    empleadoId: usuario.empleado_id || null,
    avatarUrl: usuario.empleado?.avatar_url || null,
    rol: usuario.tipo || usuario.rol,
    modulos: _modulosParaRol(usuario.tipo || usuario.rol),
    accessToken: session?.access_token || null,
    refreshToken: session?.refresh_token || null,
    expiresAt: session?.expires_at || null,
    email: usuario.email || null,
  }
}

export async function inicializarAuth() {
  _setupLogout()

  const sesion = obtenerSesion()

  if (!sesion?.accessToken) {
    window.location.replace(LOGIN_URL)
    return null
  }

  const usuario = await obtenerPerfilActual(sesion.accessToken)
  if (!usuario) {
    limpiarSesionSilenciosa()
    window.location.replace(LOGIN_URL)
    return null
  }

  const sesionActualizada = _sincronizarSesion({
    ...sesion,
    usuario: usuario.username || usuario.email,
    nombre: usuario.nombre,
    usuarioId: usuario.id,
    empleadoId: usuario.empleado_id || null,
    avatarUrl: usuario.empleado?.avatar_url || null,
    rol: usuario.tipo || usuario.rol,
  })
  _aplicarPermisos(sesionActualizada)
  _mostrarUsuarioEnHeader(sesionActualizada)
  return sesionActualizada
}

// ─────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────
function _setupLogout() {
  const manejarLogout = async () => {
    const ok = await confirmarAccion(
      'Tu sesión se cerrará y tendrás que volver a ingresar.',
      'Cerrar sesión',
      'Sí, salir'
    )
    if (ok) cerrarSesion()
  }

  document.getElementById('btn-logout')?.addEventListener('click', manejarLogout)
  document.getElementById('btn-logout-nav')?.addEventListener('click', manejarLogout)
}

// ─────────────────────────────────────────────────
// PERMISOS — mostrar/ocultar pestañas según rol
// ─────────────────────────────────────────────────
function _aplicarPermisos(sesion) {
  const botones = document.querySelectorAll('.boton-navegacion[data-tab]')
  const modulos = sesion.modulos || _modulosParaRol(sesion.rol)

  botones.forEach((btn) => {
    const tab = btn.dataset.tab
    if (modulos.includes(tab)) {
      btn.style.display = ''
      btn.removeAttribute('aria-hidden')
    } else {
      btn.style.display = 'none'
      btn.setAttribute('aria-hidden', 'true')
      const contenidoActivo = document.getElementById(tab)
      if (contenidoActivo && contenidoActivo.classList.contains('activo')) {
        const primerPermitido = modulos[0]
        _activarTab(primerPermitido, botones)
      }
    }
  })

  // Si un grupo del menú se quedó sin ítems visibles (ej: rol empleado),
  // ocultamos el grupo entero para no dejar un título flotando sin botones.
  // Los grupos sin pestañas propias (ej: Ver Reservas / Cerrar sesión) no
  // tienen data-tab y quedan afuera de este chequeo, siempre visibles.
  document.querySelectorAll('.grupo-navegacion').forEach((grupo) => {
    const botonesDelGrupo = grupo.querySelectorAll('.boton-navegacion[data-tab]')
    if (botonesDelGrupo.length === 0) return
    const tieneVisibles = Array.from(botonesDelGrupo).some((btn) => btn.style.display !== 'none')
    grupo.style.display = tieneVisibles ? '' : 'none'
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
  const avatarHtml = sesion.avatarUrl
    ? `<img src="${sesion.avatarUrl}" alt="" class="usuario-header-avatar">`
    : ''
  // Solo admin lleva insignia; empleado muestra únicamente el nombre.
  const badgeHtml = esAdmin
    ? `<span class="usuario-header-badge badge-admin">Admin</span>`
    : ''
  // El nombre siempre se muestra (aunque el usuario no tenga empleado asociado,
  // caso típico de un admin sin ficha de empleado); si por algún motivo llega
  // vacío, cae al usuario/email en vez de dejar el header en blanco.
  const nombreMostrado = sesion.nombre || sesion.usuario || sesion.email || 'Usuario'

  contenedor.innerHTML = `
    <div class="usuario-header-info">
      ${avatarHtml}
      <span class="usuario-header-nombre">${nombreMostrado}</span>
      ${badgeHtml}
    </div>
  `
}
