-- Deshace 154 · borra SÓLO las 8 reglas que creó el 154, identificadas por su marca:
-- cuenta_bancaria_id = 'msa_santander' y created_at = '2026-10-31 22:45:17.520061+00' (el instante de la transacción del 154).
--
-- ⚠️ No deshace lo que ya se haya CONCILIADO con estas reglas (cuotas creadas en los templates y movimientos marcados):
-- eso es trabajo del usuario y se revisa a mano. Borrar la regla sólo hace que el motor no la vuelva a usar.

-- Control previo (sólo lee)
select 'reglas del 154' as que, count(*) from public.reglas_conciliacion
 where cuenta_bancaria_id = 'msa_santander' and created_at = '2026-10-31 22:45:17.520061+00';

begin;

delete from public.reglas_conciliacion
 where cuenta_bancaria_id = 'msa_santander' and created_at = '2026-10-31 22:45:17.520061+00';

commit;
