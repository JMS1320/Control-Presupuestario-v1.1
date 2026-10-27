-- =====================================================================================
-- 114 · DESHACER — cobro agrupado (A-FEAT-167)
-- =====================================================================================
-- Borra la columna `grupo_cobro_id` de `{msa,pam,ma}.comprobantes_venta` y las tablas `{msa,pam,ma}.grupos_cobro`.
-- Se puede porque el script 114 las CREÓ (verificado el 27/10: no existían antes). Sólo actúa sobre lo que
-- lleva la marca «[script 114]» en su comentario.
-- ⚠️ Si ya hay grupos cargados (el 115 de Sáenz u otros desde la app), se pierden: correr antes el deshacer
-- del 115, y si quedan grupos de la app, el script se frena.
-- =====================================================================================
begin;

do $$
declare s text; n int;
begin
  foreach s in array array['msa','pam','ma'] loop
    if to_regclass(format('%I.grupos_cobro', s)) is null then continue; end if;
    if coalesce(obj_description(to_regclass(format('%I.grupos_cobro', s)), 'pg_class'), '') not like '[script 114]%' then
      raise exception '114 deshacer: %.grupos_cobro no tiene la marca del script 114 — no se toca', s;
    end if;
    execute format('select count(*) from %I.grupos_cobro', s) into n;
    if n > 0 then raise exception '114 deshacer: %.grupos_cobro tiene % grupo(s) — correr antes el deshacer del 115 / desagrupar', s, n; end if;
    execute format('alter table %I.comprobantes_venta drop column if exists grupo_cobro_id', s);
    execute format('drop table %I.grupos_cobro', s);
  end loop;
end $$;

commit;
