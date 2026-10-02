-- 🔙 DESHACER 72 — saca 'en_cartera' del CHECK y la columna endosado_en_id.
-- ⚠️ Con freno: si ya hay cheques en cartera o endosos registrados, NO se deshace (se perderían).

do $$
declare n int; m int;
begin
  select count(*) into n from public.anticipos_proveedores where estado_pago = 'en_cartera';
  select count(*) into m from public.anticipos_proveedores where endosado_en_id is not null;
  if n > 0 or m > 0 then
    raise exception 'Hay % cheques en cartera y % endosos registrados: deshacer los perdería. No se toca nada.', n, m;
  end if;
end $$;

begin;
alter table public.anticipos_proveedores drop column if exists endosado_en_id;
alter table public.anticipos_proveedores drop constraint anticipos_proveedores_estado_pago_check;
alter table public.anticipos_proveedores add constraint anticipos_proveedores_estado_pago_check
  check (estado_pago::text = any (array['pendiente','pagar','preparado','programado','pagado','echeq','conciliado','endosado']::text[]));
commit;

notify pgrst, 'reload schema';
