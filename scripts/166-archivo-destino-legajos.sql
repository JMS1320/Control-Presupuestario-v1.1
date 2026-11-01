-- [script 166] Carpeta de LEGAJOS de empleados en el registro de destinos del archivo digital (A-FEAT-1480). DATOS. OK de JMS 01/11 («ok legajos»).
-- Adentro va una carpeta por empleado: «<AA-MM> - <Nombre> - <lugar>» (ej.: «26-02 - Alondra Olivo - Chalet»), con DNI, alta, apto, baja, renuncia, liquidación final, recibos.
insert into public.archivo_destinos (clave, nombre, ruta, drive_folder_id, ruta_drive, por_anio, nota)
select 'sueldos_legajos', 'Legajos de empleados', 'SAN MANUEL/SUELDOS - altas - bajas - legajos/- LEGAJOS',
       '1m_4Tn2tzFCtq9FSW2TrjLq0JPArELVOP', 'SAN MANUEL/SUELDOS - altas - bajas - legajos/- LEGAJOS', false,
       '[script 166] adentro: una carpeta por empleado «<AA-MM> - <Nombre> - <lugar>» (A-FEAT-1480)'
where not exists (select 1 from public.archivo_destinos where clave = 'sueldos_legajos');
