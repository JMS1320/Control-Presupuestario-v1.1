/**
 * 🩺 **¿Los movimientos conciliados con una factura tienen la cuenta de su factura?** (A-DEC-1021 (6))
 *
 * Usuario 2026-10-25: un movimiento atado a una factura que tiene otra clasificación *«sería un error
 * estructural de datos que debería tener un aviso de error antes de que yo actúe»*. Esto lo detecta al
 * abrir Asignación de cuentas, no recién al confirmar.
 *
 * La regla de fondo (A-BUG-1225): *todo movimiento conciliado contra una factura termina con la cuenta
 * contable de esa factura*. Entonces, para cada movimiento atado a una factura de la empresa:
 *
 * | Qué se ve | Qué es | Cómo se muestra |
 * |---|---|---|
 * | misma cuenta y número que la factura | bien | nada |
 * | la factura no tiene cuenta | **pendiente** — es justamente lo que se asigna en la pantalla | se marca la fila, no es error |
 * | categ de otro sistema (FCI, Caja, Sueldos…) | **error estructural**: ese vínculo no debería existir | 🛑 error |
 * | otra cuenta del plan, o número que no corresponde | **desincronizado** | 🛑 error |
 * | provisorio (SIN_CATEG, ANTICIPO…) con factura que SÍ tiene cuenta | la cuenta no llegó | 🛑 error |
 *
 * 📌 En un control van sólo ERRORES; lo que falta cargar es pendiente (feedback del usuario).
 * Los movimientos que apuntan a un GRUPO de pago no se miran acá: es A-BUG-1252, decidido para después.
 */
import { TABLAS_CON_VINCULO_ARCA, COLUMNA_VINCULO_ARCA } from "./tablas-con-vinculo-arca"
import { esCategProvisoria, type ClienteParaPropagar } from "./propagar-cuenta"
import { parCoincideConPlan, nombresDeCuentasDeFactura, type FilaDelPlan } from "@/lib/facturas/nro-de-cuenta"

export interface MovimientoVinculado {
  schema: string
  tabla: string
  que: string
  id: string
  categ: string | null
  nro_cuenta: string | null
  facturaId: string
}

export interface FacturaParaRevisar {
  id: string
  cuenta_contable: string | null
  nro_cuenta: string | null
}

export type TipoProblema = "otro_sistema" | "desincronizado" | "no_llego"

export interface ProblemaDeVinculo {
  tipo: TipoProblema
  mov: MovimientoVinculado
  /** Qué tiene el movimiento y qué debería tener, en palabras. */
  detalle: string
}

export interface Diagnostico {
  errores: ProblemaDeVinculo[]
  /** Facturas sin cuenta que ya tienen movimientos conciliados: la cuenta va a viajar al asignarla. */
  pendientesConciliadas: Map<string, number>
  /** Movimientos conciliados por factura (para mostrar en la fila). */
  movimientosPorFactura: Map<string, number>
}

const n = (s: unknown) => String(s ?? "").trim().toLowerCase()

/** La parte pura: no toca la base. Sólo mira movimientos de facturas que están en `facturas`. */
export function diagnosticarVinculos(
  movs: readonly MovimientoVinculado[],
  facturas: readonly FacturaParaRevisar[],
  plan: readonly FilaDelPlan[],
): Diagnostico {
  const porId = new Map(facturas.map(f => [f.id, f]))
  const nombresPlan = new Set(nombresDeCuentasDeFactura(plan).map(n))
  const errores: ProblemaDeVinculo[] = []
  const pendientesConciliadas = new Map<string, number>()
  const movimientosPorFactura = new Map<string, number>()

  for (const m of movs) {
    const f = porId.get(m.facturaId)
    if (!f) continue // de otra empresa, o un grupo de pago (A-BUG-1252)
    movimientosPorFactura.set(f.id, (movimientosPorFactura.get(f.id) ?? 0) + 1)

    const facturaSinCuenta = !n(f.cuenta_contable) && !n(f.nro_cuenta)
    const provisorio = esCategProvisoria(m.categ)

    if (!provisorio && !nombresPlan.has(n(m.categ))) {
      errores.push({ tipo: "otro_sistema", mov: m,
        detalle: `está conciliado con una factura pero clasificado «${m.categ}», que no es una cuenta del plan` })
      continue
    }
    if (facturaSinCuenta) {
      if (provisorio) { pendientesConciliadas.set(f.id, (pendientesConciliadas.get(f.id) ?? 0) + 1); continue }
      errores.push({ tipo: "desincronizado", mov: m,
        detalle: `tiene la cuenta «${m.categ}» y su factura no tiene ninguna` })
      continue
    }
    if (provisorio) {
      errores.push({ tipo: "no_llego", mov: m,
        detalle: `sigue en «${m.categ ?? "vacío"}» y su factura tiene «${f.cuenta_contable}»` })
      continue
    }
    const igual = n(m.categ) === n(f.cuenta_contable) && n(m.nro_cuenta) === n(f.nro_cuenta)
    if (!igual || !parCoincideConPlan(plan, m.categ, m.nro_cuenta)) {
      errores.push({ tipo: "desincronizado", mov: m,
        detalle: `tiene «${m.categ}» (${m.nro_cuenta ?? "sin número"}) y su factura «${f.cuenta_contable}» (${f.nro_cuenta ?? "sin número"})` })
    }
  }
  return { errores, pendientesConciliadas, movimientosPorFactura }
}

/** Lee de los 11 extractos los movimientos atados a alguna factura. Una tabla que falla se informa. */
export async function cargarMovimientosVinculados(
  db: ClienteParaPropagar,
): Promise<{ movs: MovimientoVinculado[]; fallaron: string[] }> {
  const movs: MovimientoVinculado[] = []
  const fallaron: string[] = []
  await Promise.all(TABLAS_CON_VINCULO_ARCA.map(async t => {
    const q = t.schema === "public" ? db.from(t.tabla) : db.schema(t.schema).from(t.tabla)
    const { data, error } = await q
      .select(`id, categ, nro_cuenta, ${COLUMNA_VINCULO_ARCA}`)
      .not(COLUMNA_VINCULO_ARCA, "is", null)
      .range(0, 9999)
    if (error) { fallaron.push(t.que); return }
    for (const r of (data ?? []) as Array<Record<string, any>>) {
      movs.push({
        schema: t.schema, tabla: t.tabla, que: t.que, id: String(r.id),
        categ: r.categ ?? null, nro_cuenta: r.nro_cuenta == null ? null : String(r.nro_cuenta),
        facturaId: String(r[COLUMNA_VINCULO_ARCA]),
      })
    }
  }))
  return { movs, fallaron }
}

export const TITULO_PROBLEMA: Record<TipoProblema, string> = {
  otro_sistema: "Vínculo que no debería existir",
  desincronizado: "Cuenta distinta a la de su factura",
  no_llego: "La cuenta de la factura no llegó",
}
