/**
 * Lo compartido de las pruebas de UI. **Un solo lugar** para entrar a la app.
 *
 * 🔑 Por qué existe: la ruta-password no puede quedar hardcodeada en cada spec, y la forma de
 * navegar tiene una trampa que ya costó una corrida entera —ver `irAlInicio`.
 */

import { expect, type Page } from '@playwright/test'

/** La ruta-password, de `.env.local`. Nunca del repo. */
export const RUTA = process.env.PRUEBA_RUTA ?? ''

/**
 * Credenciales del usuario de prueba, de `.env.local`. **Nunca del repo.**
 *
 * 🐞 **Por qué aparecieron (A-BUG-1218, 2026-09-28).** Desde que el login de Javier entró a esta
 * rama, **la ruta-password ya no da acceso**: la app redirige a `/login`. Los 13 specs de esta
 * carpeta pasaron a fallar **todos**, cada uno con el error de su propio `locator` —
 * *«waiting for getByRole('tab')»*— o sea **13 rojos que parecen bugs de la app y son uno solo de
 * acceso**. Ése es el modo de falla que esto viene a cortar.
 */
export const EMAIL = process.env.PRUEBA_EMAIL ?? ''
export const PASSWORD = process.env.PRUEBA_PASSWORD ?? ''

/** `true` cuando se puede entrar. Los specs lo usan para **saltearse con motivo**, no para fallar. */
export const HAY_ACCESO = Boolean(RUTA && EMAIL && PASSWORD)

/**
 * El motivo del salteo, en castellano, para que el que corra la suite sepa qué le falta.
 *
 * 🔑 **Un salteo explicado vale más que un rojo confuso.** Trece fallas por no poder entrar
 * enseñan a ignorar los rojos — y el día que uno sea de verdad, también se ignora.
 */
export const MOTIVO_SIN_ACCESO =
  !RUTA ? 'Falta PRUEBA_RUTA en .env.local'
  : !EMAIL || !PASSWORD
    ? 'Faltan PRUEBA_EMAIL y PRUEBA_PASSWORD en .env.local — desde que hay login, la ruta sola no alcanza'
    : ''

/**
 * Entra a la app: navega y, si aparece el login, se autentica.
 *
 * ⚠️ **No usar `page.goto('/')`.** Con un `baseURL` que incluya el path, `goto('/')` resuelve
 * contra el **origen** y se lleva puesto el segmento (`new URL('/', 'http://x/admin')` da
 * `http://x/`). El resultado es «Acceso Denegado» en los cuatro tests — y el síntoma parece un
 * problema de permisos, no de navegación. Pasó la primera vez que se corrió esto.
 *
 * 🛑 **El login es la ÚNICA escritura que hace esta carpeta**, y no escribe datos del negocio:
 * crea una sesión. Todo lo demás sigue siendo abrir, mirar y leer.
 *
 * ⚠️ **2FA**: `admin` tiene TOTP obligatorio y un test **no lo puede pasar**. El usuario de prueba
 * tiene que ser uno sin segundo factor; si cae en la pantalla de 2FA, se corta acá con un mensaje
 * que lo dice, en vez de morir por timeout veinte líneas más abajo.
 */
export async function irAlInicio(page: Page) {
  await page.goto(`/${RUTA}`)

  const email = page.getByRole('textbox', { name: /email/i })
  const estaEnLogin = await email.isVisible({ timeout: 10_000 }).catch(() => false)
  if (!estaEnLogin) return

  await email.fill(EMAIL)
  await page.getByRole('textbox', { name: /contrase/i }).fill(PASSWORD)
  await page.getByRole('button', { name: /ingresar|entrar|iniciar/i }).first().click()

  // Si pide segundo factor, el test no puede seguir: se dice por qué.
  const pide2fa = await page.getByText(/c[óo]digo|verificaci[óo]n|autenticaci[óo]n en dos/i)
    .first().isVisible({ timeout: 8_000 }).catch(() => false)
  if (pide2fa) {
    throw new Error(
      'El usuario de prueba tiene 2FA y un test no lo puede pasar. ' +
      'Usá una cuenta sin segundo factor para PRUEBA_EMAIL.',
    )
  }

  await expect(email).toBeHidden({ timeout: 30_000 })
}

/**
 * Abre el Presupuesto y espera a que **termine de calcular**.
 *
 * El botón de huecos aparece recién cuando la proyección está hecha, así que sirve de señal de
 * «ya está listo» mucho mejor que un `waitForTimeout`, que en una pantalla que consulta la base
 * es una apuesta.
 */
export async function abrirPresupuesto(page: Page) {
  await irAlInicio(page)
  await page.getByRole('tab', { name: 'Presupuesto' }).click()
  await expect(page.getByRole('button', { name: /hueco\(s\)|Sin huecos/ }))
    .toBeVisible({ timeout: 60_000 })
}
