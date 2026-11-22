/**
 * 📖 LO QUE LEE LA VISTA «POR RESPONSABLE» Y LA CUENTA ENTRE SOCIOS — A-FEAT-1637. SÓLO LEE.
 *
 * Recibe el cliente de la base (el del navegador o uno de script), así la pantalla y el control desde Node leen lo mismo.
 *   · Todos los canales en pesos de las TRES empresas (el mismo registro y el mismo filtro que «Por caja»: `canalesDelDashboard`,
 *     movimientos con categoría), del período pedido. Para saber qué pagó otro por una empresa hay que mirar los canales de todos.
 *   · Desde qué fecha tiene datos cada canal (para decir en la cuenta lo que no se sabe).
 *   · El plan de cuentas, los templates (con su responsable), de qué empresa es cada factura pagada y de qué empresa es el empleado
 *     de cada pago de sueldo.
 */
import type { CuentaContable } from "@/lib/supabase"
import { traerTodo } from "@/lib/supabase-paginado"
import { EMPRESAS_DASHBOARD, canalesDelDashboard, type CanalDashboard, type CuentaDelRegistro } from "./canales"
import type { InfoTemplate } from "./resumen"
import type { CanalDesde, ContextoResponsable } from "./responsable"

export interface DatosPorResponsable {
  canales: CanalDashboard[]
  movs: any[]
  cuentas: CuentaContable[]
  templates: Map<string, InfoTemplate>
  ctx: ContextoResponsable
  desdeCanal: CanalDesde[]
  /** Lo que no se pudo leer (o no llegó entero): se dice arriba de la vista. */
  problemas: string[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function leerDatosPorResponsable(cliente: any, registro: CuentaDelRegistro[], desde: string, hasta: string): Promise<DatosPorResponsable> {
  const de = (schema: string, tabla: string) => (schema === "public" ? cliente.from(tabla) : cliente.schema(schema).from(tabla))
  const problemas: string[] = []
  const canales = canalesDelDashboard(registro, EMPRESAS_DASHBOARD)

  const [cuentasR, tplR] = await Promise.all([
    cliente.from("cuentas_contables").select("*"),
    traerTodo<any>((d, h) => cliente.from("egresos_sin_factura").select("id, nombre_referencia, cuenta_agrupadora, es_multi_cuenta, tipo, responsable").order("id").range(d, h)),
  ])
  if (cuentasR.error) problemas.push(`plan de cuentas: ${cuentasR.error.message}`)
  if (tplR.error) problemas.push(`templates: ${tplR.error.message}`)
  const templates = new Map<string, InfoTemplate>()
  const responsableTemplate = new Map<string, string | null>()
  for (const t of tplR.data) {
    templates.set(t.id, { nombre: t.nombre_referencia, agrupadora: t.cuenta_agrupadora || null, esMulti: !!t.es_multi_cuenta, tipo: t.tipo || null })
    responsableTemplate.set(t.id, t.responsable ?? null)
  }

  const leidos = await Promise.all(canales.map(async canal => {
    const r = await traerTodo<any>((d, h) => de(canal.schema, canal.tabla).select("*", { count: "exact" })
      .gte("fecha", desde).lte("fecha", hasta).not("categ", "is", null).order("id").range(d, h))
    if (r.error) problemas.push(`${canal.nombre}: ${r.error.message}`)
    else if (r.esperadas != null && r.esperadas !== r.data.length) problemas.push(`${canal.nombre}: llegaron ${r.data.length} de ${r.esperadas}`)
    const p = await de(canal.schema, canal.tabla).select("fecha").order("fecha", { ascending: true }).limit(1)
    const primera = p.error ? null : (p.data?.[0]?.fecha ? String(p.data[0].fecha).slice(0, 10) : null)
    return { canal, movs: r.data.map((m: any) => ({ ...m, _canal: canal.nombre, _empresa: canal.empresa })), primera }
  }))
  const movs = leidos.flatMap(l => l.movs)
  const desdeCanal: CanalDesde[] = leidos.map(l => ({ canal: l.canal.nombre, empresa: l.canal.empresa, desde: l.primera }))

  // 🧾 De quién es cada factura pagada: se busca el id en los comprobantes de cada empresa.
  const empresaFactura = new Map<string, string>()
  const idsFc = [...new Set(movs.map(m => m.comprobante_arca_id).filter(Boolean).map(String))]
  for (const emp of EMPRESAS_DASHBOARD) {
    for (let i = 0; i < idsFc.length; i += 200) {
      const { data, error } = await cliente.schema(emp.toLowerCase()).from("comprobantes_arca").select("id").in("id", idsFc.slice(i, i + 200))
      if (error) { problemas.push(`facturas de ${emp}: ${error.message}`); break }
      for (const f of data ?? []) empresaFactura.set(String(f.id), emp)
    }
  }

  // 👷 De qué empresa es el empleado de cada pago de sueldo (el pago o su grupo).
  const empresaSueldo = new Map<string, string>()
  if (movs.some(m => m.sueldo_pago_id)) {
    const [emps, pagos] = await Promise.all([
      traerTodo<any>((d, h) => cliente.from("sueldos_empleados").select("id, empresa").order("id").range(d, h)),
      traerTodo<any>((d, h) => cliente.from("sueldos_pagos").select("id, grupo_pago_id, empleado_id").order("id").range(d, h)),
    ])
    if (emps.error || pagos.error) problemas.push(`sueldos: ${(emps.error ?? pagos.error)!.message}`)
    const empresaDe = new Map(emps.data.map((e: any) => [String(e.id), String(e.empresa ?? "").toUpperCase()]))
    for (const p of pagos.data) {
      const e = empresaDe.get(String(p.empleado_id)); if (!e) continue
      empresaSueldo.set(String(p.id), e)
      if (p.grupo_pago_id && !empresaSueldo.has(String(p.grupo_pago_id))) empresaSueldo.set(String(p.grupo_pago_id), e)
    }
  }

  return { canales, movs, cuentas: cuentasR.data ?? [], templates, ctx: { responsableTemplate, empresaFactura, empresaSueldo }, desdeCanal, problemas }
}
