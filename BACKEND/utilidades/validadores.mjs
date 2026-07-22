const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_TELEFONO_CARACTERES = /^[0-9\s()+-]+$/;

// Formato, no obligatoriedad: estas funciones asumen que el campo puede
// venir vacío/null y eso lo decide cada caller. Solo validan que, si hay
// un valor, tenga pinta de email/teléfono real.

function esEmailValido(email) {
    if (typeof email !== 'string') return false;
    return REGEX_EMAIL.test(email.trim());
}

function esTelefonoValido(telefono) {
    if (typeof telefono !== 'string') return false;
    const valor = telefono.trim();
    if (!REGEX_TELEFONO_CARACTERES.test(valor)) return false;
    const digitos = valor.replace(/\D/g, '');
    return digitos.length >= 8 && digitos.length <= 15;
}

export { esEmailValido, esTelefonoValido };
export default { esEmailValido, esTelefonoValido };
