// Prueba del motor plantilla con servicios de Apps Script simulados.
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(require('path').join(__dirname, '..', 'motor', 'Code.gs'), 'utf8');

// --- Simulaciones mínimas ---
function hojaSim(nombre) {
  const data = [];
  const rng = (r, c, nr = 1, nc = 1) => ({
    setValues(v) { for (let i = 0; i < nr; i++) { data[r - 1 + i] = data[r - 1 + i] || []; for (let j = 0; j < nc; j++) data[r - 1 + i][c - 1 + j] = v[i][j]; } return this; },
    setValue(v) { data[r - 1] = data[r - 1] || []; data[r - 1][c - 1] = v; return this; },
    getValue() { return (data[r - 1] || [])[c - 1]; },
    getValues() { return data.slice(r - 1, r - 1 + nr).map((f) => f.slice(c - 1, c - 1 + nc)); },
    setFontWeight() { return this; }, setNumberFormat() { return this; },
  });
  return {
    nombre, data,
    getRange: (a, b, c, d) => rng(a, b, c, d),
    getLastRow: () => data.length,
    getDataRange: () => ({ getValues: () => data.map((f) => f.slice()) }),
    setFrozenRows() {},
  };
}
const hojas = {};
const libro = { getSheetByName: (n) => hojas[n] || null, insertSheet: (n) => (hojas[n] = hojaSim(n)) };
const props = {};
const eventos = [];
let seq = 0;
function evento(titulo, ini, fin, opts = {}) {
  const e = { id: opts.id || 'ev' + (++seq), titulo, ini: new Date(ini), fin: new Date(fin), desc: opts.description || '', todo: !!opts.todo, borrado: false, avisos: [10] };
  return {
    _e: e,
    getId: () => e.id, getTitle: () => e.titulo, isAllDayEvent: () => e.todo,
    getStartTime: () => e.ini, getEndTime: () => e.fin, getDescription: () => e.desc,
    setTitle: (t) => { e.titulo = t; }, setTime: (a, b) => { e.ini = a; e.fin = b; },
    deleteEvent: () => { e.borrado = true; }, removeAllReminders: () => { e.avisos = []; }, addPopupReminder: (m) => { e.avisos.push(m); },
    getPopupReminders: () => e.avisos.slice(),
  };
}
const cal = {
  getName: () => 'principal',
  getEvents: (a, b) => eventos.filter((x) => !x._e.borrado && x._e.ini < b && x._e.fin > a),
  createEvent: (t, a, b, o) => { const x = evento(t, a, b, o); eventos.push(x); return x; },
  getEventById: (id) => eventos.find((x) => x._e.id === id && !x._e.borrado) || null,
};
const fmt = (d, tz, pat) => {
  const p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  return pat.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute);
};
const ctx = {
  console, JSON, Math, Date, Number, String, Object, Array, isNaN, Error,
  SpreadsheetApp: { getActiveSpreadsheet: () => libro },
  CalendarApp: { getDefaultCalendar: () => cal },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
  ScriptApp: {
    getProjectTriggers: () => ctx.__activadores.slice(),
    newTrigger: (fn) => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => { ctx.__activadores.push({ getHandlerFunction: () => fn }); } }) }) }),
    deleteTrigger: (t) => { ctx.__activadores = ctx.__activadores.filter((x) => x !== t); },
  },
  UrlFetchApp: { fetch: (url, o) => { ctx.__fetches.push({ url, o }); return { getResponseCode: () => 201 }; } },
  __activadores: [], __fetches: [],
  Session: { getActiveUser: () => ({ getEmail: () => ctx.__activo }), getEffectiveUser: () => ({ getEmail: () => 'dueno@x.com' }) },
  Utilities: {
    formatDate: fmt,
    parseDate: (s, tz) => new Date(s.replace(' ', 'T') + ':00-03:00'),
    computeDigest: () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 256) - 128),
    getUuid: () => 'u' + (++seq), DigestAlgorithm: { SHA_256: 1 }, sleep: () => {},
  },
  ContentService: { createTextOutput: (t) => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 1 } },
  HtmlService: { createHtmlOutput: (h) => ({ h, setTitle() { return this; }, setXFrameOptionsMode() { return this; } }), XFrameOptionsMode: { DEFAULT: 1 } },
};
vm.createContext(ctx);
vm.runInContext(code, ctx);
const ok = (c, m) => { if (!c) { console.log('FALLA:', m); process.exitCode = 1; } else console.log('ok -', m); };

