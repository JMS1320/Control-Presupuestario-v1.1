import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as Papa from "papaparse"
import * as XLSX from "xlsx"

// Cliente Supabase con permisos de administrador para insertar datos
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Convierte números en formato argentino a decimal estándar
 * Ejemplo: "15.528,69" → 15528.69
 * Ejemplo: "(1.234,56)" → -1234.56 (números negativos entre paréntesis)
 */
function convertirNumeroArgentino(valor: string): number {
  if (!valor || valor.trim() === '') return 0
  
  let textoLimpio = valor.toString().trim()
  
  // Detectar si es negativo (entre paréntesis)
  const esNegativo = textoLimpio.startsWith('(') && textoLimpio.endsWith(')')
  if (esNegativo) {
    textoLimpio = textoLimpio.slice(1, -1) // Quitar paréntesis
  }
  
  // Convertir formato argentino: punto = miles, coma = decimales
  textoLimpio = textoLimpio.replace(/\./g, '')  // Quitar puntos de miles
  textoLimpio = textoLimpio.replace(',', '.')   // Cambiar coma decimal a punto
  
  const numero = parseFloat(textoLimpio) || 0
  return esNegativo ? -numero : numero
}

/**
 * Convierte fechas del formato CSV a formato base de datos
 * Entrada: "2025-08-01" → Salida: "2025-08-01"
 */
function convertirFecha(valor: string): string | null {
  if (!valor || valor.trim() === '') return null
  
  try {
    // ARCA ya viene en formato YYYY-MM-DD, solo validamos que sea fecha válida
    const fecha = new Date(valor)
    if (isNaN(fecha.getTime())) return null
    
    return valor // Ya está en formato correcto
  } catch {
    return null
  }
}

/**
 * Calcula fecha estimada (fecha_emision + 15 días)
 */
function calcularFechaEstimada(fechaEmision: string | null): string | null {
  if (!fechaEmision) return null
  
  try {
    const fecha = new Date(fechaEmision)
    fecha.setDate(fecha.getDate() + 15)
    return fecha.toISOString().split('T')[0] // Formato YYYY-MM-DD
  } catch {
    return null
  }
}

/**
 * Mapea una fila del CSV de ARCA a la estructura de la base de datos
 * Convierte los 17 campos del CSV a los campos de la tabla
 */
function mapearFilaCSVaBBDD(fila: any, nombreArchivo: string) {
  const fechaEmision = convertirFecha(fila["Fecha de Emisión"])
  const impTotal = convertirNumeroArgentino(fila["Imp. Total"])
  
  return {
    // Datos originales de ARCA (convertidos apropiadamente)
    fecha_emision: fechaEmision,
    tipo_comprobante: parseInt(fila["Tipo de Comprobante"]) || 0,
    punto_venta: parseInt(fila["Punto de Venta"]) || null,
    numero_desde: parseInt(fila["Número Desde"]) || null,
    numero_hasta: parseInt(fila["Número Hasta"]) || null,
    codigo_autorizacion: fila["Cód. Autorización"]?.toString() || null,
    tipo_doc_emisor: parseInt(fila["Tipo Doc. Emisor"]) || null,
    cuit: fila["Nro. Doc. Emisor"]?.toString() || "",
    denominacion_emisor: fila["Denominación Emisor"]?.toString() || "",
    tipo_cambio: convertirNumeroArgentino(fila["Tipo Cambio"]),
    moneda: fila["Moneda"]?.toString() || "PES",
    imp_neto_gravado: convertirNumeroArgentino(fila["Imp. Neto Gravado"]),
    imp_neto_no_gravado: convertirNumeroArgentino(fila["Imp. Neto No Gravado"]),
    imp_op_exentas: convertirNumeroArgentino(fila["Imp. Op. Exentas"]),
    otros_tributos: convertirNumeroArgentino(fila["Otros Tributos"]),
    iva: convertirNumeroArgentino(fila["IVA"]),
    imp_total: impTotal,
    
    // Campos calculados automáticamente para Cash Flow
    fecha_estimada: calcularFechaEstimada(fechaEmision),
    monto_a_abonar: impTotal, // Inicialmente igual al importe total
    
    // Campos adicionales con valores por defecto
    campana: null,
    fc: null,
    cuenta_contable: null,
    centro_costo: null,
    estado: 'pendiente',
    observaciones_pago: null,
    detalle: `Factura ${fila["Tipo de Comprobante"]}-${fila["Número Desde"]} - ${fila["Denominación Emisor"] || 'Sin nombre'}`,
    archivo_origen: nombreArchivo
  }
}

