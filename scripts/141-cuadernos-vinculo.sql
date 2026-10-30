-- 141 · Columna `vinculo` en public.cuadernos — A-FEAT-1430 paso 3 (2026-10-30). OK de JMS («2 ok»); aviso a Javier en
-- ENTRE-DESARROLLADORES.md antes de correrlo.
--
-- Para qué: un PAPEL DE TRABAJO (un cuaderno que arma el sistema con los dos lados de una inconsistencia, A contra B)
-- queda atado al tema del balance que explica — JMS: «notas en Excel o Word guardadas linkeadas con algo… no impacta
-- la base, son notas aisladas pero vinculadas como papel de trabajo». El vínculo es un texto, p. ej.
-- `balance:MSA:2026:cob:cuentas-pagar-05-provision-provision-del-ejercicio-anterior`. Vacío = cuaderno suelto (todos los de hoy).
--
-- No toca RLS (sigue siendo personal por usuario) ni ningún dato: agrega una columna vacía y un índice.
-- 🛡️ Si la columna ya existiera, NO se corre (así el deshacer, que la borra, sólo puede borrar la que creó este script).

begin;

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cuadernos' and column_name = 'vinculo') then
    raise exception 'public.cuadernos.vinculo YA EXISTE: no se corre. Avisar antes de seguir.';
  end if;
end $$;

alter table public.cuadernos add column vinculo text;
comment on column public.cuadernos.vinculo is
  '[script 141] A-FEAT-1430 — a qué está atado este cuaderno como papel de trabajo (p. ej. balance:MSA:2026:cob:…). Vacío = suelto.';
create index cuadernos_vinculo on public.cuadernos (usuario_id, vinculo) where vinculo is not null;

commit;
notify pgrst, 'reload schema';
