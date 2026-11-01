-- 170 · A-FEAT-1503: el FCI de MSA al cierre 30/06/2026, desde el resumen FIMA (JMS 01/11: «si yo lo cargo a mano también lo
-- podés hacer vos; poné que lo pusiste vos y listo en la fuente del dato»). Va al MISMO lugar que la casilla de «Pasar a la
-- foto del balance» (balance_datos_usuario, papel fci): 0 cuotapartes (todo rescatado) y el valor de la cuotaparte del 30/06.
-- Marca: actualizado_por empieza con '[script 170]'. Frena si ya hay datos del FCI para ese cierre.
do $$
begin
  if exists (select 1 from public.balance_datos_usuario where empresa='MSA' and anio_cierre=2026 and papel='fci') then
    raise exception 'ya hay datos del FCI de MSA 2026: no se pisan';
  end if;
  insert into public.balance_datos_usuario (empresa, anio_cierre, papel, clave, texto, valor, historial, actualizado_por) values
  ('MSA', 2026, 'fci', 'cuotapartes', '0', 0, '[]'::jsonb,
   '[script 170] Claude · resumen FIMA Premium A jun-2026 (Inv_26-06.pdf): «No hay saldo de tenencia» al 30/06/2026 — 652.871,50 cuotas al 29/05 menos 14 rescates de junio = 0'),
  ('MSA', 2026, 'fci', 'valor_cuotaparte', '81,856194', 81.856194, '[]'::jsonb,
   '[script 170] Claude · resumen FIMA Premium A jun-2026 (Inv_26-06.pdf): valor del último rescate, 30/06/2026');
end $$;
