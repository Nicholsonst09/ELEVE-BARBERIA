import modelo from './modelo.indicadores.mjs';

async function obtenerFinancieros(req, res) {
    try {
        const filtros = {
            desde: req.query.desde || null,
            hasta: req.query.hasta || null,
            empleado_id: req.query.empleado_id || null
        };

        const indicadores = await modelo.obtenerIndicadoresFinancieros(filtros);
        return res.status(200).json(indicadores);
    } catch (error) {
        console.error('Error en controlador.indicadores.obtenerFinancieros:', error);
        return res.status(500).json({ mensaje: 'Error interno al calcular los indicadores financieros.', detalle: error.message });
    }
}

export default {
    obtenerFinancieros
};
