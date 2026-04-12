import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface ReglaParseo {
  campo_destino: string | null
  tipo_regla: string
  numero_linea: number | null
  grupo_de_conceptos: string
}

type MapaReglas = Record<string, ReglaParseo[]> // tipo_movimiento → reglas

// ---------------------------------------------------------------------------
// Helpers numéricos y de fecha (formato CA Galicia)
// ---------------------------------------------------------------------------

/**
 * Parsea número CA Galicia: punto = miles, coma = decimal, signo negativo posible.
 * Devuelve el valor con su signo original (débitos vienen negativos).
 */
function parseNumberCA(value: any): number {
  if (value === null || value === undefined || value === "") return 0
  const s = String(value)
    .trim()
    .replace(/\./g, "")   // eliminar separador de miles
    .replace(",", ".")    // coma → punto decimal
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

/**
 * Parsea fecha DD/MM/YYYY → YYYY-MM-DD
 */
function parseDateCA(value: any): string | null {
  if (!value) return null
  const s = String(value).trim()

  // Formato DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    const date = new Date(`${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00`)
    if (!isNaN(date.getTime())) return date.toISOString().split("T")[0]
  }

  // Fallback: dejar que Date lo intente
  try {
    const date = new Date(s)
    if (!isNaN(date.getTime())) return date.toISOString().split("T")[0]
  } catch {}

  return null
}

function cleanString(value: any): string {
  if (typeof value === "string") return value.trim()
  return value != null ? String(value).trim() : ""
}

// ---------------------------------------------------------------------------
// Parseo del campo Movimiento usando reglas de BD
// ---------------------------------------------------------------------------

/**
 * Divide el texto Movimiento (multilinea) en líneas limpias.
 */
