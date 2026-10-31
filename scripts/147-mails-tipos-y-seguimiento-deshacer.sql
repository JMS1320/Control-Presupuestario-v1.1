-- Deshace 147 · vuelve las tablas de mails a como las dejaron el 140 y el 142.
-- Todo lo que borra lo creó el 147 (el 147 frena si la tabla o alguna columna ya existía):
--   · el trigger y su función · las 4 columnas de seguimiento (con lo que se haya marcado) · las 3 FK y la tabla de tipos.
-- ⚠️ Si desde la app se crearon tipos nuevos y hay mails o reglas que los usan, el CHECK original no entra: el deshacer
--   FRENA y lo dice. Hay que pasar esos mails/reglas a uno de los 12 antes de deshacer.
begin;

do $$
declare n int;
begin
  select count(*) into n from (
    select tipo t from public.mails_reglas union all select tipo from public.mails_registro union all select tipo_manual from public.mails_registro
  ) x where t is not null and t not in ('factura','banco','impuestos','contador','productivo','legal','interno',
                                        'servicios','seguros','notificacion','propaganda','otro');
  if n > 0 then raise exception '% filas usan un tipo creado después del 147: pasarlas a uno de los 12 antes de deshacer.', n; end if;
end $$;

drop trigger mails_registro_seguimiento_inicial on public.mails_registro;
drop function public.mails_registro_seguimiento_inicial();
drop index public.mails_registro_pendientes;
alter table public.mails_registro drop column seguimiento, drop column seguimiento_nota, drop column seguimiento_fecha, drop column seguimiento_at;

alter table public.mails_registro drop constraint mails_registro_tipo_fk, drop constraint mails_registro_tipo_manual_fk;
alter table public.mails_reglas drop constraint mails_reglas_tipo_fk;
alter table public.mails_reglas add constraint mails_reglas_tipo_check check (tipo in ('factura','banco','impuestos','contador','productivo',
  'legal','interno','servicios','seguros','notificacion','propaganda','otro'));

delete from public.recurso_tablas where schema_nombre = 'public' and tabla = 'mails_tipos' and motivo like '[script 147]%';
drop table public.mails_tipos;

commit;
notify pgrst, 'reload schema';