ok(vm.runInContext('configurar()', ctx).startsWith('Listo'), 'configurar crea hojas y clave');
const clave = props.PREDYCTOR_CLAVE;
ok(/^[0-9a-f]{40}$/.test(clave), 'clave hex de 40');
ctx.__activo = ''; ok(vm.runInContext('doGet({parameter:{}})', ctx).t === 'Predyctor', 'anónimo no ve la clave');
ctx.__activo = 'dueno@x.com'; ok(vm.runInContext('doGet({parameter:{}})', ctx).h.includes('#clave=' + clave), 'dueño recibe enlace con clave');

const post = (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).t);
ok(post({ fn: 'sync', args: [{ ops: [] }], clave: 'mala' }).error === 'No autorizado', 'clave mala rechazada');

const hoy = vm.runInContext('hoy_()', ctx);
const base = Date.parse(hoy + 'T21:00:00-03:00');
eventos.push(evento('Trote', base, base + 40 * 60000, { id: 'serie-a' }));
eventos.push(evento('Trote', base + 86400000, base + 86400000 + 40 * 60000, { id: 'serie-a' }));

const ops = [
  { opId: 'o1', tipo: 'diario', datos: { fecha: hoy, entreno: true, bloque: false, instagram_min: 90, postulaciones: 2, actualizado: 1000 } },
  { opId: 'o2', tipo: 'estudio', datos: { id: 's1', fecha: hoy, inicio: '21:00', minutos: 45, tema: 'h_skool' } },
  { opId: 'o3', tipo: 'estudio', datos: { id: 's1', fecha: hoy, inicio: '21:00', minutos: 45, tema: 'h_skool' } },
  { opId: 'o4', tipo: 'estudio', datos: { id: 's2', fecha: hoy, minutos: 30, tema: 'tema_inventado' } },
];
let r = post({ fn: 'sync', args: [{ ops }], clave });
ok(r.ok && r.data.aplicados.length === 4, 'sync aplica la cola');
ok(r.data.estudio.length === 1 && r.data.estudio[0].id === 's1', 'estudio sin duplicar y tema inválido descartado');
ok(r.data.diario.length === 1 && r.data.diario[0].entreno === true && r.data.diario[0].instagram_min === 90, 'diario guardado');
ok(r.data.agenda[hoy].length === 1 && r.data.agenda[hoy][0].id === 'serie-a', 'agenda con id');
// cambio viejo no pisa uno nuevo
r = post({ fn: 'sync', args: [{ ops: [{ opId: 'o5', tipo: 'diario', datos: { fecha: hoy, entreno: false, actualizado: 500 } }] }], clave });
ok(r.data.diario[0].entreno === true, 'gana el cambio más reciente');
r = post({ fn: 'sync', args: [{ ops: [{ opId: 'o6', tipo: 'diario', datos: { fecha: hoy, entreno: false, actualizado: 2000 } }] }], clave });
ok(r.data.diario[0].entreno === false, 'cambio nuevo sí se aplica');

