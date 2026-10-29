-- 128 · A-FEAT-1386 (b): saldo de inicio del ejercicio 25/26 de la cta en dólares de MSA (Galicia USD).
-- JMS 29/10: «adelante con mis datos» → US$ 35.001,63 (su planilla del 30/06/2025). Caja USD: en cero (su nota), no se carga nada.
-- TC histórico 1.165 = el del contador ($ 40.776.898,95 / US$ 35.001,63); no hay dólar BNA del 30/06/2025 en cotizaciones.
-- Marca: detalle = '[script 128] A-FEAT-1386'. Se frena si ya hay una fila con esa marca.
do $$
begin
  if exists (select 1 from msa.cc_usd where detalle = '[script 128] A-FEAT-1386') then
    raise exception 'script 128 ya corrido';
  end if;
  insert into msa.cc_usd (fecha, descripcion, debitos, creditos, moneda, tipo_cambio, importe_pesos, estado, detalle, orden)
  values ('2025-06-30', 'Saldo de inicio ejercicio 2025/26 (planilla JMS 30/06/2025)', 0, 35001.63, 'USD', 1165, 40776898.95,
          'Pendiente', '[script 128] A-FEAT-1386', 0);
end $$;
