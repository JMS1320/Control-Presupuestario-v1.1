-- Actualizar datos de ejemplo con las nuevas columnas
UPDATE msa_galicia SET 
  grupo_concepto = 'VENTAS',
  concepto = 'Venta de productos',
  comprobante = 'FAC-001',
  tipo_movimiento = 'CREDITO',
  leyenda_1 = 'Venta mensual',
  leyenda_2 = 'Cliente: Empresa ABC',
  leyenda_3 = 'Zona: CABA',
  leyenda_4 = 'Vendedor: Juan Pérez',
  orden_banco = 1
WHERE descripcion = 'Venta productos enero';

UPDATE msa_galicia SET 
  grupo_concepto = 'SERVICIOS',
  concepto = 'Servicios profesionales',
  comprobante = 'FAC-002',
  tipo_movimiento = 'CREDITO',
  leyenda_1 = 'Servicios adicionales',
  leyenda_2 = 'Cliente: Empresa XYZ',
  leyenda_3 = 'Zona: GBA',
  leyenda_4 = 'Consultor: María García',
  orden_banco = 2
WHERE descripcion = 'Servicios adicionales';

UPDATE msa_galicia SET 
  grupo_concepto = 'GASTOS',
  concepto = 'Gastos operativos',
  comprobante = 'REC-001',
  tipo_movimiento = 'DEBITO',
  leyenda_1 = 'Gastos mensuales',
  leyenda_2 = 'Proveedor: Servicios SA',
  leyenda_3 = 'Categoría: Operativo',
  leyenda_4 = 'Autorizado por: Admin',
  orden_banco = 3
WHERE descripcion = 'Gastos operativos';

UPDATE msa_galicia SET 
  grupo_concepto = 'VENTAS',
  concepto = 'Venta febrero',
  comprobante = 'FAC-003',
  tipo_movimiento = 'CREDITO',
  leyenda_1 = 'Venta mensual febrero',
  leyenda_2 = 'Cliente: Empresa DEF',
  leyenda_3 = 'Zona: Interior',
  leyenda_4 = 'Vendedor: Carlos López',
  orden_banco = 4
WHERE descripcion = 'Venta febrero';

UPDATE msa_galicia SET 
  grupo_concepto = 'INVERSIONES',
  concepto = 'Compra equipos',
  comprobante = 'FAC-004',
  tipo_movimiento = 'DEBITO',
  leyenda_1 = 'Inversión equipamiento',
  leyenda_2 = 'Proveedor: TecnoSA',
  leyenda_3 = 'Tipo: Hardware',
  leyenda_4 = 'Autorizado por: Gerencia',
  orden_banco = 5
WHERE descripcion = 'Inversión equipos';

UPDATE msa_galicia SET 
  grupo_concepto = 'DISTRIBUCIONES',
  concepto = 'Reparto utilidades',
  comprobante = 'DIST-001',
  tipo_movimiento = 'DEBITO',
  leyenda_1 = 'Distribución utilidades',
  leyenda_2 = 'Período: Enero-Febrero',
  leyenda_3 = 'Tipo: Socios',
  leyenda_4 = 'Autorizado por: Directorio',
  orden_banco = 6
WHERE descripcion = 'Distribución utilidades';
