-- Deshace el 255: vuelve el CHECK original. Sólo si ninguna cuota quedó en 'nada_a_pagar' (si hay, primero deshacer el 256).
begin;
do $$ begin if exists (select 1 from public.cuotas_egresos_sin_factura where estado = 'nada_a_pagar') then raise exception 'hay cuotas en nada_a_pagar: deshacer primero el 256'; end if; end $$;
alter table public.cuotas_egresos_sin_factura drop constraint cuotas_egresos_sin_factura_estado_check;
alter table public.cuotas_egresos_sin_factura add constraint cuotas_egresos_sin_factura_estado_check check (estado::text = any (array[
  'pendiente', 'debito', 'pagar', 'preparado', 'pagado', 'credito', 'conciliado', 'desactivado', 'anterior', 'programado']::text[]));
commit;
