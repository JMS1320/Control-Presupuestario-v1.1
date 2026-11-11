-- Deshace [script 267]: vuelve las 3 filas a vigentes (foto antes).
update msa.sicore_retenciones set anulado = false, fecha_anulacion = null, motivo_anulacion = null
where id in ('c19f97b9-ac91-492d-bfab-fe1dcbd7294f','5fec515f-bce4-4fb3-a35c-f3a0b585bd6f','1be3d959-b614-46bf-868d-b257c4fdd582')
  and motivo_anulacion like '[script 267]%';
