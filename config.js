/*
 * Configuración personal de Predyctor.
 * Es el único archivo que tienes que editar para usar la app con tu propia rutina.
 * Después de cambiarlo, sube la versión de CACHE en sw.js para que el teléfono descargue el cambio.
 */
window.PREDYCTOR_CONFIG = {
  // Zona horaria de tu día (nombres IANA: America/Santiago, America/Mexico_City, Europe/Madrid...).
  zonaHoraria: 'America/Santiago',

  // URLs de tu motor en Google Apps Script (ver docs/GUIA-PLANTILLA.md).
  // apiUrl: la implementación "motor". vincularUrl: la implementación que abre la página para vincular el equipo.
  apiUrl: 'https://script.google.com/macros/s/AKfycbxuJfqirwf4nK_jIDoHR8Vo6JOirTdGTQgEVmF05lx-ht2KG_tZMc_R7gv7Fy65pY_g/exec',
  vincularUrl: 'https://script.google.com/macros/s/AKfycbzJGTDuuUG6g9EjWG_lTVxAdxDhJRCO7GdUVXBjnSrbVp3alROKhaGi90o8S_jaDzA/exec?vincular=1',

  // Opcional: un tablero externo que se abre desde Progreso. Déjalo en '' para ocultar el enlace.
  tableroUrl: 'https://claude.ai/artifact/MNW7zqfSmf58DYa8PrzNpJ',

  // Temas del temporizador. "k" debe coincidir con los temas del motor (TEMAS en motor/Code.gs).
  // color: [modo claro, modo oscuro]. "trabajo: true" = solo lunes a viernes y no suma a la meta de estudio.
  temas: [
    { k: 'h_trading', n: 'Trading', color: ['#3d6fb6', '#79a3e0'] },
    { k: 'h_tienda', n: 'Tienda / ML', color: ['#d9822b', '#e8a256'] },
    { k: 'h_busqueda_pega', n: 'Búsqueda de pega', color: ['#7a5bb5', '#ab90e0'] },
    { k: 'h_skool', n: 'Skool', color: ['#2f8f7a', '#5fbfa6'] },
    { k: 'h_trabajo', n: 'Trabajo', color: ['#5b6770', '#a3afb8'], trabajo: true }
  ],

  // Meta semanal de estudio, en minutos (360 = 6 horas).
  metaEstudioMin: 360,

  // Qué toca cada día (0 = domingo). "tema" pinta el punto de color; null usa el color principal.
  rotacion: {
    0: { tema: null, texto: 'Finanzas 17:00 · estudio largo 17:30' },
    1: { tema: 'h_trading', texto: 'Trading demo · 21:00' },
    2: { tema: 'h_busqueda_pega', texto: 'Postulaciones a minería · 21:15' },
    3: { tema: 'h_tienda', texto: 'Tienda / Mercado Libre · 21:00' },
    4: { tema: 'h_skool', texto: 'Academia Skool · 21:15' },
    5: { tema: null, texto: 'Acondicionamiento 19:15 · después libre' },
    6: { tema: 'h_tienda', texto: 'Tienda (mañana, o tarde si hay cerro)' }
  },

  // Semana de partida (lunes) y cómo estabas antes de empezar, para medir el avance.
  lineaBase: { semana: '2026-10-12', instagram_h_dia: 3.5, entrenos: 5 },
  primeraSemana: '2026-10-19'
};
