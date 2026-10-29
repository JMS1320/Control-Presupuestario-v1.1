-- Deshace scripts/130-federacion-conciliar-7.mts: deja los 7 débitos y sus cuotas como estaban el 29/10/2026.
begin;

update public.msa_galicia set template_id = null, template_cuota_id = null, estado = 'pendiente', categ = 'INVALIDA:'
where id in (
  'cf12f160-f03d-4847-a08b-11a48a28a443', '870e7113-ad05-49bc-baab-3b2529f1a13b', '09c0758e-ccac-4ded-bbaf-4c7626eae21d',
  'b90b4f2f-21b0-46cb-823a-0cebd7026a70', 'f09ab775-dd62-4b25-ac23-47ce91c8173e', 'a3b8af66-115b-430a-8ae0-879c3a39435c'
);

-- Vida 698548: vuelve a estar atado a la factura, en «auditar».
update public.msa_galicia set template_id = null, template_cuota_id = null, estado = 'auditar', categ = 'SEGUROS ESTRUCTURA',
  comprobante_arca_id = '12e9a096-cb64-47a7-a9bf-49a8a30f25e1'
where id = 'd73e929c-ad71-46cd-a91a-aba2d9615013';

update public.cuotas_egresos_sin_factura set estado = 'pendiente'
where id in (
  'be00908e-a6d9-4016-9d7b-fdbed6a7b581', '7ee41faa-4c09-412b-bf74-f06b83253baf', '3a705643-4856-4379-8646-ce395e4f506a',
  '7f1707b9-3681-441f-9469-abf4ac2e5d6d', 'fb44f160-c5c1-42c0-ac24-0f2de3ad28ce', '67015248-4959-4085-b234-876e9dfa62bd',
  '55429027-2bf5-4f08-b869-8f0c58cfd899'
);

commit;
