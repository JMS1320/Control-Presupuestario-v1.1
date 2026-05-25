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

---

## 8. PREGUNTAS Y RESPUESTAS — Sesion 2026-05-21

### Pregunta Claude (seccion 4 del documento):

> De las 3 opciones (A/B/C), cual te parece mas razonable para arrancar? Mi recomendacion: Opcion A para probar el concepto, migrar a C si funciona bien.
> En que horario preferis que corra?
> Solo SELECT a Supabase?
> Empezar por BBDD o codigo?
> Los pendientes en CLAUDE.md son muy extensos (2500 lineas). Confias en que el programa identifique que esta vigente vs obsoleto, o preferis darle una lista curada?
> Mas preguntas?

### Respuesta Usuario:

> "entre a y b para el principio entiendo que es A. pero desconozco la diferencia entre a y b. por ej: ambas pueden pedir info a BBDD y crear un diagrama de como es la estructura de datos? y en base a lo obtenido hacer preguntas, o hacer ciertas queries para constatar cosas? razonar, pensar, auditar sobre lo recibido? idem hacia codigo."
>
> "no conozco la opcion C."
>
> "si la idea es que a las 10 pm; 3 am y 8 am puede trabajar hasta agotar limite. no debe usar mi limite extra pagado aparte. luego incluso creo que cada 5 horas deberia prender en realidad. siempre cada 5 horas y yo pararlo cuando quiero trabajar."
>
> "esto debes explicarmelo bien, restricciones y posibilidades de SELECT y OTRAS. nunca modificar en ninguna situacion."
>
> "empezar por BBDD si, calculo luego codigo mas queryes para entender. siempre documentar."
>
> "claude.md habria que tomar desde hoy hacia el pasado. enfocarnos siempre en data de 2026 para empezar. los archivos no modificados durante el 2026 no los usemos por ahora."

### Respuesta Claude — Aclaraciones:

#### 8.1 — Diferencia real entre Opcion A y Opcion B

**La capacidad es identica.** Ambas opciones pueden hacer exactamente lo mismo:

- Consultar BBDD via Supabase (queries SQL)
- Leer todo el codigo fuente
- Razonar, pensar, auditar sobre lo que recibe
- Generar diagramas en texto/markdown
- Hacer queries de constatacion (ej: "la tabla X tiene FK a Y? dejame verificar...")
- Escribir documentacion en archivos .md

La diferencia es **como se arranca el proceso**, no que puede hacer:

| Aspecto | Opcion A: CLI directo | Opcion B: Script Node SDK |
|---|---|---|
| **Que es** | Un archivo `.bat` que ejecuta `claude -p "instrucciones..."` | Un programa `.js` que usa la libreria de Claude como codigo |
| **Analogia** | Como abrir CMD y escribir un comando | Como hacer un programa que automatiza varios comandos |
| **Setup** | 5 minutos — crear un `.bat` y programar en Task Scheduler | 30-60 minutos — instalar SDK, escribir script, testear |
| **Capacidad** | Identica | Identica |
| **Ventaja** | Simplicidad — si funciona, no hay nada mas que hacer | Mas control — puede encadenar pasos, manejar errores, forzar restricciones por codigo |
| **Desventaja** | Menos control sobre el flujo (una sola instruccion larga) | Mas complejo de mantener |
| **Cuando conviene** | Para probar si el concepto funciona | Cuando el concepto ya funciona y queremos refinarlo |

**Conclusion**: Empezar con A. Si despues de unas semanas se necesita mas control, migrar a B.

**Opcion C** (hibrida) era simplemente un `.bat` mas inteligente que lee los archivos que genero ayer para no repetir trabajo. Es un punto intermedio — no es una opcion separada, es A evolucionada. Por lo tanto descartamos C como opcion independiente y la consideramos una mejora natural de A si fuera necesario.

#### 8.2 — Frecuencia: cada 5 horas, pausable

**Acordado:**
- Ejecucion automatica cada 5 horas (aprox 4-5 veces por dia)
- El usuario lo pausa cuando quiere trabajar en Claude Code interactivo
- No debe consumir el limite extra pagado aparte (solo el allowance base del plan Pro)

**Mecanismo de pausa**: Un archivo `AutoMejoras/PAUSA` (sin extension). Si existe, el `.bat` no ejecuta Claude y se cierra silenciosamente. Para pausar: crear el archivo. Para reanudar: borrarlo.

