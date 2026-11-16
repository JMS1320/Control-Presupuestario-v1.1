# Recalcula los dos Excel del reporte con el Excel de esta máquina y saca el PDF del de presentación.
#   powershell -File pdf.ps1 "<carpeta de salida>" "<nombre base, sin extensión>"
# Usa una instancia de Excel propia (no toca los libros que el usuario tenga abiertos) y la cierra al terminar.
param([string]$Carpeta, [string]$Base)
$ErrorActionPreference = 'Stop'
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
try {
    foreach ($nombre in @("$Base - con controles.xlsx", "$Base.xlsx")) {
        $ruta = Join-Path $Carpeta $nombre
        $wb = $xl.Workbooks.Open($ruta)
        $xl.CalculateFull()
        $wb.Save()
        if ($nombre -eq "$Base.xlsx") {
            $pdf = Join-Path $Carpeta "$Base.pdf"
            $wb.ExportAsFixedFormat(0, $pdf)
            Write-Output "PDF: $pdf"
        }
        $wb.Close($false)
        Write-Output "recalculado: $nombre"
    }
}
finally {
    $xl.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
}
