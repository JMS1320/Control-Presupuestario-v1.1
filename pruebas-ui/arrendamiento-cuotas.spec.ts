/**
 * 🌾 A-BUG-101 — que el contrato de arrendamiento se pueda llevar a tener cuotas desde la pantalla.
 *
 * 🛑 **CERO ESCRITURA.** Abre Editar, copia el esquema EN PANTALLA, mira el control y cierra con
 * Cancelar. Nunca toca Guardar.
 *
 * ## El caso es el real
 * El esquema de MSA Nazarenas 26/27 (Provinvest, 15 qq/ha, 3 cuotas) copiado a un contrato de PAM
 * 25/26 tiene que cerrar exacto, corrido un año; copiado a uno de 15,5 qq/ha tiene que AVISAR sin frenar.
 */

import { test, expect, type Page } from '@playwright/test'
import { irAlInicio, RUTA } from './ayuda'

async function abrirArrendamientos(page: Page, empresa: 'PAM' | 'MA') {
  await irAlInicio(page)
  await page.getByRole('tab', { name: 'Ingresos' }).click()
  // 🔑 Se cambia de empresa ENSEGUIDA, sin esperar a que MSA termine de cargar — a propósito. Así
  // apareció el bug: la carga de MSA llegaba tarde y pisaba la de PAM, y la solapa decía PAM con
  // los contratos de MSA abajo. Esta prueba es la que lo cubre si vuelve.
  const solapa = page.getByRole('tab', { name: empresa, exact: true })
  await solapa.click()
  await expect(solapa).toHaveAttribute('data-state', 'active')
  await expect(page.getByRole('button', { name: 'Editar' }).first()).toBeVisible({ timeout: 60_000 })
  await page.waitForTimeout(3_000)   // tiempo para que una carga vieja, si la hubiera, llegue y pise
  // Todas las tarjetas tienen que ser de esta empresa
  const tarjetas = page.locator('div.rounded-lg', { has: page.getByRole('button', { name: 'Editar' }) })
  const n = await tarjetas.count()
  expect(n).toBeGreaterThan(0)
  for (let i = 0; i < n; i++) {
    await expect(tarjetas.nth(i).getByText(empresa, { exact: true }).first()).toBeVisible()
  }
  await page.screenshot({ path: `test-results/arrendamiento-lista-${empresa}.png`, fullPage: true })
}

async function copiarDeMsaNazarenas(page: Page) {
  const modal = page.getByRole('dialog')
  await modal.getByRole('combobox').filter({ hasText: 'Copiar cuotas' }).click()
  await page.getByRole('option', { name: /MSA · Nazarenas 26\/27/ }).click()
}

/**
 * ⚠️ Parten de NUEVO CONTRATO, no de un contrato existente. La primera versión editaba PAM Nazarenas
 * esperando «sin cuotas» y MA Lima esperando «falta el CUIT»: el día que el usuario cargó las cuotas
 * reales las dos fallaron sin que nada estuviera roto. Un test que depende del estado de los datos
 * miente en cuanto alguien los usa (§ 🧪 CLAUDE.md: los datos del caso van en el caso).
 */
async function nuevoContrato(page: Page, campania: string, has: string, qq: string) {
  await page.getByRole('button', { name: 'Nuevo contrato' }).click()
  const modal = page.getByRole('dialog')
  await expect(modal.getByText('Nuevo contrato')).toBeVisible()
  await modal.getByPlaceholder('26/27').fill(campania)
  const montos = modal.getByPlaceholder('0,00')
  await montos.nth(0).fill(has)   // Hectáreas
  await montos.nth(1).fill(qq)    // qq/ha
  return modal
}

