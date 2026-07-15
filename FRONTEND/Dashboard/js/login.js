// ===================================================
// login.js — Página de login independiente (login.html)
// ===================================================
import { API_BASE_URL } from './config.js?v=2'
import { guardarSesion, construirSesionDesdeRespuesta } from './auth.js'

function _leerHashParams() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  return new URLSearchParams(hash)
}

function _obtenerTokensRecuperacionDesdeUrl() {
  const hashParams = _leerHashParams()
  const searchParams = new URLSearchParams(window.location.search)
  const type = hashParams.get('type') || searchParams.get('type')
  const access_token = hashParams.get('access_token') || searchParams.get('access_token')
  const refresh_token = hashParams.get('refresh_token') || searchParams.get('refresh_token')

  if (type !== 'recovery' || !access_token || !refresh_token) return null
  return { access_token, refresh_token }
}

function _limpiarUrlRecuperacion() {
  const url = `${window.location.pathname}${window.location.search}`
  window.history.replaceState({}, document.title, url)
}

function _traducirErrorPassword(mensaje) {
  if (!mensaje) return null
  if (/different from the old password/i.test(mensaje)) {
    return 'La nueva contraseña debe ser diferente a la que usabas antes.'
  }
  if (/at least (\d+) character/i.test(mensaje)) {
    return 'La contraseña no cumple con los requisitos mínimos de seguridad.'
  }
  return mensaje
}

// ─────────────────────────────────────────────────
// FORMULARIO DE LOGIN
// ─────────────────────────────────────────────────
function _setupLoginForm() {
  const form       = document.getElementById('form-login')
  const btnToggle  = document.getElementById('toggle-login-password')
  const inputPw    = document.getElementById('login-password')
  const errorDiv   = document.getElementById('login-error')

  if (!form) return

  if (btnToggle && inputPw) {
    btnToggle.addEventListener('click', () => {
      const visible = inputPw.type === 'text'
      inputPw.type = visible ? 'password' : 'text'
      btnToggle.querySelector('i').className = visible ? 'fas fa-eye' : 'fas fa-eye-slash'
    })
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    const emailIngresado = document.getElementById('login-usuario').value.trim().toLowerCase()
    const passwordIngresada = inputPw ? inputPw.value : ''

    if (!emailIngresado) {
      if (errorDiv) {
        errorDiv.textContent = 'Ingresá tu correo electrónico'
        errorDiv.classList.add('visible')
      }
      return
    }

    let sesionData = null
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailIngresado, password: passwordIngresada }),
      })

      if (response.ok) {
        const data = await response.json()
        sesionData = construirSesionDesdeRespuesta(data.usuario, data.session)
      }
    } catch {
      sesionData = null
    }

    if (!sesionData) {
      if (errorDiv) {
        errorDiv.textContent = 'Correo o contraseña incorrectos'
        errorDiv.classList.add('visible')
        const card = document.querySelector('.login-card')
        if (card) {
          card.classList.add('shake')
          card.addEventListener('animationend', () => card.classList.remove('shake'), { once: true })
        }
      }
      return
    }

    if (errorDiv) errorDiv.classList.remove('visible')

    guardarSesion(sesionData)
    window.location.href = 'index.html'
  })
}

