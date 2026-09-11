/**
 * 🧪 A-FEAT-129 — que el cartel de «lo que hay que mirar en esta corrida» SE VEA.
 *
 * ## Por qué existe
 * El componente se monta dentro del modal de SICORE, que es un lugar al que sólo se llega
 * corriendo el proceso. Un componente que nunca se renderizó es exactamente el modo de falla de
 * `A-BUG-144`: la lógica estaba bien y el panel **no se montaba**. Los casos de `npm run probar`
 * prueban a quién muestra; esto prueba **que aparezca**.
 *
 * ## 🛑 Qué escribe: NADA de contenido
 * Llega al paso del tipo de operación y **cancela**. Después de [A-BUG-147] la fecha de pago de las
 * facturas encoladas ya no se escribe en el lote, y el estado no se toca hasta confirmar. Lo único
 * que corre es el `UPDATE` de «Cancelar», que **reescribe el estado con el valor que ya tenía**.
 *
 * > Permiso del usuario, 2026-09-11, para esta corrida. **No se hereda** (§ CLAUDE.md 🛑 Datos).
 *
 * ## Y de paso prueba la mitad 1 de A-TEST-111
 * Abandonar el flujo **no tiene que dejar la factura tocada**. La comprobación fina es por SQL,
 * afuera; acá se deja el rastro en el log para poder compararlo.
 */

import { test, expect } from '@playwright/test'
import { irAlInicio, RUTA } from './ayuda'

const FC = { etiqueta: '2067', cuit: '30714279315' }
const OUT = 'C:/Users/josem/AppData/Local/Temp/claude/D--Users-josem-Documents-Jose-Automatizarr-Claude-Control-Presupuestario-v1-1/93fe67ed-ce98-4c07-9cab-ef2f6c13fccd/scratchpad'

test('🧪 A-FEAT-129 · el cartel de tests aparece en el modal de SICORE', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')

  const errores: string[] = []
  page.on('pageerror', e => errores.push('PAGEERROR: ' + e.message))

  await irAlInicio(page)
  await page.getByRole('tab', { name: 'Cash Flow' }).click()

  const buscador = page.getByPlaceholder('Buscar proveedor, CUIT, categ, detalle...')
  await expect(buscador).toBeVisible({ timeout: 120_000 })
  await buscador.fill(FC.cuit)
  await page.waitForTimeout(2500)

  const fila = page.getByRole('row').filter({ hasText: FC.etiqueta }).first()
  await expect(fila).toBeVisible()

  await page.getByRole('button', { name: /^PAGOS$/ }).click({ modifiers: ['Control'] })
  await expect(page.getByRole('button', { name: /Cancelar PAGOS/ })).toBeVisible({ timeout: 20_000 })
  await fila.getByRole('checkbox').first().click()

  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'Pagar', exact: true }).click()
  await page.getByRole('button', { name: /Aplicar a 1 filas/ }).click()

  await expect(page.getByText('¿Con qué fecha se pagaron?')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Registrar con esta fecha' }).click()

  await page.getByRole('button', { name: /Retener SICORE/ }).click()
  await expect(page.getByText('Seleccioná el tipo de operación:')).toBeVisible({ timeout: 30_000 })

  // ── Lo que se viene a probar ──────────────────────────────────────────────────────────────
  const modal = page.getByRole('dialog')
  const cartel = modal.getByRole('button', { name: /cosas? para mirar en esta corrida/ })

  await expect(cartel, 'El cartel de A-FEAT-129 tiene que estar en el modal').toBeVisible()
  await page.screenshot({ path: `${OUT}/f129-01-colapsado.png` })
  console.log('\n🧪 CARTEL COLAPSADO: ' + (await cartel.innerText()))

  // Arranca colapsado (modo de falla 2): el detalle NO puede estar a la vista tapando el trabajo.
  await expect(modal.getByText('A-TEST-111')).toHaveCount(0)

  await cartel.click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/f129-02-abierto.png` })
  console.log('\n🧪 CARTEL ABIERTO:\n' + (await modal.innerText()).slice(0, 1800))

  // Los cinco A-TEST del proceso, y los botones de respuesta.
  await expect(modal.getByText('A-TEST-111')).toBeVisible()
  await expect(modal.getByRole('button', { name: /Anduvo/ }).first()).toBeVisible()
  await expect(modal.getByRole('button', { name: /Falló/ }).first()).toBeVisible()

  // 🔴 Y que NO se cuele lo que no es un test.
  //
  // ⚠️ La primera versión de esta línea era `expect(modal.getByText('A-BUG-146')).toHaveCount(0)`
  // y **fallaba sin que hubiera bug**: los A-TEST *mencionan* el bug que defienden en su texto.
  // Un test de UI que busca una cadena suelta en un diálogo entero pregunta otra cosa de la que
  // quiere preguntar. Lo que importa es qué está **listado como ítem**, y eso es el chip del ID.
  const ids = await modal.locator('.font-mono').allInnerTexts()
  console.log('\n🧪 ÍTEMS LISTADOS: ' + ids.join(', '))
  expect(ids.length, 'tienen que estar los 5 A-TEST del proceso').toBe(5)
  expect(ids.every(t => t.trim().startsWith('A-TEST-')), `alguno no es un test: ${ids.join(', ')}`).toBe(true)

  // El detalle va recortado: si se despliega entero, el cartel tapa el modal y se cierra sin leer.
  const detalles = modal.locator('.line-clamp-2')
  expect(await detalles.count(), 'los detalles tienen que estar recortados').toBeGreaterThan(0)

  // ── Abandonar: no se responde nada y se cancela (A-TEST-111 mitad 1) ──────────────────────
  await modal.getByRole('button', { name: /^Cancelar$/ }).click()
  await page.waitForTimeout(3000)

  console.log(`\n🔴 errores de página: ${errores.length}`)
  for (const e of errores) console.log('   ' + e.slice(0, 300))
})
