-- 293 · El cobro de Provinvest del 01/10/2026 en MA Galicia ($ 82.617.301, conciliado con la FCE 00001-00000002) no tiene
-- ✅ CORRIDO 22/11/2026 por el MCP de Supabase, con OK de JMS («sí, está bien, arrendamientos venta»).
-- cuenta contable ni detalle: queda «sin categoría» en el Dashboard de MA y el control contra bancos lo suma como comodín.
-- Se le pone lo mismo que al cobro de junio (FCE 00001-00000001): «ARRENDAMIENTOS Venta» + «Cobro Provinvest FCE …».
-- Página de MA, P5. ⚠️ SÓLO con OK de JMS. Una fila, por id, sólo si sigue vacía.
update ma.ma_galicia
   set categ = 'ARRENDAMIENTOS Venta',
       detalle = 'Cobro Provinvest FCE 00001-00000002'
 where id = 'a2565a11-2039-45ef-9ca7-43e969d9a60c'
   and categ is null and detalle is null;

select id, fecha, creditos, categ, detalle from ma.ma_galicia where id = 'a2565a11-2039-45ef-9ca7-43e969d9a60c';
