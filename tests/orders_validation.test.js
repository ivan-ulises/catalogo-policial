/**
 * @file tests/orders_validation.test.js
 * @description Suite de pruebas unitarias para validación, matemática financiera
 * y recálculo de órdenes en servidor. Ejecutable directamente con Node.js.
 */

const assert = require('assert');

// 1. Prueba de Matemática Financiera (Subtotal s/IVA, IVA 16% y Total)
function calculateTotals(items, catalogMap) {
  let computedTotalMXN = 0;
  let totalPiezas = 0;
  const snapshot = [];

  for (const item of items) {
    const product = catalogMap[item.id_producto];
    if (!product) throw new Error(`Producto no encontrado: ${item.id_producto}`);
    
    const qty = parseInt(item.qty, 10);
    if (isNaN(qty) || qty < 1 || qty > 10000) throw new Error(`Cantidad inválida: ${item.qty}`);

    const unitPrice = Number(product.precio_unitario);
    const subtotalItem = unitPrice * qty;

    computedTotalMXN += subtotalItem;
    totalPiezas += qty;

    snapshot.push({
      id_producto: product.id_producto,
      nombre: product.nombre_bien,
      precio_unitario: unitPrice,
      cantidad: qty,
      subtotal: subtotalItem
    });
  }

  const subtotalSinIVA = Number((computedTotalMXN / 1.16).toFixed(2));
  const iva = Number((computedTotalMXN - subtotalSinIVA).toFixed(2));
  computedTotalMXN = Number(computedTotalMXN.toFixed(2));

  return { subtotalSinIVA, iva, totalMXN: computedTotalMXN, totalPiezas, snapshot };
}

// 2. Mock de Catálogo Oficial (como vendría de la DB)
const mockCatalog = {
  'PROD-01': { id_producto: 'PROD-01', nombre_bien: 'Gorra Gabardina', precio_unitario: 100.00 },
  'PROD-02': { id_producto: 'PROD-02', nombre_bien: 'Gorra Licra', precio_unitario: 170.00 },
  'PROD-03': { id_producto: 'PROD-03', nombre_bien: 'Playera Polo', precio_unitario: 390.00 }
};

console.log('🚀 Iniciando suite de pruebas unitarias para Blindaje de Órdenes...\n');

// Test 1: Cálculo exacto ignorando montos del cliente
{
  const clientPayload = [
    { id_producto: 'PROD-01', qty: 3, clientPriceHacked: 1.00 }, // Intento de manipulación de precio
    { id_producto: 'PROD-02', qty: 4, clientPriceHacked: 5.00 }
  ];

  const res = calculateTotals(clientPayload, mockCatalog);
  assert.strictEqual(res.totalPiezas, 7, 'Total de piezas debe ser 7');
  // (3 * 100) + (4 * 170) = 300 + 680 = 980
  assert.strictEqual(res.totalMXN, 980.00, 'Total oficial debe ser $980.00 MXN');
  
  // 980 / 1.16 = 844.8275 -> 844.83
  assert.strictEqual(res.subtotalSinIVA, 844.83, 'Subtotal sin IVA debe redondearse a 844.83');
  // 980 - 844.83 = 135.17
  assert.strictEqual(res.iva, 135.17, 'IVA 16% debe ser 135.17');
  assert.strictEqual(Number((res.subtotalSinIVA + res.iva).toFixed(2)), 980.00, 'Suma de subtotal + IVA debe ser igual al Total');
  console.log('✔ Test 1: Matemática financiera y rechazo de precios manipulados PASÓ');
}

// Test 2: Rechazo de producto inexistente
{
  const clientPayload = [
    { id_producto: 'PROD-INEXISTENTE', qty: 2 }
  ];

  assert.throws(() => {
    calculateTotals(clientPayload, mockCatalog);
  }, /Producto no encontrado/, 'Debe arrojar error si un producto no existe en el catálogo');
  console.log('✔ Test 2: Rechazo de productos inválidos/inexistentes PASÓ');
}

// Test 3: Rechazo de cantidades fuera de rango
{
  const testCases = [
    [{ id_producto: 'PROD-01', qty: 0 }],
    [{ id_producto: 'PROD-01', qty: -5 }],
    [{ id_producto: 'PROD-01', qty: 10001 }],
    [{ id_producto: 'PROD-01', qty: 'abc' }]
  ];

  for (const tc of testCases) {
    assert.throws(() => {
      calculateTotals(tc, mockCatalog);
    }, /Cantidad inválida/, `Debe rechazar cantidad inválida: ${tc[0].qty}`);
  }
  console.log('✔ Test 3: Rechazo de cantidades fuera de rango (1 - 10,000) PASÓ');
}

// Test 4: Formato de Folio Canónico
{
  function generateServerFolio() {
    const year = new Date().getFullYear();
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const timeStr = Date.now().toString(36).slice(-3).toUpperCase();
    return `COT-${year}-${randomStr}${timeStr}`;
  }

  const folio = generateServerFolio();
  const regex = /^COT-\d{4}-[A-Z0-9]{7}$/;
  assert.match(folio, regex, 'El folio debe cumplir con el patrón COT-YYYY-XXXXXXX');
  console.log(`✔ Test 4: Generación de folio server-side (${folio}) PASÓ`);
}

console.log('\n🎉 ¡TODAS LAS PRUEBAS UNITARIAS PASARON EXITOSAMENTE!');
