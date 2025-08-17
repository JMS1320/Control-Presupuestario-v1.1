// Types para el sistema de conciliación bancaria

export interface ReglaConciliacion {
  id: string
  orden: number // 1-24 según prioridad de ejecución
  tipo: 'cash_flow' | 'impuestos' | 'bancarios' | 'otras' | 'cuit'
  
  // Criterios de búsqueda
  columna_busqueda: 'descripcion' | 'cuit' | 'monto_debito' | 'monto_credito'
  texto_buscar: string
  tipo_match: 'exacto' | 'contiene' | 'inicia_con' | 'termina_con'
  
  // Resultados a asignar cuando hace match
  categ: string
  centro_costo?: string | null
  detalle: string
  
  // Control
  activo: boolean
  created_at: string
  updated_at: string
}

export interface MovimientoBancario {
  id: string
  fecha: string
  descripcion: string
  origen: string
  debitos: number
  creditos: number
  grupo_concepto: string
  concepto: string
  numero_terminal?: string
  observaciones_cliente?: string
  numero_comprobante?: string
  leyendas_adicionales1?: string
  leyendas_adicionales2?: string
  leyendas_adicionales3?: string
  leyendas_adicionales4?: string
  tipo_movimiento: string
  saldo: number
  
  // Campos completados por conciliación
  control?: string
  categ?: string
  centro_costo?: string
  detalle?: string
  contable?: string
  interno?: string
}

export interface ResultadoConciliacion {
  movimiento_id: string
  regla_aplicada?: ReglaConciliacion
  tipo_match: 'cash_flow' | 'regla' | 'manual' | 'sin_match'
  requiere_revision: boolean
  motivo_revision?: string
  categ_asignado?: string
  centro_costo_asignado?: string
  detalle_asignado?: string
}

export interface ConfiguracionConciliacion {
  tolerancia_dias_fecha: number // Por defecto 5 días
  permitir_matching_parcial: boolean
  activar_logs_detallados: boolean
}