```
# Pausar
echo. > AutoMejoras/PAUSA

# Reanudar
del AutoMejoras/PAUSA
```

**Nota sobre limites Plan Pro**: El plan Pro tiene un rate limit diario. Claude Code no-interactivo consume del mismo pool que el uso interactivo. Si AutoMejoras agota el limite, el usuario no podra usar Claude Code interactivo hasta que se resetee. Por eso la pausa manual es critica.

#### 8.3 — Queries a BBDD: que puede y que no puede hacer

**Herramienta disponible**: `mcp__supabase__execute_sql` — ejecuta SQL arbitrario contra la base de datos Supabase del proyecto.

**Lo que SI puede hacer (y hara):**

| Operacion | Ejemplo | Para que |
|---|---|---|
| `SELECT` | `SELECT * FROM information_schema.columns WHERE table_name = 'msa_galicia'` | Documentar estructura de tablas |
| `SELECT` con JOINs | `SELECT c.column_name, tc.constraint_type FROM ... JOIN ...` | Mapear relaciones FK |
| `SELECT COUNT(*)` | `SELECT estado, COUNT(*) FROM msa.comprobantes_arca GROUP BY estado` | Auditar datos, detectar inconsistencias |
| `SELECT` con filtros | `SELECT * FROM msa_galicia WHERE categ IS NULL AND estado = 'conciliado'` | Buscar anomalias |
| Vistas de sistema | `SELECT schemaname, tablename FROM pg_tables` | Listar schemas y tablas |
| Funciones/triggers | `SELECT * FROM information_schema.triggers` | Documentar automatismos BD |
| Constraints | `SELECT * FROM information_schema.table_constraints` | Documentar reglas de integridad |

**Lo que NO puede hacer (prohibido):**

| Operacion | Ejemplo | Por que no |
|---|---|---|
| `INSERT` | `INSERT INTO ...` | Modifica datos |
| `UPDATE` | `UPDATE msa_galicia SET ...` | Modifica datos |
| `DELETE` | `DELETE FROM ...` | Elimina datos |
| `DROP` | `DROP TABLE ...` | Destruye estructura |
| `ALTER` | `ALTER TABLE ...` | Modifica estructura |
| `CREATE` | `CREATE TABLE ...` | Crea estructura |
| `TRUNCATE` | `TRUNCATE ...` | Vacia tablas |
| Funciones mutantes | `SELECT borrar_todo()` | Si existiera alguna funcion que modifica datos |

**Enforcement**: En las instrucciones del prompt se dira explicitamente: "Solo ejecutar queries SELECT. Nunca INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, ni TRUNCATE. Si necesitas verificar algo que requiere modificacion, documentar la query propuesta para que el usuario la ejecute manualmente."

**Nota tecnica**: El MCP Supabase esta configurado en modo read-only (`mcp-mode: read-only` en la config). Sin embargo, `execute_sql` tecnicamente puede ejecutar cualquier SQL. La proteccion real es la instruccion en el prompt + la revision de logs. Para mayor seguridad, se podria crear un rol PostgreSQL de solo lectura, pero eso es una mejora futura.

#### 8.4 — Orden de trabajo: BBDD primero

**Acordado:**
1. **Fase 1**: BBDD completa — schemas, tablas, columnas, relaciones, constraints, triggers
2. **Fase 2**: Codigo — componentes, hooks, APIs, leyendo archivos fuente
3. **Fase 3**: Cruce — queries que contrasten lo documentado en codigo vs lo real en BBDD
4. **Siempre documentar** — cada ejecucion deja su output en AutoMejoras/

#### 8.5 — Alcance temporal: 2026 en adelante

**Acordado:**
- CLAUDE.md: revisar de hoy (2026-05-21) hacia atras, solo contenido de 2026
- Archivos de codigo: solo los modificados durante 2026 (verificar con `git log --since="2026-01-01"`)
- Documentacion legacy (2025): ignorar por ahora
- Memorias: las vigentes (carpeta memory/ actual) si se consideran

#### 8.6 — Preguntas adicionales de Claude y respuestas del usuario

**Pregunta 1**: Task Scheduler o manual?
**Respuesta**: Automatico. Que se active cada 5 horas hasta consumir limite. No usar el limite extra comprado aparte.

**Pregunta 2**: Modelo Opus o Sonnet?
**Respuesta**: Sonnet.

