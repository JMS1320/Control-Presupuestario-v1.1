-- 253 · Anticipo 4/5 de PAM (feb-26). OK de JMS 10/11: «creí que estaba claro que créditos (un crédito) vs débitos (2 débitos) daban de neto la
-- cuota pagada… si solucionás con eso lo de los dos débitos contra el crédito, adelante». El banco debitó 2 × $ 86.000,71 y devolvió 1 (Anulación
-- Débitos): neto $ 86.000,71. La anulación estaba en OTRA cuota (ingreso) → el anticipo daba $ 0. Pasa a la MISMA cuota que los dos débitos
-- (4b213e85: 2 débitos − 1 crédito = $ 86.000,71) y la cuota aparte de la anulación queda desactivada. No cambia ningún importe. Foto: 253-foto-antes.json
begin;
update public.pam_galicia_cc set template_cuota_id = '4b213e85-7b1d-4fcd-b159-7b7b76d16c7a',
  nota_operador = concat_ws(' · ', nullif(nota_operador, ''), 'va a la misma cuota que los dos débitos (neto = la cuota) [script 253]')
 where id = '6464d5d4-fb4a-46fd-842a-8ca0590a5572' and template_cuota_id = '6c83e281-7899-4035-a116-24412c8a86e8';
update public.cuotas_egresos_sin_factura set estado = 'desactivado', descripcion = 'la anulación pasó a la cuota del 4/5 (2 débitos − 1 crédito) [script 253]'
 where id = '6c83e281-7899-4035-a116-24412c8a86e8' and estado = 'conciliado';
commit;
