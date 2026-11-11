-- [script 265] A-DEC-1030 (OK de JMS 11/11: «1 ok»): 7 reglas nuevas de conciliación para el Galicia de MA.
-- Mismo molde que las de Consumos que ya tiene la cuenta (tipo otras, llena_template, sin códigos).
-- Los ids van fijos para que el deshacer borre SÓLO estas 7.
insert into public.reglas_conciliacion (id, orden, tipo, columna_busqueda, texto_buscar, tipo_match, categ, centro_costo, detalle, activo, llena_template, cuenta_bancaria_id, template_id) values
 ('6245d79c-7f85-457a-844c-949485da24ef', 26, 'otras', 'nombre', 'NEWGARDEN',          'contiene', 'Consumos', null, 'New Garden',         true, true, 'ma_galicia', '79c4229e-288c-40a1-98a0-da24482b3eeb'),
 ('f50f9c14-e8d7-4e4f-990f-e4da06398e7f', 27, 'otras', 'nombre', 'CARNICERIACOVA',     'contiene', 'Consumos', null, 'Carnicería Cova',    true, true, 'ma_galicia', '79c4229e-288c-40a1-98a0-da24482b3eeb'),
 ('a7bbdaa7-6f46-4eed-94f6-2186cccbc21d', 28, 'otras', 'nombre', 'PICCOLO POSITANO',   'contiene', 'Consumos', null, 'Piccolo Positano',   true, true, 'ma_galicia', '79c4229e-288c-40a1-98a0-da24482b3eeb'),
 ('7024173f-c4d5-4b06-bd12-adff42244310', 29, 'otras', 'nombre', 'ELECTROSOL',         'contiene', 'Consumos', null, 'Electrosol',         true, true, 'ma_galicia', '79c4229e-288c-40a1-98a0-da24482b3eeb'),
 ('a93825c5-d106-42d2-9240-e9bd86fcf122', 30, 'otras', 'nombre', 'HAKUNA',             'contiene', 'Consumos', null, 'Hakuna',             true, true, 'ma_galicia', '79c4229e-288c-40a1-98a0-da24482b3eeb'),
 ('bb5e79a6-d367-4531-9e30-0cb395b105de', 31, 'otras', 'descripcion', 'PROMOCION GALICIA', 'contiene', 'Promocion Galicia', null, 'Reintegro promoción Galicia', true, true, 'ma_galicia', 'a229c374-a166-4818-a5eb-118af9213506'),
 ('03842d14-05af-4b74-a6b5-98296aba769b', 32, 'otras', 'nombre', 'METROGAS',           'contiene', 'GAS',      null, 'Metrogas Libertad',  true, true, 'ma_galicia', '3c7911fd-8cc9-4df7-974f-d8fc3adf8eec');
