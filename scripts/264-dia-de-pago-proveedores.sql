-- [script 264] A-FEAT-1605 (JMS 11/11): el día de pago usual de cada proveedor.
--   pago_dia_mes      = se paga el día N del mes (1–31): la fecha estimada es el próximo día N desde la emisión
--                       (si se emite ese mismo día, ese día); sábado, domingo o feriado → el hábil siguiente.
--   pago_dias_emision = se paga a N días de la emisión (ej. 30).
--   Las dos vacías = como hoy (emisión + 15). Si están las dos, manda el día del mes.
-- Antes de correr se verificó que las dos columnas NO existían (así el deshacer puede borrarlas).
alter table public.proveedores add column pago_dia_mes integer check (pago_dia_mes between 1 and 31);
alter table public.proveedores add column pago_dias_emision integer check (pago_dias_emision between 0 and 365);
comment on column public.proveedores.pago_dia_mes is 'A-FEAT-1605: día del mes en que se le paga (fecha estimada de sus facturas). Vacío = emisión + 15 [script 264]';
comment on column public.proveedores.pago_dias_emision is 'A-FEAT-1605: a cuántos días de la emisión se le paga. Vacío = emisión + 15 [script 264]';
-- Carga inicial con OK de JMS 11/11 («los del 10 están perfectos salvo Smart Farming, que es por débito»)
update public.proveedores set pago_dia_mes = 10 where id in (
  '2408390f-2d0f-4d86-86da-82b35a62cd5b',  -- ALCORTA EDMUNDO ERNESTO
  '838cf743-62e4-4a37-987f-2191679c8635',  -- I.C.T. NET S.A.
  '519ce644-ee90-4e79-8c43-a5fd0d93a9ec',  -- MICELI LUCIANA YANINA
  '3b07d4b8-f8c6-4d65-8967-0d2d9a169920',  -- MASSAGLIA ALDO ENRIQUE
  'f7d1adb0-3049-41a6-99f1-9f66e095b9d9'   -- COOP. AGUA RÍO TALA
);
