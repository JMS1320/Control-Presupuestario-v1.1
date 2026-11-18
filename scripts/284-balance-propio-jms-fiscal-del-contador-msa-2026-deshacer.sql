-- 284 · DESHACER: devuelve las 9 filas a lo que tenían antes (valores verificados en la base el 17/11, por id) y borra
-- las 2 que creó el 284. Sólo toca filas que sigan marcadas [script 284].

begin;

update public.balance_foto_valores j
   set importe = v.importe, origen = 'manual', detalle = v.detalle, updated_at = now()
  from (values
    ('0c9e3273-7b7d-49e3-954c-0184bd29ff89'::uuid, 16710338.89, '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro (lo da el contador)'),
    ('86fd229f-ab58-44ee-a479-ad7f647de21e'::uuid, 76195.86, '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro'),
    ('3c19691f-ecbc-4889-8f8a-352073182d36'::uuid, 17814224.56, '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro'),
    ('522325e0-595f-472b-bf47-ebee6f522c4d'::uuid, 2745365.40, '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro'),
    ('4d0ff398-dca6-428e-ae9c-f5c99422b645'::uuid, 4634923.85, '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro'),
    ('0ad838b6-084a-4b25-9a0f-7b4d61928ebb'::uuid, 6702796.38, '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro (tu criterio)'),
    ('217c157c-0e25-41bd-96d9-f80aa176d821'::uuid, 13764935.13, '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro'),
    ('a6b5bf19-95e3-4981-9f04-654c5baa2931'::uuid, 15123214.62, '[script 273] neutro (mismos US$ que el 30/06/25) · impuesto: neutro'),
    ('c47c6ac4-e91d-4bee-bfd6-56becbc77021'::uuid, 82215901.59, '[script 273] neutro (mismos US$ que el 30/06/25) · lo da el contador: neutro')
  ) as v(id, importe, detalle)
 where j.id = v.id and j.detalle like '[script 284]%';

delete from public.balance_foto_valores
 where foto_id = '29447556-df4e-468d-866c-0576e9d82344' and version = 'jms'
   and renglon in ('saldo_favor_ganancias', 'iva_credito_a_computar') and detalle like '[script 284]%';

commit;
