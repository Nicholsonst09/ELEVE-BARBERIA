import { supabaseAdmin } from "../../db/supabaseClient.mjs";

const SELECT_CLIENTE_BASE = `
    id,
    nombre,
    telefono,
    email,
    preferencias,
    estado_id,
    creado,
    modificado,
    estado_cliente!estado_id(codigo, nombre)
`;

function mapearCliente(cliente = {}, metricasPorCliente = new Map()) {
    const { estado_cliente, ...resto } = cliente;
    const metricas = metricasPorCliente.get(resto.id) || {};

    return {
        ...resto,
        estado: estado_cliente?.codigo || null,
        activo: estado_cliente?.codigo === 'activo',
        total_turnos: metricas.total_turnos || 0,
        visitas_realizadas: metricas.visitas_realizadas || 0,
        ultima_visita: metricas.ultima_visita || null
    };
}

async function obtenerEstadoClienteId(codigo = 'activo') {
    const { data, error } = await supabaseAdmin
        .from('estado_cliente')
        .select('id')
        .eq('codigo', codigo)
        .single();

    if (error) throw error;
    return data.id;
}

async function obtenerEstadoBajaClienteId() {
    const codigosPreferidos = ['inactivo', 'anulado'];

    for (const codigo of codigosPreferidos) {
        const { data, error } = await supabaseAdmin
            .from('estado_cliente')
            .select('id')
            .eq('codigo', codigo)
            .maybeSingle();

        if (error) throw error;
        if (data?.id) return data.id;
    }

    throw new Error("No existe un estado de baja para clientes. Se esperaba 'inactivo' o 'anulado'.");
}

async function obtenerMetricasTurnosPorCliente() {
    const { data: turnos, error } = await supabaseAdmin
        .from('turnos')
        .select(`
            cliente_id,
            fecha,
            estado_turno!estado_id(codigo)
        `);

    if (error) throw error;

    const metricas = new Map();

    for (const turno of turnos || []) {
        const clienteId = turno.cliente_id;
        const actual = metricas.get(clienteId) || {
            total_turnos: 0,
            visitas_realizadas: 0,
            ultima_visita: null
        };

        const estado = turno.estado_turno?.codigo || null;
        const cuentaComoTurno = estado !== 'cancelado' && estado !== 'anulado';
        const cuentaComoVisita = estado === 'completado';

        if (cuentaComoTurno) {
            actual.total_turnos += 1;
        }

        if (cuentaComoVisita) {
            actual.visitas_realizadas += 1;

            if (!actual.ultima_visita || turno.fecha > actual.ultima_visita) {
                actual.ultima_visita = turno.fecha;
            }
        }

        metricas.set(clienteId, actual);
    }

    return metricas;
}

//Función para obtener todos los clientes
async function obtenerClientes() {
    try{
        const metricasPorCliente = await obtenerMetricasTurnosPorCliente();
        const {data: clientes, error} = await supabaseAdmin
        .from('clientes')
            .select(SELECT_CLIENTE_BASE)
            .order('nombre', { ascending: true });

        if (error){
            throw error;
        }

        return (clientes || [])
            .filter(cliente => !['inactivo', 'anulado'].includes(cliente.estado_cliente?.codigo))
            .map(cliente => mapearCliente(cliente, metricasPorCliente));
    }catch(error) {
        console.error("Error al obtener clientes:", error.message);
        throw error;
    }
}

async function obtenerEstadisticasClientes(clientes = []) {
    const limite = new Date();
    limite.setDate(limite.getDate() - 30);
    const limiteIso = limite.toISOString();

    return {
        total: clientes.length,
        nuevos_este_mes: clientes.filter(cliente => cliente.creado && cliente.creado >= limiteIso).length,
        clientes_frecuentes: clientes.filter(cliente => (cliente.visitas_realizadas || 0) > 5).length
    };
}

//Función para obtener clientes por id
async function obtenerUnCliente(id) {
    try {
        const metricasPorCliente = await obtenerMetricasTurnosPorCliente();
        const { data: cliente, error } = await supabaseAdmin
            .from('clientes')
            .select(SELECT_CLIENTE_BASE)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }

        return mapearCliente(cliente, metricasPorCliente);
    } catch (error) {
        console.error(`Error al obtener cliente con ID ${id}:`, error.message);
        throw error;
    }
}

