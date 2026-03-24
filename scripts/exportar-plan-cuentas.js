const XLSX = require('xlsx')
const path = require('path')

// ─── DATOS CUENTAS CONTABLES (Facturas) ───────────────────────────────────────
const cuentasContables = [
  { categ: "RETENCIONES DE IVA", nro_cuenta: "112104", tipo: "ingreso", imputable: true, totalizadora: "1121", nombre_totalizadora: "CREDITOS FISCALES" },
  { categ: "RETENCIONES IIBB", nro_cuenta: "112107", tipo: "ingreso", imputable: true, totalizadora: "1121", nombre_totalizadora: "CREDITOS FISCALES" },
  { categ: "RETENCIONES DE GANANCIAS", nro_cuenta: "112111", tipo: "ingreso", imputable: true, totalizadora: "1121", nombre_totalizadora: "CREDITOS FISCALES" },
  { categ: "RESULTADOS", nro_cuenta: "4", tipo: "NO", imputable: false, totalizadora: null, nombre_totalizadora: null },
  { categ: "INGRESOS", nro_cuenta: "41", tipo: "ingreso", imputable: false, totalizadora: "4", nombre_totalizadora: "RESULTADOS" },
  { categ: "VENTA DE CEREALES", nro_cuenta: "4101", tipo: "ingreso", imputable: false, totalizadora: "41", nombre_totalizadora: "INGRESOS" },
  { categ: "VENTA SOJA", nro_cuenta: "410101", tipo: "ingreso", imputable: true, totalizadora: "4101", nombre_totalizadora: "VENTA DE CEREALES" },
  { categ: "VENTA MAIZ", nro_cuenta: "410102", tipo: "ingreso", imputable: true, totalizadora: "4101", nombre_totalizadora: "VENTA DE CEREALES" },
  { categ: "VENTA SORGO", nro_cuenta: "410103", tipo: "ingreso", imputable: true, totalizadora: "4101", nombre_totalizadora: "VENTA DE CEREALES" },
  { categ: "VENTA TRIGO", nro_cuenta: "410104", tipo: "ingreso", imputable: true, totalizadora: "4101", nombre_totalizadora: "VENTA DE CEREALES" },
  { categ: "VENTA BIENES DE USO", nro_cuenta: "4102", tipo: "ingreso", imputable: true, totalizadora: "41", nombre_totalizadora: "INGRESOS" },
  { categ: "VENTAS VARIAS", nro_cuenta: "4103", tipo: "ingreso", imputable: true, totalizadora: "41", nombre_totalizadora: "INGRESOS" },
  { categ: "VENTA DE HACIENDA", nro_cuenta: "4108", tipo: "ingreso", imputable: false, totalizadora: "41", nombre_totalizadora: "INGRESOS" },
  { categ: "VENTA GORDO MACHO Y HEMBRA", nro_cuenta: "410801", tipo: "ingreso", imputable: true, totalizadora: "4108", nombre_totalizadora: "VENTA DE HACIENDA" },
  { categ: "VENTA DESCARTE (cut, vacia, toro)", nro_cuenta: "410802", tipo: "ingreso", imputable: true, totalizadora: "4108", nombre_totalizadora: "VENTA DE HACIENDA" },
  { categ: "OTRAS VENTAS", nro_cuenta: "410803", tipo: "ingreso", imputable: true, totalizadora: "4108", nombre_totalizadora: "VENTA DE HACIENDA" },
  { categ: "VENTA DESTETE MACHO Y HEMBRA", nro_cuenta: "410804", tipo: "ingreso", imputable: true, totalizadora: "4108", nombre_totalizadora: "VENTA DE HACIENDA" },
  { categ: "VENTA INVERNADA MACHO Y HEMBRA", nro_cuenta: "410805", tipo: "ingreso", imputable: true, totalizadora: "4108", nombre_totalizadora: "VENTA DE HACIENDA" },
  { categ: "VENTA TOROS REPRODUCCION", nro_cuenta: "410806", tipo: "ingreso", imputable: true, totalizadora: "4108", nombre_totalizadora: "VENTA DE HACIENDA" },
  { categ: "VENTA GORDO MACHO", nro_cuenta: "410807", tipo: "ingreso", imputable: false, totalizadora: "4108", nombre_totalizadora: "VENTA DE HACIENDA" },
  { categ: "VENTA GORDO HEMBRA", nro_cuenta: "410808", tipo: "ingreso", imputable: false, totalizadora: "4108", nombre_totalizadora: "VENTA DE HACIENDA" },
  { categ: "VENTA DESTETE MACHO", nro_cuenta: "410809", tipo: "ingreso", imputable: false, totalizadora: "4108", nombre_totalizadora: "VENTA DE HACIENDA" },
  { categ: "VENTA DESTETE HEMBRA", nro_cuenta: "410810", tipo: "ingreso", imputable: false, totalizadora: "4108", nombre_totalizadora: "VENTA DE HACIENDA" },
  { categ: "VENTA INVERNADA MACHO", nro_cuenta: "410811", tipo: "ingreso", imputable: false, totalizadora: "4108", nombre_totalizadora: "VENTA DE HACIENDA" },
  { categ: "VENTA INVERNADA HEMBRA", nro_cuenta: "410812", tipo: "ingreso", imputable: false, totalizadora: "4108", nombre_totalizadora: "VENTA DE HACIENDA" },
  { categ: "VENTA VACAS Y VAQUILLONAS REPRODUCCION", nro_cuenta: "410813", tipo: "ingreso", imputable: false, totalizadora: "4108", nombre_totalizadora: "VENTA DE HACIENDA" },
  { categ: "ARRENDAMIENTOS Venta", nro_cuenta: "4109", tipo: "ingreso", imputable: true, totalizadora: "41", nombre_totalizadora: "INGRESOS" },
  { categ: "EGRESOS", nro_cuenta: "42", tipo: "egreso", imputable: false, totalizadora: "4", nombre_totalizadora: "RESULTADOS" },
  { categ: "EGRESOS POR AGRICULTURA", nro_cuenta: "421", tipo: "egreso", imputable: false, totalizadora: "42", nombre_totalizadora: "EGRESOS" },
  { categ: "INSUMOS", nro_cuenta: "4211", tipo: "egreso", imputable: false, totalizadora: "421", nombre_totalizadora: "EGRESOS POR AGRICULTURA" },
  { categ: "SEMILLAS", nro_cuenta: "421101", tipo: "egreso", imputable: true, totalizadora: "4211", nombre_totalizadora: "INSUMOS" },
  { categ: "TRATAMIENTO DE SEMILLA", nro_cuenta: "421102", tipo: "egreso", imputable: true, totalizadora: "4211", nombre_totalizadora: "INSUMOS" },
  { categ: "HERBICIDAS", nro_cuenta: "421103", tipo: "egreso", imputable: true, totalizadora: "4211", nombre_totalizadora: "INSUMOS" },
  { categ: "INSECTICIDAS", nro_cuenta: "421104", tipo: "egreso", imputable: true, totalizadora: "4211", nombre_totalizadora: "INSUMOS" },
  { categ: "FUNGICIDAS", nro_cuenta: "421105", tipo: "egreso", imputable: true, totalizadora: "4211", nombre_totalizadora: "INSUMOS" },
  { categ: "FERTILIZANTES", nro_cuenta: "421106", tipo: "egreso", imputable: true, totalizadora: "4211", nombre_totalizadora: "INSUMOS" },
  { categ: "MEJORADORES DE AGUA", nro_cuenta: "421107", tipo: "egreso", imputable: true, totalizadora: "4211", nombre_totalizadora: "INSUMOS" },
  { categ: "COADYUVANTE / ACEITE", nro_cuenta: "421108", tipo: "egreso", imputable: true, totalizadora: "4211", nombre_totalizadora: "INSUMOS" },
  { categ: "INSUMOS VARIOS", nro_cuenta: "421111", tipo: "egreso", imputable: true, totalizadora: "4211", nombre_totalizadora: "INSUMOS" },
  { categ: "FLETE INSUMOS", nro_cuenta: "421112", tipo: "egreso", imputable: true, totalizadora: "4211", nombre_totalizadora: "INSUMOS" },
  { categ: "AGROQUIMICOS", nro_cuenta: "421113", tipo: "egreso", imputable: true, totalizadora: "4211", nombre_totalizadora: "INSUMOS" },
  { categ: "LABORES", nro_cuenta: "4212", tipo: "egreso", imputable: false, totalizadora: "42", nombre_totalizadora: "EGRESOS" },
  { categ: "SIEMBRA", nro_cuenta: "421200", tipo: "egreso", imputable: true, totalizadora: "4212", nombre_totalizadora: "LABORES" },
  { categ: "LABRANZAS", nro_cuenta: "421201", tipo: "egreso", imputable: true, totalizadora: "4212", nombre_totalizadora: "LABORES" },
  { categ: "PULVERIZACION AEREA", nro_cuenta: "421202", tipo: "egreso", imputable: true, totalizadora: "4212", nombre_totalizadora: "LABORES" },
  { categ: "PULVERIZACION TERRESTRE", nro_cuenta: "421203", tipo: "egreso", imputable: true, totalizadora: "4212", nombre_totalizadora: "LABORES" },
  { categ: "FERTILIZACION", nro_cuenta: "421204", tipo: "egreso", imputable: true, totalizadora: "4212", nombre_totalizadora: "LABORES" },
  { categ: "COSECHA", nro_cuenta: "421205", tipo: "egreso", imputable: true, totalizadora: "4212", nombre_totalizadora: "LABORES" },
  { categ: "ANALISIS DE SUELO", nro_cuenta: "421206", tipo: "egreso", imputable: true, totalizadora: "4212", nombre_totalizadora: "LABORES" },
  { categ: "ANALISIS DE SEMILLA", nro_cuenta: "421207", tipo: "egreso", imputable: true, totalizadora: "4212", nombre_totalizadora: "LABORES" },
  { categ: "CLASIFICACION DE SEMILLA", nro_cuenta: "421208", tipo: "egreso", imputable: true, totalizadora: "4212", nombre_totalizadora: "LABORES" },
  { categ: "SILO BOLSA LABOR", nro_cuenta: "421210", tipo: "egreso", imputable: true, totalizadora: "4212", nombre_totalizadora: "LABORES" },
  { categ: "JORNALEROS - Labores Varias", nro_cuenta: "421211", tipo: "egreso", imputable: true, totalizadora: "4212", nombre_totalizadora: "LABORES" },
  { categ: "COMERCIALIZACION", nro_cuenta: "4213", tipo: "egreso", imputable: false, totalizadora: "42", nombre_totalizadora: "EGRESOS" },
  { categ: "FLETES CEREALES", nro_cuenta: "421301", tipo: "egreso", imputable: true, totalizadora: "4213", nombre_totalizadora: "COMERCIALIZACION" },
  { categ: "GASTOS ACONDICIONAMIENTO CEREAL", nro_cuenta: "421302", tipo: "egreso", imputable: true, totalizadora: "4213", nombre_totalizadora: "COMERCIALIZACION" },
  { categ: "GASTOS VARIOS COMERCIALIZACION", nro_cuenta: "421303", tipo: "egreso", imputable: true, totalizadora: "4213", nombre_totalizadora: "COMERCIALIZACION" },
  { categ: "ALMACENAJE", nro_cuenta: "421304", tipo: "egreso", imputable: true, totalizadora: "4213", nombre_totalizadora: "COMERCIALIZACION" },
  { categ: "SELLADOS", nro_cuenta: "421308", tipo: "egreso", imputable: true, totalizadora: "4213", nombre_totalizadora: "COMERCIALIZACION" },
  { categ: "COMISIONES", nro_cuenta: "421309", tipo: "egreso", imputable: true, totalizadora: "4213", nombre_totalizadora: "COMERCIALIZACION" },
  { categ: "GASTOS VARIOS AGRICULTURA", nro_cuenta: "4214", tipo: "egreso", imputable: true, totalizadora: "42", nombre_totalizadora: "EGRESOS" },
  { categ: "SEGUROS CULTIVO", nro_cuenta: "4217", tipo: "egreso", imputable: true, totalizadora: "42", nombre_totalizadora: "EGRESOS" },
  { categ: "EGRESOS POR ADMINISTRACION Y ESTRUCTURA", nro_cuenta: "422", tipo: "egreso", imputable: false, totalizadora: "42", nombre_totalizadora: "EGRESOS" },
  { categ: "ADMINISTRACION Y ESTRUCTURA", nro_cuenta: "4221", tipo: "egreso", imputable: false, totalizadora: "422", nombre_totalizadora: "EGRESOS POR ADMINISTRACION Y ESTRUCTURA" },
  { categ: "ARRENDAMIENTOS AGRICOLAS Compra", nro_cuenta: "422102", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "ASESORAMIENTO CONTABLE", nro_cuenta: "422104", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "COMBUSTIBLES Y LUBRICANTES", nro_cuenta: "422106", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "GASTOS OFICINA", nro_cuenta: "422108", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "GASTOS VARIOS ESTRUCTURA", nro_cuenta: "422109", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "HONORARIOS VARIOS", nro_cuenta: "422110", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "REPUESTOS Y REPARACIONES", nro_cuenta: "422112", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "SEGUROS ESTRUCTURA", nro_cuenta: "422113", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "HONORARIOS ESCRIBANIA", nro_cuenta: "422114", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "SUPERMERCADOS Y CARNICERIA", nro_cuenta: "422115", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "LUZ", nro_cuenta: "422118", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "TELEFONOS E INTERNET BS. AS.", nro_cuenta: "422119", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "PEAJES, VIATICOS, FLETES ESTRUCTURA", nro_cuenta: "422120", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "INFORMATICA", nro_cuenta: "422122", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "TELEFONOS E INTERNET SAN PEDRO", nro_cuenta: "422123", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "HONORARIOS LEGALES", nro_cuenta: "422124", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "HONORARIOS SOCIO GERENTE", nro_cuenta: "422126", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "SEGURIDAD Y ALARMA", nro_cuenta: "422127", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "GASTOS MEDICOS", nro_cuenta: "422130", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "GASTOS DE REPRESENTACION", nro_cuenta: "422131", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "INTERESES", nro_cuenta: "422132", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "CAPACITACIONES E INVESTIGACION", nro_cuenta: "422133", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "GAS", nro_cuenta: "422134", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "AUTOMOTORES REP Y MANTENIMIENTO", nro_cuenta: "422135", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "HONORARIOS AMS", nro_cuenta: "422136", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "HONORARIOS JMS", nro_cuenta: "422137", tipo: "egreso", imputable: true, totalizadora: "4221", nombre_totalizadora: "ADMINISTRACION Y ESTRUCTURA" },
  { categ: "EGRESOS POR GANADERIA", nro_cuenta: "423", tipo: "egreso", imputable: false, totalizadora: "42", nombre_totalizadora: "EGRESOS" },
  { categ: "HONORARIOS VETERINARIO", nro_cuenta: "42301", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "COMPRA DE HACIENDA", nro_cuenta: "42302", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "GASTOS DE COMERCIALIZACION", nro_cuenta: "42303", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "FLETES GANADERIA", nro_cuenta: "42304", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "GASTOS DE ALIMENTACION", nro_cuenta: "42305", tipo: "egreso", imputable: false, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "MAIZ", nro_cuenta: "4230501", tipo: "egreso", imputable: true, totalizadora: "42305", nombre_totalizadora: "GASTOS DE ALIMENTACION" },
  { categ: "ALIMENTO BALANCEADO", nro_cuenta: "4230502", tipo: "egreso", imputable: true, totalizadora: "42305", nombre_totalizadora: "GASTOS DE ALIMENTACION" },
  { categ: "LIMITADOR DE CONSUMO", nro_cuenta: "4230503", tipo: "egreso", imputable: true, totalizadora: "42305", nombre_totalizadora: "GASTOS DE ALIMENTACION" },
  { categ: "CONCENTRADO", nro_cuenta: "4230504", tipo: "egreso", imputable: true, totalizadora: "42305", nombre_totalizadora: "GASTOS DE ALIMENTACION" },
  { categ: "SALES MINERALES", nro_cuenta: "4230505", tipo: "egreso", imputable: true, totalizadora: "42305", nombre_totalizadora: "GASTOS DE ALIMENTACION" },
  { categ: "ROLLOS", nro_cuenta: "4230506", tipo: "egreso", imputable: true, totalizadora: "42305", nombre_totalizadora: "GASTOS DE ALIMENTACION" },
  { categ: "GASTOS VARIOS GANADERIA", nro_cuenta: "42306", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "INSUMOS VETERINARIOS", nro_cuenta: "42307", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "MATERIALES GANADERIA", nro_cuenta: "42310", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "FERTILIZANTE GANADERIA", nro_cuenta: "42312", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "INSTALACIONES GANADERIA", nro_cuenta: "42313", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "ASESOR GANADERO", nro_cuenta: "42314", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "SIEMBRA FORRAJERA GANADERIA", nro_cuenta: "42315", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "IATF", nro_cuenta: "42316", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "TOSCA DESTAPE ETC", nro_cuenta: "42317", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "ARRENDAMIENTOS GANADEROS Compra", nro_cuenta: "42318", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "ANALISIS VARIOS GANADERIA", nro_cuenta: "42320", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "SEMILLAS GANADERIA", nro_cuenta: "42321", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "AGROQUIMICOS GANADERIA", nro_cuenta: "42322", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "PULVERIZACIONES GANADERIA", nro_cuenta: "42323", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "LABRANZAS GANADERIA", nro_cuenta: "42324", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "AGUADAS", nro_cuenta: "42325", tipo: "egreso", imputable: true, totalizadora: "423", nombre_totalizadora: "EGRESOS POR GANADERIA" },
  { categ: "EGRESOS POR MAQUINARIAS Y HERR", nro_cuenta: "425", tipo: "egreso", imputable: false, totalizadora: "42", nombre_totalizadora: "EGRESOS" },
  { categ: "COMBUST. Y LUB.MAQ. Y HERRAM.", nro_cuenta: "42501", tipo: "egreso", imputable: true, totalizadora: "425", nombre_totalizadora: "EGRESOS POR MAQUINARIAS Y HERR" },
  { categ: "REPUESTOS Y REP. MAQ. Y HERR.", nro_cuenta: "42502", tipo: "egreso", imputable: true, totalizadora: "425", nombre_totalizadora: "EGRESOS POR MAQUINARIAS Y HERR" },
  { categ: "CAMARAS Y CUBIERTAS", nro_cuenta: "42503", tipo: "egreso", imputable: true, totalizadora: "425", nombre_totalizadora: "EGRESOS POR MAQUINARIAS Y HERR" },
]

