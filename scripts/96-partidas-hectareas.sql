-- 96 · HECTÁREAS DE LAS PARTIDAS, desde la planilla del usuario (A-FEAT-1320 punto 5 / A-FEAT-1201)
--
-- Pedido del usuario 2026-10-23: «sí, cargá las hectáreas de mi planilla en partidas».
-- Fuente: `- Comunicacion JMS Claude - Archivos/Inmobiliario/- INMOBILIARIO RED VIAL AUTOMOTOR 2026 - v2.xlsx`,
-- solapa INMOBILIARIO (has, partida, parcela); Quinta Rosello 1 y 2 de la solapa «has arrendadas».
-- Red Vial: `partida_red_vial` lleva el número con el que identifica la MUNICIPALIDAD (columna
-- «CUENTA» de la solapa RED VIAL: Tango Parra 1 → 52948), no la partida inmobiliaria — aclaración del
-- usuario 2026-10-23: «para la municipalidad se identifican con ese nro y no con la partida
-- inmobiliaria». Rojas (otro municipio) no tiene cuenta en la planilla → queda vacía.
-- Las Quintas: la solapa trae 50479 (16,6 ha) y 50481 (8,4 ha); se asignaron por hectáreas.
--
-- Por qué en `public.partidas` (A-DEC-36): es el maestro de la ficha eterna de la partida; las
-- boletas de ARBA (A-FEAT-1204) no traen hectáreas, así que éstas entran una sola vez a mano.
-- `campo` lleva el nombre que usan los templates («Tango Parra 1», «Casco»…): así el detalle de
-- inmobiliario lo encuentra por partida y el de Red Vial (sus templates no tienen partida) por nombre.
-- El nombre de la planilla queda en `observaciones`.
--
-- Diferencias que tiene la propia planilla entre solapas (se tomó la de INMOBILIARIO):
--   Ombú 104,33 (RED VIAL dice 103 y «Analisis Aumento» 103,88) · Entre Ríos 52,52 (RED VIAL 52,51)
--   · Tapera 3 18,68 (RED VIAL 18,67).
-- Sin hectáreas en la planilla (no se cargan): Lima (MA, 038-040142-8) y Lote Puerto (urbano).
--
-- Aditivo y find-or-create: inserta sólo las partidas que no existan (la tabla está vacía al 23/10).
-- No toca templates, cuotas ni ninguna otra tabla. Deshacer: 96-partidas-hectareas-deshacer.sql

insert into public.partidas (campo, establecimiento, parcela, partida_inmobiliario, partida_red_vial, has_totales, observaciones, activo)
select v.campo, v.establecimiento, v.parcela, v.partida, v.red_vial, v.has,
       'Planilla: ' || v.en_planilla || ' · [script 96] cargado 2026-10-23 desde INMOBILIARIO RED VIAL AUTOMOTOR 2026 - v2.xlsx', true
from (values
  -- MSA — Rojas
  ('Rojas',             'Rojas',          '1228 C', '090-016369-0', null,    245.17,  'LA CRIOLLA'),
  -- MSA — Nazarenas
  ('Tango Parra 1',     'Nazarenas',      '1191 W', '099-015883-5', '52948', 17.23,   'TANGO - E. PARRA'),
  ('Tango Parra 2',     'Nazarenas',      '1191 Y', '099-015885-1', '52950', 19.35,   'TANGO - E. PARRA'),
  ('Tango Prim Leboso', 'Nazarenas',      '1191 U', '099-015881-9', '52946', 17.23,   'TANGO - PRIM LEBOSO'),
  ('Cholo 1',           'Nazarenas',      '1191 H', '099-010611-8', '52937', 12.53,   'CHOLO PARRA'),
  ('Cholo 2',           'Nazarenas',      '1191 I', '099-012766-2', '52938', 12.31,   'CHOLO PARRA'),
  ('Porteria Nuevo',    'Nazarenas',      '1191 P', '099-015877-0', '52943', 17.23,   'PORTERIA NUEVO - BALLERINI'),
  ('Porteria Viejo',    'Nazarenas',      '1191 S', '099-015879-7', '52944', 17.23,   'PORTERIA VIEJO - CORMIO'),
  ('Sanchez',           'Nazarenas',      '1191 T', '099-015880-0', '52945', 17.56,   'SANCHEZ'),
  ('Anexo',             'Nazarenas',      '1146 B', '099-008368-1', '52819', 18.23,   'ANEXO - CAMARASA'),
  -- PAM — Nazarenas
  ('Casco',             'Nazarenas',      '1225',   '099-006595-0', '53017', 235.28,  'CASCO'),
  ('Tapera 1',          'Nazarenas',      '1191 V', '099-015882-7', '52947', 17.56,   'TAPERA'),
  ('Tapera 2',          'Nazarenas',      '1191 X', '099-015884-3', '52949', 17.56,   'TAPERA'),
  ('Tapera 3',          'Nazarenas',      '1191 Z', '099-015886-0', '52951', 18.68,   'TAPERA'),
  ('Ombu',              'Nazarenas',      '1191AB', '099-016666-8', '52627', 104.33,  'OMBU NUEVA PARTIDA'),
  ('Entre Rios',        'Nazarenas',      '1442 M', '099-025551-2', '61015', 52.52,   'ENTRE RIOS'),
  -- PAM — La Celina / San Pedro
  ('El Relincho',       'La Celina',      null,     '099-025089-8', '60782', 36.1881, 'El Relincho'),
  ('Quinta Rosello 1',  'Quinta Rosello', null,     '099-001854-5', '50479', 16.6053, 'SAN PEDRO QUINTA ROSELLO'),
  ('Quinta Rosello 2',  'Quinta Rosello', null,     '099-001846-4', '50481', 8.437,   'SAN PEDRO QUINTA ROSELLO')
) as v(campo, establecimiento, parcela, partida, red_vial, has, en_planilla)
where not exists (select 1 from public.partidas p where p.partida_inmobiliario = v.partida);

-- Control (sin escribir): 19 partidas · MSA 394,07 ha · PAM Nazarenas 445,93 ha · total 901,2304 ha
-- select count(*), sum(has_totales) from public.partidas where observaciones like '%[script 96]%';
--   → 19 · 901.2304
-- select sum(has_totales) from public.partidas where partida_inmobiliario in
--   ('090-016369-0','099-015883-5','099-015885-1','099-015881-9','099-010611-8','099-012766-2','099-015877-0','099-015879-7','099-015880-0','099-008368-1');
--   → 394.07 (TOTAL SM de la planilla)
