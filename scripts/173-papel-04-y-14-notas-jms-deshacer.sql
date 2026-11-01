-- Deshace 173: (a) vuelve el inicio de JMS y AMS al valor anterior (el último del historial), sólo si nadie lo cambió después;
-- (b) borra los ajustes que creó; (c) borra los dos pendientes que creó, sólo si siguen sin respuesta.
update public.balance_datos_usuario d
   set texto = h->>'texto', valor = (h->>'valor')::numeric, actualizado_por = h->>'por', historial = d.historial - (jsonb_array_length(d.historial) - 1)
  from (select id, historial -> (jsonb_array_length(historial) - 1) h from public.balance_datos_usuario) u
 where d.id = u.id and d.empresa='MSA' and d.anio_cierre=2026 and d.papel='cc.saldo-inicio' and d.clave in ('JMS','AMS')
   and d.actualizado_por like '[script 173]%';
delete from public.ajustes_balance where accion='pagado_al_cierre' and motivo like '%[script 173]%';
delete from public.balance_pendientes where texto like '%[script 173]' and resolucion is null;
