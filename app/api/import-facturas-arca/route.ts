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
 * SOPORTA: string, number, undefined, null
 */
function convertirNumeroArgentino(valor: string | number | null | undefined): number {
  // Manejar valores vacíos/nulos
  if (valor === null || valor === undefined || valor === '') return 0
  
  // Si ya es número, devolverlo directamente
  if (typeof valor === 'number') return valor
  
  // Si es string, procesarlo
  if (typeof valor !== 'string') return 0
  
  // String vacío después de trim
  if (valor.trim() === '') return 0
  
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
 * Convierte fechas del formato CSV/Excel a formato base de datos
 * Entrada: "2025-08-01" | 45870 (Excel serial) | "11/8/2025" → Salida: "2025-08-11"
 */
function convertirFecha(valor: string | number | null | undefined): string | null {
  if (!valor) return null
  
  // Si es número (formato Excel serial date)
  if (typeof valor === 'number') {
    try {
      // Excel usa 1900-01-01 como día 1 (con bug de año bisiesto)
      // Usar UTC para evitar problemas de zona horaria
      const fecha = new Date(Date.UTC(1899, 11, 30) + valor * 86400 * 1000)
      if (isNaN(fecha.getTime())) return null
      
      const año = fecha.getUTCFullYear()
      const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0')
      const dia = String(fecha.getUTCDate()).padStart(2, '0')
      
      return `${año}-${mes}-${dia}`
    } catch {
      return null
    }
  }
  
  // Si es string
  if (typeof valor !== 'string' || valor.trim() === '') return null
  
  const valorLimpio = valor.trim()
  
  try {
    // Si ya está en formato YYYY-MM-DD, validar y devolver
    if (/^\d{4}-\d{2}-\d{2}$/.test(valorLimpio)) {
      const fecha = new Date(valorLimpio)
      if (isNaN(fecha.getTime())) return null
      return valorLimpio
    }
    
    // Si está en formato DD/MM/YYYY o D/M/YYYY (formato argentino Excel)
    const matchArgentino = valorLimpio.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (matchArgentino) {
      const [, dia, mes, año] = matchArgentino
      const diaFormatted = dia.padStart(2, '0')
      const mesFormatted = mes.padStart(2, '0')
      
      // Validar que sea fecha válida
      const fecha = new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia))
      if (fecha.getFullYear() !== parseInt(año) || 
          fecha.getMonth() !== parseInt(mes) - 1 || 
          fecha.getDate() !== parseInt(dia)) {
        return null
      }
      
      return `${año}-${mesFormatted}-${diaFormatted}`
    }
    
    return null
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
 * Busca regla de asignación automática por CUIT
 * Si existe regla, devuelve cuenta_contable y estado a asignar
 */
async function buscarReglaCuit(cuit: string): Promise<{cuenta_contable: string | null, estado: string}> {
  try {
    const { data, error } = await supabase
      .from('reglas_ctas_import_arca')
      .select('cuenta_contable, estado')
      .eq('cuit', cuit)
      .eq('activo', true)
      .single()

    if (error || !data) {
      // No hay regla para este CUIT - usar valores por defecto
      return { cuenta_contable: null, estado: 'pendiente' }
    }

    console.log(`📋 Regla encontrada para CUIT ${cuit}: cuenta=${data.cuenta_contable}, estado=${data.estado}`)
    return data
  } catch (err) {
    console.error(`❌ Error buscando regla CUIT ${cuit}:`, err)
    return { cuenta_contable: null, estado: 'pendiente' }
  }
}

/**
 * Obtiene información del tipo de comprobante desde la tabla AFIP
 */
async function obtenerTipoComprobante(codigo: number): Promise<{descripcion: string, es_nota_credito: boolean}> {
  try {
    const { data, error } = await supabase
      .from('tipos_comprobante_afip')
      .select('descripcion, es_nota_credito')
      .eq('codigo', codigo)
      .single()
    
    if (error) {
      console.warn(`⚠️ Tipo comprobante ${codigo} no encontrado en BD:`, error.message)
      return { descripcion: `Código ${codigo}`, es_nota_credito: false }
    }
    
    return data
  } catch (err) {
    console.error(`❌ Error consultando tipo comprobante ${codigo}:`, err)
    return { descripcion: `Código ${codigo}`, es_nota_credito: false }
  }
}

/**
 * Mapea una fila del CSV/Excel de ARCA a la estructura de la base de datos
 * SOPORTE DUAL: Formato CSV anterior + Excel nuevo AFIP 2025
 */
async function mapearFilaCSVaBBDD(fila: any, nombreArchivo: string) {
  // Detectar formato: Excel nuevo (tiene "Fecha" + "Tipo") vs CSV anterior ("Fecha de Emisión")
  const esFormatoExcel = 'Fecha' in fila && 'Tipo' in fila && !('Fecha de Emisión' in fila)
  
  console.log(`🔍 Formato detectado: ${esFormatoExcel ? 'EXCEL NUEVO' : 'CSV ANTERIOR'}`)
  
  // Mapeo de campos comunes según formato
  const fechaEmision = convertirFecha(
    esFormatoExcel ? fila["Fecha"] : fila["Fecha de Emisión"]
  )
  
  // Obtener tipo de comprobante y su información
  const tipoComprobanteNumero = parseInt(
    esFormatoExcel ? fila["Tipo"] : fila["Tipo de Comprobante"]
  ) || 0
  
  const tipoInfo = await obtenerTipoComprobante(tipoComprobanteNumero)
  
  console.log(`📝 Tipo ${tipoComprobanteNumero}: ${tipoInfo.descripcion} ${tipoInfo.es_nota_credito ? '(NEGATIVO)' : '(POSITIVO)'}`)

  // Mapeo campos básicos (comunes a ambos formatos)
  const datosBasicos = {
    fecha_emision: fechaEmision,
    tipo_comprobante: tipoComprobanteNumero,
    tipo_comprobante_desc: tipoInfo.descripcion,
    punto_venta: parseInt(fila["Punto de Venta"]) || null,
    numero_desde: parseInt(fila["Número Desde"]) || null,
    numero_hasta: parseInt(fila["Número Hasta"]) || null,
    codigo_autorizacion: fila["Cód. Autorización"] ? fila["Cód. Autorización"].toString() : null,
    tipo_doc_emisor: parseInt(fila["Tipo Doc. Emisor"]) || null,
    cuit: fila["Nro. Doc. Emisor"] ? fila["Nro. Doc. Emisor"].toString() : "",
    denominacion_emisor: fila["Denominación Emisor"] ? fila["Denominación Emisor"].toString() : "",
    tipo_cambio: convertirNumeroArgentino(fila["Tipo Cambio"]) || 1,
    moneda: fila["Moneda"] ? fila["Moneda"].toString() : "PES"
  }
  
  // Mapeo campos IVA según formato
  let camposIVA: any
  
  if (esFormatoExcel) {
    // FORMATO EXCEL NUEVO - Desglose detallado por alícuota
    camposIVA = {
      // Campos existentes (calculados como totales)
      imp_neto_gravado: convertirNumeroArgentino(fila["Neto Gravado Total"]),
      imp_neto_no_gravado: convertirNumeroArgentino(fila["Neto No Gravado"]),
      imp_op_exentas: convertirNumeroArgentino(fila["Op. Exentas"]),
      otros_tributos: convertirNumeroArgentino(fila["Otros Tributos"]),
      iva: convertirNumeroArgentino(fila["Total IVA"]),
      imp_total: convertirNumeroArgentino(fila["Imp. Total"]),
      
      // Campos nuevos - desglose detallado IVA
      tipo_doc_receptor: parseInt(fila["Tipo Doc. Receptor"]) || null,
      nro_doc_receptor: fila["Nro. Doc. Receptor"] ? fila["Nro. Doc. Receptor"].toString() : null,
      neto_grav_iva_0: convertirNumeroArgentino(fila["Neto Grav. IVA 0%"]),
      iva_2_5: convertirNumeroArgentino(fila["IVA 2,5%"]),
      neto_grav_iva_2_5: convertirNumeroArgentino(fila["Neto Grav. IVA 2,5%"]),
      iva_5: convertirNumeroArgentino(fila["IVA 5%"]),
      neto_grav_iva_5: convertirNumeroArgentino(fila["Neto Grav. IVA 5%"]),
      iva_10_5: convertirNumeroArgentino(fila["IVA 10,5%"]),
      neto_grav_iva_10_5: convertirNumeroArgentino(fila["Neto Grav. IVA 10,5%"]),
      iva_21: convertirNumeroArgentino(fila["IVA 21%"]),
      neto_grav_iva_21: convertirNumeroArgentino(fila["Neto Grav. IVA 21%"]),
      iva_27: convertirNumeroArgentino(fila["IVA 27%"]),
      neto_grav_iva_27: convertirNumeroArgentino(fila["Neto Grav. IVA 27%"])
    }
  } else {
    // FORMATO CSV ANTERIOR - Mapeo tradicional
    camposIVA = {
      // Campos existentes (formato anterior)
      imp_neto_gravado: convertirNumeroArgentino(fila["Imp. Neto Gravado"]),
      imp_neto_no_gravado: convertirNumeroArgentino(fila["Imp. Neto No Gravado"]),
      imp_op_exentas: convertirNumeroArgentino(fila["Imp. Op. Exentas"]),
      otros_tributos: convertirNumeroArgentino(fila["Otros Tributos"]),
      iva: convertirNumeroArgentino(fila["IVA"]),
      imp_total: convertirNumeroArgentino(fila["Imp. Total"]),
      
      // Campos nuevos - valores por defecto (CSV no los tiene)
      tipo_doc_receptor: null,
      nro_doc_receptor: null,
      neto_grav_iva_0: 0,
      iva_2_5: 0,
      neto_grav_iva_2_5: 0,
      iva_5: 0,
      neto_grav_iva_5: 0,
      iva_10_5: 0,
      neto_grav_iva_10_5: 0,
      iva_21: 0,
      neto_grav_iva_21: 0,
      iva_27: 0,
      neto_grav_iva_27: 0
    }
  }
  
  // CONVERSIÓN A NEGATIVO PARA NOTAS DE CRÉDITO
  if (tipoInfo.es_nota_credito) {
    console.log('⚠️ Convirtiendo Nota de Crédito a valores negativos')
    
    // Lista de TODOS los campos monetarios que deben ser negativos
    const camposMonetarios = [
      'imp_neto_gravado', 'imp_neto_no_gravado', 'imp_op_exentas', 
      'imp_otros_tributos', 'imp_total_iva', 'imp_total',
      'otros_tributos', 'iva',
      'neto_grav_iva_0', 'iva_2_5', 'neto_grav_iva_2_5', 'iva_5', 'neto_grav_iva_5',
      'iva_10_5', 'neto_grav_iva_10_5', 'iva_21', 'neto_grav_iva_21', 
      'iva_27', 'neto_grav_iva_27'
    ]
    
    // Convertir todos los campos monetarios a negativos
    camposMonetarios.forEach(campo => {
      if (camposIVA[campo] && typeof camposIVA[campo] === 'number' && camposIVA[campo] > 0) {
        camposIVA[campo] = -camposIVA[campo]
      }
    })
  }
  
  // Buscar regla de asignación automática por CUIT
  const reglaCuit = await buscarReglaCuit(datosBasicos.cuit)

  // Combinar datos básicos + IVA + campos sistema
  const resultado = {
    ...datosBasicos,
    ...camposIVA,

    // Campos calculados automáticamente (PRESERVAR LÓGICA EXISTENTE)
    fecha_estimada: calcularFechaEstimada(fechaEmision),
    monto_a_abonar: camposIVA.imp_total, // Inicialmente igual al importe total

    // Campos adicionales con valores por defecto (PRESERVAR)
    campana: null,
    año_contable: null, // Dejar en blanco (no usar default de BD)
    fc: null,
    cuenta_contable: reglaCuit.cuenta_contable, // ← Aplicar regla CUIT si existe
    centro_costo: null,
    estado: reglaCuit.estado, // ← Aplicar regla CUIT si existe
    observaciones_pago: null,
    detalle: `Factura ${datosBasicos.tipo_comprobante}-${datosBasicos.numero_desde} - ${datosBasicos.denominacion_emisor || 'Sin nombre'}`,
    archivo_origen: nombreArchivo
  }

  console.log(`✅ Mapeo completado: ${Object.keys(resultado).length} campos | Regla CUIT: ${reglaCuit.cuenta_contable ? 'SÍ' : 'NO'}`)
  return resultado
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
    console.log(`🚀 VERSIÓN CÓDIGO: EXCEL-SUPPORT-v1.3-NULL-AÑO - ${new Date().toISOString()}`)

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
        const filaParaBBDD = await mapearFilaCSVaBBDD(filaOriginal, file.name)

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