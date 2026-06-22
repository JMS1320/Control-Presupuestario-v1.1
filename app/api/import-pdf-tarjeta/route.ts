import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Forzar runtime Node (no edge) — unpdf/pdfjs necesitan APIs de Node
export const runtime = "nodejs"

// Mapa cuenta → { schema, tabla }
const CUENTAS_VALIDAS: Record<string, { schema: string; tabla: string }> = {
  tarjeta_visa_business_msa: { schema: "msa", tabla: "tarjeta_visa_business" },
  tarjeta_visa_pam: { schema: "pam", tabla: "tarjeta_visa" },
  tarjeta_visa_ma: { schema: "ma", tabla: "tarjeta_visa" },
}

// -----------------------------------------------------------------------------
// Helpers de parseo
// -----------------------------------------------------------------------------

function parseNumAR(value: string | null | undefined): number {
  if (!value) return 0
  const s = value.trim().replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".")
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

const MESES_ES: Record<string, string> = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", sep: "09", oct: "10", nov: "11", dic: "12",
}

function parseDateGalicia(value: string): string | null {
  if (!value) return null
  const s = value.trim()
  // Formato "DD-MMM-YY" (ej "30-Ene-25")
  const m1 = s.match(/^(\d{1,2})-([A-Za-záéíóú]{3})-(\d{2,4})$/)
  if (m1) {
    let [, d, mo, y] = m1
    if (y.length === 2) y = "20" + y
    const mes = MESES_ES[mo.toLowerCase().slice(0, 3)]
    if (mes) return `${y}-${mes}-${d.padStart(2, "0")}`
  }
  // Formato "DD-MM-YY" (ej "02-01-26")
  const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/)
  if (m2) {
    let [, d, mo, y] = m2
    if (y.length === 2) y = "20" + y
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  return null
}

// -----------------------------------------------------------------------------
// Parseo de líneas de movimiento
// -----------------------------------------------------------------------------

interface MovimientoParsed {
  fecha: string                  // YYYY-MM-DD
  referencia: string | null
  descripcion: string
  cuota: string | null
  comprobante: string | null
  pesos: number                  // signo: positivo consumo, negativo pago/reverso
  dolares: number
}

const NUM_AR = String.raw`-?\d{1,3}(?:\.\d{3})*,\d{2}`

function parsearLineaMovimiento(raw: string): MovimientoParsed | null {
  const linea = raw.replace(/\s+/g, " ").trim()

  // Fecha al inicio: DD-MM-YY
  const fechaMatch = linea.match(/^(\d{2}-\d{2}-\d{2})\s+/)
  if (!fechaMatch) return null
  const fechaIso = parseDateGalicia(fechaMatch[1])
  if (!fechaIso) return null
  let resto = linea.substring(fechaMatch[0].length).trim()

  // Referencia opcional: 1 char en {K, Q, U, F, T, *}
  let referencia: string | null = null
  const refMatch = resto.match(/^([KQUFT\*])\s+/)
  if (refMatch) {
    referencia = refMatch[1]
    resto = resto.substring(refMatch[0].length).trim()
  }

  // Montos al final: 1 o 2 números formato AR (pesos y/o dólares)
  // Caso A: dos montos al final
  const dosMontosRegex = new RegExp(`(${NUM_AR})\\s+(${NUM_AR})\\s*$`)
  const unMontoRegex = new RegExp(`(${NUM_AR})\\s*$`)
  let pesos = 0
  let dolares = 0
  // Líneas de impuestos/percepciones (IVA, percepción, RG, IIBB, Sellos) con %: traen
  // "base cargo" (dos números en PESOS). El cargo es el ÚLTIMO; el primero es base informativa.
  // NO son consumos en USD → forzar parseo de un solo monto (pesos) para no inflar dólares.
  const esTasaPesos = /%/.test(resto) && /(IVA|PERCEP|\bRG\b|IIBB|SELLOS)/i.test(resto)
  const m2 = esTasaPesos ? null : resto.match(dosMontosRegex)
  if (m2) {
    pesos = parseNumAR(m2[1])
    dolares = parseNumAR(m2[2])
    resto = resto.substring(0, resto.length - m2[0].length).trim()
  } else {
    const m1 = resto.match(unMontoRegex)
    if (!m1) return null
    const monto = parseNumAR(m1[1])
    // Heurística: si menciona USD o U$S o tiene "DÓLARES" cerca, es dólares
    // Si NO, asumimos pesos
    if (!esTasaPesos && /USD|U\$S/i.test(resto)) {
      dolares = monto
    } else {
      pesos = monto
    }
    resto = resto.substring(0, resto.length - m1[0].length).trim()
  }

  // Comprobante: último token al final con dígitos (puede empezar con cero, ej 000001)
  let comprobante: string | null = null
  const compMatch = resto.match(/(\b[A-Z]?\d{4,}\b)\s*$/)
  if (compMatch) {
    comprobante = compMatch[1]
    resto = resto.substring(0, resto.length - compMatch[0].length).trim()
  }

  // Cuota opcional: NN/NN
  let cuota: string | null = null
  const cuotaMatch = resto.match(/(\d{1,2}\/\d{1,2})\s*$/)
  if (cuotaMatch) {
    cuota = cuotaMatch[1]
    resto = resto.substring(0, resto.length - cuotaMatch[0].length).trim()
  }

  const descripcion = resto.trim()
  if (!descripcion) return null

  return { fecha: fechaIso, referencia, descripcion, cuota, comprobante, pesos, dolares }
}

