// js/pagina.js

import gsap from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js"
import { ScrollTrigger } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger.js"
import { ScrollToPlugin } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollToPlugin.js"

// Registrar los plugins de GSAP
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const numeroWhatsApp = "542944806944";

/* =================================================== */
/* Galería (Cuadrícula con Modal)                      */
/* =================================================== */

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

function renderizarGaleria() {
  if (!cuadriculaGaleria) return; // No ejecutar si no estamos en la página correcta

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

    elementoGaleria.addEventListener('click', () => abrirModal(index));
    elementoGaleria.addEventListener('touchend', (e) => {
      e.preventDefault();
      abrirModal(index);
    });
  });
}

function abrirModal(index) {
  indiceImagenActual = index;
  actualizarModal();
  modalGaleria.classList.add('abierto');
}

function cerrarModal() {
  modalGaleria.classList.remove('abierto');
}

function mostrarSiguienteImagen() {
  indiceImagenActual = (indiceImagenActual + 1) % imagenes.length;
  actualizarModal();
}

function mostrarImagenAnterior() {
  indiceImagenActual = (indiceImagenActual - 1 + imagenes.length) % imagenes.length;
  actualizarModal();
}

function actualizarModal() {
  imagenModal.src = imagenes[indiceImagenActual].src;
  imagenModal.alt = imagenes[indiceImagenActual].alt;
  contadorImagenes.textContent = `${indiceImagenActual + 1} / ${imagenes.length}`;
}

// Event Listeners de la Galería (solo si los botones existen)
if (botonCerrar) {
  botonCerrar.addEventListener('click', cerrarModal);
  botonCerrar.addEventListener('touchend', (e) => { e.preventDefault(); cerrarModal(); });
}
if (botonAnterior) {
  botonAnterior.addEventListener('click', mostrarImagenAnterior);
  botonAnterior.addEventListener('touchend', (e) => { e.preventDefault(); mostrarImagenAnterior(); });
}
if (botonSiguiente) {
  botonSiguiente.addEventListener('click', mostrarSiguienteImagen);
  botonSiguiente.addEventListener('touchend', (e) => { e.preventDefault(); mostrarSiguienteImagen(); });
}

document.addEventListener('keydown', (event) => {
  if (modalGaleria && modalGaleria.classList.contains('abierto')) {
    if (event.key === 'ArrowRight') mostrarSiguienteImagen();
    else if (event.key === 'ArrowLeft') mostrarImagenAnterior();
    else if (event.key === 'Escape') cerrarModal();
  }
});

if (modalGaleria) {
  modalGaleria.addEventListener('click', (event) => {
    if (event.target === modalGaleria) cerrarModal();
  });
  modalGaleria.addEventListener('touchend', (event) => {
    if (event.target === modalGaleria) cerrarModal();
  });
}

// Iniciar la galería
renderizarGaleria();

/* =================================================== */
/* Botón de Reserva Flotante (Scroll)                  */
/* =================================================== */

window.addEventListener('scroll', function () {
  const boton = document.getElementById('btn-reservar');
  if (boton) {
    if (window.scrollY > window.innerHeight) {
      boton.classList.add('visible');
    } else {
      boton.classList.remove('visible');
    }
  }
});

/* =================================================== */
/* Menú Hamburguesa (Móvil)                            */
/* =================================================== */

document.querySelector('.menu-toggle')?.addEventListener('click', function () {
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

document.querySelector('.menu-close')?.addEventListener('click', function () {
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
    const nav = document.querySelector('.header-content nav');
    if (window.innerWidth < 768) { // Asumiendo 768px como breakpoint
      nav.style.display = 'none';
      document.querySelector('.menu-toggle').style.display = 'block';
      document.querySelector('.menu-close').style.display = 'none';
      document.querySelector('body').style.overflow = "auto";
    }
  });
});

/* =================================================== */
/* Banner Infinito (Pausa en Hover)                    */
/* =================================================== */

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

/* =================================================== */
/* Galería Carrusel Fullscreen                         */
/* =================================================== */

function initGaleriaCarousel() {
  const carouselContainer = document.getElementById("carousel-fullscreen");
  if (!carouselContainer) return; // No ejecutar si no existe

  const carouselTrack = document.getElementById("carousel-track");
  const prevBtn = document.getElementById("carousel-prev");
  const nextBtn = document.getElementById("carousel-next");

  const carouselImages = [
    { src: "./img/img-1.jpg", title: "TEXTURIZADO", description: "" },
    { src: "./img/img-2.jpg", title: "FRENCH CROP", description: "" },
    { src: "./img/img-3.jpg", title: "MULLET", description: "" },
    { src: "./img/img-4.jpg", title: "FRENCH CROP", description: "" },
    { src: "./img/img-05.jpeg", title: "MULLET", description: "" },
    { src: "./img/img-06.jpeg", title: "MULLET", description: "" },
    { src: "./img/img-07.jpeg", title: "TEXTURIZADO", description: "" },
    { src: "./img/img-08.jpeg", title: "TEXTURIZADO", description: "" },
  ];

  let currentSlide = 0;
  let isCarouselAnimating = false;
  let autoplayInterval;

  // Crear slides
  carouselImages.forEach((image, index) => {
    const slide = document.createElement("div");
    slide.className = `carousel-slide ${index === 0 ? "active" : ""}`;
    slide.innerHTML = `
        <img src="${image.src}" alt="${image.title}">
        <div class="carousel-slide-overlay">
          <h3>${image.title}</h3>
          <p>${image.description}</p>
        </div>
      `;
    carouselTrack.appendChild(slide);
  });

  function goToSlide(slideIndex) {
    if (isCarouselAnimating) return;
    isCarouselAnimating = true;

    const currentSlideElement = carouselTrack.children[currentSlide];
    if (currentSlideElement) {
      currentSlideElement.classList.remove("active");
    }

    currentSlide = slideIndex;
    const translateX = -slideIndex * 100;
    carouselTrack.style.transform = `translateX(${translateX}%)`;

    setTimeout(() => {
      const newSlideElement = carouselTrack.children[currentSlide];
      if (newSlideElement) {
        newSlideElement.classList.add("active");
      }
    }, 100);

    setTimeout(() => { isCarouselAnimating = false; }, 600);
  }

  function nextSlide() {
    const nextIndex = (currentSlide + 1) % carouselImages.length;
    goToSlide(nextIndex);
  }

  function prevSlide() {
    const prevIndex = (currentSlide - 1 + carouselImages.length) % carouselImages.length;
    goToSlide(prevIndex);
  }

  nextBtn.addEventListener("click", nextSlide);
  prevBtn.addEventListener("click", prevSlide);

  function startAutoplay() {
    autoplayInterval = setInterval(nextSlide, 5000);
  }

  function stopAutoplay() {
    clearInterval(autoplayInterval);
  }

  startAutoplay();
  carouselContainer.addEventListener("mouseenter", stopAutoplay);
  carouselContainer.addEventListener("mouseleave", startAutoplay);

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") prevSlide();
    else if (e.key === "ArrowRight") nextSlide();
  });

  let touchStartX = 0;
  let touchEndX = 0;

  carouselContainer.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });

  carouselContainer.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });

  function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) nextSlide();
      else prevSlide();
    }
  }
}
initGaleriaCarousel();

