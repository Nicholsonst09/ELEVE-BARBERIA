// modulos/supabaseAdminClient.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv'

dotenv.config()

// Estas variables deben ser configuradas en el entorno de Vercel de tu API.
// NUNCA las expongas en el frontend.
const supabaseUrl = process.env.SUPABASE_URL ;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('ERROR: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configuradas en el entorno del servidor.');
  // En un entorno de producción real, podrías querer lanzar un error o salir del proceso.
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false, // Importante para clientes de servidor
  },
});
