-- 144 · El echeq se marca «cobrado» solo, al conciliar su débito — A-AUTO-10 (JMS 30/10: «hacé que el echeq se marque solo
-- al conciliar»). Aviso a Javier en ENTRE-DESARROLLADORES.md antes de correrlo.
--
-- Por qué un TRIGGER y no código: en la app hay ~20 caminos que dejan un movimiento «conciliado» (el motor, las variantes de
-- asignar a mano, el OK masivo, los grupos de pago, scripts). Ponerlo en cada uno es el modo de falla de «se arregló un
-- camino de los dos». En la base lo cubre UNA vez, venga de donde venga.
--
-- Qué hace: cuando un DÉBITO de public.msa_galicia pasa a «conciliado» y su descripción es de cheque («Echeq 48 Hs. Nro. 101»,
-- «Cheque … Nro …»), busca en msa.cheques el cheque «vigente»:
--   1) por NÚMERO (el que trae la descripción) + el mismo importe; si no,
--   2) por IMPORTE, sólo si hay UNO SOLO sin número, con cobro dentro de ±45 días (si hay dos, no adivina).
-- y lo marca «cobrado» con la FECHA DEL DÉBITO; si el cheque no tenía número, le pone el del banco.
-- Las mismas reglas que `lib/conciliacion/cheques-vencidos.ts` (el recorrido del balance). Desconciliar NO lo revierte: que
-- el banco lo debitó sigue siendo cierto.

begin;

create or replace function msa.marcar_echeq_cobrado_al_conciliar() returns trigger
language plpgsql security definer set search_path = msa, public as $$
declare
  nro text;
  cid uuid;
  cuantos int;
begin
  if new.estado is distinct from 'conciliado' then return new; end if;
  if tg_op = 'UPDATE' and old.estado = 'conciliado' then return new; end if;
  if coalesce(new.debitos, 0) <= 0 or coalesce(new.descripcion, '') !~* '(echeq|cheque)' then return new; end if;

  nro := substring(lower(new.descripcion) from 'nro\.?:?\s*0*([0-9]+)');

  if nro is not null then
    select id into cid from msa.cheques
     where estado = 'vigente' and ltrim(coalesce(numero, ''), '0') = nro and abs(monto - new.debitos) < 0.01
     limit 1;
  end if;

  if cid is null then
    select count(*) into cuantos from msa.cheques
     where estado = 'vigente' and coalesce(numero, '') = '' and abs(monto - new.debitos) < 0.01
       and fecha_cobro between new.fecha - 45 and new.fecha + 45;
    if cuantos = 1 then
      select id into cid from msa.cheques
       where estado = 'vigente' and coalesce(numero, '') = '' and abs(monto - new.debitos) < 0.01
         and fecha_cobro between new.fecha - 45 and new.fecha + 45;
    end if;
  end if;

  if cid is not null then
    update msa.cheques
       set estado = 'cobrado', fecha_estado = new.fecha, numero = coalesce(nullif(numero, ''), nro)
     where id = cid;
  end if;
  return new;
end $$;

comment on function msa.marcar_echeq_cobrado_al_conciliar() is
  '[script 144] A-AUTO-10 — al conciliar un débito de cheque en msa_galicia, marca su cheque cobrado con la fecha del débito.';

drop trigger if exists trg_echeq_cobrado_al_conciliar on public.msa_galicia;
create trigger trg_echeq_cobrado_al_conciliar
  after insert or update of estado on public.msa_galicia
  for each row execute function msa.marcar_echeq_cobrado_al_conciliar();

commit;
