import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Mapa cuenta → { schema, tabla }
const CUENTAS_VALIDAS: Record<string, { schema: string; tabla: string }> = {
  tarjeta_visa_business_msa: { schema: "msa", tabla: "tarjeta_visa_business" },
  tarjeta_visa_pam: { schema: "pam", tabla: "tarjeta_visa" },
  tarjeta_visa_ma: { schema: "ma", tabla: "tarjeta_visa" },
}

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
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (m) {
    let [, d, mo, y] = m
    if (y.length === 2) y = "20" + y
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
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
  referencia: number
  cuota: number
  comprobante: number
  concepto: number
  pesos: number
  dolares: number
  nro_resumen: number
  fecha_cierre: number
  fecha_vencimiento: number
  tarjeta_adicional: number
  titular: number
}

function findCol(upper: string[], ...nombres: string[]): number {
  for (const n of nombres) {
    const idx = upper.indexOf(n)
    if (idx >= 0) return idx
  }
  return -1
}

function detectarColumnas(rows: any[][]): { headerRow: number; cols: Cols } | null {
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i] || []
    const upper = row.map((c) => clean(c).toUpperCase())
    const fecha = findCol(upper, "FECHA")
    const concepto = findCol(upper, "CONCEPTO", "DESCRIPCION", "DESCRIPCIÓN", "REFERENCIA DESC")
    const pesos = findCol(upper, "PESOS", "PESO", "MONTO", "MONTO PESOS", "IMPORTE")
    if (fecha < 0 || concepto < 0) continue
    if (pesos < 0 && findCol(upper, "DOLARES", "DÓLARES", "USD") < 0) continue
    return {
      headerRow: i,
      cols: {
        fecha,
        concepto,
        pesos,
        dolares: findCol(upper, "DOLARES", "DÓLARES", "USD", "MONTO USD"),
        referencia: findCol(upper, "REFERENCIA", "REF"),
        cuota: findCol(upper, "CUOTA", "CUOTAS"),
        comprobante: findCol(upper, "COMPROBANTE", "NRO COMPROBANTE", "COMP"),
        nro_resumen: findCol(upper, "NRO RESUMEN", "RESUMEN", "NRO_RESUMEN"),
        fecha_cierre: findCol(upper, "FECHA CIERRE", "CIERRE", "FECHA_CIERRE"),
        fecha_vencimiento: findCol(upper, "FECHA VENCIMIENTO", "VENCIMIENTO", "FECHA_VENCIMIENTO"),
        tarjeta_adicional: findCol(upper, "TARJETA", "TARJETA ADICIONAL", "NRO TARJETA"),
        titular: findCol(upper, "TITULAR", "TITULAR ADICIONAL", "NOMBRE TITULAR"),
      },
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
    const cuenta = (formData.get("tabla") as string | null)?.trim() || ""

    if (!file) {
      return NextResponse.json({ ok: false, message: "Falta el archivo" }, { status: 400 })
    }
    const config = CUENTAS_VALIDAS[cuenta]
    if (!config) {
      return NextResponse.json(
        { ok: false, message: `Cuenta inválida: ${cuenta}. Permitidas: ${Object.keys(CUENTAS_VALIDAS).join(", ")}` },
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
            "No se encontró el encabezado esperado. Mínimo: FECHA, CONCEPTO y PESOS o DÓLARES. Otras columnas opcionales: REFERENCIA, CUOTA, COMPROBANTE, NRO RESUMEN, FECHA CIERRE, FECHA VENCIMIENTO, TARJETA, TITULAR.",
        },
        { status: 400 }
      )
    }
    const { headerRow, cols } = detect

    const client = supabase.schema(config.schema)

    // Pre-cargar movimientos existentes para deduplicar
    const fechasArchivo: string[] = []
    for (let i = headerRow + 1; i < rows.length; i++) {
      const f = parseDate(rows[i]?.[cols.fecha])
      if (f) fechasArchivo.push(f)
    }
    const fechaMin = fechasArchivo.sort()[0] || null

    const existentes = new Set<string>()
    if (fechaMin) {
      const { data: ex } = await client
        .from(config.tabla)
        .select("fecha, descripcion, debitos, creditos, comprobante")
        .gte("fecha", fechaMin)
      ex?.forEach((e: any) => {
        const k = `${e.fecha}|${(e.descripcion || "").trim()}|${Number(e.debitos) || 0}|${Number(e.creditos) || 0}|${e.comprobante || ""}`
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

    const filasParaInsertar: any[] = []
    let duplicadosOmitidos = 0
    let filasIgnoradas = 0

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i] || []
      if (!row || row.every((c) => c == null || clean(c) === "")) continue

      const fecha = parseDate(row[cols.fecha])
      if (!fecha) {
        filasIgnoradas++
        continue
      }

      const concepto = clean(row[cols.concepto])
      const pesos = cols.pesos >= 0 ? parseNum(row[cols.pesos]) : 0
      const dolares = cols.dolares >= 0 ? parseNum(row[cols.dolares]) : 0

      if (pesos === 0 && dolares === 0 && !concepto) {
        filasIgnoradas++
        continue
      }

      // Convención: positivo = consumo (débito), negativo = pago/reverso (crédito)
      const debitos = pesos > 0 ? pesos : 0
      const creditos = pesos < 0 ? Math.abs(pesos) : 0
      const debitos_usd = dolares > 0 ? dolares : 0
      const creditos_usd = dolares < 0 ? Math.abs(dolares) : 0

      const comprobante = cols.comprobante >= 0 ? clean(row[cols.comprobante]) : ""

      const dedupKey = `${fecha}|${concepto}|${debitos}|${creditos}|${comprobante}`
      if (existentes.has(dedupKey)) {
        duplicadosOmitidos++
        continue
      }
      existentes.add(dedupKey)

      filasParaInsertar.push({
        fecha,
        descripcion: concepto || null,
        debitos,
        creditos,
        debitos_usd,
        creditos_usd,
        referencia: cols.referencia >= 0 ? clean(row[cols.referencia]) || null : null,
        cuota: cols.cuota >= 0 ? clean(row[cols.cuota]) || null : null,
        comprobante: comprobante || null,
        nro_resumen: cols.nro_resumen >= 0 ? clean(row[cols.nro_resumen]) || null : null,
        fecha_cierre: cols.fecha_cierre >= 0 ? parseDate(row[cols.fecha_cierre]) : null,
        fecha_vencimiento: cols.fecha_vencimiento >= 0 ? parseDate(row[cols.fecha_vencimiento]) : null,
        tarjeta_adicional: cols.tarjeta_adicional >= 0 ? clean(row[cols.tarjeta_adicional]) || null : null,
        titular_adicional: cols.titular >= 0 ? clean(row[cols.titular]) || null : null,
        categ: null,
        detalle: null,
        contable: null,
        interno: null,
        centro_de_costo: null,
        cuenta: config.tabla,
        orden: nextOrden++,
        estado: "pendiente",
      })
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
          filas_ignoradas: filasIgnoradas,
        },
        { status: 400 }
      )
    }

    const { error: errInsert } = await client.from(config.tabla).insert(filasParaInsertar)
    if (errInsert) {
      return NextResponse.json(
        { ok: false, message: `Error al insertar: ${errInsert.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: `${filasParaInsertar.length} movimiento(s) importado(s) a ${config.schema}.${config.tabla}`,
      insertados: filasParaInsertar.length,
      duplicados_omitidos: duplicadosOmitidos,
      filas_ignoradas: filasIgnoradas,
    })
  } catch (e: any) {
    console.error("Error en import-excel-tarjeta:", e)
    return NextResponse.json(
      { ok: false, message: `Error inesperado: ${e?.message || "desconocido"}` },
      { status: 500 }
    )
  }
}
