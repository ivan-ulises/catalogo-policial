/**
 * @file api/supabaseClient.js
 * @description Conexión al backend de Supabase para obtener el catálogo de productos.
 */

// Estas claves son públicas (anon key), es seguro dejarlas en el frontend 
// porque la base de datos tiene Row Level Security (RLS).
const SUPABASE_URL = 'https://gqjwdoaielmywbqyirso.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxandkb2FpZWxteXdicXlpcnNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMTc4MDEsImV4cCI6MjEwNjc5MzgwMX0.N7xJzFvWcM1sSqDIgdiFti0WMUFyT09zZMlAndhok3E';

/**
 * Mapeo de la base de datos a nuestro modelo de frontend
 */
function buildProduct(row) {
  // Parsing tallas
  let sizes = ['Única'];
  if (row.tallas_disponibles && row.tallas_disponibles.toLowerCase() !== 'n/a') {
    sizes = row.tallas_disponibles.split(',').map(s => s.trim()).filter(Boolean);
  }

  // Parsing imágenes
  let imageUrls = [];
  if (row.imagen_url && row.imagen_url.trim() !== '') {
    imageUrls = row.imagen_url.split(',').map(url => url.trim()).filter(Boolean);
  }

  return {
    id: String(row.id_producto || ''),
    partida: String(row.partida_fortamun || ''),
    name: String(row.nombre_bien || ''),
    description: String(row.descripcion || ''),
    unit: String(row.unidad_medida || 'PZA'),
    sizes,
    price: Number(row.precio_unitario) || 0,
    imageUrls,
    extraSlotPrice: null // Si tienes un campo en DB, cámbialo aquí
  };
}

/**
 * Obtiene los productos directamente de Supabase
 * @returns {Promise<Array>}
 */
export async function fetchProducts() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.map(buildProduct).filter(p => p.id && p.name);
  } catch (error) {
    console.error('[Supabase Error] Fallo al obtener productos:', error);
    throw error;
  }
}
