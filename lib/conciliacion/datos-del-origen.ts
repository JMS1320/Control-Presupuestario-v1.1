/**
 * 🧲 **A-BUG-175 — lo que el movimiento hereda de su ORIGEN al conciliarse.**
 *
 * Lo destapó el audit en el primer lote que el usuario conciliió con la herramienta (19-30/06):
 * **25 de 28 sin proveedor y 21 sin comprobante**, aunque el template los tuviera.
 *
 * ## El bug era uno solo
 * El motor **vincula el movimiento a su template y después no le copia nada de ahí**. El proveedor
 * lo buscaba **sólo por el CUIT bancario**, y un impuesto al débito o una comisión **no traen CUIT**
 * en el extracto — así que quedaba vacío aunque el template dijera `Banco Galicia`.
 *
 * ## 🔑 La precedencia, fijada por el usuario (2026-09-19)
 * > *«Si un template tiene el proveedor, eso **siempre** debe entrar, al igual que una factura,
 * > ídem un anticipo. Recién si no hubiera, la app debería preguntar si quiero que ponga el
 * > proveedor que informa el banco.»*
 *
 * | | |
 * |---|---|
 * | 1️⃣ Lo que el **usuario** ya escribió a mano | nunca se pisa |
 * | 2️⃣ Lo que dice el **origen** (template / factura / anticipo) | **manda** sobre el banco |
 * | 3️⃣ El **CUIT del banco** | último recurso, y se marca como sugerido |
 *
 * 📌 **Por qué el origen le gana al banco**: el banco informa *quién recibió la transferencia*, que
 * no siempre es *a quién le pagás* — y en los gastos bancarios no informa nada. El origen es la
 * obligación, y la obligación sabe a nombre de quién está.
 *
 * ## 📛 `nombre_quien_cobra` vs `proveedor`: son LO MISMO
 * Medido sobre los 185 templates: **113 tienen las dos y sólo 1 difiere** — y esa diferencia es
 * **truncamiento** (`Consorcio De Propietarios Posadas` vs `…Posa`, cortado a 30 caracteres).
 *
 * 🔑 **Son la misma cosa duplicada en dos columnas, y por eso hay líos: unos lugares leen una y
 * otros la otra.** `nombre_quien_cobra` es la versión completa, así que **manda ella** y `proveedor`
 * queda de respaldo. Unificarlas en una sola columna es trabajo aparte → [A-DEC-26].
 */

export interface TemplateOrigen {
  nombre_referencia?: string | null
  cuit_quien_cobra?: string | null
  responsable?: string | null
  nombre_quien_cobra?: string | null
  proveedor?: string | null
  centro_costo?: string | null
}

const t = (s: string | null | undefined) => (s ?? '').trim()

/**
 * Quién cobra, según el template.
 *
 * `nombre_quien_cobra` primero porque es la versión completa; `proveedor` está truncado a 30.
 */
export function proveedorDelTemplate(tpl: TemplateOrigen | null | undefined): string | null {
  if (!tpl) return null
  return t(tpl.nombre_quien_cobra) || t(tpl.proveedor) || null
}

export interface CamposDelMovimiento {
  proveedor_nombre?: string | null
  comprobantes_pagados?: string | null
  centro_de_costo?: string | null
}

export interface Heredado {
  proveedor_nombre: string | null
  comprobantes_pagados: string | null
  centro_de_costo: string | null
  /** 🏦 `true` si el proveedor terminó saliendo del CUIT del banco y no del origen. */
  proveedorVieneDelBanco: boolean
}

/**
 * Resuelve las tres columnas que se heredan del origen, aplicando la precedencia de arriba.
 *
 * `identificador` es lo que devuelve `identificadorDeCuota(cuota, template)` — se pasa ya calculado
 * para no duplicar acá la construcción del período (§ ♻️ Centralizar, no duplicar).
 *
 * ⚠️ **Nada se pisa**: si el movimiento ya trae un valor, ese gana. Una automatización que
 * sobrescribe lo que una persona escribió deja de ser ayuda y pasa a ser pérdida de datos.
 */
export function heredarDelOrigen(
  actual: CamposDelMovimiento,
  tpl: TemplateOrigen | null | undefined,
  identificador: string | null,
  proveedorSegunBanco?: string | null,
): Heredado {
  const delOrigen = proveedorDelTemplate(tpl)
  const yaTiene = t(actual.proveedor_nombre)

  const proveedor = yaTiene || delOrigen || t(proveedorSegunBanco) || null

  return {
    proveedor_nombre: proveedor,
    comprobantes_pagados: t(actual.comprobantes_pagados) || t(identificador) || null,
    centro_de_costo: t(actual.centro_de_costo) || t(tpl?.centro_costo) || null,
    // Sólo cuenta como "del banco" si el origen no tenía nada que aportar.
    proveedorVieneDelBanco: !yaTiene && !delOrigen && !!t(proveedorSegunBanco),
  }
}


/**
 * 🪪 **A-FEAT-154 — el CUIT del banco contra el del origen.**
 *
 * Pedido del usuario 2026-09-19: *«el control sería de coincidencia con el CUIT en leyendas
 * adicionales. Si no coincide deja como auditar. **Pero si encuentra campo en blanco, no se le hace
 * caso**»*.
 *
 * 🔑 **Esa segunda mitad es la que lo hace usable.** Los gastos bancarios —impuesto al débito, IVA,
 * comisiones— **no traen CUIT en el extracto**: un control que exigiera coincidencia mandaría medio
 * lote a `auditar` y terminaría apagado. **Campo vacío = no opina.**
 *
 * 📌 **Advierte, no bloquea** (§ `CLAUDE.md` 🚦): el pago pudo hacerse a un CUIT distinto por una
 * razón real —una cesión, un pago a nombre de otro—, así que el movimiento se concilia igual y
 * queda marcado para que lo mire una persona.
 */
export function cuitsDiscrepan(
  cuitDelBanco: string | null | undefined,
  cuitDelOrigen: string | null | undefined,
): boolean {
  const soloDigitos = (x: string | null | undefined) => (x ?? '').replace(/\D/g, '')
  const a = soloDigitos(cuitDelBanco)
  const b = soloDigitos(cuitDelOrigen)
  if (!a || !b) return false        // alguno en blanco → no opina
  return a !== b
}

/** El motivo que se escribe en `motivo_revision` cuando los CUIT no coinciden. */
export function motivoCuitDistinto(cuitDelBanco: string, cuitDelOrigen: string): string {
  return `El banco informa CUIT ${cuitDelBanco} y el origen tiene ${cuitDelOrigen}`
}
