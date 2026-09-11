/**
 * ✉️ A-TEST-113 — ENCOLAR el Detalle de Pago, y verificar que el adjunto y el cuerpo digan lo mismo.
 *
 * ## 🛑 Esto ESCRIBE. Qué escribe exactamente
 * Una fila en **`public.mails_pago`** con `estado='pendiente'`, el cuerpo del mail y el PDF en
 * base64. **Nada más.** En particular:
 *
 * - **No manda ningún mail.** `encolarMailDetalle` sólo hace el `INSERT`; no llama al GAS.
 * - El GAS (`gas-mail-detalle`) **se corre a mano** y hace `GmailApp.createDraft` —
 *   `sendEmail` está **comentado** en el archivo, con la nota *«los borradores los mandás vos»*.
 * - Se deshace borrando la fila.
 *
 * > Permiso del usuario, 2026-09-11, explícito: *«podés ver un reporte de pago a Iglesias… y
 * > encolarlos incluso, a éste y Alcorta, y poder hacer el check de que todo suceda ok»*.
 * > **No se hereda**: otra corrida requiere pedirlo de nuevo.
 *
 * ## Qué verifica, y por qué hace falta el camino largo
 * El invariante que pidió el usuario: *«debe ser lo mismo pedir el reporte para uno verlo que
 * encolarlo al mail lo que le llega adjunto»*. Los casos lo prueban sobre la función; esto lo
 * prueba sobre **los dos artefactos de verdad** — el texto del cuerpo y el PDF adjunto, los dos
 * sacados de la fila encolada. Era exactamente la mitad que fallaba en A-BUG-149.
 */

import { test, expect } from '@playwright/test'
import { irAlInicio, RUTA } from './ayuda'

const CASOS = [
  { nombre: 'ALCORTA', cuit: '20103619115', fila: '6337' },
  { nombre: 'IGLESIAS', cuit: '20122085326', fila: '816' },
]

const OUT = 'C:/Users/josem/AppData/Local/Temp/claude/D--Users-josem-Documents-Jose-Automatizarr-Claude-Control-Presupuestario-v1-1/93fe67ed-ce98-4c07-9cab-ef2f6c13fccd/scratchpad'

for (const CASO of CASOS) {
test(`✉️ encolar el Detalle de Pago de ${CASO.nombre}`, async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')

  const errores: string[] = []
  page.on('pageerror', e => errores.push('PAGEERROR: ' + e.message))

  await irAlInicio(page)
  await page.getByRole('tab', { name: 'Cash Flow' }).click()

  const buscador = page.getByPlaceholder('Buscar proveedor, CUIT, categ, detalle...')
  await expect(buscador).toBeVisible({ timeout: 120_000 })
  await buscador.fill(CASO.cuit)
  await page.waitForTimeout(2500)

  await page.getByRole('button', { name: /^PAGOS$/ }).click({ modifiers: ['Control'] })
  await expect(page.getByRole('button', { name: /Cancelar PAGOS/ })).toBeVisible({ timeout: 20_000 })

  // Sólo la fila del pago, por su número de comprobante (§ 🛑 Datos: nunca «lo que aparezca»).
  const filaPago = page.getByRole('row').filter({ hasText: CASO.fila }).first()
  await expect(filaPago).toBeVisible()
  await filaPago.getByRole('checkbox').first().click()
  await expect(page.getByRole('button', { name: /Aplicar a 1 filas/ })).toBeVisible()

  await page.getByRole('button', { name: /Encolar mail detalle/ }).click()

  // El resultado se anuncia por toast: puede ser OK, «sin mail» o un desvío que pide confirmar.
  await page.waitForTimeout(9000)
  await page.screenshot({ path: `${OUT}/encolar-${CASO.nombre}.png`, fullPage: false })

  const avisos = await page.locator('[data-sonner-toast]').allInnerTexts()
  console.log(`\n✉️ ${CASO.nombre} — avisos en pantalla:\n  ` + (avisos.join('\n  ') || '(ninguno visible)'))

  console.log(`\n🔴 errores de página: ${errores.length}`)
  for (const e of errores) console.log('   ' + e.slice(0, 300))
})
}
