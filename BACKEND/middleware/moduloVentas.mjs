// Interruptor del modulo de ventas (Productos + Caja), mismo patron que
// EMAIL_NOTIFICATIONS_ENABLED pero con default activo: el modulo funciona
// salvo que se configure MODULO_VENTAS_ENABLED=false, para que los deploys
// existentes (sin la variable) no pierdan la funcionalidad.
export function esModuloVentasActivo() {
	return String(process.env.MODULO_VENTAS_ENABLED ?? 'true').toLowerCase() !== 'false';
}

export function requiereModuloVentas(req, res, next) {
	if (esModuloVentasActivo()) return next();
	res.status(403).json({ mensaje: 'El modulo de ventas esta desactivado para este negocio.' });
}