// -----------------------------------------------------------------------------
// Parseo del resumen completo
// -----------------------------------------------------------------------------

interface TarjetaAdicional {
  tarjeta_nro: string | null
  titular: string | null
}

interface ResumenParsed {
  nro_resumen: string | null
  fecha_cierre: string | null
  fecha_vencimiento: string | null
  saldo_anterior_pesos: number
  saldo_anterior_usd: number
  total_a_pagar_pesos: number
  total_a_pagar_usd: number
  movimientos: Array<MovimientoParsed & { tarjeta: TarjetaAdicional }>
}

function parsearResumen(texto: string): ResumenParsed {
  const out: ResumenParsed = {
    nro_resumen: null,
    fecha_cierre: null,
    fecha_vencimiento: null,
    saldo_anterior_pesos: 0,
    saldo_anterior_usd: 0,
    total_a_pagar_pesos: 0,
    total_a_pagar_usd: 0,
    movimientos: [],
  }

  // Nro de resumen
  const nroMatch = texto.match(/Resumen\s*N[°º]\s*([A-Z0-9]+)/i)
  if (nroMatch) out.nro_resumen = nroMatch[1]

  // SALDO ANTERIOR
  const saldoMatch = texto.match(new RegExp(`SALDO\\s+ANTERIOR\\s+(${NUM_AR})(?:\\s+(${NUM_AR}))?`, "i"))
  if (saldoMatch) {
    out.saldo_anterior_pesos = parseNumAR(saldoMatch[1])
    if (saldoMatch[2]) out.saldo_anterior_usd = parseNumAR(saldoMatch[2])
  }

  // TOTAL A PAGAR
  const totalMatch = texto.match(new RegExp(`TOTAL\\s+A\\s+PAGAR\\s+(${NUM_AR})(?:\\s+(${NUM_AR}))?`, "i"))
  if (totalMatch) {
    out.total_a_pagar_pesos = parseNumAR(totalMatch[1])
    if (totalMatch[2]) out.total_a_pagar_usd = parseNumAR(totalMatch[2])
  }

  // Fechas del ciclo — buscar todas las DD-MMM-YY en orden
  const fechasGalicia = Array.from(texto.matchAll(/\b(\d{1,2}-[A-ZÁÉÍÓÚ][a-záéíóú]{2}-\d{2})\b/g)).map((m) => m[1])
  // Las 6 fechas que aparecen son: cierre_anterior, venc_anterior, cierre_actual, venc_actual, prox_cierre, prox_venc
  if (fechasGalicia.length >= 4) {
    out.fecha_cierre = parseDateGalicia(fechasGalicia[2])
    out.fecha_vencimiento = parseDateGalicia(fechasGalicia[3])
  }

  // Movimientos: dividir por líneas y parsear cada una
  const lineas = texto.split(/\r?\n/)
  let tarjetaActual: TarjetaAdicional = { tarjeta_nro: null, titular: null }

  for (const lineaRaw of lineas) {
    const linea = lineaRaw.trim()
    if (!linea) continue

    // Detectar cambio de tarjeta adicional: "TARJETA XXXX Total Consumos de NOMBRE"
    const tarjMatch = linea.match(/^TARJETA\s+(\d+)\s+Total\s+Consumos\s+de\s+(.+?)\s+[\d\.,\-]/i)
    if (tarjMatch) {
      // El subtotal pertenece a la tarjeta que viene NOMBRADA acá
      tarjetaActual = { tarjeta_nro: tarjMatch[1], titular: tarjMatch[2].trim() }
      continue
    }

    // Saltarse líneas de headers/secciones conocidas
    if (/^(DETALLE\s+DEL\s+CONSUMO|CONSOLIDADO|TOTAL\s+A\s+PAGAR|TOTAL\s+EN\s+PESOS|TOTAL\s+EN\s+D[ÓO]LARES|FECHA\s+REFERENCIA|TASAS|L[ÍI]MITES|PAGO\s+MINIMO|SALDO\s+ANTERIOR)/i.test(linea)) {
      continue
    }

    const mov = parsearLineaMovimiento(linea)
    if (mov) {
      out.movimientos.push({ ...mov, tarjeta: { ...tarjetaActual } })
    }
  }

  return out
}