function splitMovimiento(raw: string): string[] {
  return raw
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

/**
 * Detecta CUIT en una línea: 11 dígitos, posible prefijo "CU " o "NO ".
 */
function esCuit(linea: string): boolean {
  const limpio = linea.replace(/^(CU|NO)\s+/, "").trim()
  return /^\d{11}$/.test(limpio)
}

/**
 * Extrae CUIT limpio (sin prefijo).
 */
function extraerCuit(lineas: string[]): string {
  for (const l of lineas) {
    const c = l.replace(/^(CU|NO)\s+/, "").trim()
    if (/^\d{11}$/.test(c)) return c
  }
  return ""
}

/**
 * Aplica una regla a las líneas del Movimiento.
 */
function aplicarRegla(lineas: string[], regla: ReglaParseo): string {
  switch (regla.tipo_regla) {
    case "linea":
      return lineas[(regla.numero_linea ?? 1) - 1]?.trim() ?? ""

    case "cuit":
      return extraerCuit(lineas)

    case "pre_cuit":
      // Devuelve la línea ANTES del CUIT, solo si el CUIT está en posición 2 o mayor.
      // Si el CUIT está en la posición 1 (línea 2 del array, índice 1), no hay nombre previo.
      for (let i = 1; i < lineas.length; i++) {
        if (esCuit(lineas[i])) {
          // CUIT en índice i → línea previa sería índice i-1.
          // Solo devolver si i >= 2 (hay al menos una línea entre tipo y CUIT).
          return i >= 2 ? lineas[i - 1]?.trim() ?? "" : ""
        }
      }
      return ""

    case "post_cuit":
      // Devuelve la línea DESPUÉS del CUIT.
      for (let i = 0; i < lineas.length - 1; i++) {
        if (esCuit(lineas[i])) return lineas[i + 1]?.trim() ?? ""
      }
      return ""

    case "nro_operacion":
      // Busca patrón "OPERACION XXXXX" o "OP:XXXXX"
      for (const l of lineas) {
        const m1 = l.match(/OPERACION\s+(\S+)/i)
        if (m1) return m1[1]
        const m2 = l.match(/OP:(\S+)/i)
        if (m2) return m2[1]
      }
      // Fallback: último segmento numérico (no CUIT)
      for (let i = lineas.length - 1; i >= 1; i--) {
        const l = lineas[i].trim()
        if (/^\d+$/.test(l) && !/^\d{11}$/.test(l)) return l
      }
      return ""
  }
  return ""
}

/**
 * Parsea un texto Movimiento usando las reglas de la BD.
 * Devuelve un objeto con los campos destino populados.
 */
function parsearMovimiento(
  raw: string,
  mapaReglas: MapaReglas
): Record<string, string> {
  const lineas = splitMovimiento(raw)
  const tipoLinea1 = (lineas[0] ?? "").toUpperCase()
  const resultado: Record<string, string> = {}

  // Buscar reglas exactas (case-insensitive sobre tipo_movimiento)
  const claveExacta = Object.keys(mapaReglas).find(
    (k) => k.toUpperCase() === tipoLinea1
  )
  const reglas = claveExacta
    ? mapaReglas[claveExacta]
    : mapaReglas["*"] ?? []

  // Extraer grupo_de_conceptos del primer set de reglas
  const grupoConceptos =
    reglas.length > 0 ? reglas[0].grupo_de_conceptos : "Otros"

  resultado["grupo_de_conceptos"] = grupoConceptos

  for (const regla of reglas) {
    if (!regla.campo_destino) continue
    resultado[regla.campo_destino] = aplicarRegla(lineas, regla)
  }

  // Descripcion siempre tiene al menos la línea 1 (tipo)
  if (!resultado["descripcion"]) {
    resultado["descripcion"] = tipoLinea1 || raw.substring(0, 100)
  }

  return resultado
}

// ---------------------------------------------------------------------------
// Carga de reglas desde BD
// ---------------------------------------------------------------------------

async function cargarReglasCA(cuentaBancariaId: string): Promise<MapaReglas> {
  const { data, error } = await supabase
    .from("config_parseo_extracto")
    .select(
      "tipo_movimiento, campo_destino, tipo_regla, numero_linea, grupo_de_conceptos"
    )
    .eq("cuenta_bancaria_id", cuentaBancariaId)
    .eq("activo", true)
    .order("orden", { ascending: true })

  if (error || !data) {
    console.error("Error cargando reglas parseo:", error)
    return {}
  }

  const mapa: MapaReglas = {}
  for (const r of data) {
    const tipo = r.tipo_movimiento
    if (!mapa[tipo]) mapa[tipo] = []
    mapa[tipo].push({
      campo_destino: r.campo_destino,
      tipo_regla: r.tipo_regla,
      numero_linea: r.numero_linea,
      grupo_de_conceptos: r.grupo_de_conceptos ?? "",
    })
  }
  return mapa
}

// ---------------------------------------------------------------------------
// Endpoint POST
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    const saldoInicialInput = formData.get("saldo_inicial")
    const saldoInicial = saldoInicialInput
      ? parseNumberCA(saldoInicialInput)
      : 0

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    // -----------------------------------------------------------------------
    // 1. Leer Excel
    // -----------------------------------------------------------------------
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    // Leer todas las filas como array (sin parseo de cabeceras automático)
    const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      header: 1,
    })

    // El formato CA Galicia tiene filas de metadatos al inicio.
    // Buscamos la fila de cabeceras buscando "Fecha" en la columna 0.
    let headerRowIndex = -1
    for (let i = 0; i < Math.min(allRows.length, 15); i++) {
      const cell = String(allRows[i][0] ?? "").trim()
      if (cell === "Fecha") {
        headerRowIndex = i
        break
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json(
        {
          error:
            'No se encontró la fila de cabeceras ("Fecha") en las primeras 15 filas. Verificar formato del archivo.',
        },
        { status: 400 }
      )
    }

    const headers: string[] = allRows[headerRowIndex].map((h: any) =>
      String(h ?? "").trim()
    )

    // Datos: filas posteriores a cabeceras, en orden del archivo (newest→oldest)
    const rawDataNewestFirst = allRows.slice(headerRowIndex + 1).filter(
      (row) => row.some((cell: any) => cell !== "" && cell !== null)
    )

    // Invertir para procesar oldest→newest (necesario para control de saldo)
    const filas = [...rawDataNewestFirst].reverse()

    console.log(`CA Import: archivo=${file.name}, filas=${filas.length}`)
    console.log(`CA Import: cabeceras detectadas:`, headers)

    // -----------------------------------------------------------------------
    // 2. Cargar reglas de parseo
    // -----------------------------------------------------------------------
    const mapaReglas = await cargarReglasCA("pam_galicia")
    console.log(`CA Import: reglas cargadas:`, Object.keys(mapaReglas).length, "tipos")

    // -----------------------------------------------------------------------
    // 3. Estado actual de la tabla pam_galicia
    // -----------------------------------------------------------------------
    const { data: ultimaFila } = await supabase
      .from("pam_galicia")
      .select("fecha, saldo, orden, control")
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle()

    const ultimaFecha = ultimaFila?.fecha ?? null
    let saldoAnterior = ultimaFila?.saldo ?? saldoInicial
    let nextOrden = ultimaFila?.orden ? Number(ultimaFila.orden) + 1 : 1
    let controlAnterior = ultimaFila?.control ?? 0

    // Movimientos ya existentes en la última fecha (para deduplicar)
    const movimientosUltimaFecha = new Set<string>()
    if (ultimaFecha) {
      const { data: existentes } = await supabase
        .from("pam_galicia")
        .select("descripcion, debitos, creditos")
        .eq("fecha", ultimaFecha)
      existentes?.forEach((m: any) => {
        movimientosUltimaFecha.add(`${m.descripcion}|${m.debitos}|${m.creditos}`)
      })
    }

    // Categorías válidas
    const { data: categsValidas } = await supabase
      .from("cuentas_contables")
      .select("categ")
    const setCategs = new Set(categsValidas?.map((c: any) => c.categ) ?? [])

    const hoy = new Date().toISOString().split("T")[0]

    // -----------------------------------------------------------------------
    // 4. Mapear índices de columnas por nombre
    // -----------------------------------------------------------------------
    const colIdx = (name: string) =>
      headers.findIndex(
        (h) => h.toLowerCase() === name.toLowerCase()
      )

    const idxFecha = colIdx("Fecha")
    const idxMovimiento = colIdx("Movimiento")
    // "Débito" puede tener acento o no
    const idxDebito =
      headers.findIndex((h) => /d[eé]bito/i.test(h))
    const idxCredito =
      headers.findIndex((h) => /cr[eé]dito/i.test(h))
    const idxSaldo =
      headers.findIndex((h) => /saldo/i.test(h))
    // "Comentarios" → observaciones_cliente
    const idxComentarios =
      headers.findIndex((h) => /comentario/i.test(h))

    if (idxFecha === -1 || idxMovimiento === -1) {
      return NextResponse.json(
        {
          error: `Columnas obligatorias no encontradas. Cabeceras detectadas: ${headers.join(", ")}`,
        },
        { status: 400 }
      )
    }

    console.log(
      `CA Import: idxFecha=${idxFecha} idxMovimiento=${idxMovimiento} idxDebito=${idxDebito} idxCredito=${idxCredito} idxSaldo=${idxSaldo}`
    )

    // -----------------------------------------------------------------------
    // 5. Procesar filas
    // -----------------------------------------------------------------------
    const errores: any[] = []
    const controlErrors: any[] = []
    const rowsParaInsertar: any[] = []

    console.log(`CA Import: hoy=${hoy}, ultimaFecha=${ultimaFecha}, saldoAnterior=${saldoAnterior}`)

    for (const [index, row] of filas.entries()) {
      const fecha = parseDateCA(row[idxFecha])
      if (!fecha) continue

      // Filtros de fecha
      if (fecha >= hoy) continue
      if (ultimaFecha && fecha < ultimaFecha) continue

      // Deduplicar movimientos del mismo día que el último ya guardado
      const rawMovimiento = cleanString(row[idxMovimiento])
      const debitoRaw = idxDebito >= 0 ? parseNumberCA(row[idxDebito]) : 0
      const creditoRaw = idxCredito >= 0 ? parseNumberCA(row[idxCredito]) : 0

      // En CA Galicia, débitos vienen con signo negativo; créditos positivos.
      const debitos = Math.abs(debitoRaw)
      const creditos = Math.abs(creditoRaw)

      if (ultimaFecha && fecha === ultimaFecha) {
        // Parsear descripción para la clave de dedup
        const parsedTemp = parsearMovimiento(rawMovimiento, mapaReglas)
        const descTemp = parsedTemp["descripcion"] ?? rawMovimiento.substring(0, 100)
        const clave = `${descTemp}|${debitos}|${creditos}`
        if (movimientosUltimaFecha.has(clave)) continue
      }

      const saldo = idxSaldo >= 0 ? parseNumberCA(row[idxSaldo]) : 0
      const observacionesCliente =
        idxComentarios >= 0 ? cleanString(row[idxComentarios]) : ""

      // Parsear Movimiento con reglas de BD
      const parsed = parsearMovimiento(rawMovimiento, mapaReglas)

      const descripcion =
        parsed["descripcion"] || rawMovimiento.substring(0, 200)

      // Calcular control
      const control =
        saldo - (saldoAnterior + creditos - debitos) + controlAnterior

      if (Math.abs(control) > 0.5) {
        controlErrors.push({
          fila: index + 1,
          fecha,
          descripcion,
          control: control.toFixed(2),
        })
      }

      // Validar categoría (si viene en las reglas — normalmente vacía al import)
      let categ = parsed["categ"] ?? ""
      if (categ && !setCategs.has(categ)) {
        errores.push({
          fila: index + 1,
          descripcion,
          error: "Categoría inválida",
          categ,
        })
        categ = `INVALIDA:${categ}`
      }

      const filaInsert: any = {
        fecha,
        descripcion,
        debitos,
        creditos,
        saldo,
        control,
        grupo_de_conceptos: parsed["grupo_de_conceptos"] ?? "",
        concepto: rawMovimiento,                // texto raw completo
        tipo_de_movimiento: "",                  // CA no tiene campo equivalente
        leyendas_adicionales_1: parsed["leyendas_adicionales_1"] ?? "",
        leyendas_adicionales_2: parsed["leyendas_adicionales_2"] ?? "",
        leyendas_adicionales_3: parsed["leyendas_adicionales_3"] ?? "",
        leyendas_adicionales_4: parsed["leyendas_adicionales_4"] ?? "",
        numero_de_terminal: parsed["numero_de_terminal"] ?? "",
        numero_de_comprobante: parsed["numero_de_comprobante"] ?? "",
        observaciones_cliente: observacionesCliente,
        origen: "CA_GALICIA",
        cuenta: "PAM Galicia CA",
        categ: categ || null,
        detalle: null,       // se llena en conciliación
        contable: null,
        interno: null,
        centro_de_costo: null,
        orden: nextOrden,
        estado: "Pendiente",
      }

      rowsParaInsertar.push(filaInsert)

      saldoAnterior = saldo
      controlAnterior = control
      nextOrden++
    }

    // -----------------------------------------------------------------------
    // 6. Insertar
    // -----------------------------------------------------------------------
    if (rowsParaInsertar.length > 0) {
      const { error } = await supabase
        .from("pam_galicia")
        .insert(rowsParaInsertar)
      if (error) {
        console.error("Error insertando CA:", error)
        return NextResponse.json(
          { error: `Error al insertar: ${error.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message:
        rowsParaInsertar.length > 0
          ? `Importación completada. ${rowsParaInsertar.length} registros insertados.`
          : "No se encontraron registros nuevos para importar.",
      insertedCount: rowsParaInsertar.length,
      controlErrors,
      errores,
      summary: {
        totalFilas: filas.length,
        filasInsertadas: rowsParaInsertar.length,
        erroresControl: controlErrors.length,
        erroresCategoria: errores.length,
      },
    })
  } catch (error) {
    console.error("Error en import CA:", error)
    return NextResponse.json(
      {
        error: `Error interno: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
      },
      { status: 500 }
    )
  }
}
