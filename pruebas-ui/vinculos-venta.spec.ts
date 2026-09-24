/**
 * 🔗 A-BUG-185/186/187/188 — el vínculo factura de venta ↔ venta, visto desde las dos pantallas.
 *
 * 🛑 CERO ESCRITURA: mira y no aprieta ni «Sí» ni «No».
 *
 * ⚠️ Estos dos tests SÍ dependen del estado de los datos (el vínculo real de la FC 00010-00000021 con
 * Rojas #1, del 18/08). Es a propósito: lo que se prueba es que la pantalla muestre un vínculo que
 * existe. Si el usuario lo deshace, el test falla y hay que cambiarlo — no es un bug.
 */

import { test, expect } from '@playwright/test'
import { irAlInicio, RUTA } from './ayuda'

test('🔗 Comprobantes MSA: la FC 00010-00000021 figura vinculada (A-BUG-185)', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')
  await irAlInicio(page)
  await page.getByRole('tab', { name: 'Ingresos' }).click()
  await page.getByRole('tab', { name: 'Comprobantes' }).click()
  const fila = page.locator('tr', { hasText: '00010-00000021' })
  await expect(fila).toBeVisible({ timeout: 60_000 })
  await expect(fila).toContainText('Rojas')
  await expect(fila).not.toContainText('sin vincular')
  await page.screenshot({ path: 'test-results/comprobantes-msa.png', fullPage: true })
})

test('🔗 Pantalla principal: no ofrece la FC 21 ya usada ni la de MSA para PAM (A-BUG-186/187/188)', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')
  await irAlInicio(page)
  const alerta = page.locator('div.rounded-lg', { hasText: 'Facturas de venta sin vincular' }).first()
  await expect(alerta).toBeVisible({ timeout: 90_000 })
  await expect(alerta).not.toContainText('00010-00000021')
  await expect(alerta).not.toContainText('00010-00000009')
  await expect(alerta).toContainText('00010-00000020')
  await expect(alerta).toContainText('en la venta de hacienda (Productivo)')
  await expect(alerta).not.toContainText('Cargá el CUIT del cliente en el contrato')
  await alerta.screenshot({ path: 'test-results/alerta-facturas-venta.png' })
})
