-- 294 DESHACER · vuelve las dos vistas del presupuesto a su definición del 25/11 (imp_total sin convertir).
-- Sólo reemplaza las vistas que tocó el 294; no borra nada.

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
            COALESCE(c.imp_total, (0)::numeric) AS "coalesce"
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
            COALESCE(c.imp_total, (0)::numeric) AS "coalesce"
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
