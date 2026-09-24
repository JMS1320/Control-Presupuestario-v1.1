/**
 * 🎭 Playwright — el navegador de verdad, manejado por script.
 *
 * ## Para qué está acá
 * Es el nivel que faltaba. Las tres capas, de más barata a más cara:
 *
 * | Nivel | Qué prueba | Qué NO ve |
 * |---|---|---|
 * | `npm run probar*` | la **función**, con números escritos a mano | el cableado |
 * | `npm run ensayo:padron` | la **lógica real sobre datos reales** — predice la pantalla | qué dice esa pantalla |
 * | **esto** | la pantalla **de verdad**: click, texto y captura | si la pregunta estaba mal hecha |
 *
 * Los cuatro bugs que sobrevivieron a las dos primeras capas el 2026-09-09/10 —A-BUG-130 (el
 * Anotar nunca guardó), A-BUG-131 (el «Al tablero» no volvía), A-FEAT-125 a medias (había dos
 * botones y toqué uno) y A-BUG-136 («$0 sin cubrir»)— **eran todos de apretar**. Ninguno lo
 * encontró un test; los encontró el usuario usando la app.
 *
 * ## 🛑 CERO ESCRITURA — la regla que hace que esto sea seguro
 * **La app apunta al Supabase REAL. No hay entorno de prueba.** Un click en «Guardar» acá crea una
 * fila de verdad, igual que si la hiciera una persona.
 *
 * > **Los tests de esta carpeta ABREN, MIRAN y LEEN. No guardan, no editan, no borran.**
 *
 * El día que haga falta uno que escriba, vale la § 🛑 Datos entera de `CLAUDE.md`: se pide permiso
 * **cada vez**, se apunta a un registro **por id**, se saca una foto antes y se restaura después.
 * Precedente con nombre propio: el test que inventó $5.443.200 sobre un movimiento real de 3 toros
 * **reportó OK** (§ A-DEC-18).
 *
 * ## Cómo se corre
 * ```
 * npm run dev          # en otra terminal — ⚠️ es recurso exclusivo, avisar a la otra sesión
 * npm run ui           # los tests, sin ventana
 * npm run ui:ver       # con la ventana abierta, para mirar
 * npm run ui:reporte   # el reporte de la última corrida, con capturas
 * ```
 *
 * ## 🔑 La ruta-password NO se escribe acá
 * El primer segmento de la URL **es la contraseña** (`config/access-routes.ts`). Sale de
 * `PRUEBA_RUTA` en `.env.local`, que está fuera de git. Un test con la ruta hardcodeada la
 * publicaría en el repo — que es la misma familia de A-SEC-04, donde la ruta terminó guardada en
 * filas de la base sin RLS.
 */

import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'

/**
 * `.env.local` a mano — Playwright **no lo lee solo**, a diferencia de Next.
 *
 * Sin esto `PRUEBA_RUTA` queda `undefined`, la `baseURL` pierde la ruta-password y **todos los
 * tests se saltean en silencio**: la corrida termina en verde sin haber probado nada, que es el
 * peor resultado posible. Se lee sin dependencia nueva.
 */
function cargarEnvLocal() {
  try {
    const crudo = fs.readFileSync('.env.local', 'utf8')
    for (const linea of crudo.split('\n')) {
      const t = linea.trim()
      if (!t || t.startsWith('#') || !t.includes('=')) continue
      const k = t.slice(0, t.indexOf('=')).trim()
      if (!process.env[k]) {
        process.env[k] = t.slice(t.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    /* sin `.env.local` los tests se saltean con su motivo, que es lo correcto */
  }
}
cargarEnvLocal()

const RUTA = process.env.PRUEBA_RUTA ?? ''
if (!RUTA) {
  console.warn('⚠️  Falta PRUEBA_RUTA en .env.local — los tests de UI se van a saltear.')
}

export default defineConfig({
  testDir: './pruebas-ui',
  /**
   * 🛑 **LOS TESTS QUE ESCRIBEN NO CORREN CON `npm run ui`.**
   *
   * 🐞 Pasó el 2026-09-11, y es el motivo de que esto exista: `sicore-doble-click.spec.ts` —el
   * único que completa un pago de verdad— quedó en esta carpeta, y una corrida de `npm run ui`
   * **lo ejecutó sin que nadie lo pidiera**: volvió a pasar la FC de MERCURE a `pagar`, le estampó
   * la quincena y creó su fila de retención. Hubo que restaurar a mano.
   *
   * 🔑 Es **literalmente** lo que advierte `CLAUDE.md` § ✅ «Terminé» significa que ya lo probé:
   * *«el día que alguien agregue uno que escriba, esa orden lo autoriza sin preguntar»*. El
   * docstring del spec decía que el permiso no se hereda — **pero un docstring no frena a un
   * runner**. El permiso tiene que estar en la configuración, no en un comentario.
   *
   * Para correr uno de ésos, con permiso del usuario y a propósito:
   * ```
   * npm run ui:escribe        # los habilita para esa corrida
   * ```
   */
  testIgnore: process.env.PRUEBA_ESCRITURA === '1' ? [] : ['**/*.escribe.spec.ts'],
  // Uno por vez: son pocos, tocan la misma app y compiten por el mismo servidor de dev.
  workers: 1,
  fullyParallel: false,
  // En una app que lee de una base viva, un reintento tapa la intermitencia justo cuando es el dato.
  retries: 0,
  /**
   * ⏱️ Generoso a propósito. Esto corre contra `npm run dev`, que **compila cada pantalla la
   * primera vez que se entra**, y el Presupuesto además consulta la base entera antes de pintar.
   * Medido el 2026-09-10: con 60 s se caían dos de cuatro por el arranque, no por un bug — y un
   * test que falla por lento enseña a ignorar los rojos, que es peor que no tenerlo.
   */
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    /**
     * ⚠️ Sólo el ORIGEN, sin la ruta-password. `page.goto('/')` resuelve contra el origen y
     * **descarta el path del `baseURL`** (`new URL('/', 'http://x/admin')` → `http://x/`), así que
     * ponerla acá daba «Acceso Denegado» en todos los tests. La ruta la agrega `irAlInicio()`.
     */
    baseURL: 'http://localhost:3000',
    navigationTimeout: 120_000,
    actionTimeout: 30_000,
    // La captura y el video sólo cuando algo falla: son para entender, no para archivar.
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    // 🔑 `reuseExistingServer` en true a propósito: `npm run dev` es **recurso exclusivo** entre
    // terminales (`CLAUDE.md` § Trabajo en paralelo, regla 3). Si ya hay uno corriendo se usa ése,
    // en vez de levantar un segundo que pelearía por el puerto.
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
