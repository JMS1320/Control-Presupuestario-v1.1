/**
 * 🔴 A-TEST-110 — el ÚNICO test de esta carpeta que ESCRIBE. Leer esto entero antes de correrlo.
 *
 * ## 🛑 Por qué éste sí escribe, y qué significa
 * El resto de `pruebas-ui/` abre, mira y lee. Éste **completa un pago de verdad** sobre una factura
 * real, porque el bug que defiende ([A-BUG-146](../PENDIENTES.md#a-bug-146)) **sólo existe en el
 * acto de guardar**: dos clicks en «Confirmar» escribían dos filas en `sicore_retenciones`, y el
 * TXT de la quincena las sumaba — le habría declarado a ARCA el doble de lo que corresponde.
 * Ninguna capa que no escriba puede verlo.
 *
 * > **Permiso del usuario, 2026-09-11, explícito y para esta corrida.** El permiso **no se hereda**:
 * > correrlo de nuevo requiere pedirlo de nuevo (§ CLAUDE.md — 🛑 Datos · ✅ «Terminé»).
 *
 * ## La disciplina de § 🛑 Datos, las tres partes
 * 1. **Se apunta por ID**, nunca a «la primera fila que aparezca». El precedente tiene nombre: un
 *    test que clickeaba la primera fila marcada inventó $5.443.200 sobre 3 toros reales **y reportó
 *    OK**.
 * 2. **Foto antes**, tomada fuera del repo antes de tocar nada.
 * 3. **Se restaura al terminar**, apuntando por id y contra esa foto.
 *
 * ⚠️ **La restauración NO está adentro del test, y es a propósito.** Un `afterAll` que restaura
 * puede fallar a medias y dejar la factura en un estado intermedio **mientras el test reporta en
 * verde** — que es exactamente cómo el test de los 3 toros inventó una venta y dijo OK. Acá la
 * restauración se hace **afuera, a la vista, con el antes y el después impresos**. Si el test se
 * cuelga, la factura queda tocada y se ve; no hay forma de que quede tocada **y** parezca limpia.
 *
 * ## ⚠️ Lo único que NO se puede deshacer
 * El **número de certificado** de SICORE es perpetuo: la corrida consume uno y anularlo no lo
 * devuelve. Queda un certificado anulado, igual que los que dejan los resets normales de la app.
 * Está avisado y aceptado.
 *
 * ## El caso: LA MERCURE S.R.L., FC 2-2067
 * Se eligió porque **retiene** (neto $1.270.293,38 contra un mínimo de $67.170), que es el camino
 * **más grave**: una fila duplicada ahí no infla la base, infla **la retención declarada**.
 * Y el número esperado no se estima — la FC 2-2059 de agosto, idéntica en importe, dio exactamente
 * $24.062,47.
 */

import { test, expect } from '@playwright/test'
import { irAlInicio, RUTA } from './ayuda'

const FC = {
  id: '9e4ba330-310d-41fa-8a46-9af10fe8ea7f',
  etiqueta: '2067',
  cuit: '30714279315',
}

/** Lo que tiene que dar, sacado de la FC 2-2059 de agosto (mismo importe). */
const ESPERADO = {
  retencion: '24.062,47',
  aAbonar: '1.512.992,53',
}

const OUT = 'C:/Users/josem/AppData/Local/Temp/claude/D--Users-josem-Documents-Jose-Automatizarr-Claude-Control-Presupuestario-v1-1/93fe67ed-ce98-4c07-9cab-ef2f6c13fccd/scratchpad'

// Un solo test, en serie: el estado de la factura va cambiando y el orden importa.
test.describe.configure({ mode: 'serial' })

