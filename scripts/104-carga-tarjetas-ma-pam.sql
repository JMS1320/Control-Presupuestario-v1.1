-- 104 · CARGA: templates y reglas de las TARJETAS VISA de MA y PAM (A-DAT-92)
--
-- GENERADO por scripts/104-generar-reglas-tarjetas.py — no editar a mano: corregir el generador y volver a generar.
-- DATOS, no estructura. Decisiones del usuario 2026-10-25 (Excel «Templates tarjetas MA y PAM - sintesis v2»
-- + respuestas: Personal = Paquete TV MA · centro de costo Chalet · Intereses PAM con DIST MA · DirecTV 2025 y
-- Parador sin regla). 🛑 Correr SÓLO con OK del usuario.
--
-- QUÉ HACE, en UNA transacción. SÓLO AGREGA: no modifica ninguna fila existente (eso es el 105).
--   1. Centro de costo «Chalet» (si no existe).
--   2. 32 templates nuevos (marca '[script 104]' en observaciones_template). Cada servicio
--      tiene su renglón 2025 (PAM, DIST MA) y 2026 (MA, sin DIST MA), y el 2026 apunta al 2025 (template_origen_id).
--   3. 156 reglas en reglas_conciliacion (tarjeta_visa_pam / tarjeta_visa_ma; hoy no hay ninguna):
--      cargos del banco primero, servicios después, consumos al final; UNA por comercio, ninguna «comodín».
--      · Tarjeta de PAM → el renglón 2025 de PAM, con código interno DIST MA (Omint: DIST AMS), los dos años.
--      · Tarjeta de MA  → el renglón 2026 de MA, sin código interno.
--   4. 1 regla contable/interno (Tab 2) en la tarjeta de MA: si la cuota cae en un template de PAM → DIST MA.
--
-- ⚠️ LO QUE ESTE SCRIPT NO RESUELVE (ver el informe del 104 en A-DAT-92): el motor arma la «familia» de un
-- template por NOMBRE + RESPONSABLE. Luz Libertad 2025 (PAM) y 2026 (MA) son dos familias, así que hasta que
-- el motor siga el enlace template_origen_id: los movimientos de 2026 de la tarjeta de PAM y los de sep–dic 2025
-- de la tarjeta de MA quedan A AUDITAR con «Falta la campaña…» (no se carga nada mal; no tocar ese botón).
--
-- MARCA para el deshacer: created_at = now() de la transacción (lo imprime el control final) + '[script 104]'.
-- SE FRENA sin tocar nada si ya hay reglas en las dos tarjetas, templates con la marca, o falta un existente.
--
-- 📄 LOS RESÚMENES NO SE CARGAN ACÁ: van por la app (Extracto → tarjeta → Importar → «📄 Resumen PDF»), que controla
-- el saldo, frena un resumen repetido y deja la fila RESUMEN. Archivos en «- Comunicacion JMS Claude - Archivos/Extractos/»:
--   · TJ VISA PAM/  VISA PAM - 25-02 … 26-04.pdf  (15; el 25-01 ya está; el 24-12 NO se carga: PAM arranca en ene-25)
--   · TJ VISA MA/   MA - VISA - 25-09 … 26-09.pdf (13)
--   Orden recomendado: correr el 104, importar, y conciliar de a un resumen, del más viejo al más nuevo.

begin;

do $$
begin
  if exists (select 1 from public.reglas_conciliacion where cuenta_bancaria_id in ('tarjeta_visa_pam', 'tarjeta_visa_ma')) then
    raise exception 'Ya hay reglas en las tarjetas de PAM o MA: no se corre el 104 (revisar antes).';
  end if;
  if exists (select 1 from public.egresos_sin_factura where observaciones_template like '%[script 104]%') then
    raise exception 'Ya hay templates con la marca [script 104]: no se corre de nuevo.';
  end if;
  if exists (select 1 from public.reglas_contable_interno where cuenta_bancaria_id = 'tarjeta_visa_ma') then
    raise exception 'Ya hay reglas contable/interno en la tarjeta de MA: revisar antes.';
  end if;
end $$;

-- 1 · Centro de costo ------------------------------------------------------------------------------
insert into public.centros_costo (nombre, activo, tipo)
select 'Chalet', true, 'campo' where not exists (select 1 from public.centros_costo where lower(nombre) = 'chalet');

-- 2 · Templates -----------------------------------------------------------------------------------
create temp table t104 (clave text primary key, id uuid) on commit drop;

