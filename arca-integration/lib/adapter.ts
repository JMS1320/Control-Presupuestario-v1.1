import { ComprobanteARCA } from './wsfe'

/**
 * Adaptador que convierte datos de la API ARCA al formato esperado por la base de datos
 * Reutiliza toda la lógica de validación existente
 */

/**
 * Mapea un comprobante de la API ARCA a la estructura de la base de datos
 * Equivalente a mapearFilaCSVaBBDD pero para datos de API
 */
export function mapearComprobanteAPIaBBDD(comprobante: ComprobanteARCA, empresa: string): any {
  return {
    // Datos originales de ARCA (ya están en el formato correcto)
    fecha_emision: comprobante.fecha_emision,
    tipo_comprobante: comprobante.tipo_comprobante,
    punto_venta: comprobante.punto_venta,
    numero_desde: comprobante.numero_desde,
    numero_hasta: comprobante.numero_hasta,
    codigo_autorizacion: comprobante.codigo_autorizacion,
    tipo_doc_emisor: comprobante.tipo_doc_emisor,
    cuit: comprobante.cuit,
    denominacion_emisor: comprobante.denominacion_emisor,
    tipo_cambio: comprobante.tipo_cambio,
    moneda: comprobante.moneda,
    imp_neto_gravado: comprobante.imp_neto_gravado,
    imp_neto_no_gravado: comprobante.imp_neto_no_gravado,
    imp_op_exentas: comprobante.imp_op_exentas,
    otros_tributos: comprobante.otros_tributos,
    iva: comprobante.iva,
    imp_total: comprobante.imp_total,
    
    // Campos adicionales con valores por defecto
    campana: null,
    fc: null,
    cuenta_contable: null,
    centro_costo: null,
    estado: 'pendiente',
    observaciones_pago: null,
    detalle: null,
    archivo_origen: `API_SYNC_${empresa}_${new Date().toISOString().split('T')[0]}`
  }
}

/**
 * Valida que el comprobante tenga los campos obligatorios
 * Reutiliza la misma lógica de validación que el importador CSV
 */
export function validarComprobanteAPI(comprobante: any): { esValido: boolean; error?: string } {
  // Validar campos obligatorios (misma lógica que CSV)
  if (!comprobante.fecha_emision || !comprobante.cuit || comprobante.imp_total === 0) {
    return {
      esValido: false,
      error: 'Faltan datos obligatorios (fecha, CUIT o importe)'
    }
  }

  // Validar formato de fecha
  if (comprobante.fecha_emision && !comprobante.fecha_emision.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return {
      esValido: false,
      error: 'Formato de fecha inválido'
    }
  }

  // Validar CUIT
  if (comprobante.cuit && comprobante.cuit.length !== 11) {
    return {
      esValido: false,
      error: 'CUIT debe tener 11 dígitos'
    }
  }

  return { esValido: true }
}

/**
 * Filtra comprobantes por empresa según CUIT
 * Misma lógica que la validación por nombre de archivo en CSV
 */
export function validarComprobanteEmpresa(comprobante: any, empresa: 'MSA' | 'PAM'): boolean {
  // CUITs esperados por empresa (mismos que en el importador CSV)
  const cuitEsperado = empresa === 'MSA' ? '30617786016' : '20044390222'
  
  // En API, validamos que el CUIT del receptor sea el de nuestra empresa
  // Nota: En WSFEv1 el campo DocNro puede contener el CUIT del receptor
  return comprobante.cuit === cuitEsperado
}

/**
 * Convierte fechas a formato YYYYMMDD para consultas ARCA
 */
export function formatearFechaParaConsulta(fecha: Date): string {
  const year = fecha.getFullYear()
  const month = String(fecha.getMonth() + 1).padStart(2, '0')
  const day = String(fecha.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

/**
 * Obtiene el rango de fechas para sincronización
 * Por defecto: últimos 30 días
 */
export function obtenerRangoFechasSincronizacion(diasAtras: number = 30): {
  fechaDesde: string
  fechaHasta: string
} {
  const hoy = new Date()
  const fechaDesde = new Date(hoy.getTime() - (diasAtras * 24 * 60 * 60 * 1000))
  
  return {
    fechaDesde: formatearFechaParaConsulta(fechaDesde),
    fechaHasta: formatearFechaParaConsulta(hoy)
  }
}

/**
 * Determina el esquema de base de datos según empresa
 * Reutiliza la misma lógica que el importador CSV
 */
export function obtenerEsquemaEmpresa(empresa: 'MSA' | 'PAM'): string {
  return empresa.toLowerCase() // 'msa' o 'pam'
}

/**
 * Estadísticas de sincronización
 */
export interface EstadisticasSincronizacion {
  totalConsultados: number
  nuevosImportados: number
  duplicadosIgnorados: number
  erroresValidacion: number
  errores: string[]
}

/**
 * Inicializa estadísticas vacías
 */
export function crearEstadisticasVacias(): EstadisticasSincronizacion {
  return {
    totalConsultados: 0,
    nuevosImportados: 0,
    duplicadosIgnorados: 0,
    erroresValidacion: 0,
    errores: []
  }
}