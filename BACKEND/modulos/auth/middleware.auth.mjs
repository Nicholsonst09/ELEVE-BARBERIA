import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export function generarToken(usuario) {
    return jwt.sign(
        { id: usuario.id, email: usuario.email, rol: usuario.rol },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
}

export function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ mensaje: 'Token no proporcionado' });
    }
    try {
        const token = authHeader.split(' ')[1];
        req.usuario = jwt.verify(token, JWT_SECRET); // { id, email, rol }
        next();
    } catch {
        return res.status(401).json({ mensaje: 'Token inválido o expirado' });
    }
}

export function soloAdmin(req, res, next) {
    if (req.usuario?.rol !== 'administrador') {
        return res.status(403).json({ mensaje: 'Acceso restringido a administradores' });
    }
    next();
}
