# AutoMejoras — OBJETIVOS: Primeras Ideas

> **Fecha**: 2026-05-21
> **Autor**: Jose Martinez + Claude
> **Estado**: Borrador inicial — requiere consenso antes de implementar

---

## 1. QUE ES AUTOMEJORAS

### 1.1 — Definicion

Un programa auxiliar que corre Claude Code en modo no-interactivo (sin usuario presente), de forma diaria y pausable, con el objetivo de:

1. **Documentar** la estructura real de la app (BBDD + codigo)
2. **Auditar** contrastando documentacion vs realidad (queries a Supabase, lectura de codigo)
3. **Proponer** mejoras, correcciones y deteccion de bugs — sin ejecutar cambios

### 1.2 — Regla fundamental

> **PROHIBIDO MODIFICAR**. Absolutamente prohibido modificar codigo, base de datos, configuraciones, o cualquier archivo fuera de la carpeta `AutoMejoras/`. Solo puede: leer codigo, consultar BBDD (SELECT), comparar datos, y escribir archivos `.md` dentro de `AutoMejoras/`.

### 1.3 — Convivencia con trabajo manual

- El usuario trabaja en Claude Code interactivo desde CMD
- AutoMejoras corre en paralelo (segundo proceso) en horarios configurados
- **Pausable**: el usuario puede detener/reanudar cuando necesite trabajar sin interferencia
- **Plan Pro USD 20**: la frecuencia se ajusta al consumo disponible del plan

---

## 2. OBJETIVOS CONCRETOS — 1ra ETAPA

### 2A — Indice arquitectural con cuadros sinopticos

Generar un indice visual (usando Markdown con diagramas ASCII/texto) que muestre:

- Arquitectura de datos: schemas, tablas, relaciones, FK
- Arquitectura de codigo: componentes, hooks, APIs, flujos
- Cuadros sinopticos que permitan entender la estructura sin leer codigo

### 2B — Explicacion jerarquica de BBDD y funciones

Documentacion narrativa que explique:

- Jerarquia de schemas y tablas (public, msa, ma, pam)
- Proposito de cada tabla, columnas clave, relaciones
- Funciones principales de la app: que hace cada componente/hook/API
- Flujos de datos: como viaja un dato desde la UI hasta la BD y viceversa

### 2C — Listas de tareas/objetivos/pendientes

Consolidar y auditar:

| Lista | Fuente | Proceso |
|---|---|---|
| **Pendientes no resueltos** | Revisar documentacion de presente hacia pasado (CLAUDE.md, memorias, KNOWLEDGE.md) | Contrastar: si algo se marco como pendiente pero ya se implemento → registrar como resuelto. Si sigue pendiente → lista aparte |
| **Tareas/objetivos del usuario** | Extraer de documentacion + contexto | Explicar cada uno con detalle |
| **Ideas de mejoras** | Analisis propio del codigo/BBDD | Propuestas nuevas que no estan en ninguna lista |
| **Bugs pre-detectados** | Contrastar intencion documentada vs codigo real | Cosas que supuestamente ya funcionan pero tienen inconsistencias detectables por query o lectura |

### 2D — Autodocumentacion para auditoria

Cada hallazgo debe quedar registrado con:

- Que se encontro
- Donde (archivo:linea o tabla.columna)
- Evidencia (query que lo demuestra, fragmento de codigo)
- Clasificacion: bug / mejora / inconsistencia / pendiente confirmado / pendiente resuelto

---

## 3. COMO IMPLEMENTARLO — OPCIONES

### Opcion A: Cron + Claude Code CLI con `--print` y `--allowedTools`

**Mecanismo**: Un script `.bat` o `.sh` que corre via Task Scheduler de Windows (o cron en WSL) que invoca:

```bash
claude -p "instrucciones..." --allowedTools Read,Glob,Grep,Bash,Write,mcp__supabase__execute_sql
```

Con `Write` restringido a la carpeta `AutoMejoras/` (via instrucciones en el prompt, no enforcement de sistema).

**Pros**:
- Simple de implementar — un archivo `.bat` + tarea programada
- Usa el mismo CLI que ya esta instalado
- Acceso directo a MCP Supabase (si esta configurado)
- Facil de pausar (deshabilitar tarea) y reanudar
- El usuario puede seguir usando otra instancia de Claude Code en paralelo

