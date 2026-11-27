/**
 * 🧾 EL DETALLE DE UNA FACTURA, ARTÍCULO POR ARTÍCULO — A-FEAT-1651 etapa 1 (JMS 22/11: «cuando nos dan la
 * factura ponen el artículo que se compró… sería importante tener el detalle de compras, insumo por insumo,
 * los precios, todo»).
 *
 * Lee los RENGLONES (artículo, cantidad, unidad, precio unitario, IVA, total) del texto del PDF que ya guarda
 * el registro del archivo digital (`arca_pdf_archivo_digital.texto`, lo llena el GAS al leer la carpeta).
 * La cabecera (CUIT, número, fecha, total) la lee `leerFacturaDelTexto` (lib/gas-pdf/leer-factura.ts) — acá
 * no se repite: esto agrega lo que aquella dejó afuera a propósito («el detalle por ítem»).
 *
 * ## Un lector por formato, y uno genérico
 * - **ARCA en línea** (el «Comprobantes en línea» de ARCA, A y C): Alcorta y la mayoría de los contratistas
 *   (García, Stringhini, Pais, Sánchez…). Se reconoce por el texto, no por el proveedor: cubre a todos los que
 *   facturan desde la página de ARCA.
 * - **AFA**, **Biofarma**, **Acren**: formato propio de cada uno, elegido por CUIT.
 * - **Genérico**: cualquier renglón «cantidad · descripción · precio · importe» (o al revés) en el que
 *   cantidad × precio dé el importe. Si no da, no se toma.
 *
 * ## Las reglas del importador (CLAUDE.md § 📄), aplicadas acá
 * - **Nunca rechaza ni tira error**: devuelve lo que leyó y en `noLeido` lo que no.
 * - **El CONTROL** (§ 🧮): los renglones tienen que sumar el neto del pie del mismo papel, y el pie tiene que
 *   dar el total (el leído, y el de la base si se lo pasan). Si no cierra es INTEGRIDAD —el papel se
 *   contradice o se leyó mal—: el detalle queda `no-cierra` y no se usa como dato hasta corregirlo.
 * - Cantidad × precio ≠ importe en un renglón NO frena (los proveedores redondean el precio unitario: AFA,
 *   Biofarma): queda como aviso del renglón.
 *
 * Los importes salen siempre POSITIVOS: el signo de una nota de crédito lo pone el comprobante.
 */
import { parsearImporte, leerFacturaDelTexto } from "@/lib/gas-pdf/leer-factura"

export type FormatoDetalle = "arca-en-linea" | "afa" | "biofarma" | "acren" | "hernandez" | "casamu" | "clinica-integral" | "generico"

export interface RenglonLeido {
  /** 1, 2, 3… en el orden del papel. */
  n: number
  codigo: string | null
  descripcion: string
  cantidad: number | null
  unidad: string | null
  precioUnitario: number | null
  bonifPct: number | null
  /** El importe del renglón SIN IVA (después de la bonificación). */
  neto: number | null
  /** 21 · 10.5 · 0 (exento / no gravado) · null = el papel no lo dice por renglón. */
  alicuotaIva: number | null
  totalConIva: number | null
  avisos: string[]
}

export interface ControlDetalle {
  /** `cierra` · `no-cierra` (integridad: no se usa hasta corregirlo) · `sin-renglones` (no se leyó detalle). */
  estado: "cierra" | "no-cierra" | "sin-control" | "sin-renglones"
  sumaRenglones: number
  /** Contra qué se comparó la suma: el neto del pie (gravado + exento + no gravado, antes de descuentos generales). */
  netoPie: number | null
  difNeto: number | null
  /** Total del pie del papel y total conocido (el de la base), si vino. */
  totalPie: number | null
  totalConocido: number | null
  difTotal: number | null
  mensajes: string[]
}

export interface DetalleLeido {
  formato: FormatoDetalle
  moneda: "ARS" | "USD"
  /** El tipo de cambio que imprime el papel (Biofarma, Acren), sólo informativo. */
  tipoCambio: number | null
  renglones: RenglonLeido[]
  netoPie: number | null
  /** Descuentos generales del pie (AFA «Dtos Netos»), en negativo. */
  descuentos: number | null
  iva: number | null
  /** Percepciones / otros tributos. Si el papel no los separa bien, salen por diferencia (y se avisa). */
  otros: number | null
  totalPie: number | null
  noLeido: string[]
  control: ControlDetalle
}

