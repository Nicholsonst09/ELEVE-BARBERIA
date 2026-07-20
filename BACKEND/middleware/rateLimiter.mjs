import rateLimit from 'express-rate-limit';

function handler(mensaje) {
	return (req, res) => res.status(429).json({ mensaje });
}

// Lecturas públicas de reservas (servicios, empleados, horarios disponibles).
export const limitadorLecturaReservas = rateLimit({
	windowMs: 60 * 1000,
	limit: 60,
	standardHeaders: true,
	legacyHeaders: false,
	handler: handler('Demasiadas solicitudes. Intenta nuevamente en un minuto.')
});

// Creación de reservas: el endpoint más sensible a spam/abuso.
export const limitadorCrearReserva = rateLimit({
	windowMs: 10 * 60 * 1000,
	limit: 5,
	standardHeaders: true,
	legacyHeaders: false,
	handler: handler('Demasiadas reservas creadas desde esta conexión. Intenta nuevamente en unos minutos.')
});

// Recuperación de contraseña: mitiga fuerza bruta / enumeración de emails.
export const limitadorRecuperarPassword = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 5,
	standardHeaders: true,
	legacyHeaders: false,
	handler: handler('Demasiados intentos de recuperación. Intenta nuevamente en 15 minutos.')
});
