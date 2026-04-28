import 'dotenv/config';
import express from 'express';
import rutasApiTurnos from './modulos/turnos/rutas.turno.mjs';
import rutasApiServicios from './modulos/servicios/rutas.servicio.mjs';
import rutasApiEmpleados from './modulos/empleados/rutas.empleado.mjs';
import rutasApiCliente from './modulos/clientes/rutas.cliente.mjs';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas de la API (Endpoints)
app.use(rutasApiTurnos);
app.use(rutasApiServicios);
app.use(rutasApiEmpleados);
app.use(rutasApiCliente);

// EXPORTACIÓN CLAVE PARA VERCELL
export default app;

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));