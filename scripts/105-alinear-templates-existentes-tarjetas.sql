-- 105 · ALINEAR templates que YA EXISTEN al criterio de las tarjetas (A-DAT-92): «2025 PAM con DIST MA → 2026 MA».
--
-- 🛑 MODIFICA FILAS EXISTENTES, varias con cuotas YA CONCILIADAS. Correr sólo con OK explícito del usuario a CADA
-- bloque, y DESPUÉS del 104 (usa los renglones 2025 que crea el 104). Se puede correr por bloques: cada uno es
-- independiente; comentar los que no tengan OK.
--
-- Foto antes: los valores de abajo (columna «antes») son los de la base al 2026-10-25 noche. El script SE FRENA si
-- alguna fila ya no tiene esos valores (alguien la tocó): la foto dejaría de servir para el deshacer.
-- Deshacer: 105-alinear-templates-existentes-tarjetas-deshacer.sql (vuelve exactamente a la foto).
--
-- QUÉ HACE
--   A. Consumos MA (MA): año vacío → 2026, enganchado a «Consumos MA · PAM 2025» (del 104).         21 cuotas conc. (2026)
--   B. Gastos Medicos (MA): año vacío → 2026, enganchado a «Gastos Medicos · PAM 2025» (del 104).   3 cuotas conc. (2026)
--   C. Seguro Chalet (MA 2026): cuenta «Seguro Chalet» (no está en el plan) → SEGUROS ESTRUCTURA; centro Estructura
--      → Chalet; proveedor → Chubb; enganchado a «Seguro Chalet · PAM 2025» (del 104). Y la regla CHUBB de la
--      tarjeta de MSA, que copia la cuenta del template, pasa también a SEGUROS ESTRUCTURA.            8 cuotas conc.
--   D. Libertad 2026 (hoy PAM) → responsable MA, enganchados a su 2025: AYSA, Metrogas, Expensas, ABL Cuota; ABL Anual
--      sólo cambia de responsable (no tiene 2025). Metrogas: cuenta «Fijos Libertad» → GAS (está en el plan).
--      AYSA 3 · Metrogas 3 · Expensas 9 · ABL Cuota 6 · ABL Anual 1 cuotas conciliadas (todas 2026).
--
-- NO TOCA (necesita decisión del usuario): la cuenta de AYSA y Expensas («Fijos Libertad» / «Expensas Libertad»: el plan
-- no tiene AGUA ni EXPENSAS) ni la de ABL; el código interno DIST MA que siguen teniendo los Libertad 2026 (el motor no
-- lo usa: usa el de la regla); ACA, que tiene DOS 2026 (PAM y MA); la cuenta de los movimientos YA conciliados (quedan
-- con la que tenían: cambiar el template no la propaga).
--
-- ⚠️ Efecto en la conciliación: las reglas de la caja de ahorro de MA (script 103) que apuntan a Consumos MA, Gastos
-- Medicos y AYSA siguen andando para 2026; un movimiento de 2025 de esas reglas queda A AUDITAR («Falta la campaña
-- 2025…») hasta que el motor siga el enlace 2026 → 2025 (ver informe del 104). Revisar A-TEST-1257 (AYSA y ABL de MA
-- usan sus cuotas precargadas) después de correr el bloque D.

begin;

-- Foto: (id, columna, valor antes)
create temp table foto105 (id uuid, col text, antes text) on commit drop;
insert into foto105 values
  ('79c4229e-288c-40a1-98a0-da24482b3eeb', 'año', null),
  ('79c4229e-288c-40a1-98a0-da24482b3eeb', 'template_origen_id', null),
  ('930e624d-b74b-4430-ad00-743c6ba02923', 'año', null),
  ('930e624d-b74b-4430-ad00-743c6ba02923', 'template_origen_id', null),
  ('2bdfc04c-9ed1-4a55-9e9c-9c5997f65640', 'categ', 'Seguro Chalet'),
  ('2bdfc04c-9ed1-4a55-9e9c-9c5997f65640', 'centro_costo', 'Estructura'),
  ('2bdfc04c-9ed1-4a55-9e9c-9c5997f65640', 'proveedor', null),
  ('2bdfc04c-9ed1-4a55-9e9c-9c5997f65640', 'template_origen_id', null),
  ('11921930-21d4-4867-9b6f-c01de2247ad4', 'responsable', 'PAM'),
  ('11921930-21d4-4867-9b6f-c01de2247ad4', 'template_origen_id', null),
  ('3c7911fd-8cc9-4df7-974f-d8fc3adf8eec', 'responsable', 'PAM'),
  ('3c7911fd-8cc9-4df7-974f-d8fc3adf8eec', 'categ', 'Fijos Libertad'),
  ('3c7911fd-8cc9-4df7-974f-d8fc3adf8eec', 'template_origen_id', null),
  ('6563c6a5-9a45-4051-8080-7ff51baa7993', 'responsable', 'PAM'),
  ('6563c6a5-9a45-4051-8080-7ff51baa7993', 'template_origen_id', null),
  ('c0acd49c-9b7f-44fb-9459-4839a7b800d6', 'responsable', 'PAM'),
  ('c0acd49c-9b7f-44fb-9459-4839a7b800d6', 'template_origen_id', null),
  ('8d52aacd-885f-435b-b811-9882fb0f6d25', 'responsable', 'PAM');

