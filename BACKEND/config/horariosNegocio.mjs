export const HORARIOS_NEGOCIO_POR_DIA = {
    1: {
        apertura: '13:00',
        cierre: '21:00',
        activo: true
    },
    2: {
        apertura: '09:00',
        cierre: '21:00',
        activo: true
    },
    3: {
        apertura: '09:00',
        cierre: '21:00',
        activo: true
    },
    4: {
        apertura: '09:00',
        cierre: '21:00',
        activo: true
    },
    5: {
        apertura: '09:00',
        cierre: '21:00',
        activo: true
    },
    6: {
        apertura: '09:00',
        cierre: '21:00',
        activo: true
    },
    0: {
        apertura: '09:00',
        cierre: '21:00',
        activo: false
    }
};

// Si está en false, se omite la validación horaria al marcar un turno como 'realizado'.
export const VALIDAR_HORARIO_AL_COMPLETAR_TURNO = false;

export const NOMBRES_DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function obtenerConfiguracionHorarioNegocio(diaSemana) {
    return HORARIOS_NEGOCIO_POR_DIA[diaSemana] || null;
}

export function obtenerNombreDiaSemana(diaSemana) {
    return NOMBRES_DIAS[diaSemana] || 'Día desconocido';
}