// Prueba de "Editar mi día": mover/cambiar con señal, saltar sin señal, y que se suba al volver.
const { chromium } = require('playwright');
const OUT = process.argv[2] || require('os').tmpdir();
const ESQUEMA = process.argv[3] || 'light';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'allow', timezoneId: 'America/Santiago', colorScheme: ESQUEMA });
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  // Eventos de hoy en hora de Santiago (UTC-3 en noviembre)
  const ms = (hh, mm) => Date.parse(hoy + 'T' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ':00-03:00');
  const fmt = (t) => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t));
  const ev = (id, titulo, a, b) => ({ id, titulo, todoElDia: false, inicio: fmt(a), fin: fmt(b), inicioMs: a, finMs: b });
  let servidor = [
    { id: 'serie-cerro', titulo: 'Cerro', todoElDia: true, inicio: '', fin: '', inicioMs: ms(0, 0), finMs: ms(23, 59) },
    ev('serie-trote', 'Trote', ms(23, 0), ms(23, 40)),
    ev('serie-skool', 'Bloque de foco: academia Skool', ms(23, 45), ms(23, 59)),
  ];
  const llamadas = [];
  await ctx.route('https://script.google.com/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    llamadas.push(body);
    let data = 'ok';
    if (body.fn === 'editarAgenda') {
      const aplicados = [];
      (body.args[0].ops || []).forEach((op) => {
        const i = servidor.findIndex((e) => e.id === op.id && Math.abs(e.inicioMs - op.inicioMs) < 60000);
        if (i < 0) return;
        if (op.accion === 'saltar') servidor.splice(i, 1);
        else {
          if (op.titulo) servidor[i].titulo = op.titulo;
          if (op.nuevoInicioMs) Object.assign(servidor[i], { inicioMs: op.nuevoInicioMs, finMs: op.nuevoFinMs, inicio: fmt(op.nuevoInicioMs), fin: fmt(op.nuevoFinMs) });
        }
        aplicados.push(op.opId);
      });
      data = { aplicados, errores: [] };
    } else if (body.fn === 'sync') {
      data = { aplicados: (body.args[0].ops || []).map((o) => o.opId), desde: '2026-07-01', diario: [], estudio: [], agenda: { [hoy]: JSON.parse(JSON.stringify(servidor)) }, servidor: Date.now() };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto('http://127.0.0.1:8765/#clave=abc123');
  await p.waitForTimeout(2500);
  const agenda = async () => p.$$eval('#agenda li', (ls) => ls.map((l) => l.innerText.replace(/\s+/g, ' ').trim() + (l.classList.contains('editable') ? ' [e]' : '')));
  const r = { inicial: await agenda(), pista: await p.isVisible('#agenda-pista') };
  await p.screenshot({ path: `${OUT}/editar-hoy-${ESQUEMA}.png` });

  // 1) Mover y renombrar el bloque Skool, con señal
  await p.click('#agenda li:has-text("Skool")');
  await p.waitForTimeout(300);
  r.dialogo = await p.isVisible('#hoja-editar');
  await p.screenshot({ path: `${OUT}/editar-hoja-${ESQUEMA}.png` });
  await p.fill('#he-nombre', 'Tienda / Mercado Libre');
  await p.fill('#he-ini', '22:00');
  await p.fill('#he-fin', '23:00');
  await p.click('#he-guardar');
  await p.waitForTimeout(400);
  r.trasGuardarLocal = await agenda();
  await p.waitForTimeout(3000);
  const ed = llamadas.filter((c) => c.fn === 'editarAgenda');
  r.opEnviada = ed.length ? ed[0].args[0].ops.map((o) => ({ accion: o.accion, id: o.id, titulo: o.titulo, ini: fmt(o.nuevoInicioMs), fin: fmt(o.nuevoFinMs), orig: fmt(o.inicioMs) })) : null;
  r.trasSync = await agenda();
  r.estado1 = await p.textContent('#sync-estado');

  // 2) Saltar el trote sin señal
  await ctx.setOffline(true);
  await p.evaluate(() => window.dispatchEvent(new Event('offline')));
  await p.click('#agenda li:has-text("Trote")');
  await p.waitForTimeout(300);
  await p.click('#he-saltar');
  await p.waitForTimeout(500);
  r.offlineAgenda = await agenda();
  r.offlineEstado = await p.textContent('#sync-estado');
  const nAntes = llamadas.filter((c) => c.fn === 'editarAgenda').length;
  // recarga sin señal: el cambio sigue
  await p.reload();
  await p.waitForTimeout(2000);
  r.offlineTrasRecarga = await agenda();
  // 3) Vuelve la señal
  await ctx.setOffline(false);
  await p.evaluate(() => window.dispatchEvent(new Event('online')));
  await p.waitForTimeout(4000);
  const ed2 = llamadas.filter((c) => c.fn === 'editarAgenda').slice(nAntes);
  r.opsAlVolver = ed2.map((c) => c.args[0].ops.map((o) => o.accion + ':' + o.id));
  r.final = await agenda();
  r.servidor = servidor.map((e) => (e.inicio || 'todo') + ' ' + e.titulo);
  r.estadoFinal = await p.textContent('#sync-estado');
  await p.screenshot({ path: `${OUT}/editar-final-${ESQUEMA}.png` });
  r.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  r.errores = errores;
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
