// ===================================================
// db.js — Capa de persistencia local (DEMO)
// Simula una BD usando localStorage + JSON seed.
// TODO: cuando el backend esté listo, reemplazar cada
//       función por la llamada real a la API y borrar este archivo.
// ===================================================

const LS_KEYS = {
  clientes:  'eleve_clientes',
  servicios: 'eleve_servicios',
  empleados: 'eleve_empleados',
}

const SEED_FLAGS = {
  clientes:  'eleve_db_seeded_clientes',
  servicios: 'eleve_db_seeded_servicios',
  empleados: 'eleve_db_seeded_empleados',
}

// ─── Helpers genéricos ───────────────────────────────────────────
function leer(coleccion) {
  try { return JSON.parse(localStorage.getItem(LS_KEYS[coleccion]) || '[]') }
  catch { return [] }
}

function escribir(coleccion, datos) {
  localStorage.setItem(LS_KEYS[coleccion], JSON.stringify(datos))
}

function siguienteId(datos) {
  if (!datos.length) return 1
  return Math.max(...datos.map(d => Number(d.id) || 0)) + 1
}

async function sembrar(coleccion) {
  if (localStorage.getItem(SEED_FLAGS[coleccion])) return
  try {
    const res   = await fetch(`./data/${coleccion}.json`)
    const datos = await res.json()
    escribir(coleccion, datos)
    localStorage.setItem(SEED_FLAGS[coleccion], '1')
  } catch (e) {
    console.warn(`[Eleve DB] No se pudo sembrar ${coleccion}:`, e)
  }
}

// ─── Siembra inicial (llamar antes de cualquier lectura) ──────────
export async function sembrarDB() {
  await Promise.all([
    sembrar('clientes'),
    sembrar('servicios'),
    sembrar('empleados'),
  ])
}

// ─── CLIENTES ────────────────────────────────────────────────────
export function dbGetClientes() {
  return leer('clientes')
}

export function dbSaveCliente(data) {
  const todos = leer('clientes')
  if (data.id) {
    const idx = todos.findIndex(c => String(c.id) === String(data.id))
    if (idx !== -1) todos[idx] = { ...todos[idx], ...data }
    else return null
  } else {
    data = { ...data, id: siguienteId(todos) }
    todos.push(data)
  }
  escribir('clientes', todos)
  return data
}

export function dbDeleteCliente(id) {
  const todos = leer('clientes')
  const nuevos = todos.filter(c => String(c.id) !== String(id))
  if (nuevos.length === todos.length) return false
  escribir('clientes', nuevos)
  return true
}

// ─── SERVICIOS ───────────────────────────────────────────────────
export function dbGetServicios() {
  return leer('servicios')
}

export function dbSaveServicio(data) {
  const todos = leer('servicios')
  if (data.id) {
    const idx = todos.findIndex(s => String(s.id) === String(data.id))
    if (idx !== -1) todos[idx] = { ...todos[idx], ...data }
    else return null
  } else {
    data = { ...data, id: siguienteId(todos) }
    todos.push(data)
  }
  escribir('servicios', todos)
  return data
}

export function dbDeleteServicio(id) {
  const todos = leer('servicios')
  const nuevos = todos.filter(s => String(s.id) !== String(id))
  if (nuevos.length === todos.length) return false
  escribir('servicios', nuevos)
  return true
}

// ─── EMPLEADOS ───────────────────────────────────────────────────
export function dbGetEmpleados() {
  return leer('empleados')
}

export function dbSaveEmpleado(data) {
  const todos = leer('empleados')
  if (data.id) {
    const idx = todos.findIndex(e => String(e.id) === String(data.id))
    if (idx !== -1) todos[idx] = { ...todos[idx], ...data }
    else return null
  } else {
    data = { ...data, id: siguienteId(todos) }
    todos.push(data)
  }
  escribir('empleados', todos)
  return data
}

export function dbDeleteEmpleado(id) {
  const todos = leer('empleados')
  const nuevos = todos.filter(e => String(e.id) !== String(id))
  if (nuevos.length === todos.length) return false
  escribir('empleados', nuevos)
  return true
}
