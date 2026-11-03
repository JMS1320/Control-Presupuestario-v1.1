-- 📜 Script 197 — A-FEAT-140: la marca «opera en cuenta corriente» en el maestro de contrapartes, y AFA marcada.
-- Pedido de JMS (03/11, en esta terminal): «si imputamos contra cuenta corriente, ¿no deberían dejar de figurar pendientes
-- las compras y las ventas y empezar a ver saldo en cta cte? ¿y las cosas se concilien contra cuenta corriente?» →
-- «dale, desarrollá A-FEAT-140 empezando por AFA».
--
-- Con la marca, las facturas de compra y las ventas de esa contraparte dejan de figurar una por una como pendientes de
-- pago/cobro: se ve el SALDO de su cuenta corriente, y el banco se concilia contra «CTA <contraparte>».
--
-- Verificado antes de escribir esto (03/11): la columna NO existe en public.proveedores (30 columnas, ninguna parecida).
-- La tabla se expone directa (no hay vista public.* que listar), así que no hay vista que actualizar; los GRANT de la tabla
-- alcanzan a la columna nueva. Sin cambios de RLS ni permisos.
-- Deshacer: 197-proveedores-opera-cuenta-corriente-deshacer.sql

begin;

alter table public.proveedores add column if not exists opera_cuenta_corriente boolean not null default false;
comment on column public.proveedores.opera_cuenta_corriente is
  'A-FEAT-140 [script 197]: sus compras y ventas se cancelan por cuenta corriente (no se listan como pendientes una por una; se ve el saldo y el banco se concilia contra CTA <contraparte>)';

-- AFA (CUIT 30525718626): la única marcada por ahora, a pedido de JMS.
update public.proveedores set opera_cuenta_corriente = true where cuit = '30525718626';

-- Control: tiene que quedar exactamente 1 marcada.
do $$ begin
  if (select count(*) from public.proveedores where opera_cuenta_corriente) <> 1 then
    raise exception 'se esperaba 1 contraparte marcada (AFA)';
  end if;
end $$;

commit;
notify pgrst, 'reload schema';
