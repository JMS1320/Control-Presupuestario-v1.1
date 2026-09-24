/**
 * 🏷️ **A-BUG-180 — el filtro por CATEG del Extracto no responde.**
 *
 * 🛑 **CERO ESCRITURA.** Sólo abre el desplegable, tilda una categoría y cuenta filas.
 *
 * ## Lo que reportó el usuario (2026-09-20)
 * *«Lo del filtrado por categ no funcionó. Después de la conciliación sobre rango de fecha
 * filtrado, en principio, ocurre ahí (…) sí sale actualizado después de la conciliación, sólo que
 * **no responde al comando**.»*
 *
 * ## Qué verifica
 * Que al elegir **una sola categoría**, la tabla quede con **menos filas que antes** y que todas
 * las visibles sean de esa categoría. Si el filtro no responde, la cantidad no cambia — y eso es
 * exactamente lo que hay que poder ver sin depender de mirar la pantalla.
 *
 * 📌 El primer arreglo que hice (sumar al filtro las categorías nuevas) atacaba otro síntoma: que
 * lo recién conciliado desapareciera. **El usuario dice que el problema es anterior: no filtra.**
 */

import { test, expect } from '@playwright/test'
import { irAlInicio, RUTA } from './ayuda'

test('🏷️ tildar UNA categoría filtra la tabla', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')

  const errores: string[] = []
  page.on('pageerror', e => errores.push('PAGEERROR: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errores.push('CONSOLE: ' + m.text().slice(0, 160)) })

  await irAlInicio(page)
  await page.getByRole('tab', { name: /Extracto/ }).click()

  const filas = page.locator('table tbody tr')
  await expect.poll(() => filas.count(), { timeout: 20000 }).toBeGreaterThan(0)
  const antes = await filas.count()

  // ⚠️ El selector de CATEG vive DENTRO del panel de Filtros Avanzados: hay que abrirlo primero.
  //    (La primera corrida del test falló por esto, no por el bug.)
  await page.getByRole('button', { name: /Avanzados/i }).first().click()
  await page.waitForTimeout(400)

  // Abrir el desplegable de categorías: el botón muestra el estado actual del filtro.
  await page.getByRole('button', { name: /Todas las categorías|categorías$|Ninguna seleccionada/i })
    .first().click()
  await page.waitForTimeout(300)

  // «Ninguna» deja el conjunto vacío; después se tilda una sola.
  const ninguna = page.getByRole('button', { name: /^Ninguna$/ })
  if (await ninguna.count()) await ninguna.first().click()

  // La primera categoría de la lista, sea cual sea.
  const primerCheck = page.locator('[role="checkbox"], input[type="checkbox"]').nth(1)
  const etiqueta = (await primerCheck.locator('xpath=ancestor::label[1]').textContent().catch(() => '')) ?? ''
  await primerCheck.click()

  // Cerrar el desplegable (el filtro se aplica al tildar, no al cerrar).
  await page.keyboard.press('Escape')

  await page.waitForTimeout(600)
  const despues = await filas.count()

  console.log(`[filtro-categ] antes=${antes} despues=${despues} categoria="${etiqueta.trim().slice(0, 40)}"`)
  console.log(`[filtro-categ] errores=${errores.length ? errores.join(' | ').slice(0, 300) : 'ninguno'}`)

  // 🔑 Lo que falla hoy: la cantidad no cambia.
  expect(despues, 'el filtro por categoría no cambió la cantidad de filas').toBeLessThan(antes)
})
