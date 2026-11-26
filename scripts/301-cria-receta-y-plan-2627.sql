-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 301 · A-FEAT-1663 — CRÍA: la receta según el dictado de JMS y el PLAN PRODUCTIVO 26/27 (DATOS)
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 25/11: «quisiera que ya dejes terminado todo lo de cría en función de lo que hablamos… si hay que hacer algunas
-- modificaciones, las hacemos» · «se puede cambiar la receta y se puede construir el plan del año».
-- ⚠️ La RECETA la lee también el Margen (misma tabla). Lo que cambia acá lo mueve (JMS lo sabe). El PLAN no lo lee el Margen.
-- La amortización de las pasturas (4 años) NO se toca: es del Margen; la caja la ignora.
-- Deshacer: 301-…-deshacer.sql (vuelve cada renglón a sus valores del 25/11 y borra lo que este script creó).

-- ── RECETA (todos los años) ──
-- C3 Rollos: 1 rollo por vaca por año; cada rollo = 20 litros de gasoil × $ 2.500 = $ 50.000; nov/dic/ene parejo.
update productivo.actividad_insumos set modo = 'monto_cabeza', valor = 50000, moneda = 'ARS', base_cabezas = 'vacas',
  unidad = '$/vaca (1 rollo = 20 l gasoil × $ 2.500)', meses_pct = '{"11": 33.33, "12": 33.33, "1": 33.34}'::jsonb,
  fundamento = '[script 301] JMS 25/11: un rollo por vaca por año; cada rollo cuesta 20 litros de gasoil (~$ 2.500/l); se paga nov/dic/ene.', updated_at = now()
where id = 'bd16dd79-41ca-4d26-9ca1-64651bc70023';
-- C4 Implantación de pasturas: US$ 750/ha (sigue 15 ha de receta; amortiza 4 para el Margen); se paga feb/mar/abr/may.
update productivo.actividad_insumos set meses_pct = '{"2": 25, "3": 25, "4": 25, "5": 25}'::jsonb,
  fundamento = '[script 301] JMS 25/11: US$ 750/ha; se paga feb, mar, abr y may.', updated_at = now()
where id = '793f2419-9999-438e-88a9-53c50e8e7d7d';
-- C5 Mantenimiento de pasturas: sobre las pasturas vigentes = Tosquera 14 + Matera 3 + Martillo 5 + Piquete de los Corrales 6 = 28 ha.
update productivo.actividad_insumos set has_aplicacion = 28,
  fundamento = '[script 301] JMS 25/11: pasturas vigentes Tosquera 14 + Matera 3 + Martillo 5 + Piquete de los Corrales 6 = 28 ha.', updated_at = now()
where id = 'bfeff03c-0490-441f-ab05-f7c341d3dff0';
-- C7 Siembra de verdeos: US$ 350/ha, 17 ha (Tosquera 14 + Matera 3), mar/abr de cada año.
update productivo.actividad_insumos set valor = 350, has_aplicacion = 17, meses_pct = '{"3": 50, "4": 50}'::jsonb,
  fundamento = '[script 301] JMS 25/11: US$ 350/ha; 17 ha (Tosquera 14 + Matera 3); se paga mar y abr de cada año.', updated_at = now()
where id = '91fb4601-7912-41cd-b31e-9298a3c1ce04';
-- C10 Gasoil: 8.000 litros por año en 2 compras de 4.000 (una por semestre: sep y mar) × $ 2.500.
update productivo.actividad_insumos set modo = 'monto_unidad', cantidad_aplicacion = 8000, valor = 2500, moneda = 'ARS', unidad = 'litros',
  meses_pct = '{"9": 50, "3": 50}'::jsonb,
  fundamento = '[script 301] JMS 25/11: 8.000 litros por año, 2 compras de 4.000 (una por semestre); ~$ 2.500/litro.', updated_at = now()
where id = '2df8656c-331a-493e-b67e-487cb32dcec0';
-- C11 Creep feeding: la ración de Cría es el 1 % del peso vivo (85 % maíz / 15 % concentrado ya estaban). Se da en el tramo nov→feb.
update productivo.actividades set racion_pct_pv = 1, updated_at = now() where id = '7dbf0185-5e25-4980-8dc4-0d3941c12fc6';

-- C6 Promoción de rye grass y lotus: queda el renglón, PENDIENTE (no todos los años) → fuera del presupuesto por ahora.
insert into public.presupuesto_marcas (empresa, origen_tabla, fila_id, origen, marca, detalle, marcado_por)
values ('MSA', 'actividad_insumos', 'daa5ac69-3d5b-4ae9-9a3d-2bb7e7df5507', 'RECETA', 'fuera',
  '[script 301] Cría · Promoción de rye grass y lotus — pendiente (no se hace todos los años)', 'Claude (OK de JMS 25/11)')
on conflict (empresa, origen_tabla, fila_id) do nothing;

-- ── PLAN PRODUCTIVO 26/27 (lo de este año; reemplaza a la receta en esa campaña) ──
insert into public.presupuesto_variables (empresa, escenario, campana, concepto, receta_insumo_id, unidad, cantidad, precio, moneda, meses, distribucion, fuente_cantidad, fuente_precio, fundamento, activo)
values
  ('MSA', 'base', '26/27', 'Rollos', 'bd16dd79-41ca-4d26-9ca1-64651bc70023', 'rollos', 170, 50000, 'ARS', '{12}', 'calendario', 'manual', 'manual', '[script 301] JMS 25/11: este año 170 rollos, a pagar en diciembre (ya se hicieron y pagaron otros).', true),
  ('MSA', 'base', '26/27', 'Implantación de pasturas', '793f2419-9999-438e-88a9-53c50e8e7d7d', 'ha', 34, 750, 'USD', '{2,3,4,5}', 'calendario', 'manual', 'manual', '[script 301] JMS 25/11: Casas 15 + Tropilla Parque 14 + Ribera Abajo 5 = 34 ha; feb–may 2027.', true),
  ('MSA', 'base', '26/27', 'Siembra de verdeos', '91fb4601-7912-41cd-b31e-9298a3c1ce04', 'ha', 17, 350, 'USD', '{3,4}', 'calendario', 'manual', 'manual', '[script 301] JMS 25/11: Tosquera 14 + Matera 3 = 17 ha; mar y abr.', true),
  ('MSA', 'base', '26/27', 'Silo de maíz — labor', '0957e99f-a05f-4e3a-877b-50bcf9572a26', 'ha', 15, 200, 'USD', '{3}', 'calendario', 'manual', 'manual', '[script 301] JMS 25/11: labor del silo bolsa, US$ 200/ha × 15 ha (Casas), marzo 2027. La siembra ya está pagada.', true),
  ('MSA', 'base', '26/27', 'Gas Oil', '2df8656c-331a-493e-b67e-487cb32dcec0', 'litros', 4000, 2500, 'ARS', '{3}', 'calendario', 'manual', 'manual', '[script 301] JMS 25/11: próxima compra de 4.000 litros en marzo.', true),
  ('MSA', 'base', '26/27', 'IATF Vacas', '53743bff-b2f1-46c2-9ef4-62f0b916920d', 'vacas', 0, 0, 'USD', null, 'calendario', 'manual', 'manual', '[script 301] JMS 25/11: este año ya se gastó todo (además el renglón está fuera: va por la cuenta 42316).', true);
