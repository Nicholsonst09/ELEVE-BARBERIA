
// --- Selectores del DOM para Reservas ---
const volverButtons = document.querySelectorAll('.btn-volver');
const cargarDatosReserva = document.getElementById('btn-continuar');
const btnConfirmarTurno = document.getElementById('btn-confirmar-reserva');

// --- Estados del turno ---
let pasoActual = 1;
let reservaActual = {
  servicio: null,
  duracion: null,
  servicio_id: null,
  barbero_id: null,
  barbero: null,
  fecha: null,
  hora_inicio: null,
  hora_fin: null,
  estado: null,
  observaciones: null,
  cliente: null,
  total: null
}
let fechasDisponibles = [];

// --- Inicialización de la Lógica de Reserva ---
document.addEventListener("DOMContentLoaded", () => {
  // Solo ejecuta si el contenedor de reserva existe en la página
  if (document.getElementById('servicios-container')) {
    generarFechasDisponibles();
    cargarServicios();

    // Eventos para cargar datos de la reserva
    cargarDatosReserva.addEventListener('click', guardarDatosCliente);
    
    // Eventos para volver al paso anterior en la reserva
    volverButtons.forEach(button => {
      button.addEventListener('click', volver);
    });

    // Evento para confirmar la reserva final
    btnConfirmarTurno.addEventListener('click', async () => {
      confirmarReservaFinal(); // Muestra el alert
      const turnoCreado = await crearTurno(); // Envía a la API

      if (turnoCreado) {
        console.log('Turno confirmado:', turnoCreado);
        irAPaso(1); // Resetea el formulario al paso 1
      }
    });

    configurarEventosFormulario();
  }
});

/* =================================================== */
/* Logica reserva de turnos                          */
/* =================================================== */

// Genera 7 días desde hoy, excluyendo domingos
function generarFechasDisponibles() {
  fechasDisponibles = [];
  const hoy = new Date();
  for (let i = 0; i < 7; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + i);

    // Si el día NO es Domingo (0), la agregamos.
    if (fecha.getDay() !== 0) {
      fechasDisponibles.push(fecha.toISOString().split("T")[0]);
    }
  }
}

// --- Funciones de Carga (Renderizado de Pasos) ---

async function cargarServicios() {
  const contenedorServicios = document.getElementById("servicios-container");
  contenedorServicios.innerHTML = ""; // Limpiar
  try {
    const response = await fetch("http://localhost:3000/api/v1/servicios");
    if (!response.ok) {
      throw new Error(`Error al cargar los servicios: ${response.statusText}`);
    }
    const servicios = await response.json();
    if (servicios.length === 0) {
      contenedorServicios.innerHTML = "<p>No hay servicios disponibles en este momento.</p>";
      return;
    }

    servicios.forEach((servicio) => {
      const servicioCard = document.createElement("div");
      servicioCard.className = "tarjeta";
      servicioCard.onclick = () => seleccionarServicio(servicio);
      servicioCard.innerHTML = `
          <div class="tarjeta__encabezado">
              <h3 class="tarjeta__titulo">${servicio.nombre}</h3>
          </div>
          <div class="tarjeta__contenido">
              <p class="tarjeta-servicio__descripcion">${servicio.descripcion}</p>
              <div class="tarjeta-servicio__detalles">
                  <span class="etiqueta etiqueta--precio">$${servicio.precio}</span>
                  <span class="etiqueta etiqueta--duracion">${servicio.duracion_min} min</span>
              </div>
          </div>
      `;
      contenedorServicios.appendChild(servicioCard);
    });
  } catch (error) {
    console.error("Hubo un problema con el fetch de servicios", error);
    contenedorServicios.innerHTML = `<p>Ocurrió un error al intentar cargar los servicios.</p>`;
  }
}

function cargarBarberos(barberosDisponibles) {
  const container = document.getElementById("barberos-container");
  container.innerHTML = "";
  barberosDisponibles.forEach((barbero) => {
    const barberoElement = document.createElement("div");
    barberoElement.className = "tarjeta";
    barberoElement.onclick = () => seleccionarBarbero(barbero);
    barberoElement.innerHTML = `
        <div class="tarjeta__contenido">
            <div class="barbero-info">
                <div class="barbero-avatar">foto</div>
                <div class="barbero-detalles">
                    <h3>${barbero.nombre}</h3>
                    <p class="barbero-especialidad">${barbero.especialidades}</p>
                </div>
            </div>
        </div>
    `;
    container.appendChild(barberoElement);
  });
}

