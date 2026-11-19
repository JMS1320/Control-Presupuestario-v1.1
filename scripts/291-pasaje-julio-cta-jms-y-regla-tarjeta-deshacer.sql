-- DESHACER del 291 · el pasaje del 15/07/2026 vuelve a contable vacío y se sacan las 2 reglas de la VISA de MSA que creó el 291.
-- Sólo toca lo que el 291 cambió (por id) y sólo borra las reglas marcadas [script 291].

begin;

update public.msa_galicia
set contable = ''
where id = 'b1e4e0f9-10cc-4e3d-9bcf-4d3e8014a52f' and contable = 'CTA JMS';

delete from public.reglas_contable_interno
where id in ('2fb75173-2063-4864-b57e-304332fb8913', '9b9e3561-0756-4db4-be43-5950cc4e5734')
  and descripcion like '[script 291]%';

commit;
