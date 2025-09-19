import 'dotenv/config';
import express from 'express';
import rutasApiTurnos from './modulos/turnos/rutas.turno.mjs';
import rutasApiServicios from './modulos/servicios/rutas.servicio.mjs';
import bodyParser from 'body-parser'; 
import cors from 'cors';

const PUERTO = 3000;
const app = express();

app.use(cors());
app.use(bodyParser.json()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

app.use(rutasApiTurnos);
app.use(rutasApiServicios);

app.listen(PUERTO, () => {
    console.log(`Servidor escuchando en el puerto ${PUERTO}`);
});