// ─── DATOS CUENTAS TEMPLATES ──────────────────────────────────────────────────
const cuentasTemplates = [
  { categ: "ABL Cochera Posadas", responsable: "PAM", centro_costo: "Cochera Posadas", codigo_contable: "No Lleva", codigo_interno: "No Lleva", cant_cuotas: 13 },
  { categ: "ABL Libertad", responsable: "PAM", centro_costo: "Libertad", codigo_contable: "LIB", codigo_interno: "DIST MA", cant_cuotas: 13 },
  { categ: "ABL Libertad Cochera", responsable: "Duhau", centro_costo: "Libertad", codigo_contable: "LIB", codigo_interno: "DIST MA", cant_cuotas: 1 },
  { categ: "CAJA", responsable: "MSA", centro_costo: "", codigo_contable: "No Lleva", codigo_interno: "No Lleva", cant_cuotas: 12 },
  { categ: "Distribucion Andres", responsable: "PAM", centro_costo: "", codigo_contable: "DIST AMS", codigo_interno: "DIST AMS", cant_cuotas: 2 },
  { categ: "Distribucion Jose", responsable: "PAM", centro_costo: "", codigo_contable: "DIST JMS", codigo_interno: "DIST JMS", cant_cuotas: 2 },
  { categ: "Distribucion Mama", responsable: "MSA/PAM", centro_costo: "", codigo_contable: "CTA MA", codigo_interno: "DIST MA", cant_cuotas: 14 },
  { categ: "Distribucion Manuel", responsable: "PAM", centro_costo: "", codigo_contable: "DIST MANU", codigo_interno: "DIST MANU", cant_cuotas: 2 },
  { categ: "Distribucion Mechi", responsable: "PAM", centro_costo: "", codigo_contable: "DIST MECHI", codigo_interno: "DIST MECHI", cant_cuotas: 2 },
  { categ: "Distribucion Soledad", responsable: "PAM", centro_costo: "", codigo_contable: "DIST SOLE", codigo_interno: "DIST SOLE", cant_cuotas: 2 },
  { categ: "Expensas Cochera Posadas", responsable: "PAM", centro_costo: "Cochera Posadas", codigo_contable: "No Lleva", codigo_interno: "No Lleva", cant_cuotas: 12 },
  { categ: "Expensas Libertad", responsable: "PAM", centro_costo: "Libertad", codigo_contable: "LIB", codigo_interno: "DIST MA", cant_cuotas: 12 },
  { categ: "FCI", responsable: "MSA / PAM", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 2 },
  { categ: "Fijos Libertad", responsable: "PAM", centro_costo: "Libertad", codigo_contable: "LIB", codigo_interno: "DIST MA", cant_cuotas: 24 },
  { categ: "Impuesto Automotores", responsable: "MSA", centro_costo: "Gol / Tiguan / Toyota / Voyage", codigo_contable: "No Lleva", codigo_interno: "DIST JMS / DIST MA / No Lleva", cant_cuotas: 21 },
  { categ: "Impuesto IIBB", responsable: "MSA / PAM", centro_costo: "Estructura", codigo_contable: "No lleva", codigo_interno: "No lleva", cant_cuotas: 24 },
  { categ: "Impuesto inmobiliario", responsable: "MSA / PAM / MA", centro_costo: "Nazarenas / Rojas / Q.Rosello / Lima / Lote Puerto", codigo_contable: "No lleva", codigo_interno: "No lleva", cant_cuotas: 100 },
  { categ: "Impuesto inmobiliario Complementario", responsable: "MSA / PAM", centro_costo: "Estructura", codigo_contable: "", codigo_interno: "", cant_cuotas: 10 },
  { categ: "Impuesto Red Vial", responsable: "MSA / PAM / MA", centro_costo: "Nazarenas / Rojas / Q.Rosello / Lima / Lote Puerto", codigo_contable: "No Lleva", codigo_interno: "No Lleva", cant_cuotas: 109 },
  { categ: "Impuestos ARCA", responsable: "MSA / PAM / MA", centro_costo: "Estructura", codigo_contable: "", codigo_interno: "", cant_cuotas: 30 },
  { categ: "Impuestos Laborales ARCA", responsable: "MSA", centro_costo: "Estructura", codigo_contable: "", codigo_interno: "", cant_cuotas: 24 },
  { categ: "Retenciones ARCA", responsable: "MSA", centro_costo: "Estructura", codigo_contable: "No lleva", codigo_interno: "No lleva", cant_cuotas: 24 },
  { categ: "Seguros Estructura", responsable: "MSA", centro_costo: "Estructura", codigo_contable: "No Lleva", codigo_interno: "Desglosar / No Lleva", cant_cuotas: 24 },
  { categ: "Sueldos y Jornales", responsable: "MSA / PAM / MSA/PAM", centro_costo: "Estructura", codigo_contable: "CTA AMS / CTA JMS / No Lleva", codigo_interno: "No Lleva", cant_cuotas: 100 },
  { categ: "Tarjetas MSA", responsable: "MSA", centro_costo: "", codigo_contable: "Desglosar", codigo_interno: "Desglosar", cant_cuotas: 12 },
  { categ: "Tarjetas PAM", responsable: "PAM", centro_costo: "", codigo_contable: "Desglosar", codigo_interno: "Desglosar", cant_cuotas: 24 },
  { categ: "Transferencias Interbancarias", responsable: "MSA", centro_costo: "", codigo_contable: "No Lleva", codigo_interno: "No Lleva", cant_cuotas: 4 },
  { categ: "Viaticos", responsable: "MSA", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 2 },
  // ── Gastos Bancarios (nuevos 2026-03-24) ──
  { categ: "Comision Cuenta Bancaria",       responsable: "MSA / PAM", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 0 },
  { categ: "Comision Transferencias",        responsable: "MSA / PAM", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 0 },
  { categ: "Comision Cheques",               responsable: "MSA / PAM", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 0 },
  { categ: "Comision Caja de Seguridad",     responsable: "MSA / PAM", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 0 },
  { categ: "Comision Certificaciones de Firma", responsable: "MSA / PAM", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 0 },
  { categ: "Comision Extraccion Efectivo",   responsable: "MSA / PAM", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 0 },
  { categ: "Com. Uso Atm",                   responsable: "MSA / PAM", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 0 },
  // ── Impuestos Bancarios (nuevos 2026-03-24) ──
  { categ: "Debitos / Creditos",             responsable: "MSA / PAM", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 0 },
  { categ: "IIBB Bancario",                  responsable: "MSA / PAM", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 0 },
  { categ: "Impuesto Pais",                  responsable: "MSA / PAM", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 0 },
  { categ: "Iva Bancario",                   responsable: "MSA / PAM", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 0 },
  { categ: "Percepcion IVA",                 responsable: "MSA / PAM", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 0 },
  { categ: "Percepcion Rg 5463/23",          responsable: "MSA / PAM", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 0 },
  { categ: "Sellos Bancario",                responsable: "MSA / PAM", centro_costo: "", codigo_contable: "", codigo_interno: "", cant_cuotas: 0 },
]

