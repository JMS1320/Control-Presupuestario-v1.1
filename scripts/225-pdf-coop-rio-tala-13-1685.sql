-- 225 · MSA: vincula el PDF de la factura Coop. Rio Tala 0013-00001685 (01/12/2025, $ 10.011,99) — respaldo del 05 Provisión (A-FEAT-1571). DATOS, espera OK.
-- El buscador de PDF no la encontró (sin mail propio del proveedor). Está en el Drive: «12-01 - Coop rio tala x2.pdf» (las dos líneas de
-- diciembre; la 2ª hoja es la 00131685, $ 10.011,99 — leída el 06/11, coincide con ARCA). Mismo formato que las 361 ya vinculadas.
-- Deshacer: 225-…-deshacer.sql (vuelve a «no_encontrado» con su observación original).
update msa.comprobantes_arca
   set pdf_drive_url = 'https://drive.google.com/file/d/1IUtZnliVGbFvpnUXrwaAHyOE11hfgnoK/view?usp=drivesdk',
       pdf_estado = 'descargado',
       pdf_observaciones = 'Vinculado a mano: Drive «12-01 - Coop rio tala x2.pdf», 2ª factura del PDF [script 225]'
 where id = '62cd1649-843c-4a38-aa9f-7e246842d1ce' and pdf_drive_url is null;
