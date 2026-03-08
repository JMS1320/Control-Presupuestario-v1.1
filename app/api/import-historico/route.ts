import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Convierte fechas del formato Excel a "YYYY-MM-DD"
 * Soporta: número serial Excel, string DD/MM/YYYY, string YYYY-MM-DD
 */
function convertirFecha(valor: string | number | null | undefined): string | null {
  if (valor === null || valor === undefined || valor === "") return null

  if (typeof valor === "number") {
    try {
      const fecha = new Date(Date.UTC(1899, 11, 30) + valor * 86400 * 1000)
      if (isNaN(fecha.getTime())) return null
      const a = fecha.getUTCFullYear()
      const m = String(fecha.getUTCMonth() + 1).padStart(2, "0")
      const d = String(fecha.getUTCDate()).padStart(2, "0")
      return `${a}-${m}-${d}`
    } catch {
      return null
    }
  }

  const s = String(valor).trim()
  if (!s) return null

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD/MM/YYYY
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`

  return null
}

/**
 * Convierte número argentino o Excel a decimal estándar
 */
function convertirNumero(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === "") return 0
  if (typeof valor === "number") return valor

  const s = String(valor).trim()
  if (!s) return 0

  // Paréntesis = negativo: (1.234,56)
  const esNeg = s.startsWith("(") && s.endsWith(")")
  const limpio = esNeg
    ? s.slice(1, -1).replace(/\./g, "").replace(",", ".")
    : s.replace(/\./g, "").replace(",", ".")

  const n = parseFloat(limpio) || 0
  return esNeg ? -n : n
}

/**
 * POST /api/import-historico
 * Importa comprobantes históricos desde Excel personalizado "Facturas 25-26"
 * Columnas: Fecha | Tipo | Punto de Venta | Número Desde | Nro. Doc. Emisor |
 *           Denominación Emisor | Imp. Neto Gravado | Imp. Neto No Gravado |
 *           Imp. Op. Exentas | Percepcion IIBB | Percepcion IVA | Otros Tributos |
 *           IVA | Imp. Total | FC | Cuenta Contable | Año contable | Mes contable
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const empresa = (formData.get("empresa") as string) || "MSA"

    if (!file) {
      return NextResponse.json({ success: false, message: "No se recibió archivo" }, { status: 400 })
    }

    // Leer Excel
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: "array", cellDates: false })

    // Buscar solapa "FC semestre 2" o tomar la primera
    const sheetName = wb.SheetNames.includes("FC semestre 2")
      ? "FC semestre 2"
      : wb.SheetNames[0]

    const ws = wb.Sheets[sheetName]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    if (rows.length < 2) {
      return NextResponse.json({ success: false, message: "El archivo no tiene datos" }, { status: 400 })
    }

    // Fila 0 = headers, filas 1+ = datos
    const headers = (rows[0] as any[]).map((h) => String(h ?? "").trim())

    // Mapear índices de columnas
    const col = (nombre: string): number => {
      const i = headers.findIndex((h) =>
        h.toLowerCase().includes(nombre.toLowerCase())
      )
      return i
    }

    const iFecha = col("fecha")
    const iTipo = col("tipo")
    const iPtoVenta = col("punto de venta")
    const iNumero = col("número desde")
    const iCuit = col("nro. doc. emisor")
    const iDenominacion = col("denominación emisor")
    const iNetoGrav = col("neto gravado")
    const iNetoNoGrav = col("neto no gravado")
    const iOpExentas = col("op. exentas")
    const iPercIIBB = col("percepcion iibb")
    const iPercIVA = col("percepcion iva")
    const iOtrosTrib = col("otros tributos")
    // Buscar IVA exacto: evitar que "Percepcion IVA" sea detectado primero
    const iIVA = headers.findIndex((h) => /^iva$/i.test(h.trim()))
    // Buscar Imp. Total con variantes (con/sin punto, con/sin "imp.")
    const iTotal = headers.findIndex((h) =>
      /^imp\.?\s*total$/i.test(h.trim()) || /^total\s*(comprobante)?$/i.test(h.trim())
    )
    const iFC = col("fc")
    const iCuenta = col("cuenta contable")
    const iAnio = col("año contable")
    const iMes = col("mes contable")

    // Diagnóstico de columnas (incluido en respuesta para debugging)
    const colDiag = { iFecha, iTipo, iNetoGrav, iIVA, iTotal, iFC, iCuenta }

    const registros: any[] = []
    const errores: string[] = []
    let filasSaltadas = 0

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.every((v: any) => v === null || v === "")) {
        filasSaltadas++
        continue
      }

      // Saltar filas con Tipo = "x" o FC = "x"
      const tipo = isTipo(row[iTipo])
      const fc = String(row[iFC] ?? "").trim()
      if (tipo === "x" || fc === "x") {
        filasSaltadas++
        continue
      }

      const fecha = convertirFecha(row[iFecha])
      if (!fecha) {
        errores.push(`Fila ${i + 1}: Fecha inválida ("${row[iFecha]}")`)
        continue
      }

      const cuit = limpiarCuit(row[iCuit])
      const denominacion = String(row[iDenominacion] ?? "").trim()

      if (!denominacion) {
        errores.push(`Fila ${i + 1}: Sin denominación emisor`)
        continue
      }

      registros.push({
        fecha,
        tipo: tipo || null,
        punto_de_venta: parseIntSafe(row[iPtoVenta]),
        numero_desde: parseIntSafe(row[iNumero]),
        nro_doc_emisor: cuit || null,
        denominacion_emisor: denominacion,
        imp_neto_gravado: convertirNumero(row[iNetoGrav]),
        imp_neto_no_gravado: convertirNumero(row[iNetoNoGrav]),
        imp_op_exentas: convertirNumero(row[iOpExentas]),
        percepcion_iibb: convertirNumero(row[iPercIIBB]),
        percepcion_iva: convertirNumero(row[iPercIVA]),
        otros_tributos: convertirNumero(row[iOtrosTrib]),
        iva: convertirNumero(row[iIVA]),
        imp_total: convertirNumero(row[iTotal]),
        fc: fc || null,
        cuenta_contable: String(row[iCuenta] ?? "").trim() || null,
        anio_contable: parseIntSafe(row[iAnio]),
        mes_contable: parseIntSafe(row[iMes]),
        empresa,
      })
    }

    if (registros.length === 0) {
      return NextResponse.json({
        success: false,
        message: `No se encontraron registros válidos. Saltadas: ${filasSaltadas}, Errores: ${errores.length}`,
        errores,
      })
    }

    // Insertar en lotes de 50
    let insertados = 0
    const erroresInsert: string[] = []

    for (let i = 0; i < registros.length; i += 50) {
      const lote = registros.slice(i, i + 50)
      const { error } = await supabase
        .schema("msa")
        .from("comprobantes_historico")
        .insert(lote)

      if (error) {
        erroresInsert.push(`Lote ${Math.floor(i / 50) + 1}: ${error.message}`)
      } else {
        insertados += lote.length
      }
    }

    return NextResponse.json({
      success: true,
      insertados,
      saltadas: filasSaltadas,
      erroresParseo: errores,
      erroresInsert,
      totalFilas: rows.length - 1,
      message: `Importados ${insertados} de ${registros.length} registros válidos`,
      diagnostico: { columnas: colDiag, headers },
    })
  } catch (err: any) {
    console.error("Error import-historico:", err)
    return NextResponse.json(
      { success: false, message: err.message || "Error interno del servidor" },
      { status: 500 }
    )
  }
}

function isTipo(v: any): string {
  return String(v ?? "").trim()
}

function limpiarCuit(v: any): string {
  return String(v ?? "").replace(/[-\s]/g, "").trim()
}

function parseIntSafe(v: any): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = parseInt(String(v), 10)
  return isNaN(n) ? null : n
}
