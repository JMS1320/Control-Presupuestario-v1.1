-- Script 213 (A-FEAT-1570, 06/11 — OK de JMS: «agregá la marca de tarjeta»).
-- 💳 Un template marcado «se paga con tarjeta» hace que sus cuotas NUEVAS nazcan en estado «credito» (A-DEC-1002: pagado con
-- tarjeta → el Cash Flow no lo cuenta como salida de banco y se concilia contra el resumen de la tarjeta). Va en la base y no
-- en el código porque las cuotas se crean desde 14 lugares (generador de campaña, wizard, Cash Flow, editor, pólizas…).
-- Deshacer: scripts/213-template-se-paga-con-tarjeta-deshacer.sql (sólo lo que crea este script: la columna no existía).

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'egresos_sin_factura' and column_name = 'se_paga_con_tarjeta')
    then raise exception 'la columna se_paga_con_tarjeta YA EXISTE: no se corre (el deshacer la borraría)'; end if;
  if to_regproc('public.cuota_nace_en_credito') is not null then raise exception 'la función cuota_nace_en_credito YA EXISTE'; end if;
end $$;

alter table public.egresos_sin_factura add column se_paga_con_tarjeta boolean not null default false;
comment on column public.egresos_sin_factura.se_paga_con_tarjeta is
  '[script 213] El gasto se paga con tarjeta: sus cuotas nuevas nacen en estado credito (trigger cuota_nace_en_credito).';

create function public.cuota_nace_en_credito() returns trigger language plpgsql as $$
begin
  if (new.estado is null or new.estado = 'pendiente')
     and exists (select 1 from public.egresos_sin_factura e where e.id = new.egreso_id and e.se_paga_con_tarjeta) then
    new.estado := 'credito';
  end if;
  return new;
end $$;

create trigger cuota_nace_en_credito before insert on public.cuotas_egresos_sin_factura
  for each row execute function public.cuota_nace_en_credito();

-- La marca en los 2 templates 2026 que se pagan con tarjeta (sus cuotas pendientes ya pasaron a crédito con el script 212)
update public.egresos_sin_factura set se_paga_con_tarjeta = true
 where activo and año = '2026' and ((nombre_referencia = 'ACA' and responsable = 'PAM') or (nombre_referencia = 'Internet NZ' and responsable = 'MA'));
