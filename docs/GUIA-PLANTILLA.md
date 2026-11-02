# Monta tu propio Predyctor

Necesitas una cuenta de Google y una de GitHub. No hay que instalar nada en el computador.

## 1. Copia el repositorio

1. Entra a este repositorio en GitHub y toca **Fork**. Queda una copia en tu cuenta.
2. En tu copia: **Settings → Pages → Build and deployment**. En *Source* elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`, y guarda.
3. En un par de minutos tu app queda en `https://TU-USUARIO.github.io/predyctor/`. Anota esa dirección.

## 2. Crea la hoja y el motor

1. En Google Drive crea una hoja de cálculo nueva, por ejemplo "Predyctor – registro".
2. En la hoja: **Extensiones → Apps Script**.
3. Borra lo que trae `Código.gs` y pega todo el contenido de [`motor/Code.gs`](../motor/Code.gs).
4. Arriba, en `CONFIG`, cambia:
   - `zonaHoraria`: tu zona, por ejemplo `America/Santiago`, `America/Bogota` o `Europe/Madrid`.
   - `temas`: las claves de tus temas de estudio. Tienen que ser las mismas que pongas en `config.js`.
   - `urlApp`: la dirección del paso 1, terminada en `/`.
5. Guarda (ícono de disquete). En el menú de funciones elige **configurar** y toca **Ejecutar**.
6. Google te pide permisos para la hoja y el calendario. Acepta. Como el script es tuyo, puede aparecer "Google no verificó esta app": toca *Configuración avanzada → Ir a Predyctor*.

Al terminar, la hoja tiene las pestañas **Diario** y **Estudio**, y el script ya creó tu clave secreta.

## 3. Publica el motor (dos implementaciones)

En el editor de Apps Script: **Implementar → Nueva implementación → tipo: App web**.

| Nombre | Ejecutar como | Quién tiene acceso | Para qué |
|---|---|---|---|
| vincular | Yo | Solo yo | Abre la página que pasa la clave a tu teléfono |
| motor | Yo | Cualquier persona | La app le manda tus datos con la clave |

Copia la URL de cada una. La de *motor* atiende a cualquiera, pero sin la clave contesta "No autorizado".

## 4. Configura la app

En tu fork, abre `config.js` en GitHub y toca el lápiz para editarlo:

- `apiUrl`: la URL de la implementación **motor**.
- `vincularUrl`: la URL de la implementación **vincular**.
- `tableroUrl`: déjalo en `''` si no tienes un tablero aparte.
- `temas`: nombre y color de cada tema. Las `k` deben coincidir con el motor. Con `trabajo: true` el tema aparece solo de lunes a viernes y no suma a la meta.
- `rotacion`: qué te toca cada día (0 = domingo).
- `metaEstudioMin`, `lineaBase` y `primeraSemana`: tu meta semanal y desde dónde partes.

Guarda con **Commit changes**. Después abre `sw.js` y súbele el número a `CACHE` (por ejemplo, `predyctor-v9` pasa a `predyctor-v10`). Sin ese cambio, el teléfono sigue usando la versión guardada.

## 5. Instala y vincula el teléfono

1. En el teléfono abre la URL de **vincular** con tu cuenta de Google y toca **Abrir Predyctor**.
2. Se abre tu app ya vinculada. En Chrome: menú ⋮ → **Instalar app**. En iPhone (Safari): Compartir → **Agregar a inicio**.
3. Listo. La primera vez que tenga señal descarga tu agenda.

## Preguntas comunes

**¿Mis datos quedan públicos?** No. El repositorio público solo tiene el código. Tus datos viven en tu hoja de Google y en tu teléfono. Lo único que llega al navegador es la URL del motor, y el motor no responde sin la clave.

**Se me perdió el teléfono o quiero desvincular todo.** Abre la URL de *vincular* agregando `?renovar=1` al final. Eso crea una clave nueva y los equipos vinculados antes dejan de funcionar. Después vuelve a vincular los tuyos.

**Las alarmas suenan bajito.** Suenan con el sonido de notificación de Google Calendar. En Android: Calendar → Configuración → Notificaciones → recordatorios de eventos, y ahí eliges un sonido más fuerte.

**Cambié algo y no se ve en el teléfono.** Revisa que hayas subido `CACHE` en `sw.js`. Después cierra la app por completo y ábrela con señal.

**Quiero otros checks.** Los cuatro checks están en `index.html` (los botones con `data-k`), en `CHECKS` y en las columnas del motor (`COLS_DIARIO`). Si cambias uno, cámbialo en los tres lugares.
