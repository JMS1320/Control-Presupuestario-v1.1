-- 282 · EL BALANCE PRESENTADO POR EL CONTADOR, CUENTA POR CUENTA — MSA, cierre 30/06/2026 (ESTRUCTURA + DATOS)  A-FEAT-1629
-- JMS 17/11: «es el definitivo» · «lo primero es asentar los datos» · tabla nueva: «ok».
--
-- De dónde sale: «- Comunicacion JMS Claude - Archivos/Balance/- Enviados/2026/Balance Presentado/Balance MS AGRO SRL 2026 .xlsx»
-- (balance de sumas y saldos: una hoja, 107 cuentas, sólo valores). Se copia TAL CUAL: capítulo, código de cuenta del contador,
-- denominación y saldo con SU signo (deudor positivo, acreedor negativo). Dos filas no traen código (Anticipos a Proveedores) o
-- capítulo (Costo de la ganadería): el capítulo se toma del bloque donde están; el código queda vacío.
-- Control (verificado al generar este script): Activo 1.323.911.258,57 · Pasivo −149.784.622,08 · PN −940.037.216,58 ·
-- Resultados −234.089.419,91 (ganancia) · suma 0,00 · 107 cuentas.
--
-- Qué crea: public.balance_contador_cuentas (no existía: verificado el 17/11 con to_regclass). Una fila por cuenta del balance
-- presentado, por empresa y fecha de cierre. `tratamiento` y `comentario` son TENTATIVOS y sólo están donde JMS explicó la cuenta:
--   sistema = sale de los movimientos cargados · cierre = lo determinamos nosotros al cierre · contador = lo calcula o lo da él.
-- Permisos: igual que el balance propio (scripts/75): RLS por sección, recurso `extracto`, lectura restringida, `anon` sin acceso.
-- Avisado a Javier ANTES (ENTRE-DESARROLLADORES). No toca ninguna tabla existente salvo 1 fila nueva en recurso_tablas.
-- Deshacer: 282-…-deshacer.sql.

begin;

create table public.balance_contador_cuentas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null check (empresa in ('MSA', 'PAM', 'MA')),
  fecha_cierre date not null,
  orden int not null,
  fila_planilla int,
  capitulo text not null,
  cuenta text,
  denominacion text not null,
  saldo numeric not null,
  nota_planilla text,
  tratamiento text check (tratamiento in ('sistema', 'cierre', 'contador')),
  comentario text,
  archivo_origen text,
  marca text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa, fecha_cierre, orden)
);

comment on table public.balance_contador_cuentas is
  'A-FEAT-1629 — balance presentado por el contador, cuenta por cuenta (sumas y saldos), por empresa y cierre. Dato duro: copia fiel de su planilla, saldo con su signo (deudor +, acreedor −). tratamiento/comentario: de dónde sale cada cuenta para el prebalance (sistema / cierre / contador), tentativo hasta que JMS lo confirme.';

alter table public.balance_contador_cuentas enable row level security;
create policy ver_segun_permiso on public.balance_contador_cuentas for select to authenticated using (public.puede_ver('public', 'balance_contador_cuentas'));
create policy escribir_segun_permiso on public.balance_contador_cuentas for all to authenticated
  using (public.puede_escribir('public', 'balance_contador_cuentas')) with check (public.puede_escribir('public', 'balance_contador_cuentas'));
revoke all on public.balance_contador_cuentas from anon;
grant select, insert, update, delete on public.balance_contador_cuentas to authenticated;
grant all on public.balance_contador_cuentas to service_role;
insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura)
  values ('public', 'balance_contador_cuentas', 'extracto', '[script 282] Balance presentado por el contador, cuenta por cuenta (A-FEAT-1629).', true)
  on conflict do nothing;

insert into public.balance_contador_cuentas
  (empresa, fecha_cierre, orden, fila_planilla, capitulo, cuenta, denominacion, saldo, nota_planilla, tratamiento, comentario, archivo_origen, marca)
