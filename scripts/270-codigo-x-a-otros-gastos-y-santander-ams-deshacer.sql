-- Deshace el 270 (270-foto-antes.json): los movimientos vuelven exactamente a como estaban; borra SÓLO las 8 cuotas que creó (ids fijos …-c07170000270).
begin;
update public.msa_galicia set template_id = null, template_cuota_id = null, categ = null, nro_cuenta = null, contable = 'X',
  nota_operador = '📜 Histórico jul25-ene26 — tu planilla: CATEG CAB · Contable X'
  where id in ('11df178a-53fa-49ca-8574-66924b4926c3', '9afcb13e-d2d2-4445-acaf-eb25c00f6ab0', 'dad6e1cc-8761-46cf-8446-c123b6c455ac', '9b65f7b8-0d61-4e98-a752-7063751796ec',
               '2f52f40e-43f4-42af-87ac-f76e429abd17', '6a0b5350-4782-4797-94f9-6070acb91479') and nota_operador like '%[script 270]';
update public.msa_galicia set template_id = null, template_cuota_id = null, categ = null, nro_cuenta = null, contable = 'X',
  nota_operador = '📜 Histórico jul25-ene26 — tu planilla: CATEG AUTO · Contable x'
  where id in ('c355ad03-2d4e-4a6f-9369-aed42f272385', '5eb1fe04-448c-4e5b-ada7-60c7cc5ee48d') and nota_operador like '%[script 270]';
delete from public.cuotas_egresos_sin_factura where id in ('7a2c1e0e-2701-4c0b-9b1a-c07170000270', '7a2c1e0e-2702-4c0b-9b1a-c07170000270', '7a2c1e0e-2703-4c0b-9b1a-c07170000270',
  '7a2c1e0e-2704-4c0b-9b1a-c07170000270', '7a2c1e0e-2705-4c0b-9b1a-c07170000270', '7a2c1e0e-2706-4c0b-9b1a-c07170000270', '7a2c1e0e-2707-4c0b-9b1a-c07170000270',
  '7a2c1e0e-2708-4c0b-9b1a-c07170000270');
update msa.santander set contable = null, nota_operador = null
  where id in ('7d5fae13-6d72-4451-ade4-02f72ee2eca5', 'a394d55b-9938-4cc4-946b-1ae07bb3c709') and nota_operador like '%[script 270]';
commit;
