/**
 * 🛡️🔗 GENERA el script 108 — un template por póliza, con las cuotas que espera el banco, y la conciliación
 * re-apuntada a la cuota de SU póliza (A-FEAT-1385, etapas 2-3). Sólo LEE la base y ESCRIBE dos .sql.
 *
 * Por qué generado y no a mano: los importes de cada cuota salen del MISMO cálculo que muestra Egresos → Seguros
 * (`cuotasEsperadas` + `controlarDebitos`: endosos sumados, NC compensadas). Escribirlos a mano sería otro camino
 * para el mismo número — exactamente lo que no tiene que pasar.
 *
 * Decisiones de JMS (27/10): (1) los movimientos en «histórico» se VINCULAN a su cuota sin cambiarles el estado;
 * (2) OK al campo nuevo `polizas_seguro.template_id`; foto de la base antes de tocar (tomada:
 * `- Comunicacion JMS Claude - Archivos/Balance/respaldos/foto-polizas-conciliacion-2026-10-27.json`).
 *
 * Uso: npx tsx scripts/108-generar-polizas-templates.mts   → escribe scripts/108-polizas-templates.sql y -deshacer.sql
 */
import fs from "fs"
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"
import { controlarDebitos, cuotasEsperadas, esDeLaAseguradora } from "../lib/polizas/control-debitos"
import { polizaAnteriorDe, ejercicioDe } from "../lib/polizas/resumen-ejercicio"

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const q = (v: unknown) => v == null ? "null" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`
const MARCA = "[script 108]"

// ── Lo que hay ───────────────────────────────────────────────────────────────────────────────────
const p = await sb.from("polizas_seguro").select("id,poliza,seccion,poliza_anterior,vigencia_desde,vigencia_hasta,polizas_endosos(id,endoso,consolidado,comprobante_arca_id,pdf_drive_url,polizas_cuotas(vencimiento,importe),polizas_bienes(clave))")
const resp = (await sb.from("polizas_responsables").select("*")).data ?? []
const m = await sb.from("msa_galicia").select("id,fecha,debitos,creditos,estado,template_id,template_cuota_id,comprobante_arca_id,leyendas_adicionales_1,leyendas_adicionales_2")
  .or("leyendas_adicionales_1.ilike.*federac*,leyendas_adicionales_2.ilike.*federac*,leyendas_adicionales_1.ilike.*patronal*,leyendas_adicionales_2.ilike.*patronal*").order("fecha")
const f1 = await sb.from("msa_galicia").select("fecha").order("fecha").limit(1)
const f2 = await sb.from("msa_galicia").select("fecha").order("fecha", { ascending: false }).limit(1)
if (p.error || m.error) throw p.error ?? m.error
const pol = p.data as any[]
const crudos = (m.data ?? []).filter(esDeLaAseguradora)
const ventana = { desde: f1.data![0].fecha, hasta: f2.data![0].fecha }
const endosos = pol.flatMap(pp => pp.polizas_endosos.map((e: any) => ({ poliza: pp.poliza, endoso: e.endoso, cuotas: e.polizas_cuotas.map((c: any) => ({ vencimiento: c.vencimiento, importe: +c.importe })), consolidado: e.consolidado ? { fecha: e.consolidado.fecha, cuotas: e.consolidado.cuotas.map((c: any) => ({ vencimiento: c.vencimiento, importe: c.importe, saldo: c.saldo ?? null })) } : null })))
const ctl = controlarDebitos(cuotasEsperadas(endosos), crudos.map(x => ({ id: x.id, fecha: x.fecha, debitos: +x.debitos || 0, creditos: +x.creditos || 0, estado: x.estado })), ventana)

// Los templates genéricos de hoy (de ahí se copian los campos del template nuevo).
const GENERICOS = {
  flota: ["8f4fe57e-ad53-4ffa-81a5-8e5a08ea4a5c", "7c097fda-f028-4f86-90bf-b99a43c113d4"], // Seguro Flota 25/26 y 26/27
  ap: ["0a2fa4d3-4258-4c19-9f65-09b3f477e5e1"], // Seguro Accidentes de Trabajo 25/26
}
const gen = (await sb.from("egresos_sin_factura").select("*").in("id", [...GENERICOS.flota, ...GENERICOS.ap])).data ?? []
const molde = (seccion: string) => gen.find(g => g.id === (seccion === "AUTOMOTORES" ? GENERICOS.flota[0] : GENERICOS.ap[0]))!
const cuotasGen = (await sb.from("cuotas_egresos_sin_factura").select("id,egreso_id,estado,fecha_estimada,monto,descripcion").in("egreso_id", gen.map(g => g.id))).data ?? []

const RAMO: Record<string, string> = { AUTOMOTORES: "Flota", "ACCIDENTES PERSONALES": "Accidentes Personales", "VIDA COLECTIVO": "Vida Colectivo" }
const responsablesDe = (pp: any) => {
  const claves = [...new Set(pp.polizas_endosos.flatMap((e: any) => (e.polizas_bienes ?? []).map((b: any) => b.clave)).filter(Boolean))]
  const r = claves.map(k => resp.find(x => x.clave === k))
  const contables = [...new Set(r.map(x => x?.responsable_contable ?? "MSA"))]
  const internos = [...new Set(r.map(x => x?.responsable_interno ?? "MSA"))]
  // El nombre de la persona va en el template sólo si la póliza cubre a UNA sola (Alondra, Rojas), no si es la única con responsable cargado.
  return { contable: contables.length === 1 ? contables[0] : "MSA", interno: internos.length === 1 ? internos[0] : null, personas: claves.length === 1 ? r.filter(Boolean).map(x => x!.descripcion) : [] }
}

// ── El plan ──────────────────────────────────────────────────────────────────────────────────────
const sql: string[] = []
const deshacer: string[] = []
/** Lo mismo que `sql`, como operaciones: con `--aplicar` se ejecutan con el cliente (el .sql es largo para el MCP). */
type Op = { schema: string; tabla: string; accion: "insert" | "update"; fila?: Record<string, unknown>; set?: Record<string, unknown>; id?: string }
const ops: Op[] = []
const plantillas: { poliza: string; templateId: string; cuotas: { id: string; venc: string; monto: number; compensada: boolean }[] }[] = []

for (const pp of pol) {
  const cs = ctl.cuotas.filter(c => c.poliza === pp.poliza && c.importe > 0 && c.resultado !== "anterior-al-extracto")
  if (!cs.length) continue
  const mol = molde(pp.seccion)
  const r = responsablesDe(pp)
  const id = crypto.randomUUID()
  // El nombre va SIN la persona: el comprobante («Seguro … — póliza N MA - Mayo 2026») ya dice qué se pagó; la persona
  // asegurada va al DETALLE de la cuota (JMS 27/10: «categ · proveedor · comprobante · detalle, así detalle es realmente detalle»).
  const nombre = `Seguro ${RAMO[pp.seccion] ?? pp.seccion} — póliza ${pp.poliza}`
  const detalleCuota = r.personas.length === 1 ? r.personas[0] : ""
  sql.push(`insert into public.egresos_sin_factura (id, template_master_id, nombre_referencia, proveedor, cuit_quien_cobra, nombre_quien_cobra, categ, centro_costo, responsable, responsable_interno, cuotas, tipo_fecha, codigo_contable, codigo_interno, activo, "año", cuenta_agrupadora, tipo_template, tipo, periodicidad, aplica_generacion, solo_conciliacion, observaciones_template)
