# 📑 ESTRUCTURA BD — Apéndice de columnas (auto-generado desde la BD viva)

> Dump completo de **todas las columnas de todas las tablas** de los schemas de usuario.
> **Fuente:** `information_schema.columns` consultado el **2026-06-23**.
> Para la narrativa (propósito, permisos, jerarquías) ver **`ARQUITECTURA-BD.md`**.
> Regenerar con la query del final de este archivo cuando cambie la estructura.

Schemas de usuario: `public` (22 tablas + 6 vistas `sueldos_*`) · `msa` (12) · `productivo` (19) · `sueldos` (6) · `ma` (4) · `pam` (3) = **66 tablas base + 6 vistas**.

---

## schema `public`

### anticipos_facturas
`id uuid, anticipo_id uuid, factura_arca_id uuid, monto_aplicado numeric, fecha_aplicacion timestamp`

### anticipos_proveedores
`id uuid, cuit_proveedor varchar, nombre_proveedor varchar, monto numeric, monto_restante numeric, fecha_pago date, descripcion text, estado varchar, created_at ts, updated_at ts, tipo varchar, estado_pago varchar, sicore varchar, monto_sicore numeric, tipo_sicore varchar, neto_gravado numeric, neto_no_gravado numeric, op_exentas numeric, iva numeric, imp_total numeric, factura_id uuid, descuento_aplicado numeric, metodo_pago varchar, fecha_cobro_echeq date, visible_contable boolean, nro_cuenta varchar`

### arca_descargas_log
`id uuid, fecha_hora tstz, user_role varchar, empresa varchar, tipo varchar, fecha_desde date, fecha_hasta date, comprobantes_descargados int, comprobantes_importados int, duplicados int, errores int, status varchar, error_mensaje text, created_at tstz`

### arca_pdf_busqueda_log
`id uuid, factura_id uuid, factura_schema varchar, lote_id uuid, fecha_hora tstz, resultado varchar, drive_url varchar, observaciones text, tiempo_ejecucion_ms int, cuit_emisor varchar, numero_comprobante varchar, monto_factura numeric, monto_pdf numeric`

### centros_costo
`id uuid, nombre varchar, activo boolean, created_at tstz`

### config_parseo_extracto
`id uuid, cuenta_bancaria_id varchar, tipo_movimiento text, grupo_de_conceptos text, campo_destino text, tipo_regla text, numero_linea int, descripcion_campo text, orden int, activo boolean, created_at tstz`

### cuentas_contables
`id uuid, categ text, cuenta_contable text, tipo USER-DEFINED(enum), activo boolean, created_at tstz, nro_cuenta text, imputable boolean, cta_totalizadora text, nombre_totalizadora text, cambio_nombre_cta text, grupo_cuenta text`

### cuotas_egresos_sin_factura
`id uuid, egreso_id uuid→egresos_sin_factura, numero_cuota int, fecha_vencimiento date, fecha_estimada date, fecha_pago date, monto numeric, estado varchar, descripcion text, detalle text, cuenta_contable text, centro_costo text, created_at tstz, updated_at tstz, mes int, tipo_movimiento varchar, grupo_pago_id uuid→msa.grupos_pago, medio_pago text, categ varchar, visible_contable boolean`

> `fecha_pago` (2026-07-04): fecha real de pago, separada del vencimiento firme. Editable en Vista Pagos / Cash Flow; propaga a `fecha_estimada`. Venc solo editable vía RPC `actualizar_venc_cuota` (desde Egresos sin Factura). Ver PENDIENTES A-TEST-06.

### distribucion_socios
`id uuid, interno text, concepto text, created_at tstz, updated_at tstz, orden int, seccion int, empresa_destino text`