// ─────────────────────────────────────────────────
// RECUPERAR CONTRASEÑA
// ─────────────────────────────────────────────────
function _setupRecuperarPassword() {
  const linkRecuperar      = document.getElementById('link-recuperar')
  const linkVolver         = document.getElementById('link-volver-login')
  const formLogin          = document.getElementById('form-login')
  const headerPrincipal    = document.getElementById('login-header-principal')
  const panelRecuperar     = document.getElementById('panel-recuperar')
  const subtituloRecuperar = document.getElementById('recuperar-subtitulo')
  const paso1              = document.getElementById('recuperar-paso1')
  const paso2               = document.getElementById('recuperar-paso2')
  const errorDiv            = document.getElementById('recuperar-error')
  const error2Div           = document.getElementById('recuperar-error2')
  const btnEnviarMail       = document.getElementById('btn-enviar-mail')
  const btnConfirmar        = document.getElementById('btn-confirmar-recuperar')
  const inputNueva          = document.getElementById('recuperar-nueva')
  const inputConfirmar      = document.getElementById('recuperar-confirmar')
  const toggleNueva         = document.getElementById('toggle-recuperar-nueva')
  const toggleConfirmar     = document.getElementById('toggle-recuperar-confirmar')

  let recoveryTokens = _obtenerTokensRecuperacionDesdeUrl()

  if (!linkRecuperar || !panelRecuperar) return

  const _setupTogglePassword = (btnToggle, inputPw) => {
    if (!btnToggle || !inputPw) return
    btnToggle.addEventListener('click', () => {
      const visible = inputPw.type === 'text'
      inputPw.type = visible ? 'password' : 'text'
      btnToggle.querySelector('i').className = visible ? 'fas fa-eye' : 'fas fa-eye-slash'
    })
  }
  _setupTogglePassword(toggleNueva, inputNueva)
  _setupTogglePassword(toggleConfirmar, inputConfirmar)

  const mostrarError = (div, msg) => {
    div.textContent = msg
    div.classList.add('visible')
  }
  const limpiarError = (div) => div.classList.remove('visible')

  const mostrarRecuperar = () => {
    formLogin.style.display         = 'none'
    headerPrincipal.style.display   = 'none'
    panelRecuperar.style.display    = 'block'
    paso1.style.display             = 'block'
    paso2.style.display             = 'none'
    if (subtituloRecuperar) subtituloRecuperar.textContent = 'Ingresá tu mail y te enviamos las instrucciones'
    document.getElementById('recuperar-email').value = ''
    limpiarError(errorDiv)
    limpiarError(error2Div)
  }

  const mostrarResetConToken = () => {
    formLogin.style.display         = 'none'
    headerPrincipal.style.display   = 'none'
    panelRecuperar.style.display    = 'block'
    paso1.style.display             = 'none'
    paso2.style.display             = 'block'
    if (subtituloRecuperar) subtituloRecuperar.textContent = 'Definí tu nueva contraseña para continuar'
    if (inputNueva) inputNueva.value = ''
    if (inputConfirmar) inputConfirmar.value = ''
    limpiarError(errorDiv)
    limpiarError(error2Div)
  }

  const mostrarLogin = () => {
    panelRecuperar.style.display  = 'none'
    formLogin.style.display       = ''
    headerPrincipal.style.display = ''
  }

  linkRecuperar.addEventListener('click', (e) => { e.preventDefault(); mostrarRecuperar() })
  linkVolver.addEventListener('click',    (e) => {
    e.preventDefault()
    recoveryTokens = null
    _limpiarUrlRecuperacion()
    mostrarLogin()
  })

  // ── Paso 1: enviar recuperación real vía backend ──
  btnEnviarMail.addEventListener('click', async () => {
    const email = document.getElementById('recuperar-email').value.trim()
    limpiarError(errorDiv)

    if (!email) { mostrarError(errorDiv, 'Ingresá tu correo electrónico.'); return }
    try {
      const response = await fetch(`${API_BASE_URL}/auth/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!response.ok) throw new Error('No se pudo iniciar la recuperación.')

      mostrarLogin()
      const loginError = document.getElementById('login-error')
      if (loginError) {
        loginError.style.color = 'var(--c-completado, #16a34a)'
        loginError.textContent = '✓ Si el correo existe, se enviarán las instrucciones de recuperación.'
        loginError.classList.add('visible')
      }
    } catch {
      mostrarError(errorDiv, 'No se pudo iniciar la recuperación.');
    }
  })

  btnConfirmar?.addEventListener('click', async () => {
    limpiarError(error2Div)

    if (!recoveryTokens?.access_token || !recoveryTokens?.refresh_token) {
      mostrarError(error2Div, 'El enlace de recuperación no es válido o expiró. Pedí uno nuevo.')
      return
    }

    const nueva = inputNueva?.value || ''
    const confirmar = inputConfirmar?.value || ''

    if (!nueva || !confirmar) {
      mostrarError(error2Div, 'Completá ambos campos de contraseña.')
      return
    }

    if (nueva.length < 8) {
      mostrarError(error2Div, 'La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (nueva !== confirmar) {
      mostrarError(error2Div, 'Las contraseñas no coinciden.')
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: recoveryTokens.access_token,
          refresh_token: recoveryTokens.refresh_token,
          password: nueva,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(_traducirErrorPassword(data?.detalle) || data?.mensaje || 'No se pudo restablecer la contraseña.')
      }

      recoveryTokens = null
      _limpiarUrlRecuperacion()
      mostrarLogin()

      const loginError = document.getElementById('login-error')
      if (loginError) {
        loginError.style.color = 'var(--c-completado, #16a34a)'
        loginError.textContent = '✓ Contraseña actualizada. Ya podés iniciar sesión.'
        loginError.classList.add('visible')
      }
    } catch (err) {
      mostrarError(error2Div, err.message || 'No se pudo restablecer la contraseña. Solicitá un nuevo enlace.')
    }
  })

  if (recoveryTokens) {
    mostrarResetConToken()
  }
}

document.addEventListener('DOMContentLoaded', () => {
  _setupLoginForm()
  _setupRecuperarPassword()
})
