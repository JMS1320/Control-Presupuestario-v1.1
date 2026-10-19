-- 84 · DESHACER — Cobros y retenciones recibidas para PAM y MA (A-FEAT-1219 · A-FEAT-24)
--
-- ⚠️ Frena si ya hay datos: certificados cargados en PAM/MA o créditos vinculados a una factura.
-- Borrarlos sería perder trabajo del usuario; primero se decide qué hacer con ellos.

begin;

do $$
declare n int;
begin
  select (select count(*) from pam.retenciones_recibidas) + (select count(*) from ma.retenciones_recibidas)
       + (select count(*) from public.pam_galicia    where comprobante_venta_id is not null)
       + (select count(*) from public.pam_galicia_cc where comprobante_venta_id is not null)
       + (select count(*) from ma.ma_galicia         where comprobante_venta_id is not null)
    into n;
  if n > 0 then
    raise exception 'Hay % filas con datos (certificados o cobros vinculados) en PAM/MA: no se deshace', n;
  end if;
end $$;

alter table public.pam_galicia    drop column if exists comprobante_venta_id;
alter table public.pam_galicia_cc drop column if exists comprobante_venta_id;
alter table ma.ma_galicia         drop column if exists comprobante_venta_id;

delete from public.recurso_tablas where schema_nombre in ('pam', 'ma') and tabla = 'retenciones_recibidas';
drop table if exists pam.retenciones_recibidas;
drop table if exists ma.retenciones_recibidas;

commit;
notify pgrst, 'reload schema';
