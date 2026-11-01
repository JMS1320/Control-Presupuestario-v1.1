-- 171 · A-FEAT-1503: categoría de los GASTOS de la cuenta corriente especial en dólares de MSA (cargada por el 169), con las
-- MISMAS categorías que esos conceptos tienen en el Galicia en pesos (JMS 01/11: «serán gastos bancarios en dólares»).
-- Sólo toca filas del 169 (nro_resumen 'CA_dolar_%') que no tienen categoría. La transferencia a Galicia Securities NO se toca.
-- Marca: motivo_revision = '[script 171]'. Deshacer: 171-…-deshacer.sql.
update msa.cc_usd set motivo_revision = '[script 171]', categ = case
    when descripcion ilike 'COMISION MANTENIMIENTO%' then 'Comision Cuenta Bancaria'
    when descripcion ilike 'IMP. DEB. LEY 25413%'     then 'Debitos / Creditos'
    when descripcion ilike 'IMP. ING. BRUTOS%'        then 'IIBB Bancario'
    when descripcion ilike 'PERCEP. IVA%'             then 'Percepcion IVA'
    when descripcion = 'IVA'                          then 'Iva Bancario'
    when descripcion ilike 'COMPRA DEBITO%GOOGLE%'    then 'INFORMATICA'
  end
where nro_resumen like 'CA_dolar_%' and (categ is null or categ = '') and motivo_revision is null
  and (descripcion ilike 'COMISION MANTENIMIENTO%' or descripcion ilike 'IMP. DEB. LEY 25413%' or descripcion ilike 'IMP. ING. BRUTOS%'
       or descripcion ilike 'PERCEP. IVA%' or descripcion = 'IVA' or descripcion ilike 'COMPRA DEBITO%GOOGLE%');