**Pregunta 3**: Consumo ~3-5 mensajes por ejecucion OK?
**Respuesta**: Si, pero si luego se ve que conviene hacer algunos mas largos, se reevalua.

**Pregunta 4**: Como comunicar novedades?
**Respuesta del usuario**:
> "en novedades.md puedes dejarme tus comentarios, preguntas, respuestas. en JMS.md yo te dejare pedidos, objetivos, tareas para que vallas haciendo en tus sesiones. osea que la primer regla es ver JMS.md por actualizaciones y si las hay ver que te deje anotado. si escribo algo durante tu sesion debemos poder interactuar en vivo."

---

## 9. DECISIONES CONFIRMADAS — Resumen ejecutivo

| Parametro | Valor |
|---|---|
| **Opcion** | A (CLI directo con `.bat` + Task Scheduler) |
| **Modelo** | Sonnet (eficiente en tokens) |
| **Frecuencia** | Cada 5 horas, automatico via Task Scheduler |
| **Pausa** | Archivo `AutoMejoras/PAUSA` — si existe, no corre |
| **Limite** | Solo allowance base del plan Pro. No usar limite extra comprado |
| **Queries BBDD** | Solo SELECT. Prohibido INSERT/UPDATE/DELETE/DROP/ALTER/CREATE |
| **Modificar archivos** | Solo dentro de `AutoMejoras/`. Prohibido tocar codigo, config, o cualquier otro archivo |
| **Fase 1** | BBDD: schemas, tablas, relaciones, constraints, datos |
| **Fase 2** | Codigo: componentes, hooks, APIs, flujos |
| **Fase 3** | Cruce: contrastar documentacion vs realidad con queries |
| **Alcance temporal** | Solo data 2026. Archivos no modificados en 2026 se ignoran |
| **CLAUDE.md** | Revisar de hoy hacia atras, solo contenido 2026 |

### 9.1 — Sistema de comunicacion bidireccional

```
AutoMejoras/
  JMS.md          ← El usuario escribe aca: pedidos, objetivos, tareas, feedback
  NOVEDADES.md    ← AutoMejoras escribe aca: hallazgos, preguntas, respuestas, progreso
```

**Protocolo de cada ejecucion:**
1. **Primero**: Leer `JMS.md` — si tiene contenido nuevo, priorizar lo que el usuario pidio
2. **Segundo**: Si el usuario esta escribiendo durante la sesion (archivo cambia), leer y responder en vivo
3. **Tercero**: Hacer el trabajo programado (documentar, auditar, etc.)
4. **Ultimo**: Escribir en `NOVEDADES.md` lo que se hizo, preguntas pendientes, hallazgos

### 9.2 — Interaccion en vivo

Si el usuario escribe en `JMS.md` mientras AutoMejoras esta corriendo:
- AutoMejoras debe detectar el cambio (re-leer el archivo periodicamente durante la sesion)
- Responder en `NOVEDADES.md` inmediatamente
- Ajustar el trabajo en curso segun lo que el usuario pidio

Esto convierte AutoMejoras en un canal asincrono de comunicacion: el usuario escribe en JMS.md, AutoMejoras responde en NOVEDADES.md, como un chat lento por archivos.

---

## 10. PROXIMOS PASOS INMEDIATOS

1. **Crear los archivos base**: `JMS.md`, `NOVEDADES.md`, `CONFIG.md`
2. **Crear el `.bat`** que invoca Claude Code con las instrucciones correctas
3. **Crear la tarea en Task Scheduler** cada 5 horas
4. **Primera ejecucion de prueba** manual para validar
5. **Activar automatizacion** una vez validado

### Pregunta Claude:

> 1. Timeout por sesion: sugiero 45 minutos maximo. OK?
> 2. Primera tarea: arrancamos con "documentar estructura BBDD" como default, o queres escribir en JMS.md primero?

### Respuesta Usuario:

> "si se consume el credito en cada sesion hay algun problema? retomaria en la proxima sesion como objetivo, para la lista de primeras cosas: ideas para lograr esta continuidad intra sesion con modos de comunicacion de sesion a sesion. si se cuelga o corta cual podria ser el peligro?"
> "esta ok. en JMS anotar esa primer tarea que yo la ordeno hasta nuevo aviso."

### Respuesta Claude — Continuidad y riesgos:

#### 10.1 — Que pasa si se consume el credito a mitad de sesion

