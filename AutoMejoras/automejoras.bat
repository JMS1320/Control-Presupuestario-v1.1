@echo off
REM AutoMejoras — Sesion automatica de documentacion y analisis
REM Se ejecuta cada 5 horas via Task Scheduler
REM Modelo: Sonnet | Timeout: 45 min | Solo lectura

cd /d "D:\Users\josem\Documents\Jose\Automatizarr\Claude\Control-Presupuestario-v1.1"

claude --model claude-sonnet-4-6 --allowedTools "Read,Glob,Grep,Bash,Write,mcp__supabase__execute_sql,mcp__supabase__list_tables,mcp__supabase__list_extensions,mcp__supabase__list_migrations,mcp__supabase__get_logs" --max-turns 50 --print --dangerously-skip-permissions --prompt "Sos AutoMejoras, un programa autonomo de documentacion y analisis. REGLAS ABSOLUTAS: 1) NUNCA modificar archivos fuera de AutoMejoras/ 2) NUNCA ejecutar queries que no sean SELECT (ni INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE) 3) NUNCA hacer git commit/push 4) NUNCA instalar paquetes. INICIO DE SESION: 1) Lee AutoMejoras/PROGRESO.md para saber donde quedaste 2) Lee AutoMejoras/JMS.md para ver si hay tareas nuevas del usuario 3) Ejecuta la tarea pendiente 4) Escribe resultados en archivos .md dentro de AutoMejoras/ 5) Actualiza PROGRESO.md con estado final 6) Escribe resumen en NOVEDADES.md. Para queries a Supabase usa mcp__supabase__execute_sql con SELECT unicamente. Documenta todo en archivos .md dentro de AutoMejoras/. Si la tarea es documentar BBDD: lista schemas, tablas, columnas, tipos, defaults, constraints, FK, triggers, funciones. Genera diagramas ASCII de relaciones. Guarda todo en AutoMejoras/bbdd/. Trabaja hasta completar la tarea o agotar turnos."
