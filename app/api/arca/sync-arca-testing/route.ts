import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { wsfeClient } from "../../../../arca-integration/lib/wsfe"
import { 
  mapearComprobanteAPIaBBDD, 
  validarComprobanteAPI,
  validarComprobanteEmpresa,
  obtenerRangoFechasSincronizacion,
  obtenerEsquemaEmpresa,
  crearEstadisticasVacias,
  type EstadisticasSincronizacion
} from "../../../../arca-integration/lib/adapter"

// Cliente Supabase con permisos de administrador
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Endpoint para sincronizar facturas desde ARCA API (TESTING)
 * POST /api/sync-arca-testing
 */
export async function POST(req: Request) {
  try {
    console.log(`🚀 Iniciando sincronización ARCA API Testing - ${new Date().toISOString()}`)
    
    // Obtener parámetros del request
    const { empresa, diasAtras } = await req.json().catch(() => ({}))
    
    // Valores por defecto
    const empresaTarget: 'MSA' | 'PAM' = empresa || 'MSA'
    const diasConsulta = diasAtras || 30
    
    console.log(`🏢 Empresa: ${empresaTarget}`)
    console.log(`📅 Consultando últimos ${diasConsulta} días`)

    // Obtener rango de fechas para consulta
    const { fechaDesde, fechaHasta } = obtenerRangoFechasSincronizacion(diasConsulta)
    console.log(`📊 Rango: ${fechaDesde} - ${fechaHasta}`)

    // Determinar esquema de base de datos
    const esquema = obtenerEsquemaEmpresa(empresaTarget)
    console.log(`🗄️ Esquema BD: ${esquema}`)

    // 🔍 TEST DE CONEXIÓN BD
    try {
      const { data: testData, error: testError } = await supabase
        .schema(esquema)
        .from('comprobantes_arca')
        .select('id')
        .limit(1)
      
      if (testError) {
        console.error(`❌ FALLO TEST BD:`, testError)
        return NextResponse.json({ 
          error: `No se puede conectar a ${esquema}.comprobantes_arca: ${testError.message}` 
        }, { status: 500 })
      }
      
      console.log(`✅ Conexión BD exitosa: ${esquema}.comprobantes_arca`)
    } catch (error) {
      console.error(`❌ ERROR CRÍTICO BD:`, error)
      return NextResponse.json({ 
        error: `Error crítico de BD: ${error}` 
      }, { status: 500 })
    }

    // 📡 CONSULTAR COMPROBANTES VIA ARCA API
    console.log(`📡 Consultando comprobantes ARCA...`)
    let comprobantesAPI
    
    try {
      comprobantesAPI = await wsfeClient.consultarComprobantes({
        fechaDesde,
        fechaHasta
      })
      
      console.log(`📊 Comprobantes obtenidos de ARCA API: ${comprobantesAPI.length}`)
      
    } catch (apiError) {
      console.error(`❌ Error consultando ARCA API:`, apiError)
      return NextResponse.json({ 
        error: `Error en ARCA API: ${apiError}`,
        detalles: 'Verificar certificados, conexión a internet y disponibilidad de ARCA'
      }, { status: 500 })
    }

    // 📈 PROCESAR COMPROBANTES
    const estadisticas = crearEstadisticasVacias()
    estadisticas.totalConsultados = comprobantesAPI.length

    for (let indice = 0; indice < comprobantesAPI.length; indice++) {
      const comprobanteOriginal = comprobantesAPI[indice]
      
      try {
        console.log(`🔍 Procesando comprobante ${indice + 1}/${comprobantesAPI.length}`)
        
        // 1. Validar que el comprobante pertenece a la empresa
        if (!validarComprobanteEmpresa(comprobanteOriginal, empresaTarget)) {
          console.log(`⏭️ Comprobante no pertenece a ${empresaTarget}, ignorando`)
          continue
        }

        // 2. Convertir al formato de BD
        const comprobanteParaBD = mapearComprobanteAPIaBBDD(comprobanteOriginal, empresaTarget)

        // 3. Validar campos obligatorios
        const validacion = validarComprobanteAPI(comprobanteParaBD)
        if (!validacion.esValido) {
          estadisticas.erroresValidacion++
          estadisticas.errores.push(`Comprobante ${indice + 1}: ${validacion.error}`)
          console.log(`❌ Validación fallida: ${validacion.error}`)
          continue
        }

        // 4. Verificar si ya existe (anti-duplicados)
        const { data: existente } = await supabase
          .schema(esquema)
          .from('comprobantes_arca')
          .select('id')
          .eq('tipo_comprobante', comprobanteParaBD.tipo_comprobante)
          .eq('punto_venta', comprobanteParaBD.punto_venta)
          .eq('numero_desde', comprobanteParaBD.numero_desde)
          .eq('cuit', comprobanteParaBD.cuit)
          .maybeSingle()

        if (existente) {
          estadisticas.duplicadosIgnorados++
          console.log(`⏭️ Comprobante ${indice + 1} ya existe, ignorando`)
          continue
        }

        // 5. Insertar nuevo comprobante
        console.log(`💾 Insertando comprobante ${indice + 1}...`)
        const { data, error: errorInsercion } = await supabase
          .schema(esquema)
          .from('comprobantes_arca')
          .insert(comprobanteParaBD)
          .select()

        if (errorInsercion) {
          console.error(`❌ Error inserción:`, errorInsercion)
          estadisticas.errores.push(`Comprobante ${indice + 1}: Error inserción - ${errorInsercion.message}`)
        } else {
          estadisticas.nuevosImportados++
          console.log(`✅ Comprobante ${indice + 1} insertado correctamente`)
        }

      } catch (error) {
        console.error(`❌ Error procesando comprobante ${indice + 1}:`, error)
        estadisticas.errores.push(`Comprobante ${indice + 1}: Error inesperado - ${error}`)
      }
    }

    // 📊 PREPARAR RESPUESTA
    const mensaje = `✅ Sincronización completada: ${estadisticas.nuevosImportados} nuevos comprobantes, ${estadisticas.duplicadosIgnorados} duplicados ignorados`
    
    console.log(`📈 RESULTADO FINAL:`, estadisticas)

    return NextResponse.json({
      success: estadisticas.nuevosImportados > 0 || estadisticas.totalConsultados > 0,
      message: mensaje,
      empresa: empresaTarget,
      esquema: esquema,
      rangoFechas: { fechaDesde, fechaHasta },
      estadisticas: estadisticas,
      // Información adicional para debugging
      debug: {
        certificadosOK: true, // En testing siempre OK
        conexionARCA: 'TESTING',
        conexionBD: 'OK',
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error("❌ Error general en sincronización ARCA:", error)
    return NextResponse.json({ 
      error: "Error interno durante sincronización ARCA",
      detalles: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * GET endpoint para verificar estado del servicio
 */
export async function GET() {
  try {
    // Verificar configuración
    const certificadosOK = true // En testing siempre true
    
    return NextResponse.json({
      status: 'OK',
      service: 'ARCA API Testing Sync',
      environment: 'testing',
      certificados: certificadosOK ? 'Configurados' : 'Faltantes',
      ultimaEjecucion: 'No ejecutado aún',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    return NextResponse.json({ 
      status: 'ERROR',
      error: 'Error verificando estado del servicio',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}