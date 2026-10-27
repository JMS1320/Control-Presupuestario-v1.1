-- =====================================================================================
-- 115 · COBRO AGRUPADO — primer caso real: Sáenz Valiente 209-32006 + 209-32007 (A-FEAT-167)
-- =====================================================================================
-- OK de JMS 2026-10-27 («podemos probarlo para ese cobro exacto pero hacelo vos»).
-- Las 2 liquidaciones del 27/01/2026 se cobraron en 3 transferencias, y cada una paga una cuota de LAS DOS:
--   cuota 1 de las dos = 6.526.036,96 + 5.267.927,60 = 11.793.964,56 = 28/01 10.522.466,79 + 29/01 1.271.497,77
--   cuota 2 de las dos = 6.524.297,81 + 5.266.133,35 = 11.790.431,16 = 09/03 11.790.431,16
-- Los 3 movimientos estaban conciliados SIN vínculo (script 111) esperando este grupo.
-- Qué hace: crea el grupo, le asigna las 2 ventas y ata los 3 movimientos a la PRIMERA venta del grupo
-- (como el pago agrupado ata su movimiento al primer ítem); el detalle del cobro suma el grupo entero.
-- No toca estado, cuenta, detalle ni comprobantes_pagados de nada.
-- Deshacer: scripts/115-grupo-cobro-saenz-deshacer.sql
-- =====================================================================================
begin;

-- 1 · Foto: si algo no está como el 27/10, no se aplica nada.
do $$
begin
  if (select count(*) from msa.comprobantes_venta
       where id in ('92ebb1f3-bf43-4202-aceb-9e59274f27e4','5ca8b345-2e5f-4ac9-96ac-29bf5290c41e')
         and cuit_cliente = '30576703119' and grupo_cobro_id is null) <> 2
  then raise exception '115: las 2 ventas de Sáenz no están como en la foto'; end if;
  if (select count(*) from public.msa_galicia
       where id in ('2ebe6ce0-1378-4539-9867-0d6c96a39d8c','4a329ea1-1f0a-4c2c-b8c2-6f327750bd9b','c358fc1e-9eb3-44ac-aa5c-4073ed2337a2')
         and comprobante_venta_id is null and anticipo_id is null and estado = 'conciliado') <> 3
  then raise exception '115: los 3 movimientos de Sáenz no están como en la foto'; end if;
  if (select round(sum(creditos)::numeric, 2) from public.msa_galicia
       where id in ('2ebe6ce0-1378-4539-9867-0d6c96a39d8c','4a329ea1-1f0a-4c2c-b8c2-6f327750bd9b','c358fc1e-9eb3-44ac-aa5c-4073ed2337a2'))
     <> 23584395.72
  then raise exception '115: los 3 movimientos no suman 23.584.395,72'; end if;
end $$;

-- 2 · El grupo.
insert into msa.grupos_cobro (id, cuit, cliente, monto_total, estado, observaciones)
values ('d68a5a14-4f70-402a-a7bf-d1dae0f482ec', '30576703119', 'SAENZ VALIENTE BULLRICH Y CIA SA', 23584395.72, 'cobrado',
        '[script 115] 209-32006 + 209-32007 (27/01/2026), cobradas en 3 transferencias: 28/01, 29/01 y 09/03.');

-- 3 · Las 2 ventas al grupo.
update msa.comprobantes_venta set grupo_cobro_id = 'd68a5a14-4f70-402a-a7bf-d1dae0f482ec'
 where id in ('92ebb1f3-bf43-4202-aceb-9e59274f27e4','5ca8b345-2e5f-4ac9-96ac-29bf5290c41e');

-- 4 · Los 3 movimientos, atados a la primera venta del grupo (209-32006).
update public.msa_galicia set comprobante_venta_id = '92ebb1f3-bf43-4202-aceb-9e59274f27e4'
 where id in ('2ebe6ce0-1378-4539-9867-0d6c96a39d8c','4a329ea1-1f0a-4c2c-b8c2-6f327750bd9b','c358fc1e-9eb3-44ac-aa5c-4073ed2337a2');

-- 5 · Control.
do $$
declare v int; m int;
begin
  select count(*) into v from msa.comprobantes_venta where grupo_cobro_id = 'd68a5a14-4f70-402a-a7bf-d1dae0f482ec';
  select count(*) into m from public.msa_galicia where comprobante_venta_id = '92ebb1f3-bf43-4202-aceb-9e59274f27e4';
  if v <> 2 or m <> 3 then raise exception '115: esperaba 2 ventas y 3 movimientos, hay % y %', v, m; end if;
end $$;

commit;
