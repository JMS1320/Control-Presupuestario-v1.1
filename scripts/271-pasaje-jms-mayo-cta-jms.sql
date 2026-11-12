-- 271 · Control cruzado de socios (11/11). JMS: «para que entre a impactar la cuenta de socios, debe decir cuenta JMS en contable […] y eso sí hay que ponerlo».
-- El «Pasaje JMS ida y vuelta» del 19/05/2026 ($ 261.545, Galicia MSA, template «Otros Gastos» MSA) estaba SIN código: no llegaba a la cuenta con JMS,
-- cuando los pasajes de feb-26 van con CTA JMS (DR5: él los factura). Sólo se pone el código contable; la cuota y el template no se tocan.
-- Foto: 271-foto-antes.json · Deshacer: 271-pasaje-jms-mayo-cta-jms-deshacer.sql
begin;
update public.msa_galicia set contable = 'CTA JMS', nota_operador = concat_ws(' · ', nullif(nota_operador, ''), 'CTA JMS como los pasajes de feb-26 [script 271]')
  where id = '5371c7f0-4db8-4739-b252-c71491770167' and coalesce(contable, '') = '' and debitos = 261545;
do $$ begin if (select count(*) from public.msa_galicia where nota_operador like '%[script 271]' and contable = 'CTA JMS') <> 1 then raise exception '271: no es 1 movimiento'; end if; end $$;
commit;
