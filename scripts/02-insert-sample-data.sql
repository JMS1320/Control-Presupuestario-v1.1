-- Insertar datos en cuentas_contables
INSERT INTO cuentas_contables (codigo, cuenta_contable, tipo) VALUES
('ventas_1', 'Ventas 1', 'ingreso'),
('ventas_2', 'Ventas 2', 'ingreso'),
('egreso_1', 'Egreso 1', 'egreso'),
('egreso_2', 'Egreso 2', 'egreso'),
('egreso_3', 'Egreso 3', 'egreso'),
('inversion_1', 'Inversión 1', 'financiero'),
('distr_1', 'Distribución 1', 'distribucion');

-- Insertar datos ficticios en msa_galicia
INSERT INTO msa_galicia (fecha, descripcion, origen, debitos, creditos, saldo, control, categ, detalle, contable, interno, centro_costo, cuenta) VALUES
('2024-01-15', 'Venta productos enero', 'Transferencia', 0, 150000.50, 150000.50, 150000.50, 'ventas_1', 'Venta mensual productos', 'CONT001', 'INT001', 'CC001', 'CTA001'),
('2024-01-20', 'Servicios adicionales', 'Efectivo', 0, 75000.25, 225000.75, 225000.75, 'ventas_2', 'Servicios prestados', 'CONT002', 'INT002', 'CC002', 'CTA002'),
('2024-01-25', 'Gastos operativos', 'Débito automático', 45000.00, 0, 180000.75, 180000.75, 'egreso_1', 'Gastos mensuales', 'CONT003', 'INT003', 'CC001', 'CTA003'),
('2024-02-10', 'Venta febrero', 'Transferencia', 0, 200000.00, 380000.75, 380000.75, 'ventas_1', 'Venta mensual febrero', 'CONT004', 'INT004', 'CC001', 'CTA001'),
('2024-02-15', 'Inversión equipos', 'Transferencia', 80000.00, 0, 300000.75, 300000.75, 'inversion_1', 'Compra equipamiento', 'CONT005', 'INT005', 'CC003', 'CTA004'),
('2024-02-28', 'Distribución utilidades', 'Transferencia', 25000.00, 0, 275000.75, 275000.75, 'distr_1', 'Reparto utilidades', 'CONT006', 'INT006', 'CC004', 'CTA005');
