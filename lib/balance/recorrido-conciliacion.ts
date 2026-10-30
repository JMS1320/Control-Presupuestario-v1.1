/**
 * 🏦 **LA CONCILIACIÓN DENTRO DEL RECORRIDO** — A-FEAT-1430 paso 4 (JMS 30/10: *«andá al 4 que es de los medulares y
 * ahí ponele todo tu empeño»*; y antes: *«vos me decís este movimiento hay que conciliarlo con este, me ponés un link
 * que filtre esos movimientos en el extracto bancario… abro una pestaña aparte con ese link, veo el caso específicamente
 * y los voy resolviendo»*).
 *
 * Cada propuesta de `lib/conciliacion/propuestas-ejercicio.ts` pasa a ser un tema:
 * - **qué pasa**: el movimiento como lo dice el banco (quién, CUIT, tu detalle, CATEG);
 * - **la propuesta**, con números (diferencia en $ y en %);
 * - **la cuenta** A contra B: el movimiento, sus parejas y la diferencia como fórmula del Cuaderno;
 * - **los dos links**: el movimiento en el extracto (pestaña nueva, sólo ese) y la pareja donde vive (la factura, el
 *   template de la cuota; si está usada, el OTRO movimiento). La conciliación se hace ahí, con el «asignar» de siempre:
 *   el recorrido propone y lleva, no escribe. Cuando se concilia, el tema desaparece solo en la próxima carga.
 *
 * Los del histórico jul–nov 2025 (pagos de facturas: por decisión no se concilian) NO entran: se cuentan aparte.
 */
import type { PropuestaMovimiento, PropuestaDeuda, Pareja, MovimientoSinConciliar } from "@/lib/conciliacion/propuestas-ejercicio"
import { ORDEN_PROPUESTA, ORIGEN_TEXTO, TIPOS_PROPUESTA, cuentaDeTabla } from "@/lib/conciliacion/propuestas-ejercicio"
import { linkExtracto, rangoQueContiene } from "@/lib/extracto/link"
import { linkFacturas } from "@/lib/egresos/link-facturas"
import { linkTemplates } from "@/lib/impuestos/planilla"
import { celdaNumero, type Comparacion } from "@/lib/cuaderno/papel-de-trabajo"
import type { LinkDato } from "./cobertura-papeles"
import type { Tema } from "./recorrido"
import type { CruceCheque } from "@/lib/conciliacion/cheques-vencidos"

