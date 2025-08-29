import { Router } from 'express';
import controlador from './controlador.mjs';
import multer from 'multer'; // Importar multer

const rutasApi = Router();

// Configuración de Multer para almacenar archivos en memoria
// Esto es ideal para Vercel Serverless Functions ya que no tienen un sistema de archivos persistente.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

rutasApi.get('/api/v1/turnos', controlador.obtenerTurnos);
rutasApi.get('/api/v1/turnos/:id', controlador.obtenerUnTurno);
rutasApi.post('/api/v1/turnos', controlador.agregarUnTurno);
rutasApi.put('/api/v1/turnos/:id', controlador.modificarTurno);
rutasApi.delete('/api/v1/turnos/:id', controlador.eliminarTurno);

// Nuevas rutas para manejo de imágenes
// 'image' es el nombre del campo en el FormData que el frontend enviará
rutasApi.post('/api/v1/turnos/upload-image', upload.single('image'), controlador.subirImagen);
rutasApi.delete('/api/v1/turnos/delete-image', controlador.eliminarImagen);


//rutas salsas
rutasApi.get('/api/v1/salsas', controlador.obtenerSalsas);
rutasApi.get('/api/v1/salsas/:id', controlador.obtenerUnaSalsa);
rutasApi.post('/api/v1/salsas', controlador.agregarUnaSalsa);
rutasApi.put('/api/v1/salsas/:id', controlador.modificarSalsa);
rutasApi.delete('/api/v1/salsas/:id', controlador.eliminarSalsa);


// Rutas para descuento de stock
rutasApi.post('/api/v1/descontar-stock', controlador.descontarStock);


export default rutasApi;