/** Lo que devuelve cada lector de formato (antes del control). */
interface LecturaBase {
  renglones: RenglonLeido[]
  netoPie: number | null
  descuentos: number | null
  iva: number | null
  otros: number | null
  totalPie: number | null
  moneda: "ARS" | "USD"
  tipoCambio: number | null
}

// ── Números ─────────────────────────────────────────────────────────────────────────────────────
/** es-AR con o sin miles («534600,00», «1.500,00»). */
const NUM_AR = String.raw`\d{1,3}(?:\.\d{3})+,\d{2,6}|\d+,\d{2,6}`
/** en-US («1,500.00»). */
const NUM_US = String.raw`\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2}`
/** Cualquiera de los dos (el decimal es el que deja 2 cifras al final). */
const NUM_ANY = String.raw`\d{1,3}(?:[.,]\d{3})+[.,]\d{2}|\d+[.,]\d{2}`

/** es-AR con decimales de largo variable (los precios de ARCA pueden traer más de 2). */
function numAR(s: string | undefined | null): number | null {
  if (!s) return null
  const t = s.trim().replace(/\./g, "").replace(",", ".")
  const v = Number(t)
  return isFinite(v) ? v : null
}
const numUS = (s: string | undefined | null): number | null => {
  if (!s) return null
  const v = Number(s.trim().replace(/,/g, ""))
  return isFinite(v) ? v : null
}
const numAny = (s: string | undefined | null): number | null => (s ? parsearImporte(s) : null)
const r2 = (v: number) => Math.round(v * 100) / 100
const plano = (s: string) => s.replace(/\s+/g, " ").trim()
const suma = (ns: (number | null)[]) => r2(ns.reduce<number>((a, b) => a + (b ?? 0), 0))

/** Las facturas de ARCA vienen en ORIGINAL + DUPLICADO + TRIPLICADO en el mismo PDF: se lee sólo la primera copia. */
export function primeraCopia(texto: string): string {
  const cortes: number[] = []
  const m = texto.match(/(?:^|\n)[ \t]*(DUPLICADO|TRIPLICADO)[ \t]*\r?(?:\n|$)/)
  if (m && m.index != null && m.index > 0) cortes.push(m.index)
  // ⚠️ 26/11: en las facturas de ARCA en línea (Longo, Arroyo Tala) la marca ORIGINAL/DUPLICADO va al FINAL de cada copia, así
  // que cortar en «DUPLICADO» se llevaba el renglón de la segunda copia y lo contaba dos veces. La segunda copia empieza repitiendo
  // la primera línea del papel: se corta también ahí, y gana el corte más temprano.
  const primera = texto.split(/\r?\n/).map(x => x.trim()).find(Boolean)
  if (primera && primera.length >= 8) {
    const i = texto.indexOf(primera, texto.indexOf(primera) + primera.length)
    if (i > 0) cortes.push(i)
  }
  return cortes.length ? texto.slice(0, Math.min(...cortes)) : texto
}

function alicuotaDe(s: string): { alicuota: number | null; exento: boolean } {
  if (/exento|no\s*gravado/i.test(s)) return { alicuota: 0, exento: true }
  const v = numAR(s.replace(/%/, "").replace(".", ",").trim())
  return { alicuota: v, exento: false }
}

/** cantidad × precio × (1 − bonif) contra el importe: aviso si no da (± 0,5 % o $ 1). */
function avisoCuenta(r: RenglonLeido): void {
  if (r.cantidad == null || r.precioUnitario == null || r.neto == null) return
  const calc = r.cantidad * r.precioUnitario * (1 - (r.bonifPct ?? 0) / 100)
  if (Math.abs(calc - r.neto) > Math.max(1, Math.abs(r.neto) * 0.005)) {
    r.avisos.push(`cantidad × precio da ${r2(calc)} y el renglón dice ${r.neto}`)
  }
}

// ── ARCA en línea (A y C) ───────────────────────────────────────────────────────────────────────
const UNIDAD = String.raw`(?:otras unidades|metros cuadrados|metros c[uú]bicos|[A-Za-zÁÉÍÓÚáéíóúñ.]+)`

