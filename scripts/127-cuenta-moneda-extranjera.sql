-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 💱 Script 127 — A-FEAT-1398: la cuenta contable «Compra-venta de moneda extranjera»
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 2026-10-28: «sí a la cuenta contable». Es FINANCIERA (la plata no sale de la empresa: cambia de moneda), así que
-- no se presupuesta. Va con «Transferencias Interbancarias», en MOVIMIENTOS ENTRE CANALES, sin número (como ésa).
-- La usa por default la compra/venta de USD (components/panel-dolares.tsx).
-- Escribe: 1 fila en public.cuentas_contables (frena si el categ ya existe). Deshacer: 127-…-deshacer.sql.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;
do $$
begin
  if exists (select 1 from public.cuentas_contables where categ = 'MONEDA EXTRANJERA') then
    raise exception 'Ya existe la categoría MONEDA EXTRANJERA: no se corre.';
  end if;
end $$;
insert into public.cuentas_contables (categ, cuenta_contable, tipo, activo, imputable, nombre_totalizadora, cambio_nombre_cta)
values ('MONEDA EXTRANJERA', 'Compra-venta de moneda extranjera', 'financiero', true, true, 'MOVIMIENTOS ENTRE CANALES', '[script 127] A-FEAT-1398');
commit;
select categ, cuenta_contable, tipo, nombre_totalizadora from public.cuentas_contables where categ = 'MONEDA EXTRANJERA';
