/**
 * 📄 Resumen PDF de CUENTA CORRIENTE del Banco SANTANDER → movimientos — A-FEAT-1424 (JMS 30/10).
 *
 * ## Para qué
 * MSA tiene una cuenta corriente en pesos en Santander (N° 297-000736/0) que se carga en `msa.santander`, una
 * cuenta de las «cargadas a mano» (fecha, descripción, débito, crédito, saldo). El banco sólo da el resumen
 * mensual en PDF. JMS 30/10: *«¿se podría adecuar el formato del PDF… así no tocamos motor?»* → el lector sólo
 * produce las filas; la carga y la conciliación son las de cualquier cuenta.
 *
 * ## Cómo viene el PDF (medido sobre jul-25 → sep-26)
 * Cabecera con «Desde: dd/mm/aa», «Hasta: dd/mm/aa», «CUIT: 30-61778601-6» y «Cuenta Corriente Nº 297-000736/0».
 * Tabla: Fecha · Comprobante · Movimiento · Débito · Crédito · Saldo en cuenta. Abre con un renglón «Saldo Inicial»
 * y cierra con «Saldo total». Una descripción puede seguir en renglones de abajo. **No trae totales de débitos y
 * créditos**, así que el control es la cadena de saldos.
 *
 * ## Débito o crédito
 * Los importes vienen alineados a la derecha y sólo se conoce dónde EMPIEZA cada texto, así que la columna se
 * confunde con un importe largo. Se decide por el SALDO: si el saldo bajó es débito, si subió es crédito. Y el
 * control exige que el importe leído sea exactamente lo que cambió el saldo: un importe mal leído no cierra.
 * La columna queda como aviso si contradice al saldo.
 *
 * Todo lo de este archivo es puro (sin base ni PDF): lo prueban los casos de `lib/pruebas/casos.ts`.
 */

import { agruparRenglones, type TextoUbicado } from "@/lib/polizas/renglones-pdf"
import { importeDelPdf } from "@/lib/extractos/pdf-caja-ahorro-galicia"

export interface MovimientoSantander {
  /** YYYY-MM-DD */
  fecha: string
  comprobante: string | null
  /** Renglones de la columna Movimiento, tal como vienen. */
  lineas: string[]
  debito: number
  credito: number
  saldo: number | null
}

export interface ResumenSantander {
  numeroCuenta: string | null
  cuitTitular: string | null
  desde: string | null
  hasta: string | null
  saldoInicial: number | null
  /** El renglón «Saldo total». */
  saldoFinal: number | null
  movimientos: MovimientoSantander[]
  /** Lo que no se pudo leer bien. Nunca se descarta en silencio. */
  avisos: string[]
}

const RE_IMPORTE = /^-?\s*\$\s*-?\d{1,3}(?:\.\d{3})*,\d{2}$/
const RE_FECHA = /^(\d{2})\/(\d{2})\/(\d{2})$/
const r2 = (n: number) => Math.round(n * 100) / 100
const fechaIso = (s: string) => { const m = s.match(RE_FECHA); return m ? `20${m[3]}-${m[2]}-${m[1]}` : null }

interface Columnas { comprobante: number; movimiento: number; debito: number; credito: number; saldo: number }

function columnasDe(items: TextoUbicado[]): Columnas | null {
  const x = (re: RegExp) => items.find(i => re.test(i.s.trim()))?.x
  const fecha = x(/^Fecha$/i), comprobante = x(/^Comprobante$/i), movimiento = x(/^Movimiento$/i)
  const debito = x(/^D[eé]bito$/i), credito = x(/^Cr[eé]dito$/i), saldo = x(/^Saldo en cuenta$/i)
  if ([fecha, comprobante, movimiento, debito, credito, saldo].some(v => v === undefined)) return null
  return { comprobante: comprobante!, movimiento: movimiento!, debito: debito!, credito: credito!, saldo: saldo! }
}