// ─── CREAR WORKBOOK ───────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new()

// ── SOLAPA 1: Cuentas Contables (Facturas) ──
const ws1Data = [
  ["Nro Cuenta", "CATEG (código en sistema)", "Tipo", "Imputable", "Cta Totalizadora", "Nombre Totalizadora"],
  ...cuentasContables.map(r => [
    r.nro_cuenta,
    r.categ,
    r.tipo,
    r.imputable ? "SÍ" : "NO",
    r.totalizadora || "",
    r.nombre_totalizadora || "",
  ])
]
const ws1 = XLSX.utils.aoa_to_sheet(ws1Data)

// Anchos de columna
ws1['!cols'] = [
  { wch: 12 }, { wch: 45 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 40 }
]

// Congelar primera fila
ws1['!freeze'] = { xSplit: 0, ySplit: 1 }

XLSX.utils.book_append_sheet(wb, ws1, "Cuentas Contables (Facturas)")

// ── SOLAPA 2: Cuentas Templates ──
const ws2Data = [
  ["CATEG (código en sistema)", "Responsable", "Centro de Costo", "Código Contable", "Código Interno", "Cant Cuotas BD"],
  ...cuentasTemplates.map(r => [
    r.categ,
    r.responsable,
    r.centro_costo,
    r.codigo_contable,
    r.codigo_interno,
    r.cant_cuotas,
  ])
]
const ws2 = XLSX.utils.aoa_to_sheet(ws2Data)

