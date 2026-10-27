/**
 * 📜 El histórico del contador (`comprobantes_historico`) con la forma de una factura de la app.
 *
 * MSA tiene jul–nov 2025 sólo ahí (lo cargó el contador antes de que la app llevara los subdiarios). Lo usan
 * la lista general de Facturas y, desde A-FEAT-1382 (JMS 27/10: «si Subdiarios permitiera ver los históricos
 * —ya tiene los datos— deberíamos poder vincular todas las facturas y ver cuántas faltan»), Subdiarios.
 */

/**
 * Una fila del histórico como factura. `estado: 'historico'` es la marca: esas filas son de consulta.
 * El tipo viene como texto («1 - Factura A», «3 - Nota de Crédito A», «Ticket factura A»): el número de
 * adelante es el código de ARCA; sin número queda 0 (los tickets A van con crédito fiscal, como el 81).
 * `otros_tributos` ya trae las percepciones: medido 27/10, jul–nov cierra sin sumarlas aparte.
 */
export function historicoAFactura(h: Record<string, any>) {
  return {
    id: h.id,
    fecha_emision: h.fecha,
    tipo_comprobante: parseInt(String(h.tipo ?? '')) || 0,
    tipo_comprobante_desc: h.tipo ?? null,
    punto_venta: h.punto_de_venta ?? null,
    numero_desde: h.numero_desde ?? null,
    numero_hasta: null,
    codigo_autorizacion: null,
    tipo_doc_emisor: null,
    cuit: h.nro_doc_emisor ?? '',
    denominacion_emisor: h.denominacion_emisor ?? '',
    tipo_cambio: 1,
    moneda: 'PES',
    imp_neto_gravado: h.imp_neto_gravado ?? 0,
    imp_neto_no_gravado: h.imp_neto_no_gravado ?? 0,
    imp_op_exentas: h.imp_op_exentas ?? 0,
    otros_tributos: h.otros_tributos ?? 0,
    iva: h.iva ?? 0,
    imp_total: h.imp_total ?? 0,
    campana: null,
    año_contable: h.anio_contable ?? null,
    mes_contable: h.mes_contable ?? null,
    fc: h.fc ?? null,
    cuenta_contable: h.cuenta_contable ?? null,
    centro_costo: null,
    estado: 'historico',
    observaciones_pago: null,
    detalle: null,
    archivo_origen: null,
    fecha_importacion: null,
    fecha_modificacion: null,
    fecha_estimada: null,
    fecha_vencimiento: null,
    monto_a_abonar: null,
    ddjj_iva: 'No',
    created_at: h.created_at ?? '',
    iva_2_5: null, iva_5: null, iva_10_5: null, iva_21: null, iva_27: null,
    neto_grav_iva_0: null, neto_grav_iva_2_5: null, neto_grav_iva_5: null,
    neto_grav_iva_10_5: null, neto_grav_iva_21: null, neto_grav_iva_27: null,
    sicore: null, monto_sicore: null, tipo_sicore: null, descuento_aplicado: null,
    grupo_pago_id: null,
  }
}

/**
 * Las filas del subdiario de un mes: si la app tiene facturas de ese mes, **manda la app** y el histórico no
 * se mezcla (diciembre está en los dos: A-DAT-61); si no tiene ninguna, va el histórico.
 */
export function filasDelSubdiario<T>(app: T[], historico: Record<string, any>[]): (T | ReturnType<typeof historicoAFactura>)[] {
  return app.length ? app : historico.map(historicoAFactura)
}
