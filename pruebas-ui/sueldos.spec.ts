/**
 * 👷 Sueldos — los cuatro arreglos de usabilidad, mirados en la pantalla.
 *
 * 🛑 **CERO ESCRITURA.** Abre, mira y despliega. No guarda, no edita, no borra.
 *
 * ## Qué prueba que los casos no pueden
 * `npm run probar` verifica el **agrupado y los totales**. Esto verifica que la tabla **se dibuje**:
 * que arranque cerrada, que abra al apretar, y que el formato de la plata llegue al DOM. Es la
 * capa que encontró A-BUG-144 —un panel cuya lógica estaba bien y **no se montaba**.
 */

import { test, expect } from '@playwright/test'
import { irAlInicio, RUTA } from './ayuda'

const OUT = 'C:/Users/josem/AppData/Local/Temp/claude/D--Users-josem-Documents-Jose-Automatizarr-Claude-Control-Presupuestario-v1-1/93fe67ed-ce98-4c07-9cab-ef2f6c13fccd/scratchpad'

test('👷 A-FEAT-77/78 · los pagos vienen CERRADOS por empleado y abren al apretar', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')

  const errores: string[] = []
  page.on('pageerror', e => errores.push('PAGEERROR: ' + e.message))

  await irAlInicio(page)
  await page.getByRole('tab', { name: 'Sueldos' }).click()

  const tabla = page.locator('table').filter({ hasText: 'Empleado / Fecha' })
  await expect(tabla, 'la tabla de pagos tiene que estar').toBeVisible({ timeout: 120_000 })
  await page.screenshot({ path: `${OUT}/sueldos-01-cerrado.png` })

  // ── A-FEAT-77 · arranca CERRADO ───────────────────────────────────────────────────────────
  const cabeceras = tabla.locator('tbody tr').filter({ hasText: /\d+ pagos?/ })
  const nCabeceras = await cabeceras.count()
  const nFilas = await tabla.locator('tbody tr').count()
  console.log(`\n👷 empleados con pagos: ${nCabeceras} · filas totales: ${nFilas}`)
  test.skip(nCabeceras === 0, 'No hay pagos cargados en el mes que muestra la pantalla.')

  // Cerrado = no hay más filas que cabeceras. Si hubiera detalle desplegado, sobrarían.
  expect(nFilas, 'con todo cerrado, cada empleado ocupa UNA fila').toBe(nCabeceras)

  console.log('\n👷 LO QUE SE VE CERRADO:')
  for (const t of await cabeceras.allInnerTexts()) console.log('  ' + t.replace(/\n/g, ' | '))

  // ── A-FEAT-78 · la plata con DECIMALES ────────────────────────────────────────────────────
  const textoCerrado = await tabla.innerText()
  const montos = textoCerrado.match(/\$\s?[\d.]+,\d{2}/g) ?? []
  expect(montos.length, `los totales tienen que tener 2 decimales — se vieron: ${montos.slice(0, 3)}`)
    .toBeGreaterThan(0)
  console.log(`\n💵 montos con decimales: ${montos.length} (ej. ${montos[0]})`)

  // ── Y que ABRA al apretar ─────────────────────────────────────────────────────────────────
  await cabeceras.first().scrollIntoViewIfNeeded()
  await cabeceras.first().click()
  await page.waitForTimeout(800)
  await tabla.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${OUT}/sueldos-02-abierto.png` })
  console.log('\n👷 LA TABLA ABIERTA:\n' + (await tabla.innerText()))

  const nFilasAbierto = await tabla.locator('tbody tr').count()
  console.log(`\n👷 filas tras abrir el primero: ${nFilasAbierto} (eran ${nFilas})`)
  expect(nFilasAbierto, 'al abrir un empleado tienen que aparecer sus pagos').toBeGreaterThan(nFilas)

  // Y que cierre de nuevo: un desplegable que no se puede cerrar no es un desplegable.
  await cabeceras.first().click()
  await page.waitForTimeout(500)
  expect(await tabla.locator('tbody tr').count(), 'y tiene que volver a cerrarse').toBe(nFilas)

  console.log(`\n🔴 errores de página: ${errores.length}`)
  for (const e of errores) console.log('   ' + e.slice(0, 300))
})

test('🏦 A-FEAT-79 · el selector de cuenta dice de QUIÉN es, no sólo el número', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')

  await irAlInicio(page)
  await page.getByRole('tab', { name: 'Sueldos' }).click()

  const tabla = page.locator('table').filter({ hasText: 'Empleado / Fecha' })
  await expect(tabla).toBeVisible({ timeout: 120_000 })

  // Ruben Sigot es el caso: tiene TRES cuentas (Galicia, Lucresia, Santander) y dos de ellas
  // guardan el CBU crudo en `alias`. Es el empleado que motivó el pedido.
  const sigot = tabla.locator('tbody tr').filter({ hasText: 'Ruben Sigot' }).first()
  test.skip(!(await sigot.count()), 'No hay pagos de Ruben Sigot en el mes que muestra la pantalla.')
  await sigot.click()
  await page.waitForTimeout(600)

  // El lápiz de la primera fila de detalle. Si el mes no es el de trabajo está deshabilitado:
  // en ese caso no hay nada que mirar y el test se saltea con su motivo.
  const lapiz = tabla.locator('tbody tr button[title="Editar"]').first()
  test.skip(!(await lapiz.count()) || !(await lapiz.isEnabled()),
    'El mes mostrado es de sólo lectura: el modal de edición no abre.')

  await lapiz.click()
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible({ timeout: 20_000 })

  const combo = modal.getByRole('combobox').filter({ hasText: /.*/ })
  const etiquetaCuenta = modal.locator('label', { hasText: 'Cuenta destino' })
  test.skip(!(await etiquetaCuenta.count()), 'Este empleado no tiene cuentas cargadas.')

  // Abrir el desplegable de cuentas y leer las opciones.
  await modal.getByText('Cuenta destino').locator('..').getByRole('combobox').click()
  await page.waitForTimeout(400)
  const opciones = await page.getByRole('option').allInnerTexts()
  console.log('\n🏦 OPCIONES DE CUENTA:\n  ' + opciones.join('\n  '))
  await page.screenshot({ path: `${OUT}/sueldos-03-cuentas.png` })

  // 🔴 Lo que se viene a probar: que NO sean puros números.
  const soloNumeros = opciones.filter(o => /^\s*\d{15,}\s*$/.test(o))
  expect(soloNumeros, `hay opciones que son sólo el CBU: ${soloNumeros.join(' · ')}`).toEqual([])

  // Cerrar sin guardar: esto no escribe nada.
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
})

test('🐞 A-BUG-97 · abrir un pago de CAJA no lo cambia a «banco»', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')

  await irAlInicio(page)
  await page.getByRole('tab', { name: 'Sueldos' }).click()

  const tabla = page.locator('table').filter({ hasText: 'Empleado / Fecha' })
  await expect(tabla).toBeVisible({ timeout: 120_000 })

  // Se busca una fila cuyo medio sea CAJA — es el único caso donde el bug se ve.
  const sigot = tabla.locator('tbody tr').filter({ hasText: 'Ruben Sigot' }).first()
  test.skip(!(await sigot.count()), 'No hay pagos de Ruben Sigot en el mes mostrado.')
  await sigot.click()
  await page.waitForTimeout(600)

  const filaCaja = tabla.locator('tbody tr').filter({ hasText: /Caja/ }).first()
  test.skip(!(await filaCaja.count()), 'No hay ningún pago de caja en el mes mostrado.')
  console.log('\n🐞 LA FILA DE CAJA: ' + (await filaCaja.innerText()).replace(/\n/g, ' | '))

  const lapiz = filaCaja.locator('button[title="Editar"]').first()
  test.skip(!(await lapiz.count()) || !(await lapiz.isEnabled()),
    'El mes mostrado es de sólo lectura: el modal no abre.')
  await lapiz.click()

  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible({ timeout: 20_000 })
  await page.screenshot({ path: `${OUT}/sueldos-04-medio-pago.png` })

  // 🔴 El bug: el modal abría con «Banco» aunque el pago fuera de caja, y al confirmar lo pisaba.
  const textoModal = await modal.innerText()
  console.log('\n🐞 EL MODAL DICE (medio de pago):\n' + textoModal)
  expect(textoModal, 'el modal tiene que abrir con el medio REAL del pago, no con «Banco»')
    .toMatch(/Caja/)

  // Cerrar SIN confirmar — el bug se materializaba al guardar, y acá no se guarda nada.
  await page.keyboard.press('Escape')
})
