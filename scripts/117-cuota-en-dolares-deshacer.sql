-- =====================================================================================
-- 117 · DESHACER — `public.cuotas_arrendamiento.en_dolares` (A-FEAT-1393)
-- =====================================================================================
-- La columna la CREÓ el script 117 (verificado el 27/10: no existía), así que borrarla no pierde nada
-- previo. Sólo actúa si la columna tiene la marca «[script 117]» en su comentario.
-- ⚠️ Si después se marcaron más cuotas desde la app, esa marca se pierde con la columna.
-- =====================================================================================
begin;

do $$
begin
  if coalesce(col_description('public.cuotas_arrendamiento'::regclass,
       (select attnum from pg_attribute where attrelid = 'public.cuotas_arrendamiento'::regclass and attname = 'en_dolares')), '')
     not like '[script 117]%'
  then raise exception '117 deshacer: la columna en_dolares no tiene la marca del script 117 — no se toca'; end if;
end $$;

alter table public.cuotas_arrendamiento drop column en_dolares;

commit;
