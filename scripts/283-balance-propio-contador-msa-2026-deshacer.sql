-- 283 · DESHACER: saca la versión «contador» del balance propio de MSA al 30/06/2026.
-- Sólo borra las filas que creó el script 283 (detalle empieza con «[script 283]»); la versión de JMS no se toca.

begin;

delete from public.balance_foto_valores v
 using public.balance_fotos f
 where v.foto_id = f.id and f.empresa = 'MSA' and f.fecha_cierre = date '2026-06-30'
   and v.version = 'contador' and v.detalle like '[script 283]%';

commit;
