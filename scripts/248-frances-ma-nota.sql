-- 248 · DR8 (OK de JMS 10/11: «me parece bien la solución del francés»). La transferencia del Galicia PAM del 06/08/25 ($ 4.000.000, «Retiro MAM
-- Frances», CBU 0170023740000003618361, CUIT 27066824611) entra al BBVA Francés de MA: cuenta sin extracto que no se usa más (JMS: «sería el
-- único movimiento para siempre»). No se crea la cuenta: se anota la otra punta en el movimiento (id 22b48092-cbc3-42e2-a601-5e581d72d46e). Foto: 248-foto-antes.json.
begin;
update public.pam_galicia set nota_operador = concat_ws(' · ', nullif(nota_operador, ''), '↔ correspondencia: entra al BBVA Francés de MA (cuenta sin extracto en el sistema, no se usa más) [script 248]')
 where id = '22b48092-cbc3-42e2-a601-5e581d72d46e' and coalesce(nota_operador, '') not like '%[script 248]%';
commit;
