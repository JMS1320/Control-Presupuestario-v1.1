/**
 * 🧾 **ASIGNAR LA CUENTA CONTABLE A FACTURAS — el único camino** (A-DEC-1021, 2026-10-25).
 *
 * Usuario: *«extractos son extractos, todos siguen la misma lógica… debemos dejar todo listo antes»*.
 * Había **cinco** lugares que cambiaban la cuenta de una factura y cada uno lo hacía a su manera:
 *
 * | Dónde | Qué hacía mal |
 * |---|---|
 * | Egresos → Asignación de cuentas | sólo MSA |
 * | Cash Flow → el punto de la cuenta | sólo MSA |
 * | Cash Flow → Ctrl+Click en CATEG | escribía en MSA aunque la factura fuera de PAM o MA |
 * | Subdiario → la celda de cuenta | propagaba a 3 de 11 extractos, sin avisar si fallaba (A-BUG-1227) |
 * | Subdiario → vista de Pagos | 3 de 11, y al QUITAR la cuenta no propagaba nada |
 *
 * Ahora todos llaman a `/api/arca-asignar`, que usa esto. Tres reglas:
 * 1. **Una empresa por vez** — se dice cuál, y si alguna factura no es de esa empresa no se escribe
 *    NADA (usuario: *«el asignador de cuentas no debe mezclar las compañías»*).
 * 2. **Número y nombre salen juntos del plan** (A-BUG-1371) — `resolverCuentaDelPlan`.
 * 3. **La cuenta viaja a TODOS los extractos** — `propagarCuentaAMovimientos` (las 11 tablas).
 */
import { resolverCuentaDelPlan, nombresDeCuentasDeFactura, type FilaDelPlan, type ParDeCuenta } from "@/lib/facturas/nro-de-cuenta"
import { propagarCuentaAMovimientos, type ClienteParaPropagar, type ResultadoPropagacion } from "./propagar-cuenta"

export type EmpresaFactura = "MSA" | "PAM" | "MA"
export const EMPRESAS_FACTURA: readonly EmpresaFactura[] = ["MSA", "PAM", "MA"]

export function schemaDeEmpresaFactura(e: EmpresaFactura): "msa" | "pam" | "ma" {
  return e === "PAM" ? "pam" : e === "MA" ? "ma" : "msa"
}

/** De un schema (`msa` / `pam` / `ma`, como lo devuelve `schemaDeFila`) a la empresa. */
export function empresaDeSchema(schema: string | null | undefined): EmpresaFactura {
  return schema === "pam" ? "PAM" : schema === "ma" ? "MA" : "MSA"
}

export type PlanDeAsignacion =
  | { ok: true; schema: "msa" | "pam" | "ma"; ids: string[]; cambios: { cuenta_contable: string | null; nro_cuenta: string | null }; cuenta: ParDeCuenta | null }
  | { ok: false; error: string }

/**
 * 🧮 La parte pura: decide QUÉ se escribe y DÓNDE, sin tocar la base (así se prueba).
 * @param idsDeLaEmpresa las facturas pedidas que efectivamente están en esa empresa
 */
export function planificarAsignacion(
  plan: readonly FilaDelPlan[],
  empresa: EmpresaFactura,
  ids: readonly string[],
  idsDeLaEmpresa: readonly string[],
  entrada: { nro_cuenta?: string | null; cuenta_contable?: string | null },
): PlanDeAsignacion {
  if (!EMPRESAS_FACTURA.includes(empresa)) return { ok: false, error: `Empresa desconocida: ${empresa}` }
  const unicos = [...new Set(ids)]
  if (unicos.length === 0) return { ok: false, error: "Se requiere al menos una factura" }
  const r = resolverCuentaDelPlan(plan, entrada)
  if (!r.ok) return { ok: false, error: `${r.error}: no se guardó nada` }
  const hallados = new Set(idsDeLaEmpresa)
  const faltan = unicos.filter(id => !hallados.has(id))
  if (faltan.length > 0) {
    return { ok: false, error: `${faltan.length} de ${unicos.length} factura(s) no son de ${empresa}: no se guardó nada (se trabaja una empresa por vez)` }
  }
  // Quitar la cuenta = los DOS vacíos (antes quedaba el nombre: A-BUG-1371).
  return {
    ok: true, schema: schemaDeEmpresaFactura(empresa), ids: unicos, cuenta: r.cuenta,
    cambios: { cuenta_contable: r.cuenta?.cuenta_contable ?? null, nro_cuenta: r.cuenta?.nro_cuenta ?? null },
  }
}

export interface ResultadoAsignacion {
  actualizados: number
  cuenta: ParDeCuenta | null
  propagacion: ResultadoPropagacion
}

/**
 * Guarda el par (número + nombre) en las facturas de UNA empresa y lo lleva a sus movimientos.
 * Tira error —sin haber escrito nada— si el par no se resuelve en el plan o si alguna factura no está
 * en esa empresa.
 */
export async function asignarCuentaAFacturas(
  db: ClienteParaPropagar,
  empresa: EmpresaFactura,
  ids: string[],
  entrada: { nro_cuenta?: string | null; cuenta_contable?: string | null },
): Promise<ResultadoAsignacion> {
  if (!EMPRESAS_FACTURA.includes(empresa)) throw new Error(`Empresa desconocida: ${empresa}`)
  const unicos = [...new Set(ids)]
  if (unicos.length === 0) throw new Error("Se requiere al menos una factura")

  const { data: plan, error: ePlan } = await db.from("cuentas_contables").select("categ, cuenta_contable, nro_cuenta, tipo")
  if (ePlan) throw new Error(`No se pudo leer el plan de cuentas: no se guardó nada (${ePlan.message})`)
  const filasPlan = (plan ?? []) as FilaDelPlan[]

  // 1 · Primero se mira cuáles están en ESA empresa. Un UPDATE que no encuentra la fila no falla.
  const schema = schemaDeEmpresaFactura(empresa)
  const { data: existentes, error: eLee } = await db.schema(schema).from("comprobantes_arca").select("id").in("id", unicos)
  if (eLee) throw new Error(eLee.message)

  const p = planificarAsignacion(filasPlan, empresa, unicos, (existentes ?? []).map((f: { id: string }) => f.id), entrada)
  if (!p.ok) throw new Error(p.error)

  // 2 · Se guarda el par entero.
  const { error: eUp, count } = await db.schema(p.schema).from("comprobantes_arca")
    .update(p.cambios, { count: "exact" }).in("id", p.ids)
  if (eUp) throw new Error(eUp.message)

  // 3 · Y viaja a los movimientos ya conciliados, en los 11 extractos.
  const propagacion = await propagarCuentaAMovimientos(db, p.ids, p.cambios, nombresDeCuentasDeFactura(filasPlan))

  return { actualizados: count ?? p.ids.length, cuenta: p.cuenta, propagacion }
}