function leerArca(texto: string): LecturaBase {
  const t = primeraCopia(texto)
  // A (discrimina IVA) trae la columna «Subtotal c/IVA»; hay una variante con «Imp. Bonif.» y «Alícuota» con tilde (Smart Farming).
  const esA = /c\/IVA|Al[ií]cuota\s*IVA/i.test(t)
  const renglones: RenglonLeido[] = []
  // Bloques de renglones: entre el encabezado de la tabla y el pie (uno por página).
  const inicio = esA ? /c\/IVA/gi : /Imp\.\s*Bonif\.\s*Subtotal/gi
  const fin = /Importe\s+Otros\s+Tributos|Importe\s+Neto\s+Gravado|Subtotal:|P[áa]g\.\s*\d/i
  for (const m of t.matchAll(inicio)) {
    const desde = (m.index ?? 0) + m[0].length
    const resto = t.slice(desde)
    const corte = resto.search(fin)
    const bloque = plano(corte >= 0 ? resto.slice(0, corte) : resto)
    // La unidad puede venir pegada al precio («otras unidades20430,00»): entre las dos, \s*.
    const re = esA
      ? new RegExp(`(.+?)\\s*(${NUM_AR})\\s+(${UNIDAD})\\s*(${NUM_AR})\\s+(${NUM_AR})\\s+(?:(${NUM_AR})\\s+)?(${NUM_AR})\\s+(\\d+(?:[.,]\\d+)?\\s*%|Exento|No\\s+[Gg]ravado)\\s+(${NUM_AR})`, "g")
      : new RegExp(`(.+?)\\s*(${NUM_AR})\\s+(${UNIDAD})\\s*(${NUM_AR})\\s+(${NUM_AR})\\s+(${NUM_AR})\\s+(${NUM_AR})`, "g")
    for (const f of bloque.matchAll(re)) {
      const r: RenglonLeido = esA
        ? (() => {
          const al = alicuotaDe(f[8])
          return {
            n: renglones.length + 1, codigo: null, descripcion: f[1].trim(), cantidad: numAR(f[2]), unidad: f[3],
            precioUnitario: numAR(f[4]), bonifPct: numAR(f[5]), neto: numAR(f[7]),
            alicuotaIva: al.alicuota, totalConIva: numAR(f[9]), avisos: [],
          }
        })()
        : {
          n: renglones.length + 1, codigo: null, descripcion: f[1].trim(), cantidad: numAR(f[2]), unidad: f[3],
          precioUnitario: numAR(f[4]), bonifPct: numAR(f[5]), neto: numAR(f[7]),
          alicuotaIva: null, totalConIva: numAR(f[7]), avisos: [],
        }
      avisoCuenta(r)
      renglones.push(r)
    }
  }

  let netoPie: number | null = null, iva: number | null = null, otros: number | null = null, totalPie: number | null = null
  if (esA) {
    // El importe se toma con su forma (NUM_AR): «$ 0,00Importe Exento» viene pegado en Alcorta.
    const v = (rotulo: string) => numAR(t.match(new RegExp(`${rotulo}:\\s*\\$\\s*(${NUM_AR})`, "i"))?.[1])
    const gravado = v(String.raw`Importe\s+Neto\s+Gravado`)
    const exento = v(String.raw`Importe\s+Exento`)
    const noGrav = v(String.raw`Importe\s+Neto\s+No\s+Gravado`)
    netoPie = gravado == null && exento == null ? null : suma([gravado, exento, noGrav])
    const ivas = [...t.matchAll(new RegExp(String.raw`IVA\s+\d+(?:[.,]\d+)?%:\s*\$\s*(` + NUM_AR + ")", "gi"))].map(m => numAR(m[1]))
    iva = ivas.length ? suma(ivas) : null
    otros = v(String.raw`Importe\s+Otros\s+Tributos`)
    totalPie = v(String.raw`Importe\s+Total`)
  } else {
    // C: el pie viene desordenado («Subtotal: $ Importe Otros Tributos: $ Importe Total: $ 150000,00 0,00 150000,00»).
    const i = t.search(/Subtotal:/i)
    if (i >= 0) {
      const nums = [...t.slice(i, i + 200).matchAll(new RegExp(`(?<![\\d.,])(${NUM_AR})(?![\\d])`, "g"))].map(m => numAR(m[1]))
      if (nums.length >= 3) { netoPie = nums[0]; otros = nums[1]; totalPie = nums[2] }
      else if (nums.length === 1) { netoPie = nums[0]; totalPie = nums[0] }
    }
    iva = 0
  }
  return { renglones, netoPie, descuentos: null, iva, otros, totalPie, moneda: "ARS" as const, tipoCambio: null }
}