do $$
declare n int;
begin
  -- 1 · la base sigue como en la foto
  select count(*) into n from foto105 f join public.egresos_sin_factura e on e.id = f.id
   where (case f.col when 'año' then e.año when 'template_origen_id' then e.template_origen_id::text when 'categ' then e.categ
                     when 'centro_costo' then e.centro_costo when 'proveedor' then e.proveedor when 'responsable' then e.responsable end)
         is distinct from f.antes;
  if n > 0 then raise exception '% valores ya no son los de la foto del 25/10: revisar antes de correr el 105.', n; end if;
  if (select categ from public.reglas_conciliacion where id = '0e1f115f-54f5-4864-af69-32515b95ed44') is distinct from 'Seguro Chalet' then
    raise exception 'La regla CHUBB de la tarjeta de MSA cambió desde la foto: revisar.';
  end if;
  -- 2 · el 104 está corrido (los renglones 2025 existen)
  if (select count(*) from public.egresos_sin_factura where observaciones_template like '[script 104]%' and año = '2025'
        and nombre_referencia in ('Consumos MA', 'Gastos Medicos', 'Seguro Chalet') and responsable = 'PAM') <> 3 then
    raise exception 'Faltan los renglones 2025 del 104: correr primero el 104.';
  end if;
end $$;

-- A · Consumos MA
update public.egresos_sin_factura set año = '2026',
  template_origen_id = (select id from public.egresos_sin_factura where observaciones_template like '[script 104]%'
                         and nombre_referencia = 'Consumos MA' and responsable = 'PAM' and año = '2025')
 where id = '79c4229e-288c-40a1-98a0-da24482b3eeb';

-- B · Gastos Medicos (MA)
update public.egresos_sin_factura set año = '2026',
  template_origen_id = (select id from public.egresos_sin_factura where observaciones_template like '[script 104]%'
                         and nombre_referencia = 'Gastos Medicos' and responsable = 'PAM' and año = '2025')
 where id = '930e624d-b74b-4430-ad00-743c6ba02923';

-- C · Seguro Chalet (MA 2026) + la regla CHUBB de la tarjeta de MSA
update public.egresos_sin_factura set categ = 'SEGUROS ESTRUCTURA', centro_costo = 'Chalet', proveedor = 'Chubb',
  template_origen_id = (select id from public.egresos_sin_factura where observaciones_template like '[script 104]%'
                         and nombre_referencia = 'Seguro Chalet' and responsable = 'PAM' and año = '2025')
 where id = '2bdfc04c-9ed1-4a55-9e9c-9c5997f65640';
update public.reglas_conciliacion set categ = 'SEGUROS ESTRUCTURA' where id = '0e1f115f-54f5-4864-af69-32515b95ed44';

-- D · Libertad 2026 → MA, enganchados a su 2025 (ya existentes)
update public.egresos_sin_factura set responsable = 'MA', template_origen_id = 'a3e4d09b-7853-49fa-9cf7-5e0704ea3657'
 where id = '11921930-21d4-4867-9b6f-c01de2247ad4';                                   -- AYSA Libertad
update public.egresos_sin_factura set responsable = 'MA', categ = 'GAS', template_origen_id = '0ce79816-1f56-401a-ba72-fa81ef104c8c'
 where id = '3c7911fd-8cc9-4df7-974f-d8fc3adf8eec';                                   -- Metrogas Libertad
update public.egresos_sin_factura set responsable = 'MA', template_origen_id = '68d7b742-962e-456b-8b76-2e235924b61a'
 where id = '6563c6a5-9a45-4051-8080-7ff51baa7993';                                   -- Expensas Libertad
update public.egresos_sin_factura set responsable = 'MA', template_origen_id = 'de27c254-f8d2-45ad-a689-d33041a2c087'
 where id = 'c0acd49c-9b7f-44fb-9459-4839a7b800d6';                                   -- ABL Libertad Cuota
update public.egresos_sin_factura set responsable = 'MA'
 where id = '8d52aacd-885f-435b-b811-9882fb0f6d25';                                   -- ABL Libertad Anual

-- Control: lo que quedó (se ve antes del commit)
select nombre_referencia, responsable, año, categ, centro_costo, proveedor, template_origen_id is not null as enganchado
  from public.egresos_sin_factura where id in (select id from foto105) order by nombre_referencia;
-- 🏷️ toda categ tocada existe en el plan con tipo (0 filas)
select e.nombre_referencia, e.categ from public.egresos_sin_factura e left join public.cuentas_contables c on c.categ = e.categ
 where e.id in ('2bdfc04c-9ed1-4a55-9e9c-9c5997f65640', '3c7911fd-8cc9-4df7-974f-d8fc3adf8eec') and (c.categ is null or c.tipo is null);

commit;
