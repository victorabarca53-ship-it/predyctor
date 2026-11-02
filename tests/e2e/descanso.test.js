const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme });
    await ctx.route('https://script.google.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { aplicados: [], desde: '2026-07-01', diario: [], estudio: [], agenda: {}, servidor: 1 } }) }));
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.goto('http://127.0.0.1:8765/#clave=abc'); await p.waitForTimeout(2000);
    await p.click('.tab[data-v="estudio"]'); await p.waitForTimeout(300);
    const r = {};
    r.focoDurs = await p.$$eval('#durs .chip', els => els.map(e => e.textContent));
    // Simular fin de una tanda corta: arrancar foco y adelantar el fin
    await p.click('#t-iniciar');
    await p.evaluate(() => { const t = JSON.parse(localStorage.getItem('rt-timer')); });
    await p.evaluate(() => { /* forzar fin */ });
    r.durDisabledRunning = await p.$eval('#durs .chip', e => e.disabled);
    // forzar fin modificando finMs vía evento: pausar, editar storage, recargar
    await p.click('#t-iniciar'); // pausa
    await p.evaluate(() => { const t = JSON.parse(localStorage.getItem('rt-timer')); t.corriendo = true; t.finMs = Date.now() - 1000; localStorage.setItem('rt-timer', JSON.stringify(t)); });
    await p.reload(); await p.waitForTimeout(2500);
    await p.click('.tab[data-v="estudio"]').catch(() => {}); await p.waitForTimeout(500);
    r.trasFin = { modo: await p.getAttribute('#m-descanso', 'aria-selected'), reloj: await p.textContent('#reloj-f'), pista: await p.textContent('#pista'), durs: await p.$$eval('#durs .chip', els => els.map(e => e.textContent)), fase: await p.evaluate(() => JSON.parse(localStorage.getItem('rt-timer')).fase) };
    await p.screenshot({ path: (process.argv[2] || require('os').tmpdir()) + '/descanso-' + scheme + '.png' });
    // elegir 15 y partir descanso, luego reiniciar y volver a elegir
    await p.click('#durs .chip:nth-child(3)'); await p.click('#t-iniciar'); await p.waitForTimeout(400);
    r.enDescanso = await p.textContent('#reloj-f');
    await p.click('#t-reset'); await p.waitForTimeout(300);
    r.trasReset = { modo: await p.getAttribute('#m-descanso', 'aria-selected'), durs: await p.$$eval('#durs .chip', els => els.map(e => e.textContent + (e.getAttribute('aria-pressed') === 'true' ? '*' : ''))), reloj: await p.textContent('#reloj-t') };
    await p.click('#m-foco'); await p.waitForTimeout(200);
    r.vueltaFoco = { durs: await p.$$eval('#durs .chip', els => els.map(e => e.textContent)), guardarVisible: await p.isVisible('#t-guardar') };
    r.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    r.err = err;
    console.log(scheme, JSON.stringify(r));
    await ctx.close();
  }
  await b.close();
})();
