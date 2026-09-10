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
 * Entra a la app con la ruta-password puesta.
 *
 * ⚠️ **No usar `page.goto('/')`.** Con un `baseURL` que incluya el path, `goto('/')` resuelve
 * contra el **origen** y se lleva puesto el segmento (`new URL('/', 'http://x/admin')` da
 * `http://x/`). El resultado es «Acceso Denegado» en los cuatro tests — y el síntoma parece un
 * problema de permisos, no de navegación. Pasó la primera vez que se corrió esto.
 */
export async function irAlInicio(page: Page) {
  await page.goto(`/${RUTA}`)
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
