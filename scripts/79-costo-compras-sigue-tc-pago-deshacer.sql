-- Deshace el 79. No revierte los costos ya recalculados (quedan al último TC aplicado).
drop trigger if exists trg_costo_compras_sigue_tc on msa.comprobantes_arca;
drop function if exists productivo.costo_compras_sigue_tc();
