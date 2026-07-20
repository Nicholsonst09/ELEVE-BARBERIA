import sharp from 'sharp';
import { supabaseAdmin } from '../db/supabaseClient.mjs';

// Toda imagen que suba un admin (avatar de empleado, logo/foto del negocio)
// se normaliza a WebP antes de guardarla en Supabase Storage: pesa menos y
// carga más rápido en el dashboard y en la web de reservas, sin depender de
// qué formato haya subido el usuario.
export async function convertirAWebp(buffer, calidad = 82) {
    return sharp(buffer).webp({ quality: calidad }).toBuffer();
}

// Extrae bucket + path de una URL pública de Supabase Storage
// (".../storage/v1/object/public/<bucket>/<path>"). Devuelve null si la URL
// no tiene ese formato (vacía, externa, etc.) para no intentar borrar algo
// que no vive en nuestro storage.
function parsearRutaStorage(publicUrl) {
    if (typeof publicUrl !== 'string' || !publicUrl) return null;
    const match = publicUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!match) return null;
    return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

// Borra del bucket la imagen que se está reemplazando, para no acumular
// fotos viejas sin referencia en la BD. Best-effort: si falla, solo se
// loguea — guardar el dato nuevo importa más que limpiar el archivo viejo,
// y no queremos que un hiccup de Storage tire abajo el guardado.
export async function eliminarImagenStorage(publicUrlAnterior) {
    const ruta = parsearRutaStorage(publicUrlAnterior);
    if (!ruta) return;

    try {
        const { error } = await supabaseAdmin.storage.from(ruta.bucket).remove([ruta.path]);
        if (error) console.warn('No se pudo borrar la imagen anterior del storage:', error.message);
    } catch (error) {
        console.warn('No se pudo borrar la imagen anterior del storage:', error.message);
    }
}
