/**
 * @file netlify/functions/admin-resend.js
 * @description Endpoint serverless protegido para que administradores autenticados
 * puedan reenviar el correo formal con PDF de una cotización existente vía Resend.
 */

exports.handler = async (event, context) => {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const authHeader = event.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    if (!token) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'No autorizado. Token requerido.' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !supabaseKey || !resendKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuración de servidor incompleta.' }) };
    }

    // 1. Validar token del usuario con Supabase Auth
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!userRes.ok) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sesión inválida o expirada.' }) };
    }

    const userData = await userRes.json();
    const userId = userData.id;

    // 2. Validar que el usuario sea Admin en public.admin_users
    const adminCheckRes = await fetch(`${supabaseUrl}/rest/v1/admin_users?id=eq.${userId}&select=role`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const adminCheck = await adminCheckRes.json();
    if (!adminCheck || adminCheck.length === 0) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Acceso denegado: no tienes permisos de administrador.' }) };
    }

    // 3. Obtener orden a reenviar
    const body = JSON.parse(event.body || '{}');
    const { orderId, customRecipient, pdfBase64 } = body;

    if (!orderId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'orderId es requerido.' }) };
    }

    const orderRes = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${orderId}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const orders = await orderRes.json();
    if (!orders || orders.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Orden no encontrada.' }) };
    }

    const order = orders[0];
    const destinatario = customRecipient || process.env.ORDERS_NOTIFICATION_EMAIL || 'terminalasuncion.1@gmail.com';
    const sender = process.env.RESEND_FROM_EMAIL || 'Sistema Suministros A.R. <onboarding@resend.dev>';
    const replyTo = process.env.RESEND_REPLY_TO || undefined;

    const emailHtml = `
      <h2>Reenvío de Cotización / Requisición Municipal</h2>
      <p><strong>Folio:</strong> ${order.folio}</p>
      <p><strong>Municipio:</strong> ${order.municipio}</p>
      <p><strong>Total de Piezas:</strong> ${order.total_piezas}</p>
      <p><strong>Total MXN:</strong> $${Number(order.total_mxn).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
      <p><em>Este correo fue reenviado desde el Panel Administrativo por ${userData.email}.</em></p>
      <hr/>
      <p>Adjunto encontrarás el documento formal en PDF.</p>
    `;

    const attachments = [];
    if (pdfBase64) {
      const cleanBase64 = pdfBase64.replace(/^data:.*base64,/, '');
      attachments.push({
        filename: `${order.folio}_${order.municipio.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        content: cleanBase64
      });
    }

    const emailPayload = {
      from: sender,
      to: [destinatario],
      subject: `[Reenvío] Cotización ${order.folio} - ${order.municipio}`,
      html: emailHtml,
      attachments: attachments
    };
    if (replyTo) emailPayload.reply_to = replyTo;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      return { statusCode: 502, headers, body: JSON.stringify({ error: `Fallo en Resend: ${errText.slice(0, 150)}` }) };
    }

    // Registrar log de auditoría
    await fetch(`${supabaseUrl}/rest/v1/order_audit_logs`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order_id: order.id,
        action: 'email_resent',
        previous_state: { email_status: order.email_status },
        new_state: { email_status: 'sent', resent_to: destinatario },
        user_id: userId,
        user_email: userData.email
      })
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, message: `Correo reenviado exitosamente a ${destinatario}` })
    };

  } catch (error) {
    console.error('[admin-resend error]', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error interno al procesar el reenvío.' })
    };
  }
};
