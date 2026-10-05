/**
 * Netlify Function: Maneja la recepción de pedidos,
 * los guarda en Supabase, y envía el correo con PDF vía Resend.
 */

exports.handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { payload, pdfBase64, adminEmail } = body;
    
    if (!payload || !payload.municipio) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Payload inválido' }) };
    }

    // 1. Guardar en Supabase (Usando Service Role para bypass RLS)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    // Convertir el payload estructurado a la fila de la tabla orders
    const orderRow = {
      folio: payload.fecha.replace(/[^0-9]/g, '').substring(0, 10), // Ejemplo básico
      fecha: new Date().toISOString(),
      municipio: payload.municipio,
      detalles_pedido: payload.detalles_pedido,
      num_partidas: payload.num_partidas,
      total_piezas: payload.total_piezas,
      total_mxn: payload.total,
      status: 'pendiente'
    };

    const supaRes = await fetch(`${supabaseUrl}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(orderRow)
    });

    if (!supaRes.ok) {
      const errText = await supaRes.text();
      console.error('Supabase Insert Error:', errText);
      throw new Error('Fallo al guardar en Supabase');
    }

    const insertedOrder = (await supaRes.json())[0];
    const folioReal = insertedOrder.id.split('-')[0].toUpperCase();

    // 2. Enviar Correo con Resend
    // Nota: Hasta que no verifiques un dominio en Resend, 
    // solo puedes enviar a tu propio correo registrado.
    const resendKey = process.env.RESEND_API_KEY;
    const destinatario = 'terminalasuncion.1@gmail.com';

    const emailHtml = `
      <h2>Nuevo Pedido Recibido</h2>
      <p><strong>Folio:</strong> ${folioReal}</p>
      <p><strong>Municipio:</strong> ${payload.municipio}</p>
      <p><strong>Total Piezas:</strong> ${payload.total_piezas}</p>
      <p><strong>Total MXN:</strong> ${payload.total_str}</p>
      <br/>
      <p>Adjunto encontrarás el PDF con la cotización generada por el sistema.</p>
    `;

    const attachments = [];
    if (pdfBase64) {
      // Remover cualquier prefijo de data URI (ej. data:application/pdf;filename=generated.pdf;base64,)
      const cleanBase64 = pdfBase64.replace(/^data:.*base64,/, '');
      attachments.push({
        filename: `Cotizacion_${payload.municipio.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        content: cleanBase64
      });
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Sistema Suministros A.R. <onboarding@resend.dev>', // Por defecto en pruebas
        to: [destinatario],
        subject: `Nuevo Pedido - ${payload.municipio} [${folioReal}]`,
        html: emailHtml,
        attachments: attachments
      })
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend Error:', errText);
      // No lanzamos error para no fallar la compra si el email falla
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, folio: folioReal })
    };

  } catch (error) {
    console.error('Order Submission Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
