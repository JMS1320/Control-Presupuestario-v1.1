# Saca un PDF sólo con algunas hojas de un Excel del reporte (para comparar un «antes» y un «después» de esas hojas).
#   powershell -File pdf-hojas.ps1 "<libro.xlsx>" "<salida.pdf>" "Hoja 1|Hoja 2|…"
# Trabaja sobre una COPIA temporal del libro (no modifica el original). Usa una instancia propia de Excel y la cierra.
param([string]$Libro, [string]$Salida, [string]$Hojas)
$ErrorActionPreference = 'Stop'
$lista = $Hojas.Split('|') | Where-Object { $_ }
$tmp = Join-Path $env:TEMP ("hojas_" + [guid]::NewGuid().ToString('N') + ".xlsx")
Copy-Item $Libro $tmp -Force
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
try {
    $wb = $xl.Workbooks.Open($tmp)
    $xl.CalculateFull()
    $presentes = @($lista | Where-Object { $n = $_; @($wb.Worksheets | Where-Object { $_.Name -eq $n }).Count -gt 0 })
    $wb.Worksheets.Item($presentes[0]).Select()
    for ($i = 1; $i -lt $presentes.Count; $i++) { $wb.Worksheets.Item($presentes[$i]).Select($false) }
    $xl.ActiveSheet.ExportAsFixedFormat(0, $Salida)
    Write-Output ("PDF: " + $Salida + " (" + $presentes.Count + " hojas)")
    $wb.Close($false)
}
finally {
    $xl.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}