test('🔴 A-BUG-146 · el doble click en «Confirmar» deja UNA sola fila de SICORE', async ({ page }) => {
  test.skip(!RUTA, 'Falta PRUEBA_RUTA en .env.local')

  const errores: string[] = []
  page.on('pageerror', e => errores.push('PAGEERROR: ' + e.message))

  // ── 1 · Llegar a la fila, por su número de comprobante ─────────────────────────────────────
  await irAlInicio(page)
  await page.getByRole('tab', { name: 'Cash Flow' }).click()

  const buscador = page.getByPlaceholder('Buscar proveedor, CUIT, categ, detalle...')
  await expect(buscador).toBeVisible({ timeout: 120_000 })
  await buscador.fill(FC.cuit)
  await page.waitForTimeout(2500)

  const fila = page.getByRole('row').filter({ hasText: FC.etiqueta }).first()
  await expect(fila).toBeVisible()

  // ── 2 · Modo PAGOS (Ctrl+Click: un click normal no hace NADA y tampoco avisa) ──────────────
  await page.getByRole('button', { name: /^PAGOS$/ }).click({ modifiers: ['Control'] })
  await expect(page.getByRole('button', { name: /Cancelar PAGOS/ })).toBeVisible({ timeout: 20_000 })

  await fila.getByRole('checkbox').first().click()
  await expect(page.getByRole('button', { name: /Aplicar a 1 filas/ })).toBeVisible()

  // ── 3 · Estado → «Pagar» ──────────────────────────────────────────────────────────────────
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'Pagar', exact: true }).click()
  await page.screenshot({ path: `${OUT}/t110-01-listo-para-aplicar.png` })

  await page.getByRole('button', { name: /Aplicar a 1 filas/ }).click()

  // ── 4 · La fecha de pago (de acá sale la quincena) ─────────────────────────────────────────
  await expect(page.getByText('¿Con qué fecha se pagaron?')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Registrar con esta fecha' }).click()

  // ── 5 · El portón de SICORE ───────────────────────────────────────────────────────────────
  const botonRetener = page.getByRole('button', { name: /Retener SICORE/ })
  await expect(botonRetener).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: `${OUT}/t110-02-porton-sicore.png` })
  await botonRetener.click()

  // ── 6 · Tipo de operación → Servicios ─────────────────────────────────────────────────────
  await expect(page.getByText('Seleccioná el tipo de operación:')).toBeVisible({ timeout: 30_000 })
  // ⚠️ Sin anclar al diálogo, «Servicios» también matchea el renglón informativo de los mínimos
  //    («🔧 Servicios: $67.170 · 2,00%»), que no es un botón pero está en la misma pantalla.
  //    Y el emoji no se pone en el selector: es del dato (`tipos_sicore_config`), puede cambiar.
  await page.getByRole('dialog').getByRole('button').filter({ hasText: 'Servicios' }).first().click()

  // ── 7 · El cálculo: ANTES de confirmar, que el número sea el correcto ──────────────────────
  const confirmar = page.getByRole('button', { name: /Confirmar y pasar a Pagar/ })
  await expect(confirmar).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: `${OUT}/t110-03-calculo.png` })

  const modal = page.getByRole('dialog')
  const textoModal = await modal.innerText()
  console.log('\n📋 EL MODAL DICE:\n' + textoModal)

  // 🧮 El control, antes de escribir: si el número ya está mal, no tiene sentido seguir.
  expect(textoModal, `La retención tiene que ser $${ESPERADO.retencion} (la FC 2059 de agosto dio eso)`)
    .toContain(ESPERADO.retencion)

  // ── 8 · EL BUG: dos clicks seguidos, como los dio el usuario el 10/09 ──────────────────────
  //
  // 0,69 s fue la distancia real entre las dos filas duplicadas. Acá se aprieta dos veces sin
  // esperar nada en el medio, que es lo que hace un dedo apurado.
  await confirmar.click({ noWaitAfter: true })
  await confirmar.click({ noWaitAfter: true, force: true }).catch(() => {
    // Si el modal ya se cerró, el segundo click no encuentra el botón: también es un resultado
    // válido (la guarda funcionó a nivel de UI). Lo que decide es la BD, que se mira aparte.
    console.log('   (el 2º click no encontró el botón — el modal ya se había cerrado)')
  })

  await page.waitForTimeout(6000)
  await page.screenshot({ path: `${OUT}/t110-04-despues.png` })

  console.log(`\n🔴 errores de página: ${errores.length}`)
  for (const e of errores) console.log('   ' + e.slice(0, 300))
})