/**
 * Endpoint principal para importar facturas de ARCA
 * POST /api/import-facturas-arca
 */
export async function POST(req: Request) {
  try {
    // Obtener datos del formulario enviado desde la pantalla
    const formData = await req.formData()
    const file = formData.get("file") as File
    const empresa = formData.get("empresa") as string  // 'MSA' o 'PAM'

    // Validaciones básicas
    if (!file) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 })
    }

    if (!empresa || !['MSA', 'PAM'].includes(empresa)) {
      return NextResponse.json({ error: "Empresa no válida" }, { status: 400 })
    }

    console.log(`🏢 Iniciando importación de facturas para empresa: ${empresa}`)
    console.log(`📄 Archivo: ${file.name}`)
    console.log(`🚀 VERSIÓN CÓDIGO: EXCEL-SUPPORT-v1.0 - ${new Date().toISOString()}`)

    // Detectar formato del archivo
    const esExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    const esCsv = file.name.endsWith('.csv')
    
    let filasCSV: any[]
    
    if (esExcel) {
      console.log("📊 Procesando archivo Excel...")
      
      // Leer archivo Excel
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0] // Primera hoja
      const worksheet = workbook.Sheets[sheetName]
      
      // Convertir hoja a array, empezando desde fila 2 (fila 1 es info que ignoramos)
      const rawData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,        // Array de arrays
        range: 1          // Empezar desde fila 2 (índice 1)
      }) as any[][]
      
      if (rawData.length < 2) {
        return NextResponse.json({ 
          error: "El archivo Excel debe tener al menos 2 filas (headers y datos)" 
        }, { status: 400 })
      }
      
      // Primera fila (índice 0) son los headers
      const headers = rawData[0].map((h: any) => h?.toString().trim() || '')
      
      // Resto son datos - convertir a objetos
      filasCSV = rawData.slice(1).map(row => {
        const obj: any = {}
        headers.forEach((header: string, index: number) => {
          obj[header] = row[index] ?? ''
        })
        return obj
      })
      
      console.log(`📊 Headers detectados en Excel:`, headers)
      console.log(`📊 Total filas de datos: ${filasCSV.length}`)
      console.log(`🔍 SAMPLE: Primera fila de datos:`, filasCSV[0])
      
    } else if (esCsv) {
      console.log("📄 Procesando archivo CSV...")
      
      // Leer contenido del archivo CSV
      const contenidoArchivo = await file.text()
      
      // Parsear CSV con configuración para formato argentino (separador punto y coma)
      const resultadoParser = Papa.parse(contenidoArchivo, {
        header: true,           // Primera fila son los headers
        delimiter: ";",         // ARCA usa punto y coma como separador
        skipEmptyLines: true    // Ignorar filas vacías
      })

      if (resultadoParser.errors.length > 0) {
        console.error("❌ Errores al parsear CSV:", resultadoParser.errors)
        return NextResponse.json({ 
          error: "Error al procesar el archivo CSV" 
        }, { status: 400 })
      }

      filasCSV = resultadoParser.data as any[]
      console.log(`📊 Total de filas en CSV: ${filasCSV.length}`)
      
    } else {
      return NextResponse.json({ 
        error: "Formato de archivo no soportado. Use .xlsx, .xls o .csv" 
      }, { status: 400 })
    }

    // Determinar esquema de base de datos según empresa
    const esquema = empresa.toLowerCase()  // 'msa' o 'pam'
    const tabla = `${esquema}.comprobantes_arca`

    // 🔍 TEST DE CONEXIÓN - Verificar que podemos acceder a la tabla
    console.log(`🔍 Probando conexión a esquema: ${esquema}`)
    try {
      const { data: testData, error: testError } = await supabase
        .schema(esquema)
        .from('comprobantes_arca')
        .select('id')
        .limit(1)
      
      console.log(`✅ Test conexión resultado:`, { testData, testError })
      
      if (testError) {
        console.error(`❌ FALLO TEST DE CONEXIÓN:`, testError)
        return NextResponse.json({ 
          error: `No se puede conectar a la tabla ${esquema}.comprobantes_arca: ${testError.message}` 
        }, { status: 500 })
      }
      
      console.log(`✅ Conexión exitosa a ${esquema}.comprobantes_arca`)
      
    } catch (error) {
      console.error(`❌ ERROR CRÍTICO EN TEST:`, error)
      return NextResponse.json({ 
        error: `Error crítico de conexión: ${error}` 
      }, { status: 500 })
    }

    let filasImportadas = 0
    let filasIgnoradas = 0
    const errores: string[] = []

    // Procesar cada fila del CSV
    for (let indice = 0; indice < filasCSV.length; indice++) {
      const filaOriginal = filasCSV[indice]
      
      try {
        // Debug: Mostrar claves disponibles en la fila
        if (indice < 3) { // Solo las primeras 3 filas para no saturar logs
          console.log(`🔍 FILA ${indice + 2} - Claves disponibles:`, Object.keys(filaOriginal))
          console.log(`🔍 FILA ${indice + 2} - Datos:`, filaOriginal)
        }
        
        // Convertir fila del CSV al formato de la base de datos
        const filaParaBBDD = mapearFilaCSVaBBDD(filaOriginal, file.name)

        // Debug: Mostrar resultado del mapeo
        if (indice < 3) {
          console.log(`🔍 FILA ${indice + 2} - Resultado mapeo:`, {
            fecha_emision: filaParaBBDD.fecha_emision,
            cuit: filaParaBBDD.cuit,
            imp_total: filaParaBBDD.imp_total,
            denominacion_emisor: filaParaBBDD.denominacion_emisor
          })
        }

        // Validar campos obligatorios
        if (!filaParaBBDD.fecha_emision || !filaParaBBDD.cuit || filaParaBBDD.imp_total === 0) {
          errores.push(`Fila ${indice + 2}: Faltan datos obligatorios (fecha: ${filaParaBBDD.fecha_emision}, CUIT: ${filaParaBBDD.cuit}, importe: ${filaParaBBDD.imp_total})`)
          continue
        }

        // Verificar si la factura ya existe (anti-duplicados)
        const { data: facturaExistente } = await supabase
          .schema(esquema)
          .from('comprobantes_arca')
          .select('id')
          .eq('tipo_comprobante', filaParaBBDD.tipo_comprobante)
          .eq('punto_venta', filaParaBBDD.punto_venta)
          .eq('numero_desde', filaParaBBDD.numero_desde)
          .eq('cuit', filaParaBBDD.cuit)
          .maybeSingle()

        if (facturaExistente) {
          // Factura ya existe, la ignoramos
          filasIgnoradas++
          continue
        }

        // Debug: Mostrar datos antes de insertar
        console.log(`🔍 Intentando insertar fila ${indice + 2}:`, JSON.stringify(filaParaBBDD, null, 2))
        console.log(`📊 Esquema usado: ${esquema}`)
        
        // Insertar nueva factura
        const { data, error: errorInsercion } = await supabase
          .schema(esquema)
          .from('comprobantes_arca')
          .insert(filaParaBBDD)
          .select()

        console.log(`📤 Resultado inserción fila ${indice + 2}:`, { data, error: errorInsercion })

        if (errorInsercion) {
          const errorCompleto = {
            message: errorInsercion.message,
            details: errorInsercion.details,
            hint: errorInsercion.hint,
            code: errorInsercion.code
          }
          console.error(`❌ Error COMPLETO fila ${indice + 2}:`, errorCompleto)
          errores.push(`Fila ${indice + 2}: ${errorInsercion.message || errorInsercion.details || errorInsercion.code || 'Error desconocido'}`)
        } else {
          console.log(`✅ Fila ${indice + 2} insertada correctamente:`, data)
          filasImportadas++
        }

      } catch (error) {
        console.error(`❌ Error procesando fila ${indice + 2}:`, error)
        errores.push(`Fila ${indice + 2}: Error inesperado`)
      }
    }

    // Preparar respuesta con resumen de la importación
    const mensaje = `✅ Importación completada: ${filasImportadas} facturas nuevas importadas, ${filasIgnoradas} ya existían`
    
    console.log(`📈 Resultado: ${filasImportadas} importadas, ${filasIgnoradas} ignoradas, ${errores.length} errores`)

    return NextResponse.json({
      success: filasImportadas > 0, // Solo success si importó al menos 1
      message: mensaje,
      insertedCount: filasImportadas,
      ignoredCount: filasIgnoradas,
      errores: errores,
      summary: {
        totalFilas: filasCSV.length,
        filasImportadas: filasImportadas,
        filasIgnoradas: filasIgnoradas,
        erroresCount: errores.length
      }
    })

  } catch (error) {
    console.error("❌ Error general en importación:", error)
    return NextResponse.json({ 
      error: "Error interno del servidor durante la importación" 
    }, { status: 500 })
  }
}