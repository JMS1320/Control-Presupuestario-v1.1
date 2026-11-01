-- Deshace 171: vuelve a dejar sin categoría sólo las filas que marcó.
update msa.cc_usd set categ = null, motivo_revision = null where motivo_revision = '[script 171]';
