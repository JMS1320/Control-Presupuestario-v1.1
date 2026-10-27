-- =====================================================================================
-- 115 · DESHACER — grupo de cobro de Sáenz Valiente (A-FEAT-167)
-- =====================================================================================
-- Vuelve a la foto del 27/10: los 3 movimientos sin vínculo, las 2 ventas sin grupo, y borra SÓLO el grupo
-- que creó el 115 (id fijo + marca «[script 115]»). Correrlo antes del deshacer del 114.
-- =====================================================================================
begin;

update public.msa_galicia set comprobante_venta_id = null
 where id in ('2ebe6ce0-1378-4539-9867-0d6c96a39d8c','4a329ea1-1f0a-4c2c-b8c2-6f327750bd9b','c358fc1e-9eb3-44ac-aa5c-4073ed2337a2')
   and comprobante_venta_id = '92ebb1f3-bf43-4202-aceb-9e59274f27e4';

update msa.comprobantes_venta set grupo_cobro_id = null
 where grupo_cobro_id = 'd68a5a14-4f70-402a-a7bf-d1dae0f482ec';

delete from msa.grupos_cobro
 where id = 'd68a5a14-4f70-402a-a7bf-d1dae0f482ec' and observaciones like '[script 115]%';

commit;
