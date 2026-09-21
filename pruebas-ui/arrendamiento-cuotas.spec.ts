/**
 * 🌾 A-BUG-101 — que el contrato de arrendamiento se pueda llevar a tener cuotas desde la pantalla.
 *
 * 🛑 **CERO ESCRITURA.** Abre Editar, copia el esquema EN PANTALLA, mira el control y cierra con
 * Cancelar. Nunca toca Guardar.
 *
 * ## El caso es el real
 * PAM Nazarenas 25/26 (Provinvest, 15 qq/ha) no tiene cuotas. El esquema de MSA Nazarenas 26/27
 * (mismo cliente, 15 qq/ha, 3 cuotas) corrido un año atrás tiene que cerrar exacto. Y MA Lima
 * (15,5 qq/ha, sin CUIT del cliente) tiene que AVISAR las dos cosas sin frenar.
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

test('🌾 PAM Nazarenas: copiar el esquema de MSA da 3 cuotas y cierra en 15 qq/ha', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')
  const errores: string[] = []
  page.on('pageerror', e => errores.push('PAGEERROR: ' + e.message))

  await abrirArrendamientos(page, 'PAM')
  await page.getByRole('button', { name: 'Editar' }).first().click()
  const modal = page.getByRole('dialog')
  await expect(modal.getByText('Editar contrato')).toBeVisible()
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

test('🌾 MA Lima: avisa que falta el CUIT y que 15 no son 15,5 — y deja guardar', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')
  const errores: string[] = []
  page.on('pageerror', e => errores.push('PAGEERROR: ' + e.message))

  await abrirArrendamientos(page, 'MA')
  await page.getByRole('button', { name: 'Editar' }).first().click()
  const modal = page.getByRole('dialog')
  await expect(modal.getByRole('combobox').first()).toHaveText('MA')
  await expect(modal.getByText(/Falta el CUIT del cliente/)).toBeVisible()

  await copiarDeMsaNazarenas(page)
  await expect(modal.getByText(/diferencia -0,5/)).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Guardar' })).toBeEnabled()

  await page.screenshot({ path: 'test-results/arrendamiento-ma.png', fullPage: true })
  await modal.getByRole('button', { name: 'Cancelar' }).click()
  expect(errores).toEqual([])
})
