/* ============================================================
   ELEVÉ BARBERÍA — Reservas Web
   Menú de navegación móvil
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const burger = document.getElementById('nav-burger');
  const nav    = document.querySelector('.nav');
  const links  = document.querySelectorAll('.nav__links a');

  if (!burger || !nav) return;

  // Abrir / cerrar menú
  burger.addEventListener('click', () => {
    const abierto = nav.classList.toggle('nav--abierto');
    burger.setAttribute('aria-expanded', abierto);
    // Bloquear scroll del body mientras está abierto
    document.body.style.overflow = abierto ? 'hidden' : '';
  });

  // Cerrar al hacer clic en cualquier enlace
  links.forEach(link => {
    link.addEventListener('click', cerrar);
  });

  // Cerrar al hacer clic fuera del nav
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('nav--abierto') && !nav.contains(e.target)) {
      cerrar();
    }
  });

  // Cerrar con la tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrar();
  });

  function cerrar() {
    nav.classList.remove('nav--abierto');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
});
