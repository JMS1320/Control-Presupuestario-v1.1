-- 108 · UN TEMPLATE POR PÓLIZA, con las cuotas que espera el banco, y la conciliación re-apuntada — A-FEAT-1385
-- GENERADO por scripts/108-generar-polizas-templates.mts el 2026-10-27T05:43:56.482Z (no editar a mano: regenerar).
-- Foto antes: «- Comunicacion JMS Claude - Archivos/Balance/respaldos/foto-polizas-conciliacion-2026-10-27.json».
-- Hace: 8 templates nuevos (60 cuotas) · 22 movimientos re-apuntados (sin cambiarles estado ni campos) ·
--       39 cuotas de los templates genéricos desactivadas y 3 genéricos inactivos · facturas de pólizas con su PDF (el estado no se toca).
-- 🛑 Con OK de JMS (27/10: «1 ok 2 ok 3 podés avanzar. Tomá foto de cómo está la BBDD antes de tocar»).

begin;
do $$ begin
  if exists (select 1 from public.egresos_sin_factura where observaciones_template like '[script 108]%') then
    raise exception 'Ya hay templates del 108: no se corre dos veces.';
  end if;
end $$;
alter table public.polizas_seguro add column if not exists template_id uuid references public.egresos_sin_factura(id);
comment on column public.polizas_seguro.template_id is '[script 108] A-FEAT-1385 — el template de la póliza: sus cuotas son lo que espera el banco.';
insert into public.egresos_sin_factura (id, template_master_id, nombre_referencia, proveedor, cuit_quien_cobra, nombre_quien_cobra, categ, centro_costo, responsable, responsable_interno, cuotas, tipo_fecha, codigo_contable, codigo_interno, activo, "año", cuenta_agrupadora, tipo_template, tipo, periodicidad, aplica_generacion, solo_conciliacion, observaciones_template)
values ('a70805ab-dd68-4a23-a5ae-a2101fd015ac', 'b88c61a4-f2fb-4ffe-9814-d21f7864a978', 'Seguro Accidentes Personales — póliza 10183421', 'Federacion Patronal SAU', '33707366589', 'Federacion Patronal SAU', 'Seguros Estructura', 'Estructura', 'MSA', null, 12, 'Estimada', 'No Lleva', 'Desglosar', true, '25/26', 'Seguros', 'fijo', 'egreso', 'bianual', false, false,
  '[script 108] A-FEAT-1385 — generado desde la póliza 10183421: cada cuota es lo que espera el banco en ese vencimiento (endosos sumados, notas de crédito compensadas).');
