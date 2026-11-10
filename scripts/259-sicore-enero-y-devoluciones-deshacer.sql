-- Deshace el 259 (259-foto-antes.json).
begin;
update public.msa_galicia set template_id = null, template_cuota_id = null, categ = null, nota_operador = '📜 Histórico jul25-ene26 — tu planilla: CATEG IMP' where id = 'b5ebe508-dc7c-4ed6-a86a-affe6a0f7a0f' and nota_operador like '%[script 259]';
update public.cuotas_egresos_sin_factura set monto = 0, descripcion = null where id = 'fcce0466-0168-4fe2-b8aa-1067274949e6' and descripcion like '%[script 259]';
update public.msa_galicia m set estado = 'historico', nota_operador = v.nota from (values
  ('c472c3f5-5011-4c9c-92eb-8b10f110ae45'::uuid, '📜 Histórico jul25-ene26 — tu planilla: CATEG VET'), ('f70e5994-a67e-4fdd-b25e-efc1e08ff20b'::uuid, '📜 Histórico jul25-ene26 — tu planilla: CATEG ALIM'),
  ('d6ab924b-4d1d-4db7-889d-3c8613da8d16'::uuid, '📜 Histórico jul25-ene26 — tu planilla: CATEG AUTO'), ('1da54875-0c2e-4203-8da3-14c0838dbeb4'::uuid, '📜 Histórico jul25-ene26 — tu planilla: CATEG INSTAL'),
  ('2a4276b4-8711-4924-9b8c-5ea8b0fa72d6'::uuid, '📜 Histórico jul25-ene26 — tu planilla: CATEG FIJOS GRAL'), ('32a827e9-989c-46b3-9878-7d35c4e244f6'::uuid, '📜 Histórico jul25-ene26 — tu planilla: CATEG ASES')) as v(id, nota)
 where m.id = v.id and m.nota_operador like '%[script 259]';
commit;