### egresos_sin_factura
`id uuid, template_master_id uuid→templates_master, nombre_referencia text, proveedor text, cuit_quien_cobra text, categ text, centro_costo text, responsable text, responsable_interno text, cuotas int, tipo_fecha text, fecha_primera_cuota date, monto_por_cuota numeric, completar_cuotas text, observaciones_template text, actualizacion_proximas_cuotas text, obs_opciones text, codigo_contable text, codigo_interno text, alertas text, activo boolean, created_at tstz, updated_at tstz, nombre_quien_cobra varchar, tipo_recurrencia varchar, año varchar, pago_anual boolean, monto_anual numeric, fecha_pago_anual date, template_origen_id uuid→egresos_sin_factura, configuracion_reglas text, grupo_impuesto_id varchar, cuenta_agrupadora varchar, tipo_template varchar, es_bidireccional boolean, seccion_regla int, solo_conciliacion boolean, es_multi_cuenta boolean`

### indices_ipc
`id uuid, anio int, mes int, valor_ipc numeric, variacion_mensual numeric, variacion_interanual numeric, variacion_acumulada numeric, fuente text, observaciones text, created_at tstz, updated_at tstz`

### lotes_transferencias
`id uuid, fecha_generacion tstz, fecha_pago date, tipo varchar, empresa varchar, monto_total numeric, cantidad_items int, cantidad_excluidos int, cantidad_archivos int, user_role varchar, nombre_archivo varchar, observaciones text`

### msa_galicia · pam_galicia · pam_galicia_cc  (extractos cta cte — misma estructura)
`fecha date, descripcion text, origen text, debitos numeric, creditos numeric, grupo_de_conceptos text, concepto text, numero_de_terminal text, observaciones_cliente text, numero_de_comprobante text, leyendas_adicionales_1..4 text, tipo_de_movimiento text, saldo numeric, control numeric, categ text, detalle text, contable text, interno text, centro_de_costo text, cuenta text, orden numeric, id uuid, estado text, motivo_revision text, comprobante_arca_id uuid, nro_cuenta varchar, template_id uuid, template_cuota_id uuid, sueldo_pago_id uuid, revisado boolean, nota_operador text, anticipo_id uuid, proveedor_nombre varchar, comprobantes_pagados text`

### proveedores
`id uuid, cuit varchar, razon_social varchar, nombre_fantasia varchar, activo boolean, cbu varchar, alias_cbu varchar, banco varchar, tipo_cuenta varchar, moneda_cuenta varchar, ultimo_uso_bancario tstz, email_pagos varchar, email_facturacion varchar, telefono varchar, contacto_nombre varchar, notas text, tags ARRAY, empresa_principal varchar, created_at tstz, updated_at tstz, es_proveedor boolean, es_cliente boolean, fc_modo varchar, patron_asunto varchar, dias_busqueda int, carpeta_drive_id varchar, gas_habilitado boolean, pdf_ultimo_intento tstz, mensaje_transferencia varchar`

### reglas_conciliacion
`id uuid, orden int, tipo text, columna_busqueda text, texto_buscar text, tipo_match text, categ text, centro_costo text, detalle text, activo boolean, created_at tstz, updated_at tstz, llena_template boolean, cuenta_bancaria_id varchar, codigo_contable varchar, codigo_interno varchar`

### reglas_contable_interno
`id uuid, orden int, activo boolean, created_at tstz, updated_at tstz, cuenta_bancaria_id varchar, tipo_regla varchar, template_id uuid, responsable varchar, codigo_contable varchar, codigo_interno varchar, descripcion varchar, empleado_id uuid`

### reglas_ctas_import_arca
`id uuid, cuit varchar, denominacion_emisor text, cuenta_contable text, estado varchar, activo boolean, created_at tstz, updated_at tstz`

### templates_master
`id uuid, nombre text, total_renglones int, activo boolean, created_at tstz, updated_at tstz, descripcion text, año varchar`

### tipos_comprobante_afip
`id int, codigo int, descripcion text, es_nota_credito boolean, activo boolean, created_at tstz`

### tipos_sicore_config
`id int, tipo varchar, emoji varchar, minimo_no_imponible numeric, porcentaje_retencion numeric, activo boolean, created_at tstz, codigo_regimen varchar`

