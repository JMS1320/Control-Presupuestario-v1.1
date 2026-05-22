@echo off
REM Pausar AutoMejoras: cierre limpio + deshabilita Task Scheduler + pone MCP en write mode

echo Pausando AutoMejoras...

REM Deshabilitar tarea programada (evita que arranque otra sesion)
schtasks /change /tn "AutoMejoras" /disable >nul 2>&1
echo [OK] Task Scheduler deshabilitado

REM Crear archivo PAUSA como senal para que AutoMejoras cierre limpiamente
cd /d "D:\Users\josem\Documents\Jose\Automatizarr\Claude\Control-Presupuestario-v1.1"
echo pausa > AutoMejoras\PAUSA
echo [OK] Senal PAUSA enviada

REM Esperar hasta 5 minutos a que AutoMejoras cierre solo
echo Esperando cierre limpio (max 5 minutos)...
set INTENTOS=0
:ESPERAR
REM Verificar si hay proceso claude --print corriendo
powershell -Command "if (Get-CimInstance Win32_Process -Filter \"CommandLine LIKE '%%--print%%' AND CommandLine LIKE '%%sonnet%%'\" -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }" >nul 2>&1
if %errorlevel%==0 goto CERRADO

set /a INTENTOS+=1
if %INTENTOS% GEQ 30 goto FORZAR
REM Esperar 10 segundos entre checks (30 x 10 = 300 seg = 5 min)
timeout /t 10 /nobreak >nul
echo   ...esperando (%INTENTOS%/30)
goto ESPERAR

:FORZAR
echo [AVISO] 5 minutos agotados. Cerrando proceso forzosamente...
powershell -Command "Get-CimInstance Win32_Process -Filter \"CommandLine LIKE '%%--print%%' AND CommandLine LIKE '%%sonnet%%'\" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
echo [OK] Proceso cerrado forzosamente
goto CONTINUAR

:CERRADO
echo [OK] AutoMejoras cerro limpiamente

:CONTINUAR
REM Borrar archivo PAUSA
del AutoMejoras\PAUSA >nul 2>&1

REM Cambiar MCP a write mode (quitar --read-only)
powershell -Command "$c = Get-Content .mcp.json -Raw; $c = $c -replace ',\s*\"--read-only\"', ''; Set-Content .mcp.json $c"
echo [OK] MCP cambiado a write mode

echo.
echo AutoMejoras pausado. Podes trabajar normalmente.
echo Para reanudar: ejecuta automejoras-reanudar.bat
pause
