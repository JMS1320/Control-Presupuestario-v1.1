-- 97 · CZ GANADERA → DOS TEMPLATES: «DTE Senasa» y «Guías Municipales» (A-FEAT-1326, usuario 2026-10-23)
--
-- «Deben ser dos templates. DTE Senasa: ahí van los pagos de DTE; y Guías Municipales. Las 2 bajo la
-- agrupadora CZ Ganadería. En uno el proveedor es Senasa y en el otro la Muni de SP. Senasa es template
-- abierto que se llena en conciliación por regla, y guía son pagos que cargo vía manual.»
--
-- Qué hace (todo MSA, categoría «CZ Ganadera» sin cambios):
--   1. El template actual «CZ Ganadera» pasa a llamarse «DTE Senasa», proveedor SENASA, agrupadora
--      «CZ Ganadera». Se queda con su historia de DTE (28/01 $47.377,51 y 01/04 $1.747,88, conciliadas).
--   2. Template nuevo «Guías Municipales», abierto, proveedor Municipalidad SP (CUIT 30669239765,
--      el mismo de los templates de Red Vial), misma categoría y agrupadora.
--   3. Las cuotas de guías pasan al template nuevo (la cuota es la misma: su id no cambia):
--        7ded1b43… 04/02 $99.982 «Guia de Hacienda» (conciliada con msa_galicia fc77cd6b…)
--        9c025112… 02/10 $13.073 «Guia Municipal 7 Vacas + 3 Toros» (pagada)
--        5b808d91… 23/10 $0 «Guia Municipal Venta a Arrebeef» / detalle «quedo cuota por error» (pendiente)
--   4. 🔁 Propagación: el movimiento del banco conciliado con la guía del 04/02 guarda también el
--      template (`msa_galicia.template_id`) → se actualiza al nuevo. El vínculo a la cuota
--      (`template_cuota_id`) no cambia porque la cuota es la misma.
--
-- ⚠️ No se crea la regla de SENASA: el débito del DTE llega como «Deb. Autom. De Serv.», el mismo texto
-- que los seguros y otros débitos — una regla por ese texto los mezclaría. Se crea desde la conciliación
-- cuando se vea qué lo distingue.
-- ⚠️ SENASA no está en proveedores (no hay CUIT): el template queda con el nombre y sin CUIT.
-- ⚠️ La categoría «CZ Ganadera» no está en el plan de cuentas (preexistente, § C-26) — no se toca acá.
--
-- Deshacer: 97-cz-dos-templates-deshacer.sql

begin;

-- 1 · El actual pasa a ser DTE Senasa
update public.egresos_sin_factura
set nombre_referencia = 'DTE Senasa', proveedor = 'SENASA', nombre_quien_cobra = 'SENASA', cuenta_agrupadora = 'CZ Ganadera'
where id = 'a9762127-f643-464f-a5f4-20aa15042e0d' and nombre_referencia = 'CZ Ganadera';

-- 2 · Template nuevo Guías Municipales (copia la configuración del de DTE)
insert into public.egresos_sin_factura (
  template_master_id, nombre_referencia, categ, responsable, actualizacion_proximas_cuotas, activo,
  tipo_recurrencia, pago_anual, cuenta_agrupadora, tipo_template, es_bidireccional, solo_conciliacion,
  es_multi_cuenta, periodicidad, aplica_generacion, tipo, proveedor, cuit_quien_cobra, nombre_quien_cobra)
select template_master_id, 'Guías Municipales', categ, responsable, actualizacion_proximas_cuotas, true,
  tipo_recurrencia, pago_anual, 'CZ Ganadera', tipo_template, es_bidireccional, solo_conciliacion,
  es_multi_cuenta, periodicidad, aplica_generacion, tipo, 'Municipalidad SP', '30669239765', 'Municipalidad SP'
from public.egresos_sin_factura
where id = 'a9762127-f643-464f-a5f4-20aa15042e0d'
  and not exists (select 1 from public.egresos_sin_factura where nombre_referencia = 'Guías Municipales' and responsable = 'MSA');

-- 3 · Las guías al template nuevo
update public.cuotas_egresos_sin_factura
set egreso_id = (select id from public.egresos_sin_factura where nombre_referencia = 'Guías Municipales' and responsable = 'MSA')
where egreso_id = 'a9762127-f643-464f-a5f4-20aa15042e0d'
  and id in ('7ded1b43-72fe-427c-bae3-a72f1d8248ea', '9c025112-57fb-45ed-914f-3cfa14e09978', '5b808d91-872f-42ae-86d0-517d8f503728');

-- 4 · El movimiento conciliado con la guía del 04/02 apunta al template nuevo
update public.msa_galicia
set template_id = (select id from public.egresos_sin_factura where nombre_referencia = 'Guías Municipales' and responsable = 'MSA')
where id = 'fc77cd6b-1759-4622-b03a-eddd2b3da2f2' and template_cuota_id = '7ded1b43-72fe-427c-bae3-a72f1d8248ea';

commit;

-- Control (sin escribir):
-- select e.nombre_referencia, count(c.*), sum(c.monto) from public.egresos_sin_factura e
--   left join public.cuotas_egresos_sin_factura c on c.egreso_id = e.id
--   where e.nombre_referencia in ('DTE Senasa','Guías Municipales') group by 1;
--   → DTE Senasa 2 · 49.125,39  ·  Guías Municipales 3 · 113.055
-- select m.id from public.msa_galicia m join public.cuotas_egresos_sin_factura c on c.id = m.template_cuota_id
--   where m.template_id is distinct from c.egreso_id;   → 0 filas (ningún movimiento apunta al template viejo)
