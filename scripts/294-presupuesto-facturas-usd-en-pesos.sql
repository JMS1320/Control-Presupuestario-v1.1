-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 294 · P-06 — el PRESUPUESTO toma las facturas en DÓLARES en pesos (A-BUG-1659)
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- JMS 25/11: «corregí el tema del tratamiento de las facturas en dólares del presupuesto».
--
-- 🧨 El error: `msa.comprobantes_arca.imp_total` de una factura en dólares está EN DÓLARES, y las dos
-- vistas que arman la historia de cada cuenta para el presupuesto lo sumaban como pesos. Al 25/11: 4
-- facturas (USD 6.660,07) entraban como $ 6.660 en vez de $ 9.268.952,50 (cuentas 42307, 421113, 42321).
--
-- 🔑 Criterio: el MISMO que el libro diario (A-BUG-1316, lib/balance/libro-diario.ts → desdeArca): la
-- cotización de la propia factura (`tipo_cambio`), la que informa ARCA y usa el subdiario. Es historia
-- DEVENGADA (por mes contable), no lo pagado: por eso no se usa el TC del pago.
-- Moneda en pesos = '', '$', 'PES', 'ARS', 'PESOS' (igual que esMonedaExtranjera, lib/pagos/moneda-factura.ts).
--
-- Sólo cambia la expresión del importe de la rama `comprobantes_arca`. `comprobantes_historico` viene del
-- libro IVA presentado, ya en pesos (no tiene moneda). `presupuesto_historia_canales` no usa imp_total.
-- `create or replace view` conserva los GRANT. Deshacer: 294-presupuesto-facturas-usd-en-pesos-deshacer.sql
-- ════════════════════════════════════════════════════════════════════════════════════════════

create or replace view public.presupuesto_historia_cuentas as
 WITH maestro AS (
         SELECT upper(TRIM(BOTH FROM cuentas_contables.cuenta_contable)) AS nombre,
            min(cuentas_contables.nro_cuenta) AS nro
           FROM cuentas_contables
          WHERE (cuentas_contables.nro_cuenta IS NOT NULL)
          GROUP BY (upper(TRIM(BOTH FROM cuentas_contables.cuenta_contable)))
        ), unificado AS (
         SELECT h.nro_cuenta,
            h.anio_contable AS anio,
            h.mes_contable AS mes,
            h.nro_doc_emisor AS cuit,
            COALESCE(h.imp_total, (0)::numeric) AS monto
           FROM msa.comprobantes_historico h
          WHERE ((h.anio_contable IS NOT NULL) AND (h.mes_contable IS NOT NULL))
        UNION ALL
         SELECT COALESCE(c.nro_cuenta, m.nro) AS "coalesce",
            c."año_contable",
            c.mes_contable,
            c.cuit,
            -- 💵 294: en dólares → × la cotización de la factura
            CASE WHEN upper(TRIM(BOTH FROM COALESCE(c.moneda, ''))) IN ('', '$', 'PES', 'ARS', 'PESOS')
                 THEN COALESCE(c.imp_total, (0)::numeric)
                 ELSE COALESCE(c.imp_total, (0)::numeric) * COALESCE(NULLIF(c.tipo_cambio, 0), (1)::numeric)
            END AS "coalesce"
           FROM (msa.comprobantes_arca c
             LEFT JOIN maestro m ON ((m.nombre = upper(TRIM(BOTH FROM c.cuenta_contable)))))
          WHERE ((c."año_contable" IS NOT NULL) AND (c.mes_contable IS NOT NULL) AND (((c."año_contable" * 12) + c.mes_contable) > ((2025 * 12) + 12)))
        )
 SELECT nro_cuenta,
    ( SELECT max(cc.cuenta_contable) AS max
           FROM cuentas_contables cc
          WHERE (cc.nro_cuenta = u.nro_cuenta)) AS cuenta_contable,
    anio,
    mes,
    (sum(monto))::numeric(16,2) AS monto,
    (count(*))::integer AS facturas,
    (count(DISTINCT cuit))::integer AS proveedores
   FROM unificado u
  WHERE (nro_cuenta IS NOT NULL)
  GROUP BY nro_cuenta, anio, mes;

create or replace view public.presupuesto_historia_cuenta_proveedor as
 WITH maestro AS (
         SELECT upper(TRIM(BOTH FROM cuentas_contables.cuenta_contable)) AS nombre,
            min(cuentas_contables.nro_cuenta) AS nro
           FROM cuentas_contables
          WHERE (cuentas_contables.nro_cuenta IS NOT NULL)
          GROUP BY (upper(TRIM(BOTH FROM cuentas_contables.cuenta_contable)))
        ), unificado AS (
         SELECT h.nro_cuenta,
            h.anio_contable AS anio,
            h.mes_contable AS mes,
            regexp_replace(h.nro_doc_emisor, '\D'::text, ''::text, 'g'::text) AS cuit,
            h.denominacion_emisor AS proveedor,
            COALESCE(h.imp_total, (0)::numeric) AS monto
           FROM msa.comprobantes_historico h
          WHERE ((h.anio_contable IS NOT NULL) AND (h.mes_contable IS NOT NULL))
        UNION ALL
         SELECT COALESCE(c.nro_cuenta, m.nro) AS "coalesce",
            c."año_contable",
            c.mes_contable,
            regexp_replace((COALESCE(c.cuit, ''::character varying))::text, '\D'::text, ''::text, 'g'::text) AS regexp_replace,
            c.denominacion_emisor,
            -- 💵 294: en dólares → × la cotización de la factura
            CASE WHEN upper(TRIM(BOTH FROM COALESCE(c.moneda, ''))) IN ('', '$', 'PES', 'ARS', 'PESOS')
                 THEN COALESCE(c.imp_total, (0)::numeric)
                 ELSE COALESCE(c.imp_total, (0)::numeric) * COALESCE(NULLIF(c.tipo_cambio, 0), (1)::numeric)
            END AS "coalesce"
           FROM (msa.comprobantes_arca c
             LEFT JOIN maestro m ON ((m.nombre = upper(TRIM(BOTH FROM c.cuenta_contable)))))
          WHERE ((c."año_contable" IS NOT NULL) AND (c.mes_contable IS NOT NULL) AND (((c."año_contable" * 12) + c.mes_contable) > ((2025 * 12) + 12)))
        )
 SELECT nro_cuenta,
    ( SELECT max(cc.cuenta_contable) AS max
           FROM cuentas_contables cc
          WHERE (cc.nro_cuenta = u.nro_cuenta)) AS cuenta_contable,
    cuit,
    max(proveedor) AS proveedor,
    anio,
    mes,
    (sum(monto))::numeric(16,2) AS monto,
    (count(*))::integer AS facturas
   FROM unificado u
  WHERE (nro_cuenta IS NOT NULL)
  GROUP BY nro_cuenta, cuit, anio, mes;
