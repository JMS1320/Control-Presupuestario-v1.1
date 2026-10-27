/**
 * 🔁 UN MES ENVIADO O PRESENTADO QUE CAMBIA QUEDA «A RECTIFICAR» (A-FEAT-1394).
 *
 * Pedido de JMS 2026-10-27, al pasar a negativo las dos NC de Federación de enero y abril: *«rectificar los que cambié
 * el signo; aunque no modifica IVA, así que sale con "no modifica IVA", no hace falta rectificar IVA; rectificar el
 * subdiario sí. Sería bueno que la app registre que si se le cambió dato debe pedir rectificar»*.
 *
 * El registro lo hace la BASE (trigger `registrar_cambio_subdiario`, script 119) en `public.subdiario_cambios`: así no
 * se escapa ningún camino — pantalla, script o importación. Acá está lo que la pantalla hace con eso:
 *   · qué cambió en cada comprobante, en palabras;
 *   · cuánto se mueve cada columna del subdiario del mes;
 *   · si cambia el IVA → **sólo el subdiario** («no modifica IVA») o **también la DDJJ**.
 * Piezas puras (sin base): las prueba `npm run probar`.
 */

export type AccionCambio = "modificado" | "salio" | "entro" | "borrado"

export interface CambioSubdiario {
  id: string
  empresa: string
  lado: "compras" | "ventas"
  anio: number
  mes: number
  comprobante_id: string
  accion: AccionCambio
  estado_mes: string | null
  antes: Record<string, unknown> | null
  despues: Record<string, unknown> | null
  modifica_iva: boolean
  quien: string | null
  creado_at: string
  rectificado_at: string | null
  rectificado_por: string | null
  rectificado_nota: string | null
}

/** Las columnas que, si cambian en un mes enviado o presentado, lo dejan «a rectificar». Las mismas que mira el trigger. */
export const COLUMNAS_FISCALES = [
  "tipo_comprobante", "punto_venta", "numero_desde", "cuit", "cuit_cliente", "fecha_emision", "fecha_liquidacion",
  "imp_neto_gravado", "imp_neto_no_gravado", "imp_op_exentas", "otros_tributos", "iva", "imp_total",
  "tipo_cambio", "año_contable", "mes_contable",
]
export const esColumnaFiscal = (columna: string) => COLUMNAS_FISCALES.includes(columna)

/** Las columnas de importes del subdiario, con su nombre en pantalla. */
export const IMPORTES: { clave: string; nombre: string }[] = [
  { clave: "imp_neto_gravado", nombre: "Neto gravado" },
  { clave: "imp_neto_no_gravado", nombre: "No gravado" },
  { clave: "imp_op_exentas", nombre: "Exento" },
  { clave: "otros_tributos", nombre: "Otros tributos" },
  { clave: "iva", nombre: "IVA" },
  { clave: "imp_total", nombre: "Total" },
]
const NOMBRE: Record<string, string> = {
  ...Object.fromEntries(IMPORTES.map(i => [i.clave, i.nombre])),
  tipo_comprobante: "Tipo", punto_venta: "Punto de venta", numero_desde: "Número", cuit: "CUIT", cuit_cliente: "CUIT",
  fecha_emision: "Fecha", fecha_liquidacion: "Fecha", tipo_cambio: "Tipo de cambio", "año_contable": "Año", mes_contable: "Mes",
}

const num = (v: unknown) => Number(v) || 0
const r2 = (n: number) => Math.round(n * 100) / 100
const $ = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const tc = (d: Record<string, unknown> | null) => num(d?.tipo_cambio) || 1
const periodoDe = (anio: number, mes: number) => `${String(mes).padStart(2, "0")}/${anio}`

/** El comprobante, como se lo reconoce: «1 4-670821». */
export function comprobanteDe(c: CambioSubdiario): string {
  const d = c.despues ?? c.antes ?? {}
  return `${d.tipo_comprobante ?? ""} ${d.punto_venta ?? "s/pto"}-${d.numero_desde ?? "s/n"}`.trim()
}

/** Qué le pasó, en palabras: «Exento 47.198,41 → −47.198,41 · Total 47.481,60 → −47.481,60». */
export function queCambio(c: CambioSubdiario): string {
  if (c.accion === "salio") {
    const d = c.despues
    return d?.["año_contable"] ? `salió del mes: pasó a ${periodoDe(num(d["año_contable"]), num(d.mes_contable))}` : "salió del mes"
  }
  if (c.accion === "entro") return c.antes?.["año_contable"]
    ? `entró al mes: venía de ${periodoDe(num(c.antes["año_contable"]), num(c.antes.mes_contable))}`
    : "entró al mes (cargado nuevo)"
  if (c.accion === "borrado") return "se borró"
  const a = c.antes ?? {}, d = c.despues ?? {}
  const partes = Object.keys({ ...a, ...d })
    .filter(k => JSON.stringify(a[k] ?? null) !== JSON.stringify(d[k] ?? null))
    .map(k => {
      const f = (v: unknown) => (IMPORTES.some(i => i.clave === k) || k === "tipo_cambio" ? $(num(v)) : String(v ?? "—"))
      return `${NOMBRE[k] ?? k} ${f(a[k])} → ${f(d[k])}`
    })
  return partes.join(" · ") || "sin diferencia en los datos fiscales"
}

/** Cuánto mueve este cambio cada columna del subdiario del mes (en pesos). */
export function efectoEnElMes(c: CambioSubdiario): Record<string, number> {
  const v = (d: Record<string, unknown> | null, k: string) => (d ? num(d[k]) * tc(d) : 0)
  const out: Record<string, number> = {}
  for (const { clave } of IMPORTES) {
    const antes = c.accion === "entro" ? 0 : v(c.antes, clave)
    const despues = c.accion === "salio" || c.accion === "borrado" ? 0 : v(c.despues, clave)
    out[clave] = r2(despues - antes)
  }
  return out
}

export interface MesARectificar {
  periodo: string
  cambios: CambioSubdiario[]
  /** Si alguno de los cambios mueve el IVA del mes. */
  modificaIva: boolean
  /** La suma de los efectos, columna por columna. */
  efecto: Record<string, number>
}

/** Los meses con cambios todavía sin rectificar, por período (`MM/AAAA`). */
export function mesesARectificar(cambios: CambioSubdiario[]): Map<string, MesARectificar> {
  const m = new Map<string, MesARectificar>()
  for (const c of cambios) {
    if (c.rectificado_at) continue
    const p = periodoDe(c.anio, c.mes)
    const acc = m.get(p) ?? { periodo: p, cambios: [], modificaIva: false, efecto: Object.fromEntries(IMPORTES.map(i => [i.clave, 0])) }
    acc.cambios.push(c)
    acc.modificaIva = acc.modificaIva || c.modifica_iva
    const e = efectoEnElMes(c)
    for (const k of Object.keys(e)) acc.efecto[k] = r2(acc.efecto[k] + e[k])
    m.set(p, acc)
  }
  return m
}

/** La frase que dice qué hay que rectificar. */
export function leyendaRectificacion(m: MesARectificar): string {
  return m.modificaIva
    ? `🔁 ${m.periodo} A RECTIFICAR — MODIFICA IVA (${$(m.efecto.iva)}): rectificar el subdiario y la DDJJ de IVA`
    : `🔁 ${m.periodo} A RECTIFICAR — no modifica IVA: se rectifica sólo el subdiario`
}
