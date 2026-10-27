/**
 * 🔄 LA PÓLIZA MANDA — sincronizar el template de cada póliza con lo que espera el banco (A-FEAT-1385, etapa 4).
 *
 * Pedido de JMS (2026-10-27): *«si viene endoso genera las cuotas y agrupa para estar preparado para el débito por
 * saldo… se ejecutaría solo cuando se sube extracto y se reconozca a Fed. Pat. o cuando se carguen pólizas»*.
 *
 * Cada póliza tiene SU template (`polizas_seguro.template_id`, script 108) y sus cuotas son, por vencimiento, lo que
 * espera el banco: los endosos sumados y las notas de crédito descontadas (`cuotasEsperadas` + `controlarDebitos`,
 * el mismo cálculo de Egresos → Seguros). Esto las mantiene al día:
 *   · cuota que falta → se crea;
 *   · cuota pendiente con otro importe (llegó un endoso) → se corrige;
 *   · cuota compensada por una NC → queda en 0, «desactivado»;
 *   · cuota pendiente que ya no corresponde → «desactivado» (NUNCA se borra);
 *   · cuota CONCILIADA → no se toca: si su importe no es el esperado, se AVISA (falta un endoso o sobra algo).
 * Y una póliza sin template → se le crea uno, copiando los campos de otra póliza del mismo ramo.
 *
 * Los avisos del banco (débito que no es de ninguna póliza, importe distinto) los da el mismo control.
 * El planificador es puro (`planDeLaPoliza`): la prueba `npm run probar`.
 */
import { controlarDebitos, cuotasEsperadas, esDeLaAseguradora, type CuotaControlada } from "./control-debitos"
import { polizaAnteriorDe } from "./resumen-ejercicio"

const r2 = (n: number) => Math.round(n * 100) / 100
const TOL = 0.01
export const MARCA_SINC = "[sincronizado desde la póliza]"

export interface CuotaDelTemplate {
  id: string
  fecha_estimada: string
  monto: number
  estado: string
}

export interface PlanPoliza {
  crear: { vencimiento: string; monto: number; compensada: boolean }[]
  actualizar: { id: string; vencimiento: string; montoAntes: number; monto: number; compensada: boolean }[]
  desactivar: { id: string; vencimiento: string; monto: number }[]
  avisos: string[]
}

/** Pura: qué hay que hacer con las cuotas del template de UNA póliza para que sean lo que espera el banco. */
export function planDeLaPoliza(poliza: string, esperadas: CuotaControlada[], existentes: CuotaDelTemplate[]): PlanPoliza {
  const plan: PlanPoliza = { crear: [], actualizar: [], desactivar: [], avisos: [] }
  const usadas = new Set<string>()
  const dias = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5
  for (const c of esperadas) {
    if (c.importe < 0 || c.resultado === "anterior-al-extracto") continue
    const compensada = c.resultado === "compensada"
    const monto = compensada ? 0 : r2(c.esperadoEnBanco)
    // La cuota del template para este vencimiento: misma fecha, o la más cercana a ±7 días (el plan del endoso y el
    // consolidado a veces difieren en un par de días).
    const candidata = existentes.filter(x => !usadas.has(x.id) && dias(x.fecha_estimada, c.vencimiento) <= 7)
      .sort((a, b) => dias(a.fecha_estimada, c.vencimiento) - dias(b.fecha_estimada, c.vencimiento))[0]
    if (!candidata) { plan.crear.push({ vencimiento: c.vencimiento, monto, compensada }); continue }
    usadas.add(candidata.id)
    if (candidata.estado === "conciliado") {
      if (Math.abs(Number(candidata.monto) - monto) > TOL) {
        plan.avisos.push(`Póliza ${poliza}: la cuota del ${c.vencimiento} ya está conciliada por ${candidata.monto} y la póliza dice ${monto} — falta un endoso o la conciliación no es la de esta cuota.`)
      }
      continue
    }
    const estadoQueVa = compensada ? "desactivado" : "pendiente"
    if (Math.abs(Number(candidata.monto) - monto) > TOL || (candidata.estado !== estadoQueVa && ["pendiente", "desactivado"].includes(candidata.estado))) {
      plan.actualizar.push({ id: candidata.id, vencimiento: c.vencimiento, montoAntes: Number(candidata.monto), monto, compensada })
    }
  }
  for (const x of existentes) {
    if (usadas.has(x.id) || x.estado !== "pendiente") continue
    plan.desactivar.push({ id: x.id, vencimiento: x.fecha_estimada, monto: Number(x.monto) })
  }
  return plan
}

