/**
 * 📄 A-BUG-145 / A-BUG-149 — pedir el Detalle de Pago y MIRAR el papel que sale.
 *
 * ## 🛑 No escribe nada
 * «📄 Detalle PDF» genera el documento en el navegador y lo descarga. **No toca la base** — a
 * diferencia de «✉ Encolar mail detalle», que inserta en `public.mails_pago` y termina en un
 * borrador de Gmail. Por eso este camino se puede correr libremente y el otro no.
 *
 * ## Qué prueba, que no prueba ningún caso
 * Los casos de `npm run probar` verifican la **cuenta**; el ensayo la verifica **contra los datos
 * reales**. Ninguno de los dos mira **el PDF**, que es lo único que el proveedor realmente recibe.
 * El PDF tenía su propia aritmética (A-BUG-149) justamente porque nadie lo estaba mirando.
 *
 * ## El caso: ALCORTA, pago del 10/09 — 3 facturas, UNA transferencia
 * Lo que el papel tiene que decir, medido contra la base:
 * ```
 * Importe facturas             $385.093,90
 * Transferencia (3 facturas)   $364.272,27   ← una sola: es lo que mandó el banco
 * Retención SICORE                $1.566,93
 * Descuento pronto pago          $19.254,70
 * TOTAL                         $385.093,90   ← cierra contra el importe
 * ```
 */

import { test, expect } from '@playwright/test'
import { irAlInicio, RUTA } from './ayuda'

const CUIT_ALCORTA = '20103619115'
const OUT = 'C:/Users/josem/AppData/Local/Temp/claude/D--Users-josem-Documents-Jose-Automatizarr-Claude-Control-Presupuestario-v1-1/93fe67ed-ce98-4c07-9cab-ef2f6c13fccd/scratchpad'

test('📄 el Detalle de Pago de ALCORTA sale con UNA transferencia y cierra', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')

  const errores: string[] = []
  page.on('pageerror', e => errores.push('PAGEERROR: ' + e.message))

  await irAlInicio(page)
  await page.getByRole('tab', { name: 'Cash Flow' }).click()

  const buscador = page.getByPlaceholder('Buscar proveedor, CUIT, categ, detalle...')
  await expect(buscador).toBeVisible({ timeout: 120_000 })
  await buscador.fill(CUIT_ALCORTA)
  await page.waitForTimeout(2500)

  await page.getByRole('button', { name: /^PAGOS$/ }).click({ modifiers: ['Control'] })
  await expect(page.getByRole('button', { name: /Cancelar PAGOS/ })).toBeVisible({ timeout: 20_000 })

  /**
   * ⚠️ **Se marca SÓLO la fila del pago**, no «Seleccionar todas».
   *
   * La primera versión apretaba «Seleccionar todas» y se llevó **las 8 filas de ALCORTA** —NCs de
   * junio, facturas de julio, un pago de septiembre— en un mismo papel. El PDF salió coherente pero
   * **no probaba nada**: un Detalle de Pago es de UN pago, y ahí había cuatro meses mezclados.
   *
   * 📌 Es la § 🛑 Datos aplicada a leer: *apuntar al registro, no a «lo que aparezca»*. Un test que
   * agarra de más da un resultado que parece rico y no dice nada.
   */
  const filaPago = page.getByRole('row').filter({ hasText: '6337' }).first()
  await expect(filaPago).toBeVisible()
  await filaPago.getByRole('checkbox').first().click()
  await expect(page.getByRole('button', { name: /Aplicar a 1 filas/ })).toBeVisible()
  await page.screenshot({ path: `${OUT}/pdf-01-seleccion.png` })

  // 📄 El PDF: se captura la descarga para poder leerlo.
  const [descarga] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.getByRole('button', { name: /Detalle PDF/ }).click(),
  ])
  const destino = `${OUT}/detalle-alcorta.pdf`
  await descarga.saveAs(destino)
  console.log(`\n📄 PDF guardado: ${descarga.suggestedFilename()} → ${destino}`)

  console.log(`\n🔴 errores de página: ${errores.length}`)
  for (const e of errores) console.log('   ' + e.slice(0, 300))
})
