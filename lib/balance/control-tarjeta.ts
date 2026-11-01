/**
 * 💳 **POR QUÉ NO CONCILIA LA TARJETA — por causa** (A-FEAT-1481, JMS 01/11: *«es ver todos los movimientos, por qué no
 * concilian, siendo los pagos de la tarjeta parte de esos movimientos… y dejarlo en el recorrido»*).
 *
 * En vez de un tema por consumo (61 temas de $ 3.000 de peaje), un tema por CAUSA, con la lista y los links:
 * 1. **pagos sin vincular**: el «SU PAGO» del resumen tiene su débito exacto en la cuenta corriente (mismo importe, ±3
 *    días) pero nadie apretó «Vincular pago» — el motor los deja afuera a propósito (A-BUG-1297);
 * 2. **pagos en $ 0**: la fila de pago en dólares sin importe — no hay nada que buscar;
 * 3. **peajes contra su factura** (⚠️ cambió 01/11: decía «peajes sin regla» y proponía una regla a un template — mal: JMS,
 *    «los peajes siempre fueron contra facturas, con mucha consistencia»): cada cargo contra la factura de su emisor;
 * 4. **antes de ARCA**: cargos de facturas de servicios (Coopser, Personal) de jul-25 a ene-26, el período en que los
 *    pagos de facturas de la cuenta corriente quedaron «histórico» por decisión;
 * 5. **el resto**, uno por uno con lo que se sabe.
 * Los movimientos que caen en un grupo no salen además como tema suelto (`cubiertos`).
 */
import { CUENTAS_CONCILIABLES } from "@/lib/conciliacion/propuestas-ejercicio"
import { linkExtracto, rangoQueContiene } from "@/lib/extracto/link"
import type { LinkDato } from "./cobertura-papeles"
import { linkFacturas } from "@/lib/egresos/link-facturas"
import { claveNombre } from "./series-tema"
import type { Tema } from "./recorrido"

