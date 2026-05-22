# JMS - Notas sobre AutoMejoras

> Notas técnicas y operativas del sistema AutoMejoras.

---

## Infraestructura creada (2026-05-22)

**Archivos base:**
- `AutoMejoras/JMS.md` — Pedidos del usuario (primera tarea: documentar BBDD)
- `AutoMejoras/NOVEDADES.md` — Output del programa hacia el usuario
- `AutoMejoras/PROGRESO.md` — Estado entre sesiones
- `AutoMejoras/INDICE.md` — Mapa sinóptico de documentación (se crea en primera sesión)
- `AutoMejoras/CONFIG.md` — Reglas, límites, protocolos
- `AutoMejoras/JMS - notas.md` — Este archivo: notas técnicas y decisiones

**Scripts:**
- `AutoMejoras/automejoras.bat` — Script principal (Claude Code Sonnet + restricciones)
- `AutoMejoras/automejoras-pausar.bat` — Cierre limpio + scheduler off + MCP write
- `AutoMejoras/automejoras-reanudar.bat` — Pide hora + MCP read-only + scheduler on + ejecución inmediata

**Seguridad:**
- `AutoMejoras/settings-automejoras.json` — Settings con hooks (solo sesiones automáticas)
- `.claude/hooks/restrict-automejoras.sh` — Hook que bloquea Write/Edit fuera de AutoMejoras/

**Scheduler:**
- Task Scheduler "AutoMejoras" — Cada 5 horas (horario configurable vía reanudar.bat)

**Requisito:** `claude` debe estar en el PATH del sistema (verificado: sí está en `C:\Users\josem\AppData\Roaming\npm\claude`)

---

## Seguridad — 4 capas de protección (2026-05-22)

Acordado con el usuario: bloqueo REAL, no basado en instrucciones del prompt.

### Capa 1 — DB: MCP read-only
- `.mcp.json` tiene `--read-only` en los args del MCP Supabase
- Bloquea a nivel protocolo cualquier query que no sea SELECT
- **Permanente** hasta que el usuario lo cambie (vía pausar.bat o manual)
- Al pausar AutoMejoras → se quita `--read-only` para que el usuario pueda trabajar
- Al reanudar → se vuelve a poner `--read-only`

### Capa 2 — Sin Bash ni herramientas destructivas
- `--allowedTools` solo incluye: Read, Glob, Grep, Write, Edit + MCP read
- NO incluye: Bash, NotebookEdit, Agent
- Sin terminal = no hay forma de escribir archivos por fuera de Write/Edit

### Capa 3 — Hook en Write y Edit: solo AutoMejoras/
- Script `.claude/hooks/restrict-automejoras.sh` recibe JSON en stdin con `file_path`
- Si el path contiene "AutoMejoras" → permite (exit 0)
- Si no → bloquea (exit 2 con mensaje de error)
- Config en `settings-automejoras.json`, pasado al CLI con `--settings`
- **Solo aplica a sesiones de AutoMejoras**, no afecta sesiones interactivas del usuario

### Capa 4 — Git como red de seguridad
- Sin Bash = no puede hacer git commit/push
- Si algo se modificara fuera de AutoMejoras/ → `git checkout .` restaura
- Remoto queda siempre intacto

### Resultado final
| Zona | Permisos |
|------|----------|
| Dentro de AutoMejoras/ | Read, Write, Edit (libertad total) |
| Fuera de AutoMejoras/ | Read, Glob, Grep solamente (solo lectura) |
| Base de datos | Solo SELECT |
| Bash / terminal | No disponible |
| Git | No puede commit ni push |

### Decisión sobre Edit (etapa inicial)
- **Ahora**: Edit y Write habilitados SOLO dentro de AutoMejoras/ (hook bloquea afuera)
- **Futuro**: Si se quiere restringir más, se puede limitar Edit a solo proponer cambios en NOVEDADES.md y que el usuario apruebe en JMS.md

---

## Visión del INDICE — objetivo a largo plazo (2026-05-22)

