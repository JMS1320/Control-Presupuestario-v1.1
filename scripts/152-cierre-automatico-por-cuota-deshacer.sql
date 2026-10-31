-- Deshace 152 · saca el trigger y la función del cierre automático (los creó el 152, que frena si ya existían).
-- Lo que ya se cerró solo queda cerrado (resuelto_por = 'app (cierre automático)'): si hace falta, se reabre a mano.
begin;
drop trigger trg_revisiones_cierre_por_cuota on public.cuotas_egresos_sin_factura;
drop function public.revisiones_cierre_por_cuota();
commit;