test('🌾 PAM: un contrato nuevo 25/26 copia el esquema de MSA Nazarenas corrido un año y cierra en 15', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')
  const errores: string[] = []
  page.on('pageerror', e => errores.push('PAGEERROR: ' + e.message))

  await abrirArrendamientos(page, 'PAM')
  const modal = await nuevoContrato(page, '25/26', '211,16', '15')
  await expect(modal.getByRole('combobox').first()).toHaveText('PAM')
  await expect(modal.getByText(/Sin cuotas/)).toBeVisible()

  await copiarDeMsaNazarenas(page)
  await expect(modal.locator('tbody tr')).toHaveCount(3)
  await expect(modal.getByText(/Las cuotas suman los 15,00 qq\/ha/)).toBeVisible()
  // Fechas corridas un año: la 1ª cuota cobra el 20/11/2025
  await expect(modal.locator('input[type="date"]').first()).toHaveValue('2025-11-20')

  await page.screenshot({ path: 'test-results/arrendamiento-pam.png', fullPage: true })
  await modal.getByRole('button', { name: 'Cancelar' }).click()
  await expect(modal).toBeHidden()
  expect(errores).toEqual([])
})

test('🌾 MA: 15 qq copiados contra 15,5 del contrato AVISA la diferencia y deja guardar', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')
  const errores: string[] = []
  page.on('pageerror', e => errores.push('PAGEERROR: ' + e.message))

  await abrirArrendamientos(page, 'MA')
  const modal = await nuevoContrato(page, '26/27', '85,36', '15,5')
  await expect(modal.getByRole('combobox').first()).toHaveText('MA')

  await copiarDeMsaNazarenas(page)
  await expect(modal.getByText(/diferencia -0,5/)).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Guardar' })).toBeEnabled()

  await page.screenshot({ path: 'test-results/arrendamiento-ma.png', fullPage: true })
  await modal.getByRole('button', { name: 'Cancelar' }).click()
  expect(errores).toEqual([])
})

/**
 * 🌾 A-BUG-183/184 + A-FEAT-164 — el modal de Fijar sobre el saldo real de Rojas 26/27 (#5).
 * 🛑 CERO ESCRITURA: abre Fijar, mira y cancela.
 * Después de corregir el dato, el saldo es 112,960 tn exacto; antes decía 113,014.
 */
test('🌾 Fijar Rojas #5: propone 112,960 tn exactas y el TC arranca vacío', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')
  const errores: string[] = []
  page.on('pageerror', e => errores.push('PAGEERROR: ' + e.message))

  await irAlInicio(page)
  await page.getByRole('tab', { name: 'Ingresos' }).click()
  await page.getByRole('tab', { name: 'Arrendamientos' }).click()
  // La tarjeta de Rojas 26/27, fila de la cuota #5 (la de saldo)
  const tarjeta = page.locator('div.rounded-lg', { hasText: 'Rojas' }).filter({ hasText: '26/27' }).first()
  const fila = tarjeta.locator('tr', { hasText: '#5' })
  await expect(fila).toContainText('112,960', { timeout: 60_000 })
  await fila.getByRole('button', { name: /Fijar/ }).click()

  const modal = page.getByRole('dialog')
  await expect(modal.getByText(/Fijar — Rojas cuota #5/)).toBeVisible()
  await expect(modal.getByText(/Disponible: 112,960 tn/)).toBeVisible()
  await expect(modal.locator('input').nth(1)).toHaveValue('112,960')   // 0: fecha · 1: toneladas
  await expect(modal.getByPlaceholder(/dejar vacío/)).toHaveValue('')
  await expect(modal.getByRole('button', { name: /usar el del presupuesto/ })).toBeVisible()

  // A-FEAT-163 — el cartel del test del proceso: resumen para el usuario, 3 respuestas y nota.
  // 🛑 NO se aprieta ninguna respuesta: eso escribe un comentario real en pendientes_comentarios.
  await modal.getByRole('button', { name: /para mirar en esta corrida/ }).click()
  await expect(modal.getByText('A-TEST-134')).toBeVisible()
  await expect(modal.getByText(/Qué probar:/)).toBeVisible()
  await expect(modal.getByText(/5 casos en npm run probar/)).toBeHidden()   // lo técnico, plegado
  for (const r of ['✅ Anduvo', '🟡 Anduvo en parte', '🔴 Falló']) {
    await expect(modal.getByRole('button', { name: r })).toBeVisible()
  }
  await expect(modal.getByPlaceholder(/Nota \(opcional\)/)).toBeVisible()

  await page.screenshot({ path: 'test-results/arrendamiento-fijar-rojas5.png', fullPage: true })
  await modal.getByRole('button', { name: 'Cancelar' }).click()
  expect(errores).toEqual([])
})
