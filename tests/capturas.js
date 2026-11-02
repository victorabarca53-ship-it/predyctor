// Genera las capturas del README con datos de demostración (sin datos reales).
// Uso: python3 -m http.server 8765 --bind 127.0.0.1   y en otra terminal:   node tests/capturas.js
const path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, '..', 'docs', 'img');

(async () => {
  const browser = await chromium.launch();
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dia = (n) => { const d = new Date(hoy + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const ms = (hh, mm) => Date.parse(hoy + 'T' + hh + ':' + mm + ':00-03:00');
  const diario = [];
  const estudio = [];
  for (let i = 0; i < 26; i++) {
    const mejora = Math.min(1, (26 - i) / 18);
    diario.push({ fecha: dia(i), celular_fuera: i % 4 !== 1, sin_ig_despertar: i % 3 !== 0, entreno: i % 2 === 0, bloque: i % 5 !== 3, instagram_min: Math.round(200 - mejora * 110 + (i % 3) * 8), postulaciones: i % 3 === 0 ? 2 : 0, nota: '', actualizado: 1 });
    if (i > 0 && i % 7 !== 6) estudio.push({ id: 'e' + i, fecha: dia(i), inicio: '21:00', minutos: [45, 60, 30][i % 3], tema: ['h_trading', 'h_tienda', 'h_busqueda_pega', 'h_skool'][i % 4] });
  }
  const agenda = { [hoy]: [
    { id: 'a1', titulo: 'Turno', todoElDia: false, inicio: '08:00', fin: '17:30', inicioMs: ms('08', '00'), finMs: ms('17', '30') },
    { id: 'a2', titulo: 'Trote', todoElDia: false, inicio: '19:00', fin: '19:45', inicioMs: ms('19', '00'), finMs: ms('19', '45') },
    { id: 'a3', titulo: 'Bloque de foco: trading demo', todoElDia: false, inicio: '21:00', fin: '22:00', inicioMs: ms('21', '00'), finMs: ms('22', '00') },
    { id: 'a4', titulo: 'Celular fuera', todoElDia: false, inicio: '23:30', fin: '23:45', inicioMs: ms('23', '30'), finMs: ms('23', '45') },
  ] };

  async function pagina(esquema, paleta) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'America/Santiago', colorScheme: esquema });
    await ctx.route('https://script.google.com/**', (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const data = body.fn === 'sync' ? { aplicados: [], desde: dia(120), diario, estudio, agenda, servidor: Date.now() } : 'ok';
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
    });
    await ctx.addInitScript((p) => { localStorage.setItem('rt-paleta', JSON.stringify(p)); }, paleta);
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8765/#clave=demo00');
    await p.waitForTimeout(2200);
    return p;
  }
  const foto = (p, nombre, opts = {}) => p.screenshot(Object.assign({ path: path.join(OUT, nombre) }, opts));

  let p = await pagina('light', 'sendero');
  await p.waitForTimeout(300);
  await foto(p, 'hoy.png');
  await p.click('#agenda li:has-text("Trote")');
  await p.waitForTimeout(300);
  await foto(p, 'editar.png');
  await p.click('#he-cancelar');
  await p.click('#abrir-ajustes');
  await p.waitForTimeout(300);
  await foto(p, 'paletas.png');
  await p.context().close();

  p = await pagina('dark', 'sendero');
  await p.click('.tab[data-v="estudio"]');
  await p.waitForTimeout(300);
  await p.click('#m-descanso');
  await p.waitForTimeout(200);
  await foto(p, 'estudio.png');
  await p.context().close();

  p = await pagina('dark', 'atacama');
  await p.click('.tab[data-v="progreso"]');
  await p.waitForTimeout(1600);
  await foto(p, 'progreso.png');
  await p.context().close();

  await browser.close();
  console.log('Capturas en', OUT);
})();
