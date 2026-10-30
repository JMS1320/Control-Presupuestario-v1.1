-- Deshacer del 144: saca el trigger y su función. Los cheques que ya marcó «cobrado» quedan así (eso es un hecho del banco,
-- no algo que inventó el script); si hiciera falta volver uno, es a mano y con su motivo.
begin;
drop trigger if exists trg_echeq_cobrado_al_conciliar on public.msa_galicia;
drop function if exists msa.marcar_echeq_cobrado_al_conciliar();
commit;
