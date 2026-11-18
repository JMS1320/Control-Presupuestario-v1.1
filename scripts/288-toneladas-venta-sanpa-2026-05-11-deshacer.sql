-- 288 · DESHACER: la factura vuelve a quedar sin grano ni toneladas (así estaba el 18/11, verificado por id).

begin;

update msa.comprobantes_venta
   set toneladas = null, grano = null, updated_at = now()
 where id = '3e885754-e800-416e-9e71-6e1c096da113' and toneladas = 212.96 and grano = 'SOJA';

commit;