// ── AFA ─────────────────────────────────────────────────────────────────────────────────────────
function leerAfa(t: string): LecturaBase {
  const p = plano(t)
  const renglones: RenglonLeido[] = []
  // Los renglones empiezan después del encabezado de la tabla: antes hay remito, cuenta e IIBB, números
  // largos que parecerían códigos de artículo.
  const enc = p.match(/Impt\s+Uni\s+Impte/i)
  const tabla = enc?.index != null ? p.slice(enc.index + enc[0].length) : p
  const re = new RegExp(`(\\d{6,18})\\s+(.{1,120}?)\\s+(${NUM_AR})\\s+([A-Za-z0-9]{1,5})\\s+\\$\\s*(-?${NUM_AR})\\s+\\$\\s*(-?${NUM_AR})`, "g")
  for (const f of tabla.matchAll(re)) {
    const r: RenglonLeido = {
      n: renglones.length + 1, codigo: f[1].replace(/^0+/, "") || f[1], descripcion: f[2].trim(), cantidad: numAR(f[3]), unidad: f[4],
      precioUnitario: numAR(f[5]), bonifPct: null, neto: numAR(f[6]), alicuotaIva: null, totalConIva: null, avisos: [],
    }
    avisoCuenta(r)
    renglones.push(r)
  }
  const netoPie = numAR(p.match(new RegExp(`Subtotal\\s*\\$\\s*(${NUM_AR})`, "i"))?.[1])
  const descuentos = numAR(p.match(new RegExp(`Dtos\\s+Netos:\\s*\\$\\s*-?\\s*(${NUM_AR})`, "i"))?.[1])
  const ivasM = [...p.matchAll(new RegExp(`Iva\\w*\\s+(\\d+,\\d+)\\s*%\\s*\\$\\s*(${NUM_AR})`, "gi"))]
  const iva = ivasM.length ? suma(ivasM.map(m => numAR(m[2]))) : null
  // Si el pie tiene UNA sola alícuota, es la de todos los renglones.
  if (ivasM.length === 1) {
    const al = numAR(ivasM[0][1])
    for (const r of renglones) {
      r.alicuotaIva = al
      if (r.neto != null && al != null) r.totalConIva = r2(r.neto * (1 + al / 100))
    }
  }
  const totalPie = numAR(p.match(new RegExp(`Importe\\s+Total\\s*\\$\\s*(${NUM_AR})`, "i"))?.[1])
  const dto = descuentos != null ? -descuentos : null
  const otros = totalPie != null && netoPie != null ? r2(totalPie - netoPie - (dto ?? 0) - (iva ?? 0)) : null
  return { renglones, netoPie, descuentos: dto, iva, otros, totalPie, moneda: "ARS" as const, tipoCambio: null }
}

// ── Biofarma (números en formato en-US) ─────────────────────────────────────────────────────────
function leerBiofarma(t: string): LecturaBase {
  const p = plano(t)
  const renglones: RenglonLeido[] = []
  const re = new RegExp(`(${NUM_US})\\s+([A-Z]{1,4})\\s+(.+?)\\s+\\$\\s*(${NUM_US})\\s+\\$\\s*(${NUM_US})`, "g")
  for (const f of p.matchAll(re)) {
    const r: RenglonLeido = {
      n: renglones.length + 1, codigo: null, descripcion: f[3].trim(), cantidad: numUS(f[1]), unidad: f[2],
      precioUnitario: numUS(f[4]), bonifPct: null, neto: numUS(f[5]), alicuotaIva: null, totalConIva: null, avisos: [],
    }
    avisoCuenta(r)
    renglones.push(r)
  }
  const netoPie = numUS(p.match(new RegExp(`SUBTOTAL:\\s*\\$\\s*(${NUM_US})`, "i"))?.[1])
  const iva21 = numUS(p.match(new RegExp(`IVA\\s*21\\s*%:\\s*\\$\\s*(${NUM_US})`, "i"))?.[1])
  const iva105 = numUS(p.match(new RegExp(`IVA\\s*10,5\\s*%:\\s*\\$?\\s*(${NUM_US})`, "i"))?.[1])
  const iva = iva21 == null && iva105 == null ? null : suma([iva21, iva105])
  if (iva21 && !iva105) for (const r of renglones) { r.alicuotaIva = 21; if (r.neto != null) r.totalConIva = r2(r.neto * 1.21) }
  // El TOTAL queda lejos de su rótulo: es el importe más grande del papel.
  const todos = [...p.matchAll(new RegExp(`(?<![\\d.,])(${NUM_US})(?![\\d])`, "g"))].map(m => numUS(m[1]) ?? 0)
  const totalPie = todos.length ? Math.max(...todos) : null
  const tipoCambio = numUS(p.match(/USD\s*1\s*=\s*\$\s*([\d.,]+)/i)?.[1])
  const otros = totalPie != null && netoPie != null ? r2(totalPie - netoPie - (iva ?? 0)) : null
  return { renglones, netoPie, descuentos: null, iva, otros, totalPie, moneda: "ARS" as const, tipoCambio }
}

