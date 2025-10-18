import gsap from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js"
import { ScrollTrigger } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger.js"
import { ScrollToPlugin } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollToPlugin.js"

const volverButtons = document.querySelectorAll('.btn-volver');
const cargarDatosReserva = document.getElementById('btn-continuar');
const btnConfirmarTurno = document.getElementById('btn-confirmar-reserva');

// Estados del turno
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

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  generarFechasDisponibles();
  cargarServicios();

  //eventos para cargar datos de la reserva
  cargarDatosReserva.addEventListener('click', guardarDatosCliente)
  // eventos para volver al paso anterior en la reserva
  volverButtons.forEach(button => {
    button.addEventListener('click', volver);
  });

  btnConfirmarTurno.addEventListener('click', async () => {
    confirmarReservaFinal()
    const turnoCreado = await crearTurno();

    if (turnoCreado) {
      console.log('Turno confirmado:', turnoCreado);
      irAPaso(1)
    }
  });

  configurarEventosFormulario()
})

/* Logica reserva de turnos */

//podrian ser cargada desde el backend -> seria la forma correcta
function generarFechasDisponibles() {
  fechasDisponibles = [];
  const hoy = new Date();

  for (let i = 0; i < 7; i++) {

    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + i);
    fechasDisponibles.push(fecha.toISOString().split("T")[0])
  }
}