/** Pura: los textos ubicados de cada página → el resumen leído. */
export function leerResumenSantander(paginas: TextoUbicado[][]): ResumenSantander {
  const res: ResumenSantander = {
    numeroCuenta: null, cuitTitular: null, desde: null, hasta: null,
    saldoInicial: null, saldoFinal: null, movimientos: [], avisos: [],
  }
  let actual: MovimientoSantander | null = null
  let terminado = false

  for (const items of paginas) {
    if (terminado) break
    let cols: Columnas | null = null
    for (const r of agruparRenglones(items)) {
      const textos = r.items.map(i => i.s.trim())
      for (const t of textos) {
        const d = t.match(/^Desde:\s*(\d{2}\/\d{2}\/\d{2})$/i); if (d && !res.desde) res.desde = fechaIso(d[1])
        const h = t.match(/^Hasta:\s*(\d{2}\/\d{2}\/\d{2})$/i); if (h && !res.hasta) res.hasta = fechaIso(h[1])
        const c = t.match(/^CUIT:\s*(\d{2}-?\d{8}-?\d)$/i); if (c && !res.cuitTitular) res.cuitTitular = c[1].replace(/-/g, "")
        const n = t.match(/Cuenta Corriente N[º°]\s*([\d/-]+)/i); if (n && !res.numeroCuenta) res.numeroCuenta = n[1]
      }
      if (!cols) { cols = columnasDe(r.items); continue }

      // «Saldo total»: cierra el resumen
      if (textos.some(t => /^Saldo total$/i.test(t))) {
        const imp = r.items.filter(i => RE_IMPORTE.test(i.s.trim()))
        if (imp.length === 1) res.saldoFinal = importeDelPdf(imp[0].s)
        else res.avisos.push(`El renglón «Saldo total» no trae un importe: «${textos.join(" ")}».`)
        terminado = true
        break
      }
      // Pie de página («2 - 5») y renglones sin nada útil
      if (textos.length === 1 && /^\d+\s*-\s*\d+$/.test(textos[0])) continue

      const primero = r.items[0]
      const fecha = primero && primero.x < cols.comprobante - 5 ? fechaIso(primero.s.trim()) : null
      const texto = r.items.filter(i => i.x >= cols!.movimiento - 10 && i.x < cols!.debito - 40 && !RE_IMPORTE.test(i.s.trim())).map(i => i.s.trim())
      const importes = r.items.filter(i => RE_IMPORTE.test(i.s.trim()))
      const medioCredSaldo = (cols.credito + cols.saldo) / 2

      if (fecha) {
        const saldoIt = importes.filter(i => i.x >= medioCredSaldo)
        const otros = importes.filter(i => i.x < medioCredSaldo)
        const saldo = saldoIt.length === 1 ? importeDelPdf(saldoIt[0].s) : null
        if (/^Saldo Inicial$/i.test(texto.join(" "))) { res.saldoInicial = saldo; continue }
        const comp = r.items.find(i => i !== primero && i.x >= cols!.comprobante - 10 && i.x < cols!.movimiento - 10 && /^\d+$/.test(i.s.trim()))
        actual = { fecha, comprobante: comp ? comp.s.trim() : null, lineas: texto.length ? [texto.join(" ")] : [], debito: 0, credito: 0, saldo }
        if (saldo === null) res.avisos.push(`${fecha} «${texto.join(" ")}»: no se pudo leer el saldo del renglón.`)
        if (otros.length !== 1) res.avisos.push(`${fecha} «${texto.join(" ")}»: se esperaba un importe y se leyeron ${otros.length}.`)
        const imp = otros.length ? Math.abs(importeDelPdf(otros[0].s)) : 0
        const anterior = res.movimientos.length ? res.movimientos[res.movimientos.length - 1].saldo : res.saldoInicial
        const porColumna = otros.length && otros[0].x < (cols.debito + cols.credito) / 2 ? "debito" : "credito"
        // El sentido sale del saldo (sube = crédito, baja = débito); sin saldo, de la columna
        const porSaldo = saldo !== null && anterior !== null ? (saldo < anterior ? "debito" : "credito") : porColumna
        if (porSaldo !== porColumna) res.avisos.push(`${fecha} «${texto.join(" ")}»: el importe está en la columna de ${porColumna === "debito" ? "débitos" : "créditos"} pero el saldo dice ${porSaldo === "debito" ? "débito" : "crédito"}; se tomó el saldo.`)
        if (porSaldo === "debito") actual.debito = r2(imp); else actual.credito = r2(imp)
        res.movimientos.push(actual)
        continue
      }
      // Continuación de la descripción del movimiento en curso
      if (texto.length && actual) actual.lineas.push(texto.join(" "))
    }
  }
  if (res.saldoInicial === null) res.avisos.push("No se encontró el renglón «Saldo Inicial».")
  if (res.saldoFinal === null) res.avisos.push("No se encontró el renglón «Saldo total».")
  return res
}

export interface ControlSantander {
  ok: boolean
  /** Movimientos donde saldo anterior + crédito − débito no da el saldo impreso. */
  cadenaRota: { fecha: string; que: string; esperado: number; impreso: number | null }[]
  /** El último saldo de la tabla contra el renglón «Saldo total». */
  saldoFinal: { segunResumen: number | null; leido: number | null; ok: boolean }
}

/**
 * 🛑 Control de INTEGRIDAD (frena): cada importe tiene que ser exactamente lo que cambió el saldo impreso, y el
 * último saldo tiene que dar el «Saldo total». Un mes sin movimientos cierra si el inicial es igual al total.
 */
export function controlarResumenSantander(res: ResumenSantander): ControlSantander {
  const cadenaRota: ControlSantander["cadenaRota"] = []
  let saldo = res.saldoInicial
  for (const m of res.movimientos) {
    if (saldo !== null) {
      const esperado = r2(saldo + m.credito - m.debito)
      if (m.saldo === null || Math.abs(esperado - m.saldo) > 0.01) cadenaRota.push({ fecha: m.fecha, que: m.lineas[0] ?? "", esperado, impreso: m.saldo })
    }
    saldo = m.saldo ?? saldo
  }
  const leido = res.movimientos.length ? res.movimientos[res.movimientos.length - 1].saldo : res.saldoInicial
  const okFinal = res.saldoFinal !== null && leido !== null && Math.abs(res.saldoFinal - leido) <= 0.01
  return {
    ok: res.saldoInicial !== null && cadenaRota.length === 0 && okFinal && res.avisos.every(a => !/se esperaba un importe|no se pudo leer el saldo/.test(a)),
    cadenaRota,
    saldoFinal: { segunResumen: res.saldoFinal, leido, ok: okFinal },
  }
}
