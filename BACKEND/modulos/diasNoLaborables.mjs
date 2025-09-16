// Funciones para manejar días no laborables

// Array para almacenar días no laborables
const DIAS_NO_LABORABLES = [
    // "2024-01-01", // Año Nuevo
    // "2024-12-25", // Navidad
    // "2024-12-31", // Fin de año
];

// Agregar días no laborables
function agregarDiaNoLaborable(fecha, motivo = "Día festivo") {
    if (!DIAS_NO_LABORABLES.includes(fecha)) {
        DIAS_NO_LABORABLES.push(fecha);
        console.log(`Día no laborable agregado: ${fecha} - ${motivo}`);
        return true;
    }
    return false; // Ya existe
}
// Remover días no laborables
function removerDiaNoLaborable(fecha) {
    const index = DIAS_NO_LABORABLES.indexOf(fecha);
    if (index > -1) {
        DIAS_NO_LABORABLES.splice(index, 1);
        console.log(`Día no laborable removido: ${fecha}`);
        return true;
    }
    return false; // No existe
}

// Obtener todos los días no laborables
function obtenerDiasNoLaborables() {
    return [...DIAS_NO_LABORABLES]; 
}

// Verificar si una fecha es día no laborable
function esDiaNoLaborable(fecha) {
    return DIAS_NO_LABORABLES.includes(fecha);
}

// Limpiar todos los días no laborables
function limpiarDiasNoLaborables() {
    const cantidad = DIAS_NO_LABORABLES.length;
    DIAS_NO_LABORABLES.length = 0;
    console.log(`Se removieron ${cantidad} días no laborables`);
    return cantidad;
}

export default {
    agregarDiaNoLaborable,
    removerDiaNoLaborable,
    obtenerDiasNoLaborables,
    esDiaNoLaborable,
    limpiarDiasNoLaborables
};
