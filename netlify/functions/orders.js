/**
 * @file netlify/functions/orders.js
 * @description Manejador serverless hardened para recepción, validación,
 * recálculo en servidor e idempotencia de pedidos/cotizaciones B2B.
 */

// Memoria simple de Rate Limiting por IP (Ventana deslizante de 1 minuto)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(ip) {
  if (!ip) return true;
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, startTime: now };

  if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
    record.count = 1;
    record.startTime = now;
  } else {
    record.count += 1;
  }

  rateLimitMap.set(ip, record);

  // Limpiar entradas antiguas ocasionalmente
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now - val.startTime > RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(key);
    }
  }

  return record.count <= RATE_LIMIT_MAX_REQUESTS;
}

/**
 * Generador de Folio Canónico en Servidor: COT-YYYY-XXXX
 */
function generateServerFolio() {
  const year = new Date().getFullYear();
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  const timeStr = Date.now().toString(36).slice(-3).toUpperCase();
  return `COT-${year}-${randomStr}${timeStr}`;
}

exports.handler = async (event, context) => {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, X-Turnstile-Token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';

  // 1. Rate Limiting por IP
  if (!checkRateLimit(clientIp)) {
    console.warn(`[RateLimit] IP ${clientIp} excedió el límite de peticiones.`);
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ error: 'Demasiadas solicitudes. Por favor, espera un minuto.' })
    };
  }

  try {
    // 2. Parseo y tamaño del body
    if (!event.body || event.body.length > 7 * 1024 * 1024) { // Límite 7MB
      return { statusCode: 413, headers, body: JSON.stringify({ error: 'Cuerpo de solicitud demasiado grande.' }) };
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Formato JSON inválido.' }) };
    }

    const { payload, pdfBase64, honeypot, turnstileToken } = body;

    // 3. Honeypot check (campo oculto que solo llenan bots)
    if (honeypot && String(honeypot).trim() !== '') {
      console.warn(`[Anti-Abuso] Honeypot activado por IP ${clientIp}`);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, folio: 'COT-BOT-DETECTED' }) };
    }

    // 4. Cloudflare Turnstile (Opcional por variable de entorno)
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      if (!turnstileToken) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token de verificación de seguridad requerido.' }) };
      }
      try {
        const turnstileVerifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: turnstileSecret,
            response: turnstileToken,
            remoteip: clientIp
          })
        });
        const turnstileData = await turnstileVerifyRes.json();
        if (!turnstileData.success) {
          console.warn('[Turnstile] Verificación fallida:', turnstileData);
          return { statusCode: 403, headers, body: JSON.stringify({ error: 'Verificación de seguridad fallida.' }) };
        }
      } catch (err) {
        console.error('[Turnstile Error]', err);
      }
    }

    // 5. Validación de Schema del Payload
    if (!payload || typeof payload !== 'object') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Payload requerido.' }) };
    }

    const applicant = payload.applicant && typeof payload.applicant === 'object' ? payload.applicant : {};
    const municipio = String(applicant.municipio || payload.municipio || '').trim();
    if (!municipio || municipio.length < 2 || municipio.length > 150) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'El nombre del municipio o corporación es inválido o está incompleto.' }) };
    }

    if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 100) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'El pedido debe contener entre 1 y 100 partidas.' }) };
    }

    // Validar idempotency_key
    const idempotencyKey = String(payload.idempotency_key || '').trim().slice(0, 100);

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Config Error] Faltan variables SUPABASE_URL o SUPABASE_SERVICE_KEY');
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error de configuración de servidor.' }) };
    }

    // 6. Verificar Idempotencia en Base de Datos
    if (idempotencyKey) {
      const checkRes = await fetch(`${supabaseUrl}/rest/v1/orders?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,folio,total_mxn,status`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      if (checkRes.ok) {
        const existing = await checkRes.json();
        if (existing && existing.length > 0) {
          console.info(`[Idempotencia] Reintento detectado para key ${idempotencyKey}. Retornando folio previo.`);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ ok: true, folio: existing[0].folio, duplicate: true })
          };
        }
      }
    }

    // 7. Recálculo en SERVIDOR: Consultar catálogo oficial en Supabase
    const productIds = [...new Set(payload.items.map(i => String(i.productId || i.id || '').trim()).filter(Boolean))];
    if (productIds.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ítems no contienen identificador válido.' }) };
    }

    // Consultar todos los productos involucrados
    const idsQuery = productIds.map(id => `"${id}"`).join(',');
    const catalogRes = await fetch(`${supabaseUrl}/rest/v1/products?id_producto=in.(${idsQuery})&select=id_producto,nombre_bien,precio_unitario,tallas_disponibles`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!catalogRes.ok) {
      throw new Error(`Fallo al consultar catálogo de productos en Supabase: ${catalogRes.status}`);
    }

    const catalogRows = await catalogRes.json();
    const catalogMap = new Map(catalogRows.map(p => [p.id_producto, p]));

    // 8. Construir Snapshot de Partidas y Recalcular Montos Oficiales
    let computedTotalMXN = 0;
    let totalPiezas = 0;
    const itemsSnapshot = [];
    const detallesList = [];

    for (const rawItem of payload.items) {
      const pId = String(rawItem.productId || rawItem.id || '').trim();
      const product = catalogMap.get(pId);

      if (!product) {
        console.warn(`[Seguridad] Producto no encontrado o inactivo: ${pId}`);
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Uno de los productos seleccionados (${rawItem.name || pId}) ya no está disponible.` }) };
      }

      const qty = parseInt(rawItem.qty, 10);
      if (isNaN(qty) || qty < 1 || qty > 10000) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cantidad de producto fuera de rango permitido (1 - 10,000).' }) };
      }

      // PRECIO OFICIAL OBTENIDO DEL SERVIDOR (Se ignora cualquier precio enviado por el cliente)
      const officialUnitPrice = Number(product.precio_unitario);
      const subtotalItem = officialUnitPrice * qty;

      computedTotalMXN += subtotalItem;
      totalPiezas += qty;

      const size = String(rawItem.size || 'Unitalla').slice(0, 50);
      const color = rawItem.color ? String(rawItem.color).slice(0, 50) : null;
      const variant = rawItem.variant ? String(rawItem.variant).slice(0, 100) : null;

      itemsSnapshot.push({
        id_producto: product.id_producto,
        nombre: product.nombre_bien,
        talla: size,
        color: color,
        variante: variant,
        cantidad: qty,
        precio_unitario: officialUnitPrice,
        subtotal: subtotalItem
      });

      detallesList.push(`${qty}x ${product.nombre_bien}${size !== 'Unitalla' ? ` (${size})` : ''}`);
    }

    // Cálculos Fiscales
    const computedSubtotalSinIVA = Number((computedTotalMXN / 1.16).toFixed(2));
    const computedIVA = Number((computedTotalMXN - computedSubtotalSinIVA).toFixed(2));
    computedTotalMXN = Number(computedTotalMXN.toFixed(2));

    // Folio Canónico del Servidor
    const folioReal = generateServerFolio();

    // 9. Guardar en Base de Datos (Insert Seguro)
    const orderRow = {
      folio: folioReal,
      fecha: new Date().toISOString(),
      municipio: municipio,
      detalles_pedido: detallesList.join(' | ').slice(0, 1000),
      num_partidas: itemsSnapshot.length,
      total_piezas: totalPiezas,
      total_mxn: computedTotalMXN,
      status: 'pendiente',
      idempotency_key: idempotencyKey || null,
      items_snapshot: itemsSnapshot,
      email_status: 'pending',
      applicant_info: applicant
    };

    let insertRes = await fetch(`${supabaseUrl}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(orderRow)
    });

    if (!insertRes.ok && orderRow.applicant_info) {
      // Si la columna applicant_info aún no está aplicada en Supabase, reintentar sin ella para no romper el flujo
      const fallbackRow = { ...orderRow };
      delete fallbackRow.applicant_info;
      const retryRes = await fetch(`${supabaseUrl}/rest/v1/orders`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(fallbackRow)
      });
      if (retryRes.ok) {
        insertRes = retryRes;
      }
    }

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('[Supabase Insert Error]', errText);
      throw new Error('Fallo al persistir cotización en base de datos.');
    }

    const insertedRows = await insertRes.json();
    const insertedId = insertedRows[0]?.id;

    // 10. Resiliencia de Correo con Resend (Si Resend falla, la orden permanece intacta)
    const resendKey = process.env.RESEND_API_KEY;
    const destinatario = process.env.ORDERS_NOTIFICATION_EMAIL || 'terminalasuncion.1@gmail.com';
    const sender = process.env.RESEND_FROM_EMAIL || 'Sistema Suministros A.R. <onboarding@resend.dev>';
    const replyTo = process.env.RESEND_REPLY_TO || undefined;

    let emailStatus = 'pending';
    let emailErrorMsg = null;

    if (resendKey) {
      try {
        const emailHtml = `
          <h2>Nueva Requisición / Cotización Municipal</h2>
          <p><strong>Folio Oficial:</strong> ${folioReal}</p>
          <p><strong>Municipio / Corporación:</strong> ${municipio}</p>
          ${applicant.dependencia ? `<p><strong>Dependencia:</strong> ${applicant.dependencia}</p>` : ''}
          ${applicant.solicitante ? `<p><strong>Titular / Solicitante:</strong> ${applicant.solicitante}${applicant.cargo ? ` (${applicant.cargo})` : ''}</p>` : ''}
          ${applicant.telefono ? `<p><strong>Teléfono:</strong> ${applicant.telefono}</p>` : ''}
          ${applicant.email ? `<p><strong>Correo Oficial:</strong> ${applicant.email}</p>` : ''}
          ${applicant.rfc ? `<p><strong>RFC:</strong> ${applicant.rfc}</p>` : ''}
          ${applicant.domicilio_entrega ? `<p><strong>Domicilio de Entrega:</strong> ${applicant.domicilio_entrega}</p>` : ''}
          <hr/>
          <p><strong>Total de Piezas:</strong> ${totalPiezas}</p>
          <p><strong>Subtotal s/IVA:</strong> $${computedSubtotalSinIVA.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</p>
          <p><strong>IVA (16%):</strong> $${computedIVA.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</p>
          <p><strong>Total Oficial (c/IVA):</strong> $${computedTotalMXN.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</p>
          <hr/>
          <p>Adjunto encontrarás el documento formal en PDF para expediente y validación técnica.</p>
        `;

        const attachments = [];
        if (pdfBase64 && typeof pdfBase64 === 'string') {
          const cleanBase64 = pdfBase64.replace(/^data:.*base64,/, '');
          attachments.push({
            filename: `${folioReal}_${municipio.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
            content: cleanBase64
          });
        }

        const emailPayload = {
          from: sender,
          to: [destinatario],
          subject: `Cotización ${folioReal} - ${municipio}`,
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

        if (resendRes.ok) {
          emailStatus = 'sent';
          console.info(`[Resend] Correo enviado exitosamente para folio ${folioReal}`);
        } else {
          emailStatus = 'failed';
          const errText = await resendRes.text();
          emailErrorMsg = `Resend status ${resendRes.status}: ${errText.slice(0, 200)}`;
          console.error('[Resend Error]', emailErrorMsg);
        }
      } catch (mailErr) {
        emailStatus = 'failed';
        emailErrorMsg = mailErr.message ? mailErr.message.slice(0, 200) : 'Error desconocido al enviar correo';
        console.error('[Resend Exception]', mailErr);
      }

      // Actualizar estado de correo en DB sin bloquear respuesta al cliente
      if (insertedId) {
        fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${insertedId}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email_status: emailStatus, email_error: emailErrorMsg })
        }).catch(e => console.error('[Supabase Status Update Error]', e));
      }
    } else {
      console.warn('[Resend] RESEND_API_KEY no configurada. Correo omitido.');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        folio: folioReal,
        total: computedTotalMXN,
        email_status: emailStatus
      })
    };

  } catch (error) {
    console.error('[Server Error in orders.js]', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Hubo un inconveniente al procesar tu cotización. Por favor reintenta.' })
    };
  }
};