export interface ResultadoSincronizacion {
  polizas: number
  templatesCreados: string[]
  cuotasCreadas: number
  cuotasActualizadas: number
  cuotasDesactivadas: number
  /** Facturas de endosos que no tenían su PDF y se lo vincularon desde la póliza (JMS: «que se vincule directo el PDF»). */
  pdfsVinculados: number
  avisos: string[]
}

/**
 * Sincroniza TODAS las pólizas (son pocas). `db` = cliente con permiso de escritura (servicio o sesión).
 * No toca movimientos del banco ni facturas: sólo los templates de las pólizas y sus cuotas.
 */
export async function sincronizarPolizas(db: any, opciones: { soloPolizas?: string[]; simular?: boolean } = {}): Promise<ResultadoSincronizacion> {
  const sim = !!opciones.simular
  const res: ResultadoSincronizacion = { polizas: 0, templatesCreados: [], cuotasCreadas: 0, cuotasActualizadas: 0, cuotasDesactivadas: 0, pdfsVinculados: 0, avisos: [] }
  const p = await db.from("polizas_seguro").select("id,poliza,seccion,poliza_anterior,vigencia_desde,vigencia_hasta,template_id,polizas_endosos(endoso,consolidado,comprobante_arca_id,comprobante_schema,pdf_drive_url,polizas_cuotas(vencimiento,importe),polizas_bienes(clave))")
  if (p.error) throw new Error("No se pudieron leer las pólizas: " + p.error.message)
  const pol = (p.data ?? []) as any[]
  const m = await db.from("msa_galicia").select("id,fecha,debitos,creditos,estado,leyendas_adicionales_1,leyendas_adicionales_2")
    .or("leyendas_adicionales_1.ilike.*federac*,leyendas_adicionales_2.ilike.*federac*,leyendas_adicionales_1.ilike.*patronal*,leyendas_adicionales_2.ilike.*patronal*").order("fecha")
  if (m.error) throw new Error("No se pudo leer el extracto: " + m.error.message)
  const f1 = await db.from("msa_galicia").select("fecha").order("fecha").limit(1)
  const f2 = await db.from("msa_galicia").select("fecha").order("fecha", { ascending: false }).limit(1)
  const ventana = { desde: f1.data?.[0]?.fecha ?? "2000-01-01", hasta: f2.data?.[0]?.fecha ?? "2100-01-01" }
  const movs = ((m.data ?? []) as any[]).filter(esDeLaAseguradora).map(x => ({ id: x.id, fecha: x.fecha, debitos: Number(x.debitos) || 0, creditos: Number(x.creditos) || 0, estado: x.estado }))
  const endosos = pol.flatMap(pp => (pp.polizas_endosos ?? []).map((e: any) => ({
    poliza: pp.poliza, endoso: e.endoso,
    cuotas: (e.polizas_cuotas ?? []).map((c: any) => ({ vencimiento: c.vencimiento, importe: Number(c.importe) })),
    consolidado: e.consolidado ? { fecha: e.consolidado.fecha, cuotas: e.consolidado.cuotas.map((c: any) => ({ vencimiento: c.vencimiento, importe: c.importe, saldo: c.saldo ?? null })) } : null,
  })))
  const ctl = controlarDebitos(cuotasEsperadas(endosos), movs, ventana)

  // Avisos del banco: lo que no casa con ninguna póliza (fuera de las anteriores al ejercicio) y los importes distintos.
  for (const x of ctl.movimientos) {
    if (x.resultado === "sin-poliza" && !polizaAnteriorDe(x.fecha, pol)) res.avisos.push(`Débito de la aseguradora del ${x.fecha} por ${x.debitos} que no es cuota de ninguna póliza cargada — falta cargar una póliza.`)
    if (x.resultado === "reintegro-sin-nc") res.avisos.push(`Reintegro de la aseguradora del ${x.fecha} por ${x.creditos} sin nota de crédito — pedir el papel.`)
  }
  for (const c of ctl.cuotas) {
    if (c.resultado === "importe-distinto") res.avisos.push(`Póliza ${c.poliza}: la cuota del ${c.vencimiento} esperaba ${c.esperadoEnBanco} y se debitó ${c.debitado} — falta un endoso.`)
  }

  // 📎 El PDF del endoso, directo a su factura (sólo si la factura no tiene uno: nunca se pisa).
  for (const e of pol.flatMap(pp => pp.polizas_endosos ?? []) as any[]) {
    if (!e.comprobante_arca_id || !e.pdf_drive_url) continue
    const schema = e.comprobante_schema || "msa"
    const f = await db.schema(schema).from("comprobantes_arca").select("id,pdf_drive_url").eq("id", e.comprobante_arca_id).maybeSingle()
    if (f.error || !f.data || f.data.pdf_drive_url) continue
    res.pdfsVinculados++
    if (!sim) await db.schema(schema).from("comprobantes_arca").update({ pdf_drive_url: e.pdf_drive_url }).eq("id", e.comprobante_arca_id)
  }

  const resp = ((await db.from("polizas_responsables").select("*")).data ?? []) as any[]
  for (const pp of pol) {
    if (opciones.soloPolizas && !opciones.soloPolizas.includes(pp.poliza)) continue
    const esperadas = ctl.cuotas.filter(c => c.poliza === pp.poliza)
    if (!esperadas.some(c => c.importe > 0 && c.resultado !== "anterior-al-extracto")) continue
    res.polizas++
    let templateId: string | null = pp.template_id
    if (!templateId) {
      res.templatesCreados.push(pp.poliza)
      if (sim) continue
      templateId = await crearTemplateDeLaPoliza(db, pp, pol, resp, esperadas.filter(c => c.importe > 0).length)
    }
    const ex = await db.from("cuotas_egresos_sin_factura").select("id,fecha_estimada,monto,estado").eq("egreso_id", templateId)
    if (ex.error) throw new Error(ex.error.message)
    const plan = planDeLaPoliza(pp.poliza, esperadas, (ex.data ?? []) as CuotaDelTemplate[])
    res.avisos.push(...plan.avisos)
    const persona = personaUnica(pp, resp)
    let n = (ex.data ?? []).length
    if (sim) { res.cuotasCreadas += plan.crear.length; res.cuotasActualizadas += plan.actualizar.length; res.cuotasDesactivadas += plan.desactivar.length; continue }
    for (const c of plan.crear) {
      const r = await db.from("cuotas_egresos_sin_factura").insert({
        egreso_id: templateId, numero_cuota: ++n, fecha_vencimiento: c.vencimiento, fecha_estimada: c.vencimiento, monto: c.monto,
        estado: c.compensada ? "desactivado" : "pendiente",
        descripcion: `${MARCA_SINC} póliza ${pp.poliza} · vence ${c.vencimiento}${c.compensada ? " · compensada con NC: no se debita" : ""}`,
        detalle: persona, tipo_movimiento: "egreso", medio_pago: "banco", visible_contable: false,
      })
      if (r.error) throw new Error(r.error.message)
      res.cuotasCreadas++
    }
    for (const c of plan.actualizar) {
      const r = await db.from("cuotas_egresos_sin_factura").update({ monto: c.monto, estado: c.compensada ? "desactivado" : "pendiente" }).eq("id", c.id)
      if (r.error) throw new Error(r.error.message)
      res.cuotasActualizadas++
    }
    for (const c of plan.desactivar) {
      const r = await db.from("cuotas_egresos_sin_factura").update({ estado: "desactivado" }).eq("id", c.id)
      if (r.error) throw new Error(r.error.message)
      res.cuotasDesactivadas++
    }
  }
  return res
}