select 'MSA', date '2026-06-30', v.orden, v.fila, v.capitulo, v.cuenta, v.denominacion, v.saldo, v.nota::text, v.tratamiento::text, v.comentario::text,
       'Balance MS AGRO SRL 2026 .xlsx (Balance/- Enviados/2026/Balance Presentado)', '[script 282]'
  from (values
  (1, 2, 'ACTIVO', '1.1.1/01/01', 'Caja (cash)', 4672164.87, null, null, null),
  (2, 3, 'ACTIVO', '1.1.1/01/03', 'CAJA DOLARES', 1160000.00, 'usd 800', null, null),
  (3, 4, 'ACTIVO', '1.1.1/02/01', 'Banco Santander Rio', 208814.82, null, null, null),
  (4, 5, 'ACTIVO', '1.1.1/02/02', 'Banco de la Provincia de Buenos Aires', -179053.43, null, null, null),
  (5, 6, 'ACTIVO', '1.1.1/02/07', 'Banco Galicia', -2261370.27, null, null, null),
  (6, 7, 'ACTIVO', '1.1.1/02/09', 'Banco Galicia cta. USD', 869579.50, null, null, null),
  (7, 8, 'ACTIVO', '1.1.3/01/01', 'Deudores por Ventas (accounts receivable-trade)', 50000850.00, null, 'cierre', 'Provisión de ventas (JMS 17/11: ventas del contador = libro diario + provisión de ventas)'),
  (8, 9, 'ACTIVO', '1.1.4/01/05', 'Retenciones Impuesto a las Ganancias', 18872189.78, null, 'contador', 'Dato fiscal que nos faltaba (JMS 17/11)'),
  (9, 10, 'ACTIVO', '1.1.4/01/14', 'Percepciones Imp. a las ganancias', 259692.28, null, 'contador', 'Dato fiscal que nos faltaba (JMS 17/11)'),
  (10, 11, 'ACTIVO', null, 'Anticipos a Proveedores', 23414265.26, null, null, null),
  (11, 12, 'ACTIVO', '1.1.4/02/03', 'Socia Soledad Martinez Sobrado', 13068000.00, null, null, null),
  (12, 13, 'ACTIVO', '1.1.4/02/04', 'Socia Mercedes martinez Sobrado (Hija)', 11682000.00, null, null, null),
  (13, 14, 'ACTIVO', '1.1.4/02/05', 'Socio Placido Martinez', 45905575.52, null, null, null),
  (14, 15, 'ACTIVO', '1.1.4/02/06', 'Socio Jose Martize sobrado', 13068000.27, null, null, null),
  (15, 16, 'ACTIVO', '1.1.4/02/07', 'Socia Mercedes Areco', 26460000.00, null, null, null),
  (16, 17, 'ACTIVO', '1.1.4/02/08', 'Socio Andres Martinez Sobrado', 13068000.00, null, null, null),
  (17, 18, 'ACTIVO', '1.1.4/02/09', 'Socio Manuel Martinez Sobrado', 12654000.00, null, null, null),
  (18, 19, 'ACTIVO', '1.1.4/03/01', 'IVA Saldo a Favor Tecnico(vat credit)', 18657003.88, null, 'contador', 'Dato fiscal que nos faltaba (JMS 17/11)'),
  (19, 20, 'ACTIVO', '1.1.4/03/03', 'IVA Saldo a Favor Libre Disponibilidad(vat credit)', 337160.55, null, 'contador', 'Dato fiscal que nos faltaba (JMS 17/11)'),
  (20, 21, 'ACTIVO', '1.1.4/03/06', 'Impuesto al Cheque (bank tax credit)', 1931152.86, null, 'sistema', 'Impuesto al cheque (débitos y créditos): lo tenemos, con diferencias que JMS no entiende (17/11)'),
  (21, 22, 'ACTIVO', '1.1.4/03/07', 'IVA CREDITO FISCAL a computar', 137765.76, null, 'contador', 'Dato fiscal que nos faltaba (JMS 17/11)'),
  (22, 23, 'ACTIVO', '1.1.4/03/08', 'Saldo a favor Impuesto a las Ganancias', 27790561.65, null, 'contador', 'Dato fiscal que nos faltaba (JMS 17/11)'),
  (23, 24, 'ACTIVO', '1.1.5/04/02', 'Equinos', 536919.86, null, 'contador', 'Bienes de uso y amortizaciones: a priori no los tenemos en cuenta (JMS 17/11)'),
  (24, 25, 'ACTIVO', '1.2.2/01/01', 'Inmuebles Valores originales', 575316634.25, null, 'contador', 'Bienes de uso y amortizaciones: a priori no los tenemos en cuenta (JMS 17/11)'),
  (25, 26, 'ACTIVO', '1.2.2/01/03', 'Amortizaciones Acumuladas Inmuebles', -45035015.63, null, 'contador', 'Bienes de uso y amortizaciones: a priori no los tenemos en cuenta (JMS 17/11)'),
  (26, 27, 'ACTIVO', '1.2.2/02/01', 'Herramientas', 4651697.10, null, 'contador', 'Bienes de uso y amortizaciones: a priori no los tenemos en cuenta (JMS 17/11)'),
  (27, 28, 'ACTIVO', '1.2.2/02/02', 'Maquinarias (Valor original)', 66839467.85, null, 'contador', 'Bienes de uso y amortizaciones: a priori no los tenemos en cuenta (JMS 17/11)'),
  (28, 29, 'ACTIVO', '1.2.2/02/03', 'Amortizacio Acumulada Maquinarias', -63656221.11, null, 'contador', 'Bienes de uso y amortizaciones: a priori no los tenemos en cuenta (JMS 17/11)'),
  (29, 30, 'ACTIVO', '1.2.2/02/04', 'Instalaciones Rurales', 7747758.69, null, 'contador', 'Bienes de uso y amortizaciones: a priori no los tenemos en cuenta (JMS 17/11)'),
  (30, 31, 'ACTIVO', '1.2.2/02/05', 'Amortizacion Acumulada Instalaciones', -3566871.82, null, 'contador', 'Bienes de uso y amortizaciones: a priori no los tenemos en cuenta (JMS 17/11)'),
  (31, 32, 'ACTIVO', '1.2.2/02/06', 'Amort. Acum herramientas', -3344454.43, null, 'contador', 'Bienes de uso y amortizaciones: a priori no los tenemos en cuenta (JMS 17/11)'),
  (32, 33, 'ACTIVO', '1.2.2/02/07', 'Rodados', 140571378.68, null, 'contador', 'Bienes de uso y amortizaciones: a priori no los tenemos en cuenta (JMS 17/11)'),
  (33, 34, 'ACTIVO', '1.2.2/02/08', 'Amortizacion Acumulada Rodados', -153163807.25, null, 'contador', 'Bienes de uso y amortizaciones: a priori no los tenemos en cuenta (JMS 17/11)'),
  (34, 35, 'ACTIVO', '1.2.2/03/01', 'Muebles y utiles Valor Oigen', 16266614.52, null, 'contador', 'Bienes de uso y amortizaciones: a priori no los tenemos en cuenta (JMS 17/11)'),
  (35, 36, 'ACTIVO', '1.2.2/03/03', 'Amort. Acum M. y Utiles (accumulate depreciation)', -15476423.25, null, 'contador', 'Bienes de uso y amortizaciones: a priori no los tenemos en cuenta (JMS 17/11)'),
  (36, 37, 'ACTIVO', '1.2.2/05/01', 'VACAS DE CRÍA', 496437859.00, null, 'contador', 'Valor contable propio del contador, distinto de nuestra valorización (JMS 17/11)'),
  (37, 38, 'ACTIVO', '1.2.2/05/04', 'INSUMOS PARA LA PRODUCCION GANADERA', 5209368.81, null, 'cierre', 'Bienes activados: compras facturadas que se activan; lo determinamos nosotros al cierre (JMS 17/11)'),
  (38, 39, 'ACTIVO', '1.2.5/01/03', 'Rollos y fardos', 12800000.00, null, 'cierre', 'Bienes activados: compras facturadas que se activan; lo determinamos nosotros al cierre (JMS 17/11)'),
  (39, 42, 'PASIVO', '2.1.1/01/01', 'Proveedores en Cta.Cte. (accounts payable-trade)', -6486568.02, null, null, null),
  (40, 43, 'PASIVO', '2.1.1/01/09', 'Tarjeta GALICIA rural', -2374.02, null, null, null),
  (41, 44, 'PASIVO', '2.1.1/01/10', 'TARJETA VISA BUSSINES GALICIA', -2473622.71, null, null, null),
  (42, 45, 'PASIVO', '2.1.2/02/01', 'SUSS a pagar (social security payable)', -2495547.51, null, null, null),
  (43, 46, 'PASIVO', '2.1.2/02/04', 'Cuota Solidaria a pagar', -85233.06, null, null, null),
  (44, 47, 'PASIVO', '2.1.3/02/02', 'Impuesto a las Ganancias a pagar', -18072967.28, null, 'contador', 'Impuesto del año (JMS 17/11)'),
  (45, 48, 'PASIVO', '2.2.1/03/00', 'Pasivo por impuesto diferido', -120168309.48, null, 'contador', 'Impuesto diferido: cálculo contable impositivo fino, sin incidencia; no se calcula (JMS 17/11)'),
  (46, 51, 'PATRIMONIO NETO', '3.1.1/01/00', 'Acciones en Circulación(share capital)', -43.10, null, 'contador', 'Patrimonio neto: no hay que calcularlo (JMS 17/11)'),
  (47, 52, 'PATRIMONIO NETO', '3.1.1/02/00', 'Aportes Irrevocables', -6115500.02, null, 'contador', 'Patrimonio neto: no hay que calcularlo (JMS 17/11)'),
  (48, 53, 'PATRIMONIO NETO', '3.1.2/00/00', 'Ajuste del Capital', -377191013.64, null, 'contador', 'Patrimonio neto: no hay que calcularlo (JMS 17/11)'),
  (49, 54, 'PATRIMONIO NETO', '3.3.1/00/00', 'Reserva Legal', -527.20, null, 'contador', 'Patrimonio neto: no hay que calcularlo (JMS 17/11)'),
  (50, 55, 'PATRIMONIO NETO', '3.3.2/00/00', 'Reserva Facultativa', -458530914.40, null, 'contador', 'Patrimonio neto: no hay que calcularlo (JMS 17/11)'),
  (51, 56, 'PATRIMONIO NETO', '3.4.2/00/00', 'Resultado ejercicios anteriores(retained earnings)', -98199218.22, null, 'contador', 'Patrimonio neto: no hay que calcularlo (JMS 17/11)'),
  (52, 59, 'RESULTADOS', '4.1.1/01/01', 'Arrendamientos', -315547862.29, null, 'sistema', 'Ventas = libro diario + provisión de ventas (JMS 17/11)'),
  (53, 60, 'RESULTADOS', '4.1.1/01/02', 'Venta de Cereal', -8944748.52, null, 'sistema', 'Ventas = libro diario + provisión de ventas (JMS 17/11)'),
  (54, 61, 'RESULTADOS', '4.1.1/01/03', 'Venta de Ganado', -150704492.50, null, 'sistema', 'Ventas = libro diario + provisión de ventas (JMS 17/11)'),
  (55, 62, 'RESULTADOS', '4.1.1/01/09', 'Venta de Bienes de Uso', -22624434.49, null, null, null),
  (56, 63, 'RESULTADOS', '4.1.1/01/11', 'Intereses ganados Inversiones', -2111472.89, null, null, null),
  (57, 64, 'RESULTADOS', '4.1.2/02/00', 'Resultado por tenencia de inversion permanente', -6983092.49, null, null, null),
  (58, 65, 'RESULTADOS', '4.1.2/03/00', 'Resultado por dif. de inventario', -240958804.10, null, 'contador', 'Valorización del stock ganadero, diferencia de inventario entre un balance y el otro (JMS 17/11, a su entender)'),
  (59, 66, 'RESULTADOS', '4.2.1/02/02', 'Costo de venta de Cereal', 6783718.42, null, 'cierre', 'Manda a gasto lo activado el año anterior más el stock de granos del año anterior (JMS 17/11, a su entender)'),
  (60, 67, 'RESULTADOS', '4.2.1/02/04', 'Laboreos para la siembra', 5890300.00, null, null, null),
  (61, 68, 'RESULTADOS', '4.2.1/02/05', 'Insumos para la ganaderia', 6402158.64, null, null, null),
  (62, 69, 'RESULTADOS', '4.2.1/02/06', 'Laboreos para la ganaderia', 3842810.00, null, null, null),
  (63, 70, 'RESULTADOS', '4.2.1/02/07', 'Campo Varios', 3470137.96, null, null, null),
  (64, 71, 'RESULTADOS', '4.2.1/02/08', 'Gastos Oficina Libertad', 13455558.69, null, null, null),
  (65, 72, 'RESULTADOS', '4.2.1/02/09', 'Costo de la ganaderia', 0.00, null, null, null),
  (66, 73, 'RESULTADOS', '4.2.1/02/10', 'Guias y dte Hacienda', 149107.39, null, null, null),
  (67, 74, 'RESULTADOS', '4.2.1/03/01', 'Sueldos (salarys)', 58588081.43, null, null, null),
  (68, 75, 'RESULTADOS', '4.2.1/03/02', 'Cargas Sociales (social security exp.)', 14253404.23, null, null, null),
  (69, 76, 'RESULTADOS', '4.2.1/03/03', 'Obra Social - Osde', 9172931.35, null, null, null),
  (70, 77, 'RESULTADOS', '4.2.1/03/06', 'Viáticos Administración(travelling & entertaiment)', 68099.17, null, null, null),
  (71, 78, 'RESULTADOS', '4.2.1/03/08', 'CUOTA SOLIDARIA', 746884.38, null, null, null),
  (72, 79, 'RESULTADOS', '4.2.1/03/12', 'Servicios públicos y telecomunicaciones', 9540698.53, null, null, null),
  (73, 80, 'RESULTADOS', '4.2.1/03/13', 'Alquiler campo', 25789518.68, null, 'cierre', 'Definido en la reunión: arrendamiento que MA le factura ahora a MSA; se provisiona como gasto de este balance y se da por pago contra el saldo de MA (JMS 17/11)'),
  (74, 81, 'RESULTADOS', '4.2.1/03/14', 'Seguros(Insurance)', 8555515.15, null, null, null),
  (75, 82, 'RESULTADOS', '4.2.1/03/15', 'Telefonía(Telephone)', 15760.01, null, null, null),
  (76, 83, 'RESULTADOS', '4.2.1/03/18', 'Gastos Bancarios(Bank charges)', 3629838.20, null, null, null),
  (77, 84, 'RESULTADOS', '4.2.1/03/19', 'Impuesto al cheque(bank tax)', 3920825.50, null, null, null),
  (78, 85, 'RESULTADOS', '4.2.1/03/20', 'Sistemas', 215000.00, null, null, null),
  (79, 86, 'RESULTADOS', '4.2.1/03/21', 'Gastos de certificaciones y legalizaciones', 451300.00, null, null, null),
  (80, 87, 'RESULTADOS', '4.2.1/03/22', 'Honorarios Contables(accountancy fees)', 15541155.34, null, null, null),
  (81, 88, 'RESULTADOS', '4.2.1/03/23', 'Honorarios Profesionales', 71793126.24, null, null, null),
  (82, 89, 'RESULTADOS', '4.2.1/03/25', 'Amortizaciones(Depresiation expense)', 9318754.75, null, 'contador', 'Afecta Ganancias; a decidir si lo calculamos nosotros en el balance en línea (JMS 17/11)'),
  (83, 90, 'RESULTADOS', '4.2.1/03/30', 'Mantenimiento y Reparacion de Instalaciones', 25755482.82, null, null, null),
  (84, 91, 'RESULTADOS', '4.2.1/03/31', 'GASTOS EVENTO Y CAPACITACION', 213560.00, null, null, null),
  (85, 92, 'RESULTADOS', '4.2.1/03/33', 'Seguridad y Alarma', 487272.71, null, null, null),
  (86, 93, 'RESULTADOS', '4.2.1/04/02', 'Sellados', 2810480.81, null, null, null),
  (87, 94, 'RESULTADOS', '4.2.1/04/03', 'Comisiones y Gastos de Venta de Hacienda', 252646.58, null, null, null),
  (88, 95, 'RESULTADOS', '4.2.1/04/07', 'Gastos Varios comercialización', 4005501.43, null, null, null),
  (89, 96, 'RESULTADOS', '4.2.1/04/08', 'Flete Local', 1888457.39, null, null, null),
  (90, 97, 'RESULTADOS', '4.2.1/04/10', 'Insumos Veterinarios', 25935136.89, null, null, null),
  (91, 98, 'RESULTADOS', '4.2.1/04/11', 'Laboreo', 655500.00, null, null, null),
  (92, 99, 'RESULTADOS', '4.2.1/04/12', 'Combustibles y Lubricantes', 13416722.46, null, null, null),
  (93, 100, 'RESULTADOS', '4.2.1/04/13', 'Mantenimiento y reparacion de rodados', 10099101.84, null, null, null),
  (94, 101, 'RESULTADOS', '4.2.1/04/14', 'Gastos de Produccion - Alimento Balanceado', 5065945.62, null, null, null),
  (95, 102, 'RESULTADOS', '4.2.1/04/16', 'Agroquimicos', 7030791.81, null, null, null),
  (96, 103, 'RESULTADOS', '4.2.1/05/01', 'Intereses bancarios (interest expenses)', 235091.41, null, null, null),
  (97, 104, 'RESULTADOS', '4.2.1/05/02', 'Intereses (interest expenses)', 47529.43, null, null, null),
  (98, 105, 'RESULTADOS', '4.2.1/05/03', 'Intereses y recargos impositivos(interest expenses', 800.00, null, null, null),
  (99, 106, 'RESULTADOS', '4.2.1/05/05', 'Resultado por tenencia', -6197447.87, null, null, null),
  (100, 107, 'RESULTADOS', '4.2.1/05/10', 'Resultado por Exposición a la Inflación', 0.00, null, null, null),
  (101, 108, 'RESULTADOS', '4.2.1/06/01', 'Impuesto a las Ganancias(corporate tax)', 18072967.28, null, 'contador', 'Lo da el contador (JMS 17/11)'),
  (102, 109, 'RESULTADOS', '4.2.1/06/02', 'Impuesto a los Ingresos Brutos(commercial tax)', 14666712.91, null, 'contador', 'Lo da el contador (JMS 17/11)'),
  (103, 110, 'RESULTADOS', '4.2.1/06/04', 'Impuesto Inmobiliario', 13984138.35, null, null, null),
  (104, 111, 'RESULTADOS', '4.2.1/06/05', 'Impuestos Municipales - Red Vial', 6357307.49, null, null, null),
  (105, 112, 'RESULTADOS', '4.2.1/06/09', 'Patente automotor', 1087669.69, null, null, null),
  (106, 113, 'RESULTADOS', '4.2.1/06/11', 'Impuesto diferido', 53366150.52, null, 'contador', 'Impuesto diferido: cálculo contable impositivo fino, sin incidencia; no se calcula (JMS 17/11)'),
  (107, 114, 'RESULTADOS', '4.2.2/01/00', 'Pérdida por venta bienes de uso', 42953283.74, null, 'contador', 'Cálculo del contador por bienes de uso (JMS 17/11)')
  ) as v(orden, fila, capitulo, cuenta, denominacion, saldo, nota, tratamiento, comentario);

commit;
notify pgrst, 'reload schema';
