import gsap from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js"
import { ScrollTrigger } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger.js"
import { ScrollToPlugin } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollToPlugin.js"



// Registrar los plugins
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)


const numeroWhatsApp = "542944806944"


// Toggle del menú móvil
function alternarMenuMovil() {
  const menu = document.getElementById("menuMovil");
  menu.classList.toggle("activo");
}


// Para el desplazamiento suave (se recomienda dejarlo, aunque no es exclusivo del navbar)
document.querySelectorAll('a[href^="#"]').forEach((enlace) => {
  enlace.addEventListener("click", function (e) {
    e.preventDefault();
    const objetivo = document.querySelector(this.getAttribute("href"));
    if (objetivo) {
      objetivo.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

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


  const menuLinks = document.querySelectorAll('.contenido-menu-movil a');

  if (menuLinks) {
    menuLinks.forEach(link => {
      link.addEventListener('click', alternarMenuMovil);
    });
  }


  const btnMenu = document.getElementById('btnMenuMovil');
  const btnCerrar = document.getElementById('cerrarMenuMovil');

  // Asegurar que los elementos existan antes de agregar listeners
  if (btnMenu) {
    btnMenu.addEventListener('click', alternarMenuMovil);
  }

  if (btnCerrar) {
    btnCerrar.addEventListener('click', alternarMenuMovil);
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
      title: "",
      description: "",
    },
    {
      src: "./img/img-2.jpg",
      title: "",
      description: "",
    },
    {
      src: "./img/img-3.jpg",
      title: "",
      description: "",
    },
    {
      src: "./img/img-4.jpg",
      title: "",
      description: "",
    },
    {
      src: "./img/img-05.jpeg",
      title: "",
      description: "",
    },
    {
      src: "./img/img-06.jpeg",
      title: "",
      description: "",
    },
    {
      src: "./img/img-07.jpeg",
      title: "",
      description: "",
    },
    {
      src: "./img/img-08.jpeg",
      title: "",
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
  anchorReservaBtn.href = "https://elevebarberia.site.agendapro.com/ar/sucursal/170853"
  anchorReservaBtn.target = "_blank"
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
sr.reveal('.animacion-02', { delay: 400, origin: 'left', once: false, reset: true });
sr.reveal('.animacion-03', { delay: 200, origin: 'right', once: false, reset: true }); // 👈 corregido "rigth" → "right"
