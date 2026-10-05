---
name: resend-email
description: Integración de correo transaccional con Resend API (dominio verificado, plantillas HTML formales y control de adjuntos).
---

# Resend Email Integration

Estándar para el envío de requisiciones y cotizaciones por correo electrónico vía Resend.

## Principios Clave
1. **Dominio verificado en producción:** Migrar del remitente sandbox (`onboarding@resend.dev`) a un correo con dominio propio (ej. `cotizaciones@suministrosar.com.mx`) mediante registros DNS DKIM/SPF.
2. **Plantilla HTML institucional:** Correo limpio, sobrio y compatible con clientes de correo habituales (Gmail, Outlook institucional).
3. **Manejo seguro de adjuntos:** Limpiar prefijos Data URI antes de enviar el buffer en Base64; nombrar el archivo con el folio o municipio para fácil identificación.
4. **Resiliencia ante fallos:** Si el correo falla por cuota o red, la orden debe quedar registrada en la base de datos de todos modos para no perder la venta.

## Checklist de Correo
- [ ] Validar presencia de `RESEND_API_KEY` en entorno.
- [ ] Sanitizar Base64 del PDF (`replace(/^data:.*base64,/, '')`).
- [ ] Probar recepción en la bandeja operativa (`terminalasuncion.1@gmail.com`).
- [ ] Verificar que el remitente y asunto contengan el folio comercial (`COT-XXXX`).
- [ ] Registrar logs de error claros si Resend responde con estatus distinto a 200.