function cargarFechas() {
  const container = document.getElementById("fechas-container");
  container.innerHTML = "";
  fechasDisponibles.forEach((fecha) => {
    const fechaElement = document.createElement("div");
    fechaElement.className = "tarjeta";
    fechaElement.onclick = () => seleccionarFecha(fecha);
    fechaElement.innerHTML = `
        <div class="tarjeta__contenido">
            <div class="tarjeta-fecha">${formatearFecha(fecha)}</div>
        </div>
    `;
    container.appendChild(fechaElement);
  });
}

function cargarHorarios(horariosDisponibles) {
  const container = document.getElementById("horarios-container");
  const sinHorarios = document.getElementById("sin-horarios");
  container.innerHTML = "";

  if (!Array.isArray(horariosDisponibles) || horariosDisponibles.length === 0) {
    sinHorarios.style.display = "block";
    container.innerHTML = `<p>No hay horarios disponibles para esta fecha. Intenta con otro día.</p>`;
    return;
  }

  sinHorarios.style.display = "none";
  let disponibles = 0;

  horariosDisponibles.forEach((horario) => {
    if (horario.disponible) {
      disponibles++;
      const horarioElement = document.createElement("div");
      horarioElement.className = "tarjeta";
      horarioElement.onclick = () => seleccionarHora(horario);
      horarioElement.innerHTML = `
        <div class="tarjeta__contenido">
          <div class="tarjeta-horario">${horario.inicio}</div>
        </div>
      `;
      container.appendChild(horarioElement);
    }
  });

  if (disponibles === 0) {
    sinHorarios.style.display = "block";
    container.innerHTML = `<p>No hay horarios disponibles para esta fecha. Intenta con otro día.</p>`;
  }
}

// --- Funciones de API (Fetch) ---

async function obtenerOCrearClienteID(nombre, telefono) {
  const clienteData = { nombre, telefono };
  try {
    const respuesta = await fetch(`http://localhost:3000/api/v1/clientes/obtener-o-crear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clienteData),
    });
    if (!respuesta.ok) {
      const errorBody = await respuesta.json();
      throw new Error(`Error HTTP al gestionar cliente: ${respuesta.status}, mensaje: ${errorBody.message || "Error desconocido"}`);
    }
    const data = await respuesta.json();
    console.log(data.cliente_id);
    return data.cliente_id;
  } catch (error) {
    console.error("Error al obtener o crear el cliente:", error);
    return null;
  }
}

async function crearTurno() {
  const cliente_id = await obtenerOCrearClienteID(reservaActual.cliente.nombre, reservaActual.cliente.telefono);
  if (!cliente_id) {
    alert("Error al procesar los datos del cliente. El turno no pudo ser creado.");
    return null;
  }

  const turnoData = {
    cliente_id: cliente_id,
    empleado_id: reservaActual.barbero_id,
    servicio_id: reservaActual.servicio_id,
    fecha: reservaActual.fecha,
    hora_inicio: reservaActual.hora_inicio,
    hora_fin: reservaActual.hora_fin,
    estado: "pendiente",
    observaciones: null,
    precio: reservaActual.total,
  };

  try {
    const respuesta = await fetch(`http://localhost:3000/api/v1/turnos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(turnoData),
    });
    if (!respuesta.ok) {
      const errorBody = await respuesta.json();
      throw new Error(`Error HTTP: ${respuesta.status}, mensaje: ${errorBody.message || "Error desconocido"}`);
    }
    const data = await respuesta.json();
    return data;
  } catch (error) {
    console.error("Error al agregar el turno en la API:", error);
    alert(`Error al crear el turno: ${error.message}`);
    return null;
  }
}

// --- Funciones de Selección (Manejo de Estado) ---

