# Catálogo de Eventos (CustomEvents)

El sistema utiliza una arquitectura basada en eventos desacoplados mediante `document.dispatchEvent(new CustomEvent(name, { detail }))`.
Ningún componente visual importa o manipula directamente a otro.

---

## 1. `product:add`
* **Descripción:** Se dispara cuando el usuario presiona "Agregar al Pedido" en una tarjeta del catálogo.
* **Emisor:** `components/catalog.js`
* **Receptor:** `components/cart.js`
* **Estructura del Payload (`event.detail`):**
```javascript
{
  id: "P-01",               // string: ID único del producto
  sku: "GOR-GAB-01",        // string: SKU o clave interna
  name: "Gorra Gabardina",  // string: Nombre descriptivo
  price: 100.00,            // number: Precio unitario con IVA en MXN
  size: "Unitalla",         // string: Talla seleccionada (o 'Unitalla')
  color: "Negro",           // string | null: Color seleccionado
  qty: 2,                   // number: Cantidad de piezas a agregar
  variant: null,            // string | null: Variante especial si aplica
  slotInfo: null            // string | null: Slots o accesorios adicionales
}
```

---

## 2. `cart:updated`
* **Descripción:** Se dispara cada vez que el estado interno del carrito cambia (alta, baja o cambio de cantidad).
* **Emisor:** `components/cart.js`
* **Receptor:** `main.js` (u otros observadores para logs/telemetría)
* **Estructura del Payload (`event.detail`):**
```javascript
{
  count: 5,                 // number: Total acumulado de piezas físicas
  total: 850.00             // number: Importe total acumulado en MXN (con IVA)
}
```

---

## 3. `cart:checkout`
* **Descripción:** Se dispara cuando el usuario pulsa "GENERAR PEDIDO" en el sidebar del carrito.
* **Emisor:** `components/cart.js`
* **Receptor:** `utils/orders.js`
* **Estructura del Payload (`event.detail`):**
```javascript
{
  items: [                  // Array de ítems activos en el carrito
    {
      id: "P-01",
      sku: "GOR-GAB-01",
      name: "Gorra Gabardina",
      size: "Unitalla",
      color: "Negro",
      qty: 3,
      unitPrice: 100.00,
      variant: null,
      slotInfo: null
    }
  ],
  total: 300.00             // number: Total general con IVA
}
```

---

## 4. `cart:whatsapp`
* **Descripción:** Solicita la apertura de la ventana de WhatsApp con el desglose del pedido preformateado.
* **Emisor:** `utils/orders.js` (tras guardar pedido) o `components/cart.js` (botón directo de WhatsApp)
* **Receptor:** `utils/whatsapp.js`
* **Estructura del Payload (`event.detail`):**
```javascript
{
  items: [ ... ],           // Array de ítems del pedido
  total: 300.00,            // number: Total en MXN
  municipio: "Oaxaca de Juárez" // string: Nombre del municipio (opcional)
}
```

---

## 5. `ui:toast`
* **Descripción:** Muestra una notificación visual temporal en la parte inferior o superior de la pantalla.
* **Emisor:** Cualquier módulo (`catalog.js`, `cart.js`, `orders.js`, `whatsapp.js`)
* **Receptor:** `main.js`
* **Estructura del Payload (`event.detail`):**
```javascript
{
  msg: "✓ Producto agregado al pedido" // string: Mensaje a mostrar al usuario
}
```

---

## 6. `wa:floatClick`
* **Descripción:** Notifica que el usuario hizo clic en el botón flotante de WhatsApp.
* **Emisor:** `utils/whatsapp.js`
* **Receptor:** `main.js`
* **Estructura del Payload (`event.detail`):**
```javascript
{} // Sin payload; main.js responde consultando getCartItems() y getCartTotal()
```
