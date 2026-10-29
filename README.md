# Predyctor

App de rutina personal: checks diarios, temporizador de estudio y progreso semanal. Se instala en el celular desde el navegador y funciona sin internet.

**Abrir:** https://victorabarca53-ship-it.github.io/predyctor/

## Cómo funciona sin señal

- **La app queda guardada en el teléfono.** Un service worker (`sw.js`) guarda la página, los íconos, las fuentes y la librería de gráficos. Sin red, abre la copia guardada; con señal lenta, no espera más de 3 segundos.
- **Los datos se guardan primero en el teléfono**, en IndexedDB. Cada check y cada sesión de estudio entra a una cola de cambios.
- **Sincroniza sola cuando vuelve la señal.** Manda la cola a un motor en Google Apps Script, que la escribe en una hoja de Google y devuelve el historial y la agenda de los próximos 7 días.
  - Diario: gana el cambio más reciente.
  - Estudio: cada sesión trae un id, así que no se duplica aunque se mande dos veces.
- **El progreso se calcula en el teléfono**: puntaje semanal, horas por tema, Instagram y constancia.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La app completa (pantallas, datos locales y sincronización) |
| `sw.js` | Service worker: caché para usarla sin internet |
| `manifest.webmanifest` | Datos para instalarla como app |
| `vendor/` | Chart.js 4.4.1 (MIT) y fuentes Sora e Inter (OFL), incluidas para no depender de internet |

El motor de Apps Script no está en este repositorio porque contiene la configuración privada de la cuenta.
