import modeloTurno from './modelo.turno.mjs';
import { enviarEmail, obtenerEmailAdmin } from '../../integraciones/resend/resendClient.mjs';

const WHATSAPP_DESTINO = String(process.env.WHATSAPP_CONTACT_NUMBER || '5492944134510').replace(/\D/g, '');

function escaparHtml(valor) {
        return String(valor ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
}

function formatearFecha(fechaISO) {
        if (!fechaISO) return '';
        const [anio, mes, dia] = String(fechaISO).split('-').map(Number);
        const fecha = new Date(anio, (mes || 1) - 1, dia || 1);
        return fecha.toLocaleDateString('es-AR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long'
        });
}

function formatearHora(hora) {
        return (hora || '').substring(0, 5);
}

function formatearFechaHora(fecha, horaInicio, horaFin) {
        const fechaLegible = formatearFecha(fecha);
        const horaI = formatearHora(horaInicio);
        const horaF = formatearHora(horaFin);
        return `${fechaLegible} ${horaI}${horaF ? ` - ${horaF}` : ''}`;
}

function htmlBase({ tipo, titulo, subtitulo, detalleHtml, turno }) {
        const badges = {
                confirmacion: { txt: 'Reserva confirmada', color: '#0f766e', fondo: '#ecfeff' },
                reprogramacion: { txt: 'Turno reprogramado', color: '#b45309', fondo: '#fff7ed' },
                recordatorio: { txt: 'Recordatorio 1h antes', color: '#1d4ed8', fondo: '#eff6ff' }
        };
        const badge = badges[tipo] || badges.confirmacion;

        const cliente = escaparHtml(turno.nombre_cliente);
        const servicio = escaparHtml(turno.nombre_servicio);
        const profesional = escaparHtml(turno.nombre_empleado);
        const fechaHora = escaparHtml(formatearFechaHora(turno.fecha, turno.hora_inicio, turno.hora_fin));
        const precio = Number(turno.precio || 0);

    return `
            <div style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,sans-serif;color:#111;">
                <div style="max-width:580px;margin:0 auto;background:#fff;border:1px solid #ececec;border-radius:14px;overflow:hidden;">
                    <div style="background:#111;color:#fff;padding:18px 20px;">
                        <div style="font-size:18px;font-weight:700;letter-spacing:0.2px;">ELEVE Barberia</div>
                        <div style="font-size:12px;opacity:0.82;margin-top:3px;">Gestion de turnos</div>
                    </div>

                    <div style="padding:18px 20px 10px;">
                        <span style="display:inline-block;font-size:12px;font-weight:700;padding:5px 10px;border-radius:999px;background:${badge.fondo};color:${badge.color};">${badge.txt}</span>
                        <h2 style="margin:12px 0 6px;font-size:22px;line-height:1.2;">${escaparHtml(titulo)}</h2>
                        <p style="margin:0;color:#525252;font-size:14px;">${escaparHtml(subtitulo)}</p>
                    </div>

                    <div style="padding:14px 20px 20px;">
                        <div style="border:1px solid #ececec;border-radius:12px;background:#fafafa;padding:14px 16px;">
                            <p style="margin:0 0 8px;"><strong>Cliente:</strong> ${cliente}</p>
                            <p style="margin:0 0 8px;"><strong>Servicio:</strong> ${servicio}</p>
                            <p style="margin:0 0 8px;"><strong>Profesional:</strong> ${profesional}</p>
                            <p style="margin:0 0 8px;"><strong>Turno:</strong> ${fechaHora}</p>
                            ${precio > 0 ? `<p style="margin:0;"><strong>Precio:</strong> $ ${precio.toLocaleString('es-AR')}</p>` : ''}
                        </div>

                        ${detalleHtml ? `
                            <div style="margin-top:14px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;line-height:1.55;color:#1f2937;">
                                ${detalleHtml}
                            </div>
                        ` : ''}

                        <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">
                            Si necesitas ayuda, responde este email o comunicate con la barberia.
                        </p>
                    </div>
        </div>
      </div>
    `;
}

function construirMensajeWhatsapp(turno, accion) {
        const servicio = turno.nombre_servicio || 'Servicio';
        const profesional = turno.nombre_empleado || 'Profesional';
        const fechaHora = formatearFechaHora(turno.fecha, turno.hora_inicio, turno.hora_fin);
        const encabezado = accion === 'cancelar'
                ? 'Hola, quiero cancelar mi turno.'
                : 'Hola, quiero reprogramar mi turno.';

        return `${encabezado}\n\n` +
                `Cliente: ${turno.nombre_cliente}\n` +
                `Servicio: ${servicio}\n` +
                `Profesional: ${profesional}\n` +
                `Turno: ${fechaHora}\n` +
                `ID Turno: ${turno.id}`;
}

function linkWhatsapp(turno, accion) {
        const texto = encodeURIComponent(construirMensajeWhatsapp(turno, accion));
        return `https://wa.me/${WHATSAPP_DESTINO}?text=${texto}`;
}