// -----------------------------------------------------------------------------
// Control de saldo
// -----------------------------------------------------------------------------

interface ControlSaldo {
  ok: boolean
  diferencia_pesos: number
  diferencia_usd: number
  suma_pesos: number
  suma_usd: number
}

function calcularControl(r: ResumenParsed): ControlSaldo {
  const sumaP = r.movimientos.reduce((acc, m) => acc + m.pesos, 0)
  const sumaU = r.movimientos.reduce((acc, m) => acc + m.dolares, 0)
  const calculadoP = Math.round((r.saldo_anterior_pesos + sumaP) * 100) / 100
  const calculadoU = Math.round((r.saldo_anterior_usd + sumaU) * 100) / 100
  const diffP = Math.round((r.total_a_pagar_pesos - calculadoP) * 100) / 100
  const diffU = Math.round((r.total_a_pagar_usd - calculadoU) * 100) / 100
  return {
    ok: Math.abs(diffP) < 0.5 && Math.abs(diffU) < 0.05,
    diferencia_pesos: diffP,
    diferencia_usd: diffU,
    suma_pesos: Math.round(sumaP * 100) / 100,
    suma_usd: Math.round(sumaU * 100) / 100,
  }
}

// -----------------------------------------------------------------------------
// Generar Excel de auditoría
// -----------------------------------------------------------------------------

