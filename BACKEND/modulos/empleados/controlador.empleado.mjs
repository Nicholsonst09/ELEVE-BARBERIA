import modelo from './modelo.empleado.mjs';

//función para manejar la solicitud de todos los empleados
async function obtenerEmpleados(req, res){
    try {
            const empleados = await modelo.obtenerEmpleados();
            if (empleados.length === 0) {
                return res.status(200).json({ mensaje: "No hay empleados en la base de datos." });
            }
            res.status(200).json(empleados);
        } catch (error) {
            console.error("Error en controlador.obtenerEmpleados:", error);
            res.status(500).json({ mensaje: "Error interno del servidor al obtener empleados.", detalle: error.message });
        }
}

//función para manejar la solicitud de obtener un empleado por ID
async function obtenerUnEmpleado(req, res){
    const empleadoId = parseInt(req.params.id);

    if (isNaN(empleadoId)) {
        return res.status(400).json({ mensaje: 'ID del empleado inválido. Debe ser un número.' });
    }

    try{
        const empleado = await modelo.obtenerUnEmpleado(empleadoId);
                if (empleado) {
                    res.status(200).json(empleado);
                } else {
                    res.status(404).json({ mensaje: 'Empleado no encontrado.' });
                }
    }catch (error) {
        console.error(`Error en controlador.obtenerUnEmpleado (ID: ${empleadoId}):`, error);
        res.status(500).json({ mensaje: 'Error interno del servidor al obtener el empleado.', detalle: error.message });
    }

}

export default{
    obtenerEmpleados,
    obtenerUnEmpleado
}