**Contras**:
- El prompt debe ser muy preciso — no hay interaccion para corregir rumbo
- Si el prompt es largo, el contexto se gasta rapido
- No hay "memoria" entre ejecuciones salvo lo que quede en los `.md` generados
- El enforcement de "no modificar" es por instruccion, no por sistema (riesgo bajo pero no cero)
- Consumo de tokens: cada ejecucion puede gastar una porcion significativa del plan Pro

### Opcion B: Script Node con Claude Agent SDK

**Mecanismo**: Un script `automejoras.js` que usa `@anthropic-ai/claude-code` SDK para crear un agente programatico con tools restringidas.

```javascript
const { claude } = require('@anthropic-ai/claude-code')
const result = await claude({
  prompt: "...",
  allowedTools: ['Read', 'Glob', 'Grep', 'mcp__supabase__execute_sql', 'Write'],
  // ... restricciones
})
```

**Pros**:
- Mayor control programatico (puede encadenar pasos, manejar errores)
- Puede forzar restricciones a nivel de codigo (interceptar Write y validar que sea solo en AutoMejoras/)
- Puede leer los .md anteriores como contexto antes de cada ejecucion
- Puede dividir el trabajo en sub-tareas (primero BBDD, luego codigo, luego auditorias)
- Log de cada ejecucion automatico

**Contras**:
- Requiere setup adicional (instalar SDK, escribir script)
- Mas complejo de mantener
- Requiere Node.js (ya disponible en el proyecto)
- Debugging mas dificil si algo falla

### Opcion C: Hibrida — Script .bat simple que invoca Claude Code con contexto

**Mecanismo**: Un `.bat` que:
1. Lee los ultimos `.md` generados en AutoMejoras/ (como contexto)
2. Arma un prompt dinamico segun la etapa actual
3. Invoca `claude -p "..." --allowedTools ...`
4. Repite cada X horas hasta que se pause

**Pros**:
- Balance entre simplicidad (Opcion A) y control (Opcion B)
- Contexto acumulativo: cada ejecucion sabe que hizo la anterior
- El `.bat` puede tener "etapas" (dia 1: BBDD, dia 2: codigo, dia 3: auditorias)
- Facil de pausar (cerrar el .bat o deshabilitar tarea)

**Contras**:
- El .bat puede volverse complejo con el tiempo
- Manejo de errores limitado en batch
- El contexto que se pasa como texto tiene limite

---

## 4. PREGUNTAS PARA EL USUARIO

### Sobre frecuencia y consumo

1. Con plan Pro (USD 20), el limite diario de tokens es acotado. Una ejecucion que lea BBDD completa + codigo + genere documentacion puede consumir el equivalente a 2-3 conversaciones normales. **Preferis una ejecucion diaria corta (30 min de trabajo) o menos frecuente pero mas profunda (semanal)?**

2. **En que horario preferis que corra?** (para no competir con tu uso interactivo del plan)

3. **Como preferis pausarlo?** Opciones: (a) un archivo `PAUSA.flag` que si existe no corre, (b) deshabilitar la tarea programada manualmente, (c) un comando tipo `automejoras stop/start`

### Sobre alcance

4. La BBDD tiene multiples schemas (public, msa, ma). **Documentar todos o solo msa + public primero?**

5. Los archivos de codigo principales son ~15 componentes + ~10 hooks + ~10 APIs. **Empezar por los mas criticos (extracto, cash flow, motor) o barrer todo sistematicamente?**

6. **Los pendientes en CLAUDE.md son muy extensos** (el archivo tiene ~2500 lineas de historial). Hay que filtrar solo lo relevante. **Confias en que el programa identifique que esta vigente vs obsoleto, o preferis darle una lista curada de "esto si revisar"?**

### Sobre la implementacion

7. De las 3 opciones (A/B/C), **cual te parece mas razonable para arrancar?** Mi recomendacion: Opcion A para probar el concepto, migrar a C si funciona bien.

8. **Necesitas que el programa pueda correr queries INSERT/UPDATE/DELETE o solo SELECT?** (Mi recomendacion: solo SELECT, consistente con la regla de no modificar)

