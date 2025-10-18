// datos.js - Simulación de base de datos con arrays

export const profesionales = [
  { id: "1", nombre: "Camila Torres", color: "#4b5563" },
  { id: "2", nombre: "María García", color: "#6b7280" },
  { id: "3", nombre: "Camilo Rodríguez", color: "#374151" },
  { id: "4", nombre: "Andrés Pérez", color: "#1f2937" },
  { id: "5", nombre: "Constanza Lucero", color: "#9ca3af" },
]

export const turnos = [
  {
    id: "1",
    nombreCliente: "Bárbara Troncoso",
    servicio: "Primera consulta",
    fecha: "2025-10-17", // Fecha en formato YYYY-MM-DD
    horaInicio: "10:00",
    horaFin: "11:00",
    profesionalId: "1",
    estado: "confirmado",
    telefono: "+56912345678",
    email: "barbara89@gmail.com",
    observaciones: "Cliente prefiere horario de mañana",
  },
  {
    id: "2",
    nombreCliente: "Pamela Postzuelo",
    servicio: "Primera consulta",
    fecha: "2025-10-17",
    horaInicio: "09:00",
    horaFin: "11:00",
    profesionalId: "3",
    estado: "confirmado",
  },
  {
    id: "3",
    nombreCliente: "Mariana Rial",
    servicio: "Primera cita",
    fecha: "2025-10-17",
    horaInicio: "09:00",
    horaFin: "10:30",
    profesionalId: "5",
    estado: "confirmado",
  },
  {
    id: "4",
    nombreCliente: "Ricardo Quevedo",
    servicio: "Consulta general",
    fecha: "2025-10-17",
    horaInicio: "10:00",
    horaFin: "11:30",
    profesionalId: "4",
    estado: "pendiente",
    telefono: "+56987654321",
  },
  {
    id: "5",
    nombreCliente: "Ana Peralta",
    servicio: "Tratamiento segunda cita",
    fecha: "2025-10-17",
    horaInicio: "11:00",
    horaFin: "12:30",
    profesionalId: "5",
    estado: "confirmado",
  },
  {
    id: "6",
    nombreCliente: "Leo Domínguez",
    servicio: "Consulta",
    fecha: "2025-10-17",
    horaInicio: "11:30",
    horaFin: "13:30",
    profesionalId: "4",
    estado: "confirmado",
  },
  {
    id: "7",
    nombreCliente: "Gustavo Flores",
    servicio: "Tercera cita",
    fecha: "2025-10-17",
    horaInicio: "19:00",
    horaFin: "20:30",
    profesionalId: "5",
    estado: "pendiente",
  },
  {
    id: "8",
    nombreCliente: "José Molero",
    servicio: "Consulta de rutina",
    fecha: "2025-10-17",
    horaInicio: "14:00",
    horaFin: "15:30",
    profesionalId: "2",
    estado: "confirmado",
  },
  {
    id: "9",
    nombreCliente: "Magdalena Cordero",
    servicio: "Consulta de seguimiento",
    fecha: "2025-10-17",
    horaInicio: "18:00",
    horaFin: "19:30",
    profesionalId: "3",
    estado: "confirmado",
  },
  {
    id: "10",
    nombreCliente: "Alberto Sánchez",
    servicio: "Primera consulta",
    fecha: "2025-10-17",
    horaInicio: "16:00",
    horaFin: "17:30",
    profesionalId: "5",
    estado: "confirmado",
  },
  {
    id: "11",
    nombreCliente: "Pamela Cita",
    servicio: "Primera cita",
    fecha: "2025-10-17",
    horaInicio: "17:00",
    horaFin: "18:00",
    profesionalId: "1",
    estado: "pendiente",
  },
  {
    id: "12",
    nombreCliente: "Javier Salcedo",
    servicio: "Consulta general",
    fecha: "2025-10-17",
    horaInicio: "19:00",
    horaFin: "20:00",
    profesionalId: "2",
    estado: "pendiente",
  },
  {
    id: "13",
    nombreCliente: "María Morales",
    servicio: "Segunda consulta",
    fecha: "2025-10-17",
    horaInicio: "18:00",
    horaFin: "19:30",
    profesionalId: "4",
    estado: "confirmado",
  },
  {
    id: "14",
    nombreCliente: "Carlos Mendoza",
    servicio: "Consulta de control",
    fecha: "2025-10-17",
    horaInicio: "13:00",
    horaFin: "14:00",
    profesionalId: "1",
    estado: "confirmado",
  },
  {
    id: "15",
    nombreCliente: "Laura Vega",
    servicio: "Primera consulta",
    fecha: "2025-10-17",
    horaInicio: "15:00",
    horaFin: "16:30",
    profesionalId: "3",
    estado: "confirmado",
  },
  {
    id: "16",
    nombreCliente: "Pedro Martínez",
    servicio: "Consulta de seguimiento",
    fecha: "2025-10-18",
    horaInicio: "09:00",
    horaFin: "10:00",
    profesionalId: "1",
    estado: "confirmado",
  },
  {
    id: "17",
    nombreCliente: "Sofía Ramírez",
    servicio: "Primera consulta",
    fecha: "2025-10-18",
    horaInicio: "10:30",
    horaFin: "12:00",
    profesionalId: "2",
    estado: "pendiente",
  },
  {
    id: "18",
    nombreCliente: "Diego Castro",
    servicio: "Tratamiento",
    fecha: "2025-10-18",
    horaInicio: "14:00",
    horaFin: "15:30",
    profesionalId: "3",
    estado: "confirmado",
  },
]

// Función para buscar turnos por profesional ID y nombre
export function buscarTurnosPorProfesional(profesionalId, nombreProfesional, fecha) {
  const fechaStr = formatearFechaParaComparacion(fecha)
  return turnos.filter((turno) => turno.profesionalId === profesionalId && turno.fecha === fechaStr)
}

// Función para buscar turnos pendientes
export function buscarTurnosPendientes(fecha) {
  const fechaStr = formatearFechaParaComparacion(fecha)
  return turnos.filter((turno) => turno.estado === "pendiente" && turno.fecha === fechaStr)
}

// Función para buscar profesional por ID
export function buscarProfesionalPorId(id) {
  return profesionales.find((prof) => prof.id === id)
}

// Función para actualizar un turno
export function actualizarTurno(turnoActualizado) {
  const index = turnos.findIndex((t) => t.id === turnoActualizado.id)
  if (index !== -1) {
    turnos[index] = turnoActualizado
    return true
  }
  return false
}

function formatearFechaParaComparacion(fecha) {
  const year = fecha.getFullYear()
  const month = String(fecha.getMonth() + 1).padStart(2, "0")
  const day = String(fecha.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