/* =================================================== */
/* Botones Flotantes (WhatsApp, Volver Arriba)         */
/* =================================================== */

function initFloatingButtons() {
  const floatingContainer = document.createElement("div");
  floatingContainer.className = "floating-buttons";

  const backToTopBtn = document.createElement("button");
  backToTopBtn.className = "floating-btn back-to-top";
  backToTopBtn.innerHTML = `<i class="ti ti-chevron-compact-up"></i>`;
  backToTopBtn.setAttribute("aria-label", "Volver al inicio");

  const reservaBtn = document.createElement("button");
  reservaBtn.className = "reserva-flotante oculto"; // Oculto por CSS, 'visible' se añade por scroll
  reservaBtn.id = "btn-reservar";

  const anchorReservaBtn = document.createElement("a");
  anchorReservaBtn.className = "anchor-reserva";
  anchorReservaBtn.href = "#reservar";
  anchorReservaBtn.innerHTML = ` <i class="ti ti-calendar-plus"></i>`;
  reservaBtn.appendChild(anchorReservaBtn);

  const whatsappBtn = document.createElement("button");
  whatsappBtn.className = "floating-btn whatsapp";
  whatsappBtn.innerHTML = `<i class="ti ti-brand-whatsapp"></i>`;
  whatsappBtn.setAttribute("aria-label", "Contactar por WhatsApp");

  floatingContainer.appendChild(backToTopBtn);
  floatingContainer.appendChild(reservaBtn);
  floatingContainer.appendChild(whatsappBtn);
  document.body.appendChild(floatingContainer);

  // Funcionalidad "Volver arriba" con GSAP
  backToTopBtn.addEventListener("click", () => {
    gsap.to(window, {
      duration: 0.2,
      scrollTo: { y: 0 },
      ease: "power2.inOut",
    });
  });

  // Funcionalidad WhatsApp
  whatsappBtn.addEventListener("click", () => {
    const message = "Hola! Me interesa reservar un turno en ELEVÉ";
    const whatsappUrl = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  });

  // Mostrar/ocultar botón "Volver arriba"
  function toggleBackToTopButton() {
    const heroHeight = window.innerHeight;
    const scrollY = window.scrollY;
    if (scrollY > heroHeight) {
      backToTopBtn.classList.add("visible");
    } else {
      backToTopBtn.classList.remove("visible");
    }
  }
  
  window.addEventListener("scroll", toggleBackToTopButton);
  toggleBackToTopButton(); // Ejecutar al cargar
}
initFloatingButtons();

/* =================================================== */
/* Banner Motivacional (Infinito)                      */
/* =================================================== */

function initMotivationalBanner() {
  const motivationalBanners = document.querySelectorAll(".motivational-banner");
  if (motivationalBanners.length === 0) return;

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
  ];
  const duplicatedPhrases = [...motivationalPhrases, ...motivationalPhrases, ...motivationalPhrases];

  motivationalBanners.forEach((motivationalBanner) => {
    const motivationalTrack = document.createElement("div");
    motivationalTrack.className = "motivational-track";

    duplicatedPhrases.forEach((phrase) => {
      const motivationalItem = document.createElement("div");
      motivationalItem.className = "motivational-item";
      const motivationalText = document.createElement("div");
      motivationalText.className = "motivational-text";
      motivationalText.textContent = phrase;
      motivationalItem.appendChild(motivationalText);
      motivationalTrack.appendChild(motivationalItem);
    });
    motivationalBanner.appendChild(motivationalTrack);
  });
}
initMotivationalBanner();

/* =================================================== */
/* Animaciones ScrollReveal                            */
/* =================================================== */

document.addEventListener('DOMContentLoaded', () => {
  if (typeof ScrollReveal !== 'undefined') {
    const sr = ScrollReveal({
      distance: '30px',
      duration: 1000,
      easing: 'ease-in-out',
      origin: 'top',
      reset: false,
      once: true
    });

    sr.reveal('.animacion-01', { delay: 200, origin: 'top' });
    sr.reveal('.animacion-02', { delay: 400, origin: 'left', once: false });
    sr.reveal('.animacion-03', { delay: 600, origin: 'right' });
  } else {
    console.warn('ScrollReveal no está cargado.');
  }
});