const dmy = (f?: string | null) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")
const plata = (x: number) => `$ ${x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const n = (x: unknown) => Number(x) || 0

export interface FilaTarjeta { id: string; fecha: string; descripcion: string; debitos: number; creditos: number; debitosUsd: number; creditosUsd: number; tipoFila: string; estado: string; categ?: string | null }
export interface DebitoCC { id: string; fecha: string; importe: number; descripcion: string; estado: string; nroResumen?: string | null }
/** 🧾 Una factura de un emisor de cargos de tarjeta (peajes): si ya está vinculada a un movimiento, no se ofrece. */
export interface FacturaEmisor { id: string; cuit: string; emisor: string; fecha: string; total: number; vinculada: boolean }
/**
 * 🧾 Lo que la práctica ya enseñó: cada NOMBRE de cargo (clave del nombre) contra qué emisor (CUIT) se concilió alguna
 * vez, y las facturas de esos emisores. JMS 01/11: *«los peajes siempre fueron contra facturas; si no hay facturas
 * debería avisar eso el filtro de balance: por qué no se concilian»*.
 */
export interface FacturasDeCargos { cuitPorNombre: Map<string, string>; facturas: FacturaEmisor[]; primeraFacturaArca?: string | null }

export const ES_PEAJE = /AUTOPISTA|CORREDORES VIAL|AUBASA|PEAJE|AUSOL|AUSA\b/i
/** Cargo de una factura de servicio (trae el número «0023-00181720») o el abono de Personal. */
const ES_FACTURA_SERVICIO = /\d{4}-\d{6,}|PERSONAL FLOW/i
/** El período de los pagos de facturas que quedaron «histórico» en la cuenta corriente. */
export const FIN_HISTORICO = "2026-01-31"

/** Arma los temas. `cuenta` = la tarjeta; `cc` = la cuenta corriente desde donde se paga. */
export function temasTarjeta(filas: FilaTarjeta[], debitos: DebitoCC[], cuenta: { cuentaId: string; nombre: string; schema?: string; tabla?: string; empresa?: string }, cc: { cuentaId: string; nombre: string },
  fc: FacturasDeCargos = { cuitPorNombre: new Map(), facturas: [] }): { temas: Tema[]; cubiertos: Set<string> } {
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
      propuesta: "Darlas por conciliadas (no hay nada que buscarles), con el detalle «pago en dólares sin importe».",
      links: [{ texto: `Las ${ceros.length} filas en ${cuenta.nombre}`, href: link(ceros.map(p => p.id), ceros.map(p => p.fecha)) }], respondido: false,
      // ⚡ A-FEAT-1489 — de un clic: no hay nada que decidir
      accion: cuenta.schema && cuenta.tabla ? { tipo: "estado-movimientos", texto: `dar por conciliadas las ${ceros.length} filas en $ 0`, schema: cuenta.schema, tabla: cuenta.tabla,
        ids: ceros.map(p => p.id), estado: "conciliado", detalle: "Pago en dólares sin importe (fila del resumen)" } : undefined,
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
    // 🧾 Cada peaje contra la factura de SU emisor (el que la práctica ya asoció a ese nombre): mismo importe, ±40 días,
    // no vinculada a otro movimiento. Nunca por regla a un template: los peajes siempre se cerraron contra factura.
    const usadas = new Set<string>()
    const conFactura: { f: FilaTarjeta; fac: FacturaEmisor }[] = [], sinFactura: FilaTarjeta[] = [], sinEmisor: FilaTarjeta[] = []
    for (const f of peajes) {
      const cuit = fc.cuitPorNombre.get(claveNombre(f.descripcion))
      if (!cuit) { sinEmisor.push(f); continue }
      const fac = fc.facturas.filter(x => x.cuit === cuit && !x.vinculada && !usadas.has(x.id) && Math.abs(x.total - f.debitos) < 0.02 && Math.abs(Date.parse(x.fecha) - Date.parse(f.fecha)) <= 40 * 86400000)
        .sort((a, b) => Math.abs(Date.parse(a.fecha) - Date.parse(f.fecha)) - Math.abs(Date.parse(b.fecha) - Date.parse(f.fecha)))[0]
      if (fac) { usadas.add(fac.id); conFactura.push({ f, fac }) } else sinFactura.push(f)
    }
    const desdeArca = fc.primeraFacturaArca ?? null
    const antesArca = sinFactura.filter(f => desdeArca && f.fecha.slice(0, 10) < desdeArca)
    const faltan = sinFactura.filter(f => !antesArca.includes(f))
    const linea = (f: FilaTarjeta) => `• ${dmy(f.fecha)} ${plata(f.debitos)} «${f.descripcion}»`
    const partes: string[] = []
    if (conFactura.length) partes.push(`🧾 Con su factura en la app, sin vincular (${conFactura.length}):\n` + conFactura.map(x => `${linea(x.f)} ↔ ${x.fac.emisor} ${dmy(x.fac.fecha)} ${plata(x.fac.total)}`).join("\n"))
    if (faltan.length) partes.push(`📭 Falta la factura (${faltan.length}): no hay una del mismo emisor e importe cerca de la fecha.\n` + faltan.map(linea).join("\n"))
    if (antesArca.length) partes.push(`🗄️ Sin factura, de antes del ${dmy(desdeArca)} (${antesArca.length}): las facturas de ARCA están en la app desde esa fecha.\n` + antesArca.map(linea).join("\n"))
    if (sinEmisor.length) partes.push(`❔ Nombre que nunca se concilió contra una factura (${sinEmisor.length}): falta saber de qué emisor son.\n` + sinEmisor.map(linea).join("\n"))
    const links: LinkDato[] = [{ texto: `Los ${peajes.length} peajes en ${cuenta.nombre}`, href: link(peajes.map(f => f.id), peajes.map(f => f.fecha)) }]
    if (conFactura.length) links.push({ texto: `Las ${conFactura.length} facturas que les corresponden`, href: linkFacturas(conFactura.map(x => x.fac.id), cuenta.empresa ?? "MSA") },
      { texto: `Los ${conFactura.length} cargos con factura`, href: link(conFactura.map(x => x.f.id), conFactura.map(x => x.f.fecha)) })
    if (faltan.length) links.push({ texto: `Los ${faltan.length} cargos sin factura`, href: link(faltan.map(f => f.id), faltan.map(f => f.fecha)) })
    temas.push({
      clave: `ctl:tarjeta-peajes:${cuenta.cuentaId}`, grupo: "conciliacion", etiqueta: "Tarjeta: peajes contra su factura", importe: total, cuenta: { id: cuenta.cuentaId, nombre: cuenta.nombre },
      titulo: `${cuenta.nombre}: ${peajes.length} peajes sin conciliar (${plata(total)}) — ${conFactura.length} con factura, ${faltan.length + antesArca.length} sin factura${sinEmisor.length ? `, ${sinEmisor.length} sin emisor` : ""}`,
      papel: "Control de la tarjeta · por causa",
      que: `Los peajes se concilian contra su factura (así están los ya conciliados). Por qué no concilian éstos:\n\n${partes.join("\n\n")}`,
      propuesta: [conFactura.length ? `Conciliar los ${conFactura.length} con factura contra la suya («Aplicá vos»).` : "",
        faltan.length || antesArca.length ? `Los ${faltan.length + antesArca.length} sin factura no se pueden conciliar hasta que la factura esté: ${antesArca.length ? "los de antes de dic-25, buscarlas en el sistema anterior o bajarlas de ARCA; " : ""}los demás, pedirlas o bajarlas de ARCA.` : "",
        sinEmisor.length ? `Para los ${sinEmisor.length} sin emisor, decime de quién son (o se resuelve al conciliar el primero contra su factura).` : ""].filter(Boolean).join(" "),
      links, respondido: false,
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
      propuesta: "Pasarlos a «histórico», igual que los pagos de facturas de la cuenta corriente de ese período (no se concilian).",
      links: [{ texto: `Los ${antes.length} cargos en ${cuenta.nombre}`, href: link(antes.map(f => f.id), antes.map(f => f.fecha)) }], respondido: false,
      // ⚡ A-FEAT-1489 — de un clic: es la misma decisión ya tomada para la cuenta corriente
      accion: cuenta.schema && cuenta.tabla ? { tipo: "estado-movimientos", texto: `pasar los ${antes.length} cargos a «histórico»`, schema: cuenta.schema, tabla: cuenta.tabla,
        ids: antes.map(f => f.id), estado: "historico" } : undefined,
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
      // 🧾 lo que la práctica enseñó: contra qué emisor se concilió cada nombre de cargo, y las facturas de esos emisores
      const fc: FacturasDeCargos = { cuitPorNombre: new Map(), facturas: [], primeraFacturaArca: null }
      try {
        const esq = t.empresa.toLowerCase()
        const { data: hist } = await sb.schema(t.schema).from(t.tabla).select("descripcion, comprobante_arca_id").not("comprobante_arca_id", "is", null).limit(5000)
        const ids = [...new Set((hist ?? []).map((h: { comprobante_arca_id: string }) => String(h.comprobante_arca_id)))]
        const cuitDeFactura = new Map<string, string>()
        for (let i = 0; i < ids.length; i += 200) {
          const { data } = await sb.schema(esq).from("comprobantes_arca").select("id, cuit").in("id", ids.slice(i, i + 200))
          for (const x of data ?? []) cuitDeFactura.set(String(x.id), String(x.cuit))
        }
        const votos = new Map<string, Map<string, number>>()
        for (const h of hist ?? []) {
          const k = claveNombre(h.descripcion), c = cuitDeFactura.get(String(h.comprobante_arca_id))
          if (!k || !c) continue
          const m = votos.get(k) ?? new Map<string, number>(); m.set(c, (m.get(c) ?? 0) + 1); votos.set(k, m)
        }
        for (const [k, m] of votos) fc.cuitPorNombre.set(k, [...m].sort((a, b) => b[1] - a[1])[0][0])
        const cuits = [...new Set(fc.cuitPorNombre.values())]
        if (cuits.length) {
          const d1 = new Date(Date.parse(desde) - 60 * 86400000).toISOString().slice(0, 10), h1 = new Date(Date.parse(hasta) + 60 * 86400000).toISOString().slice(0, 10)
          const { data: facs } = await sb.schema(esq).from("comprobantes_arca").select("id, cuit, denominacion_emisor, fecha_emision, imp_total").in("cuit", cuits).gte("fecha_emision", d1).lte("fecha_emision", h1).limit(5000)
          const vinculadas = new Set(ids)
          fc.facturas = (facs ?? []).map((x: Record<string, unknown>) => ({ id: String(x.id), cuit: String(x.cuit), emisor: String(x.denominacion_emisor ?? ""), fecha: String(x.fecha_emision),
            total: n(x.imp_total), vinculada: vinculadas.has(String(x.id)) }))
          const { data: pri } = await sb.schema(esq).from("comprobantes_arca").select("fecha_emision").in("cuit", cuits).order("fecha_emision", { ascending: true }).limit(1)
          fc.primeraFacturaArca = pri?.[0]?.fecha_emision ? String(pri[0].fecha_emision).slice(0, 10) : null
        }
      } catch { /* sin el aprendizaje, los peajes quedan «sin emisor»: se ve, no se inventa */ }
      const r = temasTarjeta(filas, debitos, t, cc, fc)
      temas.push(...r.temas); r.cubiertos.forEach(id => cubiertos.add(`${t.cuentaId}:${id}`))
    }
    return { temas, cubiertos, error: null }
  } catch (e) { return { temas, cubiertos, error: (e as Error).message } }
}