//Funcion para buscar cliente existente o crearlo en su defecto
// Busca primero por teléfono, luego por email. Si encuentra por cualquiera
// de los dos, actualiza el campo faltante. Si no encuentra, crea uno nuevo.
// Si no tiene teléfono ni email, retorna null.
async function buscarOCrearCliente(nombre, telefono = null, email = null) {
    try {
        // Si no tiene ni teléfono ni email, no crear cliente
        if (!telefono && !email) {
            return null;
        }

        const estadoActivoId = await obtenerEstadoClienteId();

        // 1. Buscar por teléfono (si existe)
        if (telefono) {
            let { data: clientePorTel, error: errTel } = await supabaseAdmin
                .from('clientes')
                .select('id, email, estado_id')
                .eq('telefono', telefono)
                .single();

            if (errTel && errTel.code !== 'PGRST116') throw errTel;

            if (clientePorTel) {
                const actualizacion = {
                    nombre,
                    estado_id: estadoActivoId,
                    modificado: new Date().toISOString()
                };
                if (email && !clientePorTel.email) actualizacion.email = email;

                await supabaseAdmin.from('clientes').update(actualizacion).eq('id', clientePorTel.id);
                return clientePorTel.id;
            }
        }

        // 2. Si no encontró por teléfono y tiene email, buscar por email
        if (email) {
            let { data: clientePorEmail, error: errEmail } = await supabaseAdmin
                .from('clientes')
                .select('id, telefono, estado_id')
                .eq('email', email)
                .single();

            if (errEmail && errEmail.code !== 'PGRST116') throw errEmail;

            if (clientePorEmail) {
                const actualizacion = {
                    nombre,
                    estado_id: estadoActivoId,
                    modificado: new Date().toISOString()
                };
                if (!clientePorEmail.telefono && telefono) actualizacion.telefono = telefono;

                await supabaseAdmin.from('clientes').update(actualizacion).eq('id', clientePorEmail.id);
                return clientePorEmail.id;
            }
        }

        // 3. No existe: crear nuevo cliente
        const clienteNuevo = await crearCliente({
            nombre,
            telefono,
            ...(email ? { email } : {})
        });
        return clienteNuevo.id;

    } catch (error) {
        console.error("Error en modelo.buscarOCrearCliente:", error);
        throw error;
    }
}

//funcion para crear cliente
async function crearCliente(nuevoCliente) {
    try {
        const estadoActivoId = await obtenerEstadoClienteId();
        const payload = {
            nombre: nuevoCliente.nombre,
            telefono: nuevoCliente.telefono || null,
            email: nuevoCliente.email || null,
            preferencias: nuevoCliente.preferencias || null,
            estado_id: nuevoCliente.estado_id || estadoActivoId,
            modificado: new Date().toISOString()
        };

        const { data, error } = await supabaseAdmin
            .from('clientes')
            .insert([payload])
            .select(SELECT_CLIENTE_BASE)
            .single();

        if (error) {
            console.error("Error al crear cliente en Supabase:", error);
            throw new Error(`Error al crear cliente: ${error.message}`);
        }

        return mapearCliente(data);
    } catch (error) {
        console.error("Error en modelo.crearCliente:", error);
        throw error;
    }
}

// Función para actualizar un cliente existente
async function actualizarCliente(id, datos) {
    try {
        const payload = {
            nombre: datos.nombre,
            telefono: datos.telefono || null,
            email: datos.email || null,
            preferencias: datos.preferencias || null,
            modificado: new Date().toISOString()
        };

        if (datos.estado_id) {
            payload.estado_id = datos.estado_id;
        }

        const { data, error } = await supabaseAdmin
            .from('clientes')
            .update(payload)
            .eq('id', id)
            .select(SELECT_CLIENTE_BASE)
            .single();

        if (error) throw error;
        return mapearCliente(data);
    } catch (error) {
        console.error(`Error al actualizar cliente con ID ${id}:`, error.message);
        throw error;
    }
}

// Función para dar de baja lógica a un cliente sin borrar su historial
async function eliminarCliente(id) {
    try {
        const estadoBajaId = await obtenerEstadoBajaClienteId();

        const { error } = await supabaseAdmin
            .from('clientes')
            .update({
                estado_id: estadoBajaId,
                modificado: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error(`Error al eliminar cliente con ID ${id}:`, error.message);
        throw error;
    }
}


export default {
    obtenerClientes,
    obtenerEstadisticasClientes,
    obtenerUnCliente,
    buscarOCrearCliente,
    crearCliente,
    actualizarCliente,
    eliminarCliente
};