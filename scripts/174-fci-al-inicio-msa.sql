-- 174 · A-FEAT-1509: el FCI de MSA al INICIO (30/06/2025), en la misma casilla que el cierre (script 170).
-- Cuotapartes: 362.898,06 — sale de los resúmenes FIMA: 577.094,86 al 31/07/2025 − 820.696,97 suscriptas + 606.500,17 rescatadas en julio.
-- Valor de la cuotaparte: 64,0511 DEDUCIDO (JMS 01/11: «sí») = apertura del contador $ 23.244.019,93 ÷ 362.898,06; el primer resumen
-- arranca el 01/07 (64,094517), un día después. Marca '[script 174]'. Frena si ya hay datos de inicio.
do $$
begin
  if exists (select 1 from public.balance_datos_usuario where empresa='MSA' and anio_cierre=2026 and papel='fci' and clave in ('cuotapartes_inicio','valor_cuotaparte_inicio')) then
    raise exception 'ya hay datos del FCI al inicio: no se pisan';
  end if;
  insert into public.balance_datos_usuario (empresa, anio_cierre, papel, clave, texto, valor, historial, actualizado_por) values
  ('MSA', 2026, 'fci', 'cuotapartes_inicio', '362.898,06', 362898.06, '[]'::jsonb,
   '[script 174] Claude · resúmenes FIMA Premium A: 577.094,86 cuotas al 31/07/2025 − 820.696,97 suscriptas + 606.500,17 rescatadas en julio'),
  ('MSA', 2026, 'fci', 'valor_cuotaparte_inicio', '64,0511', 64.0511, '[]'::jsonb,
   '[script 174] Claude · DEDUCIDO (OK de JMS 01/11): apertura del contador $ 23.244.019,93 ÷ 362.898,06 cuotas; el resumen de julio arranca en 64,094517 el 01/07');
end $$;
