import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import rutasApiTurnos    from './modulos/turnos/rutas.turno.mjs';
import rutasApiServicios from './modulos/servicios/rutas.servicio.mjs';
import rutasApiEmpleados from './modulos/empleados/rutas.empleado.mjs';
import rutasApiCliente   from './modulos/clientes/rutas.cliente.mjs';
import rutasApiUsuario   from './modulos/usuarios/rutas.usuario.mjs';

const app = express();

const corsOptions = {
    origin: [
        'https://eleve-barberia-app.vercel.app',
        'https://eleve-barberia-xi.vercel.app',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas de la API (Endpoints)
app.use(rutasApiTurnos);
app.use(rutasApiServicios);
app.use(rutasApiEmpleados);
app.use(rutasApiCliente);
app.use(rutasApiUsuario);

// EXPORTACIÓN CLAVE PARA VERCEL
export default app;

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));