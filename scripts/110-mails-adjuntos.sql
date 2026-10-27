-- 110 · EL MAIL DEL SUBDIARIO AL CONTADOR — dos columnas nuevas en public.mails_pago — A-AUTO-09 (2026-10-27)
--
-- Usuario 2026-10-27: «hacé por favor lo del mail del contador. El mail es bnoltfuentes@gmail.com y el asunto del mail
-- para envío deberá ser Subdiario Mes Año».
--
-- La cola de mails (`mails_pago`) sólo sabía llevar el PDF del detalle de pago y el certificado. El mail del subdiario
-- lleva el PDF y el Excel del mes con su nombre real:
--   · `tipo`     text  — 'pago' (todo lo de hoy, por default) o 'subdiario'.
--   · `adjuntos` jsonb — [{nombre, mime, base64}]; el GAS los adjunta tal cual (EnviarMailsDetalle.gs, 27/10).
-- No modifica ninguna fila (las existentes quedan tipo 'pago', adjuntos null). Sin cambios de RLS.
-- 🛑 Antes de correr: aviso a Javier (ENTRE-DESARROLLADORES.md) y OK del usuario.
-- Deshacer: 110-mails-adjuntos-deshacer.sql
-- ⚠️ Renumerado 27/10 de 109 → 110 (chocó con scripts/109-ordenes-a-confirmar.sql de plan sanitario, que llegó antes).
--    En la base viva los comentarios quedaron «[script 109] A-AUTO-09…» porque se corrió antes de renumerar.

begin;
alter table public.mails_pago add column if not exists tipo text not null default 'pago';
alter table public.mails_pago add column if not exists adjuntos jsonb;
comment on column public.mails_pago.tipo is '[script 110] A-AUTO-09 — pago (detalle de pago) o subdiario (mail del subdiario al contador).';
comment on column public.mails_pago.adjuntos is '[script 110] A-AUTO-09 — adjuntos genéricos [{nombre, mime, base64}].';
commit;
notify pgrst, 'reload schema';

-- Control (sólo lee)
select count(*) filter (where tipo = 'pago') as pagos, count(*) filter (where adjuntos is not null) as con_adjuntos from public.mails_pago;