async function seleccionarServicio(servicio) {
  reservaActual.servicio = servicio.nombre;
  reservaActual.servicio_id = servicio.id;
  reservaActual.total = servicio.precio;
  reservaActual.duracion = servicio.duracion_min;

  try {
    // API para obtener barberos por servicio
    const response = await fetch(`http://localhost:3000/api/v1/servicios/${servicio.id}/empleados`);
    if (!response.ok) {
      throw new Error(`Error en la solicitud: ${response.statusText}`);
    }
    const data = await response.json();
    const barberosDisponibles = data.empleados;

    if (!Array.isArray(barberosDisponibles) || barberosDisponibles.length === 0) {
      document.getElementById("barberos-container").innerHTML = "<p>No hay barberos disponibles para este servicio.</p>";
      console.warn("La API retornó un objeto sin la propiedad 'empleados' o un arreglo vacío.");
      return;
    }

    cargarBarberos(barberosDisponibles);
    irAPaso(2);
  } catch (error) {
    console.error("Hubo un problema al obtener los barberos:", error);
    alert("Ocurrió un error al cargar los barberos. Por favor, inténtalo de nuevo.");
  }
}

function seleccionarBarbero(barbero) {
  reservaActual.barbero = barbero.nombre;
  reservaActual.barbero_id = barbero.id;
  cargarFechas();
  irAPaso(3);
}

async function seleccionarFecha(fecha) {
  reservaActual.fecha = fecha;
  const empleado_id = reservaActual.barbero_id;
  const servicio_id = reservaActual.servicio_id;

  try {
    // API para obtener horarios disponibles
    const url = `http://localhost:3000/api/v1/turnos/horarios-disponibles/${empleado_id}/${servicio_id}/${fecha}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error en la solicitud: ${response.statusText}`);
    }
    const data = await response.json();
    const horariosDisponibles = data.horarios_disponibles;
    
    cargarHorarios(horariosDisponibles);
    irAPaso(4);
  } catch (error) {
    console.error("Hubo un problema al obtener los horarios:", error);
    alert("Ocurrió un error al cargar los horarios. Por favor, inténtalo de nuevo.");
  }
}

function seleccionarHora(hora) {
  reservaActual.hora_inicio = hora.inicio;
  reservaActual.hora_fin = hora.fin;
  irAPaso(5);
}

// --- Lógica del Formulario y Resumen (Paso 5 y 6) ---

function configurarEventosFormulario() {
  const nombreInput = document.getElementById("nombre");
  const telefonoInput = document.getElementById("telefono");
  const continuarBtn = document.getElementById("btn-continuar");

  const nombreError = document.getElementById("nombre-error");
  const telefonoError = document.getElementById("telefono-error");

  // Funciones de validación individuales
  function validarNombre() {
    const nombre = nombreInput.value.trim();
    // Regex: Al menos 3 letras, permite espacios, ñ y acentos
    const regexNombre = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]{3,}$/;
    
    if (nombre.length === 0) {
      nombreError.textContent = "";
      nombreInput.classList.remove("invalido");
      return false;
    }
    
    if (regexNombre.test(nombre)) {
      nombreError.textContent = "";
      nombreInput.classList.remove("invalido");
      return true;
    } else {
      nombreError.textContent = "Debe tener al menos 3 letras.";
      nombreInput.classList.add("invalido");
      return false;
    }
  }

  function validarTelefono() {
    const telefono = telefonoInput.value.trim();
    // Regex: Solo números, al menos 8 dígitos
    const regexTelefono = /^\d{8,}$/;
    
    if (telefono.length === 0) {
      telefonoError.textContent = "";
      telefonoInput.classList.remove("invalido");
      return false;
    }

    if (regexTelefono.test(telefono)) {
      telefonoError.textContent = "";
      telefonoInput.classList.remove("invalido");
      return true;
    } else {
      telefonoError.textContent = "Debe tener al menos 8 números.";
      telefonoInput.classList.add("invalido");
      return false;
    }
  }

  // Validador principal
  function validarFormulario() {
    const nombreValido = validarNombre();
    const telefonoValido = validarTelefono();
    continuarBtn.disabled = !nombreValido || !telefonoValido;
  }

  nombreInput.addEventListener("input", validarFormulario);
  telefonoInput.addEventListener("input", validarFormulario);
  
  // Estado inicial del botón al cargar
  validarFormulario();
}

