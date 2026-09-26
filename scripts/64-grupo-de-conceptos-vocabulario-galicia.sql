-- ─────────────────────────────────────────────────────────────────────────────
-- grupo_de_conceptos — pasar Caja de Ahorro al vocabulario del Galicia
--
-- A-DEC-31, 2026-09-25. Decidido con el usuario después de medir qué usa MSA.
--
-- EL HALLAZGO
--   En **cuenta corriente el banco ya manda el grupo** en su Excel, con su propio código
--   (`000907 - Transferencias`). En **Caja de Ahorro no lo manda** —viene todo en una celda— y se
--   cargó a mano, con un vocabulario inventado: 20 valores para 10 conceptos, con `Servicios` y
--   `Servicios Pago`, `Tarjetas` y `Tarjeta Debito` conviviendo.
--
--   🔑 Resultado: **el mismo hecho tenía dos nombres.** Una compra con débito era «Tarjeta Debito»
--   en MA y `000905 - Extracciones` en MSA — imposible de comparar o sumar entre cuentas.
--
-- EL MAPEO NO ES CRITERIO NUESTRO
--   Sale de lo que el propio banco hace con **el mismo nombre de tipo** en MSA. Por eso
--   `COMPRA DEBITO` va a **Extracciones** y no a Pagos, aunque suene al revés.
--
-- ⚠️ YA APLICADO el 2026-09-25 vía MCP, autorizado por el usuario. Toca **reglas**, no movimientos.
--    La lista cerrada vive en `lib/extractos/parseo-movimiento.ts` → `GRUPOS_GALICIA`.
-- ─────────────────────────────────────────────────────────────────────────────

with mapa(tipo, grupo) as (values
  ('DEB. AUTOM. DE SERV.','000083 - Pagos'),
  ('PAGO DE SERVICIOS','000083 - Pagos'),
  ('PAGO TARJETA VISA','000083 - Pagos'),
  ('COMPRA DEBITO','000905 - Extracciones'),
  ('EXTRACCION EN AUTOSERVICIO','000905 - Extracciones'),
  ('EXTRACCION CAJERO','000905 - Extracciones'),
  ('TRANSFERENCIA A TERCEROS','000907 - Transferencias'),
  ('TRANSFERENCIAS CASH PROVEEDORES','000907 - Transferencias'),
  ('TRANSFERENCIA DE CUENTA PROPIA','000907 - Transferencias'),
  ('SERVICIO PAGO A PROVEEDORES','000909 - Pago Proveedores'),
  ('SUSCRIPCION FIMA','000916 - Inversiones'),
  ('INTERES CAPITALIZADO','000814 - Intereses'),
  ('IVA','000901 - Impuestos'),
  ('COM. CAJA DE SEGURIDAD','000808 - Comisiones')
)
update public.config_parseo_extracto c
   set grupo_de_conceptos = m.grupo
  from mapa m
 where upper(c.tipo_movimiento) = m.tipo
   and c.activo
   and c.grupo_de_conceptos is distinct from m.grupo;

-- Control: ningún grupo activo fuera de la lista del banco
select cuenta_bancaria_id, grupo_de_conceptos, count(*)
from public.config_parseo_extracto
where activo
group by 1,2 order by 1,2;
