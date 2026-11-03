/**
 * Predyctor · motor en Google Apps Script (plantilla)
 *
 * Qué hace:
 *   - Guarda en una hoja de Google lo que la app anota en el teléfono (checks del día y sesiones de estudio).
 *   - Devuelve el historial y la agenda de Google Calendar de los próximos 7 días.
 *   - Crea y borra las alarmas del temporizador como eventos de Calendar (suenan con el teléfono bloqueado).
 *   - Aplica los cambios de "Editar mi día" solo a la instancia de ese día.
 *
 * Cómo se instala: ver docs/GUIA-PLANTILLA.md. Resumen:
 *   1. Crea una hoja de Google y abre Extensiones → Apps Script. Pega este archivo.
 *   2. Ajusta CONFIG (zona horaria, temas y la URL donde publicaste la app).
 *   3. Ejecuta configurar() una vez y acepta los permisos.
 *   4. Implementa dos veces como app web:
 *        "vincular": Ejecutar como yo · Acceso: solo yo        → abre la página que entrega la clave.
 *        "motor":    Ejecutar como yo · Acceso: cualquier persona → la app le habla por doPost con la clave.
 */

const CONFIG = {
  zonaHoraria: 'America/Santiago',
  // Deben coincidir con las "k" de config.js en la app.
  temas: ['h_trading', 'h_tienda', 'h_busqueda_pega', 'h_skool', 'h_trabajo'],
  // Dónde publicaste la app (GitHub Pages u otro). Termina en "/".
  urlApp: 'https://TU-USUARIO.github.io/predyctor/',
  // Cuántos días de historial manda en cada sincronización.
  diasHistorial: 120,
};

const TZ = CONFIG.zonaHoraria;
const HOJA_DIARIO = 'Diario';
const HOJA_ESTUDIO = 'Estudio';
const COLS_DIARIO = ['fecha', 'celular_fuera', 'sin_ig_despertar', 'entreno', 'bloque', 'instagram_min', 'postulaciones', 'nota', 'actualizado'];
const COLS_ESTUDIO = ['id', 'fecha', 'inicio', 'minutos', 'tema', 'nota'];
const PROP_CLAVE = 'PREDYCTOR_CLAVE';

/* ---------- Instalación ---------- */

/** Ejecútala una vez desde el editor: crea las pestañas, la clave y pide los permisos. */
function configurar() {
  hoja_(HOJA_DIARIO, COLS_DIARIO);
  hoja_(HOJA_ESTUDIO, COLS_ESTUDIO);
  clave_(false);
  CalendarApp.getDefaultCalendar().getName();
  return 'Listo. Ahora implementa la app web (ver la guía).';
}

/* ---------- Web app ---------- */

