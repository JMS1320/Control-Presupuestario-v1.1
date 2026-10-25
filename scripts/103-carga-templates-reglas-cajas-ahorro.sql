-- 103 · CARGA: cuentas, templates, partidas urbanas y reglas para las CAJAS DE AHORRO de MA y PAM (A-DAT-90)
--
-- DATOS, no estructura. OK del usuario 2026-10-25 («adelante», «1 si 2 intereses 3 si ok», «ok» a los nombres),
-- sobre la propuesta «Propuesta templates y reglas cajas de ahorro MA y PAM (2026-10-25).xlsx».
-- Foto previa: «- Comunicacion JMS Claude - Archivos/fotos reparseo/foto antes de cargar templates y reglas…json».
--
-- QUÉ HACE, todo en UNA transacción:
--   1. 3 cuentas nuevas en cuentas_contables (Tarjetas MA, Consumos, Promocion Galicia). El interés usa INTERESES, que existe.
--   2. 13 templates nuevos en egresos_sin_factura, cada uno copiando los campos de uno existente. Marca en
--      observaciones_template: '[script 103]'.
--   3. Las 3 partidas urbanas en el campo partida de sus templates ABL de PAM — sólo si el campo está vacío.
--   4. 32 reglas en reglas_conciliacion (cajas de ahorro MA y PAM; hoy no hay ninguna en esas dos cuentas).
--
-- MARCA para el deshacer: todas las filas nuevas llevan el MISMO created_at (el now() de la transacción),
-- que el script imprime al final; los templates, además, '[script 103]'.
--
-- SE FRENA sin tocar nada si: ya existe alguna de las cuentas, algún template con la marca, o alguna regla en
-- ma_galicia / pam_galicia; o si falta alguno de los templates existentes que usan las reglas.

begin;

do $$
begin
  if exists (select 1 from public.cuentas_contables where categ in ('Tarjetas MA', 'Consumos', 'Promocion Galicia')) then
    raise exception 'Ya existe alguna de las cuentas nuevas: no se corre el 103.';
  end if;
  if exists (select 1 from public.egresos_sin_factura where observaciones_template like '%[script 103]%') then
    raise exception 'Ya hay templates con la marca [script 103]: no se corre de nuevo.';
  end if;
  if exists (select 1 from public.reglas_conciliacion where cuenta_bancaria_id in ('ma_galicia', 'pam_galicia')) then
    raise exception 'Ya hay reglas en las cajas de ahorro de MA o PAM: no se corre el 103 (revisar antes).';
  end if;
end $$;

-- 1 · Cuentas ---------------------------------------------------------------------------------------
insert into public.cuentas_contables (categ, cuenta_contable, tipo, activo, imputable, nombre_totalizadora) values
  ('Tarjetas MA', 'Pago Tarjeta MA', 'financiero', true, true, 'MOVIMIENTOS ENTRE CANALES'),
  ('Consumos', 'Consumos', 'egreso', true, true, null),
  ('Promocion Galicia', 'Promoción Galicia', 'ingreso', true, true, null);

-- 2 · Templates -------------------------------------------------------------------------------------
create temp table t103 (clave text primary key, id uuid) on commit drop;