**No hay peligro.** Si Claude Code se queda sin creditos:

- La sesion se corta limpiamente (no corrompe archivos)
- Lo que ya escribio en `.md` queda guardado — cada `Write` es atomico
- Lo que NO alcanzo a escribir simplemente no existe (no queda a medio escribir)
- La proxima sesion retoma donde quedo, leyendo lo que ya se genero

**El unico "costo"** es trabajo desperdiciado: si estaba razonando sobre algo y se corto antes de escribir la conclusion, ese razonamiento se pierde. Pero como cada ejecucion empieza leyendo los `.md` existentes, sabe que falta.

#### 10.2 — Que pasa si se cuelga o se corta por timeout

**Mismo principio: no hay peligro.** Escenarios:

| Escenario | Que pasa | Peligro |
|---|---|---|
| Se corta por timeout (45 min) | Task Scheduler mata el proceso | Ninguno. Archivos ya escritos quedan. Proxima sesion retoma |
| Se cuelga (loop infinito) | Task Scheduler lo mata al timeout | Ninguno. Solo desperdicio de tokens |
| Crash de Claude Code | Proceso termina con error | Ninguno. Archivos escritos quedan |
| PC se apaga | Proceso muere | Ninguno. Archivos escritos quedan |
| Internet se cae | Claude Code falla al llamar API | Ninguno. Puede quedar un archivo parcial pero legible |

**Por que no hay peligro**: AutoMejoras solo ESCRIBE archivos `.md` en su carpeta. No modifica codigo, no modifica BBDD. Lo peor que puede pasar es un archivo `.md` incompleto que se sobreescribe en la proxima sesion.

#### 10.3 — Continuidad entre sesiones: el mecanismo

Cada sesion de Claude Code no-interactivo empieza de cero (no tiene memoria de la anterior). La continuidad se logra asi:

```
SESION N termina:
  → Escribe en NOVEDADES.md: "Hoy complete: schema public (15 tablas). Pendiente: schema msa."
  → Escribe en AutoMejoras/bbdd/schema-public.md: documentacion completa
  → Escribe en PROGRESO.md: checklist de que esta hecho y que falta

SESION N+1 arranca:
  → Lee JMS.md (hay tarea nueva del usuario?)
  → Lee PROGRESO.md (que falta hacer?)
  → Lee NOVEDADES.md (que hice ayer?)
  → Continua donde quedo: "Pendiente schema msa → empiezo por ahi"
```

**Archivo clave para continuidad: `PROGRESO.md`**

```markdown
# PROGRESO AutoMejoras

## BBDD — Estructura
- [x] Schema public: 15 tablas documentadas
- [x] Schema msa: 8 tablas documentadas
- [ ] Schema ma: pendiente
- [ ] Schema pam: no existe aun (ver nota)
- [ ] Relaciones FK: pendiente
- [ ] Triggers y funciones: pendiente

## Codigo — Componentes
- [ ] vista-extracto-bancario.tsx
- [ ] vista-cash-flow.tsx
- [ ] ...

## Auditorias
- [ ] Contrastar schema-public.md vs BD real
- [ ] ...
```

Cada sesion actualiza este archivo al final. La siguiente lo lee al principio.

#### 10.4 — Protocolo completo de cada sesion

```
1. Leer JMS.md          → hay tarea nueva? priorizar
2. Leer PROGRESO.md     → que falta? donde seguir
3. Leer NOVEDADES.md    → contexto de la sesion anterior
4. Trabajar             → documentar, auditar, queries
5. Durante la sesion    → re-leer JMS.md cada ~10 min por si el usuario escribio algo
6. Al terminar          → actualizar PROGRESO.md + NOVEDADES.md
7. Si se corta antes    → lo que ya escribio queda, la proxima retoma
```

---

#### 10.5 — Pregunta Claude: timeout 45 min OK?

**Respuesta Usuario:**
> "no le podria time auto, dejaria que se corte cuando no haya tokens. hay alguna manera de verificar cuantos tokens quedan? asi se documenta todo y nunca se consumen los ultimos minimos tokens. digamos nunca usar el equivalente a 6 mensajes."

**Respuesta Claude:**

No hay forma de consultar cuantos tokens quedan del plan. No existe un API para eso. Claude Code simplemente falla cuando se agotan.