---

## 5. ESTRUCTURA DE DOCUMENTACION PROPUESTA

### 5.1 — Nivel Micro (una explicacion especifica)

```
AutoMejoras/
  bbdd/
    schema-public.md          # Cada tabla de public con columnas, tipos, FK, proposito
    schema-msa.md             # Idem para msa
    schema-ma.md              # Idem para ma
    relaciones.md             # Diagrama de relaciones entre tablas
    auditoria-bbdd.md         # Inconsistencias encontradas (columnas sin usar, FK rotas, etc.)
  codigo/
    componentes.md            # Cada componente con proposito, props, dependencias
    hooks.md                  # Cada hook con proposito, parametros, que tablas toca
    apis.md                   # Cada endpoint API con ruta, metodo, que hace
    flujos.md                 # Flujos principales (conciliacion, importacion, SICORE, etc.)
  auditorias/
    pendientes-vigentes.md    # Pendientes confirmados como no resueltos
    pendientes-resueltos.md   # Cosas que estaban como pendientes pero ya se hicieron
    bugs-detectados.md        # Inconsistencias codigo vs intencion documentada
    mejoras-propuestas.md     # Ideas nuevas del programa
  reportes/
    YYYY-MM-DD.md             # Reporte diario de que se hizo/encontro
```

### 5.2 — Nivel Macro (indice total)

```
AutoMejoras/
  INDICE.md                   # Mapa completo de toda la documentacion
                              # Con links a cada archivo
                              # Cuadro sinoptico general
                              # Estado de cada seccion (completo/en progreso/pendiente)
  OBJETIVOS - primeras ideas.md  # Este archivo
  CONFIG.md                   # Configuracion del programa (frecuencia, alcance, reglas)
  LOG.md                      # Historial de ejecuciones (fecha, que hizo, tokens usados)
```

### 5.3 — Principio de extraccion

Cada archivo `.md` debe ser **autocontenido**: se puede leer y entender sin necesidad de leer otros archivos. El `INDICE.md` permite navegar entre ellos. Esto facilita:

- Pasar documentacion a otro sistema o persona
- Alimentar a Claude en futuras conversaciones con solo los archivos relevantes
- Auditar una seccion sin cargar toda la documentacion

### 5.4 — Convencion de formato

Cada archivo de documentacion sigue esta estructura:

```markdown
# Titulo
> Generado: YYYY-MM-DD | Ultima verificacion: YYYY-MM-DD | Estado: borrador/verificado/desactualizado

## Contenido principal
(tablas, explicaciones, diagramas)

## Evidencia
(queries ejecutadas, fragmentos de codigo referenciados)

## Hallazgos
(inconsistencias, bugs, mejoras detectadas — si aplica)
```

---

## 6. PRIMEROS PASOS PROPUESTOS

Si el usuario da el OK:

1. **Consensuar este documento** — ajustar opciones, responder preguntas
2. **Elegir opcion de implementacion** (A, B, o C)
3. **Crear CONFIG.md** con parametros acordados
4. **Primera ejecucion manual**: correr el programa una vez "a mano" para validar que genera output util
5. **Automatizar**: configurar tarea programada con la frecuencia acordada
6. **Iterar**: ajustar instrucciones segun calidad del output

---

## 7. LIMITACIONES CONOCIDAS

- **Plan Pro USD 20**: limite diario de ~45 mensajes Opus o ~225 Sonnet. Cada ejecucion de AutoMejoras consume parte de esto.
- **Sin memoria entre ejecuciones**: cada invocacion de Claude Code no-interactivo empieza de cero. La "memoria" son los archivos .md que genero antes.
- **MCP Supabase en read-only**: las queries a BBDD son solo SELECT. Cualquier cambio requiere intervencion manual del usuario.
- **No puede ejecutar la app**: no puede abrir un browser ni testear la UI. Solo puede auditar codigo y datos.
- **Enforcement de "no modificar"**: es por instruccion en el prompt, no por restriccion de sistema. El programa PODRIA modificar archivos fuera de AutoMejoras/ si el prompt no es suficientemente claro. Mitigacion: tools restringidas + instrucciones explicitas + revision de logs.