with nuevos as (
  insert into public.egresos_sin_factura
    (nombre_referencia, responsable, año, activo, categ, centro_costo, responsable_interno, cuenta_agrupadora,
     tipo_template, tipo, tipo_recurrencia, periodicidad, es_bidireccional, solo_conciliacion, aplica_generacion,
     codigo_contable, codigo_interno, proveedor, cuit_quien_cobra, nombre_quien_cobra, observaciones_template)
  values
    ('ACA', 'MA', '2026', true, 'Fijos Libertad', 'Libertad', 'MA', 'Fijos Buenos Aires MA', 'abierto', 'egreso', 'abierto', 'anual', false, false, false, null, null, 'Automóvil Club Argentino', null, 'Automóvil Club Argentino', '[script 103] copia de ACA (PAM 2026), abierto: la regla carga cada débito'),
    ('Caja', 'MA', null, true, 'CAJA', null, null, 'Movimientos Internos empresa', 'abierto', 'financiero', 'abierto', 'anual', true, false, false, 'No Lleva', 'No Lleva', 'MA', '27066824611', 'MA', '[script 103] copia de Caja (MSA)'),
    ('Tarjeta VISA MA', 'MA', null, true, 'Tarjetas MA', null, 'MA', 'Tarjetas', 'abierto', 'financiero', 'abierto', 'anual', false, false, false, 'Desglosar', 'Desglosar', 'VISA', '30715491156', 'VISA', '[script 103] copia de Tarjeta VISA PAM'),
    ('FIMA Premium Galicia Pesos (rescate inmediato)', 'MA', null, true, 'FCI', null, null, 'Inversiones', 'abierto', 'financiero', 'abierto', 'anual', true, false, false, null, null, null, '27066824611', 'MA', '[script 103] copia de FIMA (PAM)'),
    ('Interes Capitalizado', 'MA', null, true, 'INTERESES', null, null, 'Créditos Bancarios', 'abierto', null, 'abierto', 'anual', true, false, false, null, null, 'Banco Galicia', null, 'Banco Galicia', '[script 103] intereses de la caja de ahorro (cuenta INTERESES, como un plazo fijo o FCI)'),
    ('Interbancarias MA', 'MA', null, true, 'INTER', null, null, 'Movimientos Internos empresa', 'abierto', 'financiero', 'abierto', 'bianual', true, false, false, null, null, null, '27066824611', 'MA', '[script 103] copia de Interbancarias PAM'),
    ('Gastos Medicos', 'MA', null, true, 'GASTOS MEDICOS', null, null, 'Gastos Personales MA', 'abierto', 'egreso', 'abierto', 'anual', false, false, false, null, null, null, null, null, '[script 103] Farmacity y médicos'),
    ('Consumos MA', 'MA', null, true, 'Consumos', null, null, 'Gastos Personales MA', 'abierto', 'egreso', 'abierto', 'anual', false, false, false, null, null, null, null, null, '[script 103] compras personales (súper, café, pescadería…)'),
    ('Retiro de MSA', 'MA', null, true, 'Distribucion Mama', null, null, 'Retiros / Distribucion Socios', 'abierto', 'distribucion', 'abierto', 'anual', true, false, false, 'CTA MA', 'DIST MA', null, '30617786016', 'MSA', '[script 103] otra punta de «Retiro MA mensual» de MSA'),
    ('Retiro de PAM', 'MA', null, true, 'Distribucion Mama', null, null, 'Retiros / Distribucion Socios', 'abierto', 'distribucion', 'abierto', 'anual', true, false, false, 'CTA MA', 'DIST MA', null, '20044390222', 'PAM', '[script 103] otra punta de «Retiro MA mensual PAM»'),
    ('Interes Capitalizado', 'PAM', null, true, 'INTERESES', null, null, 'Créditos Bancarios', 'abierto', null, 'abierto', 'anual', true, false, false, null, null, 'Banco Galicia', null, 'Banco Galicia', '[script 103] intereses de la caja de ahorro'),
    ('Gastos Medicos', 'PAM', null, true, 'GASTOS MEDICOS', null, 'MA', 'Fijos Buenos Aires MA', 'abierto', 'egreso', 'abierto', 'anual', false, false, false, null, 'DIST MA', null, null, null, '[script 103] gasto de MA pagado por PAM (DIST MA), como en 2025'),
    ('Promocion Galicia', 'PAM', null, true, 'Promocion Galicia', null, 'MA', 'Créditos Bancarios', 'abierto', 'ingreso', 'abierto', 'anual', true, false, false, null, 'DIST MA', 'Banco Galicia', null, 'Banco Galicia', '[script 103] reintegros de promociones (2025: PROM GAL · DIST MA)')
  returning id, nombre_referencia, responsable
)
insert into t103 select nombre_referencia || ' · ' || responsable, id from nuevos;

do $$ begin
  if (select count(*) from t103) <> 13 then raise exception 'No se crearon los 13 templates: %', (select count(*) from t103); end if;
end $$;

-- Templates que YA existen y usan las reglas
insert into t103 (clave, id)
select x.clave, (select e.id from public.egresos_sin_factura e
                 where e.nombre_referencia = x.nombre and e.responsable = x.resp and e.activo
                   and coalesce(e.año, '') = x.anio limit 1)
