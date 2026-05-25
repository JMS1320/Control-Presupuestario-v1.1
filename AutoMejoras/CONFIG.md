# CONFIG — Configuracion de AutoMejoras

## Modelo
- **Modelo**: Sonnet (claude-sonnet-4-6)
- **Razon**: Balance costo/capacidad para tareas de documentacion y analisis

## Frecuencia
- **Cada**: 5 horas via Task Scheduler
- **El usuario puede**: Pausar/detener cuando quiera trabajar el mismo
- **Timeout**: 45 minutos maximo por sesion (anti-loop safety)
- **Max turns**: 50 turnos por sesion

## Limites
- **Creditos**: Usa creditos normales del plan, NO el limite extra comprado aparte
- **Base de datos**: Solo SELECT, NUNCA INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE
- **Codigo**: Solo lectura, NUNCA modificar archivos del proyecto
- **Escritura permitida**: Solo dentro de `AutoMejoras/` (archivos .md)

## Archivos de comunicacion
| Archivo | Quien escribe | Quien lee | Proposito |
|---------|--------------|-----------|-----------|
| JMS.md | Usuario | Programa | Pedidos, tareas, objetivos |
| NOVEDADES.md | Programa | Usuario | Hallazgos, preguntas, respuestas |
| PROGRESO.md | Programa | Programa | Estado entre sesiones |
| INDICE.md | Programa | Ambos | Mapa sinoptico de toda la documentacion |
| CONFIG.md | Ambos | Ambos | Configuracion del sistema |
| JMS - notas.md | Ambos | Ambos | Notas tecnicas y decisiones de diseno |

## Seguridad — 4 capas de enforcement real

### Capa 1 — DB: MCP read-only
- Flag `--read-only` en `.mcp.json`
- Bloqueo a nivel protocolo (no prompt)
- Solo SELECT permitido
- **Permanente** hasta que el usuario lo cambie manualmente

### Capa 2 — Sin Bash ni herramientas destructivas
- `--allowedTools` excluye: Bash, NotebookEdit, Agent
- Sin terminal = sin forma alternativa de escribir/ejecutar

### Capa 3 — Hook en Write y Edit
- Script: `.claude/hooks/restrict-automejoras.sh`
- Config: `AutoMejoras/settings-automejoras.json` (via `--settings`)
- Solo aplica a sesiones de AutoMejoras, NO a sesiones interactivas del usuario
- Hook intercepta ANTES de ejecucion
- Solo permite paths dentro de `AutoMejoras/`
- Cualquier otro path → error, operacion cancelada

### Capa 4 — Git como red de seguridad
- Sin Bash = no puede git commit/push
- Si algo se modifica: `git checkout .` restaura

### Permisos resultantes
| Zona | Read | Write | Edit | Bash | DB |
|------|------|-------|------|------|----|
| AutoMejoras/ | Si | Si | Si | No | — |
| Resto proyecto | Si | BLOQUEADO | BLOQUEADO | No | — |
| Supabase | — | — | — | — | Solo SELECT |

### Reglas adicionales
1. NUNCA instalar paquetes
2. Si detecta algo critico: documentar en NOVEDADES.md, NUNCA corregir
3. NUNCA crear archivos fuera de AutoMejoras/

## Protocolo obligatorio por sesion

### AL INICIAR (siempre):
1. Leer `JMS.md` — tareas del usuario
2. Leer `PROGRESO.md` — donde quedo la sesion anterior
3. Leer `INDICE.md` — estado actual de la documentacion
4. Verificar si existe `AutoMejoras/PAUSA` — si existe, cerrar limpiamente

### PROTOCOLO INCREMENTAL (critico — previene perdida de trabajo):
NUNCA acumular trabajo sin guardar. Despues de cada tabla/schema documentado:
1. Escribir/actualizar el archivo .md correspondiente
2. Actualizar PROGRESO.md inmediatamente
3. Actualizar INDICE.md si se creo o modifico un archivo
4. Agregar linea en NOVEDADES.md con lo hecho

Asi si la sesion se corta en cualquier momento, todo el trabajo previo esta guardado.

### DURANTE (cada 10-15 turnos):
- Re-leer `JMS.md` por si el usuario escribio algo
- Verificar si existe `AutoMejoras/PAUSA`

### AL CERRAR (siempre, obligatorio):
1. Actualizar `PROGRESO.md` — estado final completo
2. Actualizar `INDICE.md` — todas las entradas nuevas/modificadas
3. Escribir resumen final en `NOVEDADES.md`

## Mecanismo de pausa y reanudacion

### Pausar (automejoras-pausar.bat):
1. Deshabilita Task Scheduler (evita nuevas sesiones)
2. Crea archivo `AutoMejoras/PAUSA` como senal
3. Espera hasta 5 minutos a que AutoMejoras detecte PAUSA y cierre limpiamente
4. Si no cerro en 5 min, mata el proceso forzosamente
5. Borra archivo PAUSA
6. Cambia MCP de read-only a write mode

### Reanudar (automejoras-reanudar.bat):
1. Pide hora de inicio (ej: 18:00)
2. Cambia MCP a read-only
3. Configura Task Scheduler cada 5 horas desde esa hora
4. Lanza ejecucion inmediata

### Workflow del usuario:
1. AutoMejoras corriendo → ejecutar `automejoras-pausar.bat`
2. Esperar cierre limpio (automatico, max 5 min)
3. Trabajar normalmente con MCP en write mode
4. Al terminar → ejecutar `automejoras-reanudar.bat`, ingresar hora

## Archivos del sistema
| Archivo | Proposito |
|---------|-----------|
| `automejoras.bat` | Script principal — invoca Claude Code Sonnet |
| `automejoras-pausar.bat` | Cierre limpio + deshabilita scheduler + MCP write |
| `automejoras-reanudar.bat` | Pide hora + MCP read-only + scheduler + ejecucion |
| `settings-automejoras.json` | Settings con hooks (solo para sesiones AutoMejoras) |
| `.claude/hooks/restrict-automejoras.sh` | Hook que bloquea Write/Edit fuera de AutoMejoras/ |
| `PAUSA` | Archivo senal — si existe, AutoMejoras cierra limpiamente |
