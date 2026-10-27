-- =====================================================================================
-- 111 · DESHACER — las 9 ventas del libro IVA (A-DAT-88)
-- =====================================================================================
-- Sólo borra lo que creó el 111 (marca «[script 111]» o los ids fijos del script) y devuelve los
-- 8 movimientos del banco a la FOTO tomada el 2026-10-27 antes de correrlo (valores abajo).
-- Verificado antes de escribirlo: ninguna de las 9 ventas, ni las 3 contrapartes, existían.
-- =====================================================================================
begin;

-- 1 · El banco, a la foto del 27/10 (antes del 111)
update public.msa_galicia set comprobante_venta_id = null, categ = null, nro_cuenta = null, estado = 'historico', comprobantes_pagados = null
where id in ('bee70a64-0097-45e4-919f-359969f54aad','c44dccf0-261f-443a-b760-eb2e3f93e5e1','7839b5a1-947b-4514-87cd-8dc7156401cc',
             '6aa2761f-f86e-44de-aeb8-739b5440c503','2ebe6ce0-1378-4539-9867-0d6c96a39d8c','4a329ea1-1f0a-4c2c-b8c2-6f327750bd9b');

update public.msa_galicia set comprobante_venta_id = null, categ = 'INVALIDA:', nro_cuenta = null, estado = 'pendiente', comprobantes_pagados = null
where id = 'c358fc1e-9eb3-44ac-aa5c-4073ed2337a2';

update public.msa_galicia set comprobante_venta_id = null
where id = '1058a6e0-c2f5-4d6f-aab3-f4f4f9c64d94';

-- 2 · Las retenciones del 111
delete from msa.retenciones_recibidas where observaciones like '[script 111]%';

-- 3 · Las 9 ventas (por id fijo Y con la marca, para no borrar nada que se haya cargado aparte)
delete from msa.comprobantes_venta
where datos_adicionales like '%[script 111]%'
  and id in ('a7dfdce5-5d26-4070-bde1-e82d5b8678ca','7b1c839b-29e7-4e5b-919f-b54347fc88b4','5375d919-1a49-44c0-8026-f2756ececb62',
             '4cac5636-949d-4843-8889-58ae53400f3c','8a6546e4-9680-4f85-a020-c9c2fa593c9d','92ebb1f3-bf43-4202-aceb-9e59274f27e4',
             '5ca8b345-2e5f-4ac9-96ac-29bf5290c41e','f8fb8fc7-f0ef-4295-9733-2b121a30079a','f3c0bbad-0f3f-4f76-8a16-8c023449deab');

-- 4 · Las contrapartes que dio de alta el 111 (sólo si nada más las usa)
delete from public.proveedores p
where p.notas like '[script 111]%'
  and p.cuit in ('30500049460','20122086489','30576703119')
  and not exists (select 1 from msa.comprobantes_venta v where v.cuit_cliente = p.cuit)
  and not exists (select 1 from msa.comprobantes_arca a where a.cuit = p.cuit);

commit;