values (${q(id)}, ${q(mol.template_master_id)}, ${q(nombre)}, ${q(mol.proveedor)}, ${q(mol.cuit_quien_cobra)}, ${q(mol.nombre_quien_cobra)}, ${q(mol.categ)}, ${q(mol.centro_costo)}, ${q(r.contable)}, ${q(pp.seccion === "AUTOMOTORES" ? mol.responsable_interno : r.interno)}, ${cs.length}, ${q(mol.tipo_fecha)}, ${q(mol.codigo_contable)}, ${q(pp.seccion === "AUTOMOTORES" ? mol.codigo_interno : r.interno ? (r.interno === r.contable ? "No Lleva" : `DIST ${r.interno}`) : "Desglosar")}, true, ${q(ejercicioDe(pp.vigencia_desde))}, ${q(mol.cuenta_agrupadora)}, ${q(mol.tipo_template)}, ${q(mol.tipo)}, ${q(mol.periodicidad)}, false, false,
  ${q(`${MARCA} A-FEAT-1385 — generado desde la póliza ${pp.poliza}: cada cuota es lo que espera el banco en ese vencimiento (endosos sumados, notas de crédito compensadas).`)});`)
  sql.push(`update public.polizas_seguro set template_id = ${q(id)} where id = ${q(pp.id)};`)
  ops.push({ schema: "public", tabla: "egresos_sin_factura", accion: "insert", fila: {
    id, template_master_id: mol.template_master_id, nombre_referencia: nombre, proveedor: mol.proveedor, cuit_quien_cobra: mol.cuit_quien_cobra,
    nombre_quien_cobra: mol.nombre_quien_cobra, categ: mol.categ, centro_costo: mol.centro_costo, responsable: r.contable,
    responsable_interno: pp.seccion === "AUTOMOTORES" ? mol.responsable_interno : r.interno, cuotas: cs.length, tipo_fecha: mol.tipo_fecha,
    codigo_contable: mol.codigo_contable, codigo_interno: pp.seccion === "AUTOMOTORES" ? mol.codigo_interno : r.interno ? (r.interno === r.contable ? "No Lleva" : `DIST ${r.interno}`) : "Desglosar",
    activo: true, "año": ejercicioDe(pp.vigencia_desde), cuenta_agrupadora: mol.cuenta_agrupadora, tipo_template: mol.tipo_template, tipo: mol.tipo,
    periodicidad: mol.periodicidad, aplica_generacion: false, solo_conciliacion: false,
    observaciones_template: `${MARCA} A-FEAT-1385 — generado desde la póliza ${pp.poliza}: cada cuota es lo que espera el banco en ese vencimiento (endosos sumados, notas de crédito compensadas).`,
  } })
  ops.push({ schema: "public", tabla: "polizas_seguro", accion: "update", id: pp.id, set: { template_id: id } })
  const cuotas = cs.map((c, i) => {
    const cid = crypto.randomUUID()
    const compensada = c.resultado === "compensada"
    const monto = compensada ? 0 : c.esperadoEnBanco
    sql.push(`insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values (${q(cid)}, ${q(id)}, ${i + 1}, ${q(c.vencimiento)}, ${q(c.vencimiento)}, ${monto}, ${q(compensada ? "desactivado" : "pendiente")}, ${q(`${MARCA} póliza ${pp.poliza} · vence ${c.vencimiento}${compensada ? " · compensada con NC: no se debita" : c.importe !== c.esperadoEnBanco ? ` · cuota ${c.importe} menos NC` : ""}`)}, 'egreso', 'banco', false);`)
    ops.push({ schema: "public", tabla: "cuotas_egresos_sin_factura", accion: "insert", fila: {
      id: cid, egreso_id: id, numero_cuota: i + 1, fecha_vencimiento: c.vencimiento, fecha_estimada: c.vencimiento, monto,
      estado: compensada ? "desactivado" : "pendiente",
      descripcion: `${MARCA} póliza ${pp.poliza} · vence ${c.vencimiento}${compensada ? " · compensada con NC: no se debita" : c.importe !== c.esperadoEnBanco ? ` · cuota ${c.importe} menos NC` : ""}`,
      // ⚠️ `detalle` se llena SIEMPRE (aunque sea vacío): si queda null, el Cash Flow usa la `descripcion` —con la marca
      // del script— como detalle, y la conciliación la copiaría al movimiento.
      detalle: detalleCuota, tipo_movimiento: "egreso", medio_pago: "banco", visible_contable: false,
    } })
    return { id: cid, venc: c.vencimiento, monto, compensada }
  })
  plantillas.push({ poliza: pp.poliza, templateId: id, cuotas })
}

// Re-apuntar cada movimiento que ES cuota de una póliza a la cuota de SU póliza (el resto no se toca).
let reapuntados = 0
const cuotasConMov = new Set<string>()
const cuotasGenSueltas = new Set<string>()
const lineasMov: string[] = []
for (const x of crudos) {
  const c = ctl.movimientos.find(y => y.id === x.id)!
  if (c.resultado !== "cuota") continue
  const t = plantillas.find(t => t.poliza === c.poliza)
  const cuota = t?.cuotas.find(k => k.venc === c.vencimiento)
  if (!t || !cuota) continue
  if (x.comprobante_arca_id) continue // el que está contra su factura (Vida 698548, «auditar»): lo decide la conciliación
  if (x.estado === "pendiente") continue // los pendientes los concilia el motor contra la cuota de su póliza (JMS: «después correremos la conciliación y dará ok»)
  if (x.template_cuota_id) cuotasGenSueltas.add(x.template_cuota_id)
  lineasMov.push(`update public.msa_galicia set template_id = ${q(t.templateId)}, template_cuota_id = ${q(cuota.id)} where id = ${q(x.id)};  -- ${x.fecha} ${x.debitos} ${x.estado}`)
  deshacer.push(`update public.msa_galicia set template_id = ${q(x.template_id)}, template_cuota_id = ${q(x.template_cuota_id)} where id = ${q(x.id)};`)
  ops.push({ schema: "public", tabla: "msa_galicia", accion: "update", id: x.id, set: { template_id: t.templateId, template_cuota_id: cuota.id } })
  // Conciliado o histórico (pagado) → la cuota queda conciliada. «A auditar» → la cuota sigue pendiente, como hoy.
  if (x.estado === "conciliado" || x.estado === "historico") cuotasConMov.add(cuota.id)
  reapuntados++
}
sql.push(...lineasMov)
// La cuota nueva que ya tiene su movimiento (conciliado, a auditar o histórico) queda conciliada.
for (const id of cuotasConMov) {
  sql.push(`update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = ${q(id)};`)
  ops.push({ schema: "public", tabla: "cuotas_egresos_sin_factura", accion: "update", id, set: { estado: "conciliado" } })
}

// Los genéricos: sus cuotas se desactivan (sin borrar) y el template queda inactivo. Lo de antes, al deshacer.
for (const g of cuotasGen) {
  sql.push(`update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || ${q(`${MARCA} reemplazada por el template de su póliza`)} where id = ${q(g.id)};`)
  deshacer.push(`update public.cuotas_egresos_sin_factura set estado = ${q(g.estado)}, descripcion = ${q(g.descripcion)} where id = ${q(g.id)};`)
  ops.push({ schema: "public", tabla: "cuotas_egresos_sin_factura", accion: "update", id: g.id, set: { estado: "desactivado", descripcion: `${g.descripcion ? g.descripcion + " · " : ""}${MARCA} reemplazada por el template de su póliza` } })
}
for (const g of gen) {
  sql.push(`update public.egresos_sin_factura set activo = false, observaciones_template = coalesce(observaciones_template || ' · ', '') || ${q(`${MARCA} reemplazado por un template por póliza (A-FEAT-1385)`)} where id = ${q(g.id)};`)
  deshacer.push(`update public.egresos_sin_factura set activo = ${g.activo}, observaciones_template = ${q(g.observaciones_template)} where id = ${q(g.id)};`)
  ops.push({ schema: "public", tabla: "egresos_sin_factura", accion: "update", id: g.id, set: { activo: false, observaciones_template: `${g.observaciones_template ? g.observaciones_template + " · " : ""}${MARCA} reemplazado por un template por póliza (A-FEAT-1385)` } })
}

// Las facturas de las pólizas: su PDF directo, desde el endoso (JMS: «que se vincule directo el PDF»).
const facturas = (await sb.schema("msa").from("comprobantes_arca").select("id,estado,pdf_drive_url").ilike("denominacion_emisor", "%patronal%")).data ?? []
for (const fa of facturas) {
  const e = pol.flatMap(pp => pp.polizas_endosos).find((e: any) => e.comprobante_arca_id === fa.id)
  const sets: string[] = []
  // ⚠️ El ESTADO de la factura NO se toca: el papel de cuentas a pagar del balance cuenta «cuotas» como deuda (entera,
  // si no tiene fecha de pago) y descarta «debito». Cambiarlo movía el balance que JMS está armando (27/10).
  if (!fa.pdf_drive_url && e?.pdf_drive_url) sets.push(`pdf_drive_url = ${q(e.pdf_drive_url)}`)
  if (!sets.length) continue
  sql.push(`update msa.comprobantes_arca set ${sets.join(", ")} where id = ${q(fa.id)};`)
  deshacer.push(`update msa.comprobantes_arca set pdf_drive_url = ${q(fa.pdf_drive_url)} where id = ${q(fa.id)};`)
}

// ── Escribir ─────────────────────────────────────────────────────────────────────────────────────
const cabecera = `-- 108 · UN TEMPLATE POR PÓLIZA, con las cuotas que espera el banco, y la conciliación re-apuntada — A-FEAT-1385
-- GENERADO por scripts/108-generar-polizas-templates.mts el ${new Date().toISOString()} (no editar a mano: regenerar).
-- Foto antes: «- Comunicacion JMS Claude - Archivos/Balance/respaldos/foto-polizas-conciliacion-2026-10-27.json».
-- Hace: ${plantillas.length} templates nuevos (${plantillas.reduce((t, x) => t + x.cuotas.length, 0)} cuotas) · ${reapuntados} movimientos re-apuntados (sin cambiarles estado ni campos) ·
--       ${cuotasGen.length} cuotas de los templates genéricos desactivadas y ${gen.length} genéricos inactivos · facturas de pólizas con su PDF (el estado no se toca).
-- 🛑 Con OK de JMS (27/10: «1 ok 2 ok 3 podés avanzar. Tomá foto de cómo está la BBDD antes de tocar»).
`
const estructura = `alter table public.polizas_seguro add column if not exists template_id uuid references public.egresos_sin_factura(id);
comment on column public.polizas_seguro.template_id is '${MARCA} A-FEAT-1385 — el template de la póliza: sus cuotas son lo que espera el banco.';`
fs.writeFileSync("scripts/108-polizas-templates.sql", `${cabecera}
begin;
do $$ begin
  if exists (select 1 from public.egresos_sin_factura where observaciones_template like '${MARCA}%') then
    raise exception 'Ya hay templates del 108: no se corre dos veces.';
  end if;