El INDICE.md no es solo una lista de archivos. El objetivo final es que sea un **mapa sinóptico global de la app**: desde lo macro (arquitectura general, schemas, flujos) hasta lo particular (cada tabla, cada hook, cada endpoint).

**Meta**: Generar un **manual de la app** progresivamente. Que cualquier persona pueda entender la app leyendo la documentación de AutoMejoras, desde una foto global hasta el detalle de cada pieza.

El INDICE irá evolucionando de lista simple → mapa jerárquico → manual navegable.

---

## Protocolo incremental — prevención de pérdida (2026-05-22)

**Problema**: Si la sesión se corta (tokens agotados, timeout, crash), se pierde lo que no se guardó.

**Solución**: NUNCA acumular trabajo sin guardar. Después de cada paso:
1. Escribir/actualizar el archivo .md correspondiente
2. Actualizar PROGRESO.md inmediatamente
3. Actualizar INDICE.md si se creó o modificó un archivo
4. Agregar línea en NOVEDADES.md

Así el cierre obligatorio (PROGRESO + INDICE + NOVEDADES) no es el único momento de guardado — es solo la actualización final. Todo el trabajo intermedio ya está guardado.

---

## Mecanismo de pausa limpia (2026-05-22)

**Problema**: Si el usuario quiere pausar y el programa está corriendo, matarlo directo puede truncar trabajo.

**Solución**: Archivo `AutoMejoras/PAUSA` como señal:
1. `automejoras-pausar.bat` crea el archivo PAUSA
2. El programa verifica cada 10-15 turnos si existe PAUSA
3. Si lo detecta → actualiza PROGRESO/INDICE/NOVEDADES y termina limpiamente
4. El bat espera hasta 5 minutos
5. Si no cerró en 5 min → mata el proceso forzosamente
6. Borra PAUSA, cambia MCP a write

**Por qué 5 minutos**: Balance entre dar tiempo para cierre limpio y no hacer esperar mucho al usuario. En la práctica, detectar PAUSA y escribir 3 archivos toma menos de 1 minuto.

---

## Archivos locales (no van al repo) — cómo recrearlos (2026-05-22)

Estos archivos están en `.gitignore` por seguridad. Si se clona el repo en otra PC, hay que crearlos manualmente.

### 1. `.mcp.json` (raíz del proyecto)

Ruta: `D:\Users\josem\Documents\Jose\Automatizarr\Claude\Control-Presupuestario-v1.1\.mcp.json`

```json
{
  "mcpServers": {
    "supabase": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--project-ref=lyojiaglcictmboqwxfm",
        "--read-only"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "(poner el token real aquí)"
      }
    }
  }
}
```

**Nota**: `--read-only` se agrega/quita con los scripts pausar/reanudar. El token de Supabase no se documenta por seguridad — pedirlo al usuario.

### 2. `.claude/hooks/restrict-automejoras.sh`

Ruta: `D:\Users\josem\Documents\Jose\Automatizarr\Claude\Control-Presupuestario-v1.1\.claude\hooks\restrict-automejoras.sh`

Crear la carpeta `.claude/hooks/` si no existe.

```bash
#!/bin/bash
# Hook de seguridad: bloquea Write/Edit fuera de AutoMejoras/
# Recibe JSON en stdin con tool_input.file_path

INPUT=$(cat)

# Extraer file_path del JSON
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')

# Si el path contiene AutoMejoras, permitir
if echo "$FILE_PATH" | grep -qi "AutoMejoras"; then
  exit 0
fi

# Bloquear cualquier otro path
echo "BLOQUEADO: Solo se permite escribir dentro de AutoMejoras/. Path: $FILE_PATH" >&2
exit 2
```

---

## Estado actual (2026-05-22)

- **Implementación**: Completa — todos los archivos y scripts creados
- **Prueba manual**: Pendiente (no se hace hoy)
- **Task Scheduler**: Creado pero se probará después
- **MCP**: Actualmente en read-only (se cambió hoy)
- **Primera tarea**: Documentar BBDD completa (registrada en JMS.md)
