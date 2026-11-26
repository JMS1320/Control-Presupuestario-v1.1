-- 302 · A-FEAT-1663 — IVA de cada renglón de la RECETA y del PLAN DEL AÑO (ESTRUCTURA + valores iniciales)
-- JMS 25/11: «cuando te digo 750 US$ por ha es a agregarle el IVA aparte… vos lo podés poner como sepas y yo edito si pone mal.
-- agroquímicos 21 %, fertilizante 10,5 %, maíz 10,5 %, concentrado; casi todo va al 21 %; labores 10,5 %».
-- La CAJA (presupuesto) suma el IVA; el MARGEN no lo lee (el IVA no es costo: es crédito fiscal). NULL = sin IVA.
-- Las cuentas contables NO llevan esto: su historia ya sale del total de la factura (con IVA).
-- Deshacer: 302-…-deshacer.sql (las dos columnas no existían antes: se verificó en information_schema).
alter table productivo.actividad_insumos add column if not exists iva_pct numeric;
alter table public.presupuesto_variables add column if not exists iva_pct numeric;
comment on column productivo.actividad_insumos.iva_pct is '[script 302] IVA % que se suma en la caja del presupuesto (no en el Margen). NULL = sin IVA.';
comment on column public.presupuesto_variables.iva_pct is '[script 302] IVA % del renglón del plan del año. NULL = sin IVA.';

-- Valores iniciales (JMS los edita): labores y granos 10,5 %; agroquímicos, combustible, sanidad y el resto 21 %.
update productivo.actividad_insumos i set iva_pct = v.iva from (values
  ('bd16dd79-41ca-4d26-9ca1-64651bc70023'::uuid, 10.5),  -- Rollos (labor de confección)
  ('793f2419-9999-438e-88a9-53c50e8e7d7d', 21),          -- Implantación de pasturas (semilla forrajera + agroquímicos)
  ('bfeff03c-0490-441f-ab05-f7c341d3dff0', 21),          -- Mantenimiento de pasturas
  ('daa5ac69-3d5b-4ae9-9a3d-2bb7e7df5507', 21),          -- Promoción rye grass y lotus
  ('91fb4601-7912-41cd-b31e-9298a3c1ce04', 10.5),        -- Siembra de verdeos (labor + semilla de verdeo)
  ('78561db6-6b38-4da8-af66-81cb53aee655', 21),          -- Mantenimiento de verdeos
  ('0957e99f-a05f-4e3a-877b-50bcf9572a26', 10.5),        -- Silo de maíz (labor)
  ('2df8656c-331a-493e-b67e-487cb32dcec0', 21),          -- Gas Oil
  ('102c1363-47e0-4c59-a360-3034806aa538', 10.5),        -- Maíz creep feeding
  ('34c05560-6bac-4df4-b7c3-9f89ca57a9c1', 10.5),        -- Concentrado creep feeding
  ('cf3958e9-cce5-4018-809e-3e32da81ad6f', 21), ('53743bff-b2f1-46c2-9ef4-62f0b916920d', 21),
  ('6e1ad444-7913-4b36-9867-7daadd0d9d61', 21), ('d3ee7fba-59bb-47c6-9ac9-fd53d63d5903', 21),   -- Sanidad / IATF
  ('d44f987b-9862-4596-a7ef-e896305ea24b', 10.5), ('3dfaad83-17e9-4336-896d-6134a1ced07f', 10.5), -- Engorde maíz / concentrado
  ('c93eb0d0-e88b-4e24-9c12-25f7eb438a05', 10.5), ('cf06a833-6b59-4241-8bba-761be5411542', 10.5)  -- Recría maíz / concentrado
) as v(id, iva) where i.id = v.id and i.iva_pct is null;
update public.presupuesto_variables p set iva_pct = case
  when receta_insumo_id in ('bd16dd79-41ca-4d26-9ca1-64651bc70023','91fb4601-7912-41cd-b31e-9298a3c1ce04','0957e99f-a05f-4e3a-877b-50bcf9572a26') then 10.5
  else 21 end
where fundamento like '[script 301]%' and iva_pct is null;
