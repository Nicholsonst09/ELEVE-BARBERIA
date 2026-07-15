import modeloTurno from './modelo.turno.mjs';
import modeloNegocio from '../negocio/modelo.negocio.mjs';
import { enviarEmail, obtenerEmailAdmin } from '../../integraciones/resend/resendClient.mjs';

const WHATSAPP_FALLBACK = String(process.env.WHATSAPP_CONTACT_NUMBER || '3518524236').replace(/\D/g, '');
const LOGO_URL = process.env.EMAIL_LOGO_URL || 'https://admin.elevebarberia.surweb.com.ar/img/logo-eleve-02.jpg';
const PANEL_URL = process.env.ADMIN_PANEL_URL || 'https://admin.elevebarberia.surweb.com.ar';
const RESERVAS_URL = process.env.RESERVAS_URL || 'https://elevebarberia.surweb.com.ar';

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
        cancelacion: { txt: 'Turno cancelado', color: '#b91c1c', fondo: '#fef2f2' },
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
                    <div style="background:#111;padding:16px 20px;">
                        <div style="background:#fff;display:inline-block;padding:8px 14px;border-radius:8px;">
                            <img src="${LOGO_URL}" width="130" alt="ELEVE Barber Studio" style="display:block;border:0;">
                        </div>
                        <div style="color:#fff;font-size:12px;opacity:0.82;margin-top:8px;">Gestion de turnos</div>
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

function linkWhatsapp(turno, accion, whatsappDestino) {
        const texto = encodeURIComponent(construirMensajeWhatsapp(turno, accion));
        const numero = String(whatsappDestino || '').replace(/\D/g, '') || WHATSAPP_FALLBACK;
        return `https://wa.me/${numero}?text=${texto}`;
}

function bloqueAccionesCliente(turno, whatsappDestino) {
        const linkCancelar = linkWhatsapp(turno, 'cancelar', whatsappDestino);
        const linkReprogramar = linkWhatsapp(turno, 'reprogramar', whatsappDestino);

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

function bloqueAccionesReservar() {
        return `
            <div style="margin-top:16px;">
                <a href="${RESERVAS_URL}" style="display:block;text-align:center;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px;">Reservar un nuevo turno</a>
            </div>
        `;
}

function bloqueAccionesPanel() {
        return `
            <div style="margin-top:16px;">
                <a href="${PANEL_URL}" style="display:block;text-align:center;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px;">Ver en el panel</a>
            </div>
        `;
}

function destinatariosConfirmacion(turno) {
    const to = [];
    if (turno.email_cliente) to.push(turno.email_cliente);
    if (turno.email_empleado) to.push(turno.email_empleado);
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
    const subjectInterno = `Reserva confirmada - ${turno.nombre_cliente} con ${turno.nombre_empleado}`;
    const resultados = [];

    if (turno.email_cliente) {
        const configNegocio = await modeloNegocio.obtenerConfigNegocio();
        const htmlCliente = htmlBase({
            tipo: 'confirmacion',
            titulo: 'Reserva registrada',
            subtitulo: 'Tu turno fue cargado correctamente en ELEVE Barberia.',
            detalleHtml: `Conserva este email como comprobante.${bloqueAccionesCliente(turno, configNegocio.whatsapp)}`,
            turno
        });
        resultados.push(await enviarEmail({ to: [turno.email_cliente], subject, html: htmlCliente }));
    }

    if (turno.email_empleado) {
        const htmlEmpleado = htmlBase({
            tipo: 'confirmacion',
            titulo: 'Nueva reserva asignada',
            subtitulo: 'Se registró un turno a tu nombre.',
            detalleHtml: `Revisá la agenda para ver el detalle del servicio y la hora asignada.${bloqueAccionesPanel()}`,
            turno
        });
        resultados.push(await enviarEmail({ to: [turno.email_empleado], subject: `[PROFESIONAL] ${subjectInterno}`, html: htmlEmpleado }));
    }

    const adminEmail = obtenerEmailAdmin();
    if (adminEmail) {
        const htmlAdmin = htmlBase({
            tipo: 'confirmacion',
            titulo: 'Nueva reserva registrada',
            subtitulo: 'Se registró una reserva desde la web de clientes.',
            detalleHtml: `Aviso interno para administración.${bloqueAccionesPanel()}`,
            turno
        });
        resultados.push(await enviarEmail({ to: [adminEmail], subject: `[ADMIN] ${subjectInterno}`, html: htmlAdmin }));
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

async function enviarCancelacion(turnoId) {
    const turno = await modeloTurno.obtenerTurnoParaNotificacion(turnoId);
    if (!turno) return { skipped: true, motivo: 'turno-no-encontrado' };
    if (turno.estado !== 'cancelado') {
        return { skipped: true, motivo: 'estado-no-cancelado' };
    }

    const resultados = [];
    const subject = `Turno cancelado - ${turno.nombre_cliente}`;
    const subjectInterno = `Turno cancelado - ${turno.nombre_cliente} con ${turno.nombre_empleado}`;

    if (turno.email_cliente) {
        const htmlCliente = htmlBase({
            tipo: 'cancelacion',
            titulo: 'Tu turno fue cancelado',
            subtitulo: 'La cancelación se registró correctamente en ELEVE Barberia.',
            detalleHtml: `Si queres un nuevo turno, podes reservar nuevamente desde la web.${bloqueAccionesReservar()}`,
            turno
        });
        resultados.push(await enviarEmail({ to: [turno.email_cliente], subject, html: htmlCliente }));
    }

    if (turno.email_empleado) {
        const htmlEmpleado = htmlBase({
            tipo: 'cancelacion',
            titulo: 'Turno cancelado',
            subtitulo: 'Se registró una cancelación de turno en tu agenda.',
            detalleHtml: `El horario queda liberado para nuevos turnos.${bloqueAccionesPanel()}`,
            turno
        });
        resultados.push(await enviarEmail({ to: [turno.email_empleado], subject: `[PROFESIONAL] ${subjectInterno}`, html: htmlEmpleado }));
    }

    const adminEmail = obtenerEmailAdmin();
    if (adminEmail) {
        const htmlAdmin = htmlBase({
            tipo: 'cancelacion',
            titulo: 'Turno cancelado',
            subtitulo: 'Se registró una cancelación de turno.',
            detalleHtml: `Aviso interno para administración.${bloqueAccionesPanel()}`,
            turno
        });
        resultados.push(await enviarEmail({ to: [adminEmail], subject: `[ADMIN] ${subjectInterno}`, html: htmlAdmin }));
    }

    return { enviados: resultados.length, resultados };
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
    enviarCancelacion,
    procesarRecordatorios
};
