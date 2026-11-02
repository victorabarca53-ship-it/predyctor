// Paletas: cambia cada paleta, en claro y oscuro, revisa tokens, gráficos y barra del sistema.
const { chromium } = require('playwright');
const OUT = process.argv[2] || require('os').tmpdir();
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'America/Santiago', colorScheme: 'dark' });
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dia = (n) => { const d = new Date(hoy + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const diario = [], estudio = [];
  for (let i = 1; i < 24; i++) {
    diario.push({ fecha: dia(i), celular_fuera: i % 3 !== 0, sin_ig_despertar: i % 2 === 0, entreno: i % 2 === 1, bloque: i % 4 !== 0, instagram_min: 200 - i * 5, postulaciones: i % 3, nota: '', actualizado: 1 });
    if (i % 2) estudio.push({ id: 'e' + i, fecha: dia(i), inicio: '21:00', minutos: 45 + (i % 3) * 15, tema: ['h_trading', 'h_tienda', 'h_busqueda_pega', 'h_skool'][i % 4] });
  }
  await ctx.route('https://script.google.com/**', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const data = body.fn === 'sync' ? { aplicados: [], desde: '2026-07-01', diario, estudio, agenda: { [hoy]: [{ id: 'a', titulo: 'Trading demo', todoElDia: false, inicio: '21:00', fin: '22:00', inicioMs: Date.now() + 3600e3, finMs: Date.now() + 7200e3 }] }, servidor: Date.now() } : 'ok';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto('http://127.0.0.1:8765/#clave=abc123');
  await p.waitForTimeout(2500);
  const r = {};
  const tok = () => p.evaluate(() => { const c = getComputedStyle(document.documentElement); return ['--bg', '--accent', '--amber'].map((v) => c.getPropertyValue(v).trim()).join(' ') + ' meta:' + document.querySelector('meta[name=theme-color]').content; });
  r.inicio = await tok();
  await p.click('#abrir-ajustes');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/ajustes-oscuro.png` });
  for (const nombre of ['Pacífico', 'Atacama', 'Cordillera']) {
    await p.click(`.paleta:has-text("${nombre}")`);
    r[nombre + '-oscuro'] = await tok();
  }
  await p.click('#modos-color button[data-m="claro"]');
  r['Cordillera-claro-forzado'] = await tok();
  await p.screenshot({ path: `${OUT}/ajustes-claro.png` });
  await p.click('#aj-cerrar');
  // Recarga: debe recordar paleta y modo
  await p.reload();
  await p.waitForTimeout(2000);
  r.trasRecarga = await tok() + ' ' + (await p.evaluate(() => document.documentElement.dataset.paleta + '/' + document.documentElement.dataset.modo));
  for (const [k, modo] of [['pacifico', 'claro'], ['atacama', 'oscuro'], ['sendero', 'auto']]) {
    await p.evaluate(([k, modo]) => { localStorage.setItem('rt-paleta', JSON.stringify(k)); localStorage.setItem('rt-modo-color', JSON.stringify(modo)); }, [k, modo]);
    await p.reload();
    await p.waitForTimeout(1800);
    await p.screenshot({ path: `${OUT}/hoy-${k}-${modo}.png` });
    await p.click('.tab[data-v="progreso"]');
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/progreso-${k}-${modo}.png`, fullPage: true });
    await p.click('.tab[data-v="estudio"]');
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/estudio-${k}-${modo}.png` });
    await p.click('.tab[data-v="hoy"]');
  }
  r.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  r.errores = errores;
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
