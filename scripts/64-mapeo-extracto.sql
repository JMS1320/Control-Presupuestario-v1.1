-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 64 · Extracto Bancario, mapeado a nivel sección            A-SEC-10 · 2026-09-24
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Antes de esto, NINGUNA tabla de Extracto estaba mapeada: caían en el default («si tenés rol,
-- escribís»), así que **un rol con sólo Productivo podía escribir en el extracto bancario**.
--
-- A nivel SECCIÓN y no por pestaña, por el mismo motivo que `productivo`: las tablas de
-- movimientos las tocan varias pestañas (Movimientos las edita, Conciliación las concilia,
-- Importar las crea) y atribuirlas a una sola sería inventar.
--
-- ⚠️ `msa.cheques` QUEDA AFUERA a propósito: la escribe `vista-facturas-arca.tsx`, que es
--    **Egresos**. Mapearla acá habría roto esa pantalla — es el mismo error de «una tabla, un
--    recurso» que arregló `scripts/63`, y se evitó midiendo quién escribe antes de mapear.
--
-- Recordar que desde `scripts/63` el mapeo gobierna **sólo la escritura**: Cash Flow y Sueldos
-- siguen leyendo `caja_general` sin tener la sección Extracto.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo) values
  -- Movimientos de cada cuenta bancaria
  ('public', 'msa_galicia',             'extracto', 'Movimientos MSA Galicia.'),
  ('public', 'pam_galicia',             'extracto', 'Movimientos PAM Galicia CA.'),
  ('public', 'pam_galicia_cc',          'extracto', 'Movimientos PAM Galicia CC.'),
  ('ma',     'ma_galicia',              'extracto', 'Movimientos MA Galicia.'),
  -- Cajas
  ('msa',    'caja_general',            'extracto', 'Caja General MSA. La LEEN Sueldos y Cash Flow; desde scripts/63 la lectura queda abierta.'),
  ('msa',    'caja_ams',                'extracto', 'Caja AMS MSA.'),
  ('msa',    'caja_sigot',              'extracto', 'Caja Sigot MSA.'),
  -- Tarjetas
  ('msa',    'tarjeta_visa_business',   'extracto', 'VISA Business MSA.'),
  ('pam',    'tarjeta_visa',            'extracto', 'VISA PAM.'),
  ('ma',     'tarjeta_visa',            'extracto', 'VISA MA.'),
  -- Configuración de las pestañas de reglas
  ('public', 'config_parseo_extracto',  'extracto', 'La escribe configurador-reglas-parseo (pestaña Reglas de parseo).'),
  ('public', 'reglas_contable_interno', 'extracto', 'La escribe configurador-reglas-contable (pestaña Contable e interno).')
on conflict (schema_nombre, tabla) do nothing;

-- ── Control ──────────────────────────────────────────────────────────────────────────────────
-- Tiene que devolver 57 filas en total, con `extracto` = 12.
select recurso, count(*) as tablas
from public.recurso_tablas group by recurso order by 1;

-- Y que `cheques` NO esté (se excluyó a propósito): cero filas.
select * from public.recurso_tablas where tabla = 'cheques';

-- ── REVERT ───────────────────────────────────────────────────────────────────────────────────
-- delete from public.recurso_tablas where recurso = 'extracto';