ws2['!cols'] = [
  { wch: 35 }, { wch: 18 }, { wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 14 }
]
ws2['!freeze'] = { xSplit: 0, ySplit: 1 }

XLSX.utils.book_append_sheet(wb, ws2, "Cuentas Templates")

// ── SOLAPA 3: Comparación Reglas vs Templates ──
// Estado actualizado 2026-03-24: todas las categ de reglas unificadas con templates
const reglas = [
  { categ_regla: "Comision Cuenta Bancaria",       cant_reglas: 2, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Gastos Bancarios" },
  { categ_regla: "Comision Transferencias",        cant_reglas: 3, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Gastos Bancarios" },
  { categ_regla: "Comision Cheques",               cant_reglas: 6, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Gastos Bancarios" },
  { categ_regla: "Comision Caja de Seguridad",     cant_reglas: 2, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Gastos Bancarios" },
  { categ_regla: "Comision Certificaciones de Firma", cant_reglas: 1, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Gastos Bancarios" },
  { categ_regla: "Comision Extraccion Efectivo",   cant_reglas: 1, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Gastos Bancarios" },
  { categ_regla: "Com. Uso Atm",                   cant_reglas: 1, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Gastos Bancarios" },
  { categ_regla: "CRED P",                         cant_reglas: 1, en_cuentas: "NO", en_templates: "NO — pendiente", cuenta_agrupadora: "Gastos Bancarios (pendiente)" },
  { categ_regla: "Debitos / Creditos",             cant_reglas: 7, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Impuestos Bancarios" },
  { categ_regla: "IIBB Bancario",                  cant_reglas: 2, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Impuestos Bancarios" },
  { categ_regla: "Impuesto Pais",                  cant_reglas: 2, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Impuestos Bancarios" },
  { categ_regla: "Iva Bancario",                   cant_reglas: 1, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Impuestos Bancarios" },
  { categ_regla: "Percepcion IVA",                 cant_reglas: 1, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Impuestos Bancarios" },
  { categ_regla: "Percepcion Rg 5463/23",          cant_reglas: 2, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Impuestos Bancarios" },
  { categ_regla: "Sellos Bancario",                cant_reglas: 1, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Impuestos Bancarios" },
  { categ_regla: "FCI",                            cant_reglas: 2, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Inversiones" },
  { categ_regla: "CAJA",                           cant_reglas: 2, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Movimientos Internos empresa" },
  { categ_regla: "Tarjetas MSA",                   cant_reglas: 1, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Tarjetas" },
  { categ_regla: "Tarjetas PAM",                   cant_reglas: 1, en_cuentas: "NO", en_templates: "SÍ", cuenta_agrupadora: "Tarjetas" },
  { categ_regla: "ASES",                           cant_reglas: 1, en_cuentas: "NO", en_templates: "NO — desactivada", cuenta_agrupadora: "—" },
]

const ws3Data = [
  ["Categ en Reglas", "# Reglas", "Existe en Cuentas Contables", "Existe en Templates", "Cuenta Agrupadora"],
  ...reglas.map(r => [r.categ_regla, r.cant_reglas, r.en_cuentas, r.en_templates, r.cuenta_agrupadora])
]
const ws3 = XLSX.utils.aoa_to_sheet(ws3Data)
ws3['!cols'] = [{ wch: 32 }, { wch: 10 }, { wch: 26 }, { wch: 22 }, { wch: 35 }]
ws3['!freeze'] = { xSplit: 0, ySplit: 1 }

XLSX.utils.book_append_sheet(wb, ws3, "Comparacion Reglas")

// ── SOLAPA 4: Reglas de Conciliación ──
const reglasConc = [
  { orden: 1,  tipo: "impuestos", columna: "descripcion", texto: "Anulacion Percepcion Rg 5463/23",          match: "contiene", categ: "IMP 2",    detalle: "Percepcion Rg 5463/23",                        activo: true },
  { orden: 2,  tipo: "impuestos", columna: "descripcion", texto: "Percep. Iva",                              match: "contiene", categ: "IMP 2",    detalle: "Percepcion IVA",                               activo: true },
  { orden: 3,  tipo: "impuestos", columna: "descripcion", texto: "Iva",                                      match: "contiene", categ: "IMP 2",    detalle: "Iva Bancario",                                 activo: true },
  { orden: 4,  tipo: "impuestos", columna: "descripcion", texto: "Percepcion Rg 5463/23",                   match: "contiene", categ: "IMP 2",    detalle: "Percepcion Rg 5463/23",                        activo: true },
  { orden: 5,  tipo: "impuestos", columna: "descripcion", texto: "Dev.imp.deb.ley 25413",                   match: "contiene", categ: "IMP 2",    detalle: "Debitos / Creditos",                           activo: true },
  { orden: 6,  tipo: "impuestos", columna: "descripcion", texto: "Dev.imp.deb.ley 25413-alic.general",      match: "contiene", categ: "IMP 2",    detalle: "Debitos / Creditos",                           activo: true },
  { orden: 7,  tipo: "impuestos", columna: "descripcion", texto: "Devolucion Impuesto Pais Ley 27.541",     match: "contiene", categ: "IMP 2",    detalle: "Impuesto Pais",                                activo: true },
  { orden: 8,  tipo: "impuestos", columna: "descripcion", texto: "Imp. Cre. Ley 25413",                     match: "contiene", categ: "IMP 2",    detalle: "Debitos / Creditos",                           activo: true },
  { orden: 9,  tipo: "impuestos", columna: "descripcion", texto: "Imp. Cre. Ley 25413 Gral.",               match: "contiene", categ: "IMP 2",    detalle: "Debitos / Creditos",                           activo: true },
  { orden: 10, tipo: "impuestos", columna: "descripcion", texto: "Imp. Deb. Ley 25413",                     match: "contiene", categ: "IMP 2",    detalle: "Debitos / Creditos",                           activo: true },
  { orden: 11, tipo: "impuestos", columna: "descripcion", texto: "Imp. Deb. Ley 25413 Gral.",               match: "contiene", categ: "IMP 2",    detalle: "Debitos / Creditos",                           activo: true },
  { orden: 12, tipo: "impuestos", columna: "descripcion", texto: "Ing. Brutos S/ Cred",                     match: "contiene", categ: "IMP 2",    detalle: "IIBB Bancario",                                activo: true },
  { orden: 13, tipo: "impuestos", columna: "descripcion", texto: "Imp. Ing. Brutos",                        match: "contiene", categ: "IMP 2",    detalle: "IIBB Bancario",                                activo: true },
  { orden: 14, tipo: "impuestos", columna: "descripcion", texto: "Impuesto De Sellos",                      match: "contiene", categ: "IMP 2",    detalle: "Sellos Bancario",                              activo: true },
  { orden: 15, tipo: "impuestos", columna: "descripcion", texto: "Impuesto Deb.ley 25413 Extrac. Efect.",   match: "contiene", categ: "IMP 2",    detalle: "Debitos / Creditos",                           activo: true },
  { orden: 16, tipo: "impuestos", columna: "descripcion", texto: "Impuesto Pais Ley 27.541",                match: "contiene", categ: "IMP 2",    detalle: "Impuesto Pais",                                activo: true },
  { orden: 17, tipo: "bancarios", columna: "descripcion", texto: "Intereses Sobre Saldos Deudores",         match: "contiene", categ: "CRED P",   detalle: "Interes Descubierto",                          activo: true },
  { orden: 18, tipo: "bancarios", columna: "descripcion", texto: "Comision Mantenimiento Cta. Cte/cce",     match: "contiene", categ: "BANC",     detalle: "Comision Cuenta Bancaria",                     activo: true },
  { orden: 19, tipo: "bancarios", columna: "descripcion", texto: "Comision Servicio De Cuenta",             match: "contiene", categ: "BANC",     detalle: "Comision Cuenta Bancaria",                     activo: true },
  { orden: 20, tipo: "bancarios", columna: "descripcion", texto: "Devolucion Comisiones Por Transferencias",match: "contiene", categ: "BANC",     detalle: "Comision Transferencias",                      activo: true },
  { orden: 21, tipo: "bancarios", columna: "descripcion", texto: "Com. Caja De Seguridad",                  match: "contiene", categ: "BANC",     detalle: "Comision Caja de Seguridad",                   activo: true },
  { orden: 22, tipo: "bancarios", columna: "descripcion", texto: "Com. Cajas De Seguridad",                 match: "contiene", categ: "BANC",     detalle: "Comision Caja de Seguridad",                   activo: true },
  { orden: 23, tipo: "bancarios", columna: "descripcion", texto: "Com. Certif. Firma",                      match: "contiene", categ: "BANC",     detalle: "Comision Certificaciones de Firma",            activo: true },
  { orden: 24, tipo: "bancarios", columna: "descripcion", texto: "Com. Deposito De Cheq Bol.7271",          match: "contiene", categ: "BANC",     detalle: "Comision Cheques",                             activo: true },
  { orden: 25, tipo: "bancarios", columna: "descripcion", texto: "Com. Deposito De Cheque 165",             match: "contiene", categ: "BANC",     detalle: "Comision Cheques",                             activo: true },
  { orden: 26, tipo: "bancarios", columna: "descripcion", texto: "Com. Deposito De Cheque En Otra Suc",     match: "contiene", categ: "BANC",     detalle: "Comision Cheques",                             activo: true },
  { orden: 27, tipo: "bancarios", columna: "descripcion", texto: "Com. Gestion Transf.fdos Entre Bcos",     match: "contiene", categ: "BANC",     detalle: "Comision Transferencias",                      activo: true },
  { orden: 28, tipo: "bancarios", columna: "descripcion", texto: "Com. Movimientos",                        match: "contiene", categ: "BANC",     detalle: "Comision Transferencias",                      activo: true },
  { orden: 29, tipo: "bancarios", columna: "descripcion", texto: "Com. Operaciones Entre Casas Cheque",     match: "contiene", categ: "BANC",     detalle: "Comision Cheques",                             activo: true },
  { orden: 30, tipo: "bancarios", columna: "descripcion", texto: "Com. Uso Atm",                            match: "contiene", categ: "BANC",     detalle: "Com. Uso Atm",                                 activo: true },
  { orden: 31, tipo: "bancarios", columna: "descripcion", texto: "Comision Cheque Pagado Por Caja",         match: "contiene", categ: "BANC",     detalle: "Comision Cheques",                             activo: true },
  { orden: 32, tipo: "bancarios", columna: "descripcion", texto: "Comision Cheque Pagado Por Clearing",     match: "contiene", categ: "BANC",     detalle: "Comision Cheques",                             activo: true },
  { orden: 33, tipo: "bancarios", columna: "descripcion", texto: "Comision Entrega De Chequeras",           match: "contiene", categ: "BANC",     detalle: "Comision Cheques",                             activo: true },
  { orden: 34, tipo: "bancarios", columna: "descripcion", texto: "Comision Extraccion En Efectivo",         match: "contiene", categ: "BANC",     detalle: "Comision Extraccion Efectivo",                 activo: true },
  { orden: 35, tipo: "otras",     columna: "descripcion", texto: "Rescate Fima",                            match: "contiene", categ: "FCI",      detalle: "Rescate FIMA",                                 activo: true },
  { orden: 36, tipo: "otras",     columna: "descripcion", texto: "Suscripcion Fima",                        match: "contiene", categ: "FCI",      detalle: "Suscripcion FIMA",                             activo: true },
  { orden: 37, tipo: "otras",     columna: "descripcion", texto: "Extraccion En Autoservicio",              match: "contiene", categ: "CAJA",     detalle: "Extraccion a Caja",                            activo: true },
  { orden: 38, tipo: "otras",     columna: "descripcion", texto: "Compra Cash Back",                        match: "contiene", categ: "CAJA",     detalle: "Extraccion a Caja",                            activo: true },
  { orden: 39, tipo: "otras",     columna: "descripcion", texto: "Visa Bussines",                           match: "contiene", categ: "TJETA MSA",detalle: "Tarjeta Visa Bussines MSA",                    activo: true },
  { orden: 40, tipo: "otras",     columna: "descripcion", texto: "VISA PAM",                                match: "contiene", categ: "TJETA PAM",detalle: "Tarjeta Visa PAM",                             activo: true },
  { orden: 41, tipo: "otras",     columna: "descripcion", texto: "Smart Farming",                           match: "contiene", categ: "ASES",     detalle: "Smart Farming Actualizacion de Mercado Ganadero", activo: true },
]

const ws4Data = [
  ["Orden", "Tipo", "Columna Búsqueda", "Texto a Buscar", "Tipo Match", "CATEG asignada", "Detalle asignado", "Activo"],
  ...reglasConc.map(r => [r.orden, r.tipo, r.columna, r.texto, r.match, r.categ, r.detalle, r.activo ? "SÍ" : "NO"])
]
const ws4 = XLSX.utils.aoa_to_sheet(ws4Data)
ws4['!cols'] = [
  { wch: 7 }, { wch: 12 }, { wch: 18 }, { wch: 50 }, { wch: 10 }, { wch: 12 }, { wch: 45 }, { wch: 7 }
]
ws4['!freeze'] = { xSplit: 0, ySplit: 1 }
XLSX.utils.book_append_sheet(wb, ws4, "Reglas Conciliacion")

// ─── GUARDAR ──────────────────────────────────────────────────────────────────
const outputPath = path.join(__dirname, '..', 'Plan_Cuentas_2026-03-22.xlsx')
XLSX.writeFile(wb, outputPath)
console.log('✅ Excel generado:', outputPath)
