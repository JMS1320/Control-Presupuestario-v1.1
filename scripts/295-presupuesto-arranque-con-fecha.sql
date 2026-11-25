-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 295 · A-FEAT-1660 — el arranque del presupuesto lleva FECHA y la COMPOSICIÓN del saldo
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 25/11: «siempre sería arranque con fecha… dos posibilidades» (la que declara él o la del último
-- saldo conciliado del extracto) · sobre el FCI: el saldo es cuenta corriente + FCI (+ otros), y se ve
-- de qué se compone.
--   · fecha_arranque     — el día del saldo declarado (en el modo «extracto» la fecha sale del banco).
--   · composicion_saldo  — [{ "cuenta": "Cuenta corriente Galicia", "monto": 123.45 }, …]; la suma es el
--                          saldo de arranque. NULL = sólo el número (como hasta hoy).
-- Columnas nuevas y vacías: no cambian nada de lo que ya existe. Deshacer: 295-…-deshacer.sql
-- (borra sólo estas dos columnas, que este script crea; verificado antes que no existían).
-- ════════════════════════════════════════════════════════════════════════════════════════════
alter table public.presupuesto_config add column fecha_arranque date;
alter table public.presupuesto_config add column composicion_saldo jsonb;
comment on column public.presupuesto_config.fecha_arranque is 'A-FEAT-1660: día del saldo declarado a mano (modo manual). En modo ultimo_conciliado manda la fecha del extracto.';
comment on column public.presupuesto_config.composicion_saldo is 'A-FEAT-1660: de qué se compone el saldo de arranque: [{cuenta, monto}]. La suma = saldo_inicial.';
