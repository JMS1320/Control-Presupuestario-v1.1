import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TABLAS_VALIDAS = new Set(["caja_general", "caja_ams", "caja_sigot"])
const SCHEMA = "msa"

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function clean(value: any): string {
  return value != null ? String(value).trim() : ""
}

function parseNum(value: any): number {
  if (value === null || value === undefined || value === "") return 0
  if (typeof value === "number") return value
  const s = String(value)
    .trim()
    .replace(/[$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function parseDate(value: any): string | null {
  if (value === null || value === undefined || value === "") return null
  // Excel serial number
  if (typeof value === "number") {
    const d = (XLSX as any).SSF?.parse_date_code?.(value)
    if (d) {
      const yyyy = String(d.y).padStart(4, "0")
      const mm = String(d.m).padStart(2, "0")
      const dd = String(d.d).padStart(2, "0")
      return `${yyyy}-${mm}-${dd}`
    }
  }
  const s = String(value).trim()
  // DD/MM/YYYY o DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (m) {
    let [, d, mo, y] = m
    if (y.length === 2) y = "20" + y
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  // YYYY-MM-DD
  const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m2) {
    const [, y, mo, d] = m2
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  return null
}

// -----------------------------------------------------------------------------
// Detección de columnas
// -----------------------------------------------------------------------------

interface Cols {
  fecha: number
  comp: number
  cat: number
  concepto: number
  salida: number
  entrada: number
  saldo: number
}

function detectarColumnas(rows: any[][]): { headerRow: number; cols: Cols } | null {
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i] || []
    const upper = row.map((c) => clean(c).toUpperCase())
    const fechaIdx = upper.findIndex((c) => c === "FECHA")
    if (fechaIdx < 0) continue
    const conceptoIdx = upper.findIndex((c) => c === "CONCEPTO" || c === "DESCRIPCION" || c === "DESCRIPCIÓN")
    const salidaIdx = upper.findIndex((c) => c === "SALIDA" || c === "DEBITO" || c === "DÉBITO" || c === "DEBITOS")
    const entradaIdx = upper.findIndex((c) => c === "ENTRADA" || c === "CREDITO" || c === "CRÉDITO" || c === "CREDITOS")
    const saldoIdx = upper.findIndex((c) => c === "SALDO")
    // Considerar header válido si tiene al menos FECHA + CONCEPTO + SALIDA/ENTRADA
    if (conceptoIdx >= 0 && (salidaIdx >= 0 || entradaIdx >= 0)) {
      return {
        headerRow: i,
        cols: {
          fecha: fechaIdx,
          comp: upper.findIndex((c) => c === "COMP" || c === "COMPROBANTE"),
          cat: upper.findIndex((c) => c === "CAT" || c === "CATEGORIA" || c === "CATEGORÍA" || c === "CATEG"),
          concepto: conceptoIdx,
          salida: salidaIdx,
          entrada: entradaIdx,
          saldo: saldoIdx,
        },
      }
    }
  }
  return null
}

// -----------------------------------------------------------------------------
// Endpoint
// -----------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const tabla = (formData.get("tabla") as string | null)?.trim() || ""
    const saldoInicialInput = formData.get("saldo_inicial") as string | null

    if (!file) {
      return NextResponse.json({ ok: false, message: "Falta el archivo" }, { status: 400 })
    }
    if (!TABLAS_VALIDAS.has(tabla)) {
      return NextResponse.json(
        { ok: false, message: `Tabla inválida: ${tabla}. Permitidas: ${[...TABLAS_VALIDAS].join(", ")}` },
        { status: 400 }
      )
    }

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: "array", cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) {
      return NextResponse.json({ ok: false, message: "No se pudo leer la primera hoja del Excel" }, { status: 400 })
    }
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null })

    const detect = detectarColumnas(rows)
    if (!detect) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "No se encontró el encabezado esperado. Debe tener al menos las columnas FECHA, CONCEPTO y SALIDA/ENTRADA.",
        },
        { status: 400 }
      )
    }
    const { headerRow, cols } = detect

    const client = supabase.schema(SCHEMA)

    // Verificar estado de la tabla destino
    const { data: existentes, error: errExist } = await client.from(tabla).select("id").limit(1)
    if (errExist) {
      return NextResponse.json(
        { ok: false, message: `Error al consultar ${SCHEMA}.${tabla}: ${errExist.message}` },
        { status: 500 }
      )
    }
    const tablaVacia = !existentes || existentes.length === 0

    // Saldo anterior y orden inicial
    let saldoAnterior = 0
    if (tablaVacia && saldoInicialInput && saldoInicialInput.trim()) {
      saldoAnterior = parseNum(saldoInicialInput)
    } else if (!tablaVacia) {
      const { data: ultimo } = await client
        .from(tabla)
        .select("saldo, fecha, orden")
        .order("fecha", { ascending: false })
        .order("orden", { ascending: false })
        .limit(1)
        .maybeSingle()
      saldoAnterior = ultimo?.saldo ?? 0
    }

    const { data: maxOrden } = await client
      .from(tabla)
      .select("orden")
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle()
    let nextOrden = (maxOrden?.orden ?? 0) + 1

    // Pre-cargar movimientos existentes para deduplicar (por fecha + descripcion + debitos + creditos)
    const fechaInicio = (() => {
      let fmin: string | null = null
      for (let i = headerRow + 1; i < rows.length; i++) {
        const f = parseDate(rows[i]?.[cols.fecha])
        if (f && (!fmin || f < fmin)) fmin = f
      }
      return fmin
    })()

    let existentesParaDedup = new Set<string>()
    if (!tablaVacia && fechaInicio) {
      const { data: existing } = await client
        .from(tabla)
        .select("fecha, descripcion, debitos, creditos")
        .gte("fecha", fechaInicio)
      existing?.forEach((e: any) => {
        const k = `${e.fecha}|${(e.descripcion || "").trim()}|${Number(e.debitos) || 0}|${Number(e.creditos) || 0}`
        existentesParaDedup.add(k)
      })
    }

    // Procesar filas
    const filasParaInsertar: any[] = []
    const errores: string[] = []
    const erroresControl: { fila: number; descripcion: string; diferencia: number }[] = []
    let saldoInicialDetectado = false
    let duplicadosOmitidos = 0

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i] || []
      if (!row || row.every((c) => c == null || clean(c) === "")) continue

      const fecha = parseDate(row[cols.fecha])
      if (!fecha) {
        // Si la primera fila después del header dice "Saldo" sin fecha, también lo tratamos como saldo inicial
        const concepto0 = clean(row[cols.concepto]).toUpperCase()
        const saldo0 = cols.saldo >= 0 ? parseNum(row[cols.saldo]) : 0
        if (i === headerRow + 1 && concepto0 === "SALDO" && saldo0 > 0 && tablaVacia) {
          saldoAnterior = saldo0
          saldoInicialDetectado = true
        }
        continue
      }

      const concepto = clean(row[cols.concepto])
      const cat = cols.cat >= 0 ? clean(row[cols.cat]) : ""
      // Comp se ignora a propósito — el usuario usa columnas Contable / Interno aparte
      const salida = cols.salida >= 0 ? parseNum(row[cols.salida]) : 0
      const entrada = cols.entrada >= 0 ? parseNum(row[cols.entrada]) : 0
      const saldoExcel = cols.saldo >= 0 ? parseNum(row[cols.saldo]) : 0

      // Saldo inicial: primera fila después del header con CONCEPTO=SALDO sin movimientos
      if (i === headerRow + 1 && concepto.toUpperCase() === "SALDO" && salida === 0 && entrada === 0 && saldoExcel > 0) {
        if (tablaVacia) {
          saldoAnterior = saldoExcel
          saldoInicialDetectado = true
        }
        continue
      }

      // Deduplicación
      const dedupKey = `${fecha}|${concepto}|${salida}|${entrada}`
      if (existentesParaDedup.has(dedupKey)) {
        duplicadosOmitidos++
        continue
      }
      existentesParaDedup.add(dedupKey)

      // Control de saldo
      const saldoCalculado = Math.round((saldoAnterior - salida + entrada) * 100) / 100
      const control = Math.round((saldoExcel - saldoCalculado) * 100) / 100
      if (Math.abs(control) > 0.01) {
        erroresControl.push({ fila: i + 1, descripcion: concepto, diferencia: control })
      }

      filasParaInsertar.push({
        fecha,
        descripcion: concepto || null,
        debitos: salida,
        creditos: entrada,
        saldo: saldoExcel,
        control,
        categ: cat || null,
        detalle: null,
        contable: null,
        interno: null,
        centro_de_costo: null,
        cuenta: tabla,
        orden: nextOrden++,
        estado: "pendiente",
      })

      saldoAnterior = saldoExcel
    }

    if (filasParaInsertar.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            duplicadosOmitidos > 0
              ? `No se importó nada. ${duplicadosOmitidos} fila(s) eran duplicadas.`
              : "No se encontraron movimientos válidos.",
          duplicados_omitidos: duplicadosOmitidos,
        },
        { status: 400 }
      )
    }

    // Insertar
    const { error: errInsert } = await client.from(tabla).insert(filasParaInsertar)
    if (errInsert) {
      return NextResponse.json(
        { ok: false, message: `Error al insertar: ${errInsert.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: `${filasParaInsertar.length} movimiento(s) importado(s) a ${SCHEMA}.${tabla}`,
      insertados: filasParaInsertar.length,
      saldo_inicial_detectado: saldoInicialDetectado,
      duplicados_omitidos: duplicadosOmitidos,
      errores_control: erroresControl.length,
      detalle_errores_control: erroresControl.slice(0, 10),
      errores,
    })
  } catch (e: any) {
    console.error("Error en import-excel-caja:", e)
    return NextResponse.json(
      { ok: false, message: `Error inesperado: ${e?.message || "desconocido"}` },
      { status: 500 }
    )
  }
}
