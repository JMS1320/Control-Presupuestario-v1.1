/**
 * ✏️ A-FEAT-131 — que el editor de campaña ABRA, muestre las cuotas reales y vea los vínculos.
 *
 * 🛑 **CERO ESCRITURA.** Abre, mira, y cierra con Cancelar. No toca Guardar.
 *
 * ## Por qué hace falta este nivel
 * La lógica ya tiene 13 casos en `npm run probar`, y ninguno prueba lo que falló en A-BUG-144: que
 * **el componente se monte**. Un panel con la lógica perfecta que no se renderiza no existe.
 *
 * ## El caso es el real
 * `Red Vial Cuota Lote Puerto` — 4 cuotas, la primera conciliada contra la transferencia del 16/03
 * por $54.770,60. Es el template que el usuario necesita llevar a 6 cuotas y para el que no había
 * pantalla: el modal de «agregar cuota» filtra `tipo_template = 'abierto'` y éste es `fijo`.
 */

import { test, expect } from '@playwright/test'
import { irAlInicio, RUTA } from './ayuda'

const OUT = 'C:/Users/josem/AppData/Local/Temp/claude/D--Users-josem-Documents-Jose-Automatizarr-Claude-Control-Presupuestario-v1-1/93fe67ed-ce98-4c07-9cab-ef2f6c13fccd/scratchpad'
const TEMPLATE = 'Red Vial Cuota Lote Puerto'

test('✏️ el editor de campaña abre, muestra las 4 cuotas y marca la conciliada', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')

  const errores: string[] = []
  page.on('pageerror', e => errores.push('PAGEERROR: ' + e.message))

  await irAlInicio(page)
  await page.getByRole('tab', { name: /Egresos/ }).click()
  // ⚠️ La solapa se llama «Egresos sin Factura», no «Templates» — el nombre interno y el
  // rótulo de pantalla no coinciden, y buscar por el interno da timeout sin decir por qué.
  await page.getByRole('tab', { name: 'Egresos sin Factura' }).click()

  // La tabla es de cuotas: se busca el template y salen sus filas.
  const buscador = page.getByPlaceholder(/Buscar/).first()
  await expect(buscador).toBeVisible({ timeout: 120_000 })
  await buscador.fill(TEMPLATE)
  await page.waitForTimeout(2500)

  // ── Abrir ────────────────────────────────────────────────────────────────────────────────
  // ⚠️ El ✏️ se ancla A LA FILA del template, no `.first()` del DOM.
  // La primera versión usaba `.first()` y abrió **Imp .Ganancias MSA**: el buscador todavía no
  // había filtrado y el primer lápiz del DOM era el de otra fila. El test daba un error raro
  // («1 cuota en vez de 4») que no tenía nada que ver con el editor.
  const fila = page.getByRole('row').filter({ hasText: TEMPLATE }).first()
  await expect(fila, 'la fila del template tiene que estar en la tabla').toBeVisible({ timeout: 60_000 })
  const lapiz = fila.getByTitle(/Editar la campaña/)
  await expect(lapiz, 'el ✏️ tiene que estar en la fila del template').toBeVisible({ timeout: 30_000 })
  await lapiz.click()

  const modal = page.locator('div').filter({ hasText: /^✏️ Editar campaña/ }).first()
  await expect(page.getByText('Editar campaña', { exact: false }).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/Cargando el template y sus vínculos/)).toHaveCount(0, { timeout: 60_000 })
  await page.screenshot({ path: `${OUT}/f131-01-abierto.png`, fullPage: true })

  const texto = await page.locator('body').innerText()
  console.log('\n✏️ EDITOR:\n' + texto.slice(texto.indexOf('Editar campaña'), texto.indexOf('Editar campaña') + 2200))

  // ── Lo que tiene que estar ───────────────────────────────────────────────────────────────
  await expect(page.getByText(TEMPLATE).first()).toBeVisible()
  expect(texto, 'el encabezado tiene que decir la campaña y el tipo').toContain('fijo')

  // Las 4 cuotas: 4 inputs de fecha dentro del editor.
  const fechas = page.locator('input[type="date"]')
  const nFechas = await fechas.count()
  console.log(`\n📅 filas de cuota: ${nFechas}`)
  expect(nFechas, 'tienen que estar las 4 cuotas del template').toBe(4)

  // 🔗 El vínculo de la cuota 1 se tiene que VER. Es el corazón de la feature: si el editor no
  // muestra qué está conciliado, el usuario no tiene cómo saber qué está por romper.
  expect(texto, 'el pie tiene que contar los movimientos conciliados').toMatch(/movimiento\(s\) conciliado\(s\)/)
  const vinculos = texto.match(/🔗\s*(\d+)\s*movimiento/)
  console.log(`🔗 vínculos que declara: ${vinculos?.[1] ?? '(ninguno)'}`)
  expect(Number(vinculos?.[1] ?? 0), 'la cuota 1 está conciliada: tiene que declarar al menos 1').toBeGreaterThanOrEqual(1)

  // ── El check al momento: cambiar el monto de la conciliada tiene que gritar ───────────────
  //
  // 🔴 Éste es el control que pidió el usuario. Se escribe en el input y **no se guarda**: el
  // aviso tiene que aparecer mientras se tipea, que es toda la diferencia con un control que
  // avisa al apretar Guardar.
  const primerMonto = page.locator('input.text-right').first()
  await expect(primerMonto).toBeVisible()
  const valorAntes = await primerMonto.inputValue()
  console.log(`\n💰 monto de la cuota 1 antes: ${valorAntes}`)

  await primerMonto.fill('99.999,00')
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/f131-02-aviso-rojo.png`, fullPage: true })

  const conAviso = await page.locator('body').innerText()
  console.log('\n🔴 ¿avisó?\n' + (conAviso.match(/Esta cuota está conciliada[^\n]*/) ?? ['(no avisó)'])[0])
  expect(conAviso, 'cambiar el monto de una cuota conciliada tiene que avisar EN EL MOMENTO')
    .toContain('Esta cuota está conciliada y el cambio la deja sin cerrar')

  // Y el resumen de «al guardar» tiene que decir que el id se conserva.
  expect(conAviso, 'el resumen tiene que prometer que el vínculo sobrevive').toContain('el vínculo se conserva')

  // ── Agregar una cuota: el caso que lo originó (4 → 5) ─────────────────────────────────────
  await primerMonto.fill(valorAntes)            // deshacer el cambio de prueba
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /Agregar cuota/ }).click()
  await page.waitForTimeout(600)
  const nDespues = await page.locator('input[type="date"]').count()
  console.log(`📅 filas de cuota tras agregar: ${nDespues}`)
  expect(nDespues, 'agregar una cuota tiene que sumar una fila').toBe(nFechas + 1)
  await page.screenshot({ path: `${OUT}/f131-03-cuota-agregada.png`, fullPage: true })

  const conNueva = await page.locator('body').innerText()
  expect(conNueva, 'el resumen tiene que anunciar la cuota nueva').toMatch(/Cuota nueva el \d{4}-\d{2}-\d{2}/)

  // ── 🛑 Salir SIN guardar ──────────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: /^Cancelar$/ }).first().click()
  await page.waitForTimeout(1200)

  console.log(`\n🔴 errores de página: ${errores.length}`)
  for (const e of errores) console.log('   ' + e.slice(0, 300))
  expect(errores, 'el editor no puede tirar errores de JS').toHaveLength(0)
})