const dmy = (f?: string | null) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")
const plata = (x: number) => `$ ${x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** El link al movimiento en el extracto: esa cuenta, ese movimiento, unos días alrededor. */
export function linkMovimiento(m: Pick<MovimientoSinConciliar, "cuenta" | "id" | "fecha">): string {
  const r = rangoQueContiene([m.fecha])
  return linkExtracto({ cuenta: m.cuenta.cuentaId, movs: [m.id], desde: r.desde, hasta: r.hasta })
}

/** Dónde vive cada pareja (si tiene dónde): la factura, el template, el otro movimiento que ya la usa. */
export function linksDePareja(p: Pareja, empresaMov: string): LinkDato[] {
  const out: LinkDato[] = []
  if (p.origen === "factura" || p.origen === "factura-neta-sicore" || p.origen === "NC" || p.origen === "echeq")
    out.push({ texto: `${ORIGEN_TEXTO[p.origen === "echeq" ? "factura" : p.origen]} ${p.quien} en Facturas ${p.empresa}`, href: linkFacturas([p.id], p.empresa) })
  if (p.origen === "cuota" && p.egresoId) out.push({ texto: `Template «${p.quien}» (sus cuotas)`, href: linkTemplates([p.egresoId]) })
  for (const v of p.vinculadaA ?? []) {
    const [tabla, id] = v.split(":")
    const c = cuentaDeTabla(tabla, empresaMov)
    if (c && id) out.push({ texto: `El otro movimiento que ya la usa (${c.nombre})`, href: linkExtracto({ cuenta: c.cuentaId, movs: [id] }) })
  }
  return out
}

/** La cuenta del papel de trabajo: el movimiento, sus parejas y la diferencia (fórmula). */
function comparacionDe(p: PropuestaMovimiento): Comparacion | undefined {
  if (!p.parejas.length) return undefined
  const m = p.mov
  const filas: string[][] = [
    ["", "Fecha", "Importe"],
    [`Movimiento ${m.cuenta.nombre}: ${m.descripcion}${m.quienBanco ? ` · ${m.quienBanco}` : ""}`, dmy(m.fecha), celdaNumero(m.importe)],
    ...p.parejas.map(x => [`${ORIGEN_TEXTO[x.origen]} ${x.quien}${x.ref ? ` · ${x.ref}` : ""}${x.empresa !== m.cuenta.empresa ? ` (${x.empresa})` : ""}`, dmy(x.fecha), celdaNumero(x.importe)]),
  ]
  const ult = filas.length
  if (p.tipo === "VARIOS") {
    // varias candidatas del mismo importe: no se suman, se elige una
    filas.push(["Diferencia con cualquiera de ellas", "", `=C2-C3`])
  } else {
    filas.push(["Diferencia (movimiento − parejas)", "", `=C2-SUMA(C3:C${ult})`])
    filas.push(["Diferencia en %", "", `=C${ult + 1}/C2*100`])
  }
  return { titulo: `${TIPOS_PROPUESTA[p.tipo]}: el movimiento contra lo registrado`, celdas: filas }
}

/** Los temas de conciliación de movimientos, en el orden en que conviene recorrerlos. */
export function temasDeMovimientos(propuestas: PropuestaMovimiento[]): { temas: Tema[]; historicos: number } {
  const utiles = propuestas.filter(p => p.tipo !== "HISTORICO_FACTURA")
    .sort((a, b) => ORDEN_PROPUESTA.indexOf(a.tipo) - ORDEN_PROPUESTA.indexOf(b.tipo) || a.mov.fecha.localeCompare(b.mov.fecha))
  const temas = utiles.map((p): Tema => {
    const m = p.mov
    const signo = m.lado === "D" ? "−" : "+"
    const quien = m.quienBanco || m.descripcion
    const que = [
      `${m.cuenta.nombre} · ${dmy(m.fecha)} · ${signo}${plata(m.importe)} · «${m.descripcion}»`,
      m.quienBanco ? `a/de ${m.quienBanco}${m.cuitBanco ? ` (CUIT ${m.cuitBanco})` : ""}` : "",
      m.detalle ? `tu detalle: ${m.detalle}` : "",
      m.categ ? `CATEG ${m.categ}` : "",
      m.estado !== "pendiente" ? `estado: ${m.estado}` : "",
    ].filter(Boolean).join(" · ")
    return {
      clave: `conc:${m.cuenta.cuentaId}:${m.id}`, grupo: "conciliacion",
      titulo: `${dmy(m.fecha)} · ${signo}${plata(m.importe)} · ${quien}`.slice(0, 160),
      papel: `Conciliación ${m.cuenta.nombre} · ${TIPOS_PROPUESTA[p.tipo]}`,
      etiqueta: TIPOS_PROPUESTA[p.tipo], importe: m.importe,
      que, propuesta: p.tipo === "SIN_PAREJA" ? p.propuesta : `${p.propuesta}${p.tipo === "CUIT_SIN_CIERRE" ? ` ${p.pista}.` : ""}`,
      links: [
        { texto: `El movimiento en el extracto (${m.cuenta.nombre})`, href: linkMovimiento(m) },
        ...p.parejas.flatMap(x => linksDePareja(x, m.cuenta.empresa)).filter((l, i, a) => a.findIndex(y => y.href === l.href) === i).slice(0, 6),
      ],
      comparacion: comparacionDe(p),
      respondido: false,
    }
  })
  return { temas, historicos: propuestas.length - utiles.length }
}

/** Los temas de deudas sin pago: la deuda, los movimientos que probablemente la pagaron y dónde verla. */
export function temasDeDeudas(deudas: PropuestaDeuda[], empresa: string): Tema[] {
  return deudas
    .sort((a, b) => b.candidatos.length - a.candidatos.length || b.obligacion.importe - a.obligacion.importe)
    .map((d): Tema => {
      const o = d.obligacion
      const links: LinkDato[] = []
      if (d.candidatos.length) {
        const porCuenta = new Map<string, MovimientoSinConciliar[]>()
        for (const m of d.candidatos) porCuenta.set(m.cuenta.cuentaId, [...(porCuenta.get(m.cuenta.cuentaId) ?? []), m])
        for (const [, ms] of porCuenta) {
          const r = rangoQueContiene(ms.map(m => m.fecha))
          links.push({ texto: `${ms.length === 1 ? "El movimiento" : `Los ${ms.length} movimientos`} candidato(s) en el extracto (${ms[0].cuenta.nombre})`,
            href: linkExtracto({ cuenta: ms[0].cuenta.cuentaId, movs: ms.map(m => m.id), desde: r.desde, hasta: r.hasta }) })
        }
      }
      links.push(...linksDePareja({ ...o }, empresa))
      const propuesta = d.candidatos.length === 1
        ? `Conciliar contra el movimiento del ${dmy(d.candidatos[0].fecha)} en ${d.candidatos[0].cuenta.nombre} («${d.candidatos[0].descripcion}»): mismo importe.`
        : d.candidatos.length > 1 ? `${d.candidatos.length} movimientos sin conciliar del mismo importe: elegir cuál la pagó.`
        : d.yaConciliados.length ? `Hay ${d.yaConciliados.length} movimiento(s) del mismo importe ya conciliados con otra cosa: ¿alguno es en realidad este pago?`
        : `No hay ningún movimiento del mismo importe cerca: o no se pagó (y es deuda al cierre), o se pagó por otro importe o desde otra cuenta.`
      const filas: string[][] = [["", "Fecha", "Importe"], [`${ORIGEN_TEXTO[o.origen]} ${o.quien}${o.ref ? ` · ${o.ref}` : ""}`, dmy(o.fecha), celdaNumero(o.importe)],
        ...d.candidatos.map(m => [`Candidato ${m.cuenta.nombre}: ${m.descripcion}`, dmy(m.fecha), celdaNumero(m.importe)])]
      return {
        clave: `deu:${o.origen}:${o.id}`, grupo: "deuda",
        titulo: `${ORIGEN_TEXTO[o.origen]} ${o.quien} · ${plata(o.importe)}`.slice(0, 160),
        papel: `Deuda sin pago · estado «${o.estado}»`, etiqueta: d.candidatos.length ? "Con movimiento candidato" : "Sin movimiento", importe: o.importe,
        que: `${ORIGEN_TEXTO[o.origen]} de ${o.quien}${o.ref ? ` (${o.ref})` : ""} por ${plata(o.importe)}, en estado «${o.estado}» y sin ningún movimiento del banco vinculado: al cierre sale como ${o.signo === "D" ? "deuda" : "crédito a cobrar"}.`
          + (d.yaConciliados.length ? ` Ya conciliados del mismo importe: ${d.yaConciliados.map(c => `${c.tabla} ${dmy(c.fecha)} «${c.descripcion}»`).join(" · ")}.` : ""),
        propuesta, links,
        comparacion: d.candidatos.length ? { titulo: "La deuda contra los movimientos candidatos", celdas: [...filas, ["Diferencia con el primero", "", "=C2-C3"]] } : undefined,
        respondido: false,
      }
    })
}

/**
 * ✍️ Los echeqs vencidos sin marcar «cobrado» (A-AUTO-10): cada uno con su débito y, si el caso es claro, la acción de un clic.
 */
export function temasDeCheques(cruces: CruceCheque[], extractoHasta: string | null): Tema[] {
  return cruces.map((c): Tema => {
    const ch = c.cheque, d = c.debito
    const nombre = `${ch.numero ? `Nº ${ch.numero}` : "sin número"} · ${ch.beneficiario_nombre ?? "?"}`
    const links: LinkDato[] = []
    if (d) links.push({ texto: `El débito en el extracto (${dmy(d.fecha)})`, href: linkExtracto({ cuenta: d.cuentaId, movs: [d.id], ...rangoQueContiene([d.fecha]) }) })
    let propuesta: string, accion: Tema["accion"]
    if (!d) {
      propuesta = extractoHasta && ch.fecha_cobro && ch.fecha_cobro > extractoHasta
        ? `Todavía no se puede ver: el extracto cargado llega hasta el ${dmy(extractoHasta)} y el cobro es del ${dmy(ch.fecha_cobro)}. Cargar el extracto.`
        : "No se encontró su débito en el banco (ni por número ni por importe): ¿se cobró? ¿desde otra cuenta?"
    } else {
      const completar = !ch.numero && c.numeroBanco ? ` y completar el número ${c.numeroBanco} (el cheque está cargado sin número)` : ""
      const fechaDistinta = ch.fecha_cobro && dmy(ch.fecha_cobro) !== dmy(d.fecha) ? ` (estaba cargado para el ${dmy(ch.fecha_cobro)})` : ""
      propuesta = `El banco lo debitó el ${dmy(d.fecha)}${c.por === "numero" ? " con su número" : " por el mismo importe"} («${d.descripcion}»), y el débito está ${d.estado === "conciliado" ? "conciliado" : `en «${d.estado}»: conciliarlo`}. Marcar el cheque «cobrado» con esa fecha${fechaDistinta}${completar}.`
      accion = { tipo: "cheque-cobrado", texto: `Marcar cobrado el ${dmy(d.fecha)}${!ch.numero && c.numeroBanco ? ` y poner el Nº ${c.numeroBanco}` : ""}`, chequeId: ch.id, fecha: d.fecha, numero: !ch.numero ? c.numeroBanco : null }
    }
    return {
      clave: `chq:${ch.id}`, grupo: "cheque", titulo: `Echeq ${nombre} · ${plata(ch.monto)}`.slice(0, 160),
      papel: "Echeqs emitidos (cartel de Principal)", etiqueta: d ? (d.estado === "conciliado" ? "Débito conciliado" : "Débito sin cerrar") : "Sin débito", importe: ch.monto,
      que: `Cheque ${nombre} por ${plata(ch.monto)}, cobro ${ch.fecha_cobro ? dmy(ch.fecha_cobro) : "?"}: sigue «vigente» aunque ya pasó su fecha.`,
      propuesta, links, accion, respondido: false,
    }
  })
}