### sueldos_* — **VISTAS** (passthrough de las tablas reales en el schema `sueldos`, ver más abajo)
- **sueldos_campanas**: `id uuid, etiqueta varchar, fecha_inicio date, fecha_fin date, activa boolean, created_at tstz`
- **sueldos_empleados**: `id uuid, nombre varchar, tipo_empleado varchar, empresa varchar, cuit_empleado varchar, francos_dias_promedio int, dias_promedio int, horas_promedio int, activo boolean, created_at tstz, fecha_ingreso date, fecha_egreso date`
- **sueldos_componentes_salario**: `id uuid, empleado_id uuid, campana_id uuid, tipo_componente varchar, monto numeric, vigente_desde date, vigente_hasta date, created_at tstz`
- **sueldos_cuentas_empleado**: `id uuid, empleado_id uuid, banco varchar, alias varchar, activo boolean`
- **sueldos_periodos**: `id uuid, empleado_id uuid, campana_id uuid, anio int, mes int, fecha_inicio_periodo date, fecha_fin_periodo date, bruto_calculado numeric, sueldo_x_ipc numeric, sueldo_pagado numeric, anticipos_descontados numeric, saldo_pendiente numeric, estado varchar, observaciones text, created_at tstz, monto_a numeric, monto_b numeric, francos_cantidad numeric, valor_por_dia numeric, dias_trabajados int, valor_por_hora numeric, horas_mes int, varios numeric, valor_franco numeric, vacaciones numeric, premio numeric`
- **sueldos_pagos**: `id uuid, periodo_id uuid, empleado_id uuid, tipo varchar, fecha date, monto numeric, cuenta_destino_id uuid, descripcion text, created_at tstz, estado varchar, medio_pago text, grupo_pago_id uuid, visible_contable boolean`

---

## schema `msa`

### comprobantes_arca  (facturas de compra ARCA — MSA)
`id uuid, fecha_emision date, tipo_comprobante int, punto_venta int, numero_desde bigint, numero_hasta bigint, codigo_autorizacion varchar, tipo_doc_emisor int, cuit varchar, denominacion_emisor text, tipo_cambio numeric, moneda varchar, imp_neto_gravado numeric, imp_neto_no_gravado numeric, imp_op_exentas numeric, otros_tributos numeric, iva numeric, imp_total numeric, campana text, año_contable int, mes_contable int, fc text, cuenta_contable text, centro_costo text, estado varchar, observaciones_pago text, detalle text, archivo_origen text, fecha_importacion ts, fecha_modificacion ts, fecha_estimada date, fecha_vencimiento date, monto_a_abonar numeric, iva_0/2_5/5/10_5/21/27 numeric, neto_grav_iva_0/2_5/5/10_5/21/27 numeric, ddjj_iva varchar, sicore varchar, monto_sicore numeric, created_at ts, tipo_comprobante_desc text, tipo_doc_receptor int, nro_doc_receptor varchar, tipo_sicore varchar, nro_cuenta text, grupo_pago_id uuid→grupos_pago, descuento_aplicado numeric, tc_pago numeric, metodo_pago varchar, fecha_cobro_echeq date, medio_pago text, origen_factura varchar, visible_contable boolean, pdf_drive_url varchar, pdf_estado varchar, pdf_ultimo_intento tstz, pdf_observaciones text`
> `pam.comprobantes_arca` y `ma.comprobantes_arca` = misma estructura (ma agrega `medio_pago`, `origen_factura`, `visible_contable`; pam no tiene esos 3).

### comprobantes_historico  (facturas históricas pre-sistema — MSA y PAM)
`id uuid, fecha date, tipo text, punto_de_venta int, numero_desde bigint, nro_doc_emisor text, denominacion_emisor text, imp_neto_gravado numeric, imp_neto_no_gravado numeric, imp_op_exentas numeric, percepcion_iibb numeric, percepcion_iva numeric, otros_tributos numeric, iva numeric, imp_total numeric, fc text, cuenta_contable text, anio_contable int, mes_contable int, empresa varchar, created_at tstz, nro_cuenta text, cuenta_asignada text`

