import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const notificationsEnabled = String(process.env.EMAIL_NOTIFICATIONS_ENABLED || 'false').toLowerCase() === 'true';

const resend = apiKey ? new Resend(apiKey) : null;

function normalizarDestinatarios(to) {
    if (!to) return [];
    const lista = Array.isArray(to) ? to : [to];
    return [...new Set(lista.map(x => String(x || '').trim()).filter(Boolean))];
}

async function enviarEmail({ to, subject, html }) {
    const destinatarios = normalizarDestinatarios(to);
    if (destinatarios.length === 0) {
        return { skipped: true, motivo: 'sin-destinatarios' };
    }

    if (!notificationsEnabled) {
        console.info('[resend] EMAIL_NOTIFICATIONS_ENABLED=false. Email omitido.');
        return { skipped: true, motivo: 'notificaciones-deshabilitadas' };
    }

    if (!resend) {
        console.warn('[resend] RESEND_API_KEY no configurada. Email omitido.');
        return { skipped: true, motivo: 'sin-api-key' };
    }

    try {
        const result = await resend.emails.send({
            from: fromEmail,
            to: destinatarios,
            subject,
            html
        });
        return result;
    } catch (error) {
        console.error('[resend] Error enviando email:', error?.message || error);
        throw error;
    }
}

function obtenerEmailAdmin() {
    return (process.env.ADMIN_NOTIFICATION_EMAIL || '').trim() || null;
}

export { enviarEmail, obtenerEmailAdmin };
