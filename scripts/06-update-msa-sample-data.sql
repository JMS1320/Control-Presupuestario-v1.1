-- Actualizar los datos de ejemplo en msa_galicia para usar los nuevos códigos de cuentas
UPDATE msa_galicia SET 
  categ = 'VTA AGRIC',
  grupo_concepto = 'VENTAS AGRICOLAS',
  concepto = 'Venta de granos',
  descripcion = 'Venta de soja y maíz'
WHERE descripcion = 'Venta productos enero';

UPDATE msa_galicia SET 
  categ = 'VTA GAN',
  grupo_concepto = 'VENTAS GANADERIA',
  concepto = 'Venta de hacienda',
  descripcion = 'Venta de novillos'
WHERE descripcion = 'Servicios adicionales';

UPDATE msa_galicia SET 
  categ = 'COMB',
  grupo_concepto = 'GASTOS OPERATIVOS',
  concepto = 'Combustible para maquinaria',
  descripcion = 'Gasoil para tractores'
WHERE descripcion = 'Gastos operativos';

UPDATE msa_galicia SET 
  categ = 'VTA VARIOS',
  grupo_concepto = 'VENTAS VARIAS',
  concepto = 'Ventas diversas',
  descripcion = 'Venta de productos varios'
WHERE descripcion = 'Venta febrero';

UPDATE msa_galicia SET 
  categ = 'INV GAN',
  grupo_concepto = 'INVERSIONES',
  concepto = 'Inversión en ganadería',
  descripcion = 'Compra de reproductores'
WHERE descripcion = 'Inversión equipos';

UPDATE msa_galicia SET 
  categ = 'DIST HNOS',
  grupo_concepto = 'DISTRIBUCIONES',
  concepto = 'Distribución entre hermanos',
  descripcion = 'Reparto de utilidades hermanos'
WHERE descripcion = 'Distribución utilidades';
