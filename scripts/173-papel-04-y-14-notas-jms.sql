-- 173 · Las notas de JMS en el Excel del 01/11 sobre los papeles 04 y 14 (A-FEAT-1506), con su OK en la terminal:
--   (a) papel 14: saldo de INICIO de JMS y AMS = 0 — JMS: «debería ser cero. La factura del 30/6/25 se dejó como pagada».
--       Eran TENTATIVOS puestos por Claude ($ 15 M y $ 10,5 M). El valor anterior queda en `historial`.
--   (b) papel 04: 20 facturas «no se pagó nunca» que JMS marcó «Pagado» → ajuste del balance `pagado_al_cierre` (acción
--       prevista en `ajustes_balance`). NO toca la factura ni su estado: el Cash Flow sigue igual (JMS: «que no se confunda
--       con cosas del cash flow de lo real… a cierre de balance decís que están pagas aunque no puedas rastrear el dato»).
--   (c) papel 14: MA y PAM → «Pendientes a revisar» (JMS: «ver con Mauricio, dejar en pendientes»).
-- Marca: '[script 173]'. Frena si ya corrió.
do $$
begin
  if exists (select 1 from public.ajustes_balance where motivo like '%[script 173]%') then raise exception 'script 173 ya corrido'; end if;

  update public.balance_datos_usuario
     set historial = coalesce(historial,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('texto', texto, 'valor', valor, 'at', updated_at, 'por', actualizado_por)),
         texto = '0', valor = 0, updated_at = now(),
         actualizado_por = '[script 173] JMS 01/11 en el Excel (papel 14): «debería ser cero. La factura del 30/6/25 se dejó como pagada» — lo cargó Claude'
   where empresa='MSA' and anio_cierre=2026 and papel='cc.saldo-inicio' and clave in ('JMS','AMS');

  insert into public.ajustes_balance (empresa, anio_cierre, accion, concepto, categ, monto, motivo, tabla, registro_id, creado_por)
  select 'MSA', 2026, 'pagado_al_cierre',
         format('%s %s-%s', c.denominacion_emisor, c.punto_venta, c.numero_desde), c.cuenta_contable, c.imp_total,
         'JMS 01/11 en el Excel (papel 04): «Pagado» — pagada al cierre aunque no se pueda rastrear el pago; visto y chequeado, no resuelto [script 173]',
         'msa.comprobantes_arca', c.id::text, 'Claude (OK de JMS 01/11)'
    from msa.comprobantes_arca c
   where c.id in ('f5eb6d16-9bda-43e7-9409-cf10f99adf00','461eac0d-f7b5-433a-8afa-05cf2eac0778','b6c9f796-6204-49f5-babb-46e6b26451e1',
     'a47fa8e1-ef5c-431b-93ca-c7bce9825502','38d13b1f-d6c0-4b77-983f-51ba09979c57','0f6a8470-a546-41f9-af08-9d73f24bbe69','d0b07348-1d2a-40ed-85b0-d5be300ed4e9',
     'cf255f2e-1a5d-4a9f-8c12-84bd06c36ef0','03562123-63fe-4eff-b8d5-43ebc862cb72','2d639fa1-d5f3-4c29-be95-1a002078982b','84a76ec6-a74a-4866-bf89-38fcf3c2d8ba',
     'e3e06142-8628-4e5e-9a63-e65d8b4aa8be','6ca5a339-ead1-44b8-8d01-78597711b4fc','57ba6029-d6aa-414c-a67c-0b65bb3ce7d0','284f4cc7-a17d-48d7-87bc-d89bd379b0f5',
     'dab93f7c-8c1e-4745-a183-7e31a8fa1e20','1f31ef83-f37a-4591-9a32-2684107e4abb','6f1dfa71-9379-4b15-a56f-e033eac10e60','23c0a349-37f4-445c-b1de-b32c219322ad',
     '40b8c7c7-e55e-44cd-a9c0-eacd21be42a1');

  insert into public.balance_pendientes (empresa, anio_cierre, texto, estado, creado_por) values
  ('MSA', 2026, '❓ Papel 14 · Mercedes Areco: saldo de inicio de la cuenta corriente — ver con Mauricio (JMS 01/11, en el Excel) [script 173]', 'abierto', 'Claude'),
  ('MSA', 2026, '❓ Papel 14 · Sucesión de Plácido Martínez: saldo de inicio de la cuenta corriente — ver con Mauricio (JMS 01/11, en el Excel) [script 173]', 'abierto', 'Claude');
end $$;