// ── Acren (en dólares) ──────────────────────────────────────────────────────────────────────────
function leerAcren(t: string): LecturaBase {
  const p = plano(t)
  const renglones: RenglonLeido[] = []
  const desde = p.search(/%\s*IVA\s+IVA\s+Total/i)
  const hasta = p.search(/Importe\s+Neto\s+gravado/i)
  const bloque = p.slice(desde >= 0 ? desde + p.slice(desde).match(/%\s*IVA\s+IVA\s+Total/i)![0].length : 0, hasta >= 0 ? hasta : undefined)
  const U = String.raw`U\$S\s*`
  const re = new RegExp(`(.+?)\\s+(${NUM_AR})\\s+(\\S+)\\s+${U}(${NUM_AR})\\s+${U}(${NUM_AR})\\s+(\\d+,\\d{2})\\s+${U}(${NUM_AR})\\s+${U}(${NUM_AR})`, "g")
  for (const f of bloque.matchAll(re)) {
    const r: RenglonLeido = {
      n: renglones.length + 1, codigo: null, descripcion: f[1].trim(), cantidad: numAR(f[2]), unidad: f[3],
      precioUnitario: numAR(f[4]), bonifPct: null, neto: numAR(f[5]), alicuotaIva: numAR(f[6]), totalConIva: numAR(f[8]), avisos: [],
    }
    avisoCuenta(r)
    renglones.push(r)
  }
  const v = (re: RegExp) => numAR(p.match(re)?.[1])
  const netoPie = v(new RegExp(`Importe\\s+Neto\\s+gravado\\s+${U}(${NUM_AR})`, "i"))
  const iva = v(new RegExp(`I\\.V\\.A\\.\\s+${U}(${NUM_AR})`, "i"))
  const otros = v(new RegExp(`Percepci\\S*\\s+Ventas\\s+${U}(${NUM_AR})`, "i"))
  const totalPie = v(new RegExp(`Importe\\s+Total\\s+${U}(${NUM_AR})`, "i"))
  const tcTxt = p.match(/\$\/U\$S:\s*([\d.,]+)/i)?.[1] ?? null
  const tipoCambio = tcTxt ? (/^\d{1,3}\.\d{3}$/.test(tcTxt) ? Number(tcTxt.replace(".", "")) : numAny(tcTxt) ?? Number(tcTxt)) : null
  return { renglones, netoPie, descuentos: null, iva, otros, totalPie, moneda: "USD" as const, tipoCambio }
}

// ── Veterinaria Hernández (el subtotal viene pegado al código del renglón siguiente) ─────────────
function leerHernandez(t: string): LecturaBase {
  const p = plano(t)
  const renglones: RenglonLeido[] = []
  const enc = p.match(/Descuento\s+SubTotal/i)
  const desdeEnc = p.slice(enc?.index != null ? enc.index + enc[0].length : 0)
  const fin = desdeEnc.search(/Subtotal\s+\d/i)
  const tabla = fin >= 0 ? desdeEnc.slice(0, fin) : desdeEnc
  // código · cantidad · descripción · precio (CON IVA) · descuento · subtotal (SIN IVA, exactamente 2 decimales: lo que sigue es el código siguiente)
  const D2 = String.raw`\d+,\d{2}`
  const re = new RegExp(`(\\d{1,6})\\s+(${D2})\\s+(.+?)\\s+(${D2})\\s+(${D2})\\s+(${D2})`, "g")
  for (const f of tabla.matchAll(re)) {
    const cantidad = numAR(f[2]), neto = numAR(f[6]), precioLista = numAR(f[4])
    const r: RenglonLeido = {
      n: renglones.length + 1, codigo: f[1], descripcion: f[3].trim(), cantidad, unidad: null,
      // El papel muestra el precio CON IVA; el unitario que se guarda es el neto (subtotal / cantidad).
      precioUnitario: cantidad && neto != null ? r2(neto / cantidad) : null, bonifPct: numAR(f[5]), neto,
      alicuotaIva: null, totalConIva: cantidad != null && precioLista != null ? r2(cantidad * precioLista) : null, avisos: [],
    }
    if (neto != null && r.totalConIva) {
      const al = Math.round((r.totalConIva / neto - 1) * 1000) / 10
      r.alicuotaIva = Math.abs(al - 21) < 0.2 ? 21 : Math.abs(al - 10.5) < 0.2 ? 10.5 : null
    }
    renglones.push(r)
  }
  // Rótulos en el caso exacto del papel: «TOTAL» con /i encontraría el «Subtotal».
  const v = (rot: string) => numAR(p.match(new RegExp(`${rot}\\s+(${NUM_AR})`))?.[1])
  const netoPie = v("Subtotal"), iva = v("Impuestos"), totalPie = v("(?<![A-Za-z])TOTAL")
  const desc = v("Descuento")
  const otros = totalPie != null && netoPie != null && iva != null ? r2(totalPie - netoPie - iva + (desc ?? 0)) : null
  return { renglones, netoPie, descuentos: desc ? -desc : null, iva, otros, totalPie, moneda: "ARS" as const, tipoCambio: null }
}

