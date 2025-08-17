import { NextResponse } from "next/server"
import { ARCAAuth } from "../../../../arca-integration/lib/auth"

/**
 * Endpoint para verificar estado del servicio ARCA API
 * GET /api/arca/status
 */
export async function GET() {
  try {
    const timestamp = new Date().toISOString()
    
    // Verificar configuración básica
    const environment = process.env.ARCA_ENVIRONMENT || 'testing'
    const cuit = process.env.ARCA_CUIT || '20123456789'
    
    // Verificar certificados
    const auth = new ARCAAuth('wsfe', environment as 'testing' | 'production')
    const certificadosOK = auth.isConfigured()
    
    // Información del servicio
    const serviceInfo = {
      status: 'OK',
      service: 'ARCA API Integration',
      version: '1.0.0',
      timestamp,
      
      // Configuración
      environment,
      cuit: cuit.replace(/(\d{2})(\d{8})(\d{1})/, '$1-$2-$3'), // Formatear CUIT
      
      // Estado de componentes
      components: {
        certificates: certificadosOK ? 'OK' : 'Missing',
        wsaa: certificadosOK ? 'Ready' : 'Not configured',
        wsfe: certificadosOK ? 'Ready' : 'Not configured',
        database: 'Unknown' // Se verifica en tiempo real
      },
      
      // URLs de servicio
      endpoints: {
        wsaa: process.env.ARCA_WSAA_URL || 'Not configured',
        wsfe: process.env.ARCA_WSFE_URL || 'Not configured'
      },
      
      // Información adicional
      info: {
        lastSync: 'Never', // TODO: Implementar tracking
        certificateExpiry: 'Unknown', // TODO: Extraer de certificado
        tokenStatus: 'Not cached'
      }
    }
    
    // Verificar conexión a BD (opcional, para no hacer lenta la respuesta)
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      
      // Test rápido de conexión
      const { error } = await supabase
        .schema('msa')
        .from('comprobantes_arca')
        .select('id')
        .limit(1)
      
      serviceInfo.components.database = error ? 'Error' : 'OK'
      
    } catch (dbError) {
      serviceInfo.components.database = 'Error'
    }
    
    // Determinar status general
    const allComponentsOK = Object.values(serviceInfo.components).every(status => status === 'OK' || status === 'Ready')
    serviceInfo.status = allComponentsOK ? 'OK' : 'WARNING'
    
    return NextResponse.json(serviceInfo)
    
  } catch (error) {
    console.error('❌ Error verificando estado ARCA:', error)
    
    return NextResponse.json({
      status: 'ERROR',
      service: 'ARCA API Integration',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      components: {
        certificates: 'Unknown',
        wsaa: 'Error',
        wsfe: 'Error', 
        database: 'Unknown'
      }
    }, { status: 500 })
  }
}

/**
 * POST endpoint para diagnósticos más profundos
 * POST /api/arca/status
 */
export async function POST() {
  try {
    console.log('🔍 Iniciando diagnóstico profundo ARCA...')
    
    const results = {
      timestamp: new Date().toISOString(),
      environment: process.env.ARCA_ENVIRONMENT || 'testing',
      tests: {} as Record<string, any>
    }
    
    // Test 1: Certificados
    try {
      const auth = new ARCAAuth('wsfe', results.environment as 'testing' | 'production')
      results.tests.certificates = {
        status: auth.isConfigured() ? 'OK' : 'Missing',
        configured: auth.isConfigured()
      }
    } catch (error) {
      results.tests.certificates = {
        status: 'Error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
    
    // Test 2: Conexión WSAA (sin intentar autenticar)
    try {
      const wsaaUrl = process.env.ARCA_WSAA_URL
      if (wsaaUrl) {
        const response = await fetch(wsaaUrl.replace('/services/LoginCms', ''), {
          method: 'HEAD',
          timeout: 5000
        }).catch(() => null)
        
        results.tests.wsaa_connectivity = {
          status: response?.ok ? 'OK' : 'Unreachable',
          url: wsaaUrl,
          reachable: !!response?.ok
        }
      } else {
        results.tests.wsaa_connectivity = {
          status: 'Not configured',
          url: null
        }
      }
    } catch (error) {
      results.tests.wsaa_connectivity = {
        status: 'Error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
    
    // Test 3: Base de datos
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      
      // Probar ambos esquemas
      const msaTest = await supabase.schema('msa').from('comprobantes_arca').select('count').limit(1)
      const pamTest = await supabase.schema('pam').from('comprobantes_arca').select('count').limit(1).catch(() => ({ error: 'Schema not found' }))
      
      results.tests.database = {
        status: msaTest.error ? 'Error' : 'OK',
        schemas: {
          msa: msaTest.error ? 'Error' : 'OK',
          pam: pamTest.error ? 'Error' : 'OK'
        }
      }
    } catch (error) {
      results.tests.database = {
        status: 'Error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
    
    // Determinar status general
    const failedTests = Object.values(results.tests).filter(test => test.status === 'Error').length
    const warningTests = Object.values(results.tests).filter(test => test.status === 'Missing' || test.status === 'Unreachable').length
    
    const overallStatus = failedTests > 0 ? 'ERROR' : (warningTests > 0 ? 'WARNING' : 'OK')
    
    return NextResponse.json({
      status: overallStatus,
      ...results,
      summary: {
        total_tests: Object.keys(results.tests).length,
        passed: Object.values(results.tests).filter(test => test.status === 'OK').length,
        warnings: warningTests,
        failed: failedTests
      }
    })
    
  } catch (error) {
    console.error('❌ Error en diagnóstico ARCA:', error)
    
    return NextResponse.json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}