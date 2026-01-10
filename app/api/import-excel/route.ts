import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function parseNumber(value: any): number {
  if (typeof value === "string") {
    value = value.replace(/\./g, "").replace(",", ".")
    if (/^$$.*$$$/.test(value)) {
      value = "-" + value.replace(/[()]/g, "")
    }
  }
  const num = Number.parseFloat(value)
  return isNaN(num) ? 0 : num
}

function parseDate(value: any): string | null {
  if (!value) return null

  try {
    let date: Date

    if (typeof value === "number") {
      // Excel almacena fechas como números (días desde 1900-01-01)
      date = new Date((value - 25569) * 86400 * 1000)
    } else if (typeof value === "string") {
      date = new Date(value)
    } else if (value instanceof Date) {
      date = value
    } else {
      return null
    }

    if (isNaN(date.getTime())) return null

    // Formato YYYY-MM-DD para Supabase
    return date.toISOString().split("T")[0]
  } catch {
    return null
  }
}

// Mapeo exacto de columnas del Excel → campos Supabase
const mapeoCampos = {
  Fecha: "fecha",
  Descripción: "descripcion",
  Origen: "origen",
  Débitos: "debitos",
  Créditos: "creditos",
  "Grupo de Conceptos": "grupo_de_conceptos",
  Concepto: "concepto",
  "Número de Terminal": "numero_de_terminal",
  "Observaciones Cliente": "observaciones_cliente",
  "Número de Comprobante": "numero_de_comprobante",
  "Leyendas Adicionales 1": "leyendas_adicionales_1",
  "Leyendas Adicionales 2": "leyendas_adicionales_2",
  "Leyendas Adicionales 3": "leyendas_adicionales_3",
  "Leyendas Adicionales 4": "leyendas_adicionales_4",
  "Tipo de Movimiento": "tipo_de_movimiento",
  Saldo: "saldo",
  Control: "control",
  CATEG: "categ",
  Detalle: "detalle",
  Contable: "contable",
  Interno: "interno",
  "Centro de Costo": "centro_de_costo",
  Cuenta: "cuenta",
  Orden: "orden",
}