// ── Casamú (semen para IATF; números en-US) ─────────────────────────────────────────────────────
function leerCasamu(t: string): LecturaBase {
  const p = plano(t)
  const renglones: RenglonLeido[] = []
  const enc = p.match(/Impt\.\s*c\/IVA/i)
  const tabla = p.slice(enc?.index != null ? enc.index + enc[0].length : 0, p.search(/IVA\s+2\.5:/i) >= 0 ? p.search(/IVA\s+2\.5:/i) : undefined)
  // [Observaciones] nombre · cantidad · precio · % dto · importe · alícuota % · importe c/IVA
  const re = new RegExp(`([A-Za-zÁÉÍÓÚáéíóúñÑ][^\\d]{0,60}?)\\s+(${NUM_US})\\s+(${NUM_US})\\s+(${NUM_US})\\s+(${NUM_US})\\s+(\\d+\\.\\d+)%\\s+(${NUM_US})`, "g")
  for (const f of tabla.matchAll(re)) {
    // El artículo («4 - Venta Semen Particular») viene arriba de todos los renglones; el renglón trae el toro.
    const toro = f[1].replace(/^.*Particular\s*/i, "").trim() || f[1].trim()
    const r: RenglonLeido = {
      n: renglones.length + 1, codigo: null, descripcion: /semen/i.test(p) ? `Semen ${toro}` : toro, cantidad: numUS(f[2]), unidad: "dosis",
      precioUnitario: numUS(f[3]), bonifPct: numUS(f[4]), neto: numUS(f[5]), alicuotaIva: numUS(f[6]), totalConIva: numUS(f[7]), avisos: [],
    }
    avisoCuenta(r)
    renglones.push(r)
  }
  const v = (rot: string) => numUS(p.match(new RegExp(`${rot}\\s*\\$?\\s*(${NUM_US})`, "i"))?.[1])
  const netoPie = v("Bruto:"), iva = v("Impuestos:"), totalPie = v("Total:")
  const otros = totalPie != null && netoPie != null && iva != null ? r2(totalPie - netoPie - iva) : null
  return { renglones, netoPie, descuentos: null, iva, otros, totalPie, moneda: "ARS" as const, tipoCambio: null }
}

// ── Clínica Veterinaria Integral ────────────────────────────────────────────────────────────────
function leerClinicaIntegral(t: string): LecturaBase {
  const p = plano(t)
  const renglones: RenglonLeido[] = []
  const enc = p.match(/VTO\s+%IVA/i)
  const fin = p.search(/SUBTOTAL/i)
  const tabla = p.slice(enc?.index != null ? enc.index + enc[0].length : 0, fin >= 0 ? fin : undefined)
  // código · cantidad · % IVA · descripción · precio · importe
  const re = new RegExp(`(\\d{1,7})\\s+(${NUM_AR})\\s+(\\d+,\\d{2})\\s+(.+?)\\s+(${NUM_AR})\\s+(${NUM_AR})`, "g")
  for (const f of tabla.matchAll(re)) {
    const al = numAR(f[3]), neto = numAR(f[6])
    const r: RenglonLeido = {
      n: renglones.length + 1, codigo: f[1], descripcion: f[4].trim(), cantidad: numAR(f[2]), unidad: null,
      precioUnitario: numAR(f[5]), bonifPct: null, neto, alicuotaIva: al, totalConIva: neto != null && al != null ? r2(neto * (1 + al / 100)) : null, avisos: [],
    }
    avisoCuenta(r)
    renglones.push(r)
  }
  const netoPie = numAR(p.match(new RegExp(`SUBTOTAL\\s+(${NUM_AR})`, "i"))?.[1])
  // El pie viene en columnas: «I.V.A.% 21.00 I.V.A.% 10.50 81450,10 0,00 17104,52 0,00» → el IVA es la suma de los importes tras el 2º subtotal.
  const blo = p.match(new RegExp(`I\\.V\\.A\\.%\\s*10[.,]50\\s+(${NUM_AR})\\s+(${NUM_AR})\\s+(${NUM_AR})\\s+(${NUM_AR})`, "i"))
  const iva = blo ? suma([numAR(blo[3]), numAR(blo[4])]) : null
  const totalPie = numAR(p.match(new RegExp(`TOTAL:\\s*(${NUM_AR})`, "i"))?.[1])
  const otros = totalPie != null && netoPie != null && iva != null ? r2(totalPie - netoPie - iva) : null
  return { renglones, netoPie, descuentos: null, iva, otros, totalPie, moneda: "ARS" as const, tipoCambio: null }
}

