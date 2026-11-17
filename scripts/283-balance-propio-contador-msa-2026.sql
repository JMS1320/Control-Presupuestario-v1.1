-- 283 · BALANCE PROPIO DE MSA AL 30/06/2026: LA VERSIÓN «CONTADOR» (DATOS)                                    A-FEAT-1629
-- JMS 17/11: «sí, ok con los dos renglones para E2» (la columna Contador al lado de la suya, con dos renglones nuevos).
--
-- De dónde sale: de las 107 cuentas del balance presentado, ya cargadas por el script 282 en public.balance_contador_cuentas.
-- Este script NO copia importes a mano: suma esas cuentas por renglón del balance propio (el mapa está abajo, por `orden`).
-- Sólo activo y pasivo (45 cuentas → 27 renglones); el patrimonio neto y los resultados no tienen renglón en el balance propio.
-- El pasivo va en positivo, como en la foto del 30/06/2025 (en la planilla del contador viene en negativo).
-- Dos renglones nuevos del catálogo (lib/balance/balance-propio.ts): `iva_credito_a_computar` y `rollos_fardos`.
-- Control (se verifica después de correr): activo 1.323.911.258,57 · pasivo 149.784.622,08 = los totales de la planilla.
--
-- Qué escribe: public.balance_foto_valores, 27 filas nuevas (foto MSA 2026-06-30, versión 'contador', origen 'planilla',
-- detalle con la marca «[script 283]»). La foto no tenía versión contador (verificado el 17/11: 33 filas, todas 'jms').
-- No toca la versión de JMS ni ninguna otra foto. Deshacer: 283-…-deshacer.sql.

begin;

insert into public.balance_foto_valores (foto_id, renglon, version, importe, origen, detalle)
select f.id, m.renglon, 'contador',
       sum(case when c.capitulo = 'PASIVO' then -c.saldo else c.saldo end),
       'planilla',
       '[script 283] Balance presentado por el contador: ' || string_agg(c.denominacion, ' + ' order by c.orden)
  from public.balance_fotos f
  join public.balance_contador_cuentas c on c.empresa = f.empresa and c.fecha_cierre = f.fecha_cierre and c.marca = '[script 282]'
  join (values
    (1, 'caja'), (2, 'caja_dolares'), (3, 'banco_santander'), (4, 'banco_provincia'), (5, 'banco_galicia'), (6, 'banco_galicia_usd'),
    (7, 'deudores_ventas'), (8, 'ret_ganancias'), (9, 'perc_ganancias'), (10, 'anticipos_proveedores'),
    (11, 'cuenta_socios'), (12, 'cuenta_socios'), (13, 'cuenta_socios'), (14, 'cuenta_socios'), (15, 'cuenta_socios'),
    (16, 'cuenta_socios'), (17, 'cuenta_socios'),
    (18, 'iva_saldo_tecnico'), (19, 'iva_libre_disponibilidad'), (20, 'impuesto_cheque'), (21, 'iva_credito_a_computar'),
    (22, 'saldo_favor_ganancias'), (23, 'equinos'),
    (24, 'bienes_uso_neto'), (25, 'bienes_uso_neto'), (26, 'bienes_uso_neto'), (27, 'bienes_uso_neto'), (28, 'bienes_uso_neto'),
    (29, 'bienes_uso_neto'), (30, 'bienes_uso_neto'), (31, 'bienes_uso_neto'), (32, 'bienes_uso_neto'), (33, 'bienes_uso_neto'),
    (34, 'bienes_uso_neto'), (35, 'bienes_uso_neto'),
    (36, 'stock_cria'), (37, 'insumos_ganaderos'), (38, 'rollos_fardos'),
    (39, 'proveedores'), (40, 'tarjetas'), (41, 'tarjetas'), (42, 'cargas_sociales'), (43, 'cuota_solidaria'),
    (44, 'ganancias_a_pagar'), (45, 'impuesto_diferido')
  ) as m(orden, renglon) on m.orden = c.orden
 where f.empresa = 'MSA' and f.fecha_cierre = date '2026-06-30'
 group by f.id, m.renglon;

commit;
