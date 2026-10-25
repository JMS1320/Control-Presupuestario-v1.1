-- Deshace 103 · borra SÓLO lo que cargó el 103, identificado por su marca: created_at = '2026-10-25 05:05:02.046705+00'
-- (el instante de la transacción del 103) y, en los templates, '[script 103]' en observaciones_template.
--
-- 🛑 Se frena si algún template del 103 ya tiene CUOTAS (ya se concilió algo contra él): eso es dato del usuario y
-- se revisa a mano antes. Las partidas sólo se vacían si siguen con el valor que puso el 103.

-- Control previo (sólo lee)
select 'cuotas en templates del 103' as que, count(*) from public.cuotas_egresos_sin_factura c
  join public.egresos_sin_factura e on e.id = c.egreso_id
 where e.created_at = '2026-10-25 05:05:02.046705+00' and e.observaciones_template like '%[script 103]%';

begin;

do $$
begin
  if exists (select 1 from public.cuotas_egresos_sin_factura c join public.egresos_sin_factura e on e.id = c.egreso_id
             where e.created_at = '2026-10-25 05:05:02.046705+00' and e.observaciones_template like '%[script 103]%') then
    raise exception 'Hay cuotas en los templates del 103 (ya se concilió algo): revisar a mano antes de deshacer.';
  end if;
end $$;

delete from public.reglas_conciliacion
 where created_at = '2026-10-25 05:05:02.046705+00' and cuenta_bancaria_id in ('ma_galicia', 'pam_galicia');

delete from public.egresos_sin_factura
 where created_at = '2026-10-25 05:05:02.046705+00' and observaciones_template like '%[script 103]%';

update public.egresos_sin_factura set partida_arba = null
 where (nombre_referencia, responsable, partida_arba) in (
   ('ABL Libertad Cuota', 'PAM', '1005392-00'),
   ('ABL Cochera Posadas Anual', 'PAM', '2831491-03'),
   ('ABL Cochera Posadas Cuota', 'PAM', '2831491-03'),
   ('ABL Cochera Libertad Anual', 'PAM/MA/Duhau', '1568025-04')) and año = '2026';

delete from public.cuentas_contables
 where created_at = '2026-10-25 05:05:02.046705+00' and categ in ('Tarjetas MA', 'Consumos', 'Promocion Galicia');

commit;
