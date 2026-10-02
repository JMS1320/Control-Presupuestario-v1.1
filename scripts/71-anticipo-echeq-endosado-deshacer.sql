-- 🔙 DESHACER 71 — vuelve el CHECK de `estado_pago` a los 7 valores de antes.
-- ⚠️ Con freno: si ya hay anticipos 'endosado', NO se deshace (el CHECK nuevo los rechazaría y
-- habría que cambiarles el estado a algo falso — § 🛑 Datos: nada destructivo).

do $$
declare n int;
begin
  select count(*) into n from public.anticipos_proveedores where estado_pago = 'endosado';
  if n > 0 then
    raise exception 'Hay % anticipos endosados: deshacer los dejaría fuera del CHECK. No se toca nada.', n;
  end if;
end $$;

begin;
alter table public.anticipos_proveedores drop constraint anticipos_proveedores_estado_pago_check;
alter table public.anticipos_proveedores add constraint anticipos_proveedores_estado_pago_check
  check (estado_pago::text = any (array['pendiente','pagar','preparado','programado','pagado','echeq','conciliado']::text[]));
commit;

notify pgrst, 'reload schema';
