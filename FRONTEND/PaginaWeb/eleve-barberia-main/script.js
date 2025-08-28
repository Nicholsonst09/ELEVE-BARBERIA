import gsap from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js"
import { ScrollTrigger } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger.js"
import { ScrollToPlugin } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollToPlugin.js"



// Registrar los plugins
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)


const numeroWhatsApp = "542944806944"


// Smooth scrolling para navegación
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

/* galeria*/
const imagenes = [
  { src: "./img/img-1.jpg", alt: "Low Fade" },
  { src: "./img/img-2.jpg", alt: "Mullet" },
  { src: "./img/img-3.jpg", alt: "High Fade" },
  { src: "./img/img-4.jpg", alt: "Barba" },
  { src: "./img/img-05.jpeg", alt: "French Crop" },
  { src: "./img/img-06.jpeg", alt: "Drop Fade" },
  { src: "./img/img-07.jpeg", alt: "Texturizado" },
  { src: "./img/img-09.jpeg", alt: "Mid Fade" },
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
  /*     document.body.classList.add('no-scroll'); // Evitar scroll en el body */
}

// Función para cerrar el modal
function cerrarModal() {
  modalGaleria.classList.remove('abierto');
  /*     document.body.classList.remove('no-scroll'); // Restaurar scroll en el body */
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

//funcion mostrar el boton reserva
window.addEventListener('scroll', function () {
  const boton = document.getElementById('btn-reservar');
  if (window.scrollY > window.innerHeight) {
    boton.classList.add('visible');
    // No es necesario eliminar 'oculto' ya que no se usa para ocultar
  } else {
    boton.classList.remove('visible');
    // No es necesario añadir 'oculto'
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



document.getElementById("reservaForm").addEventListener("submit", function (e) {
  e.preventDefault();

  // Obtener los datos del formulario
  const formData = new FormData(this);
  const name = formData.get("name");
  const phone = formData.get("phone");
  const professional = formData.get("professional");
  const servicio = formData.get("servicio");
  const date = formData.get("datetime"); // Usamos "datetime" para la fecha y hora
  const message = formData.get("message") || "";

  // Construir el mensaje de WhatsApp
  let mensajeWhatsApp = "*RESERVA TURNO - ELEVÉ BARBERIA* \n\n";
  mensajeWhatsApp += `* Cliente:* ${name}\n`;
  mensajeWhatsApp += `* Teléfono:* ${phone}\n`;
  mensajeWhatsApp += `* Fecha y Hora:* ${date}\n`;
  mensajeWhatsApp += `* Servicio:* ${servicio}\n`;
  mensajeWhatsApp += `* Profesional:* ${professional.toUpperCase()}\n`;

  if (message.trim()) {
    mensajeWhatsApp += `\n* Mensaje:* ${message}\n`;
  }

  mensajeWhatsApp += "\n*¡Espero tu confirmación!* ";

  const mensajeCodificado = encodeURIComponent(mensajeWhatsApp);
  const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${mensajeCodificado}`;
  window.open(urlWhatsApp, "_blank");

  // Mostrar confirmación
  alert(`¡Perfecto ${name}! Te estamos redirigiendo a WhatsApp para confirmar tu cita con ${professional}.`);

  // Limpiar el formulario
  this.reset();
});


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
  nav.style.paddingTop = "100px"

  menuToggle.style.display = 'none';
  menuClose.style.display = 'block';

  // 🚫 Bloquear scroll
  body.style.overflow = "hidden";
});

document.querySelector('.menu-close').addEventListener('click', function () {
  const nav = document.querySelector('.header-content nav'); // 👈 corregido
  const body = document.querySelector('body');
  const menuToggle = document.querySelector('.menu-toggle');
  const menuClose = document.querySelector('.menu-close');

  nav.style.display = 'none';
  body.style.overflow = "auto"; // ✅ restaurar scroll
  menuToggle.style.display = 'block';
  menuClose.style.display = 'none'; // 👈 conviene ocultar el botón cerrar
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
/* parallax */
document.addEventListener('scroll', function () {
  const parallax = document.querySelector('.parallax-hero-container');
  const scrollPosition = window.pageYOffset;

  // La velocidad de desplazamiento del fondo
  const speed = 0.6;


  // Ajusta la posición vertical del fondo
  parallax.style.backgroundPositionY = (scrollPosition * speed) + 'px';
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


//datatime
class DateTimeSelector {
  constructor() {
    this.input = document.getElementById('datetime');
    this.dropdown = document.getElementById('dropdown');
    this.arrow = document.querySelector('.dropdown-arrow');
    this.calendarSection = document.getElementById('calendar-section');
    this.timeSection = document.getElementById('time-section');
    this.selectedDate = null;
    this.selectedTime = null;
    this.currentDate = new Date();

    this.init();
  }

  init() {
    this.input.addEventListener('click', () => this.toggleDropdown());
    document.addEventListener('click', (e) => this.handleOutsideClick(e));

    document.getElementById('prev-month').addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => this.changeMonth(1));
    document.getElementById('change-date-btn').addEventListener('click', () => this.showCalendar());

    this.generateCalendar();
  }

  toggleDropdown() {
    const isOpen = this.dropdown.classList.contains('open');
    if (isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown() {
    this.dropdown.classList.add('open');
    this.arrow.classList.add('open');
    this.showCalendar();
  }

  closeDropdown() {
    this.dropdown.classList.remove('open');
    this.arrow.classList.remove('open');
  }

  handleOutsideClick(e) {
    if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
      this.closeDropdown();
    }
  }

  showCalendar() {
    this.calendarSection.style.display = 'block';
    this.timeSection.classList.remove('active');
    this.generateCalendar();
  }

  showTimeSlots() {
    this.calendarSection.style.display = 'none';
    this.timeSection.classList.add('active');
    this.generateTimeSlots();
  }

  changeMonth(direction) {
    this.currentDate.setMonth(this.currentDate.getMonth() + direction);
    this.generateCalendar();
  }

  generateCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    // Actualizar título
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    document.getElementById('calendar-title').textContent = `${monthNames[month]} ${year}`;

    // Generar días del calendario
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay() + 1); // Empezar en lunes

    const calendarGrid = document.getElementById('calendar-grid');
    calendarGrid.innerHTML = '';

    // Headers de días de la semana
    const dayHeaders = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];
    dayHeaders.forEach(day => {
      const header = document.createElement('div');
      header.className = 'calendar-day-header';
      header.textContent = day;
      calendarGrid.appendChild(header);
    });

    // Generar 42 días (6 semanas)
    const today = new Date();
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const dayElement = document.createElement('div');
      dayElement.className = 'calendar-day';
      dayElement.textContent = date.getDate();

      // Verificar si es del mes actual
      if (date.getMonth() !== month) {
        dayElement.classList.add('disabled');
      }
      // Verificar si es domingo o fecha pasada
      else if (date.getDay() === 0 || date < today.setHours(0, 0, 0, 0)) {
        dayElement.classList.add('disabled');
      }
      // Verificar si es hoy
      else if (date.toDateString() === today.toDateString()) {
        dayElement.classList.add('today');
      }

      // Event listener para seleccionar fecha
      if (!dayElement.classList.contains('disabled')) {
        dayElement.addEventListener('click', () => {
          // Remover selección anterior
          calendarGrid.querySelectorAll('.calendar-day.selected').forEach(el => {
            el.classList.remove('selected');
          });
          dayElement.classList.add('selected');
          this.selectedDate = new Date(date);
          this.showTimeSlots();
        });
      }

      calendarGrid.appendChild(dayElement);
    }
  }

  generateTimeSlots() {
    const timeGrid = document.getElementById('time-grid');
    const selectedDateDisplay = document.getElementById('selected-date-display');

    // Mostrar fecha seleccionada
    selectedDateDisplay.textContent = this.formatSelectedDate(this.selectedDate);

    // Generar horarios
    const times = [];
    for (let hour = 9; hour <= 20; hour++) {
      times.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour <= 20) {  // ahora también entra cuando es 20
        times.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }

    timeGrid.innerHTML = '';
    times.forEach(time => {
      const timeSlot = document.createElement('div');
      timeSlot.className = 'time-slot';
      timeSlot.textContent = time;
      timeSlot.addEventListener('click', () => {
        // Remover selección anterior
        timeGrid.querySelectorAll('.time-slot.selected').forEach(el => {
          el.classList.remove('selected');
        });
        timeSlot.classList.add('selected');
        this.selectedTime = time;
        this.updateInput();
        this.closeDropdown();
      });
      timeGrid.appendChild(timeSlot);
    });
  }

  formatSelectedDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  updateInput() {
    if (this.selectedDate && this.selectedTime) {
      const formattedDate = this.formatSelectedDate(this.selectedDate);
      this.input.value = `${formattedDate} - ${this.selectedTime}`;
      this.input.classList.add('has-value');
    }
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  new DateTimeSelector();
});

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
  reset: false, // 👈 Esto hace que se reinicie cada vez que haces scroll
  once: true  // 👈 Solo se anima la primera
});

// ✅ Revela elementos específicos con diferentes orígenes
sr.reveal('.animacion-01', { delay: 200, origin: 'top' });
sr.reveal('.animacion-02', { delay: 400, origin: 'left', once: false });
sr.reveal('.animacion-03', { delay: 600, origin: 'right' }); // 👈 corregido "rigth" → "right"