### comprobantes_venta · ventas · ventas_comprobantes  (módulo Ventas — IVA Ventas)
- **comprobantes_venta**: `id uuid, fecha_liquidacion date, nro_comprobante varchar, coe varchar, tipo_operacion varchar, actividad varchar, ret_iva numeric, ret_iibb numeric, fecha_acreditacion date, puerto varchar, procedencia varchar, cosecha varchar, peso_kg numeric, datos_adicionales text, created_at tstz, updated_at tstz, cuit_cliente varchar, denominacion_cliente varchar, grano varchar, grado varchar, factor numeric, toneladas numeric, modo_precio varchar, precio_usd numeric, tc numeric, precio_pesos numeric, precio_final_pesos numeric, subtotal_neto numeric, alicuota_iva numeric, iva numeric, comision_neto numeric, comision_alicuota_iva numeric, comision_iva numeric, almacenaje_neto numeric, almacenaje_alicuota_iva numeric, almacenaje_iva numeric, tipo_comprobante int, ddjj_iva varchar, año_contable int, mes_contable int, punto_venta int, numero_desde bigint, imp_neto_gravado numeric, imp_neto_no_gravado numeric, imp_op_exentas numeric, imp_total numeric, cuenta_contable varchar, nro_cuenta varchar, centro_costo varchar`
- **ventas**: `id uuid, cuit_cliente varchar, denominacion_cliente varchar, fecha_operacion date, grano varchar, toneladas numeric, modo_precio varchar, precio_usd numeric, tc numeric, precio_pesos numeric, alicuota_iva numeric, comision_neto numeric, comision_alicuota_iva numeric, almacenaje_neto numeric, almacenaje_alicuota_iva numeric, observaciones text, created_at tstz, updated_at tstz`
- **ventas_comprobantes** (N:N): `venta_id uuid→ventas, comprobante_id uuid→comprobantes_venta, created_at tstz`

### caja_general · caja_ams · caja_sigot  (cajas efectivo — misma estructura, base de movimiento)
`id uuid, fecha date, descripcion text, debitos numeric, creditos numeric, saldo numeric, control numeric, categ text, detalle text, contable text, interno text, centro_de_costo text, cuenta text, orden numeric, estado text, motivo_revision text, comprobante_arca_id uuid, nro_cuenta varchar, template_id uuid, template_cuota_id uuid`

### cheques
`id uuid, numero varchar, banco varchar, monto numeric, moneda varchar, fecha_emision date, fecha_cobro date, beneficiario_nombre varchar, beneficiario_cuit varchar, estado varchar, fecha_estado date, endosado_a_nombre varchar, endosado_a_cuit varchar, fecha_endoso date, factura_id uuid, anticipo_id uuid, sicore varchar, monto_sicore numeric, tipo_sicore varchar, descuento_aplicado numeric, concepto text, created_at tstz`

### grupos_pago
`id uuid, cuit varchar, proveedor varchar, monto_total numeric, estado varchar, observaciones text, created_at tstz`

### sicore_retenciones
`id uuid, quincena varchar, fecha_pago date, origen varchar, factura_id uuid→comprobantes_arca, anticipo_id uuid→public.anticipos_proveedores, fecha_emision date, tipo_comprobante int, punto_venta int, numero_desde bigint, cuit_emisor varchar, denominacion_emisor varchar, tipo_sicore varchar, alicuota numeric, neto_gravado_pagado numeric, total_pagado numeric, descuento_aplicado numeric, minimo_no_imponible numeric, base_imponible numeric, retencion numeric, pago numeric, created_at tstz, nro_comprobante bigint, nro_certificado varchar, ddjj_confirmada boolean, anulado boolean, fecha_anulacion tstz, motivo_anulacion text, estado_quincena varchar, fecha_cerrada tstz, fecha_declarada tstz`