end $$;
${estructura}
${sql.join("\n")}
commit;
notify pgrst, 'reload schema';

-- Control (sólo lee)
select (select count(*) from public.egresos_sin_factura where observaciones_template like '${MARCA}%') as templates,          -- ${plantillas.length}
       (select count(*) from public.cuotas_egresos_sin_factura where descripcion like '${MARCA} póliza%') as cuotas,          -- ${plantillas.reduce((t, x) => t + x.cuotas.length, 0)}
       (select count(*) from public.polizas_seguro where template_id is not null) as polizas_con_template;                   -- ${plantillas.length}
`)
fs.writeFileSync("scripts/108-polizas-templates-deshacer.sql", `-- DESHACER del 108 — vuelve cada fila tocada a como estaba (valores de la foto, tomados al generar) y borra SÓLO lo que creó el 108.
begin;
${deshacer.join("\n")}
update public.polizas_seguro set template_id = null where template_id in (select id from public.egresos_sin_factura where observaciones_template like '${MARCA}%');
delete from public.cuotas_egresos_sin_factura where descripcion like '${MARCA} póliza%' and egreso_id in (select id from public.egresos_sin_factura where observaciones_template like '${MARCA}%');
delete from public.egresos_sin_factura where observaciones_template like '${MARCA}%';
-- La columna template_id queda (vacía): si se quiere sacar, «alter table public.polizas_seguro drop column template_id» a mano y con OK.
commit;
notify pgrst, 'reload schema';
`)
console.log(`templates ${plantillas.length} · cuotas ${plantillas.reduce((t, x) => t + x.cuotas.length, 0)} · movimientos re-apuntados ${reapuntados} · cuotas genéricas ${cuotasGen.length} · genéricos ${gen.length} · facturas tocadas ${deshacer.filter(l => l.includes("comprobantes_arca")).length}`)
for (const t of plantillas) console.log(`  ${t.poliza}: ${t.cuotas.map(c => `${c.venc} ${c.compensada ? "NC" : c.monto}`).join(" · ")}`)

// ── Aplicar (con `--aplicar`): las mismas operaciones, en orden, frenando al primer error ─────────────────────────
if (process.argv.includes("--aplicar")) {
  const ya = await sb.from("egresos_sin_factura").select("id").like("observaciones_template", `${MARCA}%`).limit(1)
  if (ya.error) throw ya.error
  if (ya.data?.length) { console.error("🛑 Ya hay templates del 108: no se aplica dos veces."); process.exit(1) }
  let n = 0
  for (const o of ops) {
    const t = o.schema === "public" ? sb.from(o.tabla) : sb.schema(o.schema).from(o.tabla)
    const r = o.accion === "insert" ? await t.insert(o.fila!) : await t.update(o.set!).eq("id", o.id!)
    if (r.error) { console.error(`🛑 Falló la operación ${n + 1} de ${ops.length} (${o.accion} ${o.tabla} ${o.id ?? (o.fila as any)?.id}): ${r.error.message}. Correr scripts/108-polizas-templates-deshacer.sql.`); process.exit(1) }
    n++
  }
  console.log(`✅ Aplicadas ${n} operaciones.`)
}
