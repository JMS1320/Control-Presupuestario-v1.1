/**
 * 💳 **POR QUÉ NO CONCILIA LA TARJETA — por causa** (A-FEAT-1481, JMS 01/11: *«es ver todos los movimientos, por qué no
 * concilian, siendo los pagos de la tarjeta parte de esos movimientos… y dejarlo en el recorrido»*).
 *
 * En vez de un tema por consumo (61 temas de $ 3.000 de peaje), un tema por CAUSA, con la lista y los links:
 * 1. **pagos sin vincular**: el «SU PAGO» del resumen tiene su débito exacto en la cuenta corriente (mismo importe, ±3
 *    días) pero nadie apretó «Vincular pago» — el motor los deja afuera a propósito (A-BUG-1297);
 * 2. **pagos en $ 0**: la fila de pago en dólares sin importe — no hay nada que buscar;
 * 3. **peajes sin regla**: la tarjeta no tiene regla para Autopistas / Corredores Viales;
 * 4. **antes de ARCA**: cargos de facturas de servicios (Coopser, Personal) de jul-25 a ene-26, el período en que los
 *    pagos de facturas de la cuenta corriente quedaron «histórico» por decisión;
 * 5. **el resto**, uno por uno con lo que se sabe.
 * Los movimientos que caen en un grupo no salen además como tema suelto (`cubiertos`).
 */
import { CUENTAS_CONCILIABLES } from "@/lib/conciliacion/propuestas-ejercicio"
import { linkExtracto, rangoQueContiene } from "@/lib/extracto/link"
import type { LinkDato } from "./cobertura-papeles"
import type { Tema } from "./recorrido"