function generarExcelAuditoria(r: ResumenParsed, control: ControlSaldo, cuentaId: string): string {
  const datos: any[][] = []

  datos.push(["RESUMEN TARJETA — AUDITORÍA"])
  datos.push([])
  datos.push(["Cuenta destino", cuentaId])
  datos.push(["Nro Resumen", r.nro_resumen || ""])
  datos.push(["Fecha Cierre", r.fecha_cierre || ""])
  datos.push(["Fecha Vencimiento", r.fecha_vencimiento || ""])
  datos.push([])
  datos.push(["", "PESOS", "DÓLARES"])
  datos.push(["Saldo anterior", r.saldo_anterior_pesos, r.saldo_anterior_usd])
  datos.push(["Suma movimientos detectados", control.suma_pesos, control.suma_usd])
  datos.push(["Total a pagar (PDF)", r.total_a_pagar_pesos, r.total_a_pagar_usd])
  datos.push([
    "Diferencia de control",
    control.diferencia_pesos,
    control.diferencia_usd,
  ])
  datos.push(["Estado del control", control.ok ? "OK" : "ERROR — revisar manualmente"])
  datos.push([])
  datos.push([
    "FECHA",
    "REFERENCIA",
    "DESCRIPCIÓN",
    "CUOTA",
    "COMPROBANTE",
    "PESOS",
    "DÓLARES",
    "TARJETA",
    "TITULAR",
  ])

  for (const m of r.movimientos) {
    datos.push([
      m.fecha,
      m.referencia || "",
      m.descripcion,
      m.cuota || "",
      m.comprobante || "",
      m.pesos,
      m.dolares,
      m.tarjeta.tarjeta_nro || "",
      m.tarjeta.titular || "",
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(datos)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Auditoría")
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  return Buffer.from(buffer).toString("base64")
}

// -----------------------------------------------------------------------------
// Endpoint
// -----------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const cuentaId = (formData.get("tabla") as string | null)?.trim() || ""
    const forzar = (formData.get("forzar") as string | null) === "true"
    const peek = (formData.get("peek") as string | null) === "true"  // solo parsear y devolver fecha_cierre (para ordenar multi)

    if (!file) {
      return NextResponse.json({ ok: false, message: "Falta el archivo PDF" }, { status: 400 })
    }
    const config = CUENTAS_VALIDAS[cuentaId]
    if (!config) {
      return NextResponse.json(
        { ok: false, message: `Cuenta inválida: ${cuentaId}. Permitidas: ${Object.keys(CUENTAS_VALIDAS).join(", ")}` },
        { status: 400 }
      )
    }

    // Extraer texto del PDF con unpdf (compatible con Node/serverless — evita el error
    // "DOMMatrix is not defined" que da pdfjs-dist v5 fuera del navegador).
    const arrayBuffer = await file.arrayBuffer()
    const data = new Uint8Array(arrayBuffer)
    const { extractText, getDocumentProxy } = await import("unpdf")
    const pdf = await getDocumentProxy(data)
    const extracted = await extractText(pdf, { mergePages: true })
    const texto: string = Array.isArray(extracted.text) ? extracted.text.join("\n") : (extracted.text || "")

    if (!texto.trim()) {
      return NextResponse.json(
        { ok: false, message: "El PDF no contiene texto extraíble. ¿Es escaneado / imagen?" },
        { status: 400 }
      )
    }

    // unpdf devuelve el texto concatenado (sin saltos entre movimientos). Reinsertamos saltos
    // antes de cada fecha de movimiento (DD-MM-YY), subtotales por tarjeta y headers,
    // para que el parser por líneas funcione.
    const textoNorm = texto
      .replace(/\s(?=\d{2}-\d{2}-\d{2}\s)/g, "\n")
      .replace(/\s(?=TARJETA\s+\d+\s+Total\s+Consumos)/gi, "\n")
      .replace(/\s(?=DETALLE\s+DEL\s+CONSUMO|Resumen\s+N[°º]|TOTAL\s+A\s+PAGAR|TOTAL\s+EN\s+(?:PESOS|D[ÓO]LARES))/gi, "\n")

    // Parsear
    const resumen = parsearResumen(textoNorm)
    const control = calcularControl(resumen)

    // Modo peek: solo devolver fecha de cierre + nro (para ordenar varios resúmenes). NO inserta.
    if (peek) {
      return NextResponse.json({
        ok: true,
        peek: true,
        fecha_cierre: resumen.fecha_cierre,
        nro_resumen: resumen.nro_resumen,
        movimientos: resumen.movimientos.length,
        control,
      })
    }

    const excelBase64 = generarExcelAuditoria(resumen, control, cuentaId)

    if (resumen.movimientos.length === 0) {
      return NextResponse.json({
        ok: false,
        message: "No se detectaron movimientos en el PDF. Descargá el Excel para revisar.",
        excel_base64: excelBase64,
        resumen: { ...resumen, movimientos: undefined },
        control,
      })
    }

    // Si control NO cuadra y no se forzó → no insertar
    if (!control.ok && !forzar) {
      return NextResponse.json({
        ok: false,
        message: `Control de saldos NO cuadra. Diferencia pesos: ${control.diferencia_pesos}, USD: ${control.diferencia_usd}. Revisá el Excel.`,
        excel_base64: excelBase64,
        resumen: { ...resumen, movimientos: undefined },
        control,
        movimientos_detectados: resumen.movimientos.length,
      })
    }

    // Insertar en BD
    const client = supabase.schema(config.schema)

    // Dedup contra existentes (por fecha + descripcion + débitos + créditos + comprobante)
    const existentes = new Set<string>()
    const fechaMin = resumen.movimientos.map((m) => m.fecha).sort()[0]
    if (fechaMin) {
      const { data: ex } = await client
        .from(config.tabla)
        .select("fecha, descripcion, debitos, creditos, comprobante, cuota")
        .gte("fecha", fechaMin)
      ex?.forEach((e: any) => {
        const k = `${e.fecha}|${(e.descripcion || "").trim()}|${Number(e.debitos) || 0}|${Number(e.creditos) || 0}|${e.comprobante || ""}|${e.cuota || ""}`
        existentes.add(k)
      })
    }

    const { data: maxOrden } = await client
      .from(config.tabla)
      .select("orden")
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle()
    let nextOrden = (maxOrden?.orden ?? 0) + 1

    const paraInsertar: any[] = []
    let duplicadosOmitidos = 0
    for (const m of resumen.movimientos) {
      const debitos = m.pesos > 0 ? m.pesos : 0
      const creditos = m.pesos < 0 ? Math.abs(m.pesos) : 0
      const debitos_usd = m.dolares > 0 ? m.dolares : 0
      const creditos_usd = m.dolares < 0 ? Math.abs(m.dolares) : 0
      const dedupKey = `${m.fecha}|${m.descripcion}|${debitos}|${creditos}|${m.comprobante || ""}|${m.cuota || ""}`
      if (existentes.has(dedupKey)) {
        duplicadosOmitidos++
        continue
      }
      existentes.add(dedupKey)
      paraInsertar.push({
        fecha: m.fecha,
        descripcion: m.descripcion,
        debitos,
        creditos,
        debitos_usd,
        creditos_usd,
        referencia: m.referencia,
        cuota: m.cuota,
        comprobante: m.comprobante,
        nro_resumen: resumen.nro_resumen,
        fecha_cierre: resumen.fecha_cierre,
        fecha_vencimiento: resumen.fecha_vencimiento,
        tarjeta_adicional: m.tarjeta.tarjeta_nro,
        titular_adicional: m.tarjeta.titular,
        categ: null,
        detalle: null,
        contable: null,
        interno: null,
        centro_de_costo: null,
        cuenta: config.tabla,
        orden: nextOrden++,
        estado: "pendiente",
        // 'pago' (SU PAGO → concilia contra cta cte) | 'movimiento' (concilia contra template/factura)
        tipo_fila: /SU\s+PAGO/i.test(m.descripcion) ? "pago" : "movimiento",
      })
    }

    if (paraInsertar.length === 0) {
      return NextResponse.json({
        ok: false,
        message: `Todas las filas (${duplicadosOmitidos}) ya estaban importadas.`,
        excel_base64: excelBase64,
        control,
        duplicados_omitidos: duplicadosOmitidos,
      })
    }

    const { error: errInsert } = await client.from(config.tabla).insert(paraInsertar)
    if (errInsert) {
      return NextResponse.json(
        { ok: false, message: `Error al insertar: ${errInsert.message}`, excel_base64: excelBase64 },
        { status: 500 }
      )
    }

    // Fila "resumen": guarda el total a pagar + saldo anterior del PDF (para el audit y el desplegable).
    // tipo_fila='resumen', estado='total' → excluida del motor y de las sumas de movimientos.
    // Convención: debitos = total a pagar, creditos = saldo anterior (ídem USD).
    if (resumen.nro_resumen) {
      const { data: resExist } = await client.from(config.tabla)
        .select("id").eq("nro_resumen", resumen.nro_resumen).eq("tipo_fila", "resumen").maybeSingle()
      if (!resExist) {
        await client.from(config.tabla).insert({
          fecha: resumen.fecha_cierre,
          descripcion: `RESUMEN ${resumen.nro_resumen}`,
          debitos: resumen.total_a_pagar_pesos,
          creditos: resumen.saldo_anterior_pesos,
          debitos_usd: resumen.total_a_pagar_usd,
          creditos_usd: resumen.saldo_anterior_usd,
          nro_resumen: resumen.nro_resumen,
          fecha_cierre: resumen.fecha_cierre,
          fecha_vencimiento: resumen.fecha_vencimiento,
          cuenta: config.tabla,
          orden: nextOrden++,
          estado: "total",
          tipo_fila: "resumen",
        })
      }
    }

    return NextResponse.json({
      ok: true,
      message: `${paraInsertar.length} movimiento(s) importado(s) desde el PDF a ${config.schema}.${config.tabla}.`,
      insertados: paraInsertar.length,
      duplicados_omitidos: duplicadosOmitidos,
      control,
      resumen: {
        nro_resumen: resumen.nro_resumen,
        fecha_cierre: resumen.fecha_cierre,
        fecha_vencimiento: resumen.fecha_vencimiento,
        saldo_anterior_pesos: resumen.saldo_anterior_pesos,
        saldo_anterior_usd: resumen.saldo_anterior_usd,
        total_a_pagar_pesos: resumen.total_a_pagar_pesos,
        total_a_pagar_usd: resumen.total_a_pagar_usd,
      },
      excel_base64: excelBase64,
    })
  } catch (e: any) {
    console.error("Error en import-pdf-tarjeta:", e)
    return NextResponse.json(
      { ok: false, message: `Error inesperado: ${e?.message || "desconocido"}` },
      { status: 500 }
    )
  }
}