function cleanString(value: any): string {
  if (typeof value === "string") {
    return value.trim()
  }
  return value ? String(value).trim() : ""
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    const saldoInicialInput = formData.get("saldo_inicial")
    const saldoInicial = saldoInicialInput ? parseNumber(saldoInicialInput) : 0

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    // Leer y normalizar cabeceras del Excel
    const rawData = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      header: 1,
    })

    const [rawHeaders, ...rawRows] = rawData

    // Limpiar cabeceras (quita espacios invisibles y normaliza nombres)
    const headers = rawHeaders.map((h: any) => h?.toString().trim())

    // Reconstruir cada fila como objeto con claves limpias
    const data = rawRows.map((row: any[]) => {
      const obj: any = {}
      headers.forEach((key: string, idx: number) => {
        obj[key] = row[idx]
      })
      return obj
    })

    console.log("Cabeceras detectadas en el Excel:", Object.keys(data[0]))

    // Procesar en orden cronológico (más viejo primero)
    const filas = data

    // Traer última fila existente
    const { data: ultimaFila } = await supabase
      .from("msa_galicia")
      .select("fecha, saldo, orden, control")
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle()

    const ultimaFecha = ultimaFila?.fecha ?? null
    let saldoAnterior = ultimaFila?.saldo ?? saldoInicial
    let nextOrden = ultimaFila?.orden ? Number(ultimaFila.orden) + 1 : 1
    let controlAnterior = ultimaFila?.control ?? 0

    // Obtener todas las categorías válidas
    const { data: categsValidas } = await supabase.from("cuentas_contables").select("categ")
    const setCategs = new Set(categsValidas?.map((c: any) => c.categ))

    const hoy = new Date().toISOString().split("T")[0]
    const errores: any[] = []
    const rowsParaInsertar: any[] = []
    const controlErrors: any[] = []

    // Debug en consola para trazabilidad
    console.log("→ Hoy:", hoy)
    console.log("→ Última fecha existente en Supabase:", ultimaFecha)
    console.log("→ Saldo anterior:", saldoAnterior)
    console.log("→ Total filas en Excel:", filas.length)

    for (const [index, fila] of filas.entries()) {
      // Parsear fecha usando la función mejorada
      const fecha = parseDate(fila["Fecha"])

      if (!fecha) continue

      // Validación de fecha mejorada
      const fechaNormalizada = new Date(fecha).toISOString().split("T")[0]

      // Validar que la fecha sea válida y cumpla con las reglas de negocio
      if (
        !fechaNormalizada ||
        fechaNormalizada === hoy ||
        fechaNormalizada > hoy ||
        (ultimaFecha && fechaNormalizada <= ultimaFecha)
      ) {
        continue
      }

      console.log(`Procesando fila ${index + 1} - fecha: ${fechaNormalizada}`)

      const debitos = parseNumber(fila["Débitos"])
      const creditos = parseNumber(fila["Créditos"])
      const saldo = parseNumber(fila["Saldo"])
      let categ = cleanString(fila["CATEG"])

      // Validar categoría
      if (!categ || !setCategs.has(categ)) {
        errores.push({
          fila: index + 1,
          descripcion: cleanString(fila["Descripción"]),
          error: "Categoría inválida o vacía",
          categ,
        })
        categ = `INVALIDA:${categ}`
      }

      // Calcular control
      const control = saldo - (saldoAnterior + creditos - debitos) + controlAnterior

      // Verificar errores de control
      if (Math.abs(control) > 0.01) {
        // Tolerancia para errores de redondeo
        controlErrors.push({
          fila: index + 1,
          fecha,
          descripcion: cleanString(fila["Descripción"]),
          control: control.toFixed(2),
        })
      }

      // Crear objeto con los nombres correctos de columnas
      const filaInsert: any = {
        fecha,
        descripcion: cleanString(fila["Descripción"]),
        origen: cleanString(fila["Origen"]),
        debitos,
        creditos,
        saldo,
        grupo_de_conceptos: cleanString(fila["Grupo de Conceptos"]),
        concepto: cleanString(fila["Concepto"]),
        numero_de_terminal: cleanString(fila["Número de Terminal"]),
        observaciones_cliente: cleanString(fila["Observaciones Cliente"]),
        numero_de_comprobante: cleanString(fila["Número de Comprobante"]),
        leyendas_adicionales_1: cleanString(fila["Leyendas Adicionales 1"]),
        leyendas_adicionales_2: cleanString(fila["Leyendas Adicionales 2"]),
        leyendas_adicionales_3: cleanString(fila["Leyendas Adicionales 3"]),
        leyendas_adicionales_4: cleanString(fila["Leyendas Adicionales 4"]),
        tipo_de_movimiento: cleanString(fila["Tipo de Movimiento"]),
        control,
        categ,
        detalle: cleanString(fila["Detalle"]),
        contable: cleanString(fila["Contable"]),
        interno: cleanString(fila["Interno"]),
        centro_de_costo: cleanString(fila["Centro de Costo"]),
        cuenta: cleanString(fila["Cuenta"]) || "MSA Galicia",
        orden: nextOrden,
        estado: "Pendiente", // Todos los movimientos importados inician como pendientes
      }

      rowsParaInsertar.push(filaInsert)

      // Actualizar variables para la siguiente iteración
      saldoAnterior = saldo
      controlAnterior = control
      nextOrden++
    }

    // Insertar datos si hay filas válidas
    if (rowsParaInsertar.length > 0) {
      const { error } = await supabase.from("msa_galicia").insert(rowsParaInsertar)
      if (error) {
        console.error("Error al insertar datos:", error)
        return NextResponse.json(
          {
            error: `Error al insertar datos: ${error.message}`,
          },
          { status: 500 },
        )
      }
    }

    // Respuesta exitosa con detalles
    return NextResponse.json({
      success: true,
      message:
        rowsParaInsertar.length > 0
          ? `Importación completada exitosamente. ${rowsParaInsertar.length} registros insertados.`
          : "No se encontraron registros válidos para importar.",
      insertedCount: rowsParaInsertar.length,
      controlErrors,
      errores,
      summary: {
        totalFilas: filas.length,
        filasInsertadas: rowsParaInsertar.length,
        erroresCategoria: errores.length,
        erroresControl: controlErrors.length,
      },
    })
  } catch (error) {
    console.error("Error en importación:", error)
    return NextResponse.json(
      {
        error: `Error interno del servidor: ${error instanceof Error ? error.message : "Error desconocido"}`,
      },
      { status: 500 },
    )
  }
}