### tarjeta_visa_business (MSA) · ma.tarjeta_visa · pam.tarjeta_visa  (tarjetas — misma estructura)
`id uuid, fecha date, descripcion text, debitos numeric, creditos numeric, saldo numeric, control numeric, categ text, detalle text, contable text, interno text, centro_de_costo text, cuenta text, orden numeric, estado text, motivo_revision text, comprobante_arca_id uuid, nro_cuenta varchar, template_id uuid, template_cuota_id uuid, referencia varchar, cuota varchar, comprobante varchar, debitos_usd numeric, creditos_usd numeric, nro_resumen varchar, fecha_cierre date, fecha_vencimiento date, tarjeta_adicional varchar, titular_adicional varchar, tipo_fila varchar, proveedor_nombre text, comprobantes_pagados text, sueldo_pago_id uuid, revisado boolean, nota_operador text, anticipo_id uuid`

---

## schema `productivo`  (sector agropecuario)

### Hacienda / ganadero
- **categorias_hacienda**: `id uuid, nombre varchar, activo boolean, created_at ts`
- **movimientos_hacienda**: `id uuid, fecha date, categoria_id uuid→categorias_hacienda, tipo varchar, cantidad int, peso_total_kg numeric, precio_por_kg numeric, monto_total numeric, campo_origen varchar, campo_destino varchar, proveedor_cliente varchar, cuit varchar, observaciones text, created_at ts, desbaste_pct numeric`
- **stock_hacienda**: `id uuid, categoria_id uuid→categorias_hacienda, cantidad int, peso_promedio_kg numeric, campo varchar, observaciones text, updated_at ts`

### Cría / ciclos
- **ciclos_cria**: `id uuid, anio_servicio int, rodeo varchar, fecha_servicio date, cabezas_servicio int, orden_servicio_id uuid→ordenes_aplicacion, fecha_tacto date, cabezas_prenadas int, cabezas_vacias int, orden_tacto_id uuid, fecha_paricion date, terneros_nacidos int, orden_paricion_id uuid, fecha_destete date, terneros_destetados int, orden_destete_id uuid, observaciones text, created_at ts, pesada_destete_fecha date, kg_totales numeric, kg_promedio numeric, machos_destetados int, hembras_destetados int`
- **detalle_descarte**: `id uuid, ciclo_id uuid→ciclos_cria, caravana varchar, categoria_origen varchar, observaciones text, created_at ts, movimiento_id uuid, estado varchar`
- **terneros**: `id uuid, caravana_interna varchar, caravana_oficial varchar, sexo varchar, pelo varchar, fecha_nacimiento date, fecha_destete date, es_torito boolean, observaciones text, activo boolean, created_at tstz, fecha_baja date, motivo_baja text, categoria_id uuid→categorias_hacienda, fecha_ingreso_recria date, peso_ingreso_recria numeric, anio_nacimiento int, hijo_de varchar, padre varchar, madre varchar, peso_nacimiento numeric, pelo_madre varchar, categoria_previa varchar, fecha_alta date`
- **pesadas_terneros**: `id uuid, ternero_id uuid→terneros, fecha date, peso_kg numeric, observaciones text, created_at tstz, caravana_idv varchar`

### Sanidad / aplicaciones (ganadero)
- **ordenes_aplicacion**: `id uuid, fecha date, categoria_hacienda_id uuid→categorias_hacienda, cantidad_cabezas int, estado varchar, observaciones text, created_at ts, peso_promedio_kg numeric, motivo_eliminacion text`
- **ordenes_aplicacion_rodeos**: `id uuid, orden_id uuid→ordenes_aplicacion, categoria_hacienda_id uuid→categorias_hacienda, cantidad_cabezas int, created_at ts`
- **lineas_orden_aplicacion**: `id uuid, orden_id uuid→ordenes_aplicacion, insumo_nombre varchar, insumo_stock_id uuid→stock_insumos, tipo_dosis varchar, dosis_ml numeric, dosis_cada_kg numeric, peso_promedio_kg numeric, cantidad_total_ml numeric, unidad_medida varchar, observaciones text, created_at ts, recuento boolean, cantidad_recuento numeric, cabezas_linea int`
- **lineas_orden_labores**: `id uuid, orden_id uuid→ordenes_aplicacion, labor_id int→labores, observaciones text, created_at ts`

