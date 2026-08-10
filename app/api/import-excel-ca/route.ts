import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"
import {
  parsearMovimiento,
  cargarReglasParseo,
  type MapaReglas,
} from "@/lib/extractos/parseo-movimiento"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers numéricos y de fecha (formato CA Galicia)
// ---------------------------------------------------------------------------

/**
 * Parsea número CA Galicia: punto = miles, coma = decimal, signo negativo posible.
 * Devuelve el valor con su signo original (débitos vienen negativos).
 */
function parseNumberCA(value: any): number {
  if (value === null || value === undefined || value === "") return 0

  // Si Excel ya lo entregó como NÚMERO, viene listo: no hay separadores que interpretar.
  // ⚠️ Sin esta rama, un valor tipeado a mano se destruía: el `.replace(/\./g, "")` de abajo
  // asume que todo punto es separador de miles, así que 3.86 → "386" y 214140.6 → "2141406".
  // El texto del banco ("3,86") no tiene ese problema porque usa coma decimal.
  if (typeof value === "number") return isFinite(value) ? value : 0

  const s = String(value)
    .trim()
    .replace(/\./g, "")   // eliminar separador de miles
    .replace(",", ".")    // coma → punto decimal
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

/**
 * Parsea la fecha de una celda → YYYY-MM-DD.
 *
 * El banco escribe las fechas como TEXTO (`"25/03/2026"`), pero una fila agregada a mano queda
 * como **fecha de Excel**, que en el archivo es un número de serie (25/03/2026 → 46106). Y eso
 * hay que soportarlo sí o sí: Galicia no deja descargar movimientos viejos, así que completar
 * un hueco a mano es parte del uso normal.
 *
 * ⚠️ Sin la rama numérica, `new Date("46106")` devolvía **el año 46106** (`"+046106-01-01"`), que
 * al compararse como texto contra la última fecha cargada resultaba "más viejo" (el `+` ordena
 * antes que cualquier dígito) y **la fila se descartaba en silencio**. El síntoma no era ése:
 * eran 15 filas con un descuadre de saldo heredado de la fila que faltaba.
 */
function parseDateCA(value: any): string | null {
  if (value === null || value === undefined || value === "") return null

  // Fecha de Excel: número de serie de días desde 1899-12-30 (25569 = ese origen en epoch Unix)
  if (typeof value === "number") {
    if (!isFinite(value) || value <= 0) return null
    const date = new Date(Math.round((value - 25569) * 86400 * 1000))
    return isNaN(date.getTime()) ? null : date.toISOString().split("T")[0]
  }

  // Según cómo se lea el archivo, la celda puede llegar ya como Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString().split("T")[0]
  }

  const s = String(value).trim()
  if (!s) return null

  // Formato DD/MM/YYYY — el que usa el banco
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    const date = new Date(`${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00`)
    if (!isNaN(date.getTime())) return date.toISOString().split("T")[0]
  }

  // Un número escrito como texto ("46106") también es una fecha de Excel
  if (/^\d+(\.\d+)?$/.test(s)) return parseDateCA(Number(s))

  // Fallback: dejar que Date lo intente, pero SÓLO si da un año creíble.
  // Sin este cerco volvería el bug: `new Date("46106")` da el año 46106 y pasa como válido.
  try {
    const date = new Date(s)
    if (!isNaN(date.getTime())) {
      const anio = date.getFullYear()
      if (anio >= 1990 && anio <= 2100) return date.toISOString().split("T")[0]
    }
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

// El desglose del texto del banco vive en `lib/extractos/parseo-movimiento.ts`, compartido con
// el re-parseo. Ver el comentario de ese archivo: si fueran dos copias podrían divergir y un
// movimiento quedaría distinto según por dónde entró.

// ---------------------------------------------------------------------------
// Endpoint POST
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    const saldoInicialInput = formData.get("saldo_inicial")
    const saldoInicial = saldoInicialInput ? parseNumberCA(saldoInicialInput) : 0
    const cuentaBancariaId = (formData.get("tabla") as string | null)?.trim() || "pam_galicia"
    const forzar = (formData.get("forzar") as string | null) === "true"  // importar aunque el control no cuadre

    const TABLAS_CA_PERMITIDAS = ["pam_galicia", "ma_galicia"]
    if (!TABLAS_CA_PERMITIDAS.includes(cuentaBancariaId)) {
      return NextResponse.json({ error: `Tabla no permitida: ${cuentaBancariaId}` }, { status: 400 })
    }

    // Schema según tabla
    const schemaCA = cuentaBancariaId === "ma_galicia" ? "ma" : "public"

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

    // Datos: filas posteriores a cabeceras.
    // CA Galicia viene newest→oldest en el archivo, igual que MSA CC.
    // Invertir para procesar oldest→newest (igual que MSA CC).
    const filas = allRows.slice(headerRowIndex + 1).filter(
      (row) => row.some((cell: any) => cell !== "" && cell !== null)
    ).reverse()

    console.log(`CA Import: archivo=${file.name}, filas=${filas.length}`)
    console.log(`CA Import: cabeceras detectadas:`, headers)

    // -----------------------------------------------------------------------
    // 2. Cargar reglas de parseo
    // -----------------------------------------------------------------------
    const mapaReglas = await cargarReglasParseo(supabase, cuentaBancariaId)
    console.log(`CA Import: reglas cargadas:`, Object.keys(mapaReglas).length, "tipos")

    // -----------------------------------------------------------------------
    // 3. Estado actual de la tabla destino
    // -----------------------------------------------------------------------
    const clientCA = schemaCA !== "public" ? supabase.schema(schemaCA) : supabase

    const { data: ultimaFila } = await clientCA
      .from(cuentaBancariaId)
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
      const { data: existentes } = await clientCA
        .from(cuentaBancariaId)
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

    /**
     * Filas que el importador NO procesa, con el motivo.
     *
     * Antes se salteaban en silencio, y eso hizo casi imposible diagnosticar un caso real: una
     * fila con fecha ilegible se descartó sin decir nada, y el síntoma fueron **15 filas con un
     * descuadre de saldo** que no tenían nada malo — arrastraban el de la que faltaba.
     * Una fila que no entra tiene que decirlo.
     */
    const descartadas: { fila: number; fecha: string; movimiento: string; motivo: string }[] = []
    const descartar = (index: number, fechaTxt: string, row: any[], motivo: string) => {
      descartadas.push({
        fila: index + 1,
        fecha: fechaTxt,
        movimiento: cleanString(row[idxMovimiento]).split(/\r?\n/)[0].slice(0, 60),
        motivo,
      })
    }

    console.log(`CA Import: hoy=${hoy}, ultimaFecha=${ultimaFecha}, saldoAnterior=${saldoAnterior}`)

    for (const [index, row] of filas.entries()) {
      const fecha = parseDateCA(row[idxFecha])
      if (!fecha) {
        descartar(index, String(row[idxFecha] ?? ""), row, "fecha ilegible")
        continue
      }

      // Filtros de fecha
      if (fecha >= hoy) {
        descartar(index, fecha, row, "fecha de hoy o futura")
        continue
      }
      if (ultimaFecha && fecha < ultimaFecha) {
        descartar(index, fecha, row, `anterior al último cargado (${ultimaFecha})`)
        continue
      }

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
        if (movimientosUltimaFecha.has(clave)) {
          descartar(index, fecha, row, "ya estaba cargado (duplicado del mismo día)")
          continue
        }
      }

      // CA Galicia: saldo = post-transacción (igual que MSA CC).
      const saldo = idxSaldo >= 0 ? parseNumberCA(row[idxSaldo]) : 0
      const observacionesCliente =
        idxComentarios >= 0 ? cleanString(row[idxComentarios]) : ""

      // Parsear Movimiento con reglas de BD
      const parsed = parsearMovimiento(rawMovimiento, mapaReglas)

      const descripcion =
        parsed["descripcion"] || rawMovimiento.substring(0, 200)

      // Control: saldo reportado debe coincidir con saldoAnterior + neto.
      // `control` ARRASTRA el desfase anterior (por eso suma `controlAnterior`): así el saldo
      // final sigue cerrando aunque una fila del medio esté mal. Pero para el mensaje hay que
      // distinguir las dos cosas — si no, UN error se ve como quince y se busca en el lugar
      // equivocado. `propio` es el descuadre que nace en ESTA fila.
      const propio = saldo - (saldoAnterior + creditos - debitos)
      const control = propio + controlAnterior

      if (Math.abs(control) > 0.5) {
        controlErrors.push({
          fila: index + 1,
          fecha,
          descripcion,
          control: control.toFixed(2),
          propio: propio.toFixed(2),
          // La fila donde nace el problema es la que tiene descuadre propio; el resto lo hereda
          origen: Math.abs(propio) > 0.5,
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
        // ⚠️ Guarda el CBU, no el tipo. En Caja de Ahorro esta columna no tiene uso propio
        // (en cuenta corriente el banco manda siempre "Imputado") y es la única sin dueño de las
        // 37 de la tabla, así que se acordó destinarla al CBU — ver `ARQUITECTURA-BD.md` § 6b.
        tipo_de_movimiento: parsed["tipo_de_movimiento"] ?? "",
        leyendas_adicionales_1: parsed["leyendas_adicionales_1"] ?? "",
        leyendas_adicionales_2: parsed["leyendas_adicionales_2"] ?? "",
        leyendas_adicionales_3: parsed["leyendas_adicionales_3"] ?? "",
        leyendas_adicionales_4: parsed["leyendas_adicionales_4"] ?? "",
        numero_de_terminal: parsed["numero_de_terminal"] ?? "",
        numero_de_comprobante: parsed["numero_de_comprobante"] ?? "",
        observaciones_cliente: observacionesCliente,
        origen: "CA_GALICIA",
        cuenta: cuentaBancariaId,
        categ: categ || null,
        detalle: null,       // se llena en conciliación
        contable: null,
        interno: null,
        centro_de_costo: null,
        orden: nextOrden,
        estado: "pendiente",
      }

      rowsParaInsertar.push(filaInsert)

      saldoAnterior = saldo
      controlAnterior = control
      nextOrden++
    }

    // -----------------------------------------------------------------------
    // 6. Insertar — pero NO si el control de saldos falla (salvo que se fuerce)
    // -----------------------------------------------------------------------
    // Cuántos descuadres NACEN acá y cuántos sólo lo heredan — es la diferencia entre
    // "revisá 15 filas" y "revisá la fila 7".
    const erroresPropios = controlErrors.filter((e: any) => e.origen)
    const textoDescartadas = descartadas.length > 0
      ? ` Además se descartaron ${descartadas.length} fila(s): ${[...new Set(descartadas.map(d => d.motivo))].join(", ")}.`
      : ""

    if (controlErrors.length > 0 && !forzar) {
      const dondeEmpieza = erroresPropios.length > 0
        ? `El descuadre nace en ${erroresPropios.length === 1 ? "la fila" : "las filas"} `
          + erroresPropios.map((e: any) => `${e.fila} (${e.fecha}, ${e.propio})`).join(", ")
          + `; el resto lo arrastra.`
        : `Ninguna fila tiene descuadre propio: el desfase viene de ANTES del archivo — del saldo inicial, de lo ya cargado, o de una fila descartada.`
      return NextResponse.json({
        success: false,
        message: `Control de saldos NO cuadra en ${controlErrors.length} fila(s). ${dondeEmpieza}`
          + ` NO se importó nada — revisá el saldo inicial o el archivo (o tildá "Forzar" para importar igual).`
          + textoDescartadas,
        insertedCount: 0,
        controlErrors,
        erroresPropios,
        descartadas,
        errores,
        summary: {
          totalFilas: filas.length,
          filasInsertadas: 0,
          erroresControl: controlErrors.length,
          erroresControlPropios: erroresPropios.length,
          filasDescartadas: descartadas.length,
          erroresCategoria: errores.length,
        },
      })
    }

    if (rowsParaInsertar.length > 0) {
      const { error } = await clientCA
        .from(cuentaBancariaId)
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
        (rowsParaInsertar.length > 0
          ? `Importación completada. ${rowsParaInsertar.length} registros insertados.`
          : "No se encontraron registros nuevos para importar.") + textoDescartadas,
      insertedCount: rowsParaInsertar.length,
      controlErrors,
      erroresPropios,
      descartadas,
      errores,
      summary: {
        totalFilas: filas.length,
        filasInsertadas: rowsParaInsertar.length,
        erroresControl: controlErrors.length,
        erroresControlPropios: erroresPropios.length,
        filasDescartadas: descartadas.length,
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
