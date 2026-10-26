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
--   E. (usuario 26/10: «sí, creá esas cuentas») Cuentas nuevas en el plan: AGUA 422138 · EXPENSAS 422139 · ABL 422140
--      (egreso, imputables, bajo 4221 ADMINISTRACION Y ESTRUCTURA). Y los Libertad 2025 y 2026 pasan a su cuenta:
--      AYSA → AGUA · Expensas → EXPENSAS · ABL Cuota y Anual → ABL · Metrogas 2025 → GAS (el 2026 ya lo hace D).
--      También las reglas de la caja de ahorro de MA que copian esa cuenta (AYSA → AGUA, ABL → ABL): el motor usa la
--      cuenta de la REGLA. Los movimientos YA conciliados quedan con la cuenta vieja (cambiar el template no la propaga).
--
-- NO TOCA: el código interno DIST MA que siguen teniendo los Libertad 2026 (el motor no
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
  ('8d52aacd-885f-435b-b811-9882fb0f6d25', 'responsable', 'PAM'),
  -- E
  ('a3e4d09b-7853-49fa-9cf7-5e0704ea3657', 'categ', 'Fijos Libertad'),     -- AYSA 2025
  ('11921930-21d4-4867-9b6f-c01de2247ad4', 'categ', 'Fijos Libertad'),     -- AYSA 2026
  ('68d7b742-962e-456b-8b76-2e235924b61a', 'categ', 'Expensas Libertad'),  -- Expensas 2025
  ('6563c6a5-9a45-4051-8080-7ff51baa7993', 'categ', 'Expensas Libertad'),  -- Expensas 2026
  ('de27c254-f8d2-45ad-a689-d33041a2c087', 'categ', 'ABL Libertad'),       -- ABL Cuota 2025
  ('c0acd49c-9b7f-44fb-9459-4839a7b800d6', 'categ', 'ABL Libertad'),       -- ABL Cuota 2026
  ('8d52aacd-885f-435b-b811-9882fb0f6d25', 'categ', 'ABL Libertad'),       -- ABL Anual 2026
  ('0ce79816-1f56-401a-ba72-fa81ef104c8c', 'categ', 'Fijos Libertad');     -- Metrogas 2025

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
  if (select categ from public.reglas_conciliacion where id = '7a0278c6-6dd0-47bb-bbf9-e04bbf79f087') is distinct from 'Fijos Libertad'
     or (select categ from public.reglas_conciliacion where id = 'fd2ef546-829f-4436-bb51-b4a016cb5c18') is distinct from 'ABL Libertad' then
    raise exception 'Las reglas de AYSA o ABL de la caja de MA cambiaron desde la foto: revisar.';
  end if;
  -- E · las cuentas nuevas NO existen todavía (si existen, el deshacer no podría saber que son nuestras)
  if exists (select 1 from public.cuentas_contables where nro_cuenta in ('422138', '422139', '422140') or upper(categ) in ('AGUA', 'EXPENSAS', 'ABL')) then
    raise exception 'Ya hay una cuenta AGUA / EXPENSAS / ABL o un número 422138-40 en el plan: revisar antes de correr el bloque E.';
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

-- E · cuentas nuevas en el plan + Libertad a su cuenta + reglas de la caja de MA
insert into public.cuentas_contables (categ, cuenta_contable, tipo, activo, nro_cuenta, imputable, cta_totalizadora, nombre_totalizadora) values
  ('AGUA', 'AGUA', 'egreso', true, '422138', true, '4221', 'ADMINISTRACION Y ESTRUCTURA'),
  ('EXPENSAS', 'EXPENSAS', 'egreso', true, '422139', true, '4221', 'ADMINISTRACION Y ESTRUCTURA'),
  ('ABL', 'ABL', 'egreso', true, '422140', true, '4221', 'ADMINISTRACION Y ESTRUCTURA');
update public.egresos_sin_factura set categ = 'AGUA' where id in ('a3e4d09b-7853-49fa-9cf7-5e0704ea3657', '11921930-21d4-4867-9b6f-c01de2247ad4');
update public.egresos_sin_factura set categ = 'EXPENSAS' where id in ('68d7b742-962e-456b-8b76-2e235924b61a', '6563c6a5-9a45-4051-8080-7ff51baa7993');
update public.egresos_sin_factura set categ = 'ABL'
 where id in ('de27c254-f8d2-45ad-a689-d33041a2c087', 'c0acd49c-9b7f-44fb-9459-4839a7b800d6', '8d52aacd-885f-435b-b811-9882fb0f6d25');
update public.egresos_sin_factura set categ = 'GAS' where id = '0ce79816-1f56-401a-ba72-fa81ef104c8c';
update public.reglas_conciliacion set categ = 'AGUA' where id = '7a0278c6-6dd0-47bb-bbf9-e04bbf79f087';   -- AYSA, caja de ahorro MA
update public.reglas_conciliacion set categ = 'ABL' where id = 'fd2ef546-829f-4436-bb51-b4a016cb5c18';    -- ABL, caja de ahorro MA

-- Control: lo que quedó (se ve antes del commit)
select nombre_referencia, responsable, año, categ, centro_costo, proveedor, template_origen_id is not null as enganchado
  from public.egresos_sin_factura where id in (select id from foto105) order by nombre_referencia;
-- 🏷️ toda categ tocada existe en el plan con tipo (0 filas)
select e.nombre_referencia, e.categ from public.egresos_sin_factura e left join public.cuentas_contables c on c.categ = e.categ
 where e.id in (select id from foto105) and (c.categ is null or c.tipo is null);

commit;
