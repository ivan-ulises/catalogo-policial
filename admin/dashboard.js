/**
 * @file admin/dashboard.js
 * @description Métricas y KPIs de cotizaciones para el panel administrativo.
 */

import { getSupabase } from './auth.js';

export async function renderDashboard() {
  const sb = getSupabase();
  const container = document.getElementById('dashboard-metrics-container');
  if (!container) return;

  container.innerHTML = `
    <div class="p-12 text-center text-slate-400">
      <svg class="w-8 h-8 mx-auto animate-spin mb-3 text-[#FFD700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <p>Calculando analíticas...</p>
    </div>`;

  try {
    // Obtener todas las órdenes para análisis
    const { data: orders, error } = await sb
      .from('orders')
      .select('id, folio, fecha, municipio, total_mxn, total_piezas, status, items_snapshot');

    if (error) throw error;

    // Filtrar órdenes reales (excluir estatus 'prueba' y 'cancelada' de las métricas comerciales)
    const realOrders = orders.filter(o => o.status !== 'prueba' && o.status !== 'cancelada');

    const ordersThisMonth = realOrders.filter(o => {
      if (!o.fecha) return false;
      const d = new Date(o.fecha);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalOrdersMonth = ordersThisMonth.length;
    const totalMontoMonth = ordersThisMonth.reduce((acc, o) => acc + Number(o.total_mxn || 0), 0);

    // Tasa de aprobación histórica sobre órdenes reales
    const totalApproved = realOrders.filter(o => o.status === 'aprobada' || o.status === 'entregada').length;
    const approvalRate = realOrders.length > 0 ? Math.round((totalApproved / realOrders.length) * 100) : 0;

    // Municipios recurrentes
    const muniCounts = {};
    orders.forEach(o => {
      const m = (o.municipio || 'Sin especificar').trim();
      muniCounts[m] = (muniCounts[m] || 0) + 1;
    });
    const sortedMunis = Object.entries(muniCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Productos más cotizados (a partir de items_snapshot)
    const prodCounts = {};
    orders.forEach(o => {
      if (Array.isArray(o.items_snapshot)) {
        o.items_snapshot.forEach(it => {
          const name = it.nombre || 'Desconocido';
          prodCounts[name] = (prodCounts[name] || 0) + Number(it.cantidad || 1);
        });
      }
    });
    const sortedProds = Object.entries(prodCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    container.innerHTML = `
      <!-- Tarjetas Principales de KPI -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <span class="text-xs uppercase font-bold text-slate-400 block mb-1">Cotizaciones del Mes</span>
          <span class="text-2xl font-bold font-mono text-slate-100">${totalOrdersMonth}</span>
          <span class="text-[11px] text-slate-500 block mt-1">Total histórico: ${orders.length}</span>
        </div>

        <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <span class="text-xs uppercase font-bold text-slate-400 block mb-1">Monto Cotizado (Mes)</span>
          <span class="text-2xl font-bold font-mono text-[#FFD700]">
            $${totalMontoMonth.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
          </span>
          <span class="text-[11px] text-slate-500 block mt-1">MXN con IVA incluido</span>
        </div>

        <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <span class="text-xs uppercase font-bold text-slate-400 block mb-1">Tasa de Aprobación</span>
          <span class="text-2xl font-bold font-mono ${approvalRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}">
            ${approvalRate}%
          </span>
          <span class="text-[11px] text-slate-500 block mt-1">${totalApproved} de ${orders.length} requisiciones</span>
        </div>

        <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <span class="text-xs uppercase font-bold text-slate-400 block mb-1">Total Piezas Solicitadas</span>
          <span class="text-2xl font-bold font-mono text-blue-400">
            ${orders.reduce((acc, o) => acc + Number(o.total_piezas || 0), 0).toLocaleString('es-MX')}
          </span>
          <span class="text-[11px] text-slate-500 block mt-1">Unidades físicas acumuladas</span>
        </div>
      </div>

      <!-- Tablas Desglosadas de Productos y Municipios -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Top Productos -->
        <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <h3 class="text-xs uppercase font-bold text-slate-300 tracking-wider mb-3">Productos Más Solicitados</h3>
          <div class="space-y-2">
            ${sortedProds.length > 0 ? sortedProds.map(([pName, qty]) => `
              <div class="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/60">
                <span class="text-slate-200 font-medium truncate max-w-xs">${pName}</span>
                <span class="font-mono font-bold text-[#FFD700]">${qty} pzas</span>
              </div>`).join('') : '<p class="text-xs text-slate-500">Sin datos registrados.</p>'}
          </div>
        </div>

        <!-- Top Municipios -->
        <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <h3 class="text-xs uppercase font-bold text-slate-300 tracking-wider mb-3">Municipios / Agencias Recurrentes</h3>
          <div class="space-y-2">
            ${sortedMunis.length > 0 ? sortedMunis.map(([mName, count]) => `
              <div class="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/60">
                <span class="text-slate-200 font-medium truncate max-w-xs">${mName}</span>
                <span class="font-mono font-bold text-blue-400">${count} cotiz.</span>
              </div>`).join('') : '<p class="text-xs text-slate-500">Sin datos registrados.</p>'}
          </div>
        </div>
      </div>`;
  } catch (err) {
    console.error('[renderDashboard error]', err);
    container.innerHTML = `
      <div class="p-8 text-center text-red-400">
        <p class="font-bold">Error al cargar métricas del panel</p>
        <p class="text-xs opacity-80">${err.message}</p>
      </div>`;
  }
}