### Agrícola
- **lotes_agricolas**: `id uuid, nombre_lote varchar, campo varchar, hectareas numeric, cultivo varchar, campana varchar, fecha_siembra date, fecha_cosecha_estimada date, estado varchar, observaciones text, created_at ts`
- **ordenes_agricolas**: `id uuid, fecha date, lote_id uuid→lotes_agricolas, lote_nombre varchar, hectareas numeric, estado varchar, observaciones text, created_at tstz`
- **lineas_orden_agricola**: `id uuid, orden_id uuid→ordenes_agricolas, insumo_nombre varchar, insumo_stock_id uuid→stock_insumos, dosis numeric, unidad_dosis varchar, cantidad_total_l numeric, recuento boolean, cantidad_recuento_l numeric, observaciones text, created_at tstz`
- **lineas_orden_agricola_labores**: `id uuid, orden_id uuid→ordenes_agricolas, labor_id int→labores`

### Insumos / maestros
- **categorias_insumo**: `id uuid, nombre varchar, unidad_medida varchar, activo boolean, created_at ts, ambito text`  *(ambito: agricola/ganadero/ambos)*
- **stock_insumos**: `id uuid, categoria_id uuid→categorias_insumo, producto varchar, cantidad numeric, costo_unitario numeric, observaciones text, updated_at ts, unidad_medida varchar`
- **movimientos_insumos**: `id uuid, fecha date, insumo_stock_id uuid→stock_insumos, tipo varchar, cantidad numeric, costo_unitario numeric, monto_total numeric, destino_campo varchar, proveedor varchar, cuit varchar, observaciones text, created_at ts`
- **labores**: `id int, nombre varchar, activo boolean, orden_display int, created_at ts, tipo varchar`

---

## schema `sueldos`  (storage real del módulo sueldos; expuesto vía vistas `public.sueldos_*`)

- **empleados**: `id uuid, nombre varchar, tipo_empleado varchar, empresa varchar, cuit_empleado varchar, francos_dias_promedio int, dias_promedio int, horas_promedio int, activo boolean, created_at tstz, fecha_ingreso date, fecha_egreso date`
- **campanas**: `id uuid, etiqueta varchar, fecha_inicio date, fecha_fin date, activa boolean, created_at tstz`
- **periodos**: `id uuid, empleado_id uuid, campana_id uuid, anio int, mes int, fecha_inicio_periodo date, fecha_fin_periodo date, bruto_calculado numeric, sueldo_x_ipc numeric, sueldo_pagado numeric, anticipos_descontados numeric, saldo_pendiente numeric, estado varchar, observaciones text, created_at tstz, monto_a numeric, monto_b numeric, francos_cantidad numeric, valor_por_dia numeric, dias_trabajados int, valor_por_hora numeric, horas_mes int, varios numeric, valor_franco numeric, vacaciones numeric, premio numeric`
- **pagos**: `id uuid, periodo_id uuid, empleado_id uuid, tipo varchar, fecha date, monto numeric, cuenta_destino_id uuid, descripcion text, created_at tstz, estado varchar, medio_pago text, grupo_pago_id uuid, visible_contable boolean`
- **componentes_salario**: `id uuid, empleado_id uuid, campana_id uuid, tipo_componente varchar, monto numeric, vigente_desde date, vigente_hasta date, created_at tstz`
- **cuentas_empleado**: `id uuid, empleado_id uuid, banco varchar, alias varchar, activo boolean`

---

## 🔄 Cómo regenerar este apéndice

```sql
SELECT table_schema, table_name,
  string_agg(column_name || ' ' || data_type, ', ' ORDER BY ordinal_position) AS cols
FROM information_schema.columns
WHERE table_schema IN ('public','msa','pam','ma','productivo','sueldos')
GROUP BY table_schema, table_name
ORDER BY table_schema, table_name;
```
