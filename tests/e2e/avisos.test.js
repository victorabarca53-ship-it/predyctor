// "Avisarme antes": elegir el aviso de una actividad, verlo en la agenda y que llegue al motor.
const { chromium } = require('playwright');
const OUT = process.argv[2] || require('os').tmpdir();
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'America/Santiago' });
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const ms = (h) => Date.parse(hoy + 'T' + h + ':00-03:00');
  const fmt = (t) => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t));
  const servidor = [
    { id: 'clase', titulo: 'Clase en vivo: Binarias con Lolo', todoElDia: false, inicioMs: ms('23:00'), finMs: ms('23:59'), avisos: [30, 15] },
    { id: 'trote', titulo: 'Trote', todoElDia: false, inicioMs: ms('23:10'), finMs: ms('23:50'), avisos: [10] },
  ].map((e) => Object.assign(e, { inicio: fmt(e.inicioMs), fin: fmt(e.finMs) }));
  const enviados = [];
  await ctx.route('https://script.google.com/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    let data = 'ok';
    if (body.fn === 'editarAgenda') {
      const ops = body.args[0].ops;
      ops.forEach((op) => { enviados.push(op); const ev = servidor.find((e) => e.id === op.id); if (ev && op.avisos) ev.avisos = op.avisos; });
      data = { aplicados: ops.map((o) => o.opId), errores: [] };
    } else if (body.fn === 'sync') {
      data = { aplicados: [], desde: '2026-07-01', diario: [], estudio: [], agenda: { [hoy]: JSON.parse(JSON.stringify(servidor)) }, servidor: Date.now() };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto('http://127.0.0.1:8765/#clave=abc123');
  await p.waitForTimeout(2500);
  const agenda = () => p.$$eval('#agenda li', (ls) => ls.map((l) => l.innerText.replace(/\s+/g, ' ').trim()));
  const r = { inicial: await agenda() };
  await p.click('#agenda li:has-text("Trote")');
  await p.waitForTimeout(300);
  r.opciones = await p.$$eval('#he-avisos .chip', (b) => b.map((x) => x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')));
  await p.click('#he-avisos .chip:has-text("30 y 15 min")');
  await p.screenshot({ path: OUT + '/avisos-hoja.png' });
  await p.click('#he-guardar');
  await p.waitForTimeout(3500);
  r.enviado = enviados.map((o) => o.accion + ':' + o.id + ':' + JSON.stringify(o.avisos) + ':' + (o.titulo || '') + ':' + (o.nuevoInicioMs || ''));
  r.final = await agenda();
  // Abrir de nuevo: debe venir marcado 30 y 15
  await p.click('#agenda li:has-text("Trote")');
  await p.waitForTimeout(300);
  r.reabrir = await p.$$eval('#he-avisos .chip[aria-pressed="true"]', (b) => b.map((x) => x.textContent));
  // Guardar sin cambios no manda nada
  const antes = enviados.length;
  await p.click('#he-guardar');
  await p.waitForTimeout(2000);
  r.sinCambiosNoEnvia = enviados.length === antes;
  r.errores = errores;
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
