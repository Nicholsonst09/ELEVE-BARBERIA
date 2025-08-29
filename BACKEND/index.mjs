import express from 'express';
import rutasApi from './modulos/rutas.mjs';
import bodyParser from 'body-parser'; 
import cors from 'cors';

const PUERTO = 3000;
const app = express();

app.use(cors());
app.use(bodyParser.json()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

app.use(rutasApi);

app.listen(PUERTO, () => {
    console.log(`Servidor escuchando en el puerto ${PUERTO}`);
});