-- 2a · los renglones 2025 (PAM) y los cargos del banco (sin campaña)
with nuevos as (
  insert into public.egresos_sin_factura (nombre_referencia, responsable, año, activo, categ, centro_costo, responsable_interno, cuenta_agrupadora, tipo_template, tipo, tipo_recurrencia, periodicidad, es_bidireccional, solo_conciliacion, aplica_generacion, codigo_contable, codigo_interno, proveedor, cuit_quien_cobra, nombre_quien_cobra, observaciones_template, template_origen_id)
  select v.nombre, v.resp, v.anio, true, v.categ, v.centro, v.resp_int, v.agr, 'abierto', v.tipo::text::public.tipo_cuenta, 'abierto', v.periodicidad, v.bidi, v.solo, false, v.cc, v.ci, v.prov, v.cuit, v.nqc,
         '[script 104] ' || v.obs, (select id from t104 where clave = v.origen)
  from (values
    ('Luz Libertad · PAM 2025', 'Luz Libertad', 'PAM', '2025', 'LUZ', 'Libertad', 'MA', 'Fijos Buenos Aires MA', 'egreso', 'anual', false, false, 'LIB', 'DIST MA', 'Edesur', null::text, null::text, '{Luz Libertad · PAM 2025} tarjeta VISA — gasto de MA pagado por PAM', null),
    ('Internet Libertad · PAM 2025', 'Internet Libertad', 'PAM', '2025', 'TELEFONOS E INTERNET BS. AS.', 'Libertad', 'MA', 'Fijos Buenos Aires MA', 'egreso', 'anual', false, false, 'LIB', 'DIST MA', 'Iplan', null::text, null::text, '{Internet Libertad · PAM 2025} tarjeta VISA — gasto de MA pagado por PAM', null),
    ('Telefono Fijo 812 · PAM 2025', 'Telefono Fijo 812', 'PAM', '2025', 'TELEFONOS E INTERNET BS. AS.', 'Libertad', 'MA', 'Fijos Buenos Aires MA', 'egreso', 'anual', false, false, 'LIB', 'DIST MA', 'Movistar (Telefónica)', null::text, null::text, '{Telefono Fijo 812 · PAM 2025} tarjeta VISA — gasto de MA pagado por PAM', null),
    ('Paquete TV MA · PAM 2025', 'Paquete TV MA', 'PAM', '2025', 'Consumos', null, 'MA', 'Suscripciones MA', 'egreso', 'anual', false, false, null, 'DIST MA', 'Personal Flow (Telecom)', null::text, null::text, '{Paquete TV MA · PAM 2025} tarjeta VISA — gasto de MA pagado por PAM', null),
    ('Club La Nación · PAM 2025', 'Club La Nación', 'PAM', '2025', 'Consumos', null, 'MA', 'Suscripciones MA', 'egreso', 'anual', false, false, null, 'DIST MA', 'La Nación', null::text, null::text, '{Club La Nación · PAM 2025} tarjeta VISA — gasto de MA pagado por PAM', null),
    ('Disney Plus · PAM 2025', 'Disney Plus', 'PAM', '2025', 'Consumos', null, 'MA', 'Suscripciones MA', 'egreso', 'anual', false, false, null, 'DIST MA', 'Disney Plus', null::text, null::text, '{Disney Plus · PAM 2025} tarjeta VISA — gasto de MA pagado por PAM', null),
    ('Jockey Club · PAM 2025', 'Jockey Club', 'PAM', '2025', 'Consumos', null, 'MA', 'Suscripciones MA', 'egreso', 'anual', false, false, null, 'DIST MA', 'Jockey Club', null::text, null::text, '{Jockey Club · PAM 2025} tarjeta VISA — gasto de MA pagado por PAM', null),
    ('Netflix · PAM 2025', 'Netflix', 'PAM', '2025', 'Consumos', null, 'MA', 'Suscripciones MA', 'egreso', 'anual', false, false, null, 'DIST MA', 'Netflix', null::text, null::text, '{Netflix · PAM 2025} tarjeta VISA — gasto de MA pagado por PAM', null),
    ('Spotify · PAM 2025', 'Spotify', 'PAM', '2025', 'Consumos', null, 'MA', 'Suscripciones MA', 'egreso', 'anual', false, false, null, 'DIST MA', 'Spotify', null::text, null::text, '{Spotify · PAM 2025} tarjeta VISA — gasto de MA pagado por PAM', null),
    ('Eset (antivirus) · MA 2026', 'Eset (antivirus)', 'MA', '2026', 'INFORMATICA', null, 'MA', 'Suscripciones MA', 'egreso', 'anual', false, false, null, null, 'Eset', null::text, null::text, '{Eset (antivirus) · MA 2026} tarjeta VISA — año 2026', null),
    ('Omint AMS · PAM 2025', 'Omint AMS', 'PAM', '2025', 'GASTOS MEDICOS', null, null, 'Retiros / Distribucion Socios', 'egreso', 'anual', false, false, null, 'DIST AMS', 'Omint', null::text, null::text, '{Omint AMS · PAM 2025} tarjeta VISA — año 2025', null),
    ('Seguro Chalet · PAM 2025', 'Seguro Chalet', 'PAM', '2025', 'SEGUROS ESTRUCTURA', 'Nazarenas', 'MA', 'Seguros', 'egreso', 'anual', false, false, null, 'DIST MA', 'Chubb', null::text, null::text, '{Seguro Chalet · PAM 2025} tarjeta VISA — gasto de MA pagado por PAM', null),
    ('Consumos MA · PAM 2025', 'Consumos MA', 'PAM', '2025', 'Consumos', null, 'MA', 'Gastos Personales MA', 'egreso', 'anual', false, false, null, 'DIST MA', null, null::text, null::text, '{Consumos MA · PAM 2025} tarjeta VISA — gasto de MA pagado por PAM', null),
    ('Gastos Medicos · PAM 2025', 'Gastos Medicos', 'PAM', '2025', 'GASTOS MEDICOS', null, 'MA', 'Gastos Personales MA', 'egreso', 'anual', false, false, null, 'DIST MA', null, null::text, null::text, '{Gastos Medicos · PAM 2025} tarjeta VISA — gasto de MA pagado por PAM', null),
    ('Comision Cuenta Bancaria · MA', 'Comision Cuenta Bancaria', 'MA', null::text, 'Comision Cuenta Bancaria', null::text, null::text, 'Gastos Bancarios', 'egreso', (select periodicidad from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Comision Cuenta Bancaria' limit 1), true, true, null::text, null, (select proveedor from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Comision Cuenta Bancaria' limit 1), (select cuit_quien_cobra from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Comision Cuenta Bancaria' limit 1), (select nombre_quien_cobra from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Comision Cuenta Bancaria' limit 1), '{Comision Cuenta Bancaria · MA} cargo del banco de la tarjeta, copia del de MSA', null::text),
    ('IIBB CABA Bancario · MA', 'IIBB CABA Bancario', 'MA', null::text, 'IIBB CABA Bancario', null::text, null::text, 'Impuestos Bancarios', 'egreso', (select periodicidad from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'IIBB CABA Bancario' limit 1), true, true, null::text, null, (select proveedor from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'IIBB CABA Bancario' limit 1), (select cuit_quien_cobra from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'IIBB CABA Bancario' limit 1), (select nombre_quien_cobra from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'IIBB CABA Bancario' limit 1), '{IIBB CABA Bancario · MA} cargo del banco de la tarjeta, copia del de MSA', null::text),
    ('Iva Bancario · MA', 'Iva Bancario', 'MA', null::text, 'Iva Bancario', null::text, null::text, 'Impuestos Bancarios', 'egreso', (select periodicidad from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Iva Bancario' limit 1), true, true, null::text, null, (select proveedor from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Iva Bancario' limit 1), (select cuit_quien_cobra from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Iva Bancario' limit 1), (select nombre_quien_cobra from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Iva Bancario' limit 1), '{Iva Bancario · MA} cargo del banco de la tarjeta, copia del de MSA', null::text),
    ('Percepcion Ganancias Bancario · MA', 'Percepcion Ganancias Bancario', 'MA', null::text, 'Percepcion Ganancias Bancario', null::text, null::text, 'Impuestos Bancarios', 'egreso', (select periodicidad from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Percepcion Ganancias Bancario' limit 1), true, true, null::text, null, (select proveedor from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Percepcion Ganancias Bancario' limit 1), (select cuit_quien_cobra from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Percepcion Ganancias Bancario' limit 1), (select nombre_quien_cobra from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Percepcion Ganancias Bancario' limit 1), '{Percepcion Ganancias Bancario · MA} cargo del banco de la tarjeta, copia del de MSA', null::text),
    ('Percepcion IVA · MA', 'Percepcion IVA', 'MA', null::text, 'Percepcion IVA', null::text, null::text, 'Impuestos Bancarios', 'egreso', (select periodicidad from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Percepcion IVA' limit 1), true, true, null::text, null, (select proveedor from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Percepcion IVA' limit 1), (select cuit_quien_cobra from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Percepcion IVA' limit 1), (select nombre_quien_cobra from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Percepcion IVA' limit 1), '{Percepcion IVA · MA} cargo del banco de la tarjeta, copia del de MSA', null::text),
    ('Percepcion Ganancias Bancario · PAM', 'Percepcion Ganancias Bancario', 'PAM', null::text, 'Percepcion Ganancias Bancario', null::text, null::text, 'Impuestos Bancarios', 'egreso', (select periodicidad from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Percepcion Ganancias Bancario' limit 1), true, true, null::text, 'DIST MA', (select proveedor from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Percepcion Ganancias Bancario' limit 1), (select cuit_quien_cobra from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Percepcion Ganancias Bancario' limit 1), (select nombre_quien_cobra from public.egresos_sin_factura where responsable = 'MSA' and nombre_referencia = 'Percepcion Ganancias Bancario' limit 1), '{Percepcion Ganancias Bancario · PAM} cargo del banco de la tarjeta, copia del de MSA', null::text),
    ('Intereses Tarjeta · MA', 'Intereses Tarjeta', 'MA', null::text, 'INTERESES', null::text, null::text, 'Créditos Bancarios', null::text, 'anual', true, true, null::text, null, 'Banco Galicia', null::text, 'Banco Galicia', '{Intereses Tarjeta · MA} intereses y punitorios de la tarjeta (cuenta INTERESES, como Interes Capitalizado)', null::text),
    ('Intereses Tarjeta · PAM', 'Intereses Tarjeta', 'PAM', null::text, 'INTERESES', null::text, null::text, 'Créditos Bancarios', null::text, 'anual', true, true, null::text, 'DIST MA', 'Banco Galicia', null::text, 'Banco Galicia', '{Intereses Tarjeta · PAM} intereses y punitorios de la tarjeta (cuenta INTERESES, como Interes Capitalizado)', null::text)
  ) as v(clave, nombre, resp, anio, categ, centro, resp_int, agr, tipo, periodicidad, bidi, solo, cc, ci, prov, cuit, nqc, obs, origen)
  returning id, nombre_referencia, responsable, año, observaciones_template
)
insert into t104 select substring(observaciones_template from '\{(.*)\}'), id from nuevos;

-- 2b · los renglones 2026 (MA), enganchados a su 2025
with nuevos as (
  insert into public.egresos_sin_factura (nombre_referencia, responsable, año, activo, categ, centro_costo, responsable_interno, cuenta_agrupadora, tipo_template, tipo, tipo_recurrencia, periodicidad, es_bidireccional, solo_conciliacion, aplica_generacion, codigo_contable, codigo_interno, proveedor, cuit_quien_cobra, nombre_quien_cobra, observaciones_template, template_origen_id)
  select v.nombre, v.resp, v.anio, true, v.categ, v.centro, v.resp_int, v.agr, 'abierto', v.tipo::text::public.tipo_cuenta, 'abierto', v.periodicidad, v.bidi, v.solo, false, v.cc, v.ci, v.prov, v.cuit, v.nqc,
         '[script 104] ' || v.obs, (select id from t104 where clave = v.origen)
  from (values
    ('Luz Libertad · MA 2026', 'Luz Libertad', 'MA', '2026', 'LUZ', 'Libertad', 'MA', 'Fijos Buenos Aires MA', 'egreso', 'anual', false, false, 'LIB', null, 'Edesur', null::text, null::text, '{Luz Libertad · MA 2026} tarjeta VISA — año 2026', 'Luz Libertad · PAM 2025'),
    ('Internet Libertad · MA 2026', 'Internet Libertad', 'MA', '2026', 'TELEFONOS E INTERNET BS. AS.', 'Libertad', 'MA', 'Fijos Buenos Aires MA', 'egreso', 'anual', false, false, 'LIB', null, 'Iplan', null::text, null::text, '{Internet Libertad · MA 2026} tarjeta VISA — año 2026', 'Internet Libertad · PAM 2025'),
    ('Telefono Fijo 812 · MA 2026', 'Telefono Fijo 812', 'MA', '2026', 'TELEFONOS E INTERNET BS. AS.', 'Libertad', 'MA', 'Fijos Buenos Aires MA', 'egreso', 'anual', false, false, 'LIB', null, 'Movistar (Telefónica)', null::text, null::text, '{Telefono Fijo 812 · MA 2026} tarjeta VISA — año 2026', 'Telefono Fijo 812 · PAM 2025'),
    ('Paquete TV MA · MA 2026', 'Paquete TV MA', 'MA', '2026', 'Consumos', null, 'MA', 'Suscripciones MA', 'egreso', 'anual', false, false, null, null, 'Personal Flow (Telecom)', null::text, null::text, '{Paquete TV MA · MA 2026} tarjeta VISA — año 2026', 'Paquete TV MA · PAM 2025'),
    ('Club La Nación · MA 2026', 'Club La Nación', 'MA', '2026', 'Consumos', null, 'MA', 'Suscripciones MA', 'egreso', 'anual', false, false, null, null, 'La Nación', null::text, null::text, '{Club La Nación · MA 2026} tarjeta VISA — año 2026', 'Club La Nación · PAM 2025'),
    ('Disney Plus · MA 2026', 'Disney Plus', 'MA', '2026', 'Consumos', null, 'MA', 'Suscripciones MA', 'egreso', 'anual', false, false, null, null, 'Disney Plus', null::text, null::text, '{Disney Plus · MA 2026} tarjeta VISA — año 2026', 'Disney Plus · PAM 2025'),
    ('Jockey Club · MA 2026', 'Jockey Club', 'MA', '2026', 'Consumos', null, 'MA', 'Suscripciones MA', 'egreso', 'anual', false, false, null, null, 'Jockey Club', null::text, null::text, '{Jockey Club · MA 2026} tarjeta VISA — año 2026', 'Jockey Club · PAM 2025'),
    ('Netflix · MA 2026', 'Netflix', 'MA', '2026', 'Consumos', null, 'MA', 'Suscripciones MA', 'egreso', 'anual', false, false, null, null, 'Netflix', null::text, null::text, '{Netflix · MA 2026} tarjeta VISA — año 2026', 'Netflix · PAM 2025'),
    ('Spotify · MA 2026', 'Spotify', 'MA', '2026', 'Consumos', null, 'MA', 'Suscripciones MA', 'egreso', 'anual', false, false, null, null, 'Spotify', null::text, null::text, '{Spotify · MA 2026} tarjeta VISA — año 2026', 'Spotify · PAM 2025'),
    ('Omint AMS · PAM 2026', 'Omint AMS', 'PAM', '2026', 'GASTOS MEDICOS', null, null, 'Retiros / Distribucion Socios', 'egreso', 'anual', false, false, null, 'DIST AMS', 'Omint', null::text, null::text, '{Omint AMS · PAM 2026} tarjeta VISA — año 2026', 'Omint AMS · PAM 2025')
  ) as v(clave, nombre, resp, anio, categ, centro, resp_int, agr, tipo, periodicidad, bidi, solo, cc, ci, prov, cuit, nqc, obs, origen)
  returning id, nombre_referencia, responsable, año, observaciones_template
)
insert into t104 select substring(observaciones_template from '\{(.*)\}'), id from nuevos;

do $$ begin
  if (select count(*) from t104) <> 32 then raise exception 'No se crearon los 32 templates: %', (select count(*) from t104); end if;
end $$;

-- Templates que YA existen y usan las reglas (se verifica nombre y responsable)
insert into t104 (clave, id) values
  ('IIBB Bancario · PAM', '262f16e5-d4c6-483e-a400-5d5554bcf07e'::uuid),
  ('Iva Bancario · PAM', 'bf14703f-130d-4b08-bdcc-7e1b0414d2f7'::uuid),
  ('Percepcion IVA · PAM', 'f4f13ed5-e9c3-4894-8935-093d1e77e706'::uuid),
  ('Sellos Bancario · PAM', '2e07bf32-9e49-4859-90a3-d3f086575872'::uuid),
  ('Consumos MA · MA', '79c4229e-288c-40a1-98a0-da24482b3eeb'::uuid),
  ('Gastos Medicos · MA', '930e624d-b74b-4430-ad00-743c6ba02923'::uuid);
do $$ begin
  if exists (select 1 from t104 t join (values
    ('IIBB Bancario · PAM', 'IIBB Bancario', 'PAM'),
    ('Iva Bancario · PAM', 'Iva Bancario', 'PAM'),
    ('Percepcion IVA · PAM', 'Percepcion IVA', 'PAM'),
    ('Sellos Bancario · PAM', 'Sellos Bancario', 'PAM'),
    ('Consumos MA · MA', 'Consumos MA', 'MA'),
    ('Gastos Medicos · MA', 'Gastos Medicos', 'MA')
  ) as x(clave, nombre, resp) on x.clave = t.clave
  left join public.egresos_sin_factura e on e.id = t.id and e.nombre_referencia = x.nombre and e.responsable = x.resp and e.activo
  where e.id is null) then raise exception 'Un template existente cambió o no está: revisar antes de correr el 104.'; end if;
end $$;

-- 3 · Reglas ----------------------------------------------------------------------------------------
insert into public.reglas_conciliacion
  (cuenta_bancaria_id, orden, tipo, columna_busqueda, tipo_match, texto_buscar, template_id, categ, detalle,
   codigo_contable, codigo_interno, llena_template, activo)
select r.cuenta, r.orden, r.tipo, 'descripcion', 'contiene', r.texto, t.id, e.categ, r.detalle, e.codigo_contable, r.ci, true, true
from (values
  ('tarjeta_visa_ma', 1, 'bancarios', 'DERECHO EMISION', 'Comision Cuenta Bancaria · MA', 'Comisión emisión tarjeta (y su bonificación)', null),
  ('tarjeta_visa_ma', 2, 'impuestos', 'IIBB PERCEP-CABA', 'IIBB CABA Bancario · MA', 'IIBB CABA tarjeta', null),
  ('tarjeta_visa_ma', 3, 'bancarios', 'INTERESES FINANCIACION', 'Intereses Tarjeta · MA', 'Intereses de financiación', null),
  ('tarjeta_visa_ma', 4, 'impuestos', 'DB IVA', 'Iva Bancario · MA', 'IVA sobre intereses/comisiones', null),
  ('tarjeta_visa_ma', 5, 'impuestos', 'RG 5617', 'Percepcion Ganancias Bancario · MA', 'Percepción Ganancias RG 5617', null),
  ('tarjeta_visa_ma', 6, 'impuestos', 'IVA RG', 'Percepcion IVA · MA', 'IVA servicios digitales RG 4240', null),
  ('tarjeta_visa_pam', 1, 'impuestos', 'IIBB PERCEP-CABA', 'IIBB Bancario · PAM', 'IIBB CABA tarjeta', 'DIST MA'),
  ('tarjeta_visa_pam', 2, 'bancarios', 'INTERESES FINANCIACION', 'Intereses Tarjeta · PAM', 'Intereses de financiación', 'DIST MA'),
  ('tarjeta_visa_pam', 3, 'bancarios', 'PUNIT', 'Intereses Tarjeta · PAM', 'Punitorios', 'DIST MA'),
  ('tarjeta_visa_pam', 4, 'impuestos', 'DB IVA', 'Iva Bancario · PAM', 'IVA sobre intereses/comisiones', 'DIST MA'),
  ('tarjeta_visa_pam', 5, 'impuestos', 'RG 5617', 'Percepcion Ganancias Bancario · PAM', 'Percepción Ganancias RG 5617', 'DIST MA'),
  ('tarjeta_visa_pam', 6, 'impuestos', 'IVA RG', 'Percepcion IVA · PAM', 'IVA servicios digitales RG 4240', 'DIST MA'),
  ('tarjeta_visa_pam', 7, 'impuestos', 'IMP DE SELLOS', 'Sellos Bancario · PAM', 'Sellos sobre intereses', 'DIST MA'),
  ('tarjeta_visa_ma', 7, 'otras', 'EDESUR DEB AUT', 'Luz Libertad · MA 2026', 'Luz Libertad — Edesur Deb Aut', null),
  ('tarjeta_visa_ma', 8, 'otras', 'IPLAN NETWORKS', 'Internet Libertad · MA 2026', 'Internet Libertad — Iplan Networks', null),
  ('tarjeta_visa_ma', 9, 'otras', 'JOCKEY CLUB ASOC', 'Jockey Club · MA 2026', 'Jockey Club — Jockey Club Asoc', null),
  ('tarjeta_visa_ma', 10, 'otras', 'MERPAGO*ESET', 'Eset (antivirus) · MA 2026', 'Eset (antivirus) — Merpago Eset', null),
  ('tarjeta_visa_ma', 11, 'otras', 'MERPAGO*IPLAN', 'Internet Libertad · MA 2026', 'Internet Libertad — Merpago Iplan', null),
  ('tarjeta_visa_ma', 12, 'otras', 'MOVISTAR HOGAR', 'Telefono Fijo 812 · MA 2026', 'Telefono Fijo 812 — Movistar Hogar', null),
  ('tarjeta_visa_ma', 13, 'otras', 'NETFLIX.COM', 'Netflix · MA 2026', 'Netflix — Netflix', null),
  ('tarjeta_visa_ma', 14, 'otras', '300076464741', 'Paquete TV MA · MA 2026', 'Paquete TV MA — Personal', null),
  ('tarjeta_visa_ma', 15, 'otras', 'SPOTIFY', 'Spotify · MA 2026', 'Spotify — Spotify', null),
  ('tarjeta_visa_ma', 16, 'otras', 'SUSC CLUB LA NAC', 'Club La Nación · MA 2026', 'Club La Nación — Susc Club La', null),
  ('tarjeta_visa_pam', 8, 'otras', 'CHUBB SEGUROS', 'Seguro Chalet · PAM 2025', 'Seguro Chalet — Chubb Seguros', 'DIST MA'),
  ('tarjeta_visa_pam', 9, 'otras', 'DISNEY PLUS', 'Disney Plus · PAM 2025', 'Disney Plus — Disney Plus', 'DIST MA'),
  ('tarjeta_visa_pam', 10, 'otras', 'EDESUR DEB AUT', 'Luz Libertad · PAM 2025', 'Luz Libertad — Edesur Deb Aut', 'DIST MA'),
  ('tarjeta_visa_pam', 11, 'otras', 'IPLAN NETWORKS', 'Internet Libertad · PAM 2025', 'Internet Libertad — Iplan Networks', 'DIST MA'),
  ('tarjeta_visa_pam', 12, 'otras', 'JOCKEY CLUB ASOC', 'Jockey Club · PAM 2025', 'Jockey Club — Jockey Club Asoc', 'DIST MA'),
  ('tarjeta_visa_pam', 13, 'otras', 'MOVISTAR HOGAR', 'Telefono Fijo 812 · PAM 2025', 'Telefono Fijo 812 — Movistar Hogar', 'DIST MA'),
  ('tarjeta_visa_pam', 14, 'otras', 'NETFLIX.COM', 'Netflix · PAM 2025', 'Netflix — Netflix', 'DIST MA'),
  ('tarjeta_visa_pam', 15, 'otras', 'OMINT DE SERVICI', 'Omint AMS · PAM 2025', 'Omint AMS — Omint De Servici', 'DIST AMS'),
  ('tarjeta_visa_pam', 16, 'otras', '100334148151', 'Paquete TV MA · PAM 2025', 'Paquete TV MA — Personal Flow', 'DIST MA'),
  ('tarjeta_visa_pam', 17, 'otras', 'SPOTIFY', 'Spotify · PAM 2025', 'Spotify — Spotify', 'DIST MA'),
  ('tarjeta_visa_pam', 18, 'otras', 'SUSC CLUB LA NAC', 'Club La Nación · PAM 2025', 'Club La Nación — Susc Club La', 'DIST MA'),
  ('tarjeta_visa_ma', 17, 'otras', 'A PUNTO', 'Consumos MA · MA', 'Consumos MA — A Punto', null),
  ('tarjeta_visa_ma', 18, 'otras', 'AMAZON MKTPL', 'Consumos MA · MA', 'Consumos MA — Amazon', null),
  ('tarjeta_visa_ma', 19, 'otras', 'APPLE.COM', 'Consumos MA · MA', 'Consumos MA — Apple.Com', null),
  ('tarjeta_visa_ma', 20, 'otras', 'ATENEO GRAND SPLENDID', 'Consumos MA · MA', 'Consumos MA — Ateneo Grand Splendid', null),
  ('tarjeta_visa_ma', 21, 'otras', 'AWADA PATIO BULRRICH', 'Consumos MA · MA', 'Consumos MA — Awada Patio Bulrrich', null),
  ('tarjeta_visa_ma', 22, 'otras', 'BABY URUGUAY', 'Consumos MA · MA', 'Consumos MA — Baby Uruguay', null),
  ('tarjeta_visa_ma', 23, 'otras', 'BURGUETE', 'Consumos MA · MA', 'Consumos MA — Burguete', null),
  ('tarjeta_visa_ma', 24, 'otras', 'CANTINA NAUTICA', 'Consumos MA · MA', 'Consumos MA — Cantina Nautica', null),
  ('tarjeta_visa_ma', 25, 'otras', 'CASA CAVIA', 'Consumos MA · MA', 'Consumos MA — Casa Cavia', null),
  ('tarjeta_visa_ma', 26, 'otras', 'CASA DEL AUDIO', 'Consumos MA · MA', 'Consumos MA — Casa Del Audio', null),
  ('tarjeta_visa_ma', 27, 'otras', 'CERINI BARRIO NORTE', 'Consumos MA · MA', 'Consumos MA — Cerini Barrio Norte', null),
  ('tarjeta_visa_ma', 28, 'otras', 'CHEEKY', 'Consumos MA · MA', 'Consumos MA — Cheeky', null),
  ('tarjeta_visa_ma', 29, 'otras', 'CINEPOLIS RECOLETA', 'Consumos MA · MA', 'Consumos MA — Cinepolis Recoleta', null),
  ('tarjeta_visa_ma', 30, 'otras', 'CRISTOBAL COLON I', 'Consumos MA · MA', 'Consumos MA — Cristobal Colon I', null),
  ('tarjeta_visa_ma', 31, 'otras', 'CUORE PATIO BULLRICH', 'Consumos MA · MA', 'Consumos MA — Cuore Patio Bullrich', null),
  ('tarjeta_visa_ma', 32, 'otras', 'DAVANTI', 'Consumos MA · MA', 'Consumos MA — Davanti', null),
  ('tarjeta_visa_ma', 33, 'otras', 'DEPORTES SAN ISIDRO', 'Consumos MA · MA', 'Consumos MA — Deportes San Isidro', null),
  ('tarjeta_visa_ma', 34, 'otras', 'DLO*RAPPI', 'Consumos MA · MA', 'Consumos MA — Dlo Rappi', null),
  ('tarjeta_visa_ma', 35, 'otras', 'DLO*RAPPI PRO', 'Consumos MA · MA', 'Consumos MA — Dlo Rappi Pro', null),
  ('tarjeta_visa_ma', 36, 'otras', 'DLO*Wood Idea', 'Consumos MA · MA', 'Consumos MA — Dlo Wood Idea', null),
  ('tarjeta_visa_ma', 37, 'otras', 'DLOCAL*FUND MAGNIFICAT', 'Consumos MA · MA', 'Consumos MA — Dlocal Fund Magnificat', null),
  ('tarjeta_visa_ma', 38, 'otras', 'E AMIGOS DEL DESIERTO', 'Consumos MA · MA', 'Consumos MA — E Amigos Del', null),
  ('tarjeta_visa_ma', 39, 'otras', 'ESMERO CAFE-ESMERO CAFE', 'Consumos MA · MA', 'Consumos MA — Esmero Cafe-Esmero Cafe', null),
  ('tarjeta_visa_ma', 40, 'otras', 'EYELIT', 'Consumos MA · MA', 'Consumos MA — Eyelit', null),
  ('tarjeta_visa_ma', 41, 'otras', 'FABRIC SUSHI ACASSUSO', 'Consumos MA · MA', 'Consumos MA — Fabric Sushi Acassuso', null),
  ('tarjeta_visa_ma', 42, 'otras', 'FARMACIA VARELA SA', 'Gastos Medicos · MA', 'Gastos Medicos — Farmacia Varela Sa', null),
  ('tarjeta_visa_ma', 43, 'otras', 'FARMACITY', 'Gastos Medicos · MA', 'Gastos Medicos — Farmacity', null),
  ('tarjeta_visa_ma', 44, 'otras', 'GREEN HOUSE', 'Consumos MA · MA', 'Consumos MA — Green House', null),
  ('tarjeta_visa_ma', 45, 'otras', 'HACIENDO CAMINO', 'Consumos MA · MA', 'Consumos MA — Haciendo Camino', null),
  ('tarjeta_visa_ma', 46, 'otras', 'HAKUNA-SUCURSAL JUNCAL', 'Consumos MA · MA', 'Consumos MA — Hakuna-Sucursal Juncal', null),
  ('tarjeta_visa_ma', 47, 'otras', 'ICEBOW', 'Consumos MA · MA', 'Consumos MA — Icebow', null),
  ('tarjeta_visa_ma', 48, 'otras', 'JULERIAQUE', 'Consumos MA · MA', 'Consumos MA — Juleriaque', null),
  ('tarjeta_visa_ma', 49, 'otras', 'JYG (MOVIL)', 'Consumos MA · MA', 'Consumos MA — Jyg Movil', null),
  ('tarjeta_visa_ma', 50, 'otras', 'LEGACY', 'Consumos MA · MA', 'Consumos MA — Legacy', null),
  ('tarjeta_visa_ma', 51, 'otras', 'MAC ALTO PALERMO', 'Consumos MA · MA', 'Consumos MA — Mac Alto Palermo', null),
  ('tarjeta_visa_ma', 52, 'otras', 'MARIA LAZO', 'Consumos MA · MA', 'Consumos MA — Maria Lazo', null),
  ('tarjeta_visa_ma', 53, 'otras', 'Market Acasusso', 'Consumos MA · MA', 'Consumos MA — Market Acasusso Av', null),
  ('tarjeta_visa_ma', 54, 'otras', 'Market Mercado', 'Consumos MA · MA', 'Consumos MA — Market Mercado', null),
  ('tarjeta_visa_ma', 55, 'otras', 'MERPAGO*AGBAZAR', 'Consumos MA · MA', 'Consumos MA — Merpago Agbazar', null),
  ('tarjeta_visa_ma', 56, 'otras', 'MERPAGO*ALMABRANDS', 'Consumos MA · MA', 'Consumos MA — Merpago Almabrands', null),
  ('tarjeta_visa_ma', 57, 'otras', 'MERPAGO*ATLASCINES', 'Consumos MA · MA', 'Consumos MA — Merpago Atlascines', null),
  ('tarjeta_visa_ma', 58, 'otras', 'MERPAGO*ATLASPATIO', 'Consumos MA · MA', 'Consumos MA — Merpago Atlaspatio', null),
  ('tarjeta_visa_ma', 59, 'otras', 'MERPAGO*BIDCOM', 'Consumos MA · MA', 'Consumos MA — Merpago Bidcom', null),
  ('tarjeta_visa_ma', 60, 'otras', 'MERPAGO*GARRASHOP', 'Consumos MA · MA', 'Consumos MA — Merpago Garrashop', null),
  ('tarjeta_visa_ma', 61, 'otras', 'MERPAGO*HARMONY', 'Consumos MA · MA', 'Consumos MA — Merpago Harmony', null),
  ('tarjeta_visa_ma', 62, 'otras', 'MERPAGO*HUELLITAS', 'Consumos MA · MA', 'Consumos MA — Merpago Huellitas', null),
  ('tarjeta_visa_ma', 63, 'otras', 'MERPAGO*ICONTI', 'Consumos MA · MA', 'Consumos MA — Merpago Iconti', null),
  ('tarjeta_visa_ma', 64, 'otras', 'MERPAGO*JUGUETERIA', 'Consumos MA · MA', 'Consumos MA — Merpago Jugueteria', null),
  ('tarjeta_visa_ma', 65, 'otras', 'MERPAGO*MAISONMIMMI', 'Consumos MA · MA', 'Consumos MA — Merpago Maisonmimmi', null),
  ('tarjeta_visa_ma', 66, 'otras', 'MERPAGO*MASCOTASHAPPY', 'Consumos MA · MA', 'Consumos MA — Merpago Mascotashappy', null),
  ('tarjeta_visa_ma', 67, 'otras', 'MERPAGO*MAVIMA', 'Consumos MA · MA', 'Consumos MA — Merpago Mavima', null),
  ('tarjeta_visa_ma', 68, 'otras', 'MERPAGO*MERCADOLIBRE', 'Consumos MA · MA', 'Consumos MA — Merpago Mercadolibre', null),
  ('tarjeta_visa_ma', 69, 'otras', 'MERPAGO*OSCAR', 'Consumos MA · MA', 'Consumos MA — Merpago Oscar', null),
  ('tarjeta_visa_ma', 70, 'otras', 'MERPAGO*PETITPETSHOP', 'Consumos MA · MA', 'Consumos MA — Merpago Petitpetshop', null),
  ('tarjeta_visa_ma', 71, 'otras', 'MERPAGO*PETSHOPCUENCA', 'Consumos MA · MA', 'Consumos MA — Merpago Petshopcuenca', null),
  ('tarjeta_visa_ma', 72, 'otras', 'MERPAGO*PUPPYSHOP', 'Consumos MA · MA', 'Consumos MA — Merpago Puppyshop', null),
  ('tarjeta_visa_ma', 73, 'otras', 'MERPAGO*RECURSODIGTAL', 'Consumos MA · MA', 'Consumos MA — Merpago Recursodigtal', null),
  ('tarjeta_visa_ma', 74, 'otras', 'MERPAGO*ROSSI', 'Consumos MA · MA', 'Consumos MA — Merpago Rossi', null),
  ('tarjeta_visa_ma', 75, 'otras', 'MERPAGO*SOYTUFARMACIA', 'Gastos Medicos · MA', 'Gastos Medicos — Merpago Soytufarmacia', null),
  ('tarjeta_visa_ma', 76, 'otras', 'MERPAGO*TRENDYSTORE', 'Consumos MA · MA', 'Consumos MA — Merpago Trendystore', null),
  ('tarjeta_visa_ma', 77, 'otras', 'MERPAGO*ZIVALS', 'Consumos MA · MA', 'Consumos MA — Merpago Zivals', null),
  ('tarjeta_visa_ma', 78, 'otras', 'MISHKA-PATIO BULLRICH', 'Consumos MA · MA', 'Consumos MA — Mishka-Patio Bullrich', null),
  ('tarjeta_visa_ma', 79, 'otras', 'NEW MADERO PETS', 'Consumos MA · MA', 'Consumos MA — New Madero Pets', null),
  ('tarjeta_visa_ma', 80, 'otras', 'NORTHPETS', 'Consumos MA · MA', 'Consumos MA — Northpets', null),
  ('tarjeta_visa_ma', 81, 'otras', 'OPTICA PARERA', 'Gastos Medicos · MA', 'Gastos Medicos — Optica Parera', null),
  ('tarjeta_visa_ma', 82, 'otras', 'PAMPERO JUNCAL', 'Consumos MA · MA', 'Consumos MA — Pampero Juncal', null),
  ('tarjeta_visa_ma', 83, 'otras', 'PEDIDOSYA', 'Consumos MA · MA', 'Consumos MA — Pedidosya', null),
  ('tarjeta_visa_ma', 84, 'otras', 'PVS*SUPERMERCADO AMOR LIB', 'Consumos MA · MA', 'Consumos MA — Pvs Supermercado Amor', null),
  ('tarjeta_visa_ma', 85, 'otras', 'RAPPIPRO', 'Consumos MA · MA', 'Consumos MA — Rappipro', null),
  ('tarjeta_visa_ma', 86, 'otras', 'RES - LIBERTAD', 'Consumos MA · MA', 'Consumos MA — Res - Libertad', null),
  ('tarjeta_visa_ma', 87, 'otras', 'RES LIBERTAD', 'Consumos MA · MA', 'Consumos MA — Res Libertad', null),
  ('tarjeta_visa_ma', 88, 'otras', 'RES PUEYRREDON', 'Consumos MA · MA', 'Consumos MA — Res Pueyrredon', null),
  ('tarjeta_visa_ma', 89, 'otras', 'SANTOS COMPANY - ELEPHANT', 'Consumos MA · MA', 'Consumos MA — Santos Company -', null),
  ('tarjeta_visa_ma', 90, 'otras', 'SORRENTO', 'Consumos MA · MA', 'Consumos MA — Sorrento', null),
  ('tarjeta_visa_ma', 91, 'otras', 'SPORTING', 'Consumos MA · MA', 'Consumos MA — Sporting', null),
  ('tarjeta_visa_ma', 92, 'otras', 'STARBUCKS HOSPITAL AUSTRA', 'Consumos MA · MA', 'Consumos MA — Starbucks Hospital Austra', null),
  ('tarjeta_visa_ma', 93, 'otras', 'SUAYA UNIFORMES SRL', 'Consumos MA · MA', 'Consumos MA — Suaya Uniformes Srl', null),
  ('tarjeta_visa_ma', 94, 'otras', 'TDD SANTA FE', 'Consumos MA · MA', 'Consumos MA — Tdd Santa Fe', null),
  ('tarjeta_visa_ma', 95, 'otras', 'TEMU', 'Consumos MA · MA', 'Consumos MA — Temu', null),
  ('tarjeta_visa_ma', 96, 'otras', 'VIP DE LA PLAZA', 'Consumos MA · MA', 'Consumos MA — Vip De La', null),
  ('tarjeta_visa_ma', 97, 'otras', 'WWW.CARREFOUR.COM.AR', 'Consumos MA · MA', 'Consumos MA — Www Carrefour Com', null),
  ('tarjeta_visa_pam', 19, 'otras', 'AMAYTA SALON', 'Consumos MA · PAM 2025', 'Consumos MA — Amayta Salon', 'DIST MA'),
  ('tarjeta_visa_pam', 20, 'otras', 'APPLE.COM', 'Consumos MA · PAM 2025', 'Consumos MA — Apple.Com', 'DIST MA'),
  ('tarjeta_visa_pam', 21, 'otras', 'ARNALDI', 'Consumos MA · PAM 2025', 'Consumos MA — Arnaldi', 'DIST MA'),
  ('tarjeta_visa_pam', 22, 'otras', 'ARREDO', 'Consumos MA · PAM 2025', 'Consumos MA — Arredo', 'DIST MA'),
  ('tarjeta_visa_pam', 23, 'otras', 'BLUE SHEEP PATIO', 'Consumos MA · PAM 2025', 'Consumos MA — Blue Sheep Patio', 'DIST MA'),
  ('tarjeta_visa_pam', 24, 'otras', 'CARDON', 'Consumos MA · PAM 2025', 'Consumos MA — Cardon', 'DIST MA'),
  ('tarjeta_visa_pam', 25, 'otras', 'CASA ARNALDI', 'Consumos MA · PAM 2025', 'Consumos MA — Casa Arnaldi', 'DIST MA'),
  ('tarjeta_visa_pam', 26, 'otras', 'CUORE PATIO BULLRICH', 'Consumos MA · PAM 2025', 'Consumos MA — Cuore Patio Bullrich', 'DIST MA'),
  ('tarjeta_visa_pam', 27, 'otras', 'E AMIGOS DEL DESIERTO', 'Consumos MA · PAM 2025', 'Consumos MA — E Amigos Del', 'DIST MA'),
  ('tarjeta_visa_pam', 28, 'otras', 'EL TREBOL', 'Consumos MA · PAM 2025', 'Consumos MA — El Trebol', 'DIST MA'),
  ('tarjeta_visa_pam', 29, 'otras', 'EXPOSICION SRL', 'Consumos MA · PAM 2025', 'Consumos MA — Exposicion Srl', 'DIST MA'),
  ('tarjeta_visa_pam', 30, 'otras', 'Express Las Heras', 'Consumos MA · PAM 2025', 'Consumos MA — Express Las Heras', 'DIST MA'),
  ('tarjeta_visa_pam', 31, 'otras', 'FABIANA PIO', 'Consumos MA · PAM 2025', 'Consumos MA — Fabiana Pio', 'DIST MA'),
  ('tarjeta_visa_pam', 32, 'otras', 'FARMACIA MAGISTER', 'Gastos Medicos · PAM 2025', 'Gastos Medicos — Farmacia Magister', 'DIST MA'),
  ('tarjeta_visa_pam', 33, 'otras', 'FARMACIA MORTEO', 'Gastos Medicos · PAM 2025', 'Gastos Medicos — Farmacia Morteo', 'DIST MA'),
  ('tarjeta_visa_pam', 34, 'otras', 'FARMACITY', 'Gastos Medicos · PAM 2025', 'Gastos Medicos — Farmacity', 'DIST MA'),
  ('tarjeta_visa_pam', 35, 'otras', 'GIRO DIDACTICO', 'Consumos MA · PAM 2025', 'Consumos MA — Giro Didactico', 'DIST MA'),
  ('tarjeta_visa_pam', 36, 'otras', 'GREEN HOUSE', 'Consumos MA · PAM 2025', 'Consumos MA — Green House', 'DIST MA'),
  ('tarjeta_visa_pam', 37, 'otras', 'HOME COLLECTION', 'Consumos MA · PAM 2025', 'Consumos MA — Home Collection', 'DIST MA'),
  ('tarjeta_visa_pam', 38, 'otras', 'JUGUETERIA OSITO AZU', 'Consumos MA · PAM 2025', 'Consumos MA — Jugueteria Osito Azu', 'DIST MA'),
  ('tarjeta_visa_pam', 39, 'otras', 'LA COUTURE', 'Consumos MA · PAM 2025', 'Consumos MA — La Couture', 'DIST MA'),
  ('tarjeta_visa_pam', 40, 'otras', 'LA PANERA ROSA', 'Consumos MA · PAM 2025', 'Consumos MA — La Panera Rosa', 'DIST MA'),
  ('tarjeta_visa_pam', 41, 'otras', 'LE PAIN QUOTIDIEN PALMAS', 'Consumos MA · PAM 2025', 'Consumos MA — Le Pain Quotidien', 'DIST MA'),
  ('tarjeta_visa_pam', 42, 'otras', 'MAZZEO FAMILIA CON PASTA', 'Consumos MA · PAM 2025', 'Consumos MA — Mazzeo Familia Con', 'DIST MA'),
  ('tarjeta_visa_pam', 43, 'otras', 'MERPAGO*BLUESHEEP', 'Consumos MA · PAM 2025', 'Consumos MA — Merpago Bluesheep', 'DIST MA'),
  ('tarjeta_visa_pam', 44, 'otras', 'MERPAGO*ELNENE', 'Consumos MA · PAM 2025', 'Consumos MA — Merpago Elnene', 'DIST MA'),
  ('tarjeta_visa_pam', 45, 'otras', 'MERPAGO*NEWGARDEN', 'Consumos MA · PAM 2025', 'Consumos MA — Merpago Newgarden', 'DIST MA'),
  ('tarjeta_visa_pam', 46, 'otras', 'MERPAGO*OPORTUNIDADES', 'Consumos MA · PAM 2025', 'Consumos MA — Merpago Oportunidades', 'DIST MA'),
  ('tarjeta_visa_pam', 47, 'otras', 'MERPAGO*WOOPYLIBRERIA', 'Consumos MA · PAM 2025', 'Consumos MA — Merpago Woopylibreria', 'DIST MA'),
  ('tarjeta_visa_pam', 48, 'otras', 'NORTHMARKET S.A', 'Consumos MA · PAM 2025', 'Consumos MA — Northmarket S A', 'DIST MA'),
  ('tarjeta_visa_pam', 49, 'otras', 'PAYU*AR*UBER', 'Consumos MA · PAM 2025', 'Consumos MA — Payu Ar Uber', 'DIST MA'),
  ('tarjeta_visa_pam', 50, 'otras', 'PEDIDOS', 'Consumos MA · PAM 2025', 'Consumos MA — Pedidosya', 'DIST MA'),
  ('tarjeta_visa_pam', 51, 'otras', 'PESCADERIA NAPOLI', 'Consumos MA · PAM 2025', 'Consumos MA — Pescaderia Napoli', 'DIST MA'),
  ('tarjeta_visa_pam', 52, 'otras', 'PETIT COLON', 'Consumos MA · PAM 2025', 'Consumos MA — Petit Colon', 'DIST MA'),
  ('tarjeta_visa_pam', 53, 'otras', 'REGINA FROM', 'Consumos MA · PAM 2025', 'Consumos MA — Regina From', 'DIST MA'),
  ('tarjeta_visa_pam', 54, 'otras', 'RES LIBERTAD', 'Consumos MA · PAM 2025', 'Consumos MA — Res Libertad', 'DIST MA'),
  ('tarjeta_visa_pam', 55, 'otras', 'RG.RAMOS GENERALES', 'Consumos MA · PAM 2025', 'Consumos MA — Rg Ramos Generales', 'DIST MA'),
  ('tarjeta_visa_pam', 56, 'otras', 'SKOOL.COM', 'Consumos MA · PAM 2025', 'Consumos MA — Skool', 'DIST MA'),
  ('tarjeta_visa_pam', 57, 'otras', 'SUPER JUJUY', 'Consumos MA · PAM 2025', 'Consumos MA — Super Jujuy', 'DIST MA'),
  ('tarjeta_visa_pam', 58, 'otras', 'TACKROOM', 'Consumos MA · PAM 2025', 'Consumos MA — Tackroom', 'DIST MA'),
  ('tarjeta_visa_pam', 59, 'otras', 'ZARA', 'Consumos MA · PAM 2025', 'Consumos MA — Zara', 'DIST MA')
) as r(cuenta, orden, tipo, texto, clave, detalle, ci)
join t104 t on t.clave = r.clave
join public.egresos_sin_factura e on e.id = t.id;

do $$ begin
  if (select count(*) from public.reglas_conciliacion where cuenta_bancaria_id in ('tarjeta_visa_pam', 'tarjeta_visa_ma')) <> 156 then
    raise exception 'No quedaron las 156 reglas (falta un template de alguna regla): %',
      (select count(*) from public.reglas_conciliacion where cuenta_bancaria_id in ('tarjeta_visa_pam', 'tarjeta_visa_ma'));
  end if;
end $$;

-- 4 · Contable/interno (Tab 2): tarjeta de MA pagando un template de PAM (2025) → DIST MA ----------------
insert into public.reglas_contable_interno (cuenta_bancaria_id, orden, activo, tipo_regla, responsable, codigo_contable, codigo_interno, descripcion)
values ('tarjeta_visa_ma', 1, true, 'responsable', 'PAM', null, 'DIST MA', '[script 104] tarjeta de MA pagando gasto de MA del año contable de PAM (2025)');

-- ── Control (antes del commit, se ve en la salida) ──────────────────────────────────────────────
select now() as marca_created_at,
  (select count(*) from public.egresos_sin_factura where observaciones_template like '[script 104]%') as templates,
  (select count(*) from public.reglas_conciliacion where cuenta_bancaria_id = 'tarjeta_visa_pam') as reglas_pam,
  (select count(*) from public.reglas_conciliacion where cuenta_bancaria_id = 'tarjeta_visa_ma') as reglas_ma,
  (select count(*) from public.reglas_contable_interno where descripcion like '[script 104]%') as contable_interno,
  (select count(*) from public.centros_costo where lower(nombre) = 'chalet') as centro_chalet;
-- 🏷️ Toda categ de lo cargado existe en el plan con su tipo (regla de CLAUDE.md § Templates). Tiene que dar 0 filas.
select e.nombre_referencia, e.responsable, e.categ from public.egresos_sin_factura e
 left join public.cuentas_contables c on c.categ = e.categ
 where e.observaciones_template like '[script 104]%' and (c.categ is null or c.tipo is null);
-- 🔗 Cada 2026 apunta a su 2025. Tiene que dar 0 filas.
select e.nombre_referencia from public.egresos_sin_factura e
 where e.observaciones_template like '[script 104]%' and e.responsable = 'MA' and e.año = '2026'
   and e.template_origen_id is null and e.nombre_referencia <> 'Eset (antivirus)';

commit;