El timeout NO es para controlar consumo de tokens — es **proteccion contra loops infinitos**. Si el programa se cuelga en un loop, sin timeout podria estar 8 horas intentando, gastando tokens sin producir nada util. 45 minutos es un seguro: si en 45 min no termino, algo anda mal.

Si la sesion termina productivamente en 10 minutos, perfecto — no llega al timeout. El timeout solo interviene si algo se rompe.

Sobre la reserva de 6 mensajes: no se puede implementar programaticamente. Lo que si se puede hacer es instruir al programa en el prompt: "mantene tus sesiones cortas y enfocadas, no intentes documentar todo en una sola sesion, prioriza escribir resultados parciales temprano para que no se pierdan si se corta".

**Decision**: Timeout de 45 minutos como seguro anti-loop. El programa corre hasta que termina naturalmente o hasta que se agotan los tokens.

---

## 11. DECISIONES FINALES CONFIRMADAS

| Parametro | Valor |
|---|---|
| Timeout por sesion | 45 minutos (seguro anti-loop, no control de consumo) |
| Si se corta | Sin peligro. Retoma en proxima sesion |
| Continuidad | Via PROGRESO.md + NOVEDADES.md |
| Primera tarea | Documentar estructura completa de BBDD |
| Comunicacion | JMS.md (usuario→programa) / NOVEDADES.md (programa→usuario) / PROGRESO.md (estado) |
| Modelo | Sonnet |
| Frecuencia | Cada 5 horas automatico via Task Scheduler |
| Pausa | Archivo AutoMejoras/PAUSA — si existe, no corre |
| Limite tokens | Solo allowance base plan Pro. No usar extra comprado |
| BBDD | Solo SELECT. Prohibido cualquier modificacion |
| Archivos | Solo escribir dentro de AutoMejoras/. Prohibido tocar resto |
| Alcance | Solo data 2026. Revisar de hoy hacia atras |

---

## 12. LISTA DE PRIORIDADES — Lo que el usuario pidio como inmediato

Extraido textualmente de las instrucciones del usuario durante la conversacion del 2026-05-21:

### PRIORIDAD 1 — Implementar AutoMejoras

1. Crear archivos base: `JMS.md`, `NOVEDADES.md`, `PROGRESO.md`, `CONFIG.md`
2. Crear el `.bat` que invoca Claude Code Sonnet con instrucciones correctas
3. Crear tarea en Task Scheduler cada 5 horas
4. Primera ejecucion de prueba manual para validar
5. Activar automatizacion

### PRIORIDAD 2 — Primera tarea del programa: BBDD

> "empezar por BBDD si, calculo luego codigo mas queries para entender. siempre documentar."

1. Listar todos los schemas y tablas
2. Para cada tabla: columnas, tipos, defaults, constraints, FK
3. Generar diagrama de relaciones en formato texto
4. Documentar triggers y funciones
5. Todo en `AutoMejoras/bbdd/`

### PRIORIDAD 3 — Continuidad entre sesiones

> "ideas para lograr esta continuidad intra sesion con modos de comunicacion de sesion a sesion"

El mecanismo basico esta definido (PROGRESO.md + NOVEDADES.md + JMS.md). Pero el usuario pidio que sea una tarea del propio programa generar ideas para mejorar este mecanismo.

### PRIORIDAD 4 — Documentacion del codigo

> "luego codigo mas queries para entender"

Despues de BBDD completa:
- Componentes, hooks, APIs
- Flujos de datos
- Queries que contrasten documentacion vs realidad

### PRIORIDAD 5 — Auditorias y listas

> "dar lista de tareas/objetivos que el usuario espera de la app"
> "de cosas pendientes (contrastar listas de pendientes documentadas desde el presente hacia el pasado)"
> "de ideas de mejoras"
> "de ideas de correcciones sobre cosas que supuestamente ya las queriamos asi pero se predetectan bugs"

1. Pendientes vigentes vs resueltos (contrastar documentacion)
2. Ideas de mejoras (analisis propio)
3. Bugs pre-detectados (contrastar intencion vs codigo)
4. Todo partiendo de data 2026, CLAUDE.md de hoy hacia atras

### PRIORIDAD 6 — Estructura de documentacion

> "dar un mapa de la estructura de documentacion desde lo micro hasta lo macro"
> "un indice total"

- Indice general (`INDICE.md`)
- Cuadros sinopticos de arquitectura
- Explicacion jerarquica
- Cada archivo autocontenido y extraible

**Estado: CONSENSUADO. Listo para implementar.**
