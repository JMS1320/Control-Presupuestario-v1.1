-- Deshace el 275: vuelve el inicio de granos 25/26 a TENTATIVO (lo de Claude), con el historial vacío como estaba.
begin;
update public.balance_datos_usuario
  set actualizado_por = 'Claude · TENTATIVO · «STOCKS - GRANOS - INSUMOS…» (balance 24/25) · hoja 1 - GRANOS · B13: soja 6,926 t al 30/06/2025 en AFA (mismo valor que el contador: $ 2.045.386,32)',
      historial = '[]'::jsonb
  where id = '8ba1080e-dd90-41fa-90d3-5640d647e735' and actualizado_por like '%[script 275]';
commit;
