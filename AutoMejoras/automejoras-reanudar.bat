@echo off
REM Reanudar AutoMejoras: pone MCP en read-only + configura Task Scheduler con horario

echo Reanudando AutoMejoras...
echo.

REM Pedir hora de inicio
set /p HORA="Hora de inicio (formato HH:MM, ej 18:00): "

REM Cambiar MCP a read-only
cd /d "D:\Users\josem\Documents\Jose\Automatizarr\Claude\Control-Presupuestario-v1.1"
powershell -Command "$c = Get-Content .mcp.json -Raw; if ($c -notmatch 'read-only') { $c = $c -replace '\"--project-ref=lyojiaglcictmboqwxfm\"', '\"--project-ref=lyojiaglcictmboqwxfm\",\"--read-only\"'; Set-Content .mcp.json $c }"
echo [OK] MCP cambiado a read-only

REM Reconfigurar Task Scheduler con nuevo horario
schtasks /delete /tn "AutoMejoras" /f >nul 2>&1
schtasks /create /tn "AutoMejoras" /tr "\"%~dp0automejoras.bat\"" /sc HOURLY /mo 5 /st %HORA% /f >nul 2>&1
echo [OK] Task Scheduler: cada 5 horas desde %HORA%

REM Lanzar ejecucion inmediata
echo [OK] Lanzando primera ejecucion ahora...
echo.
start "" "%~dp0automejoras.bat"

echo AutoMejoras reanudado. Proximas ejecuciones cada 5 horas desde %HORA%.
pause