// ── Genérico ────────────────────────────────────────────────────────────────────────────────────
function leerGenerico(t: string): LecturaBase {
  const renglones: RenglonLeido[] = []
  const lineas = primeraCopia(t).split(/\r?\n/).map(plano).filter(Boolean)
  // cantidad · descripción · precio · [bonif %] · importe [· importe]   ó   descripción · cantidad · [unidad] · precio · importe
  const qtyPrimero = new RegExp(`^(${NUM_ANY})\\s+(.{3,90}?)\\s+\\$?\\s*(${NUM_ANY})\\s+(?:(${NUM_ANY})\\s*%\\s+)?\\$?\\s*(${NUM_ANY})(?:\\s+\\$?\\s*${NUM_ANY})?$`)
  const descPrimero = new RegExp(`^(.{3,90}?)\\s+(${NUM_ANY})\\s+(?:([A-Za-z.]{1,12})\\s+)?\\$?\\s*(${NUM_ANY})\\s+\\$?\\s*(${NUM_ANY})$`)
  for (const l of lineas) {
    let r: RenglonLeido | null = null
    const a = l.match(qtyPrimero)
    if (a) {
      r = { n: 0, codigo: null, descripcion: a[2].trim(), cantidad: numAny(a[1]), unidad: null, precioUnitario: numAny(a[3]),
        bonifPct: a[4] ? numAny(a[4]) : null, neto: numAny(a[5]), alicuotaIva: null, totalConIva: null, avisos: [] }
    } else {
      const b = l.match(descPrimero)
      if (b) r = { n: 0, codigo: null, descripcion: b[1].trim(), cantidad: numAny(b[2]), unidad: b[3] ?? null, precioUnitario: numAny(b[4]),
        bonifPct: null, neto: numAny(b[5]), alicuotaIva: null, totalConIva: null, avisos: [] }
    }
    if (!r || r.cantidad == null || r.precioUnitario == null || r.neto == null) continue
    // Sólo se toma si la cuenta da: sin eso cualquier línea con tres números parecería un renglón.
    avisoCuenta(r)
    if (r.avisos.length) continue
    r.n = renglones.length + 1
    renglones.push(r)
  }
  const cab = leerFacturaDelTexto(t)
  const iva = cab.iva21 == null && cab.iva105 == null ? null : suma([cab.iva21, cab.iva105])
  const netoPie = cab.neto
  return { renglones, netoPie, descuentos: null, iva, otros: null as number | null, totalPie: cab.total, moneda: "ARS" as const, tipoCambio: null }
}

// ── Elección del formato ────────────────────────────────────────────────────────────────────────
/** Los proveedores con formato propio, por CUIT. Lo demás va por el texto (ARCA en línea) o por el genérico. */
export const FORMATO_POR_CUIT: Record<string, FormatoDetalle> = {
  "30525718626": "afa",       // AGRICULTORES FEDERADOS ARGENTINOS
  "30571438247": "biofarma",  // BIOFARMA S A
  "33716360429": "acren",     // AGRO CENTROS REGION NUCLEO (Acren)
  "20224765658": "hernandez", // VETERINARIA HERNANDEZ (Hernández Cristóbal)
  "30639615401": "casamu",    // CASAMU S A (semen, IATF)
  "30593744880": "clinica-integral", // CLINICA VETERINARIA INTEGRAL
}

export function formatoDelTexto(texto: string, cuit?: string | null): FormatoDetalle {
  const c = (cuit || "").replace(/\D/g, "")
  if (c && FORMATO_POR_CUIT[c]) return FORMATO_POR_CUIT[c]
  if (/Producto\s*\/\s*Servicio/i.test(texto) && /Esta Agencia no se responsabiliza|Comprobante Autorizado/i.test(texto)) return "arca-en-linea"
  if (/Agricultores Federados Argentinos/i.test(texto)) return "afa"
  if (/Biofarma/i.test(texto)) return "biofarma"
  if (/acren\.com\.ar|AGRO CENTROS REGI/i.test(texto)) return "acren"
  return "generico"
}