async function cargarServicios() {
  const contenedorServicios = document.getElementById("servicios-container");
  contenedorServicios.innerHTML = "";
  try {
    const response = await fetch("http://localhost:3000/api/v1/servicios");
    if (!response.ok) {
      throw new Error(`Error al cargar los servicios: ${response.statusText}`);
    }
    const servicios = await response.json();
    if (servicios.length === 0) {
      container.innerHTML = "<p>No hay servicios disponibles en este momento.</p>";
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

// Cargar barberos disponibles
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


// Cargar fechas disponibles
function cargarFechas() {
  const container = document.getElementById("fechas-container")
  container.innerHTML = "";
  fechasDisponibles.forEach((fecha) => {
    const fechaElement = document.createElement("div")
    fechaElement.className = "tarjeta"
    fechaElement.onclick = () => seleccionarFecha(fecha)

    fechaElement.innerHTML = `
            <div class="tarjeta__contenido">
                <div class="tarjeta-fecha">${formatearFecha(fecha)}</div>
            </div>
        `

    container.appendChild(fechaElement)
  })
}

// Cargar horarios disponibles
function cargarHorarios(horariosDisponibles) {
  const container = document.getElementById("horarios-container")
  const sinHorarios = document.getElementById("sin-horarios")

  container.innerHTML = ""

  if (horariosDisponibles.length === 0) {
    sinHorarios.style.display = "block"
    return
  }

  sinHorarios.style.display = "none"

  if (!Array.isArray(horariosDisponibles) || horariosDisponibles.length === 0) {
    container.innerHTML = `<p>No hay horarios disponibles para esta fecha. Intenta con otro día.</p>`;
    return;
  }

  // Crea una tarjeta para cada horario disponible
  horariosDisponibles.forEach((horario) => {
    if (horario.disponible) {
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
}


async function obtenerOCrearClienteID(nombre, telefono) {
  const clienteData = { nombre, telefono };

  try {
    const respuesta = await fetch(`http://localhost:3000/api/v1/clientes/obtener-o-crear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(clienteData),
    });

    if (!respuesta.ok) {
      const errorBody = await respuesta.json();
      throw new Error(
        `Error HTTP al gestionar cliente: ${respuesta.status}, mensaje: ${errorBody.message || "Error desconocido"}`
      );
    }

    const data = await respuesta.json();
    console.log(data.cliente_id) 
    return data.cliente_id; 

  } catch (error) {
    console.error("Error al obtener o crear el cliente:", error);
    return null;
  }
}

// Crea un nuevo turno web
async function crearTurno() {

  const turnoData = {
    cliente_id: await obtenerOCrearClienteID(reservaActual.cliente.nombre, reservaActual.cliente.telefono),
    empleado_id: reservaActual.barbero_id,
    servicio_id: reservaActual.servicio_id,
    fecha: reservaActual.fecha,
    hora_inicio: reservaActual.hora_inicio,
    hora_fin: reservaActual.hora_fin,
    estado: "pendiente",
    observaciones: null,
    precio: reservaActual.total,
  }
  try {
    const respuesta = await fetch(`http://localhost:3000/api/v1/turnos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(turnoData),
    });
    if (!respuesta.ok) {
      const errorBody = await respuesta.json();
      throw new Error(
        `Error HTTP: ${respuesta.status}, mensaje: ${errorBody.message || "Error desconocido"}`,
      );
    }
    const data = await respuesta.json();
    return data;

  } catch (error) {
    console.error("Error al agregar el turno en la API:", error);
    return null;
  }
}

// Funciones de selección
async function seleccionarServicio(servicio) {
  reservaActual.servicio = servicio.nombre;
  reservaActual.servicio_id = servicio.id;
  reservaActual.total = servicio.precio;
  reservaActual.duracion = servicio.duracion_min;

  try {
    const response = await fetch(`http://localhost:3000/api/v1/servicios/${servicio.id}/empleados`);

    if (!response.ok) {
      throw new Error(`Error en la solicitud: ${response.statusText}`);
    }

    const data = await response.json();

    // Accede a la propiedad 'empleados' del objeto de respuesta
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
  irAPaso(3)
  console.log(reservaActual);
}

async function seleccionarFecha(fecha) {
  reservaActual.fecha = fecha;
  const empleado_id = reservaActual.barbero_id;
  const servicio_id = reservaActual.servicio_id;

  try {

    const url = `http://localhost:3000/api/v1/turnos/horarios-disponibles/${empleado_id}/${servicio_id}/${fecha}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Error en la solicitud: ${response.statusText}`);
    }

    const data = await response.json();

    // Accede a la propiedad 'empleados' del objeto de respuesta
    const horariosDisponibles = data.horarios_disponibles;

    if (!Array.isArray(horariosDisponibles) || horariosDisponibles.length === 0) {
      document.getElementById("turnos-container").innerHTML = "<p>No hay horarios disponibles para este servicio.</p>";
      console.warn("La API retornó un objeto sin la propiedad 'empleados' o un arreglo vacío.");
      return;
    }

    cargarHorarios(horariosDisponibles);
    irAPaso(4);

  } catch (error) {
    console.error("Hubo un problema al obtener los horarios:", error);
    alert("Ocurrió un error al cargar los horarios. Por favor, inténtalo de nuevo.");
  }
}
function seleccionarHora(hora) {
  reservaActual.hora_inicio = hora.inicio
  reservaActual.hora_fin = hora.fin
  irAPaso(5)
}

// Configurar eventos del formulario
function configurarEventosFormulario() {
  const nombreInput = document.getElementById("nombre")
  const telefonoInput = document.getElementById("telefono")
  const continuarBtn = document.getElementById("btn-continuar")

  function validarFormulario() {
    const nombre = nombreInput.value.trim()
    const telefono = telefonoInput.value.trim()
    continuarBtn.disabled = !nombre || !telefono
  }

  nombreInput.addEventListener("input", validarFormulario)
  telefonoInput.addEventListener("input", validarFormulario)
}

// Guardar datos del cliente
function guardarDatosCliente() {
  const nombre = document.getElementById("nombre").value.trim()
  const telefono = document.getElementById("telefono").value.trim()

  if (nombre && telefono) {
    reservaActual.cliente = { nombre, telefono }
    cargarResumen()
    irAPaso(6)
  }
}

// Cargar resumen de la reserva
function cargarResumen() {
  document.getElementById("resumen-nombre").textContent = reservaActual.cliente.nombre
  document.getElementById("resumen-telefono").textContent = reservaActual.cliente.telefono
  document.getElementById("resumen-servicio").textContent = reservaActual.servicio
  document.getElementById("resumen-barbero").textContent = reservaActual.barbero
  document.getElementById("resumen-fecha").textContent = formatearFecha(reservaActual.fecha)
  document.getElementById("resumen-hora").textContent = reservaActual.hora_inicio
  document.getElementById("resumen-duracion").textContent = `${reservaActual.duracion} minutos`
  document.getElementById("resumen-precio").textContent = `$${reservaActual.total}`
}

// Confirmar reserva final
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
Total: $${reservaActual.total}`

  alert(mensaje)
  console.log("Datos completos de la reserva:", reservaActual)
}



// Navegación
function irAPaso(numeroPaso) {
  // Ocultar paso actual
  document.getElementById(`paso-${pasoActual}`).classList.remove("paso--activo")
  document.querySelector(`[data-paso="${pasoActual}"]`).classList.remove("indicador-progreso__paso--activo")

  // Mostrar nuevo paso
  pasoActual = numeroPaso
  document.getElementById(`paso-${pasoActual}`).classList.add("paso--activo")
  document.querySelector(`[data-paso="${pasoActual}"]`).classList.add("indicador-progreso__paso--activo")

  // Actualizar indicadores de progreso
  actualizarIndicadorProgreso()
}

function volver() {
  if (pasoActual > 1) {
    // Limpiar datos según el paso
    if (pasoActual === 2) {
      reservaActual = {}
    } else if (pasoActual === 3) {
      reservaActual = { servicio: reservaActual.servicio }
    } else if (pasoActual === 4) {
      reservaActual = {
        servicio: reservaActual.servicio,
        barbero: reservaActual.barbero,
      }
    } else if (pasoActual === 5) {
      reservaActual = {
        servicio: reservaActual.servicio,
        barbero: reservaActual.barbero,
        fecha: reservaActual.fecha,
      }
    } else if (pasoActual === 6) {
      reservaActual = {
        servicio: reservaActual.servicio,
        barbero: reservaActual.barbero,
        fecha: reservaActual.fecha,
        hora: reservaActual.hora,
      }
    }

    irAPaso(pasoActual - 1)
  }
}

function actualizarIndicadorProgreso() {
  const pasos = document.querySelectorAll(".indicador-progreso__paso")
  pasos.forEach((paso, index) => {
    const numeroPaso = index + 1
    if (numeroPaso <= pasoActual) {
      paso.classList.add("indicador-progreso__paso--activo")
    } else {
      paso.classList.remove("indicador-progreso__paso--activo")
    }
  })
}

// Utilidades
function formatearFecha(fecha) {
  const date = new Date(fecha + "T00:00:00")
  return date.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}


// Registrar los plugins
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)


const numeroWhatsApp = "542944806944"


/* galeria*/
const imagenes = [
  { src: "./img/img-1.jpg", alt: "ver galeria" },
  { src: "./img/img-2.jpg", alt: "ver galeria" },
  { src: "./img/img-3.jpg", alt: "ver galeria" },
  { src: "./img/img-4.jpg", alt: "ver galeria" },
  { src: "./img/img-05.jpeg", alt: "ver galeria" },
  { src: "./img/img-06.jpeg", alt: "ver galeria" },
  { src: "./img/img-07.jpeg", alt: "ver galeria" },
  { src: "./img/img-09.jpeg", alt: "ver galeria" },
];

let indiceImagenActual = 0;
const modalGaleria = document.getElementById('modalGaleria');
const imagenModal = document.getElementById('imagenModal');
const contadorImagenes = document.getElementById('contadorImagenes');
const cuadriculaGaleria = document.querySelector('.cuadricula-galeria');
const botonCerrar = document.querySelector('.boton-cerrar');
const botonAnterior = document.querySelector('.boton-anterior');
const botonSiguiente = document.querySelector('.boton-siguiente');

// Función para renderizar las imágenes en la cuadrícula
function renderizarGaleria() {
  imagenes.forEach((imagen, index) => {
    const elementoGaleria = document.createElement('div');
    elementoGaleria.classList.add('elemento-galeria');
    elementoGaleria.setAttribute('data-index', index);

    const img = document.createElement('img');
    img.src = imagen.src;
    img.alt = imagen.alt;

    const superposicion = document.createElement('div');
    superposicion.classList.add('superposicion');
    const span = document.createElement('span');
    span.textContent = imagen.alt;
    superposicion.appendChild(span);

    elementoGaleria.appendChild(img);
    elementoGaleria.appendChild(superposicion);
    cuadriculaGaleria.appendChild(elementoGaleria);

    // Añadir event listeners para clic y toque
    elementoGaleria.addEventListener('click', () => abrirModal(index));
    elementoGaleria.addEventListener('touchend', (e) => {
      e.preventDefault(); // Evitar el doble disparo con click
      abrirModal(index);
    });
  });
}

// Función para abrir el modal
function abrirModal(index) {
  indiceImagenActual = index;
  actualizarModal();
  modalGaleria.classList.add('abierto');
}

// Función para cerrar el modal
function cerrarModal() {
  modalGaleria.classList.remove('abierto');

}

// Función para mostrar la siguiente imagen
function mostrarSiguienteImagen() {
  indiceImagenActual = (indiceImagenActual + 1) % imagenes.length;
  actualizarModal();
}

// Función para mostrar la imagen anterior
function mostrarImagenAnterior() {
  indiceImagenActual = (indiceImagenActual - 1 + imagenes.length) % imagenes.length;
  actualizarModal();
}

// Función para actualizar la imagen y el contador en el modal
function actualizarModal() {
  imagenModal.src = imagenes[indiceImagenActual].src;
  imagenModal.alt = imagenes[indiceImagenActual].alt;
  contadorImagenes.textContent = `${indiceImagenActual + 1} / ${imagenes.length}`;
}

window.addEventListener('scroll', function () {
  const boton = document.getElementById('btn-reservar');
  if (window.scrollY > window.innerHeight) {
    boton.classList.add('visible');

  } else {
    boton.classList.remove('visible');

  }
});
// Event Listeners
botonCerrar.addEventListener('click', cerrarModal);
botonCerrar.addEventListener('touchend', (e) => {
  e.preventDefault();
  cerrarModal();
});

botonAnterior.addEventListener('click', mostrarImagenAnterior);
botonAnterior.addEventListener('touchend', (e) => {
  e.preventDefault();
  mostrarImagenAnterior();
});

botonSiguiente.addEventListener('click', mostrarSiguienteImagen);
botonSiguiente.addEventListener('touchend', (e) => {
  e.preventDefault();
  mostrarSiguienteImagen();
});

document.addEventListener('keydown', (event) => {
  if (modalGaleria.classList.contains('abierto')) {
    if (event.key === 'ArrowRight') {
      mostrarSiguienteImagen();
    } else if (event.key === 'ArrowLeft') {
      mostrarImagenAnterior();
    } else if (event.key === 'Escape') {
      cerrarModal();
    }
  }
});

// Cerrar modal al tocar el fondo
modalGaleria.addEventListener('click', (event) => {
  if (event.target === modalGaleria) {
    cerrarModal();
  }
});
modalGaleria.addEventListener('touchend', (event) => {
  if (event.target === modalGaleria) {
    cerrarModal();
  }
});

renderizarGaleria();





document.querySelector('.menu-toggle').addEventListener('click', function () {
  const nav = document.querySelector('.header-content nav');
  const body = document.querySelector('body');
  const menuToggle = document.querySelector('.menu-toggle');
  const menuClose = document.querySelector('.menu-close');

  nav.style.display = 'flex';
  nav.style.flexDirection = 'column';
  nav.style.justifyContent = 'self-start';
  nav.style.position = 'absolute';
  nav.style.top = '99%';
  nav.style.left = '0';
  nav.style.right = '0';
  nav.style.padding = '1rem';
  nav.style.width = '100vw';
  nav.style.height = '100vh';
  nav.style.transition = 'all 0.3s ease-in-out';

  menuToggle.style.display = 'none';
  menuClose.style.display = 'block';

  body.style.overflow = "hidden";
});

document.querySelector('.menu-close').addEventListener('click', function () {
  const nav = document.querySelector('.header-content nav');
  const body = document.querySelector('body');
  const menuToggle = document.querySelector('.menu-toggle');
  const menuClose = document.querySelector('.menu-close');

  nav.style.display = 'none';
  body.style.overflow = "auto";
  menuToggle.style.display = 'block';
  menuClose.style.display = 'none';
});


// Cerrar menú móvil al hacer clic en un enlace
document.querySelectorAll('.header-content nav a').forEach(link => {
  link.addEventListener('click', function () {
    document.querySelector('.header-content nav').style.display = 'none';
    document.querySelector('.menu-toggle').style.display = 'block';
    document.querySelector('.menu-close').style.display = 'none';
    const body = document.querySelector('body');
    body.style.overflow = "auto";

  });
});

/* banner infinito */
document.addEventListener('DOMContentLoaded', () => {
  const bannerImagenes = document.getElementById('bannerImagenes');

  if (bannerImagenes) {
    bannerImagenes.addEventListener('mouseover', () => {
      bannerImagenes.classList.add('animacion-pausada');
    });

    bannerImagenes.addEventListener('mouseout', () => {
      bannerImagenes.classList.remove('animacion-pausada');
    });
  }
});

// Función para crear la galería carrusel fullscreen
function initGaleriaCarousel() {
  const carouselContainer = document.getElementById("carousel-fullscreen")
  const carouselTrack = document.getElementById("carousel-track")
  const prevBtn = document.getElementById("carousel-prev")
  const nextBtn = document.getElementById("carousel-next")

  const carouselImages = [
    {
      src: "./img/img-1.jpg",
      title: "TEXTURIZADO",
      description: "",
    },
    {
      src: "./img/img-2.jpg",
      title: "FRENCH CROP",
      description: "",
    },
    {
      src: "./img/img-3.jpg",
      title: "MULLET",
      description: "",
    },
    {
      src: "./img/img-4.jpg",
      title: "FRENCH CROP",
      description: "",
    },
    {
      src: "./img/img-05.jpeg",
      title: "MULLET",
      description: "",
    },
    {
      src: "./img/img-06.jpeg",
      title: "MULLET",
      description: "",
    },
    {
      src: "./img/img-07.jpeg",
      title: "TEXTURIZADO",
      description: "",
    },
    {
      src: "./img/img-08.jpeg",
      title: "TEXTURIZADO",
      description: "",
    },
  ];

  let currentSlide = 0
  let isCarouselAnimating = false
  let autoplayInterval

  // Crear slides
  carouselImages.forEach((image, index) => {
    const slide = document.createElement("div")
    slide.className = `carousel-slide ${index === 0 ? "active" : ""}`

    slide.innerHTML = `
        <img src="${image.src}" alt="${image.title}">
        <div class="carousel-slide-overlay">
          <h3>${image.title}</h3>
          <p>${image.description}</p>
        </div>
      `

    carouselTrack.appendChild(slide)
  })

  // Función para ir a un slide específico
  function goToSlide(slideIndex) {
    if (isCarouselAnimating) return

    isCarouselAnimating = true

    // Remover clase active del slide actual
    const currentSlideElement = carouselTrack.children[currentSlide]
    if (currentSlideElement) {
      currentSlideElement.classList.remove("active")
    }

    currentSlide = slideIndex

    const translateX = -slideIndex * 100
    carouselTrack.style.transform = `translateX(${translateX}%)`

    // Agregar clase active al nuevo slide después de un pequeño delay
    setTimeout(() => {
      const newSlideElement = carouselTrack.children[currentSlide]
      if (newSlideElement) {
        newSlideElement.classList.add("active")
      }
    }, 100)

    setTimeout(() => {
      isCarouselAnimating = false
    }, 600)
  }

  // Función para ir al siguiente slide
  function nextSlide() {
    const nextIndex = (currentSlide + 1) % carouselImages.length
    goToSlide(nextIndex)
  }

  // Función para ir al slide anterior
  function prevSlide() {
    const prevIndex = (currentSlide - 1 + carouselImages.length) % carouselImages.length
    goToSlide(prevIndex)
  }

  // Event listeners para los botones
  nextBtn.addEventListener("click", nextSlide)
  prevBtn.addEventListener("click", prevSlide)

  // Autoplay
  function startAutoplay() {
    autoplayInterval = setInterval(nextSlide, 5000)
  }

  function stopAutoplay() {
    clearInterval(autoplayInterval)
  }

  // Iniciar autoplay
  startAutoplay()

  // Pausar autoplay al hacer hover
  carouselContainer.addEventListener("mouseenter", stopAutoplay)
  carouselContainer.addEventListener("mouseleave", startAutoplay)

  // Navegación con teclado
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      prevSlide()
    } else if (e.key === "ArrowRight") {
      nextSlide()
    }
  })

  // Touch/swipe support para móvil
  let touchStartX = 0
  let touchEndX = 0

  carouselContainer.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX
  })

  carouselContainer.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX
    handleSwipe()
  })

  function handleSwipe() {
    const swipeThreshold = 50
    const diff = touchStartX - touchEndX

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        nextSlide()
      } else {
        prevSlide()
      }
    }
  }
}
initGaleriaCarousel()



// Función para crear botones flotantes
function initFloatingButtons() {
  // Crear contenedor de botones flotantes
  const floatingContainer = document.createElement("div")
  floatingContainer.className = "floating-buttons"

  // Botón de volver arriba
  const backToTopBtn = document.createElement("button")
  backToTopBtn.className = "floating-btn back-to-top"
  backToTopBtn.innerHTML = `<i class="ti ti-chevron-compact-up"></i>`
  backToTopBtn.setAttribute("aria-label", "Volver al inicio")

  // Botón de reserva
  const reservaBtn = document.createElement("button")
  reservaBtn.className = "reserva-flotante oculto"
  reservaBtn.id = "btn-reservar"

  const anchorReservaBtn = document.createElement("a")
  anchorReservaBtn.className = "anchor-reserva"
  anchorReservaBtn.href = "#reservar"
  anchorReservaBtn.innerHTML = ` <i class="ti ti-calendar-plus"></i>`
  reservaBtn.appendChild(anchorReservaBtn);




  // Botón de WhatsApp
  const whatsappBtn = document.createElement("button")
  whatsappBtn.className = "floating-btn whatsapp"
  whatsappBtn.innerHTML = `<i class="ti ti-brand-whatsapp"></i>`
  whatsappBtn.setAttribute("aria-label", "Contactar por WhatsApp")



  // Agregar botones al contenedor
  floatingContainer.appendChild(backToTopBtn)
  floatingContainer.appendChild(reservaBtn)
  floatingContainer.appendChild(whatsappBtn)


  // Agregar contenedor al body
  document.body.appendChild(floatingContainer)

  // Funcionalidad del botón "Volver arriba"
  backToTopBtn.addEventListener("click", () => {
    gsap.to(window, {
      duration: .2,
      scrollTo: { y: 0 },
      ease: "power2.inOut",
    })
  })
  // Funcionalidad del botón WhatsApp
  whatsappBtn.addEventListener("click", () => {
    const message = "Hola! Me interesa reservar un turno en ELEVÉ"
    const whatsappUrl = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  })

  // Mostrar/ocultar botón "Volver arriba" según el scroll
  function toggleBackToTopButton() {
    const heroHeight = window.innerHeight
    const scrollY = window.scrollY

    if (scrollY > heroHeight) {
      backToTopBtn.classList.add("visible")
    } else {
      backToTopBtn.classList.remove("visible")
    }
  }

  // Escuchar el scroll para mostrar/ocultar el botón
  window.addEventListener("scroll", toggleBackToTopButton)
  toggleBackToTopButton() // Ejecutar una vez al cargar
}

initFloatingButtons();

// Función para crear la sección de banner motivacional
function
  initMotivationalBanner() {
  const motivationalBanners = document.querySelectorAll(".motivational-banner")

  // Array de frases motivacionales
  const motivationalPhrases = [
    "RENOVAMOS TU ESTILO",
    "VIVÍ UNA EXPERIENCIA ÚNICA",
    "LOOKS QUE HABLAN POR VOS",
    "CORTES QUE MARCAN DIFERENCIA",
    "VIVÍ UNA EXPERIENCIA ÚNICA",
    "PASIÓN POR EL ESTILO",
    "TRANSFORMAMOS TU IMAGEN",
    "DETALLES QUE INSPIRAN",
    "TU LOOK, TU ACTITUD",
  ]

  // Duplicar frases para efecto infinito
  const duplicatedPhrases = [...motivationalPhrases, ...motivationalPhrases, ...motivationalPhrases]

  // Crear banners para cada contenedor encontrado
  motivationalBanners.forEach((motivationalBanner, bannerIndex) => {
    // Crear el track motivacional
    const motivationalTrack = document.createElement("div")
    motivationalTrack.className = "motivational-track"

    // Crear los elementos de frases
    duplicatedPhrases.forEach((phrase, index) => {
      const motivationalItem = document.createElement("div")
      motivationalItem.className = "motivational-item"

      const motivationalText = document.createElement("div")
      motivationalText.className = "motivational-text"
      motivationalText.textContent = phrase
      motivationalItem.appendChild(motivationalText)

      motivationalTrack.appendChild(motivationalItem)
    })

    motivationalBanner.appendChild(motivationalTrack)
  })
}

initMotivationalBanner();


/* animaciones Reveal */

// ✅ Inicializa ScrollReveal con opciones globales
const sr = ScrollReveal({
  distance: '30px',
  duration: 1000,
  easing: 'ease-in-out',
  origin: 'top',
  reset: false, // hace que se reinicie cada vez que haces scroll
  once: true  //  Solo se anima la primera
});

// ✅ Revela elementos específicos con diferentes orígenes
sr.reveal('.animacion-01', { delay: 200, origin: 'top' });
sr.reveal('.animacion-02', { delay: 400, origin: 'left', once: false });
sr.reveal('.animacion-03', { delay: 600, origin: 'right' }); 