// Editar mi día
r = post({ fn: 'editarAgenda', args: [{ ops: [{ opId: 'e1', accion: 'editar', id: 'serie-a', inicioMs: base, titulo: 'Cerro', nuevoInicioMs: base + 3600000, nuevoFinMs: base + 7200000 }] }], clave });
ok(r.data.aplicados[0] === 'e1' && eventos[0]._e.titulo === 'Cerro' && eventos[0]._e.ini.getTime() === base + 3600000, 'editar mueve y renombra solo ese día');
ok(eventos[1]._e.titulo === 'Trote', 'el resto de la serie sigue igual');
r = post({ fn: 'editarAgenda', args: [{ ops: [{ opId: 'e1', accion: 'editar', id: 'serie-a', inicioMs: base, titulo: 'Otra' }] }], clave });
ok(r.data.aplicados[0] === 'e1' && eventos[0]._e.titulo === 'Cerro', 'opId repetido no se aplica dos veces');
ok(Array.isArray(post({ fn: 'sync', args: [{ ops: [] }], clave }).data.agenda[hoy][0].avisos), 'agenda trae los avisos');
r = post({ fn: 'editarAgenda', args: [{ ops: [{ opId: 'e9', accion: 'editar', id: 'serie-a', inicioMs: base + 3600000, avisos: [30, 15] }] }], clave });
ok(eventos[0]._e.avisos.join() === '30,15' && eventos[1]._e.avisos.join() === '10', 'avisos solo en ese día');
r = post({ fn: 'editarAgenda', args: [{ ops: [{ opId: 'e2', accion: 'saltar', id: 'serie-a', inicioMs: base + 86400000 }] }], clave });
ok(eventos[1]._e.borrado, 'saltar borra solo ese día');
r = post({ fn: 'editarAgenda', args: [{ ops: [{ opId: 'e3', accion: 'editar', id: 'no-existe', inicioMs: base, titulo: 'x', tituloOriginal: 'Yoga' }] }], clave });
ok(r.data.errores.length === 1 && /Yoga/.test(r.data.errores[0].error), 'error claro si no encuentra la actividad');

// Alarmas
r = post({ fn: 'programarAlarma', args: [Date.now() + 45 * 60000, 'Fin del estudio · Skool'], clave });
const idAl = r.data;
ok(r.ok && cal.getEventById(idAl).getTitle().startsWith('⏰'), 'programa alarma');
ok(post({ fn: 'programarAlarma', args: [Date.now() + 9 * 3600000, 'x'], clave }).ok === false, 'rechaza alarma fuera de rango');
post({ fn: 'cancelarAlarma', args: [idAl], clave });
ok(!cal.getEventById(idAl), 'cancela alarma');
post({ fn: 'cancelarAlarma', args: ['serie-a'], clave });
ok(!eventos[0]._e.borrado, 'cancelarAlarma no borra eventos que no son alarmas');

// Avisos push
const auth = 'vapid t=aaa.bbb.ccc, k=PUB_key-1';
const ep = 'https://fcm.googleapis.com/fcm/send/xyz';
ok(post({ fn: 'programarPush', args: [{ endpoint: 'https://evil.example.com/x', auth, finMs: Date.now() + 60000 }], clave }).ok === false, 'push rechaza destinos que no son servicios push');
ok(post({ fn: 'programarPush', args: [{ endpoint: ep, auth: 'Bearer x', finMs: Date.now() + 60000 }], clave }).ok === false, 'push rechaza firma inválida');
const p1 = post({ fn: 'programarPush', args: [{ endpoint: ep, auth, finMs: Date.now() + 30000 }], clave });
const p2 = post({ fn: 'programarPush', args: [{ endpoint: ep, auth, finMs: Date.now() + 40 * 60000 }], clave });
ok(p1.ok && p2.ok && ctx.__activadores.length === 1, 'programa avisos y crea un solo activador');
const p3 = post({ fn: 'programarPush', args: [{ endpoint: ep, auth, finMs: Date.now() + 20000 }], clave });
post({ fn: 'cancelarPush', args: [p3.data], clave });
vm.runInContext('enviarPushes()', ctx);
ok(ctx.__fetches.length === 1 && ctx.__fetches[0].o.headers.Authorization === auth && ctx.__fetches[0].o.headers.Urgency === 'high', 'envía solo el aviso que vence (y no el cancelado)');
ok(ctx.__activadores.length === 1, 'el activador sigue mientras quedan avisos');
post({ fn: 'cancelarPush', args: [p2.data], clave });
vm.runInContext('enviarPushes()', ctx);
ok(ctx.__activadores.length === 0 && ctx.__fetches.length === 1, 'sin avisos pendientes se borra el activador');
