import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as Papa from "papaparse"

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
 * Mapea una fila del CSV de ARCA a la estructura de la base de datos
 * Convierte los 17 campos del CSV a los campos de la tabla
 */
function mapearFilaCSVaBBDD(fila: any, nombreArchivo: string) {
  return {
    // Datos originales de ARCA (convertidos apropiadamente)
    fecha_emision: convertirFecha(fila["Fecha de Emisión"]),
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
    imp_total: convertirNumeroArgentino(fila["Imp. Total"]),
    
    // Campos adicionales con valores por defecto
    campana: null,
    fc: null,
    cuenta_contable: null,
    centro_costo: null,
    estado: 'pendiente',
    observaciones_pago: null,
    detalle: null,
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

    const filasCSV = resultadoParser.data as any[]
    console.log(`📊 Total de filas en CSV: ${filasCSV.length}`)

    // Determinar esquema de base de datos según empresa
    const esquema = empresa.toLowerCase()  // 'msa' o 'pam'
    const tabla = `${esquema}.comprobantes_arca`

    let filasImportadas = 0
    let filasIgnoradas = 0
    const errores: string[] = []

    // Procesar cada fila del CSV
    for (let indice = 0; indice < filasCSV.length; indice++) {
      const filaOriginal = filasCSV[indice]
      
      try {
        // Convertir fila del CSV al formato de la base de datos
        const filaParaBBDD = mapearFilaCSVaBBDD(filaOriginal, file.name)

        // Validar campos obligatorios
        if (!filaParaBBDD.fecha_emision || !filaParaBBDD.cuit || filaParaBBDD.imp_total === 0) {
          errores.push(`Fila ${indice + 2}: Faltan datos obligatorios (fecha, CUIT o importe)`)
          continue
        }

        // Verificar si la factura ya existe (anti-duplicados)
        const { data: facturaExistente } = await supabase
          .from(`${esquema}.comprobantes_arca`)
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
          .from(`${esquema}.comprobantes_arca`)
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