from (values
  ('AYSA Libertad · PAM', 'AYSA Libertad', 'PAM', '2026'),
  ('ABL Libertad Cuota · PAM', 'ABL Libertad Cuota', 'PAM', '2026'),
  ('ABL Cochera Posadas Anual · PAM', 'ABL Cochera Posadas Anual', 'PAM', '2026'),
  ('ABL Cochera Libertad Anual · PAM/MA/Duhau', 'ABL Cochera Libertad Anual', 'PAM/MA/Duhau', '2026'),
  ('Iva Bancario · PAM', 'Iva Bancario', 'PAM', ''),
  ('Comision Caja de Seguridad · PAM', 'Comision Caja de Seguridad', 'PAM', ''),
  ('Interbancarias PAM · PAM', 'Interbancarias PAM', 'PAM', ''),
  ('Tarjeta VISA PAM · PAM', 'Tarjeta VISA PAM', 'PAM', '')
) as x(clave, nombre, resp, anio);

do $$ begin
  if exists (select 1 from t103 where id is null) then
    raise exception 'Falta un template existente: %', (select string_agg(clave, ', ') from t103 where id is null);
  end if;
end $$;

-- 3 · Partidas urbanas (sólo donde el campo está vacío) ---------------------------------------------
update public.egresos_sin_factura set partida_arba = '1005392-00'
 where nombre_referencia = 'ABL Libertad Cuota' and responsable = 'PAM' and año = '2026' and partida_arba is null;
update public.egresos_sin_factura set partida_arba = '2831491-03'
 where nombre_referencia in ('ABL Cochera Posadas Anual', 'ABL Cochera Posadas Cuota') and responsable = 'PAM' and año = '2026' and partida_arba is null;
update public.egresos_sin_factura set partida_arba = '1568025-04'
 where nombre_referencia = 'ABL Cochera Libertad Anual' and responsable = 'PAM/MA/Duhau' and año = '2026' and partida_arba is null;

-- 4 · Reglas ----------------------------------------------------------------------------------------
insert into public.reglas_conciliacion
  (cuenta_bancaria_id, orden, tipo, columna_busqueda, tipo_match, texto_buscar, template_id, categ, detalle,
   codigo_contable, codigo_interno, llena_template, activo)
