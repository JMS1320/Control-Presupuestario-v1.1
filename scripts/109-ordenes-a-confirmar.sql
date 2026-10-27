-- 109 · «SE HIZO» (delegado) y «CONFIRMAR» (dueño) en las órdenes — A-FEAT-1223 (2026-10-27)
--
-- JMS 2026-10-27: «sería interesante que el confirmar de él no sea el mismo que el mío… dos botones… hasta que no
-- acepto yo no impacta nada» → «sí a las dos». Y si rechaza, vuelve a planificada con el recuento guardado.
--
-- QUÉ HACE (estructura, no toca filas):
--   · productivo.ordenes_aplicacion y productivo.ordenes_agricolas:
--       - el check de `estado` acepta un valor más: 'a_confirmar' (se hizo en el campo, falta el OK que impacta);
--       - columnas nuevas, todas nullable: marcada_por, marcada_at (quién dijo «se hizo»), confirmada_por,
--         confirmada_at (quién confirmó: recién ahí se descuenta stock), motivo_rechazo.
--   · Las vistas/consultas que miran 'ejecutada' (balance, sementeras) no cambian: una orden 'a_confirmar' NO es
--     costo ni descuenta stock — justamente lo que pidió JMS.
--
-- VERIFICADO EN LA BASE antes de escribirlo (27/10): el check actual es exactamente
-- ('planificada','ejecutada','eliminada') en las dos tablas, y ninguna de las 5 columnas existe.
-- 🛑 Antes de correr: aviso a Javier en ENTRE-DESARROLLADORES.md y OK de JMS. Deshacer: 109-…-deshacer.sql

begin;

do $$
declare t text; c text;
begin
  foreach t in array array['ordenes_aplicacion','ordenes_agricolas'] loop
    foreach c in array array['marcada_por','marcada_at','confirmada_por','confirmada_at','motivo_rechazo'] loop
      if exists (select 1 from information_schema.columns where table_schema = 'productivo' and table_name = t and column_name = c) then
        raise exception 'productivo.%.% YA EXISTE: no se corre el 109. Avisar antes de seguir.', t, c;
      end if;
    end loop;
  end loop;
end $$;

alter table productivo.ordenes_aplicacion drop constraint if exists ordenes_aplicacion_estado_check;
alter table productivo.ordenes_aplicacion add constraint ordenes_aplicacion_estado_check
  check (estado in ('planificada', 'a_confirmar', 'ejecutada', 'eliminada'));
alter table productivo.ordenes_aplicacion
  add column marcada_por text, add column marcada_at timestamptz,
  add column confirmada_por text, add column confirmada_at timestamptz,
  add column motivo_rechazo text;
comment on column productivo.ordenes_aplicacion.marcada_por is '[script 109] A-FEAT-1223 — quién marcó «se hizo» (queda a_confirmar si no puede confirmar).';

alter table productivo.ordenes_agricolas drop constraint if exists ordenes_agricolas_estado_check;
alter table productivo.ordenes_agricolas add constraint ordenes_agricolas_estado_check
  check (estado in ('planificada', 'a_confirmar', 'ejecutada', 'eliminada'));
alter table productivo.ordenes_agricolas
  add column marcada_por text, add column marcada_at timestamptz,
  add column confirmada_por text, add column confirmada_at timestamptz,
  add column motivo_rechazo text;
comment on column productivo.ordenes_agricolas.marcada_por is '[script 109] A-FEAT-1223 — quién marcó «se hizo» (queda a_confirmar si no puede confirmar).';

commit;
notify pgrst, 'reload schema';

-- ── Control (sólo lee) ──────────────────────────────────────────────────────────────────────
select (select count(*) from information_schema.columns where table_schema = 'productivo'
          and table_name in ('ordenes_aplicacion','ordenes_agricolas')
          and column_name in ('marcada_por','marcada_at','confirmada_por','confirmada_at','motivo_rechazo')) as columnas, -- 10
       (select count(*) from pg_constraint where conname in ('ordenes_aplicacion_estado_check','ordenes_agricolas_estado_check')
          and pg_get_constraintdef(oid) like '%a_confirmar%') as checks; -- 2
