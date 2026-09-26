-- ─────────────────────────────────────────────────────────────────────────────
-- PAM Caja de Ahorro — dar de baja las reglas de parseo de tipos que no existen
--
-- A-DAT-60, 2026-09-25. Lo detectó el usuario razonando: *«¿cómo es que tengamos reglas que cubren
-- 21 tipos si sólo tenemos 9? No deberían existir reglas fuera de los tipos»*.
--
-- QUÉ HABÍA
--   49 reglas, todas del 12/04/2026, todas genéricas (sin subtipo), para 21 tipos — entre ellos
--   `ACREDITACION SUELDO`, `EXTRACCION`, `DEPOSITO EN EFECTIVO` y uno llamado `*`. Los movimientos
--   de PAM son 25 y tienen 9 tipos, de los cuales sólo 2 tenían regla.
--
-- POR QUÉ MOLESTABAN
--   No son inofensivas: el día que entre un movimiento de alguno de esos tipos, una regla genérica
--   que cuenta renglones dispara y puede mandar el dato a la columna equivocada en silencio. Es
--   A-BUG-1200 esperando.
--
-- 🛑 SE DESACTIVAN, NO SE BORRAN
--   El motor (`cargarReglasParseo`) filtra `activo = true`, así que dejan de aplicarse; y la
--   pantalla también las filtra, así que dejan de verse. Pero **el dato no se destruye**: volver
--   atrás es una línea (abajo). Es § `CLAUDE.md` 🛑 Datos — migrar en vez de descartar.
--
-- ⚠️ YA APLICADO el 2026-09-25 vía MCP, autorizado por el usuario. Resultado: 43 desactivadas
--    (19 tipos), 6 siguen activas (`IVA` y `DEB. AUTOM. DE SERV.`, los 2 que sí existen).
-- ─────────────────────────────────────────────────────────────────────────────

with tipos_reales as (
  select distinct upper(split_part(replace(concepto, E'\r', ''), E'\n', 1)) as tipo
  from public.pam_galicia
  where concepto is not null and concepto <> ''
)
update public.config_parseo_extracto
   set activo = false
 where cuenta_bancaria_id = 'pam_galicia'
   and activo
   and upper(tipo_movimiento) not in (select tipo from tipos_reales);

-- Control
select activo, count(*) as reglas, count(distinct tipo_movimiento) as tipos
from public.config_parseo_extracto
where cuenta_bancaria_id = 'pam_galicia'
group by activo;

-- ↩️ PARA DESHACER (recupera las 43 tal como estaban):
-- update public.config_parseo_extracto
--    set activo = true
--  where cuenta_bancaria_id = 'pam_galicia' and not activo;
