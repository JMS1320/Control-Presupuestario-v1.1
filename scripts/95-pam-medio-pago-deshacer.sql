-- Deshace 95-pam-medio-pago.sql.
-- ⚠️ CAMBIÓ 2026-10-23 (T1): la versión anterior hacía DROP de la columna, pero `pam.comprobantes_arca.medio_pago`
-- YA EXISTÍA antes del script 95 (8 facturas con 'banco'). Borrarla destruiría datos que el 95 no creó.
-- Lo único que el 95 agregaría es el comentario, así que deshacer = quitar el comentario. Nunca DROP.
comment on column pam.comprobantes_arca.medio_pago is null;