update public.polizas_seguro set template_id = 'a70805ab-dd68-4a23-a5ae-a2101fd015ac' where id = '7a7af8d8-9301-4e47-b2cf-c5d288754722';
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('6cfd4602-c410-4f7d-97c5-f535576b8203', 'a70805ab-dd68-4a23-a5ae-a2101fd015ac', 1, '2026-02-06', '2026-02-06', 15740, 'pendiente', '[script 108] póliza 10183421 · vence 2026-02-06', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('bb7ebfe1-6a0f-46e1-8df2-cb180ceb1ad7', 'a70805ab-dd68-4a23-a5ae-a2101fd015ac', 2, '2026-03-06', '2026-03-06', 48996, 'pendiente', '[script 108] póliza 10183421 · vence 2026-03-06', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('897ec160-ab63-4245-a88a-0deb4c9d3762', 'a70805ab-dd68-4a23-a5ae-a2101fd015ac', 3, '2026-04-06', '2026-04-06', 48996, 'pendiente', '[script 108] póliza 10183421 · vence 2026-04-06', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('be00908e-a6d9-4016-9d7b-fdbed6a7b581', 'a70805ab-dd68-4a23-a5ae-a2101fd015ac', 4, '2026-05-06', '2026-05-06', 48996, 'pendiente', '[script 108] póliza 10183421 · vence 2026-05-06', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('3a705643-4856-4379-8646-ce395e4f506a', 'a70805ab-dd68-4a23-a5ae-a2101fd015ac', 5, '2026-06-06', '2026-06-06', 32634, 'pendiente', '[script 108] póliza 10183421 · vence 2026-06-06', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('7f1707b9-3681-441f-9469-abf4ac2e5d6d', 'a70805ab-dd68-4a23-a5ae-a2101fd015ac', 6, '2026-07-06', '2026-07-06', 32634, 'pendiente', '[script 108] póliza 10183421 · vence 2026-07-06', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('fb44f160-c5c1-42c0-ac24-0f2de3ad28ce', 'a70805ab-dd68-4a23-a5ae-a2101fd015ac', 7, '2026-08-06', '2026-08-06', 32634, 'pendiente', '[script 108] póliza 10183421 · vence 2026-08-06', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('67015248-4959-4085-b234-876e9dfa62bd', 'a70805ab-dd68-4a23-a5ae-a2101fd015ac', 8, '2026-09-06', '2026-09-06', 32634, 'pendiente', '[script 108] póliza 10183421 · vence 2026-09-06', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('1a23caa3-8086-4ac0-a2d1-649fb9078e46', 'a70805ab-dd68-4a23-a5ae-a2101fd015ac', 9, '2026-10-06', '2026-10-06', 32634, 'pendiente', '[script 108] póliza 10183421 · vence 2026-10-06', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('cbda0f36-8074-4dce-916d-9911eef9a9ea', 'a70805ab-dd68-4a23-a5ae-a2101fd015ac', 10, '2026-11-06', '2026-11-06', 32634, 'pendiente', '[script 108] póliza 10183421 · vence 2026-11-06', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('572843e5-15d7-453b-981b-10d15db8e7ce', 'a70805ab-dd68-4a23-a5ae-a2101fd015ac', 11, '2026-12-06', '2026-12-06', 32634, 'pendiente', '[script 108] póliza 10183421 · vence 2026-12-06', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('a1d3402e-ad3c-4c10-aeb5-c232e3d87df2', 'a70805ab-dd68-4a23-a5ae-a2101fd015ac', 12, '2027-01-06', '2027-01-06', 32633.51, 'pendiente', '[script 108] póliza 10183421 · vence 2027-01-06', 'egreso', 'banco', false);
insert into public.egresos_sin_factura (id, template_master_id, nombre_referencia, proveedor, cuit_quien_cobra, nombre_quien_cobra, categ, centro_costo, responsable, responsable_interno, cuotas, tipo_fecha, codigo_contable, codigo_interno, activo, "año", cuenta_agrupadora, tipo_template, tipo, periodicidad, aplica_generacion, solo_conciliacion, observaciones_template)
values ('3bf0c7f0-b1f5-453e-87c6-a5305e350795', 'b88c61a4-f2fb-4ffe-9814-d21f7864a978', 'Seguro Accidentes Personales — póliza 10200836 (OLIVO ALONDRA AYLIN)', 'Federacion Patronal SAU', '33707366589', 'Federacion Patronal SAU', 'Seguros Estructura', 'Estructura', 'MA', 'MA', 12, 'Estimada', 'No Lleva', 'No Lleva', true, '25/26', 'Seguros', 'fijo', 'egreso', 'bianual', false, false,
  '[script 108] A-FEAT-1385 — generado desde la póliza 10200836: cada cuota es lo que espera el banco en ese vencimiento (endosos sumados, notas de crédito compensadas).');
update public.polizas_seguro set template_id = '3bf0c7f0-b1f5-453e-87c6-a5305e350795' where id = 'd14a9964-a075-4d60-996e-a2ccf092bbb4';
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('3dc92466-ddc1-4fca-8151-2b5903d8fcb0', '3bf0c7f0-b1f5-453e-87c6-a5305e350795', 1, '2026-02-13', '2026-02-13', 11179, 'pendiente', '[script 108] póliza 10200836 · vence 2026-02-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('30b1d919-d5d9-49e6-92eb-7429ac3858ae', '3bf0c7f0-b1f5-453e-87c6-a5305e350795', 2, '2026-03-13', '2026-03-13', 11179, 'pendiente', '[script 108] póliza 10200836 · vence 2026-03-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('7ca35a5e-3953-45b3-8df7-9b05bd688844', '3bf0c7f0-b1f5-453e-87c6-a5305e350795', 3, '2026-04-13', '2026-04-13', 11179, 'pendiente', '[script 108] póliza 10200836 · vence 2026-04-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('ac38f98a-553a-403f-a5e2-58c283d2a02c', '3bf0c7f0-b1f5-453e-87c6-a5305e350795', 4, '2026-05-13', '2026-05-13', 11179, 'pendiente', '[script 108] póliza 10200836 · vence 2026-05-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('d21c6058-3de6-42dd-a717-668adc0b65cd', '3bf0c7f0-b1f5-453e-87c6-a5305e350795', 5, '2026-06-13', '2026-06-13', 11179, 'pendiente', '[script 108] póliza 10200836 · vence 2026-06-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('e8e58c97-5d98-4508-a336-8e0aecaf2e8a', '3bf0c7f0-b1f5-453e-87c6-a5305e350795', 6, '2026-07-13', '2026-07-13', 11179, 'pendiente', '[script 108] póliza 10200836 · vence 2026-07-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('aca93c24-d0bc-4676-83de-5c6a1e3f2f4a', '3bf0c7f0-b1f5-453e-87c6-a5305e350795', 7, '2026-08-13', '2026-08-13', 11179, 'pendiente', '[script 108] póliza 10200836 · vence 2026-08-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('4bc48af9-4873-4f09-94b1-8f66c9c17bec', '3bf0c7f0-b1f5-453e-87c6-a5305e350795', 8, '2026-09-13', '2026-09-13', 11179, 'pendiente', '[script 108] póliza 10200836 · vence 2026-09-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('5a26c2fe-df8b-4121-b5af-2ce401b97654', '3bf0c7f0-b1f5-453e-87c6-a5305e350795', 9, '2026-10-13', '2026-10-13', 11179, 'pendiente', '[script 108] póliza 10200836 · vence 2026-10-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('6bfc2ef6-1b72-4552-9cae-c3777dc752bc', '3bf0c7f0-b1f5-453e-87c6-a5305e350795', 10, '2026-11-13', '2026-11-13', 11179, 'pendiente', '[script 108] póliza 10200836 · vence 2026-11-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('7099fc40-9b9e-47fa-b10f-8ffcaf916f31', '3bf0c7f0-b1f5-453e-87c6-a5305e350795', 11, '2026-12-13', '2026-12-13', 11179, 'pendiente', '[script 108] póliza 10200836 · vence 2026-12-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('93cbdd6f-a872-4740-a0f1-afbdd9729531', '3bf0c7f0-b1f5-453e-87c6-a5305e350795', 12, '2027-01-13', '2027-01-13', 11183.43, 'pendiente', '[script 108] póliza 10200836 · vence 2027-01-13', 'egreso', 'banco', false);
insert into public.egresos_sin_factura (id, template_master_id, nombre_referencia, proveedor, cuit_quien_cobra, nombre_quien_cobra, categ, centro_costo, responsable, responsable_interno, cuotas, tipo_fecha, codigo_contable, codigo_interno, activo, "año", cuenta_agrupadora, tipo_template, tipo, periodicidad, aplica_generacion, solo_conciliacion, observaciones_template)
values ('4711fee7-dc84-4bfb-9f0a-fbf1c5544670', 'b88c61a4-f2fb-4ffe-9814-d21f7864a978', 'Seguro Accidentes Personales — póliza 10413411 (ROJAS CELIA MABEL)', 'Federacion Patronal SAU', '33707366589', 'Federacion Patronal SAU', 'Seguros Estructura', 'Estructura', 'PAM', 'PAM', 12, 'Estimada', 'No Lleva', 'No Lleva', true, '25/26', 'Seguros', 'fijo', 'egreso', 'bianual', false, false,
  '[script 108] A-FEAT-1385 — generado desde la póliza 10413411: cada cuota es lo que espera el banco en ese vencimiento (endosos sumados, notas de crédito compensadas).');
update public.polizas_seguro set template_id = '4711fee7-dc84-4bfb-9f0a-fbf1c5544670' where id = 'f809276a-caab-4726-9056-d8bf5b4049cb';
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('7ee41faa-4c09-412b-bf74-f06b83253baf', '4711fee7-dc84-4bfb-9f0a-fbf1c5544670', 1, '2026-05-13', '2026-05-13', 16982, 'pendiente', '[script 108] póliza 10413411 · vence 2026-05-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('8df0e0f0-a7ef-41a4-8e72-7dfa3a58404f', '4711fee7-dc84-4bfb-9f0a-fbf1c5544670', 2, '2026-06-13', '2026-06-13', 16982, 'pendiente', '[script 108] póliza 10413411 · vence 2026-06-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('3b7be50c-3444-4ddc-808a-6c61aef1906a', '4711fee7-dc84-4bfb-9f0a-fbf1c5544670', 3, '2026-07-13', '2026-07-13', 16982, 'pendiente', '[script 108] póliza 10413411 · vence 2026-07-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('eebcd3c0-9b55-4e6e-833a-2f6476c3e2b7', '4711fee7-dc84-4bfb-9f0a-fbf1c5544670', 4, '2026-08-13', '2026-08-13', 16982, 'pendiente', '[script 108] póliza 10413411 · vence 2026-08-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('9037b675-cbe0-4685-a116-ac81cf835431', '4711fee7-dc84-4bfb-9f0a-fbf1c5544670', 5, '2026-09-13', '2026-09-13', 16982, 'pendiente', '[script 108] póliza 10413411 · vence 2026-09-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('45c54908-ad8d-4fde-bb0b-59fecad55df9', '4711fee7-dc84-4bfb-9f0a-fbf1c5544670', 6, '2026-10-13', '2026-10-13', 16982, 'pendiente', '[script 108] póliza 10413411 · vence 2026-10-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('776aa9bf-b060-41cd-9cc1-ababbd93eee5', '4711fee7-dc84-4bfb-9f0a-fbf1c5544670', 7, '2026-11-13', '2026-11-13', 16982, 'pendiente', '[script 108] póliza 10413411 · vence 2026-11-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('386846bf-5120-434f-ba81-d294d445331e', '4711fee7-dc84-4bfb-9f0a-fbf1c5544670', 8, '2026-12-13', '2026-12-13', 16982, 'pendiente', '[script 108] póliza 10413411 · vence 2026-12-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('e236cea9-10cc-4bcb-b4e6-98770ccbde2e', '4711fee7-dc84-4bfb-9f0a-fbf1c5544670', 9, '2027-01-13', '2027-01-13', 16982, 'pendiente', '[script 108] póliza 10413411 · vence 2027-01-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('3e3877e0-43e1-41bd-a7c4-1e71c8db1700', '4711fee7-dc84-4bfb-9f0a-fbf1c5544670', 10, '2027-02-13', '2027-02-13', 16982, 'pendiente', '[script 108] póliza 10413411 · vence 2027-02-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('c8131027-c79b-44fc-8819-0cd137ec0428', '4711fee7-dc84-4bfb-9f0a-fbf1c5544670', 11, '2027-03-13', '2027-03-13', 16982, 'pendiente', '[script 108] póliza 10413411 · vence 2027-03-13', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('14a2ab92-ef0c-487f-8aff-88a43b6d80b7', '4711fee7-dc84-4bfb-9f0a-fbf1c5544670', 12, '2027-04-13', '2027-04-13', 16981.07, 'pendiente', '[script 108] póliza 10413411 · vence 2027-04-13', 'egreso', 'banco', false);
insert into public.egresos_sin_factura (id, template_master_id, nombre_referencia, proveedor, cuit_quien_cobra, nombre_quien_cobra, categ, centro_costo, responsable, responsable_interno, cuotas, tipo_fecha, codigo_contable, codigo_interno, activo, "año", cuenta_agrupadora, tipo_template, tipo, periodicidad, aplica_generacion, solo_conciliacion, observaciones_template)
values ('17e3e144-ee75-4e40-a3f1-5a485f5b75d5', 'b88c61a4-f2fb-4ffe-9814-d21f7864a978', 'Seguro Flota — póliza 34160783', 'Federacion Patronal SAU', '33707366589', 'Federacion Patronal SAU', 'Seguros Estructura', 'Estructura', 'MSA', 'MSA/MA/JMS', 12, 'Estimada', 'No Lleva', 'Desglosar', true, '25/26', 'Seguros', 'fijo', 'egreso', 'bianual', false, false,
  '[script 108] A-FEAT-1385 — generado desde la póliza 34160783: cada cuota es lo que espera el banco en ese vencimiento (endosos sumados, notas de crédito compensadas).');
update public.polizas_seguro set template_id = '17e3e144-ee75-4e40-a3f1-5a485f5b75d5' where id = '1f72285f-d9f3-4841-ad43-e30a46490b8e';
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('c602ac15-04d4-4e29-bf74-f17bb7d3362a', '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', 1, '2025-08-01', '2025-08-01', 576306, 'pendiente', '[script 108] póliza 34160783 · vence 2025-08-01', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('50c44e84-7077-45e1-97a1-35cabbaa3c40', '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', 2, '2025-09-01', '2025-09-01', 576306, 'pendiente', '[script 108] póliza 34160783 · vence 2025-09-01', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('145e3138-a5be-4d73-b20d-5103b682ebfa', '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', 3, '2025-10-01', '2025-10-01', 576306, 'pendiente', '[script 108] póliza 34160783 · vence 2025-10-01', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('e31173d9-83d5-4e59-8c82-8c282767f3cd', '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', 4, '2025-11-01', '2025-11-01', 576306, 'pendiente', '[script 108] póliza 34160783 · vence 2025-11-01', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('70501863-f71a-4876-8ed1-82d3b9a6d86b', '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', 5, '2025-12-01', '2025-12-01', 576306, 'pendiente', '[script 108] póliza 34160783 · vence 2025-12-01', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('83fedb2a-1198-41ed-a97e-75c3c1c81b4b', '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', 6, '2026-01-01', '2026-01-01', 438187.22, 'pendiente', '[script 108] póliza 34160783 · vence 2026-01-01', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('a6fd86dd-1b2e-437d-a511-7cfcf8c87b15', '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', 7, '2026-01-29', '2026-01-29', 572972, 'pendiente', '[script 108] póliza 34160783 · vence 2026-01-29', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('4e9d8172-1948-4070-ae87-3e4d7bd4cfc8', '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', 8, '2026-03-01', '2026-03-01', 572972, 'pendiente', '[script 108] póliza 34160783 · vence 2026-03-01', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('764c77db-1584-4b9f-86fc-1c7854c54d9a', '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', 9, '2026-04-01', '2026-04-01', 572972, 'pendiente', '[script 108] póliza 34160783 · vence 2026-04-01', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('7681aab0-c820-4742-bc6d-a28a3770cb29', '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', 10, '2026-05-01', '2026-05-01', 572972, 'pendiente', '[script 108] póliza 34160783 · vence 2026-05-01', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('8542993a-993a-4e5a-b61e-6eecb0244cfa', '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', 11, '2026-06-01', '2026-06-01', 572972, 'pendiente', '[script 108] póliza 34160783 · vence 2026-06-01', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('742a83bb-2a1e-4213-a655-2338bbe2e2d5', '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', 12, '2026-07-01', '2026-07-01', 572974.03, 'pendiente', '[script 108] póliza 34160783 · vence 2026-07-01', 'egreso', 'banco', false);
insert into public.egresos_sin_factura (id, template_master_id, nombre_referencia, proveedor, cuit_quien_cobra, nombre_quien_cobra, categ, centro_costo, responsable, responsable_interno, cuotas, tipo_fecha, codigo_contable, codigo_interno, activo, "año", cuenta_agrupadora, tipo_template, tipo, periodicidad, aplica_generacion, solo_conciliacion, observaciones_template)
values ('897a8b25-ccfc-4e3b-8cbd-20c418335d29', 'b88c61a4-f2fb-4ffe-9814-d21f7864a978', 'Seguro Flota — póliza 35881289', 'Federacion Patronal SAU', '33707366589', 'Federacion Patronal SAU', 'Seguros Estructura', 'Estructura', 'MSA', 'MSA/MA/JMS', 6, 'Estimada', 'No Lleva', 'Desglosar', true, '26/27', 'Seguros', 'fijo', 'egreso', 'bianual', false, false,
  '[script 108] A-FEAT-1385 — generado desde la póliza 35881289: cada cuota es lo que espera el banco en ese vencimiento (endosos sumados, notas de crédito compensadas).');
update public.polizas_seguro set template_id = '897a8b25-ccfc-4e3b-8cbd-20c418335d29' where id = 'f016a859-6c33-4361-9fba-dfdaed416916';
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('c36c6a83-5b74-4c36-bdc1-0675d455df79', '897a8b25-ccfc-4e3b-8cbd-20c418335d29', 1, '2026-08-01', '2026-08-01', 556094, 'pendiente', '[script 108] póliza 35881289 · vence 2026-08-01', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('c959a9d0-c108-4a52-a6a1-86ef434c05ac', '897a8b25-ccfc-4e3b-8cbd-20c418335d29', 2, '2026-09-01', '2026-09-01', 556094, 'pendiente', '[script 108] póliza 35881289 · vence 2026-09-01', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('9c843819-6476-4d9f-9907-e0b3731ecdbc', '897a8b25-ccfc-4e3b-8cbd-20c418335d29', 3, '2026-10-01', '2026-10-01', 556094, 'pendiente', '[script 108] póliza 35881289 · vence 2026-10-01', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('1c862c7c-5525-4f83-a610-66381701f791', '897a8b25-ccfc-4e3b-8cbd-20c418335d29', 4, '2026-11-01', '2026-11-01', 556094, 'pendiente', '[script 108] póliza 35881289 · vence 2026-11-01', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('f8a2705b-8c51-4349-bbae-9812eea6ca5a', '897a8b25-ccfc-4e3b-8cbd-20c418335d29', 5, '2026-12-01', '2026-12-01', 556094, 'pendiente', '[script 108] póliza 35881289 · vence 2026-12-01', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('206b4db2-ce8f-4c56-8117-d2f7bd018a1c', '897a8b25-ccfc-4e3b-8cbd-20c418335d29', 6, '2027-01-01', '2027-01-01', 556094.09, 'pendiente', '[script 108] póliza 35881289 · vence 2027-01-01', 'egreso', 'banco', false);
insert into public.egresos_sin_factura (id, template_master_id, nombre_referencia, proveedor, cuit_quien_cobra, nombre_quien_cobra, categ, centro_costo, responsable, responsable_interno, cuotas, tipo_fecha, codigo_contable, codigo_interno, activo, "año", cuenta_agrupadora, tipo_template, tipo, periodicidad, aplica_generacion, solo_conciliacion, observaciones_template)
values ('2925ae45-8555-4f5c-991a-6a9701f02b12', 'b88c61a4-f2fb-4ffe-9814-d21f7864a978', 'Seguro Vida Colectivo — póliza 644709', 'Federacion Patronal SAU', '33707366589', 'Federacion Patronal SAU', 'Seguros Estructura', 'Estructura', 'MSA', 'MSA', 2, 'Estimada', 'No Lleva', 'No Lleva', true, '24/25', 'Seguros', 'fijo', 'egreso', 'bianual', false, false,
  '[script 108] A-FEAT-1385 — generado desde la póliza 644709: cada cuota es lo que espera el banco en ese vencimiento (endosos sumados, notas de crédito compensadas).');
update public.polizas_seguro set template_id = '2925ae45-8555-4f5c-991a-6a9701f02b12' where id = 'b5512633-f3ba-42e7-a552-f3e6327f3240';
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('35209d54-c2eb-4132-8a22-daba752537b4', '2925ae45-8555-4f5c-991a-6a9701f02b12', 1, '2025-07-10', '2025-07-10', 0, 'desactivado', '[script 108] póliza 644709 · vence 2025-07-10 · compensada con NC: no se debita', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('752c919f-cf09-43c0-9edd-7d597872e089', '2925ae45-8555-4f5c-991a-6a9701f02b12', 2, '2025-08-10', '2025-08-10', 6598.75, 'pendiente', '[script 108] póliza 644709 · vence 2025-08-10 · cuota 21574.03 menos NC', 'egreso', 'banco', false);
insert into public.egresos_sin_factura (id, template_master_id, nombre_referencia, proveedor, cuit_quien_cobra, nombre_quien_cobra, categ, centro_costo, responsable, responsable_interno, cuotas, tipo_fecha, codigo_contable, codigo_interno, activo, "año", cuenta_agrupadora, tipo_template, tipo, periodicidad, aplica_generacion, solo_conciliacion, observaciones_template)
values ('0f648b96-637c-4cbe-b9da-48b7a6e99d90', 'b88c61a4-f2fb-4ffe-9814-d21f7864a978', 'Seguro Vida Colectivo — póliza 670821', 'Federacion Patronal SAU', '33707366589', 'Federacion Patronal SAU', 'Seguros Estructura', 'Estructura', 'MSA', 'MSA', 3, 'Estimada', 'No Lleva', 'No Lleva', true, '25/26', 'Seguros', 'fijo', 'egreso', 'bianual', false, false,
  '[script 108] A-FEAT-1385 — generado desde la póliza 670821: cada cuota es lo que espera el banco en ese vencimiento (endosos sumados, notas de crédito compensadas).');
update public.polizas_seguro set template_id = '0f648b96-637c-4cbe-b9da-48b7a6e99d90' where id = '2f4705b4-5d60-4426-88f3-462b68f0d0bf';
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('55f71d8d-4c32-4794-b8f6-060b4c959b8c', '0f648b96-637c-4cbe-b9da-48b7a6e99d90', 1, '2025-09-10', '2025-09-10', 245038.54, 'pendiente', '[script 108] póliza 670821 · vence 2025-09-10', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('2bcfcc10-7f9c-47fd-8ca4-513333d154f6', '0f648b96-637c-4cbe-b9da-48b7a6e99d90', 2, '2026-02-10', '2026-02-10', 0, 'desactivado', '[script 108] póliza 670821 · vence 2026-02-10 · compensada con NC: no se debita', 'egreso', 'banco', false);
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('c24920a3-4cc1-4c40-9560-13576f886b0c', '0f648b96-637c-4cbe-b9da-48b7a6e99d90', 3, '2026-06-10', '2026-06-10', 0, 'desactivado', '[script 108] póliza 670821 · vence 2026-06-10 · compensada con NC: no se debita', 'egreso', 'banco', false);
insert into public.egresos_sin_factura (id, template_master_id, nombre_referencia, proveedor, cuit_quien_cobra, nombre_quien_cobra, categ, centro_costo, responsable, responsable_interno, cuotas, tipo_fecha, codigo_contable, codigo_interno, activo, "año", cuenta_agrupadora, tipo_template, tipo, periodicidad, aplica_generacion, solo_conciliacion, observaciones_template)
values ('4dbef0d2-9d19-4f9d-a208-7793412cbbf5', 'b88c61a4-f2fb-4ffe-9814-d21f7864a978', 'Seguro Vida Colectivo — póliza 698548', 'Federacion Patronal SAU', '33707366589', 'Federacion Patronal SAU', 'Seguros Estructura', 'Estructura', 'MSA', 'MSA', 1, 'Estimada', 'No Lleva', 'No Lleva', true, '26/27', 'Seguros', 'fijo', 'egreso', 'bianual', false, false,
  '[script 108] A-FEAT-1385 — generado desde la póliza 698548: cada cuota es lo que espera el banco en ese vencimiento (endosos sumados, notas de crédito compensadas).');
update public.polizas_seguro set template_id = '4dbef0d2-9d19-4f9d-a208-7793412cbbf5' where id = '8318c6e3-548e-4826-b3d1-8e7cac0ddc28';
insert into public.cuotas_egresos_sin_factura (id, egreso_id, numero_cuota, fecha_vencimiento, fecha_estimada, monto, estado, descripcion, tipo_movimiento, medio_pago, visible_contable)
values ('55429027-2bf5-4f08-b869-8f0c58cfd899', '4dbef0d2-9d19-4f9d-a208-7793412cbbf5', 1, '2026-09-10', '2026-09-10', 287650.23, 'pendiente', '[script 108] póliza 698548 · vence 2026-09-10', 'egreso', 'banco', false);
update public.msa_galicia set template_id = '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', template_cuota_id = 'c602ac15-04d4-4e29-bf74-f17bb7d3362a' where id = '2eb8f02c-33cf-463d-aa61-9b8ebdcc7d1a';  -- 2025-08-04 576306 historico
update public.msa_galicia set template_id = '2925ae45-8555-4f5c-991a-6a9701f02b12', template_cuota_id = '752c919f-cf09-43c0-9edd-7d597872e089' where id = 'f3e6e467-0a0a-4e4e-939a-96890524a9b4';  -- 2025-08-11 6598.75 historico
update public.msa_galicia set template_id = '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', template_cuota_id = '50c44e84-7077-45e1-97a1-35cabbaa3c40' where id = 'e635d1e8-aae1-4382-821f-79e67da1f7c0';  -- 2025-09-02 576306 historico
update public.msa_galicia set template_id = '0f648b96-637c-4cbe-b9da-48b7a6e99d90', template_cuota_id = '55f71d8d-4c32-4794-b8f6-060b4c959b8c' where id = 'a69b09b8-08eb-4956-b0cc-8be24e741583';  -- 2025-09-10 245038.54 historico
update public.msa_galicia set template_id = '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', template_cuota_id = '145e3138-a5be-4d73-b20d-5103b682ebfa' where id = '71eea762-b6fd-437b-9d94-cb77d3c0eef6';  -- 2025-10-02 576306 historico
update public.msa_galicia set template_id = '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', template_cuota_id = 'e31173d9-83d5-4e59-8c82-8c282767f3cd' where id = 'cdf84ff3-beb9-4b39-9d43-d5f808d3f66a';  -- 2025-11-04 576306 historico
update public.msa_galicia set template_id = '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', template_cuota_id = '70501863-f71a-4876-8ed1-82d3b9a6d86b' where id = '23e5b3eb-be30-4e50-9947-56b2f9005448';  -- 2025-12-02 576306 historico
update public.msa_galicia set template_id = '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', template_cuota_id = '83fedb2a-1198-41ed-a97e-75c3c1c81b4b' where id = '0316de07-9950-45d8-83f3-42f08891a90e';  -- 2026-01-05 438187.22 historico
update public.msa_galicia set template_id = '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', template_cuota_id = 'a6fd86dd-1b2e-437d-a511-7cfcf8c87b15' where id = '3a9da017-5471-4735-b396-95275b2037db';  -- 2026-02-03 572972 conciliado
update public.msa_galicia set template_id = 'a70805ab-dd68-4a23-a5ae-a2101fd015ac', template_cuota_id = '6cfd4602-c410-4f7d-97c5-f535576b8203' where id = '94ca66b7-02f4-4b2a-9640-dd0e35394c06';  -- 2026-02-10 15740 conciliado
update public.msa_galicia set template_id = '3bf0c7f0-b1f5-453e-87c6-a5305e350795', template_cuota_id = '3dc92466-ddc1-4fca-8151-2b5903d8fcb0' where id = 'f77a629f-4a7f-4c13-8d76-194e16353a1e';  -- 2026-02-19 11179 conciliado
update public.msa_galicia set template_id = '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', template_cuota_id = '4e9d8172-1948-4070-ae87-3e4d7bd4cfc8' where id = '51ae7844-759a-4e8d-8d49-44afd8ecd135';  -- 2026-03-03 572972 conciliado
update public.msa_galicia set template_id = 'a70805ab-dd68-4a23-a5ae-a2101fd015ac', template_cuota_id = 'bb7ebfe1-6a0f-46e1-8df2-cb180ceb1ad7' where id = '91a991cb-e59c-49e7-8eb1-b58c6d45be5d';  -- 2026-03-06 48996 conciliado
update public.msa_galicia set template_id = '3bf0c7f0-b1f5-453e-87c6-a5305e350795', template_cuota_id = '30b1d919-d5d9-49e6-92eb-7429ac3858ae' where id = '7eda5a97-6e3d-41dd-894e-3e7a5057e893';  -- 2026-03-17 11179 conciliado
update public.msa_galicia set template_id = '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', template_cuota_id = '764c77db-1584-4b9f-86fc-1c7854c54d9a' where id = '90580456-ccaa-47b5-8860-5998d04db7c1';  -- 2026-04-06 572972 conciliado
update public.msa_galicia set template_id = 'a70805ab-dd68-4a23-a5ae-a2101fd015ac', template_cuota_id = '897ec160-ab63-4245-a88a-0deb4c9d3762' where id = 'a5e3f6bd-4028-4a1e-944d-ed1fd8c1301b';  -- 2026-04-06 48996 conciliado
update public.msa_galicia set template_id = '3bf0c7f0-b1f5-453e-87c6-a5305e350795', template_cuota_id = '7ca35a5e-3953-45b3-8df7-9b05bd688844' where id = 'aaac5099-2b3e-47f1-b9e1-c3a9be1505ff';  -- 2026-04-17 11179 conciliado
update public.msa_galicia set template_id = '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', template_cuota_id = '7681aab0-c820-4742-bc6d-a28a3770cb29' where id = 'ba04985b-53a0-40c2-9248-ead1e32b47f4';  -- 2026-05-05 572972 conciliado
update public.msa_galicia set template_id = '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', template_cuota_id = '8542993a-993a-4e5a-b61e-6eecb0244cfa' where id = 'fe695491-2f76-4d5b-ad12-f202b3ee2d74';  -- 2026-06-02 572972 conciliado
update public.msa_galicia set template_id = '17e3e144-ee75-4e40-a3f1-5a485f5b75d5', template_cuota_id = '742a83bb-2a1e-4213-a655-2338bbe2e2d5' where id = '8ad9106a-5b87-48bb-909c-1f35104246c2';  -- 2026-07-02 571179.49 auditar
update public.msa_galicia set template_id = '897a8b25-ccfc-4e3b-8cbd-20c418335d29', template_cuota_id = 'c36c6a83-5b74-4c36-bdc1-0675d455df79' where id = 'b6186599-861c-46f6-a07c-07cb02cb3f7f';  -- 2026-08-04 556094 auditar
update public.msa_galicia set template_id = '897a8b25-ccfc-4e3b-8cbd-20c418335d29', template_cuota_id = 'c959a9d0-c108-4a52-a6a1-86ef434c05ac' where id = '2c1057d2-65c0-4386-b416-ff49f046d9ca';  -- 2026-09-02 556094 auditar
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = 'c602ac15-04d4-4e29-bf74-f17bb7d3362a';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = '752c919f-cf09-43c0-9edd-7d597872e089';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = '50c44e84-7077-45e1-97a1-35cabbaa3c40';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = '55f71d8d-4c32-4794-b8f6-060b4c959b8c';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = '145e3138-a5be-4d73-b20d-5103b682ebfa';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = 'e31173d9-83d5-4e59-8c82-8c282767f3cd';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = '70501863-f71a-4876-8ed1-82d3b9a6d86b';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = '83fedb2a-1198-41ed-a97e-75c3c1c81b4b';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = 'a6fd86dd-1b2e-437d-a511-7cfcf8c87b15';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = '6cfd4602-c410-4f7d-97c5-f535576b8203';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = '3dc92466-ddc1-4fca-8151-2b5903d8fcb0';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = '4e9d8172-1948-4070-ae87-3e4d7bd4cfc8';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = 'bb7ebfe1-6a0f-46e1-8df2-cb180ceb1ad7';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = '30b1d919-d5d9-49e6-92eb-7429ac3858ae';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = '764c77db-1584-4b9f-86fc-1c7854c54d9a';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = '897ec160-ab63-4245-a88a-0deb4c9d3762';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = '7ca35a5e-3953-45b3-8df7-9b05bd688844';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = '7681aab0-c820-4742-bc6d-a28a3770cb29';
update public.cuotas_egresos_sin_factura set estado = 'conciliado' where id = '8542993a-993a-4e5a-b61e-6eecb0244cfa';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = 'bbaae3d1-814a-4bb5-9feb-44dfd781a4a5';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = 'b8ecb190-9ccc-4507-afaa-3173a94c1c53';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '77e1b15a-d286-4ef4-a810-e7465801e440';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '53925398-9396-4073-9143-0ce7326cc10d';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '4ce7286c-a89a-40bb-86c5-b8019bf9270a';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '09e7f27d-e828-4060-be52-e343389bbacd';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '7874015e-1561-48a5-885b-bec242c52894';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '301e5c73-54d1-46e8-b38c-1054c1c01546';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '1bde2fc1-e0c6-4c04-a97d-8ecac9e6f790';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '928077b7-b59b-4103-9411-c94a5fd3dbb1';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '61ffe2ab-138e-41c3-9995-e7eb400a4d43';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = 'd5303fcd-9070-4c62-8aed-3884ed614bf0';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '15b92aff-8e92-4586-b10e-93440e06796e';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = 'b0d2f5f0-c132-48ae-8c59-09608de6bf7e';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = 'ae536706-b51d-4936-92f3-df47c44d60f0';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '488a6700-4cb9-4825-acc2-3e6e5fe5fd90';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '3e775063-ffdd-4f77-9cb9-4bcb35e4dd1c';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '35afa7cf-ef94-4356-b727-dae0c96c1305';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '151d8249-bb3a-4f58-88f8-d7b70253660b';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '91acdaed-6f3f-4953-9cfa-c84b309efcea';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '4519201a-ed0e-4b95-8cb8-f32a87021c94';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '38333d32-9266-4f21-8a6a-43c933fe870e';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '07e46756-d53f-4567-a66d-c92a1b39c17b';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = 'f1f5381f-4239-4fe9-b3de-c081c9717b5a';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = 'df96635c-51d2-42f4-a761-9233136e1158';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = 'caddfa1b-775c-48de-986e-a8893fc00697';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = 'a4a36f41-7b87-488b-b369-74e9e412a1d6';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '716e9c25-d5cf-48fc-8314-705fd2759f5d';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '797702ad-3a88-47a3-a64c-a856ed229024';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '0f4da45d-2279-4ab4-8b80-5a7eb809c111';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '1b7028a9-6500-4eaf-bf57-4776563b700d';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '0e25c28b-a666-413f-a60a-54f319891f6b';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '6c6ff120-5fb3-42dc-afe7-e3f53ea7a46f';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '4d13d006-3bd7-401e-b35a-53bf904f8fda';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = 'f18de2a0-9f82-41ff-9d57-fe2cbb08443a';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = 'c229466d-f652-48e9-9d19-48d040f3dc14';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '7a54da40-b980-4225-bd0f-7b84bdf321da';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = '78ec7719-2aca-46bf-853c-14f526b5ae73';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = coalesce(descripcion || ' · ', '') || '[script 108] reemplazada por el template de su póliza' where id = 'acf6b383-802d-4ad2-a912-2b50309c49c0';
update public.egresos_sin_factura set activo = false, observaciones_template = coalesce(observaciones_template || ' · ', '') || '[script 108] reemplazado por un template por póliza (A-FEAT-1385)' where id = '8f4fe57e-ad53-4ffa-81a5-8e5a08ea4a5c';
update public.egresos_sin_factura set activo = false, observaciones_template = coalesce(observaciones_template || ' · ', '') || '[script 108] reemplazado por un template por póliza (A-FEAT-1385)' where id = '7c097fda-f028-4f86-90bf-b99a43c113d4';
update public.egresos_sin_factura set activo = false, observaciones_template = coalesce(observaciones_template || ' · ', '') || '[script 108] reemplazado por un template por póliza (A-FEAT-1385)' where id = '0a2fa4d3-4258-4c19-9f65-09b3f477e5e1';
commit;
notify pgrst, 'reload schema';

-- Control (sólo lee)
select (select count(*) from public.egresos_sin_factura where observaciones_template like '[script 108]%') as templates,          -- 8
       (select count(*) from public.cuotas_egresos_sin_factura where descripcion like '[script 108] póliza%') as cuotas,          -- 60
       (select count(*) from public.polizas_seguro where template_id is not null) as polizas_con_template;                   -- 8
