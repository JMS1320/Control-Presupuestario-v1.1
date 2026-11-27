-- [script 315] DATOS (columna nueva del 314) — qué insumo del stock come cada renglón de RACIÓN de la receta (A-FEAT-1663 stock paso 2).
-- Lo dijo JMS el 26/11 (S4): «Concentrado Novillo 35 10 = recría y engorde; Concentrado Terneros = creep»; el maíz es el Maíz Granel.
-- El silo de sorgo no tiene insumo en el stock (es propio): queda vacío. No cambia valores, precios ni dietas de la receta.
-- Antes de correr: la columna estaba vacía en todas las filas (es nueva). Deshacer: scripts/315-receta-insumo-del-stock-datos-deshacer.sql
begin;
update productivo.actividad_insumos set insumo_stock_id = 'a167aae2-687b-48a2-a673-f58cee565295'  -- Concentrado Terneros Recria
 where id = '34c05560-6bac-4df4-b7c3-9f89ca57a9c1';                                                -- Cría · Concentrado Creep Feeding
update productivo.actividad_insumos set insumo_stock_id = 'bf021076-bd4c-42ee-a61c-ddcd0823e947'  -- Concentrado Novillo 35 10
 where id in ('3dfaad83-17e9-4336-896d-6134a1ced07f',                                              -- Engorde · Concentrado
              'cf06a833-6b59-4241-8bba-761be5411542');                                              -- Recría · Concentrado
update productivo.actividad_insumos set insumo_stock_id = '6a3c2042-5b75-4c2a-9962-3e6e62b87be4'  -- Maíz Granel
 where id in ('102c1363-47e0-4c59-a360-3034806aa538',                                              -- Cría · Maiz Creep Feeding
              '08049507-0e67-4404-8879-f2a2861fbab2',                                              -- Engorde · Maíz (dieta con silo)
              'd44f987b-9862-4596-a7ef-e896305ea24b',                                              -- Engorde · Maíz (maíz y concentrado)
              'c93eb0d0-e88b-4e24-9c12-25f7eb438a05');                                              -- Recría · Maíz
commit;
