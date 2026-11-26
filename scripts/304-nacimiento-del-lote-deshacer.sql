alter table productivo.stock_lotes drop column if exists fecha_nacimiento;
alter table productivo.stock_lotes drop column if exists peso_nacimiento_kg;
update productivo.lote_tramos set ganancia_diaria_kg = 0.7025, notas = '[script 303] JMS 25/11: nacen 30 kg el 1/7, destete 200 kg el 28/2 → 0,7025 kg/día' where id = '1dea1b5d-a402-4216-8734-270e994f7d27';