// La implementación "vincular" (solo tú) muestra la página que pasa la clave al teléfono.
// En la implementación "motor" (cualquier persona) doGet no entrega nada útil.
function doGet(e) {
  if (!esDueno_()) return ContentService.createTextOutput('Predyctor');
  const renovar = !!(e && e.parameter && e.parameter.renovar === '1');
  const clave = clave_(renovar);
  const destino = CONFIG.urlApp + '#clave=' + clave;
  const html =
    '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<body style="font-family:system-ui,sans-serif;background:#0B2B23;color:#F1ECDD;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:90vh;gap:16px;text-align:center;padding:24px">' +
    '<h1 style="margin:0">Vincular este equipo</h1>' +
    '<p style="max-width:320px;color:#A7B9B0;line-height:1.5">Toca el botón para abrir Predyctor ya vinculado. La clave queda guardada solo en este equipo.</p>' +
    '<a target="_top" href="' + destino + '" style="background:#D9A94A;color:#0B2B23;padding:14px 22px;border-radius:12px;font-weight:700;text-decoration:none">Abrir Predyctor</a>' +
    (renovar ? '<p style="color:#A7B9B0">Clave nueva creada: los equipos vinculados antes quedan fuera.</p>' : '') +
    '</body>';
  return HtmlService.createHtmlOutput(html).setTitle('Vincular Predyctor')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function doPost(e) {
  const API = {
    sync: sync,
    editarAgenda: editarAgenda,
    programarAlarma: programarAlarma,
    cancelarAlarma: cancelarAlarma,
  };
  let res;
  try {
    const req = JSON.parse(e.postData.contents);
    const clave = PropertiesService.getScriptProperties().getProperty(PROP_CLAVE);
    if (!clave || req.clave !== clave) throw new Error('No autorizado');
    const fn = API[req.fn];
    if (!fn) throw new Error('Función desconocida');
    res = { ok: true, data: fn.apply(null, req.args || []) };
  } catch (err) {
    res = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Sincronización ---------- */

/**
 * Recibe la cola de cambios del teléfono y devuelve el estado actual.
 *   Diario: una fila por fecha; gana el cambio con "actualizado" más reciente.
 *   Estudio: cada sesión trae un id; si llega dos veces se guarda una sola.
 */
function sync(payload) {
  const ops = (payload && payload.ops) || [];
  if (!Array.isArray(ops) || ops.length > 500) throw new Error('Cola demasiado grande');
  const aplicados = [];
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const shD = hoja_(HOJA_DIARIO, COLS_DIARIO);
    const shE = hoja_(HOJA_ESTUDIO, COLS_ESTUDIO);
    const diario = leerTabla_(shD);
    const filaPorFecha = {};
    diario.forEach((r, i) => { const k = fechaKey_(r.fecha); if (k) filaPorFecha[k] = i + 2; });
    const idsEstudio = {};
    leerTabla_(shE).forEach((r) => { if (r.id) idsEstudio[String(r.id)] = true; });
    const nuevasEstudio = [];

    ops.forEach((op) => {
      if (!op || !op.opId || !op.datos) return;
      if (op.tipo === 'diario') {
        const d = op.datos;
        const key = fechaKey_(d.fecha);
        if (!key) return;
        const fila = filaDiario_(d, key);
        const n = filaPorFecha[key];
        if (n) {
          const previo = Number(shD.getRange(n, COLS_DIARIO.length).getValue()) || 0;
          if (previo > fila[fila.length - 1]) { aplicados.push(op.opId); return; } // la hoja tiene algo más nuevo
          shD.getRange(n, 1, 1, fila.length).setValues([fila]);
        } else {
          const nueva = shD.getLastRow() + 1;
          shD.getRange(nueva, 1).setNumberFormat('@');
          shD.getRange(nueva, 1, 1, fila.length).setValues([fila]);
          filaPorFecha[key] = nueva;
        }
        aplicados.push(op.opId);
      } else if (op.tipo === 'estudio') {
        const d = op.datos;
        const id = String(d.id || op.opId).slice(0, 64);
        if (!idsEstudio[id]) {
          const tema = String(d.tema);
          const minutos = Math.round(Number(d.minutos));
          const key = fechaKey_(d.fecha);
          if (CONFIG.temas.indexOf(tema) !== -1 && minutos >= 1 && minutos <= 600 && key) {
            nuevasEstudio.push([id, key, String(d.inicio || '').slice(0, 5), minutos, tema, String(d.nota || '').slice(0, 300)]);
            idsEstudio[id] = true;
          }
        }
        aplicados.push(op.opId);
      }
    });
    if (nuevasEstudio.length) {
      const desde = shE.getLastRow() + 1;
      shE.getRange(desde, 1, nuevasEstudio.length, 3).setNumberFormat('@');
      shE.getRange(desde, 1, nuevasEstudio.length, COLS_ESTUDIO.length).setValues(nuevasEstudio);
    }
  } finally {
    lock.releaseLock();
  }

  const hoy = hoy_();
  const desde = sumarDias_(hoy, -CONFIG.diasHistorial);
  const diario = leerTabla_(hoja_(HOJA_DIARIO, COLS_DIARIO))
    .map((r) => Object.assign({}, r, { fecha: fechaKey_(r.fecha), instagram_min: r.instagram_min === '' ? null : r.instagram_min, actualizado: Number(r.actualizado) || 0 }))
    .filter((r) => r.fecha && r.fecha >= desde);
  const estudio = leerTabla_(hoja_(HOJA_ESTUDIO, COLS_ESTUDIO))
    .map((r) => ({ id: String(r.id), fecha: fechaKey_(r.fecha), inicio: String(r.inicio || ''), minutos: Number(r.minutos) || 0, tema: String(r.tema), nota: String(r.nota || '') }))
    .filter((r) => r.id && r.fecha && r.fecha >= desde);
  return { aplicados: aplicados, desde: desde, diario: diario, estudio: estudio, agenda: agendaDias_(hoy, 7), servidor: Date.now() };
}

function filaDiario_(d, key) {
  const ig = d.instagram_min;
  return [
    key,
    d.celular_fuera === true,
    d.sin_ig_despertar === true,
    d.entreno === true,
    d.bloque === true,
    ig === null || ig === '' || ig === undefined || isNaN(Number(ig)) ? '' : Math.max(0, Math.round(Number(ig))),
    Math.max(0, Math.round(Number(d.postulaciones) || 0)),
    String(d.nota || '').slice(0, 500),
    Number(d.actualizado) || Date.now(),
  ];
}

/* ---------- Agenda ---------- */

// Lee con límites calculados en la zona de CONFIG: así no importa en qué zona esté configurado el calendario.
function agendaDias_(key, n) {
  const cal = CalendarApp.getDefaultCalendar();
  const out = {};
  for (let i = 0; i < n; i++) {
    const k = sumarDias_(key, i);
    const ini = Utilities.parseDate(k + ' 00:00', TZ, 'yyyy-MM-dd HH:mm');
    const fin = new Date(ini.getTime() + 24 * 3600 * 1000);
    out[k] = cal.getEvents(ini, fin)
      .filter((e) => e.isAllDayEvent() || Utilities.formatDate(e.getStartTime(), TZ, 'yyyy-MM-dd') === k)
      .map((e) => ({
        id: e.getId(),
        avisos: e.getPopupReminders(),
        titulo: e.getTitle(),
        todoElDia: e.isAllDayEvent(),
        inicio: e.isAllDayEvent() ? '' : Utilities.formatDate(e.getStartTime(), TZ, 'HH:mm'),
        fin: e.isAllDayEvent() ? '' : Utilities.formatDate(e.getEndTime(), TZ, 'HH:mm'),
        inicioMs: e.getStartTime().getTime(),
        finMs: e.getEndTime().getTime(),
      }))
      .sort((a, b) => a.inicioMs - b.inicioMs);
  }
  return out;
}

// Cambios de un solo día ("Editar mi día"). Cada cambio trae opId: si llega dos veces, se aplica una sola.
function editarAgenda(payload) {
  const ops = (payload && payload.ops) || [];
  if (!Array.isArray(ops) || ops.length > 50) throw new Error('Demasiados cambios');
  const cal = CalendarApp.getDefaultCalendar();
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  const aplicados = [];
  const errores = [];
  try {
    const hechos = JSON.parse(props.getProperty('AGENDA_OPS') || '[]');
    ops.forEach((op) => {
      if (!op || !op.opId) return;
      if (hechos.indexOf(op.opId) !== -1) { aplicados.push(op.opId); return; }
      try {
        aplicarEdicion_(cal, op);
        aplicados.push(op.opId);
        hechos.push(op.opId);
      } catch (err) {
        errores.push({ opId: op.opId, error: String((err && err.message) || err) });
      }
    });
    props.setProperty('AGENDA_OPS', JSON.stringify(hechos.slice(-300)));
  } finally {
    lock.releaseLock();
  }
  return { aplicados: aplicados, errores: errores };
}

function aplicarEdicion_(cal, op) {
  const ini = Number(op.inicioMs);
  const ahora = Date.now();
  if (!op.id || !ini) throw new Error('falta la actividad');
  if (ini < ahora - 3 * 86400000 || ini > ahora + 15 * 86400000) throw new Error('la fecha está fuera de rango');
  const ev = cal.getEvents(new Date(ini - 60000), new Date(ini + 60000))
    .filter((e) => e.getId() === op.id && Math.abs(e.getStartTime().getTime() - ini) < 60000)[0];
  if (!ev) {
    if (op.accion === 'saltar') return;
    throw new Error('no encontré "' + String(op.tituloOriginal || 'la actividad').slice(0, 60) + '" (¿la cambiaste en Calendar?)');
  }
  if (op.accion === 'saltar') { ev.deleteEvent(); return; }
  if (op.accion !== 'editar') throw new Error('acción desconocida');
  if (op.titulo) ev.setTitle(String(op.titulo).slice(0, 80));
  if (Array.isArray(op.avisos)) {
    const minutos = op.avisos.map(Number).filter((m) => m >= 0 && m <= 1440).slice(0, 5);
    ev.removeAllReminders();
    minutos.forEach((m) => ev.addPopupReminder(m));
  }
  if (op.nuevoInicioMs && !ev.isAllDayEvent()) {
    const a = Number(op.nuevoInicioMs);
    const b = Number(op.nuevoFinMs);
    if (!(b > a) || b - a > 12 * 3600000 || Math.abs(a - ini) > 2 * 86400000) throw new Error('el horario no es válido');
    ev.setTime(new Date(a), new Date(b));
  }
}

/* ---------- Alarmas del temporizador ---------- */

const MARCA_ALARMA = 'Alarma del temporizador de Predyctor. Se borra sola.';

// Un evento corto con aviso a los 0 minutos: Calendar lo hace sonar aunque el teléfono esté bloqueado.
function programarAlarma(finMs, titulo) {
  const fin = Number(finMs);
  const ahora = Date.now();
  if (!(fin > ahora - 60000 && fin < ahora + 6 * 3600000)) throw new Error('Hora de alarma fuera de rango');
  const cal = CalendarApp.getDefaultCalendar();
  const ev = cal.createEvent('⏰ ' + String(titulo || 'Predyctor').slice(0, 60), new Date(fin), new Date(fin + 5 * 60000), { description: MARCA_ALARMA });
  ev.removeAllReminders();
  ev.addPopupReminder(0);
  limpiarAlarmasViejas_(cal);
  return ev.getId();
}

function cancelarAlarma(id) {
  const ev = CalendarApp.getDefaultCalendar().getEventById(String(id || ''));
  if (ev && ev.getDescription() === MARCA_ALARMA) ev.deleteEvent();
  return true;
}

// Borra alarmas que ya sonaron hace más de un día, para no ensuciar el calendario.
function limpiarAlarmasViejas_(cal) {
  const hasta = new Date(Date.now() - 86400000);
  cal.getEvents(new Date(hasta.getTime() - 7 * 86400000), hasta)
    .filter((e) => e.getDescription() === MARCA_ALARMA)
    .forEach((e) => e.deleteEvent());
}

/* ---------- Ayudantes ---------- */

function esDueno_() {
  const activo = Session.getActiveUser().getEmail();
  return !!activo && activo === Session.getEffectiveUser().getEmail();
}

function clave_(renovar) {
  const props = PropertiesService.getScriptProperties();
  let clave = props.getProperty(PROP_CLAVE);
  if (!clave || renovar) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now() + Math.random());
    clave = bytes.map((b) => ((b + 256) % 256).toString(16).padStart(2, '0')).join('').slice(0, 40);
    props.setProperty(PROP_CLAVE, clave);
  }
  return clave;
}

function libro_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function hoja_(nombre, cols) {
  const libro = libro_();
  let sh = libro.getSheetByName(nombre);
  if (!sh) {
    sh = libro.insertSheet(nombre);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function leerTabla_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  const valores = sh.getDataRange().getValues();
  const cab = valores[0].map(String);
  return valores.slice(1).map((fila) => {
    const o = {};
    cab.forEach((c, i) => { o[c] = fila[i]; });
    return o;
  });
}

function fechaKey_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const s = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function hoy_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function sumarDias_(key, n) {
  const p = key.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
