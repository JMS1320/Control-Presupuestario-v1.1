-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔒 Script 152 — A-FEAT-1449 tanda 2: la TAREA se cierra SOLA cuando su cuota queda CONCILIADA
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-31 (vista previa respondida): la mora de ARBA «en rojo hasta que la cuota quede pagada y conciliada; ahí
-- también el mail queda terminado solo» · «seguí con la tanda 2».
--
-- Una tarea (public.revisiones) con `cierre_auto = 'cuota_conciliada:<id de la cuota>'` se cierra cuando ESA cuota de
-- public.cuotas_egresos_sin_factura pasa a estado 'conciliado' — por el camino que sea (conciliación, grupo de pago,
-- a mano): por eso va en la base y no en una pantalla (CLAUDE.md § La propagación del dato).
--   · la tarea: estado 'resuelta' (también si estaba 'por_confirmar': el pago conciliado ES la prueba), la resolución
--     dice que se cerró sola y cuándo, resuelto_por 'app (cierre automático)'.
--   · si la tarea salió de un MAIL (tabla_ref 'mails_registro'), el mail queda «terminado» con la misma nota.
-- Sólo 'conciliado' cierra: 'pagado' (pagado sin conciliar) NO — JMS: «pagada y conciliada».
--
-- Escribe: 1 función + 1 trigger (FRENA si ya existen). No toca datos existentes (no hay tareas con cierre_auto todavía).
-- Deshacer: 152-cierre-automatico-por-cuota-deshacer.sql (lo que ya se cerró solo queda cerrado: se reabre a mano).
-- Aviso a Javier: ENTRE-DESARROLLADORES.md, antes de correrlo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;
do $$
begin
  if exists (select 1 from pg_proc where proname = 'revisiones_cierre_por_cuota' and pronamespace = 'public'::regnamespace) then
    raise exception 'public.revisiones_cierre_por_cuota YA EXISTE: no se corre nada.';
  end if;
end $$;

create function public.revisiones_cierre_por_cuota() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  nota text := 'Se cerró sola: la cuota quedó conciliada (' || to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY') || ')';
begin
  -- [script 152] A-FEAT-1449
  if new.estado = 'conciliado' and old.estado is distinct from 'conciliado' then
    with cerradas as (
      update public.revisiones
         set estado = 'resuelta',
             resolucion = case when coalesce(resolucion, '') = '' then nota else resolucion || ' · ' || nota end,
             resuelto_por = 'app (cierre automático)',
             resuelto_at = now()
       where cierre_auto = 'cuota_conciliada:' || new.id::text
         and estado in ('abierta', 'por_confirmar')
      returning tabla_ref, registro_id
    )
    update public.mails_registro m
       set seguimiento = 'terminado', seguimiento_at = now(), updated_at = now(),
           seguimiento_nota = case when coalesce(m.seguimiento_nota, '') = '' then nota else m.seguimiento_nota || ' · ' || nota end
     where m.id::text in (select registro_id from cerradas where tabla_ref = 'mails_registro')
       and m.seguimiento is distinct from 'terminado';
  end if;
  return new;
end $$;
comment on function public.revisiones_cierre_por_cuota() is '[script 152] A-FEAT-1449 — cierra las tareas con cierre_auto = cuota_conciliada:<id> cuando la cuota pasa a conciliado.';

create trigger trg_revisiones_cierre_por_cuota
  after update of estado on public.cuotas_egresos_sin_factura
  for each row execute function public.revisiones_cierre_por_cuota();

commit;

-- Control (sólo lee): el trigger existe y está activo
select tgname, tgenabled from pg_trigger where tgname = 'trg_revisiones_cierre_por_cuota';