function guardarDatosCliente() {
  const nombre = document.getElementById("nombre").value.trim();
  const telefono = document.getElementById("telefono").value.trim();

  // Agrega el prefijo +54 si no está presente
  const telefonoCompleto = telefono.startsWith('+') ? telefono : `+54${telefono}`;

  if (nombre && telefono) { 
    reservaActual.cliente = { nombre, telefono: telefonoCompleto };
    cargarResumen();
    irAPaso(6);
  }
}

function cargarResumen() {
  document.getElementById("resumen-nombre").textContent = reservaActual.cliente.nombre;
  document.getElementById("resumen-telefono").textContent = reservaActual.cliente.telefono;
  document.getElementById("resumen-servicio").textContent = reservaActual.servicio;
  document.getElementById("resumen-barbero").textContent = reservaActual.barbero;
  document.getElementById("resumen-fecha").textContent = formatearFecha(reservaActual.fecha);
  document.getElementById("resumen-hora").textContent = reservaActual.hora_inicio;
  document.getElementById("resumen-duracion").textContent = `${reservaActual.duracion} minutos`;
  document.getElementById("resumen-precio").textContent = `$${reservaActual.total}`;
}

function confirmarReservaFinal() {
  const mensaje = `¡Reserva confirmada exitosamente!

Datos del cliente:
Nombre: ${reservaActual.cliente.nombre}
Teléfono: ${reservaActual.cliente.telefono}

Detalles de la reserva:
Servicio: ${reservaActual.servicio}
Barbero: ${reservaActual.barbero}
Fecha: ${formatearFecha(reservaActual.fecha)}
Hora: ${reservaActual.hora_inicio}
Total: $${reservaActual.total}`;

  alert(mensaje);
  console.log("Datos completos de la reserva:", reservaActual);
}

// --- Navegación de Pasos ---

function irAPaso(numeroPaso) {
  // Ocultar paso actual
  document.getElementById(`paso-${pasoActual}`).classList.remove("paso--activo");
  document.querySelector(`[data-paso="${pasoActual}"]`).classList.remove("indicador-progreso__paso--activo");

  // Mostrar nuevo paso
  pasoActual = numeroPaso;
  document.getElementById(`paso-${pasoActual}`).classList.add("paso--activo");
  document.querySelector(`[data-paso="${pasoActual}"]`).classList.add("indicador-progreso__paso--activo");

  actualizarIndicadorProgreso();
}

function volver() {
  if (pasoActual > 1) {
    // Limpiar datos según el paso (evita enviar datos viejos por error)
    if (pasoActual === 2) { 
      reservaActual.servicio = null;
      reservaActual.servicio_id = null;
      reservaActual.total = null;
      reservaActual.duracion = null;
    } else if (pasoActual === 3) {
      reservaActual.barbero = null;
      reservaActual.barbero_id = null;
    } else if (pasoActual === 4) { 
      reservaActual.fecha = null;
    } else if (pasoActual === 5) { 
      reservaActual.hora_inicio = null;
      reservaActual.hora_fin = null;
    } else if (pasoActual === 6) { 
      reservaActual.cliente = null;
    }

    irAPaso(pasoActual - 1);
  }
}

function actualizarIndicadorProgreso() {
  const pasos = document.querySelectorAll(".indicador-progreso__paso");
  pasos.forEach((paso, index) => {
    const numeroPaso = index + 1;
    if (numeroPaso < pasoActual) {
      paso.classList.add("indicador-progreso__paso--completado"); 
      paso.classList.remove("indicador-progreso__paso--activo");
    } else if (numeroPaso === pasoActual) {
      paso.classList.add("indicador-progreso__paso--activo");
      paso.classList.remove("indicador-progreso__paso--completado");
    } else {
      paso.classList.remove("indicador-progreso__paso--activo");
      paso.classList.remove("indicador-progreso__paso--completado");
    }
  });
}

// --- Utilidad ---

function formatearFecha(fecha) {
  const date = new Date(fecha + "T00:00:00"); // Asegura la fecha correcta
  return date.toLocaleString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}