function personaUnica(pp: any, resp: any[]): string {
  const claves = [...new Set((pp.polizas_endosos ?? []).flatMap((e: any) => (e.polizas_bienes ?? []).map((b: any) => b.clave)).filter(Boolean))]
  if (claves.length !== 1) return ""
  return resp.find(r => r.clave === claves[0])?.descripcion ?? ""
}

const RAMO: Record<string, string> = { AUTOMOTORES: "Flota", "ACCIDENTES PERSONALES": "Accidentes Personales", "VIDA COLECTIVO": "Vida Colectivo" }

/** Una póliza nueva: su template, con los campos de otra póliza del mismo ramo (o de cualquiera de seguros). */
async function crearTemplateDeLaPoliza(db: any, pp: any, pol: any[], resp: any[], cuotas: number): Promise<string> {
  const hermana = pol.find(x => x.template_id && x.seccion === pp.seccion) ?? pol.find(x => x.template_id)
  if (!hermana) throw new Error(`La póliza ${pp.poliza} no tiene template y no hay otra póliza de donde copiarlo.`)
  const molde = (await db.from("egresos_sin_factura").select("*").eq("id", hermana.template_id).single()).data
  const claves = [...new Set((pp.polizas_endosos ?? []).flatMap((e: any) => (e.polizas_bienes ?? []).map((b: any) => b.clave)).filter(Boolean))]
  const rs = claves.map(k => resp.find(r => r.clave === k))
  const contables = [...new Set(rs.map(r => r?.responsable_contable ?? "MSA"))]
  const internos = [...new Set(rs.map(r => r?.responsable_interno ?? "MSA"))]
  const contable = contables.length === 1 ? contables[0] : "MSA"
  const interno = internos.length === 1 ? internos[0] : null
  const año = (() => { const [y, mo] = String(pp.vigencia_desde ?? "").split("-").map(Number); const a = mo >= 7 ? y : y - 1; return a ? `${String(a % 100).padStart(2, "0")}/${String((a + 1) % 100).padStart(2, "0")}` : molde["año"] })()
  const fila = {
    template_master_id: molde.template_master_id, nombre_referencia: `Seguro ${RAMO[pp.seccion] ?? pp.seccion} — póliza ${pp.poliza}`,
    proveedor: molde.proveedor, cuit_quien_cobra: molde.cuit_quien_cobra, nombre_quien_cobra: molde.nombre_quien_cobra,
    categ: molde.categ, centro_costo: molde.centro_costo, responsable: contable,
    responsable_interno: pp.seccion === "AUTOMOTORES" ? molde.responsable_interno : interno,
    cuotas, tipo_fecha: molde.tipo_fecha, codigo_contable: molde.codigo_contable,
    codigo_interno: pp.seccion === "AUTOMOTORES" ? molde.codigo_interno : interno ? (interno === contable ? "No Lleva" : `DIST ${interno}`) : "Desglosar",
    activo: true, "año": año, cuenta_agrupadora: molde.cuenta_agrupadora, tipo_template: molde.tipo_template, tipo: molde.tipo,
    periodicidad: molde.periodicidad, aplica_generacion: false, solo_conciliacion: false,
    observaciones_template: `${MARCA_SINC} A-FEAT-1385 — template de la póliza ${pp.poliza}, creado solo al aparecer la póliza.`,
  }
  const r = await db.from("egresos_sin_factura").insert(fila).select("id").single()
  if (r.error) throw new Error("No se pudo crear el template de la póliza: " + r.error.message)
  await db.from("polizas_seguro").update({ template_id: r.data.id }).eq("id", pp.id)
  // La regla de códigos de las flotas (interno «Desglosar»), como la de su hermana.
  // Sólo si la hermana es del MISMO ramo: las reglas de una flota no valen para un accidente personal.
  const reglas = hermana.seccion !== pp.seccion ? [] : ((await db.from("reglas_contable_interno").select("*").eq("template_id", hermana.template_id).eq("activo", true)).data ?? []) as any[]
  for (const rg of reglas) {
    await db.from("reglas_contable_interno").insert({ orden: rg.orden, cuenta_bancaria_id: rg.cuenta_bancaria_id, tipo_regla: rg.tipo_regla, template_id: r.data.id, codigo_contable: rg.codigo_contable, codigo_interno: rg.codigo_interno, activo: true })
  }
  return r.data.id
}
