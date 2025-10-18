import 'dotenv/config';
import express from 'express';
import rutasApiTurnos from './modulos/turnos/rutas.turno.mjs';
import rutasApiServicios from './modulos/servicios/rutas.servicio.mjs';
import rutasApiCliente from './modulos/clientes/rutas.cliente.mjs';
import bodyParser from 'body-parser'; 
import cors from 'cors';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

//Ruta absoluta del backend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUERTO = 3000;
const app = express();

app.use(cors());
app.use(bodyParser.json()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

app.use(rutasApiTurnos);
app.use(rutasApiServicios);
app.use(rutasApiCliente);

app.use('/Eleve-Barberia-Web', express.static(path.join(__dirname, '../FRONTEND/PaginaWeb')));

app.use('/admin/dashboard', express.static(path.join(__dirname,'../FRONTEND/Dashboard')));

app.listen(PUERTO, () => {
    console.log(`Servidor escuchando en el puerto ${PUERTO}`);
    console.log("Rutas disponibles:");
    console.log('Web: http://localhost:3000/Eleve-Barberia-Web');
    console.log('Panel administrativo: http://localhost:3000/admin/dashboard');
});