/** Tolerancias del control: centavos de redondeo por renglón en la suma; 5 centavos en el total. */
const TOL_TOTAL = 0.05

/**
 * El detalle de una factura a partir del texto de su PDF.
 * `cuit`: el del proveedor (de la factura de la base) — elige el formato. `totalConocido`: el total de la
 * factura en la base (positivo, en la moneda del papel) — entra al control.
 */
export function leerDetalleFactura(
  texto: string | null | undefined,
  opciones: { cuit?: string | null; totalConocido?: number | null } = {},
): DetalleLeido {
  const t = String(texto ?? "")
  const formato = formatoDelTexto(t, opciones.cuit)
  let base: LecturaBase
  const noLeido: string[] = []
  try {
    base = formato === "arca-en-linea" ? leerArca(t)
      : formato === "afa" ? leerAfa(t)
        : formato === "biofarma" ? leerBiofarma(t)
          : formato === "acren" ? leerAcren(t)
            : formato === "hernandez" ? leerHernandez(t)
              : formato === "casamu" ? leerCasamu(t)
                : formato === "clinica-integral" ? leerClinicaIntegral(t)
                  : leerGenerico(t)
  } catch (e) {
    base = { renglones: [], netoPie: null, descuentos: null, iva: null, otros: null, totalPie: null, moneda: "ARS", tipoCambio: null }
    noLeido.push(`el lector falló: ${(e as Error).message}`)
  }
  if (!base.renglones.length) noLeido.push("renglones")
  if (base.netoPie == null) noLeido.push("neto del pie")
  if (base.totalPie == null) noLeido.push("total del pie")

  const totalConocido = opciones.totalConocido != null ? Math.abs(opciones.totalConocido) : null
  const sumaRenglones = suma(base.renglones.map(r => r.neto))
  const mensajes: string[] = []
  let estado: ControlDetalle["estado"] = base.renglones.length ? "cierra" : "sin-renglones"

  const tolNeto = Math.max(0.05, 0.01 * base.renglones.length)
  const difNeto = base.netoPie != null && base.renglones.length ? r2(sumaRenglones - base.netoPie) : null
  if (difNeto != null && Math.abs(difNeto) > tolNeto) {
    estado = "no-cierra"
    mensajes.push(`Los renglones suman ${sumaRenglones} y el neto del papel es ${base.netoPie} (diferencia ${difNeto}): falta o sobra un renglón, o se leyó mal un importe.`)
  }
  if (base.renglones.length && base.netoPie == null) {
    // Leído pero sin contra qué sumar: se puede mirar, no se da por bueno.
    estado = "sin-control"
    mensajes.push("No se leyó el neto del pie: la suma de los renglones no se pudo controlar contra el papel.")
  }

  // El pie contra sí mismo: neto + descuentos + IVA + otros = total.
  if (base.netoPie != null && base.totalPie != null && base.iva != null && base.otros != null) {
    const cierraPie = r2(base.netoPie + (base.descuentos ?? 0) + base.iva + base.otros - base.totalPie)
    if (Math.abs(cierraPie) > TOL_TOTAL) mensajes.push(`El pie no cierra: neto + descuentos + IVA + otros − total = ${cierraPie}.`)
  }
  if (formato === "afa" || formato === "biofarma") {
    if (base.otros && Math.abs(base.otros) > TOL_TOTAL) mensajes.push(`Percepciones / otros tributos tomados por diferencia: ${base.otros}.`)
  }

  const difTotal = totalConocido != null && base.totalPie != null ? r2(base.totalPie - totalConocido) : null
  // Sin renglones no se juzga el total: el «total» de un papel desconocido es una adivinanza de la cabecera.
  if (difTotal != null && Math.abs(difTotal) > TOL_TOTAL && base.renglones.length) {
    estado = "no-cierra"
    mensajes.push(`El total del papel (${base.totalPie}) no es el de la factura en el sistema (${totalConocido}): ¿es el PDF de otra factura?`)
  }

  return {
    formato, moneda: base.moneda, tipoCambio: base.tipoCambio, renglones: base.renglones,
    netoPie: base.netoPie, descuentos: base.descuentos, iva: base.iva, otros: base.otros, totalPie: base.totalPie,
    noLeido,
    control: { estado, sumaRenglones, netoPie: base.netoPie, difNeto, totalPie: base.totalPie, totalConocido, difTotal, mensajes },
  }
}
