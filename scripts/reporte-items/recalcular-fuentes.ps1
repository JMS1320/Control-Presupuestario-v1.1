# Abre cada Excel exportado por la app con el Excel de esta maquina, recalcula y guarda.
# Motivo: el export trae celdas con formula cuyo valor guardado esta vacio o viejo; sin recalcular se leen mal.
# Se usa sobre la COPIA descomprimida de los exports, nunca sobre los archivos originales.
param([string]$Carpeta)
$ErrorActionPreference = 'Stop'
$xl = New-Object -ComObject Excel.Application; $xl.Visible = $false; $xl.DisplayAlerts = $false
try {
    foreach ($f in Get-ChildItem $Carpeta -Recurse -Filter "*.xlsx" | Where-Object { @('set1','set2','bp') -contains $_.Directory.Name }) {
        $wb = $xl.Workbooks.Open($f.FullName); $xl.CalculateFull(); $wb.Save(); $wb.Close($false)
        Write-Output "recalculado: $($f.Name)"
    }
}
finally { $xl.Quit(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) }
