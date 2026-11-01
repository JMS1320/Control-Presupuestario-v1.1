-- 164 · QUÉ ECHEQ PAGÓ CADA MOVIMIENTO (ESTRUCTURA) — A-FEAT-1476 punto (b) / A-DEC-17 — OK de JMS 01/11 («6) ok»).
--
-- Qué hace: agrega `cheque_id uuid` (→ msa.cheques, al borrar el cheque queda null) a las 3 cuentas bancarias de MSA por donde
-- se debitan los echeqs: public.msa_galicia, msa.santander, msa.provincia. Vacía. No toca datos. Sin cambios de RLS ni permisos.
-- Por qué: el movimiento guardaba la factura o el anticipo pero NO el echeq: si una factura se paga con 3 echeqs, no quedaba
-- cuál débito es cuál. El motor la llena al conciliar un débito contra su echeq.
-- Marca: comentario '[script 164]'. Deshacer: 164-…-deshacer.sql (sólo si siguen vacías).

alter table public.msa_galicia add column if not exists cheque_id uuid references msa.cheques(id) on delete set null;
alter table msa.santander add column if not exists cheque_id uuid references msa.cheques(id) on delete set null;
alter table msa.provincia add column if not exists cheque_id uuid references msa.cheques(id) on delete set null;
comment on column public.msa_galicia.cheque_id is '[script 164] El echeq que pagó este débito (A-FEAT-1476).';
comment on column msa.santander.cheque_id is '[script 164] El echeq que pagó este débito (A-FEAT-1476).';
comment on column msa.provincia.cheque_id is '[script 164] El echeq que pagó este débito (A-FEAT-1476).';
