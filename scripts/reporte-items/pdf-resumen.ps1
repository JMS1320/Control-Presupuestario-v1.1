# Saca el PDF corto: recalcula el Excel "resumen para imprimir" e imprime solo las hojas listadas en el .hojas.txt
param([string]$Carpeta, [string]$Base)
$ErrorActionPreference = 'Stop'
$ruta = Join-Path $Carpeta "$Base - resumen para imprimir.xlsx"
$hojas = Get-Content (Join-Path $Carpeta "$Base - resumen para imprimir.hojas.txt") -Encoding UTF8 | Where-Object { $_ }
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
try {
    $wb = $xl.Workbooks.Open($ruta)
    $xl.CalculateFull()
    $wb.Save()
    $wb.Sheets.Item([string[]]$hojas).Select()
    $pdf = Join-Path $Carpeta "$Base - resumen para imprimir.pdf"
    $xl.ActiveSheet.ExportAsFixedFormat(0, $pdf)
    $wb.Sheets.Item(1).Select()
    $wb.Close($false)
    Write-Output "PDF corto: $pdf"
}
finally {
    $xl.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
}
