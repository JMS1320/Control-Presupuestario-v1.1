-- 74 · El extracto de echeqs con las columnas del ESTÁNDAR de registro   A-FEAT-1230 · 2026-10-03
--
-- El usuario lo vio al abrirlo: *«no es el formato standard que dijimos»*. La forma de caja no trae
-- Proveedor ni Comprobante, así que el generador metía esos datos en el detalle («Cobro de 11-75880»),
-- que es justo lo que la regla del detalle prohíbe (MODULO_CONCILIACION § 30.9.6 D).
-- Se suman las dos columnas del estándar, con el mismo nombre que en msa_galicia.
-- No toca filas, permisos ni RLS. Avisado a Javier antes. 🔙 Deshacer: drop de las dos columnas.

alter table msa.echeqs_terceros
  add column if not exists proveedor_nombre text,
  add column if not exists comprobantes_pagados text;

notify pgrst, 'reload schema';
