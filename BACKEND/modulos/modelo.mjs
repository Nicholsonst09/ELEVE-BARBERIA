// modulos/modelo.mjs
import { supabaseAdmin } from './supabaseClient.mjs'; // Importa el cliente Supabase con service_role

// Función para obtener todos los turnos
async function obtenerTurnos() {
    try {
        const { data: turnos, error } = await supabaseAdmin
            .from('turnos')
            // AÑADIR 'categoria' aquí
            .select('id, nombre, detalle, precio, stock, imagen_url, categoria')
            .order('id', { ascending: true });

        if (error) {
            throw error;
        }
        return turnos;
    } catch (error) {
        console.error("Error al obtener turnos:", error.message);
        throw error;
    }
}

// Función para obtener un turno por ID
async function obtenerUnTurno(id) {
    try {
        const { data: turno, error } = await supabaseAdmin
            .from('turnos')
            .select('id, nombre, detalle, precio, stock, imagen_url, categoria')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }
        return turno;
    } catch (error) {
        console.error(`Error al obtener turno con ID ${id}:`, error.message);
        throw error;
    }
}

// Función para agregar un turno
async function agregarTurno(nuevoTurno) {
    try {
        // AÑADIR 'categoria' aquí
        const { nombre, detalle, precio, stock, imagen_url, categoria } = nuevoTurno;

        const { data, error } = await supabaseAdmin
            .from('turnos')
            .insert([
                {
                    nombre: nombre,
                    detalle: detalle,
                    precio: precio,
                    stock: stock,
                    imagen_url: imagen_url,
                    categoria: categoria
                }
            ])
            .select()
            .single();

        if (error) {
            console.error("Error al agregar turno en Supabase:", error);
            throw new Error(`Error al agregar turno: ${error.message}`);
        }

        return data;
    } catch (error) {
        console.error("Error en modelo.agregarTurno:", error);
        throw error;
    }
}

// Función para modificar un turno
async function modificarTurno(id, turnoModificar) {
    try {
        // AÑADIR 'categoria' aquí
        const { nombre, detalle, precio, stock, imagen_url, categoria } = turnoModificar;

        const { data, error } = await supabaseAdmin
            .from('turnos')
            .update({
                nombre: nombre,
                detalle: detalle,
                precio: precio,
                stock: stock,
                imagen_url: imagen_url,
                // AÑADIR 'categoria' aquí
                categoria: categoria
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error(`Error al modificar turno con ID ${id} en Supabase:`, error);
            throw new Error(`Error al modificar turno: ${error.message}`);
        }

        return data !== null;
    } catch (error) {
        console.error(`Error en modelo.modificarTurno (ID: ${id}):`, error);
        throw error;
    }
}

// Función para eliminar un turno
async function eliminarTurno(id) {
    try {
        const { error, count } = await supabaseAdmin // Usar supabaseAdmin
            .from('turnos') // Nombre de tu tabla en Supabase
            .delete()
            .eq('id', id);

        if (error) {
            console.error(`Error al eliminar turno con ID ${id} en Supabase:`, error);
            throw new Error(`Error al eliminar turno: ${error.message}`);
        }

        return count > 0;
    } catch (error) {
        console.error(`Error en modelo.eliminarTurno (ID: ${id}):`, error);
        throw error;
    }
}

1



export default {
    obtenerTurnos,
    obtenerUnTurno,
    agregarTurno,
    modificarTurno,
    eliminarTurno,
};
