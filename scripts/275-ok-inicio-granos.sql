-- 275 · A-FEAT-1627 (JMS 14/11: «el inicio de 6,926 t está ok, confirmalo»). El OK al stock de granos al inicio del 25/26, igual que el
-- botón «OK» de la pantalla (confirmarFila): mismo valor (6,926 t), queda a nombre de JMS y lo de Claude (TENTATIVO) va al historial.
-- Antes: actualizado_por = «Claude · TENTATIVO · …», historial = []. Deshacer: 275-ok-inicio-granos-deshacer.sql
begin;
update public.balance_datos_usuario
  set historial = coalesce(historial, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('texto', texto, 'valor', valor, 'at', updated_at, 'por', actualizado_por)),
      actualizado_por = 'JMS · OK por chat 14/11 [script 275]', updated_at = now()
  where id = '8ba1080e-dd90-41fa-90d3-5640d647e735' and valor = 6.926 and actualizado_por like 'Claude · TENTATIVO%';
do $$ begin
  if (select count(*) from public.balance_datos_usuario where id = '8ba1080e-dd90-41fa-90d3-5640d647e735' and actualizado_por like '%[script 275]' and valor = 6.926) <> 1 then raise exception '275: no quedó confirmado'; end if;
end $$;
commit;
