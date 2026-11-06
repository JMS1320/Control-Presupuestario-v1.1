-- 224 · MSA Galicia 21/07/2025 «Compra Cash Back» $ 98.335,56 → CATEG «CAJA» (DATOS). JMS 06/11: «cash back es todo a caja».
-- Completa el 223 (A-DAT-99). Sólo cambia categ. Deshacer: 224-…-deshacer.sql (por id).
update public.msa_galicia set categ = 'CAJA' where id = (select id from public.msa_galicia where categ is null and fecha = '2025-07-21' and debitos = 98335.56 and descripcion = 'Compra Cash Back');
