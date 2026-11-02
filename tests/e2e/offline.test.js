// Prueba de Predyctor sin red: carga con señal, pasa a modo avión, marca checks y estudio, vuelve la señal y sincroniza.
const { chromium } = require('playwright');
const OUT = process.argv[2] || require('os').tmpdir();
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'allow' });
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const llamadas = [];
  await ctx.route('https://script.google.com/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    llamadas.push(body);
    let data = null;
    if (body.fn === 'sync') {
      const ops = (body.args[0] || {}).ops || [];
      data = {
        aplicados: ops.map((o) => o.opId),
        desde: '2026-07-01',
        diario: [{ fecha: '2026-10-27', celular_fuera: true, sin_ig_despertar: true, entreno: true, bloque: false, instagram_min: 120, postulaciones: 1, nota: '', actualizado: 1 }]
          .concat(ops.filter((o) => o.tipo === 'diario').map((o) => o.datos)),
        estudio: [{ id: 'fila-2', fecha: '2026-10-27', inicio: '21:00', minutos: 45, tema: 'h_trading' }]
          .concat(ops.filter((o) => o.tipo === 'estudio').map((o) => o.datos)),
        agenda: { [hoy]: [{ titulo: 'Bloque de foco: academia Skool', todoElDia: false, inicio: '21:15', fin: '22:15', inicioMs: Date.now() + 3600e3, finMs: Date.now() + 7200e3 }] },
        servidor: Date.now(),
      };
    } else data = 'ok';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto('http://127.0.0.1:8765/#clave=abc123');
  await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null, null, { timeout: 15000 }).catch(() => {});
  await p.reload();
  await p.waitForTimeout(2500);
  const antes = await p.textContent('#sync-estado');
  const agendaOnline = await p.textContent('#agenda');

  // Modo avión
  await ctx.setOffline(true);
  await p.reload();
  await p.waitForTimeout(2500);
  const offlineCarga = await p.isVisible('#v-hoy');
  const agendaOffline = await p.textContent('#agenda');
  await p.click('.check[data-k="entreno"]');
  await p.click('.check[data-k="bloque"]');
  await p.waitForTimeout(800);
  await p.click('.tab[data-v="estudio"]');
  await p.fill('#man-min', '30');
  await p.click('#man-guardar');
  await p.waitForTimeout(500);
  await p.click('.tab[data-v="hoy"]');
  await p.waitForTimeout(300);
  const estadoOffline = await p.textContent('#sync-estado');
  await p.screenshot({ path: OUT + '/offline-hoy.png', fullPage: true });
  await p.click('.tab[data-v="progreso"]');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: OUT + '/offline-progreso.png', fullPage: true });
  const llamadasOffline = llamadas.length;

  // Vuelve la señal
  await ctx.setOffline(false);
  await p.evaluate(() => window.dispatchEvent(new Event('online')));
  await p.waitForTimeout(3500);
  await p.click('.tab[data-v="hoy"]');
  const estadoOnline = await p.textContent('#sync-estado');
  const ultima = llamadas.filter((c) => c.fn === 'sync').pop();
  const opsEnviadas = ultima ? ultima.args[0].ops.map((o) => o.tipo + ':' + (o.datos.fecha || '') + (o.datos.minutos ? ':' + o.datos.minutos : '')) : [];
  await p.screenshot({ path: OUT + '/online-hoy.png', fullPage: true });
  console.log(JSON.stringify({ antes, agendaOnline, offlineCarga, agendaOffline, estadoOffline, llamadasOffline, llamadasTotales: llamadas.length, opsEnviadas, estadoOnline, errores }, null, 1));
  await browser.close();
})();