const dmy = (f?: string | null) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")
const plata = (x: number) => `$ ${x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const n = (x: unknown) => Number(x) || 0

export interface FilaTarjeta { id: string; fecha: string; descripcion: string; debitos: number; creditos: number; debitosUsd: number; creditosUsd: number; tipoFila: string; estado: string; categ?: string | null }
export interface DebitoCC { id: string; fecha: string; importe: number; descripcion: string; estado: string; nroResumen?: string | null }

export const ES_PEAJE = /AUTOPISTA|CORREDORES VIAL|AUBASA|PEAJE|AUSOL|AUSA\b/i
/** Cargo de una factura de servicio (trae el número «0023-00181720») o el abono de Personal. */
const ES_FACTURA_SERVICIO = /\d{4}-\d{6,}|PERSONAL FLOW/i
/** El período de los pagos de facturas que quedaron «histórico» en la cuenta corriente. */
export const FIN_HISTORICO = "2026-01-31"

/** Arma los temas. `cuenta` = la tarjeta; `cc` = la cuenta corriente desde donde se paga. */
export function temasTarjeta(filas: FilaTarjeta[], debitos: DebitoCC[], cuenta: { cuentaId: string; nombre: string }, cc: { cuentaId: string; nombre: string }): { temas: Tema[]; cubiertos: Set<string> } {
  const link = (ids: string[], fechas: string[], cuentaId = cuenta.cuentaId) => { const r = rangoQueContiene(fechas); return linkExtracto({ cuenta: cuentaId, movs: ids, desde: r.desde, hasta: r.hasta }) }
  const cubiertos = new Set<string>()
  const temas: Tema[] = []
  const usados = new Set<string>()
  // 1 y 2 · los pagos
  const pagos = filas.filter(f => f.tipoFila === "pago")
  const ceros = pagos.filter(p => p.creditos < 0.005 && p.creditosUsd < 0.005)
  const vincular: { p: FilaTarjeta; d: DebitoCC }[] = []
  const sinDebito: FilaTarjeta[] = []
  for (const p of pagos.filter(x => !ceros.includes(x))) {
    const d = debitos.filter(x => !usados.has(x.id) && Math.abs(x.importe - p.creditos) < 0.01 && Math.abs(Date.parse(x.fecha) - Date.parse(p.fecha)) <= 3 * 86400000)
      .sort((a, b) => Math.abs(Date.parse(a.fecha) - Date.parse(p.fecha)) - Math.abs(Date.parse(b.fecha) - Date.parse(p.fecha)))[0]
    if (d) { usados.add(d.id); vincular.push({ p, d }) } else sinDebito.push(p)
  }
  if (vincular.length) {
    vincular.forEach(v => cubiertos.add(v.p.id))
    const hist = vincular.filter(v => v.d.estado === "historico").length
    const total = vincular.reduce((s, v) => s + v.p.creditos, 0)
    temas.push({
      clave: `ctl:tarjeta-pagos:${cuenta.cuentaId}`, grupo: "conciliacion", etiqueta: "Tarjeta: pagos sin vincular", importe: total, cuenta: { id: cuenta.cuentaId, nombre: cuenta.nombre },
      titulo: `${cuenta.nombre}: ${vincular.length} pagos del resumen con su débito en ${cc.nombre}, sin vincular (${plata(total)})`,
      papel: "Control de la tarjeta · por causa",
      que: `Cada «SU PAGO» tiene su débito exacto en ${cc.nombre} (mismo día o ±3, mismo importe), pero nunca se apretó «Vincular pago» y el motor los deja afuera a propósito. `
        + `${hist ? `${hist} de los débitos están «histórico» en ${cc.nombre}; ` : ""}${vincular.length - hist} conciliados ahí.\n`
        + vincular.map(v => `• ${dmy(v.p.fecha)} ${plata(v.p.creditos)} ↔ ${cc.nombre} ${dmy(v.d.fecha)} «${v.d.descripcion}» (${v.d.estado})`).join("\n"),
      propuesta: `Vincular los ${vincular.length}: el débito de ${cc.nombre} queda con el número de resumen y el «SU PAGO» conciliado — lo mismo que hace «Vincular pago», de una vez. Si te cierra, «👍 Está bien así» y lo aplico con un script con su deshacer.`,
      links: [
        { texto: `Los ${vincular.length} pagos en ${cuenta.nombre}`, href: link(vincular.map(v => v.p.id), vincular.map(v => v.p.fecha)) },
        { texto: `Sus ${vincular.length} débitos en ${cc.nombre}`, href: link(vincular.map(v => v.d.id), vincular.map(v => v.d.fecha), cc.cuentaId) },
      ],
      respondido: false,
    })
  }
  if (ceros.length) {
    ceros.forEach(p => cubiertos.add(p.id))
    temas.push({
      clave: `ctl:tarjeta-pagos-cero:${cuenta.cuentaId}`, grupo: "conciliacion", etiqueta: "Tarjeta: pagos en $ 0", importe: 0, cuenta: { id: cuenta.cuentaId, nombre: cuenta.nombre },
      titulo: `${cuenta.nombre}: ${ceros.length} filas de pago en $ 0 (el pago en dólares sin importe)`,
      papel: "Control de la tarjeta · por causa",
      que: `Son las filas «SU PAGO» en dólares de resúmenes sin consumos en dólares: $ 0 y US$ 0. No mueven plata.\n` + ceros.map(p => `• ${dmy(p.fecha)} «${p.descripcion}»`).join("\n"),
      propuesta: "Darlas por conciliadas (no hay nada que buscarles), con el detalle «pago en dólares sin importe». Si te cierra, «👍 Está bien así».",
      links: [{ texto: `Las ${ceros.length} filas en ${cuenta.nombre}`, href: link(ceros.map(p => p.id), ceros.map(p => p.fecha)) }], respondido: false,
    })
  }
  if (sinDebito.length) {
    sinDebito.forEach(p => cubiertos.add(p.id))
    const total = sinDebito.reduce((s, p) => s + p.creditos, 0)
    temas.push({
      clave: `ctl:tarjeta-pagos-sin-debito:${cuenta.cuentaId}`, grupo: "conciliacion", etiqueta: "Tarjeta: pago sin débito", importe: total, cuenta: { id: cuenta.cuentaId, nombre: cuenta.nombre },
      titulo: `${cuenta.nombre}: ${sinDebito.length} pago(s) del resumen sin débito del mismo importe en ${cc.nombre}`,
      papel: "Control de la tarjeta · por causa",
      que: sinDebito.map(p => `• ${dmy(p.fecha)} ${plata(p.creditos)} «${p.descripcion}»`).join("\n"),
      propuesta: `No hay un débito del mismo importe en ${cc.nombre} (±3 días): ¿se pagó desde otra cuenta, o en dos partes?`,
      links: [{ texto: "Los pagos en el extracto", href: link(sinDebito.map(p => p.id), sinDebito.map(p => p.fecha)) }], respondido: false,
    })
  }
  // 3 · peajes
  const consumos = filas.filter(f => f.tipoFila !== "pago")
  const peajes = consumos.filter(f => ES_PEAJE.test(f.descripcion))
  if (peajes.length) {
    peajes.forEach(f => cubiertos.add(f.id))
    const total = peajes.reduce((s, f) => s + f.debitos, 0)
    const porNombre = new Map<string, number>()
    for (const f of peajes) { const k = f.descripcion.replace(/\s+\d+$/, "").trim(); porNombre.set(k, (porNombre.get(k) ?? 0) + 1) }
    temas.push({
      clave: `ctl:tarjeta-peajes:${cuenta.cuentaId}`, grupo: "conciliacion", etiqueta: "Tarjeta: peajes sin regla", importe: total, cuenta: { id: cuenta.cuentaId, nombre: cuenta.nombre },
      titulo: `${cuenta.nombre}: ${peajes.length} peajes sin regla (${plata(total)})`,
      papel: "Control de la tarjeta · por causa",
      que: `La tarjeta no tiene regla para los peajes, así que el motor no sabe dónde imputarlos: ${[...porNombre].map(([k, c]) => `${k} (${c})`).join(" · ")}.`,
      propuesta: "Crear la regla en esta tarjeta: «AUTOPISTA» y «CORREDORES VIAL» → cuenta 422120 PEAJES, VIATICOS, FLETES ESTRUCTURA (template «Otros Gastos» de MSA), y correr la conciliación. Si preferís otra cuenta o un template propio de peajes, decímelo.",
      links: [{ texto: `Los ${peajes.length} peajes en ${cuenta.nombre}`, href: link(peajes.map(f => f.id), peajes.map(f => f.fecha)) }], respondido: false,
    })
  }
  // 4 · facturas de servicios del período histórico
  const antes = consumos.filter(f => !cubiertos.has(f.id) && f.fecha.slice(0, 10) <= FIN_HISTORICO && ES_FACTURA_SERVICIO.test(f.descripcion))
  if (antes.length) {
    antes.forEach(f => cubiertos.add(f.id))
    const total = antes.reduce((s, f) => s + f.debitos, 0)
    temas.push({
      clave: `ctl:tarjeta-historicos:${cuenta.cuentaId}`, grupo: "conciliacion", etiqueta: "Tarjeta: facturas antes de ARCA", importe: total, cuenta: { id: cuenta.cuentaId, nombre: cuenta.nombre },
      titulo: `${cuenta.nombre}: ${antes.length} cargos de facturas de servicios de jul-25 a ene-26 (${plata(total)})`,
      papel: "Control de la tarjeta · por causa",
      que: `Sus facturas son del sistema anterior (las de ARCA entran desde dic-25), y es el mismo período en que los pagos de facturas de la cuenta corriente quedaron «histórico» por decisión — por eso el motor no les encuentra pareja.\n`
        + antes.map(f => `• ${dmy(f.fecha)} ${plata(f.debitos)} «${f.descripcion}»`).join("\n"),
      propuesta: "Pasarlos a «histórico», igual que los pagos de facturas de la cuenta corriente de ese período (no se concilian). Si te cierra, «👍 Está bien así».",
      links: [{ texto: `Los ${antes.length} cargos en ${cuenta.nombre}`, href: link(antes.map(f => f.id), antes.map(f => f.fecha)) }], respondido: false,
    })
  }
  return { temas, cubiertos }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any

/** Lee las tarjetas de la empresa y los débitos de su cuenta corriente, y arma los temas. Nunca tira. */
export async function leerTemasTarjeta(sb: Cliente, empresa: string, desde: string, hasta: string): Promise<{ temas: Tema[]; cubiertos: Set<string>; error: string | null }> {
  const temas: Tema[] = []
  const cubiertos = new Set<string>()
  try {
    const cc = CUENTAS_CONCILIABLES.find(c => c.empresa === empresa && c.leyendas)
    if (!cc) return { temas, cubiertos, error: null }
    for (const t of CUENTAS_CONCILIABLES.filter(c => c.empresa === empresa && /tarjeta/.test(c.tabla))) {
      const { data, error } = await sb.schema(t.schema).from(t.tabla)
        .select("id,fecha,descripcion,debitos,creditos,debitos_usd,creditos_usd,tipo_fila,estado,categ")
        .gte("fecha", desde).lte("fecha", hasta).in("estado", ["pendiente", "auditar"]).in("tipo_fila", ["movimiento", "pago"]).limit(5000)
      if (error) throw new Error(`${t.nombre}: ${error.message}`)
      const filas: FilaTarjeta[] = (data ?? []).map((f: Record<string, unknown>) => ({ id: String(f.id), fecha: String(f.fecha), descripcion: String(f.descripcion ?? ""), debitos: n(f.debitos), creditos: n(f.creditos),
        debitosUsd: n(f.debitos_usd), creditosUsd: n(f.creditos_usd), tipoFila: String(f.tipo_fila ?? ""), estado: String(f.estado ?? ""), categ: (f.categ as string | null) ?? null }))
      if (!filas.length) continue
      const base = cc.schema === "public" ? sb.from(cc.tabla) : sb.schema(cc.schema).from(cc.tabla)
      const d0 = new Date(Date.parse(desde) - 10 * 86400000).toISOString().slice(0, 10), h0 = new Date(Date.parse(hasta) + 10 * 86400000).toISOString().slice(0, 10)
      const { data: deb, error: e2 } = await base.select("id,fecha,debitos,descripcion,estado,nro_resumen").ilike("descripcion", "%visa%").gt("debitos", 0).gte("fecha", d0).lte("fecha", h0).limit(2000)
      if (e2) throw new Error(`${cc.nombre}: ${e2.message}`)
      const debitos: DebitoCC[] = (deb ?? []).filter((d: Record<string, unknown>) => !d.nro_resumen).map((d: Record<string, unknown>) => ({ id: String(d.id), fecha: String(d.fecha), importe: n(d.debitos), descripcion: String(d.descripcion ?? ""), estado: String(d.estado ?? ""), nroResumen: null }))
      const r = temasTarjeta(filas, debitos, t, cc)
      temas.push(...r.temas); r.cubiertos.forEach(id => cubiertos.add(`${t.cuentaId}:${id}`))
    }
    return { temas, cubiertos, error: null }
  } catch (e) { return { temas, cubiertos, error: (e as Error).message } }
}
