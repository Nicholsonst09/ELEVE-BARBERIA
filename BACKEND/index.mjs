import 'dotenv/config';
import express from 'express';
import rutasApiTurnos from './modulos/turnos/rutas.turno.mjs';
import rutasApiServicios from './modulos/servicios/rutas.servicio.mjs';
import rutasApiEmpleados from './modulos/empleados/rutas.empleado.mjs';
import rutasApiCliente from './modulos/clientes/rutas.cliente.mjs';
import rutasReservas from './modulos/reservas/rutas.reserva.mjs';
import rutasApiNegocio from './modulos/negocio/rutas.negocio.mjs';
import rutasApiCaja from './modulos/caja/rutas.caja.mjs';
import rutasApiIndicadores from './modulos/indicadores/rutas.indicadores.mjs';
import rutasApiProductos from './modulos/productos/rutas.producto.mjs';
import rutasAuth from './modulos/auth/rutas.auth.mjs';
import { requiereModuloVentas } from './middleware/moduloVentas.mjs';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();

// Vercel pone un proxy delante de la app: sin esto, express-rate-limit no ve
// la IP real de cada visitante y cuenta a todos en el mismo límite.
app.set('trust proxy', 1);

// CORS: solo la página de reservas, el dashboard y desarrollo local.
// Los requests sin header Origin (curl, cron de recordatorios, server-to-server)
// no los bloquea CORS: eso lo cubre la autenticación de cada endpoint.
const origenesPermitidos = [
	'https://eleve-barberia-app.vercel.app',
];

const esOrigenLocal = (origin) =>
	/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.use(cors({
	origin(origin, callback) {
		const permitido = !origin || origenesPermitidos.includes(origin) || esOrigenLocal(origin);
		// Con false no se emiten headers CORS y el navegador bloquea la respuesta,
		// sin convertir el rechazo en un error 500 del servidor.
		callback(null, permitido);
	},
}));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// La API es 100% dinamica (respuestas dependen de Origin y a veces de auth).
// Sin esto, el edge de Vercel puede cachear un GET publico (ej. sin header
// Origin) y servir esa respuesta cacheada a un origen distinto sin el header
// CORS correcto -> "Failed to fetch" intermitente en el navegador.
app.use('/api/v1', (req, res, next) => {
	res.set('Cache-Control', 'no-store');
	next();
});

// Rutas públicas — página de reservas del cliente (sin autenticación)
app.use(rutasReservas);
app.use(rutasAuth);

// Modulo de ventas (Productos + Caja): puede desactivarse por negocio con
// MODULO_VENTAS_ENABLED=false. El guard corre antes que sus routers.
app.use('/api/v1/caja', requiereModuloVentas);
app.use('/api/v1/productos', requiereModuloVentas);

// Rutas del back office (backoffice)
app.use(rutasApiTurnos);
app.use(rutasApiServicios);
app.use(rutasApiEmpleados);
app.use(rutasApiCliente);
app.use(rutasApiNegocio);
app.use(rutasApiCaja);
app.use(rutasApiIndicadores);
app.use(rutasApiProductos);

// EXPORTACIÓN CLAVE PARA VERCELL
export default app;

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));