function bloqueAccionesCliente(turno) {
        const linkCancelar = linkWhatsapp(turno, 'cancelar');
        const linkReprogramar = linkWhatsapp(turno, 'reprogramar');

        return `
            <div style="margin-top:16px;">
                <p style="margin:0 0 10px;font-size:13px;color:#374151;">Si necesitas cambios, podes gestionarlo por WhatsApp:</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0 8px;">
                    <tr>
                        <td>
                            <a href="${linkReprogramar}" style="display:block;text-align:center;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px;">Reprogramar turno</a>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <a href="${linkCancelar}" style="display:block;text-align:center;padding:10px 14px;background:#fff;color:#111;text-decoration:none;border:1px solid #d1d5db;border-radius:8px;font-weight:700;font-size:13px;">Cancelar turno</a>
                        </td>
                    </tr>
                </table>
            </div>
        `;
}

function destinatariosConfirmacion(turno) {
    const to = [];
    if (turno.email_cliente) to.push(turno.email_cliente);
    const adminEmail = obtenerEmailAdmin();
    if (adminEmail) to.push(adminEmail);
    return to;
}

async function enviarConfirmacionReserva(turnoId) {
    const turno = await modeloTurno.obtenerTurnoParaNotificacion(turnoId);
    if (!turno) return { skipped: true, motivo: 'turno-no-encontrado' };
    if (turno.estado !== 'reservado') {
        return { skipped: true, motivo: 'estado-no-reservado' };
    }

    const subject = `Reserva confirmada - ${turno.nombre_cliente}`;
    const resultados = [];

    if (turno.email_cliente) {
        const htmlCliente = htmlBase({
            tipo: 'confirmacion',
            titulo: 'Reserva registrada',
            subtitulo: 'Tu turno fue cargado correctamente en ELEVE Barberia.',
            detalleHtml: `Conserva este email como comprobante.${bloqueAccionesCliente(turno)}`,
            turno
        });
        resultados.push(await enviarEmail({ to: [turno.email_cliente], subject, html: htmlCliente }));
    }

    const adminEmail = obtenerEmailAdmin();
    if (adminEmail) {
        const htmlAdmin = htmlBase({
            tipo: 'confirmacion',
            titulo: 'Nueva reserva registrada',
            subtitulo: 'Se registró una reserva desde la web de clientes.',
            detalleHtml: 'Aviso interno para administración.',
            turno
        });
        resultados.push(await enviarEmail({ to: [adminEmail], subject: `[ADMIN] ${subject}`, html: htmlAdmin }));
    }

    return { enviados: resultados.length, resultados };
}

async function enviarReprogramacion(turnoId, turnoAnterior) {
    const turno = await modeloTurno.obtenerTurnoParaNotificacion(turnoId);
    if (!turno) return { skipped: true, motivo: 'turno-no-encontrado' };

    const to = destinatariosConfirmacion(turno);
    const subject = `Turno reprogramado - ${turno.nombre_cliente}`;
        const detalleHtml = `
      El turno fue reprogramado.<br>
            <strong>Antes:</strong> ${escaparHtml(formatearFechaHora(turnoAnterior.fecha, turnoAnterior.hora_inicio, turnoAnterior.hora_fin))}<br>
            <strong>Ahora:</strong> ${escaparHtml(formatearFechaHora(turno.fecha, turno.hora_inicio, turno.hora_fin))}
    `;

    const html = htmlBase({
                tipo: 'reprogramacion',
                titulo: 'Reprogramacion de turno',
        subtitulo: 'Tu reserva fue actualizada.',
                detalleHtml,
        turno
    });

    return enviarEmail({ to, subject, html });
}

async function enviarRecordatorioTurno(turno) {
    const to = [turno.email_cliente];
    const subject = `Recordatorio de turno - ${turno.fecha} ${String(turno.hora_inicio || '').substring(0, 5)}`;
    const html = htmlBase({
        tipo: 'recordatorio',
        titulo: 'Recordatorio de turno',
        subtitulo: 'Falta aproximadamente 1 hora para tu turno.',
        detalleHtml: 'Si no podes asistir, avisanos cuanto antes para reprogramarlo.',
        turno
    });
    return enviarEmail({ to, subject, html });
}

async function procesarRecordatorios() {
    const ahora = new Date();
    const inicioVentana = new Date(ahora.getTime() + 55 * 60000);
    const finVentana = new Date(ahora.getTime() + 60 * 60000);

    const turnos = await modeloTurno.obtenerTurnosReservadosEnVentanaRecordatorio(
        inicioVentana.toISOString(),
        finVentana.toISOString()
    );

    let enviados = 0;
    for (const turno of turnos) {
        try {
            await enviarRecordatorioTurno(turno);
            enviados += 1;
        } catch (error) {
            console.error(`[notificaciones] Error enviando recordatorio turno ${turno.id}:`, error?.message || error);
        }
    }

    return {
        ventana: {
            desde: inicioVentana.toISOString(),
            hasta: finVentana.toISOString()
        },
        evaluados: turnos.length,
        enviados
    };
}

export default {
    enviarConfirmacionReserva,
    enviarReprogramacion,
    procesarRecordatorios
};