select r.cuenta, r.orden, r.tipo, r.col, r.match, r.texto, t.id, e.categ, r.detalle, e.codigo_contable, e.codigo_interno, true, true
from (values
  ('ma_galicia', 1, 'cuit', 'cuit', 'exacto', '30617786016', 'Retiro de MSA · MA', 'Retiro de MSA'),
  ('ma_galicia', 2, 'cuit', 'cuit', 'exacto', '20044390222', 'Retiro de PAM · MA', 'Retiro de PAM'),
  ('ma_galicia', 3, 'otras', 'descripcion', 'exacto', 'TRANSFERENCIA DE CUENTA PROPIA', 'Interbancarias MA · MA', 'Interbancaria'),
  ('ma_galicia', 4, 'otras', 'descripcion', 'exacto', 'PAGO TARJETA VISA', 'Tarjeta VISA MA · MA', 'Pago Tarjeta VISA MA'),
  ('ma_galicia', 5, 'otras', 'descripcion', 'inicia_con', 'EXTRACCION', 'Caja · MA', 'Extracción de efectivo'),
  ('ma_galicia', 6, 'otras', 'descripcion', 'contiene', 'FIMA', 'FIMA Premium Galicia Pesos (rescate inmediato) · MA', 'FIMA'),
  ('ma_galicia', 7, 'bancarios', 'descripcion', 'exacto', 'INTERES CAPITALIZADO', 'Interes Capitalizado · MA', 'Interés capitalizado'),
  ('ma_galicia', 8, 'otras', 'nombre', 'contiene', 'AGUA Y SANE', 'AYSA Libertad · PAM', 'AYSA Libertad'),
  ('ma_galicia', 9, 'otras', 'nombre', 'contiene', 'AUT.CLUB', 'ACA · MA', 'ACA'),
  ('ma_galicia', 10, 'impuestos', 'texto', 'contiene', '1005392', 'ABL Libertad Cuota · PAM', 'ABL Libertad'),
  ('ma_galicia', 11, 'impuestos', 'texto', 'contiene', '2831491', 'ABL Cochera Posadas Anual · PAM', 'ABL Cochera Posadas'),
  ('ma_galicia', 12, 'impuestos', 'texto', 'contiene', '1568025', 'ABL Cochera Libertad Anual · PAM/MA/Duhau', 'ABL Duhau'),
  ('ma_galicia', 13, 'otras', 'nombre', 'contiene', 'FARMACITY', 'Gastos Medicos · MA', 'Farmacity'),
  ('ma_galicia', 14, 'otras', 'nombre', 'contiene', 'DIA TIENDA', 'Consumos MA · MA', 'Supermercado Dia'),
  ('ma_galicia', 15, 'otras', 'nombre', 'contiene', 'RES LIBERTAD', 'Consumos MA · MA', 'Res Libertad'),
  ('ma_galicia', 16, 'otras', 'nombre', 'contiene', 'FREDDO', 'Consumos MA · MA', 'Freddo'),
  ('ma_galicia', 17, 'otras', 'nombre', 'contiene', 'SUPERMERCADO AMOR', 'Consumos MA · MA', 'Supermercado Amor'),
  ('ma_galicia', 18, 'otras', 'nombre', 'contiene', 'ESMERO CAFE', 'Consumos MA · MA', 'Esmero Café'),
  ('ma_galicia', 19, 'otras', 'nombre', 'contiene', 'PESCADERIA NAPOLI', 'Consumos MA · MA', 'Pescadería Napoli'),
  ('ma_galicia', 20, 'otras', 'nombre', 'contiene', 'CARNES PREMIUM', 'Consumos MA · MA', 'Carnes Premium'),
  ('ma_galicia', 21, 'otras', 'nombre', 'contiene', 'CRISTOBAL COLON', 'Consumos MA · MA', 'Cristóbal Colón'),
  ('ma_galicia', 22, 'otras', 'nombre', 'contiene', 'PALERMO CACAU', 'Consumos MA · MA', 'Palermo Cacau'),
  ('ma_galicia', 23, 'otras', 'nombre', 'contiene', 'LAEXPOSICION', 'Consumos MA · MA', 'La Exposición'),
  ('ma_galicia', 24, 'cuit', 'cuit', 'exacto', '27359962067', 'Consumos MA · MA', 'Micaela Carla Oberti'),
  ('ma_galicia', 25, 'cuit', 'cuit', 'exacto', '27054569403', 'Consumos MA · MA', 'Areco Ana Matilde'),
  ('pam_galicia', 1, 'otras', 'descripcion', 'exacto', 'TRANSFERENCIA DE CUENTA PROPIA', 'Interbancarias PAM · PAM', 'Interbancaria'),
  ('pam_galicia', 2, 'otras', 'descripcion', 'exacto', 'PAGO TARJETA VISA', 'Tarjeta VISA PAM · PAM', 'Pago Tarjeta VISA PAM'),
  ('pam_galicia', 3, 'bancarios', 'descripcion', 'contiene', 'CAJA DE SEGURIDAD', 'Comision Caja de Seguridad · PAM', 'Comisión caja de seguridad'),
  ('pam_galicia', 4, 'bancarios', 'descripcion', 'exacto', 'IVA', 'Iva Bancario · PAM', 'IVA bancario'),
  ('pam_galicia', 5, 'bancarios', 'descripcion', 'exacto', 'INTERES CAPITALIZADO', 'Interes Capitalizado · PAM', 'Interés capitalizado'),
  ('pam_galicia', 6, 'bancarios', 'descripcion', 'inicia_con', 'REINTEGRO PROMOCION', 'Promocion Galicia · PAM', 'Promoción Galicia'),
  ('pam_galicia', 7, 'cuit', 'cuit', 'exacto', '30692138747', 'Gastos Medicos · PAM', 'Farmacity')
) as r(cuenta, orden, tipo, col, match, texto, clave, detalle)
join t103 t on t.clave = r.clave
join public.egresos_sin_factura e on e.id = t.id;

do $$ begin
  if (select count(*) from public.reglas_conciliacion where cuenta_bancaria_id in ('ma_galicia', 'pam_galicia')) <> 32 then
    raise exception 'No quedaron las 32 reglas: %', (select count(*) from public.reglas_conciliacion where cuenta_bancaria_id in ('ma_galicia', 'pam_galicia'));
  end if;
end $$;

-- ── Control (antes del commit, se ve en la salida) ───────────────────────────────────────────────
select now() as marca_created_at,
  (select count(*) from public.cuentas_contables where created_at = now()) as cuentas,
  (select count(*) from public.egresos_sin_factura where created_at = now() and observaciones_template like '%[script 103]%') as templates,
  (select count(*) from public.egresos_sin_factura where partida_arba in ('1005392-00', '2831491-03', '1568025-04')) as partidas,
  (select count(*) from public.reglas_conciliacion where created_at = now()) as reglas;

commit;
