# 📋 PENDIENTES — Fuente única de verdad

> Único lugar donde se documentan los pendientes (bugs, testing, features, operacional, seguridad, datos).
> Reemplaza a `PENDIENTES_GENERAL.md`, `PENDIENTES_PUSH_A_MAIN.md`, `PENDIENTES-PROXIMA-SESION.md` y a las secciones de pendientes sueltas en `CLAUDE.md`.

**Última actualización:** 2026-08-02

---

## 🎯 FOCO ACTUAL (rota — el norte permanente está en `CLAUDE.md`)

> **2026-08-03 — TESTEAR LA CRÍA DESDE EL MARGEN.** El Presupuesto quedó cerrado e implementado y
> el **margen por actividad** pasó de ser un reporte a ser **la pantalla donde se trabajan los
> costos de producción**. 45 commits desde `punto-seguro-2026-08-02`.
>
> **La decisión de dónde viven los costos productivos quedó tomada: en el margen.** Cada costo se
> despliega, muestra cómo se llegó al número y se edita ahí mismo. `actividad_insumos` absorbió lo
> único que `presupuesto_variables` tenía y ella no —la **cadena de ajustes**—, así que retirarla
> ya no pierde nada (`M-03`). Lo que **no** se edita en el margen es el **planteo productivo**
> —ganancia diaria, % de ración, tramos—, que sigue siendo de la actividad.
>
> **Lo próximo, cuando el testeo de cría cierre:** que el margen resuelva los **modos de ración**
> (`M-04`), que es lo único que separa a recría y engorde de trabajarse igual.
>
> **Testear:** 12 pantallas (`A-TEST-07` a `A-TEST-17`), cada una con su *🧪 Cómo probarlo* en
> `MANUAL-USO.md`. **Empezar por `A-TEST-17`** (la cría desde el margen): es lo que valida la
> decisión de arriba.
>
> **Bloqueado por datos del usuario:** precios (se cargan **desde el margen**, con el botón del
> faltante), has productivas de Lima, el **OK al cupo anual** ([P-43](#p-43)), y **$173 M de ventas
> sin clasificar** por actividad.

------|-------|--------|
| Corte del ejercicio | **30/06/2026** | ✅ pasó |
| Papeles de trabajo → **al contador** | **01/10/2026** | 🔴 ~2 meses |
| Presentación a **ARCA** | **01/11/2026** | 🔴 ~3 meses |

**Objetivo:** que los papeles de trabajo sean un **export del sistema** → [A-FEAT-09](#a-feat-09).
El usuario avisó que puede no llegarse para el 01/10 — hay que **decidir con tiempo**, no el 25/09.

---

## 📐 Cómo usar este archivo (ESTÁNDAR — no romper)

El archivo tiene **dos partes**:

1. **ÍNDICE** → tablas livianas y escaneables. Cada ítem tiene un **ID estable** (ej. `A-SEC-01`). Esto es lo que se lee para "qué falta".
2. **DETALLES** → un dossier por ID (sólo para los ítems que lo necesitan), con el razonamiento completo, la investigación, árboles de decisión, refs de código. Esto es lo que se relee al **retomar** un tema.

El índice dice *qué* falta; los detalles dicen *por qué / cómo lo analizamos*. Se vinculan por el ID.

**Estados:** 🔴 abierto · 🟡 en progreso · ✅ hecho y testeado · ⏸️ pausado (espera decisión del usuario) · ❓ a auditar (no sé si sigue vigente)

**Tipos/áreas (sufijo del ID):** `OP` Operacional · `BUG` · `TEST` Testing · `FEAT` Feature · `SEC` Seguridad · `DAT` Datos (los carga el usuario)

**Estratos de confianza (prefijo del ID):**
- **A** — Confirmados (re-verificados contra código/git). Seguro pendientes. **Llevan detalle completo.**
- **B** — Probablemente pendientes (recientes, sin re-verificar 1×1).
- **C** — Dudosos / a auditar juntos (probable que ya no apliquen).
- **D** — Histórico CLAUDE.md (casi todo obsoleto).

⚠️ **El prefijo dice dónde NACIÓ el ítem, no dónde está hoy.** Cada estrato numeró desde 1 por su
cuenta, así que `A-FEAT-01` y `B-FEAT-01` son **dos pendientes distintos**. Al promover un ítem, el
ID **no cambia** (ver regla de identidad, abajo): un `B-*` confirmado sigue siendo `B-*` y sólo se
mueve de sección.

---

### 🔒 El ID es INMUTABLE (2026-08-20)

> **Un ID no se renumera, no se reusa y no se borra nunca.**

- ¿Quedó mal clasificado? Un bug que era feature, algo que cambia de prioridad, un `B-*` que se
  confirma → **se mueve de sección con su ID puesto**. No se le busca un ID "que corresponda".
- ¿Se resolvió? → ✅, **y la fila se queda**. Ver la lápida, abajo.
- ¿Se creó por error o duplicado? → se marca como tal; **el número no vuelve a la bolsa.**
- Antes de crear un ID nuevo: **mirar el archivo.** `P-*` y `A-FEAT-*` no son listas continuas,
  tienen huecos ocupados en el medio. El control avisa si hay duplicados, pero avisa *después*.

**Motivo — dos, y el segundo es el caro:**

1. **El ID es la identidad; el resto del string es sólo etiqueta.** `A-BUG-25` codifica estrato +
   tipo + secuencia, o sea *clasificación*. Todo identificador que codifica una clasificación va a
   tener que cambiar cuando la clasificación cambie — y ahí se rompe todo lo que apuntaba a él.
2. **Hay ~190 referencias entrantes** que ningún motor puede validar: 13 anclas desde otras
   dimensiones (7 en `CLAUDE.md`), ~83 menciones en los demás `.md`, y **94 en el código**, en 19
   archivos. Más los **comentarios que escribe el usuario desde la app**
   (`pendientes_comentarios.pendiente_id`), que son texto **sin FK y no pueden tenerla**: apuntan a
   un ID que vive en un `.md`, y Postgres no puede proteger un vínculo a un archivo.

Renumerar un ID deja todo eso colgado **en silencio**. Pasó 5 veces el 2026-08-19 (por crear IDs
sobre IDs ocupados) y salió gratis sólo porque todavía no había comentarios cargados.
→ [A-OP-09](#a-op-09)

### 🪦 Al archivar, queda la lápida

Cuando un ítem resuelto se manda a `CLAUDE_HISTORICO.md`: **se va el dossier, se queda la fila del
índice** — con ✅ y el link a dónde fue. **El ID nunca sale de este archivo.**

*Motivo: archivar es hoy la vía realista al huérfano — más que el renumerado, que ya está tapado por
el control de duplicados. Y hay un efecto lateral que la justifica sola: de los ~8.900 renglones de
este archivo, casi todos son dossier (99 dossiers contra ~1.000 filas de índice). Sacar los dossiers
cerrados lo achica de verdad **sin perder un solo ID**.*

**Regla de mantenimiento (Claude — SIEMPRE):**
1. Feature nueva implementada → fila 🔴 `A-TEST-xx` en el índice.
2. Cuando analizamos un problema y surge razonamiento que vale guardar → crear/ampliar su dossier en DETALLES con el mismo ID.
3. Usuario confirma testeo/resolución → ✅ y limpiar al cerrar sesión. **La fila se queda** (lápida).
4. Promover de B/C/D a A cuando se confirma vigencia (y recién ahí escribir su dossier).
   ⚠️ **Promover mueve el ítem de sección, NO le cambia el ID** — `B-FEAT-01` promovido sigue siendo
   `B-FEAT-01`. Renombrarlo a `A-FEAT-01` pisaría otro pendiente que ya existe.
5. Al cerrar sesión → revisar que la Sección A esté al día.
6. Cuando el usuario pregunte "qué falta" → leer **sólo el ÍNDICE de este archivo**.

---
---

# 📑 PARTE 1 — ÍNDICE

## 🅰️ SECCIÓN A — CONFIRMADOS (re-verificados 2026-06-21)

### Operacional
| ID | Estado | Prio | Ítem | Verificación |
|----|--------|------|------|--------------|
| A-OP-01 | 🔴 | Alta | MCP Supabase quedó en WRITE — revertir a read-only | ✅ `.mcp.json` sin `--read-only` `@general` |
| A-OP-02 | ✅ | Media | Archivo `nul` basura en el repo — BORRADO 2026-06-21 (era el error capturado "dir: cannot access 'vercel.json'"). `git add -A` ya funciona | resuelto |
| A-OP-03 | ✅ | Alta | **MERGEADO 2026-08-02** (`d5a9f69`, 134 commits desde el 15/07). Decisión del usuario: *"todo lo hecho viene muy bien y funciona, sería como hacer un punto seguro"*. Build limpio antes de mergear (exit 0, 34 rutas). Etiquetado **`punto-seguro-2026-08-02`** → volver es `git reset --hard punto-seguro-2026-08-02` | ✅ `main..desarrollo` = 0 |
| A-OP-04 | ⏸️ | Media | Auditar Secciones C y D junto al usuario | — `@general` |
| A-OP-05 | 🔴 | Baja | Carpeta vacía `arca-poc/` — borrar a mano (Windows handle) | — `@general` |
| A-OP-06 | 🔴 | Baja | Limpieza raíz: ~40 archivos sueltos (.xlsx/.csv/.pdf/.md untracked) **+ varios `tmpclaude-XXXX-cwd`** (temporales). ⚠️ Claude debe EXPLICAR qué es cada grupo antes de tocar | → [A-OP-06](#a-op-06) `@general` |
| A-OP-07 | 🔴 | Baja | **Triagear errores previos** del baseline (cuando haya entradas + tiempo). Log: `ERRORES_CONOCIDOS.md` | → [A-OP-07](#a-op-07) `@general` |
| A-OP-08 | 🔍 | **A verificar** | **Backup/restore Supabase confiable** — el CLAUDE histórico repetía "nunca logramos subir backup, prerequisito ABSOLUTO antes de datos reales, prioridad MÁXIMA". Puede estar parcialmente resuelto por la reconstrucción de enero (vía scripts). **Verificar si sigue vigente** y, si sí, lograr un backup/restore probado antes de producción | → [A-OP-08](#a-op-08) `@general` |
| A-OP-09 | 🔴 | Baja | **Comentarios huérfanos** — el fix de fondo ya está (ID inmutable + lápida, § Cómo usar este archivo). Queda la **red**: que el control y el panel los muestren | → [A-OP-09](#a-op-09) `@general` |
| A-OP-10 | 🔴 | Baja | **Que el ID libre lo diga una orden, no la memoria** (2026-08-27, tras chocar **dos veces en un día, en los dos sentidos**). Propuesta vigente: **agregarle un modo `--proximo A-BUG` al `verificar-parser-pendientes.mts`**, que ya lee todas las familias — *centralizar, no duplicar*. ~~Un `scripts/proximo-id.mts` nuevo~~ (mi propuesta original, descartada: duplicaba el parser). ⚠️ **Ni el comando ni "mirar antes" cierran la ventana**: dos terminales que lo corren con 10 s de diferencia reciben el mismo número, porque ninguna escribió. Lo único que reclama un ID es **escribir la fila y commitear enseguida** (`CLAUDE.md` regla 12). El comando achica la ventana de horas a segundos; la red sigue siendo el verificador. ⚠️ El script está **tomado por T2** | → [A-OP-10](#a-op-10) `@general` |

### 💰 PRESUPUESTO — lista del usuario 2026-08-02 (`P-NN`)
> Batch dictado por el usuario el 2026-08-02. **Prefijo `P-`** = mejoras del módulo Presupuesto
> (se documenta acá porque rompe el patrón `X-TIPO-NN`: es un lote temático).
> Estado: 🟢 entendido y accionable · ❓ necesita que el usuario aclare · 🔗 ya existe algo.
> Detalle y agrupación → [P-LOTE](#p-lote).

| ID | Est | Ítem |
|----|-----|------|
| P-01 | ✅ | Botón **Actualizar** en el header del panel de cuentas (relee historia, config e IPC). 2026-08-02, sin testear |
| P-02 | ❓ | **"Este mes sí/no"** en el mes de arranque: si ya se pagó, no presupuestar; si no, sí. *El usuario avisa que **contradice otras alternativas*** `@presupuesto` |
| P-03 | ⏸️ | **Sueldo mensual de presupuesto por empleado.** ⚠️ Auditado 2026-08-02: **3 empleados en $0** (AMS, Vulcano, Paz) → faltan ~$38-60 M en 11 meses, y **HONORARIOS AMS no está presupuestado en ningún lado** (excluido de cuentas "va por sueldos", y en sueldos vale cero). **Espera decisión: toca la BD** → [P-03](#p-03) `@presupuesto @sueldos` |
| P-04 | ❓ | **¿IPC siempre? ¿Está trabajando bien el IPC?** — auditar el modo `@presupuesto` |
| P-05 | 🔗 | **Costos de producción** al presupuesto — ya abierto como C-7 / B-FEAT-COSTOS-PRODUCTIVOS `@presupuesto @productivo` |
| P-06 | ❓ | **¿Las FC en dólares están bien tomadas** en el presupuesto? — auditar `@presupuesto` |
| P-07 | 🔗 | **Alerta presupuestado vs histórico** — `controlarPresupuesto()` ya existe en `modos.ts`; ver qué falta `@presupuesto` |
| P-08 | ❓ | **Kg por ha / valor Índice Novillo** como unidad de presupuestación (ej. IATF = tantos kg por cabeza por año) `@presupuesto` |
| P-09 | 🟢 | **Monto en un solo mes**, por única vez (override puntual de celda) `@presupuesto` |
| P-10 | ❓ | **Anualizado que se engrosa**: si algo se gasta 1 vez al año y se presupuesta como promedio mensual, el no-gasto de cada mes debe acumularse para el mes en que caiga `@presupuesto` |
| P-11 | ✅ | **IPC acumulado de 12 meses** en el encabezado, con hasta qué mes. Y aviso ámbar si NO hay IPC cargado (antes usaba la tasa fija en silencio). 2026-08-02, sin testear |
| P-12 | ❓ | **Ajuste de 2 meses en uno**: si hay 1 FC/mes y un mes viene vacío y otro con 2, poder corregirlo `@presupuesto` |
| P-13 | ❓ | **IATF**: cae bien en los meses que ya existen, pero poder aplicarle la fórmula **por cabeza** `@presupuesto` |
| P-14 | ❓ | **Por cabeza + IPC deberían ser acumulables** (hoy los modos son excluyentes) `@presupuesto` |
| P-15 | ✅ | **La muestra del cálculo** en la fila abierta: los datos reales que se usaron + el resultado. Los meses sin factura salen tachados. `estacional` muestra el par origen→proyectado por mes. 2026-08-02, sin testear |
| P-16 | ✅ | 🐞 **El modo "mismo del año pasado" NUNCA funcionó** — exigía 12 puntos de historia y un gasto anual tiene 1. **7 de 8 cuentas daban cero.** Arreglado 2026-08-02, falta testear → [P-16](#p-16) |
| P-17 | ❓ | **Presupuesto anual con arrastre**: poner el monto en un mes tentativo y, si no se gasta, que pase al siguiente; si no se cumple en 11 meses queda para el 12°. **+ alerta** "se gastó cero el último año y seguís presupuestando $1.500.000 anual" `@presupuesto` |
| P-18 | 🟢 | **Ver la FC desde el presupuesto**: botón "buscar FC" que devuelve el listado para elegir y recién ahí la muestra (no precargar) `@presupuesto` |
| P-19 | 🟢 | **Períodos contables de templates — YA EXISTEN, hay que USARLOS.** ⚠️ Claude afirmó el 2026-08-02 que "no hay columna de campaña"; **es falso**, lo corrigió el usuario. `egresos_sin_factura` tiene **`año`** (label "26/27"), **`periodicidad`** ('anual'\|'bianual') y **`template_origen_id`** → el template del que se clonó. El generador escribe `año: targetLabel` al renovar. Lo que falta es que el **Presupuesto los lea** `@presupuesto @egresos` |
| P-20 | ❓ | Repensar el diseño a la luz de los períodos — a ver **con el contexto específico de Templates** (decisión del usuario: no diseñar en abstracto) `@presupuesto @egresos` |
| P-21 | ⏸️ | **Sueldo y SUSS con aguinaldo** — hoy los 11 meses futuros tienen el mismo monto congelado y **dic-26 y jun-27 no tienen SAC** (~$6 M cada uno). Va junto con P-03 → [P-03](#p-03) `@presupuesto @sueldos` |
| P-22 | 🔗 | **Que templates se muestren como cuentas contables** — se cruza con C-19 / C-24 `@presupuesto @egresos` |
| P-23 | ❓ | **Cuotas que dicen "templates" pero no autogeneran la próxima campaña** si no está llena `@egresos` |
| P-24 | 🔗 | **Separar siempre en secciones**: lo que se proyecta, lo que no, y todos — C-22 paso 1 ya hizo EGRESOS/DISTRIBUCIONES `@presupuesto` |
| P-25 | ❓ | **Calendario fijo por cuenta**: Ant. Ganancias son 10 cuotas en los mismos meses; Inmobiliario 4 vencimientos fijos. Que la BD sepa el calendario y presupueste eso, dejando de lado las excepciones `@presupuesto` |
| P-26 | 🟢 | **Débitos y créditos** = 0,6% de ingresos + 0,6% de egresos, **sin contar FCI** `@presupuesto` |
| P-27 | ❓ | **Ver lo que quedó pendiente del mes anterior** (julio, en este caso) `@presupuesto` |
| P-28 | ❓ | Alternativa: **último saldo ± movimientos**, y mostrar desde el último saldo `@presupuesto` |
| P-29 | ✅ | **Impuesto Inmobiliario — NO es bug, es el caso testigo de que funciona.** Claude lo marcó como posible doble conteo; el usuario verificó (2026-08-02) que **toma bien las cuotas actuales y re-presupuesta bien el período siguiente**. **Usarlo como referencia de buen funcionamiento** al arreglar los demás |
| P-30 | ⛔ | ~~No tomar "ret o dist"~~ — **DESESTIMADO por el usuario 2026-08-02**: *"ahora no sé qué quise decir"*. Si reaparece, se vuelve a abrir `@general` |
| P-32 | 🔴 | **Batería de controles — REQUISITO DE CIERRE del módulo.** *"Habrá muchos controles para sentirme seguro… es un requisito pasar por esto para considerar terminado el módulo y es uno de los puntos principales."* Hoy sólo existe `controlarPresupuesto()`. Ideas → [P-32](#p-32) `@presupuesto` |
| P-42 | ⏸️ | 📍 **Donde se configura determina donde se muestra** (contracara de la regla A) + **las ventas presupuestadas piden actividad** + **no recargar lo que ya esta en Productivo** (venta de agosto, 55 machos) → [P-42](#p-42) `@presupuesto` |
| P-41 | 🟡 | 🗺️ **Campos, actividades y has por campana** — ✅ **BD HECHA 2026-08-02**: `centros_costo.tipo`, tablas `campos`, `campo_partidas`, `campo_campana_actividad` + vista `control_has_por_campana`. Cargados 5 campos, 20 partidas y la campana 26/27. **Falta la UI** → [P-41](#p-41) `@presupuesto @productivo` |
| P-40 | ⏸️ | 🔴 **El presupuesto se arma por RESPONSABLE, no por quien paga** — hoy el filtro mira solo `responsable` e ignora `responsable_interno`. **4 templates estan de mas en el presupuesto de MSA** (2 con interno JMS, 1 con MA, 1 mixto) → [P-40](#p-40) `@presupuesto` |
| P-38 | ⏸️ | 📊 **Export del presupuesto para los socios** — varias hojas, Excel + PDF, **presentable** (estetica), con reportes sinteticos y desglose por capas. Hacerlo DESPUES de cerrar la estructura → [P-38](#p-38) `@presupuesto` |
| P-39 | ⏸️ | 🔖 **Marcar una variable como "sin terminar a proposito"** — distingue el olvido de la decision; la alerta va en su propio renglon. Complementa el control de cobertura → [P-39](#p-39) `@presupuesto` |
| P-36 | ⏸️ | 🏗️ **Bloque INVERSIONES** — lista a mano con nombre especifico ("2 silos de autoconsumo 7 Ton c/u"), centro de costo, **explicacion de por que se invierte**, monto y plazo → [P-36](#p-36) `@cashflow` |
| P-37 | ⏸️ | ⭐ **Como se modelan las variables especificas** — el usuario: *"no quisiera armar 100 tablas pero tampoco se si se puede unificar"*. Respuesta: **CANTIDAD × PRECIO**, una sola tabla; lo que cambia es de donde sale cada uno. **Hay que cerrarla ANTES de escribir codigo de costos productivos** → [P-37](#p-37) `@principal` |
| P-34 | ⏸️ | 📝 **Notas para Claude desde la app** — botón que captura el contexto solo (pantalla, componente, registro). Una nota es una **grabación de N capturas** con Finalizar, no un evento. Regla: la nota NO es un pendiente, es bandeja de entrada → [P-34](#p-34) `@general` |
| P-35 | ⏸️ | 👷 **Modelo de sueldos para presupuesto** — dictado completo por el usuario: plantilla fija, aguinaldo 50% en jun/dic, francos aparte, extra anual, jornales, IPC en escalones, SUSS +50% en ene/jul. 🔴 **Cargas Sociales está en \$0 desde agosto** → [P-35](#p-35) `@presupuesto @sueldos` |
| P-33 | 🟡 | **Auditado 2026-08-02** → [P-33](#p-33). De las 9 cuentas excluidas, **sólo 4 lo están por diseño**: 4 son **features faltantes** disfrazadas de exclusión (IPC+%, elegir mes, cupo anual, costos directos) y 1 es un gasto dado de baja. **El presupuesto está subestimado en esas 4.** Falta implementarlas `@presupuesto` |
| P-31 | 🔗 | **Vincular las proyecciones de venta al presupuesto** — se cruza con A-FEAT-10 y con Ingresos/arrendamientos `@presupuesto @ingresos` |

### 🐄 MARGEN POR ACTIVIDAD — módulo nuevo (2026-08-02)
| ID | Est | Ítem |
|----|-----|------|
| M-01 | 🟡 | **Módulo Margen por actividad** — Arrend. Rojas · Arrend. Nazarenas (agrícolas) · **Cría** · Recría. Modelo teórico + real por campaña, y de ahí salen los **costos directos** del presupuesto. Fuente: `exports_app/MARGENES - Situacion Actual.xlsx` § MARGEN CRIA | → [M-01](#m-01) `@presupuesto @productivo` |

### 🏁 Norte — features del resultado final (2026-08-02)
> Salen de la ampliación del norte (§ [A-DOC-07](#a-doc-07)). Son **objetivos grandes**, no tareas:
> se van abordando a medida que los eventos los piden. Sirven para saber si algo que estamos
> haciendo suma o no.

| ID | Estado | Prio | Ítem | Detalle |
|----|--------|------|------|---------|
| A-FEAT-09 | 🔴 | **Alta (fecha)** | **Papeles de trabajo del balance = export del sistema** — balance 25/26, corte 30/06/26, al contador **01/10/2026**. Puede no llegarse: decidir con tiempo | → [A-FEAT-09](#a-feat-09) `@reporte` |
| A-FEAT-10 | 🔴 | Alta | **Resultado del período en curso** = lo registrado a la fecha **+ presupuesto** de lo que falta | → [A-FEAT-10](#a-feat-10) `@reporte` |
| A-FEAT-11 | 🔴 | Media | **Presupuesto a 2 años constante** (siempre 2 años por delante, no un ejercicio que se arma una vez) | → [A-FEAT-11](#a-feat-11) `@presupuesto` |
| A-FEAT-12 | 🔴 | Media | **Resultado por actividad**, período por período, **+ proyección** | → [A-FEAT-12](#a-feat-12) `@reporte` |
| A-FEAT-13 | 🔴 | **Alta** | **Cash Flow multi-empresa: las facturas de PAM y MA no se pueden pagar** — hoy el Cash Flow lee sólo `msa`, así que las 4 FC de PAM y las 92 de MA no tienen dónde registrarse. Plan acordado con el usuario 2026-08-07, 7 pasos | → [A-FEAT-13](#a-feat-13) `@cashflow` |

### 📚 Documentación (auditoría de dimensiones, 2026-08-02)
> Origen: comparación de nuestro `CLAUDE.md` contra el `CLAUDE.md` de otro proyecto del usuario ("Remates Televisados"), que trajo reglas de proceso mejores. Salió de ahí `CLAUDE_BASE.md` (plantilla portable) + esta auditoría de los 31 `.md` del repo. **Casi todos esperan una decisión del usuario (⏸️), no trabajo de Claude.**

| ID | Estado | Prio | Ítem | Detalle |
|----|--------|------|------|---------|
| A-DOC-01 | ✅ | **Alta** | **Lista de dimensiones cerrada** — DECIDIDO 2026-08-02: 8 dimensiones + regla de cierre + **Claude no crea dimensiones sin autorización**. Aplicado a `CLAUDE.md` | → [A-DOC-01](#a-doc-01) |
| A-DOC-02 | ✅ | Media | 13 docs de módulo con 4 convenciones → **renombrados a `MODULO_*` 2026-08-02** (`git mv`, historial intacto) + `MODULO_ARCA.md` creado | → [A-DOC-02](#a-doc-02) |
| A-DOC-02b | 🔴 | Baja | **Consolidar SICORE** — quedan `MODULO_SICORE.md` (51 KB) + `MODULO_SICORE_RETENCIONES.md` (12 KB) + la historia cruda en `arca-api/`. Abordar al tocar el módulo | → [A-DOC-02b](#a-doc-02b) |
| A-DOC-09 | 🔴 | Media | **`MODULO_ARCA.md` está a medias** — documenta `arca-api/` (la puerta de entrada) pero NO el lado de la app: `app/api/arca`, `lib/arca`, importador, vistas, reglas por CUIT, relación con GAS | → [A-DOC-09](#a-doc-09) `@general` |
| A-DOC-03 | ⏸️ | Baja | 3 archivos de reconstrucción (553 KB) del mismo tema; sólo 1 declarado | → [A-DOC-03](#a-doc-03) `@general` |
| A-DOC-04 | ⏸️ | Baja | `README.md` (ago-2025) desactualizado y fuera de toda dimensión | → [A-DOC-04](#a-doc-04) `@general` |
| A-DOC-05 | ✅ | Media | 5 `.md` huérfanos — RESUELTOS 2026-08-02: sesión→HISTORIAL · `Usuarios.md`→`MODULO_USUARIOS.md` (+ [A-SEC-03](#a-sec-03)) · 2 de ARCA→`MODULO_ARCA.md` · las plantillas se las lleva el usuario | → [A-DOC-05](#a-doc-05) |
| A-DOC-06 | ✅ | Media | 6 reglas permanentes vivían **sólo en memoria** — SUBIDAS a `CLAUDE.md` 2026-08-02 (2 § nuevas + 1 bullet); memorias reducidas a punteros | → [A-DOC-06](#a-doc-06) |
| A-DOC-07 | ✅ | Media | Qué es + **norte** en `CLAUDE.md` (2026-08-02). Norte = presupuesto autoalimentado; **todo alimenta al presupuesto**. Queda **abierto a ampliación** por el usuario | → [A-DOC-07](#a-doc-07) |
| A-DOC-08 | ✅ | Media | Lista de 47 ítems sin testear vivía en memoria y **B-TEST-10 la citaba desde acá** — MIGRADA 2026-08-02: 8 filas nuevas (`B-TEST-11..18`) + 28 a [C-01](#c-01) transcriptos | → [A-DOC-08](#a-doc-08) |
| A-DOC-10 | 🔴 | Media | **Otras 19 fugas doc→memoria** — `B-TEST-10` NO era la única: hay ~19 `"Detalle: memory/…"` repartidas en 5 dimensiones. Hay que absorber el contenido | → [A-DOC-10](#a-doc-10) `@general` |

### Bugs (sesiones de junio)
| ID | Estado | Prio | Ítem | Detalle |
|----|--------|------|------|---------|
| A-BUG-01 | 🔴 | Media | Grupos de Pago — 6 bugs caso Alcorta | → [A-BUG-01](#a-bug-01) `@egresos @cashflow` |
| A-BUG-02 | 🔴 | Media | Grupo ARBA `a177c1fb` desfase $5.701,30 | → [A-BUG-02](#a-bug-02) `@egresos @cashflow` |
| A-BUG-03 | 🔴 | Media | Modo Admin facturas — modificar campos no funciona | → [A-BUG-03](#a-bug-03) `@egresos` |
| A-BUG-11 | 🔴 | Alta | Tarjetas: seleccionar tarjeta no cambiaba la vista — ✅ FIX APLICADO (tabla_bd vs id + hook recarga por schema), falta testear | → [A-TEST-05](#a-test-05) `@extracto` |
| A-BUG-12 | 🔴 | **Alta** | Tarjeta — conciliación auto contra `credito` **diverge del motor** (sin fecha → riesgo cruzar períodos; ±1 monto; sin estado auditar). Hay que alinearla al razonamiento del motor | → [A-BUG-12](#a-bug-12) `@extracto` |

### Testing — módulos recientes
| ID | Estado | Ítem | Detalle |
|----|--------|------|---------|
| A-TEST-01 | 🔴 | Lotes Galicia — export Excel banco | → [A-TEST-01](#a-test-01) `@egresos @cashflow` |
| A-TEST-02 | 🔴 | GAS PDF — descarga automática facturas | → [A-TEST-02](#a-test-02) `@egresos` |
| A-TEST-03 | 🔴 | Módulo ARCA Mis Comprobantes | → [A-TEST-03](#a-test-03) `@egresos` |
| A-TEST-04 | 🔴 | SICORE estado_quincena + anulación | → [A-TEST-04](#a-test-04) `@egresos` |
| A-TEST-05 | 🔴 | Tarjetas — probar PDF real | → [A-TEST-05](#a-test-05) `@extracto` |
| A-TEST-06 | 🟡 | Refactor fechas FASE TEMPLATES (`fecha_pago` separado de venc) — testear en preview ANTES de fase ARCA | → [A-TEST-06](#a-test-06) `@egresos @cashflow` |

### Seguridad
| ID | Estado | Prio | Ítem | Detalle |
|----|--------|------|------|---------|
| A-SEC-01 | 🔴 | Alta | Hardening — anon puede borrar todo + plan P0/P1/P2 | → [A-SEC-01](#a-sec-01) `@general` |
| A-SEC-03 | 🔴 | **Alta** | **Terminar el módulo Usuarios y ponerlo activo** — el plan completo (RLS Opción A, 9 pasos) está escrito en `MODULO_USUARIOS.md` desde abr-2026 y **nunca se implementó**. Es el fix de fondo de A-SEC-01. Incluye un bug: `VistaEgresos` no recibe el prop `userRole` | → [A-SEC-03](#a-sec-03) `@general` |
| A-SEC-02 | 🔴 | **Urgente** | **Token Supabase filtrado en el repo** — había un PAT (`sbp_dc35…`, admin de toda la cuenta) hardcodeado en `KNOWLEDGE.md`. GitHub Secret Scanning bloqueó el push (2026-07-09). **Redactado** del archivo, PERO **sigue en el historial de git**. **Hallazgo (2026-07-09):** en ESTA PC el token filtrado NO está en ningún config activo (solo en artefactos de Claude Code: file-history + transcript de la sesión). El `.mcp.json` activo usa OTRO token ("claude-mcp-control-presupuestario", 30 min). **ORIGEN DEL "14 días" IDENTIFICADO (2026-07-09):** el token filtrado está en `.mcp.json`/KNOWLEDGE.md de **carpetas de BACKUP viejas del proyecto** (`Control-Presupuestario-v1.1 - 250817...` y `..._BACKUP_...20250815...`) → trabajar en una copia vieja lo usó. También en **`CREDENCIALES_SUPABASE_NUEVO.md`** (carpeta activa, sin commitear) + artefactos Claude Code. **Acción:** revocar el filtrado en Supabase (el proyecto activo usa otro token → NO rompe nada actual; solo las copias viejas, que si las usás les ponés el nuevo). Limpiar el token de `CREDENCIALES_SUPABASE_NUEVO.md` y backups. **+ 2026-08-02 (auditoría A-DOC):** `CREDENCIALES_SUPABASE_NUEVO.md` sigue en la raíz (untracked). Además de limpiar el token, sacarlo del repo y `.gitignore`-arlo — un `git add -A` distraído lo commitea. `@general` |

### Datos (los carga el usuario)
| ID | Estado | Ítem |
|----|--------|------|
| A-DAT-01 | 🔴 | Stocks negativos agroquímicos — cargar compras (2,4 DB −42 · Coadyuvante −12,85 · Flumetsulam −11,2 · 2,4D −23,2 · Metsulfuron −0,15) `@productivo` |
| A-DAT-02 | 🔴 | Revisar 4 facturas excluidas del fix motor (ICT NET 10558/10661/10762 + FERNANDEZ 1168) `@extracto` |
| A-DAT-03 | 🔴 | Revisar Excel jerarquía de cuentas (`Jerarquia_Cuentas_Contables.xlsx`) `@dashboard @presupuesto` |

### 🔬 Revisión Conciliación (2026-06-21) — SOLO ANÁLISIS (decidir qué hacer después)
> 10 temas que el usuario pidió investigar. Estado: análisis en curso. NO tocar código todavía. Mapeo a la lista original del usuario entre paréntesis.

| ID | Estado | Tipo | Tema (nº del usuario) | Detalle |
|----|--------|------|------------------------|---------|
| A-BUG-04 | 🔍 | Bug | Motor no concilia casi ningún sueldo (#1) | → [A-BUG-04](#a-bug-04) `@extracto` |
| A-BUG-05 | 🔍 | Bug | Conciliación manual (reasignar) borra/no copia datos: nro_cuenta, proveedor, detalle (#2) | → [A-BUG-05](#a-bug-05) `@extracto` |
| A-FEAT-01 | 🔴 | Feat | Correr el motor acotado a lo filtrado/en pantalla (#3) — ✅ IMPLEMENTADO, falta testear | → [A-FEAT-01](#a-feat-01) `@extracto` |
| A-BUG-06 | 🔍 | Bug | Reasignar muestra a veces pocas y a veces muchas FC — lógica poco clara (#4) | → [A-BUG-06](#a-bug-06) `@extracto` |
| A-BUG-07 | 🔍 | Bug | Detalle no homogéneo entre las formas de conciliar; templates ¿llenan detalle+cuota? (#5) | → [A-BUG-07](#a-bug-07) `@extracto` |
| A-BUG-08 | 🔍 | Bug | Conciliación de sueldos ¿llena detalle? — verificar con la última conciliación (#6) | → [A-BUG-08](#a-bug-08) `@extracto @sueldos` |
| A-FEAT-02 | 🔍 | Feat | Editar extracto: ofrece cuentas contables pero NO templates (#7) | → [A-FEAT-02](#a-feat-02) `@extracto` |
| A-FEAT-03 | 🔍 | Feat | Contable/Interno: mostrar los existentes para no duplicar parecidos (#8) | → [A-FEAT-03](#a-feat-03) `@extracto` |
| A-FEAT-04 | 🔍 | Feat | DIST MA + retención SICORE: la retención también es DIST MA pero SICORE agrupa (arquitectura) (#9) | → [A-FEAT-04](#a-feat-04) `@extracto @egresos` |
| A-BUG-09 | 🔍 | Bug | Revisar no-conciliados que deberían haber conciliado (mismo monto) + reglas a agregar (#10) | → [A-BUG-09](#a-bug-09) `@extracto` |
| A-BUG-13 | ⏸️ | Bug | **Una regla uni-responsable no matchea un template multi-responsable** — `MSA/PAM` no encuentra la regla de `MSA` ni la de `PAM`. Postergado por el usuario **para los ajustes finales** | → [A-BUG-13](#a-bug-13) `@extracto` |

### 🧩 Parseo de extractos (Caja de Ahorro) — huecos abiertos 2026-08-09
> Salieron de revisar los datos reales con el usuario. **Decisión suya: no se arreglan de a uno
> ahora — se ven todos juntos al final.** Acá quedan registrados para que ese repaso exista.

| ID | Estado | Tipo | Tema | Detalle |
|----|--------|------|------|---------|
| A-BUG-14 | 🔴 | Bug | **PAM perdió el CUIT en 2 de 25 movimientos** — la cuenta SÍ está parseada, así que acá el desglose falló de verdad | → [A-BUG-14](#a-bug-14) `@extracto` |
| A-BUG-15 | 🔴 | Bug | `Nro Operacion: 200112733` **no lo agarra** el modo *Nº de operación* (busca `OP:` u `OPERACION␣`, y acá hay dos puntos) | → [A-BUG-15](#a-bug-15) `@extracto` |
| A-BUG-16 | 🟡 | Riesgo | Una regla `línea N → leyendas_adicionales_2` puede meter **el CBU en la columna del CUIT** y la contraparte deja de matchear sin aviso. **Mitigado** en la UI, no cerrado | → [A-BUG-16](#a-bug-16) `@extracto` |
| A-FEAT-14 | ✅ | Feat | Las reglas vigentes no mostraban ejemplo — **HECHO 2026-08-09** (`9cffeef`), falta testear | → [A-FEAT-14](#a-feat-14) |
| **A-BUG-17** | 🔴 | **Bug** | **Un mismo tipo llega con dos formatos distintos y las reglas por número de línea fallan en el 30 %** — `TRANSFERENCIA A TERCEROS` viene con 5 o con 6 líneas, y el CUIT cambia de lugar. Encontrado al revisar las reglas que cargó el usuario | → [A-BUG-17](#a-bug-17) `@extracto` |
| A-FEAT-15 | 🔴 | Feat | La pantalla muestra **un** movimiento de ejemplo por tipo y no avisa si hay más de un formato. Es lo que dejó pasar A-BUG-17 | → [A-BUG-17](#a-bug-17) `@extracto` |
| A-FEAT-16 | 🟡 | Feat | La tarjeta y el código de autorización van a **columnas invertidas** según el tipo. Decidir una convención y unificar | → [A-FEAT-16](#a-feat-16) `@extracto` |
| **A-BUG-19** | ✅ | **Bug** | **ARREGLADO Y TESTEADO 2026-08-10.** Cash Flow: los sueldos vuelven a «pagar» solos — se marcan como pagados, y al salir y volver a Cash Flow están de nuevo pendientes. Reportado por el usuario 2026-08-10 | → [A-BUG-19](#a-bug-19) |
| **A-BUG-20** | 🟡 | **Bug** | **ARREGLADO 2026-08-10, sin testear.** 🔁 REGRESIÓN — cancelar el cartel de SICORE **no aborta el proceso**: el lote queda a medias, todas en `pagar`. Ya se había arreglado antes y volvió | → [A-BUG-20](#a-bug-20) `@cashflow` |
| A-FEAT-22 | 🟡 | Feat | **HECHO 2026-08-10, sin testear.** Confirmar la fecha de pago ANTES de SICORE — hoy la fecha se asume y SICORE depende de ella. Proponer hoy, editable, con 3 salidas | → [A-FEAT-22](#a-feat-22) `@ingresos` |
| A-FEAT-23 | 🟡 | Feat | **HECHO 2026-08-10, sin testear.** Al escribir una fecha con **día y mes pero sin año**, autocompletar con el año actual | → [A-FEAT-23](#a-feat-23) `@ingresos` |
| **A-BUG-22** | 🟡 | **Bug** | **ARREGLADO 2026-08-10, sin testear.** A las **Fac C** se les proponía SICORE. El guard existía pero era **código muerto**: `tipo_comprobante` nunca llegaba a la fila | → [A-BUG-22](#a-bug-22) `@cashflow` |
| **A-BUG-21** | 🔴 | **Bug** | **ARCA calcula la quincena de SICORE desde `fecha_vencimiento`**, no desde la fecha de pago — misma falla que se arregló en Cash Flow. Y tiene una **copia local** de `generarQuincenaSicore` | → [A-BUG-21](#a-bug-21) `@egresos` |
| A-FEAT-20 | 🟡 | Feat | **HECHO 2026-08-10** — CBU → `tipo_de_movimiento` (decisión del usuario), banco → `leyendas_4`, modos `cbu` y `tarjeta`. Falta testear | → [A-FEAT-20](#a-feat-20) `@extracto` |
| A-FEAT-21 | 🟡 | Feat | **HECHO 2026-08-10** — una tarjeta por forma; se fue el selector de alcance y el de formas. Falta testear | → [A-FEAT-21](#a-feat-21) `@extracto` |
| A-TEST-26 | 🔴 | Test | **Reglas de parseo + Re-parsear + formas múltiples** (2026-08-09/10) — configurar un tipo, ver la vista previa **en todas las formas**, guardar, re-parsear en seco y aplicar. `MANUAL-USO.md` § Reglas de parseo | → [A-TEST-26](#a-test-26) `@extracto` |
| **A-BUG-18** | 🔴 | **Bug** | **Una regla de conciliación por CUIT NO mira donde el parseo escribe el CUIT** — lee `numero_de_comprobante \|\| observaciones_cliente`, pero el parseo lo guarda en `leyendas_adicionales_2`. En Caja de Ahorro nunca puede matchear | → [A-BUG-18](#a-bug-18) `@extracto` |
| A-FEAT-17 | 🔴 | Feat | **Reglas de conciliación a partir del parseo** — propuesta en 4 niveles, del que ya funciona solo al CUIT → proveedor → factura. Pedido del usuario 2026-08-09 | → [A-FEAT-17](#a-feat-17) `@extracto` |
| A-FEAT-18 | 🟡 | Feat | **Identidad del tipo = 1ª línea + forma.** **Caminos A y B HECHOS 2026-08-10**, SQL corrido — reglas por forma (`firma_forma`) y, si la forma no coincide, **no se parsea**. Falta testear + ajustar las 3 reglas que fallan | → [A-FEAT-18](#a-feat-18) `@extracto` |
| A-FEAT-19 | 🔴 | Feat | **Chequeo de consistencia de las reglas cargadas** — el usuario no está seguro de haber adjudicado bien las columnas | → [A-FEAT-19](#a-feat-19) `@extracto` |
| **A-BUG-24** | 🟡 | **Bug** | **HECHO 2026-08-13** — el PDF "Detalle de Pago" no sumaba el descuento al Total Cancelado (decía $520.978,69 sobre una FC de $548.398,62 cancelada entera). Arreglado en los 3 cálculos **y borrada la copia inline** de Egresos: ahora hay una sola implementación. Falta testear | → [A-BUG-24](#a-bug-24) `@egresos @cashflow` |
| A-FEAT-27 | 🟡 | Feat | **HECHO 2026-08-13** — subdiario de ventas para las 3 empresas: creada `pam.comprobantes_venta`, niveladas las 4 columnas que le faltaban a MA (sin ellas el importador fallaba) y agregado el tab **Subdiarios PAM**. Falta testear | → [A-FEAT-27](#a-feat-27) `@ingresos` |
| **A-DEC-02** | 🔴 | Decisión | **MA y PAM no están inscriptas en IVA** (confirmado 2026-08-18): facturan sólo arrendamiento en Fac C, así que su "Libro IVA Ventas" sale en $0 y todo cae en el bloque de abajo. Es correcto en los números → queda decidir **cómo se llaman los bloques** cuando la empresa no liquida IVA. *(El punto 2, el total en `imp_op_exentas`, quedó cerrado: es lo correcto.)* | → [A-DEC-02](#a-dec-02) `@ingresos` |
| **A-BUG-25** | ✅ | **Bug** | **RESUELTO 2026-08-18** — el CUIT de Sanpa estaba mal tipeado (`30712200662`, dígito verificador inválido) en **4 lugares**: los 2 contratos de Rojas, la FC del 11/05 y el maestro `proveedores`. Los 4 corregidos a `30712200622` con autorización del usuario. Por eso la alerta ofrecía la factura equivocada | → [A-BUG-25](#a-bug-25) `@principal @ingresos` |
| A-TEST-30 | 🔴 | Test | **Alerta de facturas de venta: segundo camino por importe** (2026-08-18) — si el CUIT no matchea pero el importe cierra exacto, la factura se ofrece igual, en ámbar y con los dos CUIT + su verificador. Nuevo `lib/cuit.ts` | → [A-BUG-25](#a-bug-25) `@principal` |
| **A-BUG-26** | 🟡 | **Bug** | **HECHO 2026-08-18** — el Margen ignoraba el ajuste manual de cabezas de un lote (`cantidad_calculada ?? cantidad`, al revés). Corregías 200→195 y el margen facturaba 200: ~$3 M de ingreso inventado. Latente: hoy ningún lote tiene ajuste manual. Falta testear | → [A-FEAT-25](#a-feat-25) `@presupuesto` |
| **A-BUG-27** | 🟡 | **Bug** | **HECHO 2026-08-18** — el Cash Flow contaba la misma plata 2 veces: el anticipo de cobro y la factura entera. `mapearVentas` restaba retenciones pero **no los anticipos vinculados** (ventas no tiene `monto_a_abonar` que se reduzca, como sí compras). Detectado por una **nota del usuario desde la app**. Falta testear | → [A-BUG-27](#a-bug-27) `@cashflow` |
| **P-44** | 🔴 | **Bug** | **Las capturas de las notas llegan vacías** (`notas_capturas.imagen` = 0 bytes en las 3 existentes). Texto y contexto sí se guardan. Y con un **modal abierto la herramienta no se puede usar** — justo cuando aparece el error que se quiere reportar | → [P-44](#p-44) `@general` |
| P-45 | 🔴 | Bug | **Pasar una factura a "pagado" pregunta si cambiar la fecha aunque `fecha_pago` ya sea hoy.** Nota del usuario "Fecha de pago" (caso Longo, 18/08) | → [P-44](#p-44) `@cashflow` |
| A-TEST-32 | 🟡 | Test | **Anticipos de COBRO vinculables a facturas de venta** (2026-08-18) — **1er cobro TESTEADO OK** por el usuario. Falta el 2º que cierra la factura y el caso A. 🔴 Destraba **$134,1 M** en 5 cobros que nunca se pudieron imputar | → [A-TEST-32](#a-test-32) `@cashflow @principal` |
| A-FEAT-26 | 🔴 | Feat | **Imputar los 5 cobros viejos** ($134,1 M: 4 de Pedro Genta + BALLESTER). Los de Genta son ganadería y **el contrato no tiene CUIT**, así que no matchean por CUIT hasta cargarlo | → [A-TEST-32](#a-test-32) `@cashflow` |
| **P-46** | 🟡 | Feat | **HECHO 2026-08-19 — las 4 etapas.** Panel de pendientes en la app (Principal → Pendientes): lee `PENDIENTES.md`, agrupa en 6 categorías, filtra por pantalla, y cada solapa muestra su contador. **260 pendientes ubicados, 0 sin revisar.** Falta testear | → [P-46](#p-46) `@principal` |
| **A-FEAT-25** | 🔴 | Feat | **Escenarios de margen** (diseño, 2026-08-18) — poder guardar hipótesis ("195 terneros con 30 has de avena") sin ensuciar lo real. Márgenes **no guarda variantes** hoy, pero ya tiene todo el motor. El escenario = **overrides sobre lo real**, no una copia. 2 definiciones tomadas: costos por **existencia inicial**, y **default del dato real siempre editable** | → [A-FEAT-25](#a-feat-25) `@presupuesto @productivo` |
| A-TEST-31 | 🔴 | Test | **Ingresos por jerarquía empresa → vista** (2026-08-18) — de 8 solapas planas a 2 niveles: MSA/PAM/MA y adentro Arrendamientos · Ventas · Comprobantes · Cobros · Subdiarios · Ganadería. Sin cambios de funcionamiento. `MANUAL-USO.md` § Ingresos | → [A-TEST-31](#a-test-31) `@ingresos` |
| **A-FEAT-24** | 🔴 | Feat | **Cobros no puede existir en PAM/MA**: `comprobante_venta_id` está sólo en `public.msa_galicia`. Los extractos de PAM (`pam_galicia`, `pam_galicia_cc`) y MA (`ma.ma_galicia`) **no tienen la columna**, así que ahí un cobro no se puede vincular a una factura | → [A-FEAT-24](#a-feat-24) `@ingresos` |
| A-FEAT-28 | 🔴 | Feat | **La fijación de arrendamiento no emite el comprobante de venta** — `ventas_arrendamiento.comprobante_id` existe pero **nadie lo escribe ni lo lee** (sólo está en el tipo TS). El arrendamiento de PAM/MA hay que cargarlo dos veces: una en el contrato y otra a mano en el subdiario. Va contra el norte (cargar una sola vez) | → [A-FEAT-28](#a-feat-28) `@ingresos` |
| A-TEST-29 | 🔴 | Test | **Importador de ventas multiempresa** (2026-08-13) — estaba fijo en `msa`; ahora toma `empresa` y cada subdiario tiene su botón **Importar**. `MANUAL-USO.md` § Importar comprobantes de venta | → [A-TEST-29](#a-test-29) `@ingresos` |
| A-TEST-28 | 🔴 | Test | **Libro IVA Ventas: export igualado a Compras** (2026-08-13) — un solo botón genera PDF+Excel, pregunta carpeta, no sobrescribe; PDF con el formato de Compras (rango de fechas, TOTALES, página de alícuotas). Cierra **B-FEAT-06**. 6 pasos en `MANUAL-USO.md` § Export del Libro IVA | → [A-TEST-28](#a-test-28) `@ingresos` |
| A-TEST-27 | 🔴 | Test | **Control de cuadratura del subdiario** (2026-08-13) — barra bajo los 2 bloques en Compras **y** Ventas: `Total − Neto − Exento/NG − IVA − Otros Trib. − sin crédito = 0`, con tolerancia por redondeo y listado de los comprobantes que no cierran. 4 pasos en `MANUAL-USO.md` § Control de cuadratura | → [A-TEST-27](#a-test-27) `@egresos @ingresos` |
| A-BUG-23 | 🟡 | **Bug** | **HECHO 2026-08-13** — el alta de comprobantes de venta estampaba `alicuota_iva = 21` por defecto, aun en operaciones 100% exentas (caso SANPA SEMILLAS 07/2026: IVA $0 con "21%" en el Libro). Se auto-reproducía: abrir el comprobante y guardar lo volvía a poner. Fila corregida a `null` + modal arreglado. Falta testear | → [A-BUG-23](#a-bug-23) `@ingresos` |
| **A-BUG-28** | 🔴 | **Bug** | **HECHO 2026-08-18** — el CUIT del empleado se guarda **con guiones** (`20-28749254-6`) y el banco lo manda sin (`20287492546`); el motor los comparaba con `===`. El pre-filtro por CUIT estaba **muerto para todos los sueldos**, no sólo AMS. Falta testear | → [A-BUG-28](#a-bug-28) `@extracto` |
| **A-BUG-29** | 🔴 | **Bug** | **HECHO 2026-08-18** — el pre-filtro por CUIT **excluía en vez de priorizar**: el fallback sólo se disparaba si el CUIT no tenía **ningún** candidato. Bastaba **una** factura del mismo CUIT para reducir el pool y no recuperarse nunca. Falta testear | → [A-BUG-28](#a-bug-28) `@extracto` |
| **A-BUG-30** | 🟡 | **Bug** | **HECHO 2026-08-19** — al conciliar un **sueldo**, el motor dejaba `comprobantes_pagados` en **null** y volcaba el texto decorativo del Cash Flow en `detalle` (*"Pago Saldo AMS - Pago Saldo Abr 2026"*, repetido). Causa única: las filas individuales de sueldo no definían `comprobante_display` ni `detalle_usuario`. Falta testear | → [A-BUG-30](#a-bug-30) `@extracto @cashflow` |
| **A-BUG-31** | 🟡 | **Bug** | **HECHO 2026-08-19** — reasignar un movimiento **no limpiaba el vínculo anterior**: el débito del 01/06 pasó a `CAJA` y siguió apuntando al `sueldo_pago_id` del 29/05, con dos movimientos reclamando el mismo pago de $1,2 M. Ahora las 3 ramas de asignación limpian los vínculos ajenos + `motivo_revision`. **Fila corregida en BD con OK del usuario.** Falta testear | → [A-BUG-31](#a-bug-31) `@extracto` |
| **A-BUG-32** | 🟡 | **Bug** | **HECHO 2026-08-19** — los 2 movimientos de AMS ya conciliados habían quedado con los campos viejos (el fix de [A-BUG-30](#a-bug-30) sólo actúa de ahí en adelante). **Filas corregidas en BD con OK del usuario**: `comprobantes_pagados` = `Pago Saldo Abr 2026` / `Anticipo May 2026` y su `detalle` derivado | → [A-BUG-30](#a-bug-30) `@extracto` |
| **A-BUG-33** | 🔴 | **Bug** | **15 pagos de sueldo en `conciliado` sin que NINGÚN movimiento bancario los reclame — $16,9 M** (cruzado contra las 4 tablas de extracto). Como el Cash Flow excluye lo conciliado, sus débitos **no tienen contra qué matchear nunca**. Causa según el usuario: *"había un bug en sueldos que iban a conciliado directo"*, **sin saber si sigue vivo**. Dossier con la foto al 2026-08-19 y el control para repetirlo | → [A-BUG-33](#a-bug-33) `@extracto @sueldos` |
| **A-FEAT-31** | 🔴 | Feat | **Homogeneizar las columnas del extracto** — la convención ya existe (`MODULO_CONCILIACION.md` § 30) pero los **4 caminos** que escriben al extracto no la respetan igual. ⚠️ Antes de tocar nada hay que **resolver una contradicción**: § 30.1 dice que `detalle` nunca se autocompleta y A-BUG-07 lo hizo derivar para que la grilla se leyera. Dossier con la convención, la contradicción y los 6 casos que hoy no cumplen | → [A-FEAT-31](#a-feat-31) `@extracto` |
| **A-FEAT-29** | 🟡 | Feat | **HECHO 2026-08-19** — panel **"Resultado de la corrida"**: las filas que tocó el motor se quedan a la vista aunque el filtro ya no las alcance, con su **antes → después**, hasta apretar *Actualizar y soltar*. Antes se conciliaban y desaparecían de la grilla antes de poder revisarlas. Falta testear | → [A-FEAT-29](#a-feat-29) `@extracto` |
| **A-FEAT-30** | 🟡 | Feat | **HECHO 2026-08-19** — filtro por **contraparte** en el Extracto: un solo input que acepta **nombre o CUIT**, y compara el CUIT sin guiones (`20-28749254-6` = `20287492546`). Falta testear | → [A-FEAT-29](#a-feat-29) `@extracto` |
| **A-BUG-34** | 🟡 | **Bug** | **HECHO 2026-08-19** — `recargar()` llamaba a `cargarMovimientos({ limite: 100 })` **sin ningún filtro**, así que después de conciliar la grilla volvía con "los últimos 100 de la cuenta". El usuario filtró hasta el 18/06 y le aparecieron dos movimientos de julio y agosto. **Preexistente**, se hizo visible ahora. Falta testear | → [A-BUG-34](#a-bug-34) `@extracto` |
| **A-BUG-35** | 🟡 | **Bug** | **HECHO 2026-08-19** — las filas del panel *Resultado de la corrida* eran **copias**: salían todas juntas arriba rompiendo el orden, y el checkbox de revisado no respondía porque no eran las filas de la lista. Ahora se inyectan en la lista real y se reordena por `orden`. Falta testear | → [A-BUG-34](#a-bug-34) `@extracto` |
| **A-BUG-43** | 🔴 | **Bug** | **Las 4 tablas de extracto no tienen NI UNA foreign key**, y la causa de fondo es de **modelo**: `comprobante_arca_id` y `template_cuota_id` a veces guardan un **grupo de pago** (17 casos, **$15,6 M**), así que **cualquier JOIN los pierde en silencio**. ✅ **Modelo A decidido** (columna `grupo_pago_id` propia) — ⏸️ **no se ejecuta ahora** por decisión del usuario. Plan en 5 fases listo en el dossier | → [A-BUG-43](#a-bug-43) `@extracto` |
| **A-BUG-42** | 🟡 | **Bug** | **HECHO 2026-08-19 + datos recuperados 2026-08-20** — reasignar un movimiento a un template **BORRABA** la cuota que tenía vinculada, incluso si era la que el usuario acababa de elegir. Perdió 2 cuotas reales (**$1,74 M**): Expensas Libertad 11/05 y Seguro Flota 02/06. Ahora se **suelta** (vuelve a `pendiente`) y se avisa. Cuotas recreadas y re-vinculadas. Falta testear | → [A-BUG-42](#a-bug-42) `@extracto` |
| **A-BUG-41** | ✅ | **Bug** | **HECHO + TESTEADO OK 2026-08-19** — al conciliar un **grupo de sueldos**, el movimiento quedaba conciliado **sin vínculo** y **los pagos seguían en `pagado`**: la misma plata conciliada en el extracto y todavía por pagar en el Cash Flow. Las dos ramas exigían `origen_tabla === 'sueldos.pagos'`, que un grupo no cumple. ARCA y templates ya usaban `ids_grupo`; sueldos era el único que no. Falta testear | → [A-BUG-41](#a-bug-41) `@extracto @cashflow` |
| **A-FEAT-33** | ✅ | Feat | **HECHO + TESTEADO OK 2026-08-19** — **agrupar sueldos desde el Cash Flow**. Existía sólo en Vista Pagos (que se está desactivando) y con implementación propia; el Cash Flow lo bloqueaba. Sin agrupar, un débito de acreditación de haberes —que el banco manda como **una sola línea por todo el lote**— no tiene ninguna fila del Cash Flow que valga lo mismo y no concilia nunca. Falta testear | → [A-FEAT-33](#a-feat-33) `@cashflow @sueldos` |
| **A-BUG-40** | 🟡 | **Bug** | **HECHO 2026-08-19** — el Cash Flow **decía "banco" y mostraba caja**: el selector de medio de pago arranca en `banco` pero su valor sólo viajaba dentro de `aplicarFiltros()`, que no corre al montar. Se veía al buscar *"sigot"* y aparecer los `caja_sigot`. Ahora es client-side y **siempre activo**. Falta testear | → [A-BUG-40](#a-bug-40) `@cashflow` |
| **A-BUG-39** | 🟡 | **Bug** | **HECHO 2026-08-19** — un sueldo conciliado quedaba **sin rastro de a quién se le pagó**: el motor buscaba el nombre sólo en `proveedores`, y un empleado que no está ahí (Wilson) dejaba `proveedor_nombre` en null y el `detalle` sin nombre. Ahora cae al nombre que ya trae la fila del Cash Flow. Falta testear | → [A-BUG-39](#a-bug-39) `@extracto` |
| **A-DAT-04** | 🔴 | Dato | **Faltan reglas contable/interno para 3 empleados** — sólo AMS, JMS y Alondra tienen su regla Tipo C en `reglas_contable_interno`. Wilson Barreto y Ruben Sigot no, así que sus movimientos conciliados quedan con `contable` e `interno` **vacíos** | → [A-BUG-39](#a-bug-39) `@extracto @sueldos` |
| **A-BUG-38** | 🟡 | **Bug** | **HECHO 2026-08-19** — Wilson Barreto no tenía CUIT en `sueldos.empleados` aunque el banco sí lo informa. **Cargado con OK del usuario**: `20-33318934-9`. Ahora el pre-filtro del motor lo puede usar y deja de salir *"sin CUIT"* en el selector. Falta testear | → [A-BUG-38](#a-bug-38) `@sueldos @extracto` |
| **A-FEAT-32** | 🟡 | Feat | **HECHO 2026-08-19** — el filtro de contraparte del Extracto ahora incluye **empleados**, no sólo proveedores: Alondra no aparecía porque es empleada y vive en `sueldos.empleados`. `ProveedorCombobox` tomó un flag `incluirEmpleados` (apagado por default, para no cambiarles nada a los 4 modales que ya lo usan). Falta testear | → [A-FEAT-32](#a-feat-32) `@extracto` |
| **A-BUG-37** | ✅ | **Bug** | **HECHO + TESTEADO OK 2026-08-19** — el motor decidía contra una **foto del Cash Flow tomada al montar la pantalla**: cualquier cambio hecho fuera de esa pestaña era invisible y el motor **escribía igual**. Ahora recarga al ejecutar. **Testeado**: se liberaron 2 pagos de Alondra por SQL y el motor los concilió **sin refrescar la app** | → [A-BUG-37](#a-bug-37) `@extracto @cashflow` |
| **A-BUG-36** | 🔴 | **Bug** | **El motor concilia un movimiento BANCARIO contra un pago de CAJA** — el débito del 29/05 de $110.000 quedó vinculado a un pago de Ruben Sigot con `medio_pago = 'caja_sigot'` (y en `programado`), cuando el que correspondía era el de Alondra Olivo por el mismo monto y la misma fecha, en banco. El motor **no mira `medio_pago`** | → [A-BUG-36](#a-bug-36) `@extracto @sueldos` |
| A-TEST-34 | ✅ | Test | **TESTEADO OK 2026-08-19** — el usuario corrió el motor sobre 2 movimientos de JMS con el filtro de contraparte puesto: el del 14/05 concilió, **el conciliado no desapareció de la grilla**, el orden se mantuvo y **el tilde de revisado respondió**. Cubre A-FEAT-29, A-FEAT-30, A-BUG-34 y A-BUG-35 | → [A-FEAT-29](#a-feat-29) `@extracto` |
| A-TEST-33 | ✅ | Test | **TESTEADO OK 2026-08-19** — motor con CUIT normalizado + prioriza sin excluir. El usuario corrió la conciliación acotada sobre los 4 movimientos de AMS: **30/04 y 29/05 salieron `conciliado`** con su pago vinculado, y los 2 del 05/06 quedaron pendientes como estaba previsto | → [A-BUG-28](#a-bug-28) `@extracto` |
| A-DEC-01 | 🔴 | Decisión | **Ventas: qué tipos salen del Libro IVA Ventas.** Hoy el bloque 1 filtra sólo `≠ 11`, así que una **NC C (13) se cuenta dos veces** (como NC del Libro y como NC del bloque Monotributo). No copiar la lista de Compras: una Fac **B emitida sí genera débito** y debe quedar en el Libro. Propuesta: `[11,12,13]`. Sin impacto hoy (`comprobantes_venta` sólo tiene tipos 1, 201 y 332) | → [A-DEC-01](#a-dec-01) `@ingresos` |
| **A-BUG-44** | 🟡 | **Bug** | **HECHO 2026-08-20 — falta testear ([A-TEST-35](#a-test-35))** · La Planilla de Hacienda exageraba el rodeo en 16 cabezas — `Stock Anterior` sumaba los movimientos anteriores **en crudo** (`vista-sector-productivo.tsx:1410`) sin mirar el `tipo`, y ventas y mortandades se guardan **positivas**: las suma en vez de restarlas. Cada venta o muerte agrega **el doble de su tamaño** al error, y no se corrige nunca solo. Agosto/2026 dice **372**, hay **356**. ✅ **Decidido: se corrige el REPORTE, no el signo** — la pestaña Stock (`:1148`) y `confirmar-venta.ts` dependen de la convención positiva. Fix de 1 línea, **ningún dato se toca** | → [A-BUG-44](#a-bug-44) `@productivo` |
| **A-BUG-45** | 🟡 | **Bug** | **HECHO 2026-08-20 (código) — falta el arreglo de los datos viejos ([A-DAT-05](#a-dat-05))** · El tacto registraba el pase a CUT como `ajuste_stock` en vez de `cambio_categoria`. El reporte rotula `ajuste −` como *Mortandad* y `ajuste +` como *Compras*, así que la planilla de febrero **declara muertas a 8 vacas vivas** — y dos páginas después las lista como *Activa*. El camino manual sí lo hace bien (se ve en marzo): cambiar el `tipo` en 2 líneas, los signos ya están bien | → [A-BUG-45](#a-bug-45) `@productivo` |
| **A-BUG-46** | 🟡 | **Bug** | **HECHO 2026-08-20 — falta testear ([A-TEST-37](#a-test-37))** · Pasar hacienda a CUT sin tipear caravanas no creaba el individuo y no avisaba (`:1247` — el alta está condicionada a `nuevoMov.caravanas.trim()`). En agosto entró 1 vaquillona: la grilla dice **17** y la página nominal lista **8**. El animal entra al stock sin nombre, en silencio | → [A-BUG-46](#a-bug-46) `@productivo` |
| **A-BUG-47** | 🟡 | **Bug** | **HECHO 2026-08-20 (los 2 caminos que alimentan el CUT) — falta testear** · Los otros 3 caminos de alta van en [A-BUG-51](#a-bug-51) · `fecha_alta` no se seteaba al crear caravanas (ni el tacto `:4532` ni el alta manual `:1250`), y la página del CUT filtra por `fecha_alta <= hasta`, que en Postgres **excluye los NULL**. Hoy no se nota porque las 12 del CUT se completaron a mano en abril/2026, pero **la próxima caravana no aparecería en la planilla**. Ya hay 8 terneros con `fecha_alta` nula | → [A-BUG-47](#a-bug-47) `@productivo` |
| **A-BUG-48** | 🟡 | **Bug** | **Tres fragilidades en el registro de tacto**: el UUID del CUT está **hardcodeado** (`:4510`) y 20 líneas después la misma categoría se busca **por nombre** (`:4529`) · el rodeo se cruza con la categoría por **nombre exacto** y el `if` **no tiene `else`**, así que si no matchea **no se registra el movimiento, sin avisar** (`:4509`) · el **tacto retrospectivo no mueve el stock** (`:4507`), dejando ciclo y hacienda en desacuerdo | → [A-BUG-48](#a-bug-48) `@productivo` |
| **A-BUG-49** | 🟡 | **Bug** | **La Planilla de Hacienda hardcodea la razón social** (`Ea. Nazarenas` / `de Martinez Sobrado` en `:1543`, `:1691` y `:1860`), contra `CLAUDE.md` § Datos críticos — mismo patrón que sacaba el Libro IVA de PAM y MA con el CUIT de MSA impreso. Hoy no molesta: un solo establecimiento y `movimientos_hacienda` no tiene columna de empresa | → [A-BUG-49](#a-bug-49) `@productivo` |
| **A-BUG-50** | 🟡 | **Bug** | **Los movimientos de categorías que no están en las 12 columnas de la planilla se descartan en silencio** (`:1418` — `if (col === undefined) return`). Hoy inofensivo: las 3 que quedan afuera (`Novillito`, `Ternera`, `Ternero`) están inactivas y con 0 movimientos. Pero una categoría nueva desaparecería del reporte sin aviso | → [A-BUG-50](#a-bug-50) `@productivo` |
| **A-BUG-51** | 🟡 | **Bug** | **Otros 3 caminos dan de alta caravanas sin `fecha_alta`** — el alta manual de la pantalla de Terneros (`tab-terneros.tsx:323`), el **importador de terneros** (`import-terneros/route.ts:174`) y el **importador de pesadas** cuando la caravana no existe (`import-pesadas/route.ts:322`, que inserta con **un solo campo**: `caravana_oficial`). Son los caminos por los que entra un individuo sin fecha ni categoría. No afectan a la Planilla de Hacienda (crean terneros, no CUT) — abordar al tocar la pantalla de Terneros. Hermano de [A-BUG-47](#a-bug-47) | → [A-BUG-51](#a-bug-51) `@productivo` |
| **A-BUG-52** | 🟡 | **Bug** | **HECHO 2026-08-25 — falta testear ([A-TEST-40](#a-test-40))** · **No se podía pasar un sueldo a pagado desde el Cash Flow.** El botón PAGOS manda **siempre** `fecha_vencimiento`, y la rama de sueldos de `actualizarRegistro` tenía un `else` que escribía el nombre de columna **a ciegas** (`pagosUpdateData[campo] = valor`): `sueldos.pagos` **no tiene** esa columna —tiene una sola fecha, `fecha`— así que PostgREST rechazaba el UPDATE. Se guardaba el estado y la fecha, fallaba el tercer campo, y salía *"2 registro(s) no se guardaron"* (los 2 pagos de Alondra del 24/08). Además la fila de sueldo **nunca traía `fecha_pago`**, así que la columna se veía vacía aunque la fecha estuviera guardada. Fix: alias explícito de las 3 fechas del Cash Flow → `fecha`, **whitelist** de columnas reales (lo que no se sabe escribir **se dice**), y `fecha_pago` expuesta cuando el pago ya está `pagado`/`conciliado` (en el grupo, sólo si **todos** lo están). **Ningún dato se tocó**: ya estaban bien guardados | → [A-BUG-52](#a-bug-52) `@cashflow` |
| **A-BUG-53** | 🟡 | **Bug** | **HECHO 2026-08-25 — falta testear ([A-TEST-40](#a-test-40))** · **Un fallo de GUARDADO se mostraba como fallo de CARGA.** `actualizarBatch` y `actualizarRegistro` llamaban a `setError`, que es el estado de carga: el componente reemplaza **la pantalla entera** por *«Error al cargar Cash Flow»* + botón **Reintentar** — cartel que habla de una carga que nunca falló, sin decir qué registro ni por qué. Y **«Reintentar» no reintenta**: sólo llama `cargarDatos()`. Por eso el usuario creyó que el reintento había funcionado, cuando el estado ya estaba guardado desde el primer click y lo único que hizo el botón fue mostrar la verdad. Fix: el fallo de guardado se avisa **por toast con el motivo real** y la grilla queda a la vista. Hermano de [A-BUG-19](#a-bug-19): allá la pantalla mentía diciendo que guardó; acá miente sobre **qué** falló | → [A-BUG-53](#a-bug-53) `@cashflow` |
| **A-BUG-63** | 🟡 | **Bug** | **HECHO 2026-08-27 — falta testear ([A-TEST-52](#a-test-52))** · **Al cerrar una quincena SICORE, el modal no ofrecía las cuotas de la campaña nueva** — sólo las **2 sobrantes de 25/26**, ambas ya vencidas. Los dos templates SICORE estaban **hardcodeados por `id`** (`vista-facturas-arca.tsx:4929`), y el clon de la campaña renovada es una fila **con otro id** (Modelo A): las **24 cuotas de 26/27 no existían para la pantalla**. **Es el mismo patrón que rompió contable/interno** ([A-FEAT-42](#a-feat-42)): *un id hardcodeado no sobrevive a una campaña nueva, y cada campaña que se genere lo vuelve a romper*. Fix: se resuelve por **linaje** (`template_origen_id`, raíz → clones, generación por generación), la opción muestra **de qué campaña es** cada cuota, y el respaldo de la sugerencia pasó a ser la cuota **más futura** en vez de la más vieja. **Barrido**: no quedan más UUID de template hardcodeados (el del CUT es de [A-BUG-48](#a-bug-48)) | → [A-BUG-54](#a-bug-54) `@egresos` |
| A-TEST-52 | 🔴 | Test | **Cerrar una quincena SICORE con la campaña renovada** ([A-BUG-63](#a-bug-63)) — al cerrar, el modal tiene que ofrecer las cuotas de **26/27** (24 libres), no sólo las 2 de 25/26, y cada opción debe decir **de qué campaña es** (`1er Quincena · 26/27 | 20/08/2026`). La **preseleccionada** tiene que ser la primera que vence **después** del cierre de la quincena. ⚠️ La quincena que el usuario cerró el **27/08** la llenó **a mano** a propósito: verificar que no quedó duplicada | → [A-BUG-63](#a-bug-63) `@egresos` |
| A-TEST-40 | 🔴 | Test | **Pagar un sueldo desde el Cash Flow** ([A-BUG-52](#a-bug-52) + [A-BUG-53](#a-bug-53)) — con el modo PAGOS, marcar un sueldo a `pagado` **con fecha**: no tiene que aparecer *"N registro(s) no se guardaron"*, y al recargar la fila tiene que mostrar **la fecha en la columna Fecha de Pago** (antes quedaba vacía). Probar también **un grupo de pago**: la fecha aparece sólo si **todos** sus miembros están pagados. Y forzar un fallo real (un campo que sueldos no admite) para ver que sale **un toast con el motivo** y **la grilla NO se reemplaza** por la pantalla de error | → [A-TEST-40](#a-test-40) `@cashflow` |
| **A-FEAT-34** | 🟡 | Feat | **HECHO 2026-08-20 — falta testear ([A-TEST-37](#a-test-37))** · Rediseñar la página CUT/Descarte + su control de cierre — dos bloques (*venían de antes* / *entraron en el período*), columna **Estado al cierre** (`Sigue` · `Vendida DD/MM` · `Muerta DD/MM`) y línea de cierre que **tiene que coincidir con la Existencia Final de la grilla**. Ese descuadre **es** el control: cabezas (bulk) contra individuos (nominal). Hoy la lista no se limpia nunca — en agosto sigue mostrando 4 vendidas 5 meses antes | → [A-FEAT-34](#a-feat-34) `@productivo` |
| **A-FEAT-35** | 🟡 | Feat | **HECHO 2026-08-21 — falta testear ([A-TEST-37](#a-test-37))** · Sacar kilos y montos del detalle de la Planilla de Hacienda. Decisión del usuario (2026-08-20): *"en esta planilla no debe figurar montos de venta ni kilos de venta, sólo movimientos de stock"*. Además hoy las 3 columnas de plata **no multiplican** y nada lo explica (ver [A-DAT-06](#a-dat-06)) | → [A-FEAT-35](#a-feat-35) `@productivo` |
| **A-FEAT-36** | 🟡 | Feat | **HECHO 2026-08-22 — falta testear ([A-TEST-37](#a-test-37))** · El **recuento de apertura va al Stock Anterior** (febrero arranca en **422**, antes en 0) y los ajustes tienen **fila propia, sólo en los meses que los tienen**. La **Mortandad de febrero pasó de 1 a 0**: la ternera perdida en Onetto es un `Ajuste −`, no una muerte. Antes `ajuste +` se rotulaba *Compras* y `ajuste −` *Mortandad*, y las dos mentían | → [A-FEAT-36](#a-feat-36) `@productivo` |
| **A-FEAT-37** | 🟡 | Feat | **HECHO 2026-08-22 (las dos partes) — falta testear ([A-TEST-37](#a-test-37))** · La mortandad muestra motivo + observación + caravana encadenados, y el detalle va **segmentado por concepto** con el total de cada bloque contrastado contra la grilla, y el detalle de movimientos **segmentado** en vez de corrido. La app guarda **dos textos distintos** y el reporte trae uno: el 02/07 el movimiento dice *"sin causa comprobable"* y la caravana **184** dice *"Muerte Súbita"*. El cruce es por **fecha + categoría** (no hay FK) y trae su propio control: si la cantidad no coincide con las caravanas encontradas, hay muertes sin atribuir | → [A-FEAT-37](#a-feat-37) `@productivo` |
| **A-FEAT-38** | 🟡 | Feat | **Cuatro mejoras de formato de la planilla**: decir *"Sin movimientos en el período"* en vez de una tabla vacía · **orden estable** del detalle (hoy `.order('fecha')` sin criterio secundario, y los dos lados de una reclasificación pueden quedar separados) · **fecha de emisión** en el encabezado (hoy un movimiento retroactivo cambia una planilla ya emitida sin dejar rastro) · el cero se ve `-` en el PDF y `0` en el Excel | → [A-FEAT-38](#a-feat-38) `@productivo` |
| **A-DAT-05** | 🟡 | Dato | **HECHO 2026-08-20 con OK explícito del usuario — falta testear ([A-TEST-36](#a-test-36))** · Los 4 movimientos del pase a CUT de febrero tenían el `tipo` equivocado (`ajuste_stock` en vez de `cambio_categoria`): son los que declaran muertas a 8 vacas vivas. Corregirlos es un `UPDATE` sobre datos reales → **requiere OK explícito del usuario** (`CLAUDE.md` § Datos). Depende de [A-BUG-45](#a-bug-45) | → [A-DAT-05](#a-dat-05) `@productivo` |
| **A-DAT-06** | ✅ | Dato | **RESUELTO 2026-08-25 — era el DESBASTE, no un gasto.** El 3 % que parecía faltar en la venta del 04/08 es la **merma de peso** que descuenta el comprador: `peso_total_kg` son kg de **balanza (brutos)** y el monto sale de los **netos** → 16.180 × (1 − 3 %) × $5.670 = **$88.988.382 exacto**. **El usuario tenía razón: no hubo gastos de venta** (CZ y flete en cero). Verificado en `modal-confirmar-venta-hacienda.tsx:225-226`. 📌 Para el costeo: `peso_total_kg` es el **peso vivo**, sirve directo como punto de la curva | → [A-DAT-06](#a-dat-06) `@productivo` |
| A-TEST-35 | ✅ | Test | **TESTEADO OK 2026-08-20 por el usuario en el preview.** Planilla de Hacienda con el `Stock Anterior` corregido ([A-BUG-44](#a-bug-44)) — 4 chequeos en la app: el total de **Agosto/2026** tiene que dar **356** (antes 372) e igualar a *Productivo → Hacienda → Stock* y a la planilla en **modo rango** 15/02→20/08 · el `Stock Anterior` de cada mes tiene que ser la `Existencia Final` del anterior en **los 6 eslabones** · **febrero y marzo no deben cambiar nada** · las filas Compras/Ventas/Mortandad/Reclas. **no se tocan** | → [A-TEST-35](#a-test-35) `@productivo` |
| **A-FEAT-39** | 🟡 | Feat | **HECHO 2026-08-21 — falta testear ([A-TEST-38](#a-test-38))** · **Exportar varias planillas de una** — con un rango, el modal pregunta si querés **una sola punta a punta** o **una por cada mes**. Antes había que repetir el export mes por mes. La carpeta se elige **una sola vez** para toda la tanda y va con progreso. Los meses de las puntas se **recortan al rango** y el título lo dice (*"15/02/2026 al 28/02/2026"*) en vez de fingir que es el mes entero | → [A-FEAT-39](#a-feat-39) `@productivo` |
| **A-FEAT-40** | 🟡 | Feat | **HECHO 2026-08-21 — falta testear ([A-TEST-37](#a-test-37))** · **Las cabezas sin caravana ya figuran en el detalle del CUT.** La condición para aparecer es estar **identificado**, no tener caravana: el movimiento dice de dónde viene, cuándo y por qué. Salen como `(sin caravana)` con esos datos. El aviso pasó de 🔴 *"falta identificar"* a 🟠 *"N de M sin caravana"*, y el rojo queda para el descuadre real contra la grilla. **Sale también el `Proveedor/Cliente`** del reporte | → [A-FEAT-40](#a-feat-40) `@productivo` |
| **A-DAT-07** | 🟡 | Dato | **HECHO 2026-08-21 con OK del usuario** — la venta de 4 vacas CUT del 30/03 no tenía cliente. Alta de **BALLESTER PAULO CESAR** (CUIT `20249560791`) en `public.proveedores` como **cliente puro** · alta de **Pino Torillo** en `productivo.intermediarios_venta` · el movimiento quedó con su `proveedor_cliente` y `cuit`. *"Via Pino Torillo"* **se deja en observaciones**: el movimiento manual no tiene campo de intermediario | → [A-DAT-07](#a-dat-07) `@productivo` |
| **A-FEAT-42** | 🟡 | Feat | **HECHO 2026-08-22** — el generador de campañas **genera por TANDAS**: el clon guarda `template_origen_id`, así que en la corrida siguiente el origen se reconoce como *ya generado* y no vuelve a ofrecerse. Antes la 2ª corrida traía los clones recién creados con sus cuotas precargadas y **duplicaba**. Con contador *"N pendientes · M ya generados"* y recarga en el lugar. Falta testear | → [A-FEAT-42](#a-feat-42) `@egresos` |
| A-TEST-39 | 🔴 | Test | **Generar una campaña por tandas** (2026-08-22) — generar 2-3 templates, verificar que pasan a *"ya generados"* y que **no reaparecen** en la corrida siguiente, y que no se duplican cuotas. `MANUAL-USO.md` § Renovar campaña por tandas | → [A-FEAT-42](#a-feat-42) `@egresos` |
| **A-FEAT-41** | 🔴 | Feat | **La venta manual de hacienda NO da de alta al cliente** en `public.proveedores`, contra la regla de contrapartes (*upsert, nunca sólo UPDATE*). Se ve en [A-DAT-07](#a-dat-07): hubo que crear a Ballester a mano. Y el movimiento manual **no tiene campo de intermediario**, que sí existe en el circuito de *confirmar venta* (`intermediario_id`), así que el intermediario termina como texto libre en observaciones | → [A-FEAT-41](#a-feat-41) `@productivo` |
| A-TEST-38 | 🔴 | Test | **Export de varias planillas juntas** ([A-FEAT-39](#a-feat-39)) — rango 15/02/2026 → 21/08/2026 con *Una por mes* tiene que anunciar **7 planillas / 14 archivos**, pedir la carpeta **una sola vez** y dejar los 14 adentro. El 1er archivo va del **15/02 al 28/02** (recortado) y el último del **01/08 al 21/08**. Con *Una sola punta a punta* tiene que seguir saliendo **1 planilla**, como antes | → [A-TEST-38](#a-test-38) `@productivo` |
| **A-FEAT-43** | 🟡 | Feat | **LA CADENA ESTÁ COMPLETA 2026-08-26 — falta testear ([A-TEST-49](#a-test-49))** · **Costeo de recría: la lógica está ACORDADA Y VALIDADA con datos reales — falta llevarla a la app** (2026-08-25/26). Maqueta en Excel con 11 hojas y 429 fórmulas + un resumen de una carilla con solapa por rodeo. Reparte el maíz y el concentrado entre lo vendido y lo que queda, con 6 controles que cierran. **El modelo, las 7 decisiones y lo que falta están en el dossier** | → [A-FEAT-43](#a-feat-43) `@productivo` |
| **A-FEAT-44** | 🟡 | Feat | **HECHO 2026-08-26 — falta testear ([A-TEST-51](#a-test-51))** · **El puente COMPRA → ENTREGA → FACTURA para insumos** — hoy la cadena está cortada: `movimientos_insumos` no tiene `factura_id` y el maíz cae como gasto del mes sin llegar nunca al lote. Son **tres momentos** con conocimiento parcial cada uno: *"compré tanto"* → *"recibí este día"* (mueve el stock) → llega la factura (trae el precio). ⚠️ **La entrega y la factura NO coinciden**: Longo facturó el 13/07 lo entregado el 24/06. Si el stock dependiera de la fecha de factura, los tramos de consumo salen mal | → [A-FEAT-44](#a-feat-44) `@productivo @egresos` |
| **A-FEAT-45** | 🔴 | Feat | **EL MAPA DEL CIRCUITO — leer esto antes de tocar recría, margen o costos de producción** (2026-08-26). Las 7 pantallas que intervienen, **qué pregunta contesta cada una**, qué alimenta y qué recibe. Nació de que el usuario no podía seguir el plan sin saber para qué sirve cada lugar. Vive en `MODULO_HACIENDA.md` § 15; acá está el ítem para poder referenciarlo. Incluye las 3 decisiones de diseño: **la plata vive en el Margen · la eficiencia en el Ciclo · el puente es el Tramo** | → [A-FEAT-45](#a-feat-45) `@productivo @presupuesto` |
| **A-BUG-54** | 🟡 | Bug | **HECHO 2026-08-26 — falta testear ([A-TEST-41](#a-test-41))** · **El tramo de un lote se guardaba aunque le dieras CANCELAR** — `SeccionTramos` escribe en `lote_tramos` **al instante**: `+ tramo` hace `INSERT` en el click, y cada cambio de fecha/actividad/ha hace `UPDATE` en el `onChange`. El botón Cancelar del modal no revierte nada porque esos writes nunca pasaron por el formulario. Le pasó al usuario el 2026-08-26: canceló y el tramo quedó. **Y quedó con `fecha_hasta` = 04/08/2027 en vez de 2026** — un año de más que nadie validó, y que hizo que *Costos de producción* proyectara ~$3,5 a $5,1 M por mes indefinidamente. Fix: o el tramo se edita en memoria y se guarda con el modal, o la sección dice **explícitamente** que se guarda sola. Y validar que el tramo no exceda la fecha de venta del lote | → [A-BUG-54](#a-bug-54) `@productivo` |
| **A-BUG-55** | 🔴 | Bug | **El consumo se estima por lote de venta y NUNCA se concilia contra lo comprado** — el tramo cuelga de `stock_lotes`, y sólo existen lotes de **lo que se va a vender**. En recría 2026 el único lote con tramo es el de los **55**: la app estima lo que comieron esos 55 y **de los otros 134 del rodeo no sabe nada**. Además el precio sale de la receta (**$270/kg el maíz, $745 el concentrado**), no de las facturas. Resultado: un número que **no puede cerrar nunca** contra lo que se compró, y que **no avisa que le faltan dos tercios del rodeo**. El consumo es una propiedad del **rodeo** —lo que entró y lo que se midió—, no de un lote de venta | → [A-BUG-55](#a-bug-55) `@productivo @presupuesto` |
| **A-BUG-56** | 🔴 | Bug | **Dos motores distintos calculan el mismo costo, y cada uno sabe la mitad** — `resolverCostoDirecto()` (`lib/presupuesto/margen.ts`, lo usa **Margen**) y `consumoMensual()` (`lib/productivo/actividades.ts`, lo usa **Costos de producción** de la grilla) leen las **mismas filas** de `actividad_insumos` y dan resultados distintos: el primero **no sabe resolver la ración** (`pct_racion`/`kg_cabeza_dia` devuelven *"sin calcular"*), el segundo **sí**, pero no sabe aplicar la cadena de ajustes/IPC ni amortizar. Verificado en pantalla el 2026-08-26: con el tramo cargado, la grilla mostró costos de Recría y el Margen siguió en cero. Es el patrón de `buscarPrecio()` vs `resolverPrecioHacienda()` — **si quedan los dos vivos, en tres meses dan distinto y no se sabe cuál creer** | → [A-BUG-56](#a-bug-56) `@productivo @presupuesto` |
| **A-BUG-57** | 🟡 | Bug | **Los costos por hectárea de una actividad no llegan a la grilla mensual** — un costo `monto_ha` (pasturas y verdeos de recría, que van sobre las **60 ha** de la actividad) se resuelve en el **Margen** contra las hectáreas de la actividad, pero en *Costos de producción* se resuelve contra las **hectáreas del tramo**, que están vacías → **da cero**. Y si se llenaran, con dos lotes se contaría **dos veces**, porque las 60 ha son de la actividad, no de cada lote. Hermano de [A-BUG-56](#a-bug-56): el mismo insumo, dos motores, dos resultados | → [A-BUG-57](#a-bug-57) `@productivo @presupuesto` |
| **A-BUG-58** | 🟡 | Bug | **HECHO 2026-08-26 — falta testear ([A-TEST-41](#a-test-41))** · **El checkbox «Usar la ganancia diaria de arriba» no respondía** — en el tramo de un lote, tildarlo no hace efecto visible (reportado por el usuario 2026-08-26). Escribe `stock_lotes.ganancia_override` pero el modal no refleja el cambio. Y en la misma sección: **la columna «Ha» es demasiado angosta** para leer lo que se escribe | → [A-BUG-58](#a-bug-58) `@productivo` |
| **A-FEAT-46** | 🔴 | Feat | **Alerta: hay una pesada nueva y el presupuesto sigue con el peso viejo** — decisión del usuario 2026-08-26: la ganancia diaria y el peso de partida de un lote **NO se actualizan solos** (eso ya estaba decidido), **pero tiene que avisar**. Si aparece una pesada posterior a la que usa el lote, el presupuesto y el margen deben marcarlo para que el usuario decida si actualiza. Es el mismo criterio que *«el silencio miente»*: no actualizar automático está bien; no avisar, no | → [A-FEAT-46](#a-feat-46) `@productivo @presupuesto` |
| **A-DEC-04** | 🟢 | Decisión | **RESUELTA 2026-08-26** · **Las cuentas de producción: apagadas hacia adelante, llenas hacia atrás** — regla del usuario 2026-08-26. Hoy `esProduccion()` excluye `42305*` (alimentación) y `421*` (agricultura) **en las dos direcciones**, con el motivo *"ya entra como ración en Actividades y costos"*. El usuario lo corrigió: **hacia adelante la única fuente de verdad es el plan productivo** (y ahí la exclusión está bien), **pero hacia atrás la cuenta debe llenarse con las facturas reales**. Hoy no se distingue, y por eso el maíz no está en ningún lado: excluido de un lado y sin calcular del otro | → [A-DEC-04](#a-dec-04) `@presupuesto @productivo` |
| A-TEST-41 | 🔴 | Test | **El tramo de un lote respeta Guardar y Cancelar** ([A-BUG-54](#a-bug-54) + [A-BUG-58](#a-bug-58)) — abrir un lote en *Productivo → Evolución Rodeo → lotes*, agregar un tramo, cambiarle las fechas y darle **Cancelar**: al reabrir **no tiene que haber quedado nada**. Repetir y darle **Guardar**: tiene que quedar. Probar tambien **borrar** un tramo y cancelar (debe seguir estando) y el **checkbox de ganancia diaria**, que ahora tiene que tildarse y verse el cambio en la curva. Y con un lote **con fecha de venta**, agregar un tramo: el **Hasta** debe salir con la fecha de venta y no con +6 meses; si se lo pasa, tiene que aparecer el **aviso ámbar** | → [A-TEST-41](#a-test-41) `@productivo` |
| **A-FEAT-47** | 🟡 | Feat | **HECHO 2026-08-26 — falta testear ([A-TEST-42](#a-test-42))** · **Mediciones de stock de un insumo: el consumo deja de estimarse y se MIDE.** Tabla nueva `productivo.mediciones_insumo` (un **nivel**, no un movimiento — por eso no va en `movimientos_insumos`) + `lib/productivo/consumo.ts` + botón **Mediciones** en cada insumo de *Productivo → Insumos → Stock*. **Cada medición corta un tramo**, y de cada tramo sale `había + entró − quedó`, con **precio por tramo** (no un promedio del período) y **3 controles a la vista**. Es el primer paso de [A-FEAT-43](#a-feat-43): sin esto no se puede cargar nada. Verificado con `scripts/verificar-consumo.mts` contra los datos reales de la recría 2026 — los 3 controles cierran | → [A-FEAT-47](#a-feat-47) `@productivo` |
| A-TEST-42 | 🔴 | Test | **Cargar las mediciones de maíz y ver que el consumo cierre** ([A-FEAT-47](#a-feat-47)) — en *Productivo → Insumos → Stock*, botón **Mediciones** del Maíz. Cargar las 4 tomas (16/03 = 0 · 24/06 = 0 · 24/07 = 0 · 24/08 = 5.800 kg) con las 6 entregas ya cargadas como compras: tienen que salir **3 tramos**, consumo total **61.860 kg**, remanente **5.800 kg** y los **3 controles en ✓**. Probar además: cargar **dos mediciones el mismo día** (tiene que avisar que se contradicen) · **borrar** una y ver que los tramos se recalculan · una entrega **sin precio** (el costo del tramo debe decir «—», nunca cero) | → [A-TEST-42](#a-test-42) `@productivo` |
| **A-BUG-59** | 🟡 | Bug | **HECHO 2026-08-26 — falta testear ([A-TEST-43](#a-test-43))** · **El desbaste y la CZ se calculan con un peso proyectado desde HOY, no desde la pesada** — en *Cargar stock inicial desde una pesada* (`panel-lotes-hacienda.tsx` § `ModalDesdePesada`), `pct_desbaste` y `pct_cz` salen de `peso + (fecha_venta − HOY) × ganancia`. Pero el `peso_base_kg` que se guarda es **el de la pesada**, y `fecha_peso` es **la fecha de la pesada**. O sea: el peso de partida es de una fecha y los días se cuentan desde otra. Caso real del usuario (2026-08-26): pesada 3/8 a 211,9 kg, venta 20/09 → el peso correcto a la venta es **259,9 kg** y la banda se busca con **236,9**: **23 kg de diferencia**, suficiente para caer en otra banda de precio. El resto de la app cuenta la ganancia desde `fecha_peso` — acá quedó desalineado | → [A-BUG-59](#a-bug-59) `@productivo` |
| **A-BUG-60** | 🟡 | Bug | **HECHO 2026-08-26 — falta testear ([A-TEST-43](#a-test-43))** · **Con fecha de venta cargada, la pantalla sigue mostrando el peso de HOY** — en el mismo modal, cada grupo muestra *«pesada 211,9 kg → hoy 235,9 kg»* y el placeholder del peso también es el de hoy. Si ya pusiste fecha de venta, **el número que importa es el peso A LA VENTA**, que es con el que se factura y con el que se elige la banda. Lo marcó el usuario: *«le pongo fecha de venta pero el kilaje me lo muestra a la fecha de hoy»*. Hermano de [A-BUG-59](#a-bug-59): uno muestra mal, el otro guarda mal | → [A-BUG-60](#a-bug-60) `@productivo` |
| **A-BUG-61** | 🟡 | Bug | **HECHO 2026-08-26 — falta testear ([A-TEST-43](#a-test-43))** · **«Los más pesados / los más livianos / promedio» sigue habilitado cuando te llevás TODO** — si la cantidad iguala a las cabezas del grupo, elegir cuáles no significa nada: son todos, y el promedio es el mismo. El bloque de vista previa ya se oculta en ese caso (`cant >= g.pesos.length`), pero el selector no. Lo marcó el usuario: *«si pongo vender todo lo posible no me debería dejar elegir… porque si es todo es todo»*. Confunde y además sugiere que el número podría cambiar | → [A-BUG-61](#a-bug-61) `@productivo` |
| **A-FEAT-48** | 🟡 | Feat | **HECHO 2026-08-26 — falta testear ([A-TEST-44](#a-test-44))** · **La venta interna RECRÍA → CRÍA (las vaquillonas de reposición)** — las hembras retenidas no se venden afuera: pasan a cría. Es **ingreso de recría y costo de entrada de cría**, la misma operación vista de los dos lados. Ya existe el espejo en el otro sentido (`ciclos_recria.precio_kg_entrada` cierra cría y abre recría) pero **no existe la vuelta**, así que hoy la reposición sale del circuito sin valuarse: recría regala animales y cría los recibe gratis. El usuario lo planteó así: *«las de reposición sí se venden a cría… es una venta para uno y un costo para otro, pero se debe poner la venta interna para que ejecute los márgenes»* | → [A-FEAT-48](#a-feat-48) `@productivo @presupuesto` |
| **A-BUG-62** | 🟡 | Bug | **HECHO 2026-08-26 — falta testear ([A-TEST-45](#a-test-45))** · **El Margen usaba la venta PRESUPUESTADA aunque la venta REAL esté cargada** — `panel-margen.tsx` arma los ingresos leyendo `productivo.stock_lotes` y **nunca mira `productivo.stock_ventas`**, que es donde vive la venta que efectivamente ocurrió. Caso real: el lote de los 55 dice **275 kg** (proyección) y la venta registrada dice **294,18 kg** y **$5.670/kg** — 19 kg y otro precio. El margen factura la proyección. Es una violación directa de la regla *default del dato real, siempre editable* de `CLAUDE.md`: **el dato real existe y no se usa**. Lo marcó el usuario: *«recordá que la venta no fue 275 kg, esa era la proyección»* | → [A-BUG-62](#a-bug-62) `@presupuesto @productivo` |
| A-TEST-43 | 🔴 | Test | **El peso a la venta en el modal de pesada** ([A-BUG-59](#a-bug-59) + [A-BUG-60](#a-bug-60) + [A-BUG-61](#a-bug-61)) — en *Evolución Rodeo → Cargar stock inicial desde una pesada*, con una pesada vieja y una fecha de venta futura: la fila tiene que decir **«→ a la venta N kg (X días · hoy Y kg)»**, contando los días **desde la pesada** y no desde hoy. Con la pesada del 3/8 a 211,9 kg, ganancia 1 y venta el 20/09 tiene que dar **259,9 kg**, no 236,9. Verificar además que el **% de desbaste y CZ** del lote creado correspondan a esa banda. Y que al poner una cantidad **igual a las cabezas** del grupo, el selector *más pesados / más livianos* **desaparezca** y diga «son todos» | → [A-TEST-43](#a-test-43) `@productivo` |
| A-TEST-44 | 🔴 | Test | **La venta interna recría → cría aparece en los dos márgenes** ([A-FEAT-48](#a-feat-48)) — en *Productivo → Recría*, cargar en el bloque celeste **Recría → Cría** las cabezas de reposición, los kg brutos, el $/kg y la fecha. Después, en *Presupuesto → Margen*, en la campaña que corresponda a esa fecha: **Recría** tiene que mostrar *«Reposición: vaquillonas a cría»* como **ingreso** y **Cría** el **mismo monto** como costo. Probar también sin precio: tiene que quedar la fila *sin calcular* y el faltante, **nunca en cero**. Y verificar la ida: con `precio_kg_entrada` cargado, *«Destete: entrada de cría»* sale como **ingreso de Cría** y **costo de Recría** en la campaña de la fecha de inicio del ciclo (23/02/2026 → **25/26**) | → [A-TEST-44](#a-test-44) `@productivo @presupuesto` |
| A-TEST-45 | 🔴 | Test | **El margen usa la venta real y no la duplica** ([A-BUG-62](#a-bug-62)) — en *Presupuesto → Margen*, campaña **26/27**, abrir **Recría**: tiene que salir **una sola** fila de venta, *«Venta Ternero Recria — REAL»*, con **55 cab**, **294,18 kg** y **$5.670/kg** (no 275 kg ni $5.876). **No debe aparecer además la fila proyectada** del mismo lote. Probar el caso mixto: registrar una venta **parcial** de un lote y verificar que salgan **dos filas** —la real por lo vendido y la proyectada por el resto, diciendo *«quedan N de M»*— y que las cabezas **no se cuenten dos veces**. Y una venta cuya fecha caiga en **otra campaña** que la del lote: tiene que aparecer en la campaña de **su** fecha | → [A-TEST-45](#a-test-45) `@presupuesto @productivo` |
| **A-FEAT-49** | 🟡 | Feat | **HECHO 2026-08-26 — falta testear ([A-TEST-46](#a-test-46))** · **Un lote puede PASAR A OTRA ACTIVIDAD en vez de venderse** — `stock_lotes.destino_actividad_id`. Unifica en un solo mecanismo lo que estaba en dos: el **destete** (cría → recría) y la **reposición** (recría → cría). Motivo del usuario: *«las de reposición comieron»* — si no son un lote no tienen tramo, y sin tramo su ración no está en ningún lado. Con el lote conservan curva de peso, tramos, fecha y timing. **Ingreso para el que entrega y costo de entrada para el que recibe, con UN solo número**, sin IVA ni comisión, y **fuera del Cash Flow** porque no mueve plata. Reemplaza a [A-FEAT-48](#a-feat-48), que queda como el camino viejo | → [A-FEAT-49](#a-feat-49) `@productivo @presupuesto` |
| A-TEST-46 | 🔴 | Test | **El traspaso interno entre actividades** ([A-FEAT-49](#a-feat-49)) — en *Evolución Rodeo → lotes*, abrir un lote de **Ternera Recria** y en el selector de arriba elegir **«pasa a Cria — no se vende»**. Poner fecha y $/kg, guardar. Verificar: en *Presupuesto → Margen*, campaña de esa fecha, **Recría** muestra el traspaso como **ingreso** y **Cría** el **mismo monto** como costo. En la **grilla del presupuesto NO tiene que aparecer** (no genera caja). Sin $/kg, la fila queda *sin calcular* con su faltante, **nunca en cero**. Y probar que el lote **deja de contarse como venta de mercado**: no debe salir además la fila de venta externa | → [A-TEST-46](#a-test-46) `@productivo @presupuesto` |
| **A-DEC-05** | 🟢 | Decisión | **RESUELTA 2026-08-26** · **Cría también va a llevar maíz y concentrado** (usuario, 2026-08-26) — se le da a los **terneros al pie** y **a discreción**. Consecuencias: (1) la actividad `Cría` necesita sus dos filas de insumo, que hoy no tiene (sólo tiene sanidad, pasturas, verdeos, rollos y silo); (2) `actividades.racion_pct_pv` de Cría está en **0,00 %**, así que aunque haya tramos el consumo estimado daría cero; (3) **el maíz de cría y el de recría salen del mismo silo o no** — si es el mismo, el reparto medido tiene que incluir a la cría y no sólo a los tres grupos de recría. ⚠️ Esto **contradice** lo que se había asumido el 2026-08-26 más temprano (*«cría no usa maíz»*), que simplificaba el reparto. Hay que decidirlo antes de conectar el reparto de [A-FEAT-43](#a-feat-43) | → [A-DEC-05](#a-dec-05) `@productivo` |
| **A-FEAT-50** | 🟡 | Feat | **HECHO 2026-08-26 — falta testear ([A-TEST-47](#a-test-47))** · **Consumo DECLARADO por actividad: lo que el usuario aporta no se deduce** — tabla `productivo.consumo_declarado_insumo` + bloque celeste en el panel de Mediciones. *«Se cargaron 6 ton al comedero de cría»* se imputa **entero** a esa actividad y se **descuenta** del resto, que es lo único que se reparte por kilo-día. Es la **misma regla** que la adjudicación de facturas a una actividad: lo declarado gana y se descuenta del reparto general, así **el total nunca se mueve**. Resuelve [A-DEC-05](#a-dec-05) sin ninguna excepción en el código | → [A-FEAT-50](#a-feat-50) `@productivo` |
| A-TEST-47 | 🔴 | Test | **Lo declarado se descuenta y el control sigue cerrando** ([A-FEAT-50](#a-feat-50)) — en *Insumos → Stock → Mediciones* de un insumo con tramos, cargar en el bloque celeste **una actividad + fecha + cantidad**. Verificar: la columna **Declarado** del tramo muestra esa cantidad, el **consumo total no cambia**, y los **3 controles siguen en ✓**. Probar declarar **más de lo consumido** en un tramo: tiene que avisar. Y borrar la declaración: todo vuelve atrás | → [A-TEST-47](#a-test-47) `@productivo` |
| **A-FEAT-51** | 🟡 | Feat | **HECHO 2026-08-26 — falta testear ([A-TEST-48](#a-test-48))** · **La línea de tiempo del rodeo: el reparto del consumo ya funciona punta a punta** — `lib/productivo/rodeo.ts` integra **día por día** cuántas cabezas y con qué peso hubo, y le da a `consumo.ts` los grupos con su kilo-día. Los grupos son **los lotes del ciclo**, con su curva de peso y su fecha de salida (**la venta real manda sobre la estimada**); las mortandades se descuentan. Y el **«Resto sin lote»** absorbe lo que no está cargado, para que su comida **no se la repartan los demás en silencio**. Verificado contra la BD real con `scripts/verificar-rodeo.mts`: 185 declaradas = 185 en grupos, 4 mortandades, participaciones = 1 | → [A-FEAT-51](#a-feat-51) `@productivo` |
| A-TEST-48 | 🔴 | Test | **El reparto del consumo entre los lotes del rodeo** ([A-FEAT-51](#a-feat-51)) — en *Insumos → Stock → Mediciones* del Maíz, con las mediciones cargadas, tiene que aparecer el bloque **«Quién se lo comió»** con una fila por lote y por tramo, sumando **100 %** en cada tramo. Verificar que el lote **vendido el 04/08 deja de comer ese día** (su participación baja en el último tramo) y que **«Resto sin lote»** desaparece a medida que se cargan los lotes de machos y hembras. Probar el aviso de rodeo que no concilia: cargar un lote con **más cabezas de las que declara el ciclo** → tiene que salir la alerta ámbar. Y que las **mortandades** se descuenten: el kilo-día del tramo posterior a una muerte tiene que bajar | → [A-TEST-48](#a-test-48) `@productivo` |
| **A-FEAT-52** | 🟡 | Feat | **HECHO 2026-08-26 — falta testear ([A-TEST-49](#a-test-49))** · **El costo de alimentación MEDIDO llega al Margen** — `lib/productivo/costo-alimentacion.ts` junta las tres piezas ya verificadas (consumo medido + línea de tiempo del rodeo + reparto) y devuelve el costo por **actividad y campaña**. En *Presupuesto → Margen*, las filas de **Maíz** y **Concentrado** dejan de decir *«sin calcular»* y muestran el **consumo medido y repartido por kilo-día**, desplegable tramo por tramo. **Si no hay mediciones no se inventa nada**: la fila sigue marcada. Cierra la cadena de [A-FEAT-43](#a-feat-43) | → [A-FEAT-52](#a-feat-52) `@presupuesto @productivo` |
| A-TEST-49 | 🔴 | Test | **La cadena completa del costeo de recría, punta a punta** ([A-FEAT-43](#a-feat-43) + [A-FEAT-52](#a-feat-52)) — con el maíz cargado (producto + 6 entregas + 4 mediciones) y los lotes de machos y hembras creados: en *Presupuesto → Margen → Recría*, la fila **Maíz** tiene que mostrar un **monto**, no *«sin calcular»*, y al desplegarla verse **un renglón por tramo y por grupo**. Contrastar el total contra `Maqueta_Costo_Recria.xlsx`: **tienen que dar lo mismo**, y si no, la diferencia dice qué falta cargar. Verificar que el número **cambia** al cargar un lote nuevo (baja el «Resto sin lote») y que **vuelve a «sin calcular»** si se borra una medición | → [A-TEST-49](#a-test-49) `@presupuesto @productivo` |
| **A-FEAT-53** | 🟡 | Feat | **HECHO 2026-08-26 — falta testear ([A-TEST-50](#a-test-50))** · **La ACTIVACIÓN: lo que no se vendió no es gasto, es mayor valor del animal** — dos renglones nuevos en el margen, **Existencia inicial** (costo) y **Existencia final** (ingreso), valuadas **a COSTO** (valor de entrada + lo imputado encima). Resuelve el desfase entre la campaña que paga la comida y la que vende: la recría abrió en feb-2026 (**25/26**) y vendió en ago-2026 (**26/27**), así que sin esto la primera daba **pérdida pura** y la segunda ganancia inflada. **No reclasifica ningún gasto**: los costos se siguen mostrando enteros y estos dos renglones absorben la diferencia de timing | → [A-FEAT-53](#a-feat-53) `@presupuesto @productivo` |
| **A-FEAT-54** | 🟡 | Feat | **HECHO 2026-08-26 — falta testear ([A-TEST-50](#a-test-50))** · **La apertura POR GRUPO dentro del margen** — desplegable dentro de cada actividad: una fila por grupo (los 55 vendidos, los machos, las hembras) con **ingreso · entrada · alimentación · margen**, y el estado *vendido* / *en stock*. Es la solapa por rodeo de la maqueta, adentro de la pantalla que ya existe. ⚠️ **Es una apertura del total, no otro número**: la suma tiene que dar el margen bruto, y **el control se muestra al pie** — si algún grupo está sin calcular, lo dice en vez de mostrar una diferencia que no significa nada | → [A-FEAT-54](#a-feat-54) `@presupuesto @productivo` |
| A-TEST-50 | 🔴 | Test | **La activación y la apertura por grupo** ([A-FEAT-53](#a-feat-53) + [A-FEAT-54](#a-feat-54)) — en *Presupuesto → Margen*, con el maíz y los lotes cargados: en la campaña **25/26** (la que pagó la comida y no vendió) tiene que aparecer **Existencia final** como ingreso, y el margen **NO** debe dar una pérdida del tamaño de todo el maíz. En **26/27** tiene que aparecer **Existencia inicial** como costo por un monto **parecido** al de la existencia final de 25/26. Desplegar **«Por grupo»**: una fila por grupo, los 55 marcados **vendido** y el resto **en stock**, y al pie el control **✓ la suma da el margen bruto**. Probar el caso incompleto: con un grupo sin precio, el pie debe decir *«no se puede controlar contra el total»* y **no** mostrar una diferencia falsa | → [A-TEST-50](#a-test-50) `@presupuesto @productivo` |
| A-TEST-51 | 🔴 | Test | **El puente entrega ↔ factura, con el caso Longo** ([A-FEAT-44](#a-feat-44)) — en *Insumos → Stock*, botón **Facturas** del Maíz. Vincular la **FC del 13/07 (25 t)** a la entrega del **24/06** por 20,1 t y a la del **24/07** por 4,9 t, y la **FC del 14/08 (20,1 t)** a la del 24/07. Tiene que quedar: entrega del 24/06 a **$267,50/kg** *de las facturas*, entrega del 24/07 a **$267,14/kg** (ponderado de las dos), y los **2 controles en ✓**. Después abrir **Mediciones**: el precio de esos tramos tiene que ser el mismo, y **ya no el tipeado a mano**. Probar además vincular **más de lo entregado** (debe avisar) y dejar una entrega **sin factura** (debe decir cuánto falta) | → [A-TEST-51](#a-test-51) `@productivo @egresos` |
| **A-FEAT-55** | 🟢 | Feat | **El PEDIDO: el momento que falta de la cadena de compra** — hoy la cadena arranca en la entrega. El pedido (*«pedí un camión, llega el sábado»*) no existe. ⚠️ **Diseño acordado con el usuario 2026-08-27, y la condición es la que lo hace viable**: se carga como una entrega con **estado `pendiente`** y fecha pactada, y **NO toca el stock ni corta tramos hasta confirmarse**. Al descargar se pasa a `confirmado` con los kilos reales. **NO hacerlo todavía**: el usuario lo evaluó y decidió que no le compra nada hoy. Se retoma si empieza a molestar no ver lo que está en camino — sobre todo para no comprar de más, que es donde *Necesidad de Compra* queda corto | → [A-FEAT-55](#a-feat-55) `@productivo` |
| **A-DAT-08** | 🟢 | Dato | **HECHO 2026-08-27** · **La apertura del ciclo de recría 2026 pasó de 185 a 189 cabezas** — con OK explícito del usuario. Decía `103 machos + 82 hembras`, que es **la foto de hoy** ya sin las 4 mortandades; un ciclo abre con lo que entró y las bajas las descuenta sola la línea de tiempo, así que **se descontaban dos veces**. Quedó en `106 + 83`. Efecto: los kg netos de entrada pasan de **35.412,41** a **36.181,37** y el valor de entrada a $7.000/kg de **$247.886.876** a **$253.269.580** — que coincide con el control de rodeo de la maqueta ($253,2 M) con $20 mil de diferencia, que es el promedio de pesos contra los pesos individuales. Control después: `verificar-rodeo.mts` da **189 = 189 ✓**. **No se tocó ninguna otra columna ni ninguna otra tabla** | → [A-DAT-08](#a-dat-08) `@productivo` |
| **A-BUG-64** | 🟡 | Bug | **HECHO 2026-08-27 — falta testear ([A-TEST-53](#a-test-53))** · **El costo MEDIDO se perdía si ninguna receta lo reclamaba** — el margen sólo mostraba el consumo medido cuando encontraba una fila de `actividad_insumos` con nombre parecido. Al nombrar los productos por su **formulación comercial** (`Concentrado Novillo 35 10`) y no por actividad, el match por texto contra la receta (`Concentrado` a secas) **deja de funcionar — y fallaba en silencio**: el costo no aparecía en ningún lado y nada avisaba. Fix: **el consumo medido es un hecho y entra al margen por su cuenta**, con el nombre del producto y la aclaración *«sin fila de receta que lo proyecte»*. La receta sirve para proyectar hacia adelante; el vínculo entre las dos es **comodidad de presentación, no requisito** | → [A-BUG-64](#a-bug-64) `@presupuesto @productivo` |
| **A-DAT-09** | 🟢 | Dato | **HECHO 2026-08-27** · **Alta de los tres productos de alimentación**, con OK del usuario: `Maíz Granel`, `Concentrado Novillo 35 10` (novillos de 230 kg o más, en recría **o** engorde, 10 % de inclusión) y `Concentrado Terneros Recria` (desde 100 kg, 15 % de inclusión). Categoría *Alimento balanceado*, en kg, stock en cero. 🔑 **Se nombran por FORMULACIÓN COMERCIAL, no por actividad** — ver [A-DEC-06](#a-dec-06) | → [A-DAT-09](#a-dat-09) `@productivo` |
| **A-DEC-06** | 🟢 | Decisión | **RESUELTA 2026-08-27** · **Los insumos se nombran por su FORMULACIÓN, no por la actividad que los come** — el caso que lo decidió es real: usaron `Concentrado Novillo` para los terneros **de recría** todo el ciclo. Con nombres por actividad ese hecho **no tiene dónde escribirse**. El stock es físico: una bolsa es la misma la coma quien la coma, y **quién comió ya lo resuelven el reparto por kilo-día y la declaración**, que no miran el nombre. ⚠️ Consecuencia pendiente: si un producto lo comen dos actividades a la vez, hoy el reparto le da todo a recría —engorde no tiene ciclo ni lotes— y hay que **declarar** la parte de engorde | → [A-DEC-06](#a-dec-06) `@productivo` |
| A-TEST-53 | 🔴 | Test | **El costo medido aparece aunque no haya receta** ([A-BUG-64](#a-bug-64)) — con mediciones cargadas de `Concentrado Novillo 35 10`, en *Presupuesto → Margen → Recría* tiene que aparecer una fila **con ese nombre** y su monto, diciendo *«sin fila de receta que lo proyecte»*. Verificar que **no desaparece** al no haber ningún `actividad_insumos` que se llame igual, y que **no se duplica** con la fila de receta cuando sí matchean (caso `Maíz Granel` con el `producto` cargado) | → [A-TEST-53](#a-test-53) `@presupuesto @productivo` |
| A-TEST-37 | 🔴 | Test | **La página CUT como conciliación, con su control** ([A-FEAT-34](#a-feat-34) + [A-BUG-46](#a-bug-46) + [A-BUG-47](#a-bug-47)) — en **Marzo/2026** tiene que salir *A · Venían de antes (8)* + *B · Entraron en el período (4)* con las 4 marcadas **`Salió 30/03/2026 — Vendido`**, y el cierre `8 + 4 − 4 = 8` con **✓ OK**. En **Agosto/2026** las 4 vendidas en marzo **ya no deben aparecer** y tiene que salir la **alerta roja: "falta 1 cabeza sin identificar"** (9 cabezas vs 8 individuos). ⚠️ La hoja **Planilla no debe cambiar ni un número**. Probar además el aviso al mover a CUT sin caravanas (avisa, **no bloquea**) | → [A-TEST-37](#a-test-37) `@productivo` |
| A-TEST-36 | 🔴 | Test | **El pase a CUT sale como reclasificación, no como muerte** ([A-BUG-45](#a-bug-45) + [A-DAT-05](#a-dat-05)) — en la planilla de **Febrero/2026** la **Mortandad total tiene que decir 1** (antes 9) y las Compras de CUT **0** (antes 8), con *Reclas. −* Vaca **7** y *Reclas. +* CUT **8**. ⚠️ `Ingresos`, `Egresos`, `Stock Anterior` y `Existencia Final` **no tienen que cambiar**, y **marzo a agosto tampoco**. Falta además probar **un tacto nuevo**: es lo único que verifica el fix del código | → [A-TEST-36](#a-test-36) `@productivo` |
| **A-DEC-03** | 🟡 | Decisión | **Seis preguntas abiertas del módulo hacienda**: ¿`Novillito` está fuera de uso o le falta columna? · los nacimientos, que **todavía no se cargaron nunca**, ¿entran como movimiento o desde el ciclo de cría? · ¿las 3 columnas siempre vacías se dejan por fidelidad al formulario de papel? · ¿los adultos van a tener registro nominal o se acepta la caravana como texto libre? · ¿la razón social sale de `lib/empresas.ts`? · `productivo.stock_hacienda` está **vacía y no la lee nadie**: ¿se materializa o se borra? | → [A-DEC-03](#a-dec-03) `@productivo` |

⚠️ **Distinción que pidió el usuario y hay que respetar al triar**: en **MA nunca se parseó nada**
(cero reglas), así que sus 96 movimientos sin desglosar **no son un fallo** — son trabajo pendiente.
En **PAM sí hay reglas corriendo**, y por eso lo que queda sin desglosar ahí sí amerita revisión.
Mezclar las dos cosas infla el problema y esconde el bug real.

### 📎 GAS PDF — hallazgos 2026-06-21 (revisión del módulo)
| ID | Estado | Tipo | Tema | Detalle |
|----|--------|------|------|---------|
| A-FEAT-06 | 🔴 | Feat | Modal Buscar PDFs con selección (individual/todo-nada/Solo Buscar) + rango fechas + cancelar — ✅ IMPLEMENTADO, falta testear | → [A-TEST-02](#a-test-02) `@egresos` |
| A-BUG-10 | 🟡 | Bug | `fc='No'`/`NO Mail` ya NO se auto-buscan (modal pre-selecciona solo Buscar/null). Falta Parte B (import default) | → [A-TEST-02](#a-test-02) `@egresos` |
| A-FEAT-05 | ⏸️ | Feat | Editor de `fc` solo ofrece Sí/No/Portal — no se puede marcar 'Buscar' (mitigado: el modal deja buscar cualquiera a mano) | → [A-TEST-02](#a-test-02) `@egresos` |
| A-FEAT-07 | 🔴 | Feat | **Parte B** — import default `fc='Buscar'` — ✅ IMPLEMENTADO (nulls viejos NO se migran por decisión del usuario; Portal ya funcional vía imputación), falta testear | → [A-TEST-02](#a-test-02) `@egresos @importar` |
| A-FEAT-08 | 🔴 | Feat | **Parte C** — ✅ auto-crear proveedor al importar · ✅ backfill 32 proveedores creados (2026-06-21) · ✅ auto-disparo post-import gated APAGADO (`NEXT_PUBLIC_GAS_AUTODISPARO_IMPORT`). Falta testear | → [A-TEST-02](#a-test-02) `@egresos @importar` |

---

## 🅱️ SECCIÓN B — PROBABLEMENTE PENDIENTES (recientes, sin re-verificar 1×1)

### Features a medio hacer
| ID | Estado | Prio | Ítem |
|----|--------|------|------|
| B-FEAT-PRESU-INGRESOS | 🟡 | Alta | **Presupuesto de INGRESOS — arrendamientos agrícolas** (ver [dossier](#b-feat-presu-ingresos)). Diseño CERRADO + BD creada + datos MSA sembrados + `lib/arrendamientos/calculo.ts` + ABM precios/TC + 3 filas por campo en Presupuesto. **Falta:** ABM de contratos en Ventas, acción Fijar (parcial), volcado IIBB al template, Cash Flow, replicar PAM/MA. (2026-07-26) `@presupuesto @ingresos` |
| B-FEAT-01 | 🔴 | Alta | Órdenes de Pago — tabla intermedia `extracto → orden_pago → [FC1,FC2...]` (hoy `comprobante_arca_id` permite 1 sola FC) `@cashflow @extracto` |
| B-FEAT-02 | ⏸️ | Media | Arquitectura bidireccional FCI/Caja — diseñado, migración SQL lista sin ejecutar `@dashboard @presupuesto` |
| B-FEAT-03 | ⏸️ | Media | Dashboard rediseño — decisión arquitectural (5 opciones, recomendada B). Plan: `MODULO_DASHBOARD.md` `@dashboard` |
| B-FEAT-04 | 🔴 | Media | Templates bancarios separar MSA/PAM/MA + reglas PAM/MA `@extracto` |
| B-FEAT-05 | 🔴 | Media | Plan reglas+templates bancarios PAM/MA — Paso 4 (CAJA / CRED P); pasos 1-3 hechos `@extracto` |
| B-FEAT-06 | 🟡 | Media | Subdiario Ventas — igualar flujo a Compras. **EXPORT HECHO 2026-08-13** (un click PDF+Excel, carpeta, formato de PDF igualado) → falta testear `A-TEST-28`. Queda pendiente la otra mitad que el usuario había mencionado: **cuándo se ven los comprobantes y cómo se imputan** `@ingresos` |
| B-FEAT-07 | 🔴 | Media | Proveedores — carga orgánica (poblar desde facturas/extractos, no de a uno) `@principal` |
| B-BUG-CLIENTE-NO-SE-CREA | 🔴 | Alta | **Las VENTAS no dan de alta el cliente en `proveedores`** (compras sí) — rompe la regla consensuada "si hay factura, tiene que estar en proveedores/clientes". Causa raíz identificada, ver [dossier](#b-bug-cliente-no-se-crea). (2026-07-28) `@ingresos` |
| B-FEAT-08 | 🔴 | Baja | Margen por superposición — órdenes agrícolas (diseño aprobado, ~25-30 líneas) `@presupuesto @productivo` |
| B-FEAT-09 | 🔴 | Baja | Editar empleado existente (hoy sólo SQL) `@sueldos` |
| B-FEAT-10 | 🔴 | Baja | `formatoCantidad('L')` — muestra ml como L ("1122 L" vs "1,122 L") `@productivo` |
| B-FEAT-11 | 🔴 | Media | **Extracto bancario de ECHEQs endosados** — los echeqs endosados entran y salen pero NUNCA se acreditan en cuenta bancaria → es el único medio de pago que queda sin conciliar. Hace falta un "extracto" propio (importar por Excel o carga directa) para registrarlos y conciliarlos. NO desarrollar ahora — pedido del usuario 2026-06-22. `@extracto @cashflow` |
| B-FEAT-12 | 🔴 | Baja | **Tarjeta — tabla colapsable por mes**: hoy es tira-resumen arriba + tabla plana completa abajo (commit 1c0ebc5). Mejora: unificar en una sola grilla colapsable por resumen (meses plegados → desplegar filas) manteniendo columnas/edición/selector. (2026-06-22) `@extracto` |
| B-FEAT-MAIL-DETALLE | 🟢 | Media | **Mail automático de Detalle de pago al proveedor** (con certificado SICORE adjunto si hay retención). Un mail POR PAGO (1 FC o grupo de N → 1 mail). Flujo: tilde "✉ enviar detalle" en el pago (default ON si SICORE) → app arma Detalle PDF (`lib/pagos/pdf-detalle-pago`, ya renombrado Comprobante→Detalle) + certificado (`generarCertificadoRetencion(...,true)` en vista-facturas-arca, a extraer a lib) → encola en `public.mails_pago` (CREADA 2026-07-09, ver RECONSTRUCCION). **GAS** lee `pendiente` → crea **BORRADORES** en Gmail (asunto+cuerpo+adjuntos) → marca (después: enviar directo). Sin horarios, en lote manual. Email = `proveedores.email_pagos` (sin campo nuevo). Mensaje = template autollenado editable (el mensaje del **lote Galicia/banco es OTRO**, no se mezcla). **HECHO:** rename Comprobante→Detalle · tabla `mails_pago` · **GAS** `gas-mail-detalle/EnviarMailsDetalle.gs` (crea borradores desde la cola). **Decidido:** encolar va en el **botón Pagos (Modal = vista-facturas-arca)** donde ya está SICORE + el detalle PDF + `generarCertificadoRetencion(...,true)`; el **panel de seteo/revisión** va en Cash Flow. **HECHO (2026-07-09, sin testear):** modo base64 en detalle PDF del Modal · `encolarMailDetalle` (detalle+certificado+email_pagos+INSERT) · botón **✉** junto al 📄 en **Pagos ARCA** del Modal · **panel `PanelMailsPago`** ("✉ Mails de detalle" en Cash Flow: lista cola, edita destinatario/asunto/cuerpo, toggle adjunto, borra, ve estado). **✉ en:** ARCA (grupo + por FC) y Templates (grupo + por item) — templates sin certificado (no tienen SICORE), email por `cuit_quien_cobra`. **TESTEADO OK (2026-07-10):** borradores creados en Gmail (cuenta San Manuel) con detalle + certificado adjuntos y fecha de pago en el cuerpo. **NUEVO (2026-07-10):** (a) línea `Fecha de pago:` en el cuerpo (de `sicore_retenciones.fecha_pago`; si no, la estimada; si no, puntos `..............` para completar a mano); (b) botón **'Enviar Borrador'** por fila **+ 'Enviar todos los pendientes'** en el panel — disparan el **GAS web app** vía `fetch` **no-cors** (`?id=<uuid>` uno / sin id todos); URL guardada en localStorage `gas_mails_url`; refresca estado a ~3-4s; (c) **GAS = Web App** (`doGet`) en proyecto **SEPARADO** de la cuenta **sanmanuel.sp@gmail.com** (Execute as: Me=San Manuel · Who has access: Anyone) → los borradores salen de esa casilla. **LockService + guarda por `gmail_draft_id`** → no duplica ante doble disparo; (d) **REFACTOR a lib compartida** (regla DRY): `lib/pagos/encolar-mail-detalle.ts` (lógica, UI-agnóstica, devuelve resultado) + `lib/pagos/certificado-retencion.ts` (cert movido del inline) + `lib/pagos/pdf-detalle-pago.ts` (opción `returnBase64`). El modal (`encolarMailDetalle` = wrapper con alert) y Cash Flow llaman la MISMA función; (e) **Cash Flow: botón '✉ Encolar mail detalle'** sobre filas seleccionadas (agrupa x proveedor, junta `id`/`ids_grupo` como `factura_id` para el cert) → **sirve para proveedores YA pagados** (el modal de Pagos no muestra pagadas; Cash Flow es lo que se usa de acá en más). Cert matchea por `sicore_retenciones.factura_id` (ya no depende de `registrosV2`). **Config real del GAS:** `SUPABASE_URL='https://lyojiaglcictmboqwxfm.supabase.co'` + anon key. **FALTA:** (1) los 2 sitios del modal-detalle interno (7373/7400) sin ✉ (secundario); (2) pasar `createDraft`→`sendEmail` en el GAS cuando el user valide envío directo; (3) al cambiar el código del GAS → redeploy 'Gestionar implementaciones → Nueva versión' (la URL no cambia); (4) duplicación pre-existente pdf/cert inline en el modal (se limpia al deprecar el Modal, E5). (2026-07-10) `@cashflow @egresos` |
| B-BUG-PDF-DETALLE | 🟢 | Media | **PDF "Detalle de pago" no muestra descuentos / SICORE** — ✅ **RESUELTO (2026-07-21, commit 0d21d58, sin testear).** Causa: el generador (`lib/pagos/pdf-detalle-pago.ts`) SÍ maneja SICORE/descuento (columnas condicionales), pero la **`CashFlowRow`** del hook (`useMultiCashFlowData`) NO incluía `monto_sicore`/`descuento_aplicado`/`monto_a_abonar` (solo `sicore`/`imp_total`) → el caller del Cash Flow (`generarPDFPagosSeleccionados`) recibía `undefined` → columnas no aparecían. **Fix:** exponer los 3 campos en la fila ARCA individual + de grupo (suma). El **Modal** (`mapFacsAItems`) ya los pasaba bien (bug era solo Cash Flow). **Testear: descargar detalle desde Cash Flow y ver Retención/Descuento.** `@cashflow @egresos` |
| B-FEAT-PAGO-MULTIMEDIO | 🟢 | Media | **Detalle de pago con VARIOS medios (transferencia + echeq)** — ✅ **HECHO (2026-07-21, commit 4e033f1, sin testear).** Nueva lib `lib/pagos/medios-pago.ts` (`obtenerMediosPagoFactura`: reúne anticipos=transferencia + cheques=echeq + transferencias directas del extracto `msa_galicia`, por `factura_id`/`template_cuota_id`). El **PDF Detalle de pago** ahora agrega una sección **"Desglose del pago"**: cada medio (con banco/nro/fecha del echeq) + Retención SICORE + Descuento = **Total factura** (con aviso ⚠ si no cuadra ±$1); la tabla principal oculta Transferido/Cancelado cuando hay desglose. Lo pasa el caller del Cash Flow (`generarPDFPagosSeleccionados`, solo ARCA). **Caso testigo Longo:** anticipo 6.505.867,50 + echeq 1.456.737,50 + SICORE 129.270 = 8.091.875. **✅ FASE 2 HECHA (2026-07-21, commit 3819fb5):** el **✉ mail-detalle** también usa el desglose — PDF adjunto con la sección + cuerpo del mail listando cada medio (transferencia/echeq). Seleccionando **solo el echeq** el mail incluye la transferencia automáticamente. **BUG CORREGIDO (mismo commit):** el cert SICORE no se adjuntaba al seleccionar echeq+transferencia juntos → el `tipo` se decidía por `fs[0].origen` (si la 1ra fila del grupo era la transferencia/ANTICIPO, `tipo=template` y se salteaba el cert). Fix: `tipo='arca'` si CUALQUIER fila es ARCA (mail + PDF). **Testear.** Residual menor: seleccionar las 2 líneas duplica el anticipo en los totales del cuerpo → mejor marcar solo el echeq (o pulir para que la transferencia no haga falta seleccionarla). **Falta:** la vista pantalla-detalle (secundario). `@cashflow @egresos` |
| B-FEAT-14 | 🔴 | Media | **Análisis productivo-económico (engorde)** — módulo NUEVO en Historial pesadas (`components/analisis-productivo.tsx` + `segmentador.tsx`). Incluye: multi-segmentador · marcado reposición (es_torito) · análisis margen (calcular) · escenario B dinámico (16 vars) · cadena de etapas · punto de equilibrio · análisis de sensibilidad · guardar/cargar/borrar estudios (localStorage+.json) · **precios de mercado** (scraping entresurcosycorralesya, botón mkt auto-poblar por kg neto+sexo). **Falta TESTEAR TODO** contra el Excel del usuario (ver `MANUAL-USO.md` + memoria `project_analisis_productivo`). **v2 pendiente:** (a) **sub-modal** para ver la sensibilidad más ancha; (b) **persistir** la config de sensibilidad en el estudio (hoy sesión); (c) **export Excel/PDF**: hoy cada segmento exporta lo suyo, PERO no hay export **COMBINADO** (todos los segmentos + la combinada) y el export **no refleja** el punto de salida (sigue "punta a punta") ni el tilde incluido/A-vs-B. El **guardado local + JSON SÍ captura todo** (incluido, salidaEtapa, duplicados). (d) agrupador de segmentos + sensibilidad de cadena. (2026-07-09) · **HECHO 2026-07-10/11 (commits 0551bb8/2941fb5/aff89e6/88a3a5a):** (1) precios de mercado scrapeados se **guardan/restauran CON el estudio**; (2) **congelar segmentado** con foto + receta → al cargar la app pregunta **📌 foto** (snapshot, no toca BD) vs **🔄 re-link** (reproduce del config); (3) **Estimado configurable** *desde* (pesada base) / *hasta* (fecha del análisis) → reproduce el kilaje exacto y permite recuperar estudios viejos a mano; (4) **import pesadas por columna `Caravana` no oficial** (CUT/Descarte en `caravana_oficial`, toros en `caravana_interna`). Testeado visualmente OK por el usuario. · **HECHO 2026-07-13:** (5) **export COMBINADO del estudio** (⬇ PDF total = resumen + detalle por segmento · ⬇ Excel total = hoja Resumen + hoja por segmento; PDF declarativo reusado del export individual; respeta tilde `incluido`) → cierra el v2-(c); (6) **💾 Actualizar «estudio»** (sobrescribe el estudio abierto sin re-tipear nombre) + **Guardar como…** (nuevo) → evita duplicados. · **⏳ PENDIENTE DE TEST (2026-07-13, el usuario testea luego):** commits `9150fdb` (export combinado PDF/Excel + Actualizar), `93f540e` (detalle por etapa en el export), `9da43e8` (panel de sección Fase 1: individuos + sub-segmentar), `f58bf39` (panel de sección Fase 2: índices históricos ganancia p-p / últimas pesadas + promedio grupo). Todo en `desarrollo`, sin mergear. `@productivo` |
| B-FEAT-COSTOS-PRODUCTIVOS | 🔴 | Alta | **Costos productivos atados a la venta (ganadería)** — cada venta presupuestada lleva su costo variable: maíz, concentrado, sanidad, verdeos. **La unidad de planificación es la ACTIVIDAD**: se carga "este lote hace recría del 1/4 al 30/9" y salen solos la curva de peso, el consumo mes a mes, lo que falta comprar y el egreso. El motor de ración YA existe (`calcular()` en `analisis-productivo.tsx:150`) y el stock de insumos también (`productivo.stock_insumos` / `movimientos_insumos`). Plan C-1..C-8 en el dossier § FASE C. **0 código** — planificado 2026-07-30. `@presupuesto @productivo` |
| B-FEAT-PRESUPUESTO-CUENTAS | 🟡 | Alta | **Presupuestar cuentas contables** — panel nuevo en Presupuesto (`components/panel-presupuesto-cuentas.tsx` + `lib/presupuesto/modos.ts`). 6 modos por cuenta (última FC · promedio N · estacional · por cabeza · manual · excluida) con sugerencia automática según cómo se comportó la cuenta, explicación de cómo se calculó cada celda, y control de cordura contra los últimos 6 meses reales. Vista `presupuesto_historia_cuentas` unifica ARCA + histórico por `nro_cuenta` (estaban partidos por mayúsculas y solapados en dic-2025). **Sin testear** — 2026-07-30. `@presupuesto` |
| B-FEAT-CONTROL-PROVEEDORES | 🟡 | Media | **Control de subas de proveedores vs IPC** — panel en Presupuesto (`components/panel-control-proveedores.tsx` + `lib/proveedores/control-subas.ts`) con export Excel y PDF. Mide punta a punta (NO mín-máx: el monto mezcla precio y cantidad) y separa precio de consumo contando cuántas veces bajó. Semáforo contra el IPC acumulado del mismo período; si falta IPC no inventa la comparación. **`indices_ipc` está vacía** — se carga en Precios y TC. **Sin testear** — 2026-07-30. `@presupuesto` |
| C-17 / C-19 | 🔴 | Alta | **Cerrar el presupuesto como una sola cosa.** (a) **C-19**: bajar el bloque de cuentas contables a la grilla y sumarlo al TOTAL EGRESOS (hoy está en un panel aparte a propósito, ver cierre de sesión); (b) **C-7**: ídem costos de producción, que ya se calculan por tramo pero no bajan; (c) **C-17**: proyectar los templates donde no hay cuota cargada — las cuotas se cortan en dic-2026. La distinción de qué template quiere el usuario cargado a mano ya existe en `egresos_sin_factura.aplica_generacion` (true = Cargas Sociales, SICORE, UATRE… = avisar 'falta generar la campaña'; false/null = proyectar en silencio). 2026-07-30. |
| C-22 | 🟡 | Media | **Estructura del dashboard en el presupuesto** — **paso 1 HECHO** (2026-07-31, sin testear): la grilla se parte en secciones **EGRESOS / DISTRIBUCIONES** con subtotal cada una, mismos títulos y colores que `tabla-resumen-financiero.tsx`. Los retiros dejan de estar escondidos dentro del total (siguen sumando: el presupuesto es de caja). Ningún número cambió. **Falta el paso 2**: dentro de cada sección ordenar por `nombre_totalizadora` en vez de alfabético — eso sí depende de la Fase 1 de C-24. Dossier § C-22. `@presupuesto` |
| C-27 | ✅ | — | **`tipo` en el template** (2026-07-31, **sin testear**) — columna `egresos_sin_factura.tipo` cargada en los **176** templates (150 egreso · 14 distribucion · 11 financiero · 1 ingreso). Cascada `template.tipo ?? cuenta.tipo ?? signo` en `resolverTipo()` (`lib/presupuesto/templates.ts`), usada por el dashboard y el presupuesto. **Cierra la Fase 0 de C-24 por otro camino**: el template ya no depende de que su categoría esté en el plan (70 de 123 activos no lo estaban). **Efecto medido: $43,65 M en 15 movimientos pasan de egresos operativos a distribuciones.** El wizard ahora pide el Tipo. Dossier § C-27. |
| C-26 | 🔴 | Alta | **Las otras dos puertas de alta crean templates incompletos** — el **wizard ya está arreglado** (C-27: pide Tipo y lo sugiere desde el plan), pero `modal-crear-template-faltante` (toma la categ del movimiento bancario) y `generador-renovacion-campana` (clona la del original) siguen creando sin `tipo` y ofreciendo las 23 categorías huérfanas. Hoy no rompen porque la cascada los salva, pero el hueco vuelve de a poco. Falta además que las tres lean las categorías **del plan** y no de los templates. Conviene una pieza compartida, como `SelectorCuentaContable`. 2026-07-31. `@egresos` |
| B-FEAT-15 | ⏸️ | Baja | **Pesadas sin caravana (`sin_idv`)** — hoy se cuentan y se **descartan**. Pedido: en el import preguntar "dejar de lado / sumar al total (sin caravana)" y que cuenten en el promedio de la segmentación. **Diferido por el usuario**: complica el sexo (un pesaje sin caravana no tiene sexo → no cae limpio en Machos/Hembras del multi-segmentador). Retomar con calma. (2026-07-09) · **Nota:** distinto del import por columna `Caravana` NO oficial (CUT/Descarte, toros) que SÍ se hizo (commit aff89e6, B-FEAT-14); `sin_idv` = pesaje sin ninguna caravana, sigue diferido. `@productivo @importar` |
| B-FEAT-17 | 🔴 | Media | **Precios de mercado desde web (entresurcosycorralesya.com)** — traer Prom.Kilo / Kilo+ / Kilo− / Bulto por categoría-rango (URL parametrizable `?desde=&hasta=`) para poblar los precios del análisis de engorde según nuestros kilajes/categorías. **La tabla se carga por JS** (no viene en el HTML). **ENDPOINT ENCONTRADO (2026-07-09):** `https://www.entresurcosycorralesya.com/ajax-modulo-ternero.php?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` → devuelve la tabla HTML completa (15 filas, 8 cols: Categoría, Cantidad, Prom.Kilo, Kilo+, Kilo−, Prom.Bulto, Bulto+, Bulto−). Server-side, sin CORS issue vía API route. **HECHO (2026-07-09):** `app/api/precios-mercado/route.ts` (param `sexo=macho/hembra` → ternero/ternera, excluye Holando, parsea límites de peso). En el análisis: panel "Traer precios" + botón `mkt` por segmento/etapa que autopobla. **Matemática acordada:** base = **Kilo+ (máx) del rango asignado a su extremo liviano (pesoLo), interpolado** por kg NETO (post-desbaste) × (1+prima% calidad, editable default 0). Sexo derivado de la Fuente. Resalta el rango usado. **Ojo:** el sitio publica con demora → días recientes vienen VACÍOS (default de fechas ya termina 3 días atrás; mensaje claro si no hay datos). El usuario reportó que el sitio no abría ni desde Chrome (2026-07-09) → verificar si es caída temporal del sitio. `@productivo` |
| B-FEAT-16 | 🔴 | Media | **Import pesadas SIN dedup** — `productivo.pesadas_terneros` solo tiene PK en `id` (NO unique por `ternero_id+fecha`, verificado 2026-07-09). Re-importar un animal sobre una fecha ya cargada **duplica** la pesada en silencio. Columnas del historial = por fecha (mismo día → misma columna). Evaluar: unique constraint `(ternero_id, fecha)` o chequeo previo en el import. (2026-07-09) `@productivo @importar` |
| B-FEAT-13 | 🔴 | Media | **Organización de mails propaganda** (2º módulo de mail, junto al de FC). **Fase 1 REVISIÓN** = entender qué remitentes van a qué etiqueta/carpeta → herramienta **YA hecha**: `gas-buscar-pdf/ReporteEtiquetas.gs` (CSV label·remitente·count). **Fase 2 AUTO-MOVER** (sin desarrollar): replicar el movimiento manual (de:X → etiqueta Y + sacar de Recibidos). Luego se **desactiva la revisión** y queda solo el auto-mover. Reportes pueden ir a `sanmanuel.sp`. (2026-06-27) `@general` |

### Testing pendiente (commits de mayo, sin testear)
| ID | Estado | Ítem |
|----|--------|------|
| A-TEST-07 | 🔴 | **Presupuesto → Campos y hectáreas** (2026-08-02) — cómo probarlo en `MANUAL-USO.md` § Campos y hectáreas `@presupuesto` |
| A-TEST-08 | 🔴 | **Presupuesto → Variables de costo** (2026-08-03) — incluye la **regla A** (la cuenta con variable sale del bloque de cuentas). `MANUAL-USO.md` § Variables de costo `@presupuesto` |
| A-TEST-09 | 🔴 | **Presupuesto → Inversiones** (2026-08-03) — fuera del TOTAL EGRESOS. `MANUAL-USO.md` § Inversiones `@presupuesto` |
| A-TEST-10 | 🔴 | **Presupuesto → Control de cobertura** (2026-08-03) — avisa lo que falta Y lo que se cuenta dos veces. `MANUAL-USO.md` § Control de cobertura `@presupuesto` |
| A-TEST-16 | 🔴 | **Presupuesto → Margen por actividad** (2026-08-03) — es una VISTA sobre datos existentes. Cria 26/27 debe dar **175 ha y 260 cabezas**, y los 4 costos por ha deben cerrar contra el Excel. `MANUAL-USO.md` § Margen por actividad `@presupuesto` |
| A-TEST-19 | 🔴 | **Comercialización de hacienda — a quién conviene venderle** (2026-08-04) — destino + intermediario en la etapa 1 del análisis; CZ desglosada (comisión + gasto + flete) con % parcial y total; conversión res→vivo por el rinde; comparador de los 3 destinos. 7 pasos en `MANUAL-USO.md` § Comercialización. ⚠️ **El paso 1 es el que caza más bugs**: si el desbaste no cambia entre gordo e invernada, la derivación no corre `@productivo` |
| M-10 | 🔵 | **Renombrar `terneros.es_torito` → `es_reposicion`** (booleano, NO texto M/H: `sexo` ya dice eso). El nombre miente — marca **60 hembras**— y ya causó daño: me hizo leer la bandera como duplicado de la categoría y proponer unificarlas, lo que habría borrado información. **Postergado a propósito**: el usuario está testeando comercialización y margen, y un fallo silencioso ahí contaminaría esa medición. **Receta:** (1) `ALTER … RENAME COLUMN`; (2) actualizar los **9 archivos de código** (`tab-terneros`, `vista-sector-productivo`, `panel-lotes-hacienda`, `segmentador`, `tab-presupuesto`, `tab-evolucion-rodeo`, `lib/ganaderia/disponibilidad`, `lib/productivo/caravanas`, `api/import-terneros`); (3) **`grep es_torito` sobre `.ts/.tsx` tiene que dar CERO** — no hay nombres construidos dinámicamente, así que el conjunto es cerrado y verificable; (4) type-check + build. ⚠️ **El único fallo silencioso posible** son los 2 `select('*')` de `tab-terneros.tsx` (líneas ~325 y ~430): ahí una lectura olvidada da `undefined` y **todos los animales dejarían de ser reposición sin un solo error**. El resto explota ruidosamente `@productivo` |
| M-11 | 🔵 | **La brecha previsto ↔ confirmado no se ve en ninguna pantalla** — `es_torito` es la **intención** y la categoría el **hecho**; las 60 vaquillonas cambian de categoría recién al inseminarse (octubre) y varios de los 9 toritos pueden descartarse. Que difieran **no es un error: es el dato**. Falta mostrarlo: *"Reposición: 60 previstas · 0 confirmadas · se confirman en octubre"*. Mismo patrón que presupuestado→real en ventas `@productivo` |
| A-TEST-21 | 🔴 | **Circuito de ventas de hacienda** (2026-08-05) — presupuestar → confirmar (un paso, con caravanas) → editar. `MANUAL-USO.md` § Ventas de hacienda, 6 pasos. ⚠️ **El paso 4 caza el error más caro**: después de confirmar, el disponible **tiene que bajar**. Si sigue ofreciendo las mismas cabezas, la existencia no descuenta las bajas y el presupuesto proyecta vender animales que ya no están. Hay **una venta real cargada** (55 cab, $91,7 M) con la que se puede verificar `@productivo @ingresos` |
| A-TEST-22 | 🔴 | **Panel del ciclo de recría** (2026-08-05) — apertura desde la pesada del destete, neto como columna generada, promedio ponderado, y la transferencia cría→recría. `MANUAL-USO.md` § Ciclo de recría `@productivo` |
| A-TEST-23 | 🔴 | **Ingresos → Ganadería: cría y recría separadas** (2026-08-05) — por actividad y por campaña, con el desglose *destetados − se guardan = a vender*, las confirmadas y el disponible. Usa la **misma valuación que el Presupuesto**: si los números difieren entre las dos pantallas, hay un bug `@ingresos @productivo` |
| A-TEST-20 | 🔴 | **Aviso: marca de reposición ≠ categoría Torito** (2026-08-05) — sólo en machos, porque *un torito no está capado: es un hecho, no un plan*. Dice las dos salidas (sacar marcas / recategorizar). 3 pasos en `MANUAL-USO.md` § La marca de reposición. ⚠️ El paso 2 es el que valida el criterio: marcar una **hembra** NO debe avisar `@productivo` |
| A-TEST-25 | 🔴 | **Cash Flow multiempresa** (2026-08-08) — las FC de PAM y MA aparecen y se pueden pagar; columna Empresa; dos filtros con defaults distintos; SICORE/echeq/agrupar sólo MSA. `MANUAL-USO.md` § Cash Flow multiempresa, 7 pasos. ⚠️ **El paso 4 es el que caza el error caro**: pagar una FC de PAM y verificar que el cambio quedó **en PAM**; si el guardado dice OK pero al recargar volvió atrás, la escritura fue al schema equivocado. Hay 4 FC de PAM y 92 de MA para probar `@cashflow` |
| A-TEST-24 | 🔴 | **Ficha de proveedor** (2026-08-07) — modal de consulta desde *Principal → Proveedores* y desde el ícono 🏢 del control de subas. Datos del maestro + últimas facturas + últimos pagos + anticipos. `MANUAL-USO.md` § Ficha de proveedor, 6 pasos. ⚠️ **Lo no testeado de verdad es el botón Editar**: la lectura se verificó contra la BD, pero **el guardado no se probó** (no se tocan datos reales sin permiso) y el PATCH ahora acepta 14 campos que antes no eran editables por ninguna pantalla. Probar primero con un campo inocuo (`notas`). Dossier → [A-TEST-24](#a-test-24) `@principal` |
| G-03 | ✅ | **~~Un lote 100 % vendido se marca como «desactualizado»~~** — RESUELTO 2026-08-05: `desactualizado()` no compara cuando el saldo es 0. Con saldo 0 los animales que quedan en la pesada son **los que NO se vendieron**, así que el lote siempre iba a diferir, y el aviso invitaba a correr «Desde pesada» — que **reescribiría una venta ya hecha**. Ver abajo el detalle original |
| ~~G-03~~ | 📎 | *(detalle)* **Un lote 100 % vendido se marcaba como «desactualizado»** — *Productivo → Evolución Rodeo → Cabezas disponibles*. El lote de 55 terneros tiene `vendidas 55 · quedan 0` y el panel igual avisa *"corré «Desde pesada» para traer los números nuevos"*. ⚠️ **Es una invitación a reescribir una venta ya hecha**: los 40 que quedan NO son de ese lote, son los que *no* se vendieron. La comparación lote↔pesada sólo tiene sentido mientras el lote tenga saldo. Los números en sí están bien (55→40 y 275→227,7 kg son correctos: los vendidos eran los más pesados) |
| G-04 | 🟡 | **El título «Cabezas disponibles para vender» miente: muestra LOTES** — lo que no tiene lote no aparece. Hoy quedan **40 terneros** y **21 terneras** de recría sin lote y son invisibles ahí; el badge dice **309**, que son sólo los 4 lotes de destete. El disponible-por-diferencia sí existe pero vive en *Presupuesto* y en *Ingresos → Ganadería*. O el panel muestra también el disponible, o el título dice «Lotes de venta» `@productivo` |
| G-05 | 🔵 | **Las ventas confirmadas no se ven en el panel de lotes** — la venta de $91,7 M sólo aparece restando cabezas (`vendidas 55`), sin monto ni estado. El *Total presupuestado* ($433 M) tampoco la incluye, lo cual es correcto —ya no es presupuesto— pero no hay un total de lo vendido al lado `@productivo` |
| G-01 | 🟡 | **Editor de venta ÚNICO, accesible desde varios lados** — principio del usuario (2026-08-05): *"se registra en un solo lugar y se accede desde varios, pero cualquier lugar desde donde se acceda debe tener los campos completos, si no no sirve de nada"*. Hoy hay **dos** editores y el de Presupuesto está **mutilado**: `ModalPresupuestarVenta` no tiene plazo de cobro ni alícuotas; el completo es el panel de lotes de *Sector Productivo → Evolución Rodeo*. ⚠️ **Un formulario incompleto es peor que ninguno**: deja cargar algo que hay que ir a completar a otro lado, y mientras tanto el número está mal. **Extraer el completo a un componente** y usarlo desde Evolución Rodeo, Presupuesto e *Ingresos → Ganadería*. Duplicarlo sería el tercer lugar `@productivo @ingresos` |
| G-02 | 🔵 | **`presupuesto_ganaderia` quedó huérfana** — se retiró de la pantalla el 2026-08-05 (estaba desconectada del presupuesto y con los porcentajes cargados como fracciones: IVA `1,05`, machos `0,05`). **La tabla y su fila siguen en la BD**, sin UI. Decidir: borrarla, o recuperar el modelo paramétrico haciendo que **genere los lotes** en vez de convivir con ellos como segunda fuente. El modelo paramétrico tiene sentido para la cría, donde los terneros todavía no existen `@presupuesto @productivo` |
| R-01 | 🟡 | **Cargar el primer ciclo de recría** — `productivo.ciclos_recria` está creada y **vacía**. Los datos salen de la pesada del destete (23/02/2026): 103 ♂ de 199,3 kg y 82 ♀ de 194,9 kg brutos; el neto lo calcula la columna generada. **Bloqueado por 2 definiciones del usuario**: cómo se nombra el ciclo (¿"2026"?) y si entran los 9 toritos + 60 de reposición en la apertura *(él dijo que sí en principio, sin certeza)* `@productivo` |
| R-02 | 🟡 | **No hay pantalla del ciclo de recría** — la tabla existe pero no se ve ni se edita en ningún lado. Cría tiene *Evolución del rodeo*; recría no tiene equivalente `@productivo` |
| R-03 | 🟡 | **Los lotes de recría no cuelgan del ciclo** — `stock_lotes.ciclo_recria_id` existe y está en NULL. Sin eso el lote no tiene campaña y el rodeo de recría no rueda año a año `@productivo` |
| R-04 | 🔵 | **Falta el precio de entrada de recría** (`ciclos_recria.precio_kg_entrada`) — es la **venta de cría a recría**, y es lo que cierra el resultado de la cría. El usuario dijo que puede ser posterior. ⚠️ Sin él, el margen de recría da **ganancia de más**: los animales entran a costo cero `@productivo` |
| M-12 | 🔵 | **`stock_ciclos.toritos_retenidos` está en 0** y los toritos reales son 9 (7 con categoría + 2 sólo con bandera). Dato desincronizado — **no tocado**, es del usuario. Ver también: cambiar de categoría **no limpia** `es_torito` (pasó con 8 toros el 26/04, ya corregido a mano) ni genera el movimiento de stock `@productivo` |
| M-07 | 🟡 | **El selector de comercialización sólo está en la etapa 1** — falta replicarlo en las etapas 2+ de la cadena. Es el mismo componente; se esperó a testear la etapa 1 porque en la tabla de la cadena el espacio es más apretado `@productivo` |
| M-08 | 🔵 | **Falta el precio del gasoil** — no hay serie en el sistema. Sin él, `proyectarTarifa()` no puede revaluar el flete a futuro (hoy 35 % atado al gasoil, el resto por IPC). Decidir dónde vive: ¿una serie más en *Precios y TC*, junto al IPC y el TC? `@productivo` |
| M-09 | 🔵 | **Datos que faltan de comercialización** — km del *Matarife zonal* (no cobra flete, pero queda para el registro) · confirmar si el 3,5 % de Sáenz Valiente en gordo difiere del de invernada · plazos de pago (el usuario aclaró que **no son estándar**: se ponen al vender, no van por destino) `@productivo` |
| A-TEST-18 | 🔴 | **Import de pesadas: la fecha se confirma** (2026-08-03) — editable en el paso 1 + aviso con las dos lecturas cuando el archivo es ambiguo. 🐛 **Bug real**: un `3/8` metió **176 pesadas en marzo** en silencio; el dato ya se corrigió en BD. `MANUAL-USO.md` § Importar pesadas `@productivo @importar` |
| A-TEST-17 | 🔴 | **Margen → costos directos editables + cadena de ajustes** (2026-08-03) — cada costo se despliega, muestra *cómo se arma* y se edita ahí mismo; ajustes `× IPC × +30 %`; modo nuevo **cantidad × precio**; `fundamento`. `MANUAL-USO.md` § Margen por actividad, pasos 6-11 `@presupuesto` |
| M-02 | 🟡 | **Cría precargada en Productivo** (2026-08-03) — 12 costos del Excel, editables, cada uno con **su superficie** (`has_aplicacion` + `amortiza_anios`) y **su base de cabezas** (`base_cabezas`). ⚠️ **El silo va por TONELADA y quedó como `monto_ha`** — el modo `monto_unidad` ya existe, falta que el usuario lo cambie (es un dato); siembra de verdeos y gas oil en 0; **los toros van a mano (12)** porque el rodeo no los modela `@presupuesto @productivo` |
| M-03 | 🟡 | **Retirar `public.presupuesto_variables`** — ya no tiene nada que `actividad_insumos` no tenga: la cadena de ajustes se replicó en `productivo.actividad_insumo_ajustes` (2026-08-03). Falta migrar su **única fila** (Rollos, que además ya está cargada en cría) y sacar el botón *Variables de costo*. **Hacerlo recién después de testear el margen** — es lo que decide `@presupuesto @productivo` |
| M-05 | 🔵 | **La BASE del costo tiene que poder ser la historia, no sólo un número** (pedido del usuario 2026-08-03) — hoy la cadena **se monta encima** de los 30 U$S/cabeza; él quiere poder decir *"lo gastado el año pasado + IPC + el aumento de stock"* y que **el número fijo quede invalidado**. Motivo textual: *"basarse en los gastos históricos como lo hace el resto del presupuesto es una de las fuentes más viables — creo que se debe poder empezar de ahí"*. Requiere que el insumo apunte a una **cuenta contable** (reusar `SelectorCuentaContable`, no un `<select>`) y leer su historia con los mismos modos del panel de cuentas `@presupuesto @productivo` |
| M-06 | 🔵 | **Márgenes teóricos, para comparar** (pedido del usuario 2026-08-03, *"eso sería para más adelante"*) — poder registrar el margen teórico de una actividad y contrastarlo contra el proyectado y el real. Es la tercera columna del gradiente que ya existe (`teórico` → `presupuestado` → `fijado/real`) `@presupuesto @productivo` |
| M-04 | 🟡 | **El margen no resuelve los modos de ración** (`pct_racion`, `kg_cabeza_dia`) — es lo único que separa a **recría/engorde** de poder trabajarse enteras desde el margen. No es un problema de pantalla sino de función: falta que el margen sepa integrar la curva de peso × los días del tramo. ⚠️ Bloqueado además por **`lote_tramos` = 0 filas** `@presupuesto @productivo` |
| A-TEST-15 | 🔴 | **Presupuesto → Descargar Excel y PDF para los socios** (2026-08-03) — resumen + detalle por bloque; el saldo del export tiene que coincidir con el de la pantalla. `MANUAL-USO.md` § Descargar para los socios `@presupuesto` |
| A-TEST-14 | 🔴 | **Arranque del saldo: dos modos** (2026-08-03) — a mano / último conciliado, con aviso si el extracto está atrasado. `MANUAL-USO.md` § De dónde arranca el saldo `@presupuesto` |
| P-43 | ⚠️ | **El cupo anual NO está validado como forma de presupuestar** — aviso naranja visible en pantalla, a pedido del usuario. Falta decidir: si el monto anual puede corregirse a mitad de camino, si el arrastre corresponde a TODOS los conceptos, y qué hacer ante sobregasto (hoy la variable desaparece). **No sacar el aviso hasta que el usuario dé el OK** `@presupuesto` |
| A-TEST-13 | 🔴 | **Cupo anual con arrastre** (2026-08-03) — muestra el SALDO (cupo − ejecutado), se corre solo si no se gasta, y desaparece si ya se gastó todo. + los 2 avisos. `MANUAL-USO.md` § Variables de costo, pasos 7-8 `@presupuesto` |
| A-TEST-12 | 🔴 | **Presupuesto → Sueldos del presupuesto** (2026-08-03) — sueldo por empleado, francos, premio anual, aguinaldo jun/dic y SUSS con +50% en ene/jul. Cascada presupuesto→periodo. `MANUAL-USO.md` § Sueldos del presupuesto `@presupuesto @sueldos` |
| A-TEST-11 | 🔴 | **Panel de cuentas: muestra del cálculo, IPC 12 meses, botón Actualizar y encabezados pegados** (2026-08-02/03) `@presupuesto` |
| B-TEST-01 | 🔴 | Centros de costo controlado (99fa03a) — tabla maestra + combobox en 6 lugares `@general` |
| B-TEST-02 | 🔴 | UI Reglas Import ARCA (61ae7f6) — ABM reglas CUIT→cuenta `@importar @egresos` |
| B-TEST-03 | 🔴 | Estado `cuotas` (805f226) — factura Federación Patronal sale de Cash Flow/Pagos `@cashflow` |
| B-TEST-04 | 🔴 | Sueldos estado `anterior` (8b9215e+71a788c) + saldo ≤0 oculto (eabc988) `@sueldos` |
| B-TEST-05 | 🔴 | Tildes en buscadores (83052ca, 9921d26) `@general` |
| B-TEST-06 | 🔴 | Fix motor conciliación (9877cc3) — factura pasa a `conciliado` y sale de Cash Flow `@extracto` |
| B-TEST-07 | 🔴 | Insumos — unidad correcta (f6a7a61) · sólo EJECUTADAS (ddef961) · agrícola=ganadero (85924fa) · InsumoCombobox (bf75b18) `@productivo` |
| B-TEST-08 | 🔴 | Import pesadas — validación fecha única + popover ayuda (b559843) `@productivo @importar` |
| B-TEST-09 | 🔴 | Órdenes ganaderas — recría + carga manual (c4d2bab) `@productivo` |
| B-TEST-11 | 🔴 | Escenario B agrupado por `grupo_pago_id` — modal NC con subtotales, summary en rojo si no cuadra, ocultar grupos ya aplicados (commit 47ad5f1, ya en main) `@cashflow @egresos` |
| B-TEST-12 | 🔴 | Filtro "Tipo de comprobante" en Facturas ARCA — selector con SÓLO los tipos presentes (no toda la lista AFIP) `@egresos` |
| B-TEST-13 | 🔴 | Filtro "Solo NC" en Vista Pagos `@cashflow` |
| B-TEST-14 | 🔴 | Fix vinculación anticipo — no ofrece facturas en estado `anterior` (caso Nuñez Omar) `@cashflow @principal` |
| B-TEST-15 | 🔴 | Templates Caja → estado `programado` para proyecciones; cuotas de presupuesto eliminadas `@cashflow @egresos` |
| B-TEST-16 | 🔴 | Excel de jerarquía de cuentas — `scripts/generar-jerarquia-cuentas.cjs` (jerarquía por `nombre_totalizadora`, no por número) `@dashboard @presupuesto` |
| B-TEST-17 | 🔴 | InsumoCombobox — selector único en órdenes (buscador acento-insensible, no acepta texto libre, "➕ Nuevo insumo" crea en el momento) `@productivo` |
| B-TEST-18 | 🔴 | Órdenes agrícolas — muestran insumos usados y cantidades (igual que ganaderas) `@productivo` |

---

## 🅲 SECCIÓN C — DUDOSOS / A AUDITAR JUNTOS (probable que varios ya no apliquen)

| ID | Estado | Ítem | Por qué dudoso |
|----|--------|------|----------------|
| C-01 | ❓ | **Testing ítems 1-28** (extracto, dashboard, selectores, motor, sueldos, cancelación FC/NC…) — **los 28 transcriptos** en el dossier | De abr/may-2026; muchos quizá ya testeados. Absorbidos de la memoria 2026-08-02 → [C-01](#c-01) |
| C-02 | ❓ | Sistema Reglas Contable e Interno (3865ea8) | Implementado, nunca testeado, viejísimo (2025-08) |
| C-03 | ❓ | Investigar estado "auditado" en conciliación | Vago, 2025-08, puede estar resuelto |
| C-04 | ❓ | Estados dropdown en Templates (input → Select) | Mejora menor 2025-08 |
| C-05 | ❓ | DDJJ IVA mejoras finales (Total IVA, columna 21%, desglose monotributo) | De 2025-09; verificar si ya se hizo |
| C-06 | ❓ | Documentos SICORE (PDF retención, certificados, email proveedores) | Parcialmente hecho después; revisar qué falta |
| C-07 | ❓ | Llenado automático IIBB / SICORE templates | Requiere sección Ventas; estado incierto |
| C-08 | ❓ | Templates 11-61 carga masiva | Roadmap viejo; ¿sigue el plan? |
| C-09 | ❓ | Vista Presupuesto · Vistas Tarjetas/Caja · Dashboard desgloses · Export reportes | Roadmap "futuro" sin spec |
| C-10 | ❓ | Sistema Alertas Vista Principal (vencimientos) | Diseñado hace mucho, placeholder existe |
| C-11 | ❓ | Reorganización Schemas MSA/PAM | Explícitamente postergado |
| C-12 | ❓ | Cash Flow disponibilidad FCI | Depende de B-FEAT-02 |

---

## 🅳 SECCIÓN D — HISTÓRICO CLAUDE.md (probablemente obsoleto)

> `CLAUDE.md` tiene ~2000 líneas de logs 2025-2026. Casi todo cumplido/superado. Sólo lo que **podría** seguir vivo:

| ID | Estado | Ítem | Nota |
|----|--------|------|------|
| D-01 | ❓ | Sistema Backup Supabase — upload nunca funcionó | "Bloqueante producción". Hoy cubierto por A-SEC-01 (decidir backup) |
| D-02 | ❓ | Seguridad BBDD egresos — modificación sin restricciones | Superado por A-SEC-01 |
| D-03 | ❓ | Roadmap empresas — Empleado Contable · copia PAM · 3ra empresa | Objetivos 2025-08; confirmar si siguen |
| D-04 | ❓ | Carga datos históricos (como "conciliado") | Prerequisito viejo; probablemente ya resuelto |
| — | ✅ | Resto (DDJJ IVA, permisos URL, SICORE base, templates conversión, inline editing, importadores CA/MA…) | Cumplido — no migrar |

---
---

# 📚 PARTE 2 — DETALLES (dossiers por ID)

> Sólo se documentan acá los ítems con razonamiento que vale re-recorrer. Hoy: los de Sección A.

---

## <a id="a-op-06"></a>A-OP-06 — Limpieza de la raíz del repo (Claude debe explicar antes de tocar)

Hay dos grupos de archivos sueltos en la raíz. **El usuario pidió que Claude le explique qué es cada uno antes de borrar nada** (2026-06-21):

1. **~40 archivos de trabajo** (.xlsx / .csv / .pdf / .md): extractos, comprobantes, reportes, planillas, docs de reconstrucción. Son del usuario, untracked. Decidir: mover a `documentos/`, borrar los que ya no sirvan, o ignorar.
2. **Varios `tmpclaude-XXXX-cwd`**: archivos temporales generados por el harness de Claude Code (artefactos de sesiones, marcadores de working directory). **Hay que confirmar qué son exactamente y si es seguro borrarlos** antes de hacerlo — no asumir. Probablemente basura de sesiones viejas, pero verificar que ninguno esté en uso por una sesión activa.

**Al abordar:** primero listar y clasificar cada grupo, explicárselo al usuario, y recién entonces decidir destino. No borrar en bloque.

**Frontera con los [A-DOC-*](#a-doc-01) (2026-08-02):** este pendiente cubre los archivos de
**trabajo** del usuario (`.xlsx` / `.csv` / `.pdf`) y los `tmpclaude-*`. La **documentación `.md`**
(31 archivos) la cubre la auditoría de dimensiones A-DOC-01..08. Si al abordar uno se mueve algo
del otro, anotarlo en ambos.

---

## <a id="a-op-07"></a>A-OP-07 — Baseline de "errores conocidos" (ADOPTADO 2026-06-21)

**Decisión tomada:** se adopta la práctica. El log vive en **`ERRORES_CONOCIDOS.md`** (archivo aparte). Captura barata durante el desarrollo, investigación diferida. Este pendiente (A-OP-07) es el de **triagear** esos errores cuando haya entradas y tiempo. Se estrena la próxima vez que desarrollemos.

**Fenómeno.** Cada vez que Claude prueba/compila durante el desarrollo (`npm run build`, `type-check`, tests), suelen aparecer errores que NO son del cambio actual sino previos. Hoy Claude los descarta con "sin errores, todos son previos". El usuario observa (2026-06-21) que esas señales se tiran y propone documentarlas.

**El trade-off (planteado por el usuario, correcto):**
- Documentar poco → inútil (sin contexto, no se puede actuar después).
- Documentar lo suficiente para que sirva → requiere investigar → consume recursos del desarrollo actual.

**Análisis / recomendación de Claude.** La salida es separar **capturar** (barato) de **investigar** (caro):
- **Capturar = casi gratis**: cuando ya corrí el comando, la salida está delante. Pegar `archivo:línea + mensaje` con fecha cuesta ~nada.
- **Investigar = diferido**: nunca en el momento. Solo se triagea cuando (a) el mismo error se repite mucho, (b) empieza a bloquear, o (c) hay tiempo muerto.

**Argumento más fuerte a favor (el decisivo):** un baseline documentado vuelve **verificable** la frase "no rompí nada". Si aparece un error que NO está en el baseline → lo causó el cambio actual. Hoy esa afirmación es de memoria; con baseline es comprobable. Protege al usuario y disciplina a Claude.

### 🔴 2026-08-10 — dejó de ser teórico: DOS bugs de esta sesión estaban ahí, señalados

El baseline se venía usando de la peor manera posible: **comparando el total** (117 antes, 117
después) para afirmar "no rompí nada", **sin leer ninguno**. Y adentro estaban las dos causas:

| Bug | Lo que decía el compilador | Consecuencia real |
|---|---|---|
| [A-BUG-19](#a-bug-19) | `Type '"ARCA" \| "TEMPLATE" \| "ANTICIPO" \| "SUELDO" \| "VENTA"' is not assignable to type '"ARCA" \| "TEMPLATE"'` — en **4 líneas** | pagos de sueldos que la pantalla daba por guardados y **nunca se guardaban** |
| [A-BUG-22](#a-bug-22) | *(no lo marcó, porque un `as any` lo silenció)* | a las **Fac C** se les proponía SICORE: el filtro existía pero era código muerto |

**Las dos lecciones, distintas:**
1. **El baseline hay que leerlo, no contarlo.** Un total igual no dice nada: puede tener adentro el
   error que explica el bug que estás persiguiendo. Al triagear, **empezar por los del archivo que
   se está tocando**.
2. **Un `as any` es un error del baseline que ni siquiera llegó al baseline.** `A-BUG-22` no aparece
   en la lista justamente porque alguien lo silenció al escribirlo.
   → ✅ **Repaso hecho 2026-08-11**, resultado completo en `ERRORES_CONOCIDOS.md`: de los 200, **45**
   afirman que una propiedad existe y **sólo 1 era de dominio propio** (`visible_contable`, ya
   arreglada). Los otros 15 sospechosos eran APIs del navegador y librerías — uso legítimo.
   **No había un segundo A-BUG-22.** Quedan 29 `as any` cosméticos como backlog.

#### ✅ Y el mecanismo ya está hecho (2026-08-11)
`npm run type-check:diff` compara **por archivo** contra `scripts/type-errors-baseline.json` y falla
si alguno empeora; `npm run type-check:baseline` fija el piso nuevo. Con eso *"no rompí nada"* deja
de ser una afirmación de Claude y pasa a ser algo que el usuario verifica en un comando.
Probado inyectando un error a propósito: lo detectó (`3 → 4`, exit 1).
Lo que queda de A-OP-07 es el **triage** de los 113, empezando por los archivos que se tocan.

> Esto convierte a A-OP-07 de "buena práctica" en **deuda con costo medido**: dos bugs que costaron
> horas de diagnóstico estaban escritos, con archivo y línea, esperando que alguien los leyera.

**Guardrails para que no sea ruido:**
- Solo errores reales (NO warnings de formato tipo LF/CRLF).
- Dedup por firma del error: si ya está, bumpear "última vez visto" + contador; no repetir.
- Es un backlog, no una obligación de arreglar.
- Costo por captura ≈ 0 (no investigar en el momento).

**Riesgo / por qué podría NO valer la pena:** si los builds suelen estar limpios y los pocos errores son de tests flaky conocidos, el log aporta poco. Mitiga el dedup (no crece si no hay variedad).

**Lo que falta decidir (usuario):**
1. ¿Adoptamos la práctica del baseline barato?
2. ¿Dónde vive el log? Recomendación de Claude: **archivo aparte `ERRORES_CONOCIDOS.md`** (es un log corriente, distinto naturaleza a esta lista de pendientes), no una sección de `PENDIENTES.md`.
3. Si se adopta → se vuelve regla permanente (se anota en memoria como feedback).

---

## <a id="a-op-08"></a>A-OP-08 — Backup/restore Supabase confiable (A VERIFICAR — rescatado del CLAUDE histórico)

**Origen:** el `CLAUDE.md` viejo (ahora `CLAUDE_HISTORICO.md`) repetía esto como **bloqueante de máxima prioridad** en varias sesiones (2025-08 → 2025-09):
> "Sistema backup Supabase NO funciona — **nunca logramos subir un backup**. Es **prerequisito absoluto antes de usar la app con datos reales** en producción. El backup debería setear estructura + datos automáticamente. Prioridad MÁXIMA."

**Estado incierto (por eso 🔍 verificar):** en enero 2026 se hizo una **reconstrucción que SÍ funcionó** vía scripts (`RECONSTRUCCION_SUPABASE_2026-01-07.md` + `RECONSTRUCCION_EXITOSA.md`). Es posible que eso cubra el "restore", pero el **backup/restore automático probado** quizás siga sin existir. Además, los ALTERs no-backup de la sesión (columnas tarjeta, etc.) muestran que el backup original **no captura todo**.

**Qué hay que hacer:**
1. **Verificar si sigue vigente**: ¿hoy hay un mecanismo de backup confiable y un restore probado? ¿O solo el camino manual de reconstrucción por scripts?
2. Si NO hay backup/restore probado → lograrlo y testearlo (BD vacía → restore completo → verificar estructura + datos) **antes de cargar datos reales de producción**.
3. Asegurar que el proceso incluya los **cambios no-backup** documentados en `RECONSTRUCCION_SUPABASE` § CAMBIOS POST-RECONSTRUCCIÓN.

**Relación:** complementa A-SEC-01 (si `anon` puede truncar todo, un restore confiable es la red de seguridad).

---

## <a id="a-op-09"></a>A-OP-09 — Comentarios huérfanos: el ID vive en un `.md`, el comentario en la BD (2026-08-19)

`pendientes_comentarios.pendiente_id` es **texto sin FK**, y no puede ser otra cosa: apunta a un ID
que vive en `PENDIENTES.md`, no en una tabla. **Postgres no puede proteger un vínculo a un archivo.**

**El agujero:** si un pendiente se renumera o se borra del `.md`, sus comentarios quedan colgados y
**nadie se entera**. El usuario escribió algo, y ese algo desaparece de la pantalla en silencio —
exactamente el modo de falla que más caro sale en este proyecto.

## ✅ El fix de fondo YA ESTÁ (2026-08-20) — esto es la red

Se descartó migrar los pendientes a una tabla: no arregla la causa (si el PK es `A-BUG-25`, el
problema es idéntico y la FK sólo lo hace fallar fuerte) y da vuelta la frontera hacia el lado que
**nadie puede validar** — ~190 referencias entrantes desde `.md` y código, donde no hay FK posible.

En su lugar, dos reglas de costo cero, ya escritas en § *Cómo usar este archivo*:
- **🔒 El ID es inmutable** — no se renumera, no se reusa, no se borra. Y **promover B→A ya no
  renombra**: el estándar mismo obligaba a renumerar contra un espacio ocupado (`A-FEAT-01` y
  `B-FEAT-01` son ítems distintos). Corregido.
- **🪦 Al archivar queda la lápida** — el dossier se va al histórico, la fila del índice se queda.

**Lo que queda de A-OP-09 es la mitigación**: no evita el huérfano, lo hace **visible**. Vale
tenerla igual, porque el ID inmutable depende de que Claude respete una regla — y el 2026-08-19
quedó probado que eso falla.

1. `scripts/verificar-parser-pendientes.mts` consulta los `pendiente_id` distintos de las dos
   tablas y avisa si alguno **no existe** en el `.md` (ídem
   `pendientes_propuestos.pendiente_id_asignado`).
   ⚠️ **Si no puede conectarse a la BD tiene que decirlo fuerte, no pasar en verde.** Un control que
   se saltea en silencio es peor que no tenerlo: te deja creyendo que verificó.
2. El panel muestra los huérfanos en un **bloque aparte** en vez de descartarlos. Es la única capa
   que ve el usuario — si él escribió algo, no puede desaparecer de la pantalla porque su pendiente
   se archivó.

**Relación:** [P-46](#p-46) lo creó · el aprendizaje de método está en el cierre del 2026-08-19.

---

## <a id="p-lote"></a>P-LOTE — Presupuesto: los 3 conceptos de fondo (2026-08-02)

Tres cosas que el usuario pidió y que **no son features sueltas: son cambios de modelo**. Todo lo
demás de la lista `P-*` se apoya en esto.

### 1. Los modos tienen que **componerse**, no elegirse

Hoy `ModoPresupuesto` es un enum de 6 valores **excluyentes**: una cuenta tiene *un* modo. El
usuario necesita combinarlos.

> *"Algo se calcula por cabeza hoy pero además sumarle el IPC del año. Además se pone en un solo
> mes o se desglosa en el año. Está puesto como uno u otro y ahí falta configuración para poder
> sacar todo el provecho."*
>
> *"Si son 9 kg de carne por cabeza, podemos —si tenemos presupuesto del kg de carne— usarlo; si
> no, tomar lo pagado el año anterior dividido las cabezas y tenemos lo pagado por cabeza,
> aplicarle IPC y multiplicarlo por las cabezas nuevas. Lo importante es el concepto de que a
> veces no es una o la otra sino que son cosas diferentes que interactúan."*

**Lo que se desprende: un modo son 3 decisiones independientes, no una.**
| Eje | Qué responde | Opciones |
|-----|--------------|----------|
| **BASE** | de dónde sale el monto unitario | última FC · promedio N · mismo mes año anterior · **$/cabeza** · **unidad física** (kg novillo, kg carne) · manual |
| **AJUSTE** | cómo se actualiza al futuro | ninguno · **IPC** · dólar · precio de la unidad física |
| **DISTRIBUCIÓN** | cuándo cae en el año | mensual · **un solo mes** · calendario fijo (N cuotas en meses dados) · **cupo anual con arrastre** |

Hoy los 6 modos son combinaciones fijas de esos tres ejes. Separarlos es lo que habilita
[P-13](#p-lote) (IATF por cabeza), [P-14](#p-lote), [P-09](#p-lote), [P-25](#p-lote) y
[P-10/P-17](#p-lote) **con una sola pieza** en vez de cinco parches.

**El caso del $/cabeza con fallback** (segunda cita) muestra que la BASE puede tener **cascada**:
si hay precio de la unidad física, usarlo; si no, derivarlo de la historia (pagado ÷ cabezas).
Es la misma idea de `resolverTipo()` en C-27.

### 2. El presupuesto anual **no se pierde si no se gasta en el mes**

> *"Se compran 7000 lts anuales de gas oil pero 1 o 2 veces por año. ¿Qué pasa si lo pongo en
> marzo y finalmente lo compro más adelante? Si tengo conciliada la compra no pasa nada porque se
> va de saldo, pero ¿si aún no concilié? En uno de mis ejemplos, si no concilié, aún figura en el
> presupuesto, entonces estaría bien según ese formato. **Lo que no puede pasar es que por no
> hacerlo en el mes se pierda el presupuesto.**"*

El invariante a respetar: **lo presupuestado y no ejecutado se arrastra, no se evapora.** El mes
asignado es una *estimación de cuándo*, no un vencimiento. Se cierra sólo contra la **realidad**
(la conciliación), no contra el calendario.

**Solución acordada — "cupo anual con saldo", como VARIANTE, no como regla universal.** El usuario
(2026-08-02): *"me gusta pero puede que no todos los casos apliquen, entonces sería una variante"*.
Encaja como una opción del eje **DISTRIBUCIÓN** de arriba, junto a mensual / un solo mes /
calendario fijo. Cada cuenta elige la suya.

Cómo funciona: la cuenta tiene un **cupo anual** (ej. 7000 lts de gasoil) y un **mes tentativo**.
Lo ejecutado descuenta del cupo; el saldo se muestra en el mes tentativo y **se corre solo**
mientras no se ejecute; si llega el mes 12 con saldo, cae todo ahí. **Ventaja sobre el promedio
mensual:** el número que se ve es siempre *lo que falta gastar*, que es la pregunta real — el
promedio, a mitad de año, ya no representa nada porque la compra viene entera.

### 3. Los controles son **requisito de cierre**, no un extra

> *"Habrá muchos controles para sentirme seguro. Por empezar es un requisito pasar por esto para
> considerar terminado el módulo y es uno de los puntos principales."*

→ [P-32](#p-32).

---

## <a id="p-32"></a>P-32 — Batería de controles del Presupuesto (requisito de cierre)

**Lo que hay hoy:** `controlarPresupuesto()` en `lib/presupuesto/modos.ts` — control de cordura
contra los últimos 6 meses reales, con niveles `alta`/`media`.

**Lo que pidió el usuario:** que sean **muchos** y que **pasar por ellos sea condición para dar el
módulo por terminado**. Por ahora, sólo anotar ideas.

### Ideas de controles (borrador — falta que el usuario elija y agregue)

**Cordura del monto**
- Presupuestado vs. histórico del mismo mes: desvío > X% → avisar *(ya existe)*
- Presupuestado vs. promedio de los últimos 12 meses
- Cuenta que **saltó de orden de magnitud** respecto de su propia serie
- Cuenta con historia que quedó en **$0** presupuestada (¿se excluyó sin querer?)

**Cobertura — lo que falta presupuestar**
- Cuentas con movimiento en los últimos 12 meses y **sin presupuestar** en los próximos 12
- Templates cuyas **cuotas se terminan** dentro del horizonte y no tienen campaña nueva generada
  (se cruza con el Generador Renovar Campaña y con [P-23](#p-lote))
- Cuentas del plan **sin `tipo`** o con `categ` huérfana (C-26)
- Proveedor recurrente que **dejó de aparecer** (¿se perdió una FC o dejó de operar?)

**Coherencia interna**
- **Doble conteo**: el mismo concepto entrando por template *y* por cuenta contable (C-24/C-19)
- Suma de secciones = total (C-22)
- Lo `financiero` no debe estar en egresos operativos (C-27)
- Cuentas marcadas `excluida`: listar **con su motivo**, porque muchas esconden un bug ([P-33](#p-lote))

**Contra la realidad**
- Presupuestado vs. **ejecutado** del mes cerrado, por cuenta (el control que cierra el ciclo)
- Anual: *"se gastó cero el último año y seguís presupuestando $1.500.000"* — el que pidió
  explícitamente en [P-17](#p-lote)
- Presupuesto vs. **saldo bancario proyectado** (¿alcanza la plata?)

**Trazabilidad**
- Toda celda tiene que poder **explicar de dónde salió** (base, ajuste, muestra usada) —
  [P-15](#p-lote). Un control que no se puede explicar no sirve para decidir.

---

### 🔴 EL CONTROL DE CIERRE — cobertura total (pedido del usuario 2026-08-02)

> *"Recordá algún control de ver que todas las variables entren por algún lugar. Si no está
> automática, y de producción, ni de sueldos, debe estar manual. **Pero todo debe estar en algún
> lugar. Si no, advertencia.**"*

**Regla:** cada concepto presupuestable tiene que estar cubierto por **exactamente una** fuente —
proyección automática · variable de producción ([P-37](#p-37)) · sueldos · template · manual. Lo
que no está en ninguna, **avisa**. Lo que está en dos, también (doble conteo).

**Por qué es el control más importante de todos:** los tres agujeros encontrados el 2026-08-02 son
el **mismo caso**, y ninguno era difícil de ver — eran invisibles porque *nadie preguntaba por los
que faltaban*:

| Agujero | Qué pasó |
|---|---|
| **HONORARIOS AMS** ([P-03](#p-03)) | excluido de cuentas *"va por Sueldos"*, y en Sueldos vale $0 |
| **Cargas Sociales** ([P-35](#p-35)) | cuotas agotadas al cerrar la campaña 25/26 → cero desde agosto |
| **Las 4 de [P-33](#p-33)** | apagadas porque no se podían calcular bien |

En los tres, alguien dijo *"va por otro lado"* y el otro lado nunca se llenó.

**Además es prerrequisito de la regla A de [P-37](#p-37)**: esa regla apaga la proyección histórica
de las cuentas con variable. Sin este control, una variable a medias deja la cuenta en cero y
callada — se cambia un agujero por otro.

**Estado:** 🔴 requisito de cierre del módulo. No se implementa la regla A sin esto.

---

## <a id="p-16"></a>P-16 — 🐞 El modo "mismo del año pasado" nunca funcionó (✅ ARREGLADO 2026-08-02)

**Lo que reportó el usuario:** *"cuando pongo mismo de año pasado, ej. Seguridad y Alarma, me
debería saltar en enero del 27 (ene 2026 + 1 año) y no aparece"*.

**Lo que era en realidad — peor que "no salta de año":**

```ts
if (h.length < 12) return vacio(`Necesita 12 meses de historia y hay ${h.length}`)
```

`historia` sale de la vista `presupuesto_historia_cuentas`, que **agrupa facturas**: un mes sin
factura **no genera fila**. Un gasto anual tiene **1 punto por año**. Con tres años de historia
son 3 puntos, nunca 12 → el guard lo mandaba a cero **siempre**.

**El modo diseñado para lo estacional y anual rechazaba exactamente los gastos estacionales y
anuales.**

### Medido contra la BD (2026-08-02)
Las 8 cuentas que el usuario había puesto en `estacional`:

| Cuenta | Puntos | Con el bug | Arreglado |
|---|---:|---|---|
| 422118 LUZ | 12 | ✅ única que andaba | ✅ |
| 422115 SUPERMERCADOS Y CARNICERIA | 2 | ❌ cero | ✅ ago-26 y feb-27 |
| 422108 GASTOS OFICINA | 2 | ❌ cero | ✅ sep-26 y ene-27 |
| 42306 GASTOS VARIOS GANADERIA | 2 | ❌ cero | ✅ feb-27 y mar-27 |
| 422122 INFORMATICA | 1 | ❌ cero | ✅ ago-26 |
| 422114 HONORARIOS ESCRIBANIA | 1 | ❌ cero | ✅ ago-26 |
| 422134 GAS | 1 | ❌ cero | ✅ may-27 |
| **422127 SEGURIDAD Y ALARMA** | 1 (ene-26) | ❌ cero | ✅ **ene-27** ← el caso reportado |

**7 de 8 en cero.** Ahora 8 de 8.

### El fix
Se saca el mínimo global. **No se exige un mínimo de historia: se exige EL MES.** Si falta el
mismo mes del año anterior, la celda lo dice (*"Sin dato de mar-26"*), que es información y no un
cero mudo. Un gasto anual muestra 11 celdas sin dato y una con monto — que es lo correcto.

⚠️ **Primer intento fallido, anotado a propósito:** Claude cambió el guard a *lapso de historia
≥ 12 meses*. Pasaba de 1/8 a 5/8 pero **seguía dejando en cero el caso reportado** (Seguridad y
Alarma tiene 7 meses de lapso). Se detectó consultando los datos reales antes de commitear. La
lección: el mínimo global estaba mal **en cualquier forma**, no en su valor.

### Hallazgo lateral
`sugerirModo()` **nunca sugiere `estacional`** — sólo aparece si el usuario lo elige a mano. Por
eso el bug pasó desapercibido: nadie lo activaba automáticamente. Y explica por qué justo las
cuentas que el usuario configuró a mano son las que quedaron en cero.

**Type-check:** 121 errores, idéntico al baseline. 0 en `lib/presupuesto`.

---

## <a id="p-03"></a>P-03 / P-21 — Sueldos en el presupuesto: 3 empleados en $0 y sin aguinaldo

**Lo que pidió el usuario (2026-08-02):** *"yo pensaba sólo poner el monto mensual de cada uno
para el presupuesto, más allá de los datos históricos"*. Simple: un sueldo mensual por empleado
que el presupuesto use hacia adelante.

### Cómo funciona hoy
`tab-presupuesto.tsx` → `cargarSueldos()` lee **`sueldos_periodos`** (los períodos de liquidación
reales) y toma `saldo_pendiente ?? bruto_calculado`. Sólo entran empleados **MSA o "ambas"**.

Hay períodos generados hasta **jun-2027**, así que la fila no está vacía. El problema es **qué
tienen adentro**.

### 🔴 Lo que se encontró (consultado a la BD el 2026-08-02)

| Empleado | Empresa | Presupuestado/mes | Bruto real (prom · máx) |
|---|---|---:|---|
| JMS | ambas | 3.550.887 | — |
| Ruben Sigot | MSA | 1.670.000 | — |
| Wilson Barreto | MSA | 1.300.000 | — |
| **AMS** | ambas | **$0** | 1.654.418 · **2.774.530** |
| **Fabian Vulcano** | MSA | **$0** | 1.141.429 · **1.760.000** |
| **Elvio Paz** | MSA | **$0** | 677.143 · **960.000** |

Los tres tienen **7 períodos reales** hasta jul-2026 y quedan en **cero** en los 11 meses
siguientes. El bloque de sueldos muestra **$6.520.887/mes** cuando debería rondar los **$12 M**.

**Faltan del orden de $38 M (a promedio) a $60 M (a último valor) en 11 meses.** El presupuesto de
sueldos está mostrando aproximadamente **la mitad**.

### 🔴🔴 Y hay un agujero peor, que cruza con [P-33](#p-33)

`422136 HONORARIOS AMS` está **excluida** de cuentas contables con el motivo *"Va por Sueldos"*.
Pero en Sueldos, **AMS está en $0**.

→ **Los honorarios de AMS no están presupuestados en ningún lado.** La exclusión era correcta en
su lógica, pero el otro lado nunca se llenó. (JMS sí está: 3.550.887.)

Es exactamente el control de **cobertura** que pide [P-32](#p-32): *"conceptos que se excluyen de
un lado porque «van por otro» y en el otro no aparecen"*. Sin ese control, un cero se disfraza de
decisión.

### 🧊 Además: el monto está congelado y no hay aguinaldo
- Los 11 meses futuros tienen **exactamente el mismo número** — sin paritarias, sin ajuste por IPC.
- **Diciembre y junio no tienen SAC.** El aguinaldo es medio sueldo en cada uno: con ~$12 M/mes
  son ~$6 M extra en dic-2026 y otros ~$6 M en jun-2027 que hoy no están.
- Las **cargas sociales (SUSS)** tampoco se ven proyectadas junto al bruto.

### ⏸️ Propuesta — necesita decisión del usuario (toca la BD)
Que cada empleado tenga un **sueldo mensual de presupuesto**, y que el presupuesto lo use hacia
adelante en cascada (igual que `resolverTipo()` en C-27):

> **sueldo de presupuesto del empleado** → si no hay, **el período liquidado** → si no hay, cero.

**Dónde guardarlo — tres opciones:**
| | Cómo | Pros / contras |
|---|---|---|
| **A** | Columna `sueldo_presupuesto` en `sueldos_empleados` | Simple, un valor por empleado. No guarda historia del supuesto |
| **B** | Tabla nueva `presupuesto_sueldos` (empleado, monto, vigencia desde) | Permite cambiar el supuesto en el tiempo y auditar. Más piezas |
| **C** | Editar `sueldos_periodos` de los meses futuros | ⛔ **No recomendado**: son datos reales de liquidación y mezclaría presupuesto con liquidación. Además exige permiso explícito para tocar datos |

**Recomendación: A.** Es literal lo que pidió el usuario y se puede migrar a B si después hace
falta historia del supuesto.

⚠️ **Nada de esto se hizo:** es cambio de estructura de BD y se acuerda antes
(`CLAUDE.md` § Datos).

---

## <a id="p-42"></a>P-42 — Dónde se configura determina dónde se muestra (y las ventas con actividad)

### La regla, dicha por el usuario (2026-08-02)
> *"Si activé vía **cuenta contable**, debería visualizarse en el presupuesto **ahí**. Si lo activo
> vía **costo directo relacionado con alguna actividad**, deberá mostrarse de esa manera **en ese
> lugar**."*

Es la **contracara de la regla A de [P-37](#p-37)**, y juntas cierran el doble conteo:
- La regla A dice *dónde NO aparece* (si hay variable, la cuenta no se proyecta por historia).
- Ésta dice *dónde SÍ aparece*: **en el bloque desde el que se configuró**, y en uno solo.

**Caso que lo disparó (ROLLOS, 2026-08-02):** el usuario lo activó por cuenta contable, puso un
monto de prueba (**1,23**) y no encontró el renglón. **Estaba** — la grilla filtra
`.filter(f => f.celdas.some(c => c.monto > 0))` y ordena por total descendente, así que con $1
quedó **última de la lista**. No era un bug: era el número. Pero deja ver que **una cuenta con
monto simbólico es indistinguible de una que no está**.

### 🔗 Y las ventas presupuestadas deberían pedir actividad
> *"En el presupuesto tengo la posibilidad de presupuestar la venta de lo disponible. Si la
> presupuesto más adelante, creo que la app debería **preguntar si le quiero asignar una
> actividad**, y ahí yo le pongo recría y le asigno sus variables. **El tiempo lo determina la
> fecha que pongo de venta.**"*

→ Al presupuestar una venta a futuro, ofrecer asignarle **actividad** (recría, cría, engorde…). Con
eso la venta y sus costos quedan del mismo lado y el margen por actividad ([M-01](#m-01)) se arma
solo, sin una carga aparte.

### ♻️ Y sobre todo: NO volver a cargar lo que ya está en Productivo
> *"En productivo tenemos recría, historial de pesadas, actividades varias proyectadas. Algunas son
> las que estamos concretando —por ej. la venta de ahora de agosto de 55 machos—, alguna es la del
> remanente, lo que pensamos hacer. Entonces, **en el afán de no hacer el mismo trabajo, se podrían
> tomar los datos de ahí directamente**."*

El módulo productivo **ya tiene** las ventas proyectadas y las pesadas. El presupuesto debería
**leerlas**, no pedir que se recarguen. Es la regla ♻️ de `CLAUDE.md` aplicada a los datos y no
sólo al código.

**Caso concreto para probar con datos reales:** la venta de **agosto, 55 machos**.

---

## <a id="p-41"></a>P-41 — Campos, actividades y hectáreas por campaña (plan de tablas)

**Definido por el usuario 2026-08-02.** Tres conceptos que hoy están mezclados en uno solo.

### Las actividades son genéricas, no por campo
> *"En realidad las actividades son **cría, recría, engorde, arrendamiento, agricultura** (sin
> cultivos). Luego los campos —Nazarenas, Rojas, Lima— son los que determinan las has para empezar
> las actividades según las campañas."*

Corrige lo anotado antes ("Nazarenas Agrícola", "Rojas Agrícola" como actividades): eso es
**campo × actividad**, no una actividad.

### ¿Las actividades pueden vivir en `centros_costo`?
El usuario propone reusarla. **Se puede, pero hay que ordenarla:** hoy `centros_costo` mezcla
**tres cosas distintas** en una lista de 16:

| Qué es | Valores actuales |
|---|---|
| **Actividad** | Cria · Estructura |
| **Campo / lugar** | Nazarenas · Rojas · Lima · Libertad · Lote Puerto · Quinta Rosello · Cochera Posadas |
| **Bien** | Gol · Tiguan · Toyota · Voyage · Caballos |
| **Otro** | RET 1 · Otros |

**Recomendación:** agregar una columna **`tipo`** (`actividad` \| `campo` \| `bien` \| `otro`) y
sumar las actividades que faltan (recría, engorde, arrendamiento, agricultura). Es el cambio más
chico: `CentroCostoCombobox` ya está en 6 pantallas y no hay que migrar nada.
*(La alternativa —tabla `actividades` aparte— duplica un maestro que ya se usa en todos lados.)*

### Tabla nueva: `campos`
> *"Los campos con sus **partidas, has totales, netas, aptitudes, datos de dominio** sería una
> tabla nueva."*

Nazarenas (San Pedro) · Rojas · Lima (MA). Con partida inmobiliaria, has totales, has netas,
aptitud y datos de dominio.

### Tabla nueva: asignación por campaña
> *"Actividades-campaña sí, y se pondría que son **las has de tal campo, totales y netas,
> destinadas a tal centro de costo en tal campaña**."*

`campo_campana_actividad`: campo + campaña + centro de costo (actividad) + has totales + has netas.
Es lo que permite que las has se reasignen entre cría y recría de un año al otro.

### 🔍 Control pedido por el usuario
> *"Controles de que **no quede has afuera** en lo global."*

Por campo y campaña: **suma de has asignadas = has del campo**. Lo que quede sin asignar, avisa.
Va a la batería de [P-32](#p-32).

### Datos confirmados
- **Campaña a presupuestar: 26/27.**
- **Campaña histórica cerrándose: 25/26** — es la del balance de MSA, *"que debería salir también
  con los datos productivos e internos para la familia"* → se cruza con
  [A-FEAT-09](#a-feat-09) (papeles de trabajo).
- **Lima:** has productivas todavía sin definir → *"de momento todo se calcula con las totales"*.

---

## <a id="p-40"></a>P-40 — 🔴 El presupuesto se arma por RESPONSABLE, no por quién paga

**Regla dictada por el usuario (2026-08-02):**
> *"En los gastos de MSA, si por ejemplo MSA pagó pero responsable MA, **no entra en presupuesto de
> MSA**. Ni tampoco si es factura a MSA pero interno es **DIST MA**."*

O sea: **quién paga y quién es responsable son cosas distintas**, y el presupuesto sigue al
**responsable**. Un gasto que MSA adelanta por MA es un movimiento de caja de MSA, pero **no un
costo de MSA**.

### Cómo está hoy (verificado 2026-08-02)
`tab-presupuesto.tsx` filtra:
```ts
.or("responsable.ilike.%MSA%,responsable.eq.ambas")
```
Mira **sólo `responsable`** y **ignora `responsable_interno`** — que es justamente el campo donde
vive la excepción que describe el usuario.

### ⚠️ CORRECCIÓN — Claude miró el campo equivocado (2026-08-02)

Claude señaló 4 templates usando **`responsable_interno`**. **El usuario corrigió: el Voyage no
lleva.** Tenía razón — el campo que decide **no es `responsable_interno` sino `codigo_interno`**:

| Template | responsable_interno | **codigo_interno** | ¿Es distribución? |
|---|---|---|---|
| Imp Automotores **Gol 2012** | JMS | **DIST JMS** | ✅ sí |
| Imp Automotores **Tiguan 2012** | MA | **DIST MA** | ✅ sí |
| Imp Automotores **Voyage** | JMS | **No Lleva** | ❌ **no** — es gasto de MSA |
| Imp Automotores **Toyota 2015** | — | No Lleva | ❌ no |

**Cómo funciona (explicado por el usuario):** *"MSA es el titular de todos los vehículos, pero
internamente los paga el interno. Y si los paga MSA, se anota como **distribución por el código
interno**."*

### ⚠️⚠️ SEGUNDA CORRECCIÓN — tampoco es "clasificar como distribución" (usuario, 2026-08-02)

> *"No es que se deba asignar lo gastado en el Gol como distribución, sino que **la distribución se
> pone: cuánto destinado a cada uno**. El pago lo hace JMS de sus impuestos del Gol, pero si lo
> llegara a pagar MSA **se anota como a cuenta**. En el ciclo se habrá pagado exactamente lo
> adjudicado total a cada uno. De esa manera **las cuentas chicas no entran a presupuesto**, sino
> en el momento de calcular el pago de saldos de distribución a cada uno."*

**El modelo correcto:**
- El presupuesto tiene **una línea por socio**: *"Distribución JMS = $X en el ciclo"*. Ese es el
  monto adjudicado, y es lo único que se presupuesta.
- Si MSA paga el impuesto del Gol de JMS, eso es un **pago a cuenta** de esa distribución — **no
  una línea nueva** de ningún tipo.
- Al cierre del ciclo, el **saldo** de cada socio = adjudicado − lo pagado a cuenta. Eso es lo que
  se termina girando.

→ Los templates `DIST *` de gastos chicos (Gol, Tiguan, ABL, AYSA, Metrogas, Expensas…) **no van
al presupuesto ni como gasto ni como distribución**: son ejecución de un total ya presupuestado.
Sumarlos sería **contar dos veces** la misma plata — el mismo error de fondo que C-24.

Los que **sí** son línea de presupuesto son los **`Retiro X semestral/mensual`** (Jose, Mechi,
Manu, Andrés, Sole, MA): esos representan el adjudicado.

**Consecuencia:** el filtro no es sólo "por responsable". Hay que distinguir **adjudicación**
(entra) de **ejecución a cuenta** (no entra). Y es otro caso para el control de doble conteo de
[P-32](#p-32).

### 🔑 El matiz previo (que sigue valiendo para lo contable)
> *"Está bien decir que MSA no tendrá ese gasto, y sí ponerlo en MA por ejemplo en la Tiguan.
> **Pero sí existen en MSA porque contablemente se toma el gasto.**"*

→ **No es "excluir": es "clasificar como distribución".** El movimiento existe en MSA (la plata
sale de MSA), pero **no es un costo operativo de MSA**. Es exactamente lo que resuelve
`tipo = distribucion` de **C-27**, y por qué **C-22** separó la grilla en EGRESOS y DISTRIBUCIONES:
la distribución suma al total de caja pero no al costo del negocio.

### El mapa real de `codigo_interno` (activos, 2026-08-02)
| Valor | Templates | Qué son |
|---|---:|---|
| `(null)` | 66 | sin código |
| **`No Lleva`** | 28 | gasto propio |
| **`No lleva`** ⚠️ | 16 | **el mismo valor con otra grafía** |
| `DIST MA` | 7 | ABL/AYSA/Expensas/Metrogas Libertad · Tiguan · Retiro MA |
| `Desglosar` | 3 | marcados para repartir — **acá está Seguro Flota** |
| `DIST JMS` | 2 | Gol 2012 · Retiro Jose |
| `DIST MECHI` · `DIST MANU` · `DIST AMS` · `DIST SOLE` | 1 c/u | retiros semestrales |

### ✅ Bug de datos `No Lleva` vs `No lleva` — RESUELTO 2026-08-02
Afectaba a **los dos campos**, no a uno: `codigo_interno` (47 vs 35) y `codigo_contable` (52 vs
35). Cualquier filtro por igualdad exacta perdía 35 templates **en silencio**.

**Corregido con autorización explícita del usuario** (*"el bug de no lleva resuélvelo"*):
`UPDATE` normalizando a **`No Lleva`** (la grafía mayoritaria en ambos). **35 filas por campo.**
Verificado: quedan 82 en `codigo_interno` y 87 en `codigo_contable`, con **una sola grafía**.

⚠️ **Detalle técnico que casi hace fallar el fix en silencio:** los dos `UPDATE` se habían escrito
como CTEs en una sola sentencia. Postgres **no permite actualizar la misma fila dos veces en la
misma sentencia**, y eran las mismas 35 filas → el segundo reportó **0 filas** sin error. Hubo que
correrlo aparte. Si no se verificaba el resultado, quedaba la mitad del bug vivo.

**Para que no vuelva:** estos campos son de texto libre y se cargan a mano. O se normaliza en el
alta, o **todo filtro sobre ellos usa `ILIKE`/`lower()`**, nunca `=`. *(Responsabilidad de Claude
al escribir código; el usuario no tiene que cambiar cómo carga.)*

### ✅ Y el maestro para el desplegable YA EXISTE — no hay que crear nada
El usuario preguntó si convenía una lista desplegable en vez de texto libre, y agregó el criterio
correcto: *"hacer algo nuevo debe ser a conciencia, pero primero mirando que no exista ya"*.

**Existe: `public.distribucion_socios`** (8 filas), y es exactamente este maestro:

| interno | concepto | sección | empresa_destino |
|---|---|:--:|---|
| `DIST MA` | Distribución MA | 1 | **MA** |
| `DIST MANU` | Distribución Manuel (hijo) | 1 | — |
| `DIST SOLE` | Distribución Soledad | 1 | — |
| `DIST MECHI` | Distribución Mechi | 1 | — |
| `DIST AMS` | Distribución Andrés Manuel | 1 | — |
| `DIST JMS` | Distribución José Manuel | 1 | — |
| `CTA HIJOS` | Cuenta Hijos | 2 | — |
| `VER` | A verificar | 2 | — |

### ⚠️ Precisión del usuario (2026-08-02) — para qué es realmente esa tabla
> *"`distribucion_socios` son **los templates de cada socio**. Lo llenaré en los templates y así
> aparecerá. **Por ahora sólo eso para lo que es distribución.**"*

→ No es un maestro de códigos para un desplegable: es **la configuración de la sección
Distribución** (qué socio, con qué concepto, en qué sección y orden). **Los montos viven en los
templates** (`Retiro X semestral/mensual`), que el usuario carga a mano.

→ **Decisión: la distribución queda así y no se toca.** No se hace el desplegable de códigos por
ahora. Claude había propuesto usar esta tabla como origen de la lista — **descartado**: sirve a
otro propósito.

→ Lo que sí queda en pie de la exploración: `empresa_destino` (= `MA` en `DIST MA`) es el enganche
**intercompany** para cuando se aborde [P-40](#p-40).

*(La regla de contexto funcionó a medias: buscar antes de crear evitó una tabla nueva, pero
encontrar una tabla no es lo mismo que entender para qué existe. Lo aclaró el usuario.)*

### ✅ Y `Seguro Flota` ya está resuelto por el usuario
Está marcado **`Desglosar`**, junto con otros 2. O sea: el concepto de "esto hay que repartirlo"
**ya existe en los datos**; falta que el presupuesto lo interprete.

### Lo que queda por definir
- El filtro del presupuesto pasa a mirar **`codigo_interno`**, no sólo `responsable`.
- Los `DIST *` van a la **sección DISTRIBUCIONES** (no se excluyen).
- Los `Desglosar` necesitan una **regla de reparto** — hoy no hay proporción cargada en ningún lado.

### 📌 Pregunta abierta que dejó el usuario
> *"Sería bueno empezar a registrar en **las facturas** contable e interno, y no sólo en los pagos,
> ya que puede ser que algo se le facture a MSA y sea interno de MA (aunque raro). Registrarlo como
> una pregunta de si convendría ponerle a las facturas 'interno'. Si funciona para templates…"*

→ Evaluar llevar `codigo_interno` / `codigo_contable` **también a las facturas ARCA**, no sólo a
los templates. Hoy `comprobantes_arca` no los tiene.

**Estado:** ⏸️ el usuario pidió *"a registrar para afinar después"*. No se tocó nada.

---

## <a id="p-38"></a>P-38 — Export del presupuesto para presentar a los socios

**Pedido del usuario 2026-08-02.** El presupuesto tiene que poder **descargarse listo para
presentar**, no como un volcado de la grilla.

- **Varias hojas** (Excel) y **PDF**.
- **Presentable**: *"debe reunir muchas condiciones, incluso la estética"*. Es un documento que ven
  los socios, no un export técnico.
- **Reportes sintéticos con desglose por capas**: para AMS y los socios menos interesados en el
  detalle, un resumen que se pueda abrir hacia abajo sólo si se quiere.

**Piezas que ya existen y hay que reusar** (regla ♻️ de `CLAUDE.md`): los exports Excel/PDF del
análisis de engorde (resumen + hoja por segmento), el PDF declarativo de detalle de pago, y la
estructura por capas del dashboard (`tabla-resumen-financiero.tsx`), que ya define títulos y
colores por tipo.

⚠️ **Regla que aplica sí o sí:** al agregar campos al presupuesto **hay que actualizar este
export**. Es literal el feedback del usuario sobre las descargas: lo que se ve en pantalla y lo
que se descarga no se desfasan.

**Estado:** ⏸️ sin diseñar. Conviene hacerlo **después** de cerrar la estructura del presupuesto
(P-37, P-35, P-36): exportar algo que todavía cambia de forma es trabajo doble.

---

## <a id="p-39"></a>P-39 — Marcar una variable como "la dejé sin terminar a propósito"

**Idea del usuario 2026-08-02**, como complemento del control de cobertura:
> *"Si yo olvido algo ya sería un tema mío. Si dejo algo a propósito sin terminar, puede ser una
> columna de variables destinada a que, si la marco, me recuerde algo con alerta, y se mostraría
> en su renglón ya que va asignada."*

Distingue dos cosas que hoy se ven igual: **el olvido** y **la decisión de dejarlo pendiente**.

- Una marca (`pendiente_a_proposito` + nota) en la variable o la cuenta.
- La alerta aparece **en su propio renglón**, no en un listado aparte — está asignada, así que se
  muestra donde vive.
- **Complementa al control de cobertura de [P-32](#p-32):** ese avisa de lo que falta; éste
  permite decir *"ya sé, lo dejé así, recordámelo"* sin que se confunda con un agujero.

Es el mismo espíritu que `ERRORES_CONOCIDOS.md`: lo conocido y aceptado se anota para que deje de
ser ruido, y lo que aparece fuera del registro sí es señal.

---

## <a id="p-36"></a>P-36 — Bloque INVERSIONES en el presupuesto

**Pedido del usuario 2026-08-02.** Un bloque nuevo, aparte de gastos y costos: las **inversiones**
del período, listadas una por una y **cargadas a mano**.

Cada inversión lleva:
- **Nombre específico** — no una categoría: *"2 silos de autoconsumo 7 Ton c/u"*
- **Centro de costo**
- **Explicación de por qué se invierte en esa área** ← el campo que la distingue de un gasto
  común: una inversión se justifica, no sólo se registra
- **Monto** y **plazo**, a mano

**Por qué merece bloque propio:** una inversión no se proyecta desde la historia (no hay "última
factura de silos"), no se ajusta por IPC como un gasto corriente y **no debería mezclarse con el
egreso operativo** — es la misma razón por la que C-27 separó lo `financiero`.

Reusar `CentroCostoCombobox` (ya está en 6 lugares) y la convención de montos es-AR.

**Estado:** ⏸️ sin diseñar. Tabla propia, se acuerda antes.

---

## <a id="p-37"></a>P-37 — ⭐ Cómo se modelan las variables específicas (la pregunta de fondo)

**El usuario lo planteó así (2026-08-02):**
> *"Las variables del presupuesto empiezan a ser específicas. Acá es donde yo no sé cómo haremos
> esto. **No quisiera armar 100 tablas pero tampoco sé si se puede unificar.** Finalmente, para
> unos casos será pesos por kg, para otros será kg por año por cotización de tal grano. No sé bien
> cómo hacer. **Cada costo directo productivo tendrá su tipo de matemática.**"*

Es la decisión arquitectural más importante que queda abierta en Presupuesto, y condiciona a
[M-01](#m-01) (margen por actividad), a [P-LOTE](#p-lote) y a los costos productivos (C-7).

### La respuesta corta: **sí se puede unificar, y no hacen falta 100 tablas**

Porque **todas esas matemáticas distintas son la misma**:

```
monto del mes  =  CANTIDAD  ×  PRECIO
```

Lo que cambia no es la fórmula: es **de dónde sale cada uno de los dos**.

| Caso del usuario | CANTIDAD | PRECIO |
|---|---|---|
| Sanidad por cabeza | cabezas del rodeo | $/cabeza a mano + IPC |
| Maíz | toneladas | cotización del maíz |
| **IATF** ("9 kg de novillo por cabeza") | cabezas × 9 kg | cotización del novillo |
| Arrendamiento agrícola | hectáreas × kg soja/ha | cotización de la soja |
| Jornales a contratar | días por mes | valor del jornal |
| Sueldo | 1 | sueldo mensual |
| Combustible | litros al año | $/litro |

Los tres ejes de [P-LOTE](#p-lote) (BASE × AJUSTE × DISTRIBUCIÓN) son **el mismo patrón** visto
desde la cuenta contable. Acá se ve desde el costo productivo: **CANTIDAD × PRECIO ×
DISTRIBUCIÓN**.

### Forma propuesta: UNA tabla de variables, no cien

`presupuesto_variables` — una fila por concepto presupuestable:

| Campo | Qué guarda |
|---|---|
| `concepto` | nombre legible ("Sanidad vacas", "IATF") |
| `destino` | a qué cuenta contable o template alimenta |
| `actividad` | cría · recría · arrend. Rojas · Nazarenas · estructura → **engancha con [M-01](#m-01)** |
| `unidad` | cabeza · ha · ton · litro · jornal · kg novillo · mes |
| `cantidad` + `fuente_cantidad` | a mano · cabezas del rodeo · hectáreas · días |
| `precio` + `fuente_precio` | a mano · cotización (grano/novillo/dólar) · última compra · + IPC |
| `distribucion` | mensual · un solo mes · calendario fijo · cupo anual con arrastre |

Con eso, agregar un costo nuevo es **una fila**, no una tabla ni código.

### ⭐ Refinamiento del usuario (2026-08-02): el ajuste es una CADENA, con fundamento

> *"Muchas veces puedo querer definir un costo como: **gastado campaña × 30% más**. Poder dejar
> una nota de en qué fundamento mi estimación. Pero también podría ser **campaña ant. × IPC × 15%+**,
> o **año anterior × IPC × aumento de cabezas × 5%+ / 15%−**."*

Esto no rompe el modelo: lo **precisa**. Cada lado de `CANTIDAD × PRECIO` no es *una fuente*, es
**una base más una cadena de ajustes**:

```
valor = BASE  ×  ajuste₁  ×  ajuste₂  ×  …          (+ fundamento en texto)
```

| Pieza | Opciones |
|---|---|
| **BASE** | gastado de la campaña · campaña anterior · año anterior · último valor · a mano |
| **AJUSTE** (0..n, se encadenan) | **IPC** (con el escalón de N meses) · **% manual** (+30 %) · **variación de una magnitud** (cabezas, hectáreas) |
| **FUNDAMENTO** | texto libre: *por qué* se estimó así |

Los tres ejemplos del usuario salen sin código especial:
- `gastado campaña` × `+30 %`
- `campaña anterior` × `IPC` × `+15 %`
- `año anterior` × `IPC` × `Δ cabezas` × `+5 % / −15 %`

**El `fundamento` no es decorativo.** Es la aplicación directa de `CLAUDE.md` § *Motivos*: dentro
de seis meses, *"× 30 %"* sin el porqué es un número que nadie se anima a tocar ni a defender.
Y es lo que vuelve auditable el presupuesto ante el contador.

**Campaña = 1/7 → 30/6** (ya definido en [M-01](#m-01)), así que *"campaña anterior"* no es ambiguo.

### Lo honesto: dónde NO va a alcanzar
Algunos costos van a tener matemática propia de verdad (una curva de peso quebrada por tramos, un
prorrateo por superposición). Para esos, **una válvula de escape**: modo `manual` o una fórmula
puntual. La unificación sirve si cubre el 80-90%; forzar el 100% es lo que termina pariendo un
motor genérico que nadie entiende.

**La prueba de que el modelo sirve:** que las 4 exclusiones de [P-33](#p-33) entren sin
retorcerlas. Entran — materiales (cantidad a mano × precio+IPC), aguadas (a mano × IPC+%),
combustible (litros/año × $/litro, cupo anual), semillas (ha × $/ha, desde el margen).

### ✅ Decidido con el usuario (2026-08-02)
1. **La fórmula** `CANTIDAD × PRECIO` — alineados.
2. **Las fuentes de precio se mapean a tablas que YA EXISTEN**: `precios_granos` (grano, mes,
   `precio_usd`), `precios_hacienda` (categoría, `precio_pesos_kg`, rango de peso), `tipos_cambio`,
   `indices_ipc`. No hay que inventar tablas de cotizaciones.
3. **Cantidad derivada** resuelve el IATF: `cabezas × 9` con unidad *kg novillo* y precio de
   `precios_hacienda`. La proyección de rodeo ya existe (`cabezasPorMes` en `ContextoCalculo`).
4. ✅ **Regla A aprobada** — *si una cuenta tiene variable, su proyección por historia se apaga
   sola*. Evita el doble conteo por construcción y **permite borrar la lista hardcodeada
   `esProduccion()`** (hoy `421*`, `42305*`, `42312`, `42315`, `42322-24` están escritos en el
   código). ⚠️ **Va junto con el control de cobertura total de [P-32](#p-32), no antes**: la regla
   apaga la red histórica, y sin el control una variable a medias deja la cuenta en cero y en
   silencio.
5. **Prorrateo de estructura** — confirmado con el ejemplo del usuario: *"costo de estructura del
   contador = gasto anual ÷ has totales (todas las actividades juntas)"*. Cada actividad tiene sus
   hectáreas y absorbe según las suyas.
6. **Válvula de escape**: lo que no entre queda `manual`.
7. **Ajuste encadenado + fundamento** (ver arriba).

### 🧪 Los costos variables se cargan desde la app, contra INSUMOS (usuario, 2026-08-02)

> *"Sería ideal poder ir creando o configurando los costos variables desde la app, contando con la
> tabla para que se referencie lo que pongamos. Será necesario el manejo de insumos. Por ej, costos
> de la cría: yo podría poner que son **tantas dosis o ml de tales insumos por año, en tales
> meses, que valen tanto a tal fecha**. Y luego, si vemos que se está gastando tanto más con datos
> del año pasado, se puede saber cuánto más y **decirle al presupuesto que agregue tanto porcentaje
> de ese extra**."*

Dos cosas, y las dos encajan sin romper nada:

**1. La CANTIDAD puede expresarse en insumos.** `productivo.stock_insumos`,
`categorias_insumo` (con ámbito agrícola/ganadero) y `movimientos_insumos` **ya existen**. Una
variable pasa a poder decir *"3 dosis de X por cabeza, en marzo y septiembre"*, y el precio sale
del insumo a una fecha. La unidad deja de ser un texto suelto y queda **referenciada al maestro**.

**2. Un ajuste nuevo: el desvío contra la realidad.** *"Si se está gastando tanto más… que agregue
tanto porcentaje de ese extra."* Es un ajuste que compara **lo teórico contra lo realmente
consumido** el año pasado y suma un % de esa diferencia — el usuario decide cuánto.

→ Es **el mismo bucle teoría↔realidad de [M-01](#m-01)**, pero al nivel del insumo en vez del
margen. Y es lo que vuelve al presupuesto auto-corrector: si la receta dice 3 dosis y se usaron 4,
el año que viene arranca sabiéndolo en vez de repetir el error.

**Consecuencia de diseño:** el eje AJUSTE gana un tipo más → `desvio_historico`.

### 🎯 El criterio de aceptación de P-37 (lo dijo el usuario, y es la vara)

> *"Cada actividad tendrá esas variables: es por cabeza, por ton, de qué categoría o grano, en qué
> mes, precio, plazo. Encadenar etapas de la cuenta para la conformación del precio final.
> **Yo no debería necesariamente contarte cómo hacerlo, sino que esté la matriz para crearlo.**"*

**P-37 está bien resuelta si el usuario puede crear un costo nuevo solo, desde la app, sin pedirle
código a nadie.** Si para cada costo nuevo hay que escribir una función, el modelo falló — por más
elegante que sea la abstracción.

De ahí se desprenden dos requisitos que no son negociables:
- **Alta de variables en el momento**, desde la pantalla donde el usuario está pensando el costo.
- **Encadenado visible**: que la conformación del precio final se arme por pasos que se ven y se
  editan, no una fórmula escondida.

### ⛔ Bloqueantes de datos (no de desarrollo)
- Las cuatro tablas de precios tienen entre **3 y 7 filas**. El motor va a andar y a dar números
  pobres. Cargarlas es prerrequisito y es **carga del usuario**, no desarrollo.
- **Las hectáreas por actividad no están en el sistema** — hoy viven en el Excel (cría: 175 has).
  Sin ese dato el prorrateo del punto 5 no se puede calcular.
- ✅ **Lista de actividades y hectáreas: RESUELTO** (2026-08-02) → ver [M-01](#m-01).

### ✅ Resueltas por el usuario (2026-08-02)

1. **Engorde NO lleva estructura — y es a propósito, no un olvido.**
   > *"Engorde es el único sin estructura, y es así porque hacerlo o no hacerlo es eventual. Si se
   > hace es porque suma un margen bruto que es margen total, ya que es sin estructura. El sueldo
   > es el mismo. Pero hacer la actividad tendría aparejado más arreglos ese año, más jornales
   > eventuales, más gasoil por ejemplo. Eso sí se contempla para que esa actividad pueda ser bien
   > medida."*

   Es **lógica de costo marginal**, y es más correcta que prorratear: la pregunta que responde
   Engorde no es *"cuánto gana"* sino **"¿conviene hacerlo este año?"**. Si se le cargara
   estructura que se paga igual, la respuesta saldría mal.
   → Engorde carga **sólo sus costos incrementales**: arreglos extra, jornales eventuales, gasoil
   de más. **No** lleva sueldos (son los mismos) ni estructura.
   → **Descartada** la "segunda base de prorrateo" que había propuesto Claude. No hace falta.

2. **Las hectáreas van por campaña** — confirmado: *"sí, las campañas tienen sus has adjudicadas"*.

3. **Las actividades NO cruzan empresas.** El usuario aclara que las mezcló al hablar porque
   *"funcionamos como un grupo"*, pero cada actividad es de una empresa:
   - **PAM** (y **MA** en menos de un año) son **propietarios** de las has de cría.
   - La **actividad** de cría la hace **MSA**, que paga un **arrendamiento** — **no** los impuestos
     de esa tierra.
   - Los **impuestos de la tierra** los paga PAM (luego MA), junto con sus otros costos de
     estructura.
   - **Habrá un presupuesto para MA y otro para PAM**, además del de MSA.
   - **Consolidar**: *"veremos si es posible y aporta, pero hoy es más importante poder registrar
     bien cada cosa con su responsable"*. → ver [P-40](#p-40).

### ✅ Cerrada — últimas dos respuestas del usuario (2026-08-02)

8. **El `5%+ / 15%−` era una sola cosa:** *"te quise decir que puedo querer poner cualquiera de
   las dos"*. O sea: el ajuste **`% manual` admite signo** (+30 %, −15 %). No hay rangos ni
   escenarios escondidos acá. Ya estaba contemplado.
9. **Escenarios: SÍ, pero después.** *"Sería muy interesante poder tener el presupuesto y, al
   terminarlo, hacer la opción B donde modifico precios u otra cosa y regenera el mismo. Como algo
   lindo para dejar abierto a que pueda suceder."*
   → **No se construye ahora, pero se deja posible.** La decisión barata que lo habilita: que la
   configuración del presupuesto (variables, modos, precios) se guarde **con una clave de
   escenario** desde el arranque, aunque hoy exista uno solo (`base`). Duplicar un escenario pasa
   a ser copiar filas; sin esa clave, agregarlo después obliga a migrar todo.
   *(Hay precedente en el proyecto: el análisis de engorde ya tiene "escenario B" y sensibilidad.)*

**Estado:** ✅ **CERRADA en lo conceptual.** Lo que falta no es diseño: son **datos** (abajo) y la
implementación, que va junto con el control de cobertura de [P-32](#p-32).

---

## <a id="p-34"></a>P-34 — Notas para Claude desde la app (idea del usuario, 2026-08-02)

**La idea:** un botón 📝 en toda la app para dejarle notas a Claude **en el momento y en el
contexto** en que se le ocurren al usuario. *"Pago sueldos y tengo la idea de automatizar ciertos
cálculos para la próxima; te lo dejo anotado."*

**Lo que la vuelve valiosa no es la nota: es el contexto que se captura gratis.** Hoy el usuario
dicta listas de memoria (los 33 de `P-*` salieron de WhatsApp) y llegan sin el momento en que se
le ocurrieron. Tres semanas después, *"ajuste de 2 meses en un solo"* no se entiende solo.

### Una nota es una GRABACIÓN, no un evento (refinamiento del usuario)
> *"Puede haber alguna nota que precise más de una captura. Ej: un proceso sale mal, lo reseteo y
> empiezo de nuevo, marco nota, digo lo que voy a hacer, lo hago, 2da captura con el resultado. Y
> podría haber más capturas si fuera un proceso de varios clicks. La app no sabe cuántas capturas
> serán: yo le doy finalizar cuando termine."*

Eso la convierte en un **caso reproducible** en vez de un comentario suelto: pasos numerados, cada
uno con su pantalla y su registro real. Es la diferencia entre *"no anda"* y un bug con receta.

### Qué captura la app sola (el "código específico" que pidió el usuario)
En cada captura, sin que el usuario escriba nada: módulo y pantalla · **archivo y componente**
(`components/tab-sueldos.tsx`) · el **registro abierto** (empleado, período, factura) · filtros y
estado de la vista · timestamp. El usuario escribe **sólo la idea**.

### Forma
- **Cabecera** `notas_para_claude`: título, estado, inicio, fin.
- **Detalle** `notas_capturas`: orden, texto, módulo, pantalla, componente, registro, filtros, ts.
- **UI**: 📝 arranca la grabación → barra flotante *"Grabando · 2 capturas · [+ Capturar]
  [Finalizar]"*.
- Sin screenshots por ahora: texto + contexto alcanza y no pesa.

### 🔒 La regla que evita que se vuelva un tacho (crítica)
**Una nota NO es un pendiente: es una bandeja de entrada.** Al leerla, cada nota **termina como
ítem con ID en `PENDIENTES.md` o descartada con motivo**, y se marca. Si no, en dos meses hay 80
notas que nadie mira y volvimos al problema que resolvimos con [A-DOC-08](#a-doc-08): información
viva fuera de la fuente única.

Y **al abrir sesión, si hay notas sin leer, las menciona Claude** — no depende de que el usuario
se acuerde de pedirlo.

### ✅ HECHO 2026-08-11 — falta testear

**Disparador**: el usuario contó que le aparecen **muchas alertas de error en la mecánica diaria**
y no sabe si son bugs. Medido: hay **252 `toast.error` + 188 `alert()`** en la app y **cero captura
global** — o sea, 440 lugares que le pueden poner un cartel en la cara y ningún registro de cuáles
se disparan. Esta pantalla es el instrumento para caracterizarlos.

#### 🔄 Cambio respecto del diseño original
El dossier decía *"sin screenshots por ahora"*. **El usuario los pidió**, y tenía un motivo que el
diseño original no había visto: los carteles que más interrumpen son `alert()` **nativos del
navegador**, y **ninguna librería de captura de DOM puede fotografiarlos**.

Por eso la captura **se pega del portapapeles** (`Win+Shift+S` → `Ctrl+V`) en vez de renderizarse:
agarra exactamente lo que el usuario vio, incluidos los carteles nativos. Y de paso evita sumar
`html2canvas` como dependencia.

#### Dónde se guarda, y por qué no en Storage
**Ya corrido.** Dos tablas, como estaba previsto. El DDL vive en
`RECONSTRUCCION_SUPABASE_2026-01-07.md` § CAMBIOS POST-RECONSTRUCCIÓN — **no en un `.sql` suelto**,
porque `*.sql` está en `.gitignore` y esos archivos no llegan al repo.

La imagen va **comprimida dentro de la fila**, no en Supabase Storage: el proyecto **no usa Storage
ni tiene buckets**, y montarlo implicaría bucket + políticas + un patrón de acceso nuevo para un
volumen bajo. Se redimensiona a 1400 px y JPEG 0.72 en el navegador → ~80-250 KB. Si algún día
crece, migrar es directo porque la columna tiene el origen. **Es una decisión reversible tomada para
no arrastrar infraestructura que hoy no hace falta.**

#### Cómo quedó
- Botón 📝 fijo abajo a la derecha, en toda la app (montado en `dashboard.tsx`, fuera de las
  pestañas: **la nota sigue grabando aunque cambies de pestaña**, que es lo que la hace una
  grabación y no un evento).
- Al capturar: texto + captura pegada + **contexto automático** (pantalla activa, modal abierto,
  ruta, título). El contexto **se congela antes de abrir el modal** — si no, el modal se
  fotografiaría a sí mismo como "el modal abierto" y se perdería dónde estaba el usuario.
- Barra *«Grabando · N capturas · [Capturar] [Finalizar]»*.
- **Click derecho en el botón**: lista de notas con su estado (`sin leer` / `leida`) y, si ya se
  triageó, el ID de `PENDIENTES.md` en que terminó.

#### 🔒 La regla sigue en pie y está escrita en la propia pantalla
Una nota **no es un pendiente**: es bandeja de entrada. Al leerla termina como ítem con ID o
descartada con motivo, y se marca `leida`. El campo `resultado` guarda cuál fue.

**Falta testear** → `MANUAL-USO.md` § Notas para Claude.

---

## <a id="p-35"></a>P-35 — Modelo de sueldos para presupuesto (dictado por el usuario 2026-08-02)

**Premisa que ordena todo:** *"el presupuesto siempre representará la plantilla completa"*. No se
ajusta por altas y bajas — por eso las cargas sociales **no** pueden ser un % del bruto real, que
sube y baja con la dotación.

### Lo que el usuario carga y lo que el sistema calcula

| Carga el usuario | El sistema calcula |
|---|---|
| **Sueldo total mensual** (A+B) por empleado | el sueldo de cada mes |
| — | **Aguinaldo = 50% del sueldo**, en **jun y dic** *(corregido: es sobre A+B, no sobre %A)* |
| **Francos promedio** (días/mes) | los francos **aparte**, no dentro del sueldo |
| **Sueldo anual extra**: mes + múltiplo del sueldo (ej. `× 2`) | ese pago en el mes indicado |
| **Jornales extra a contratar**: en qué meses, monto del jornal, días por mes | el costo de esos jornales |
| **Horas promedio/mes + valor hora** (caso Andrés) | sueldo por hora × horas |
| **Cargas sociales del 1er mes** (a mano, o tomando un mes de referencia) | los meses siguientes |

### Las dos reglas de evolución
1. **Sueldos**: se actualizan **por IPC cada 3 o 4 meses** (en escalones, no todos los meses).
2. **Cargas sociales / SUSS**: *"guarda la misma relación"* — sube con **el mismo aumento que los
   sueldos**, y lleva **+50% en enero y julio**, que es **un mes después del aguinaldo** (jun→jul,
   dic→ene).

### ✅ Verificado en los datos (2026-08-02)
El salto de SUSS existe y se ve: template `Cargas Sociales`, **jul-26 = $2.495.548** contra
**jun-26 = $1.763.175** → **+41,5%**. La regla del usuario (+50%) es correcta, apenas más gruesa
que la realidad.

### 🔴 Y el agujero que apareció buscando esto
El template `Cargas Sociales` (campaña **25/26**, cerrada el 30/06) tiene **6 cuotas en $0 y sin
fecha**: está presupuestado en **cero de agosto en adelante**.

Sumado a los 3 empleados en $0 de [P-03](#p-03), **el bloque laboral del presupuesto está corto
entre $60 M y $85 M**. Es el mismo patrón de [P-23](#p-lote) y justifica el control de cobertura
de [P-32](#p-32): *un template cuyas cuotas se agotan dentro del horizonte tiene que gritar, no
quedarse en cero*.

### Lo que ya existe y hay que reusar
`calcularBruto()` en `tab-sueldos.tsx` (4 tipos: `ab_francos`, `por_dia`, `por_hora_ipc`,
`plano_ipc`) · `valor_franco = (A+B)/25` · `francos_dias_promedio`, `dias_promedio` y
`horas_promedio` ya están en `sueldos_empleados` · `sueldo_presupuesto` y `premio_presupuesto`
agregadas el 2026-08-02.

### ✅ Respondido por el usuario (2026-08-02) — el modelo queda cerrado

1. **El agujero se salda solo:** *"yo pongo cuánto de SUSS y de sueldos presupuestar y listo. Doy
   el punto de arranque."* No hay que derivar nada de la historia: el usuario carga el punto de
   partida y el sistema lo evoluciona.
2. **El "extra anual" ES el premio anual.** El usuario elige **en qué mes se paga** y carga el
   **múltiplo** (que es lo variable); se multiplica por **el sueldo de ese mes**.
   ⚠️ **A reconciliar:** la columna `premio_presupuesto` que se agregó el 2026-08-02 se pensó como
   premio *mensual*. Con esta definición sobra: hay que reemplazarla por **`premio_mes` (int)** +
   **`premio_multiplo` (numeric)**. *"Esto sería muy común ahora."*
3. **Francos:** a cada empleado se le asignan **tantos días por mes** (ya existe
   `francos_dias_promedio`).
4. **Jornales a contratar:** por ejemplo un **reemplazo por vacaciones** — se cargan *tantos
   meses, tantos días, a tal precio*. **Default sugerido: el valor de jornal de Elvio.** Y a
   Elvio mismo se le puede poner *tantos días por mes a tanto valor por día*.
5. **IPC:** el usuario define **cada cuántos meses se actualiza** y aplica a **toda la plantilla**
   (2, 3, 4, 5…). *"A más IPC, más cortos los períodos: es gestión real que cambia de año a año."*
   → el escalón es **configurable**, no una constante.
6. **Cargas sociales:** el monto base **lo pone a mano**, con la opción de **tomar un mes de
   referencia**.

**Nota de diseño:** los jornales a contratar **no son un empleado** — son mano de obra eventual.
Encajan naturalmente como una fila de [P-37](#p-37) (`unidad = jornal`, cantidad = días/mes,
precio = valor del jornal), en vez de forzarlos dentro de la plantilla.

---

## <a id="p-33"></a>P-33 — Las exclusiones son features faltantes disfrazadas (auditoría 2026-08-02)

El usuario avisó: *"mirá las razones por las que puse muchos 'no presupuestar' para más data a
corregir"*. Tenía razón. De las **9 cuentas excluidas**, sólo 4 lo están por diseño.

### ✅ Exclusiones legítimas — el gasto entra por otro lado (4)
| Cuenta | Motivo del usuario |
|---|---|
| 422113 SEGUROS ESTRUCTURA | "Va x Template" |
| 422136 HONORARIOS AMS | "Va por Sueldos" |
| 422137 HONORARIOS JMS | "Va vía Sueldos" |
| 4230501 MAIZ | "ya entra como ración en Actividades y costos" *(la sugirió `esProduccion()`)* |

> 💡 **Sobre SEGUROS ESTRUCTURA:** el comentario de `netearExcluidos()` dice justamente que
> conviene **excluir el CUIT y no la cuenta entera**, para que si mañana entra otra aseguradora se
> presupueste sola en vez de desaparecer sin que nadie se entere. Acá está excluida la cuenta
> entera. Candidata a migrar a exclusión por proveedor.

### ⚠️ Exclusión por baja del gasto, no por diseño (1)
| Cuenta | Motivo |
|---|---|
| 422102 ARRENDAMIENTOS AGRICOLAS Compra | "No hay más" |

No es que entre por otro lado: **es que ya no va a pasar**. Merece semántica propia (*dado de
baja*) para que, si el gasto reaparece, **salte un aviso** en vez de quedar mudo para siempre.

### 🔴 Las 4 que son features faltantes (el hallazgo)
| Cuenta | Lo que escribió el usuario | Lo que en realidad pide |
|---|---|---|
| **42310** MATERIALES GANADERIA | *"poner eq por mes pero a tal % sobre IPC el año pasado"* | eje **AJUSTE**: IPC **+ un % extra**. Hoy el IPC es todo o nada |
| **42325** AGUADAS | *"a mano pero poder elegir dónde poner… a mano puede ser con cálculos. Yo pondría por ej IPC + 30% más para el año tal, porque ya sé que el egreso será tanto más por la magnitud del trabajo"* | **AJUSTE** (IPC + %) **+ DISTRIBUCIÓN** (elegir el mes) = P-09 + fórmula |
| **42501** COMBUST. Y LUB. MAQ. Y HERRAM. | *"Precisa adjudicar compras grandes y pocas"* | **cupo anual con arrastre** — es el caso del gasoil de P-10/P-17, dicho antes de que lo habláramos |
| **42321** SEMILLAS GANADERIA | *"por costos directos"* | tiene que venir del **módulo Margen** ([M-01](#m-01)) |

**Las 4 caen exactamente en los tres ejes de [P-LOTE](#p-lote)** (BASE × AJUSTE × DISTRIBUCIÓN) y
en M-01. No son casos sueltos: son **la misma pieza faltante, vista cuatro veces**.

**Consecuencia hoy:** el presupuesto está **subestimado** en esas 4 cuentas — valen $0 no porque
no se vaya a gastar, sino porque no se podían calcular bien y se apagaron.

**Al implementar los ejes:** revisar estas 4 primero, son los casos de prueba escritos por el
propio usuario.

---

## <a id="m-01"></a>M-01 — Módulo Margen por actividad (Cría, Recría, Arrendamientos)

**Pedido del usuario 2026-08-02.** Sale del norte: *"resultado por actividad, período por período,
más la proyección"* ([A-FEAT-12](#a-feat-12)). Actividades por ahora: **Arrendamiento Rojas**,
**Arrendamiento Nazarenas** (agrícolas), **Cría** y **Recría**.

**Fuente del modelo:** `exports_app/MARGENES - Situacion Actual.xlsx`, pestaña **MARGEN CRIA**
(la única a mirar por ahora; el libro tiene 15 pestañas, el resto es contexto).

### Lo que hace hoy el Excel (leído 2026-08-02)
Margen bruto ganadero clásico, **en U$S/ha, sin IVA**, sobre 175 has, TC $1450. Cinco bloques:

1. **Parámetros de producción** → carga (1,37 vacas/ha), receptividad, **% destete 85%**,
   % reposición vaquillonas 23%, % refugo vacas 20%, toros en servicio 5%, toros refugo 1%.
   De ahí salen las **cabezas**: 240 vacas, 204 terneros, 55 vaquillonas, 48 refugo, 12 toros.
2. **Planteo técnico** → % campo natural 91%, % pasturas 9%, % promoción verdeos 65%,
   tons de silo, rollos/vaca → **hectáreas por recurso forrajero**.
3. **Precios** (U$S/kg) → ternero/ternera 3,79 · vaca 2,07 · toro venta 2,07 · toro compra 1400 U$S/cab.
4. **Cotizaciones de insumos y servicios** → sueldos, sanidad vacas/terneros/toros, **IATF**,
   implantación y mantenimiento de pasturas, promoción rye grass, verdeos, silo, rollos,
   **% gastos de venta** (3% hacienda liviana / 9% vacas y toros) y **% gastos de compra** (6%).
5. **Análisis económico**:
   - `INGRESO NETO` = ventas (terneros + vacas + toros) − gastos de venta − compra de toros
   - `TOTAL GASTOS DIRECTOS` = sueldos · recompra reposición · sanidad · renovación y
     mantenimiento de pasturas · promoción y mantenimiento de verdeos · silo · rollos · gas oil
   - `TOTAL MANTENIMIENTO/MEJORAS/VARIOS` = aguadas · automotores · combustible · instalaciones ·
     arreglo de maquinarias · materiales · seguros · varios
   - **`MARGEN BRUTO` = ingreso neto − directos − mantenimiento** (382,88 U$S/ha en el caso base)
   - Y al final lo compara contra el **alquiler** → *ganancia sobre alquiler* (el costo de
     oportunidad de no arrendar el campo).

### Para qué lo quiere el usuario
- Tenerlo en la app para **campañas pasadas con datos reales** y **presupuestado** para la
  campaña actual y la siguiente.
- **Conexión con Presupuesto (lo que motiva todo):** *"la cría tiene una serie de costos directos
  que son los que menos medidos tengo"*. La idea es **poner la teoría** (este modelo), después
  **colectar factura a factura** los costos reales, **comparar teoría contra realidad**, y que
  **desde Margen se llenen los costos directos del Presupuesto**.

### 🗺️ Las actividades y sus hectáreas (datos del usuario, 2026-08-02)

⚠️ **Área productiva ≠ área total.** El prorrateo usa la productiva; el área total sirve para otra
cosa (ej. Rojas: 242 productivas sobre 245 totales).

| Actividad | Campo / empresa | Has productivas | Has totales |
|---|---|---:|---:|
| **Nazarenas Ganadero de Cría** | San Pedro · MSA | **175** | — |
| **Nazarenas Ganadero de Recría** | San Pedro · MSA | **60** ⚠️ *a corregir* | — |
| **Nazarenas Agrícola** | San Pedro · MSA | **150** | — |
| **Rojas Agrícola** | Rojas · MSA | **242** | 245 |
| **Engorde** | MSA — **corrales** | **0 (sin has)** | — |
| **Lima** | MA | *a definir* | 86 |

- *"Nazarenas"* y *"San Pedro"* son lo mismo: San Pedro es el campo, Nazarenas el nombre.
- **Engorde no tiene hectáreas** (son corrales) **pero sí tiene costos asignados**.

### 🔄 Las hectáreas se reasignan entre campañas
> *"Una campaña se puede adjudicar has a recría y la campaña siguiente asignaremos menos a recría,
> pasando las has a cría."*

→ Las hectáreas **no son un atributo fijo de la actividad**: son una asignación **por campaña**
(1/7 → 30/6). El modelo tiene que guardarlas con la campaña, no como un número suelto.

### 🏢 Arrendamientos internos entre las empresas
- **MSA le alquila a PAM** el campo donde está la cría — *"y luego será a MA (cambio de
  titularidad)"*.
- **MSA tiene un arrendamiento anual a pagar a MA.**

→ Son **intercompany**: el mismo contrato es **egreso de MSA** e **ingreso de PAM/MA**. Es también
el número contra el que el Excel compara el margen (*"ganancia sobre alquiler"*): el costo de
oportunidad de no arrendar el campo.

### Respuestas del usuario (2026-08-02)
1. **Unidad de campaña: la campaña contable es siempre 1/7 → 30/6**, y **agrupa todas las
   actividades**. (Coincide con el período "bianual jul-jun" del Generador Renovar Campaña.)
2. **Imputación de la factura a la actividad** — ideas, sin cerrar: que **las cuentas contables o
   los templates tengan su actividad**; que ciertas haya que **desglosar** entre actividades; y
   que ciertas sean **estructura** y se repartan **por hectárea** entre todas.
3. **Quién manda cuando teoría y realidad difieren** — a definir.

**Ritmo acordado:** el diseño del módulo **espera** a que se terminen las mejoras fáciles y claras
del Presupuesto (`P-*` marcadas 🟢).

### Estado
🟡 **Sin diseñar todavía.** El usuario aprobó que sea un módulo propio → `MODULO_MARGEN.md`
(dimensión MÓDULOS) cuando se arranque el diseño.

**Piezas que ya existen y hay que reusar, no rehacer:** `centros_costo` (tabla maestra +
`CentroCostoCombobox` en 6 lugares) · el módulo productivo (rodeos, pesadas, órdenes, stock de
insumos) · el motor de ración `calcular()` en `analisis-productivo.tsx` · las cuentas de
producción que `esProduccion()` ya excluye del presupuesto por entrar "por Actividades y costos".

---

## 🏁 A-FEAT-09..12 — El resultado final del sistema (norte, 2026-08-02)

**Contexto común.** Salen de la ampliación del norte que hizo el usuario el 2026-08-02
(§ [A-DOC-07](#a-doc-07)). No son tareas: son **los cuatro resultados que el sistema tiene que
poder dar**. Sirven como vara — ante cualquier desarrollo, preguntarse a cuál de los cuatro sirve.

**Cómo se abordan (criterio del usuario):** *"esto conlleva bastante tiempo y se irá trabajando a
medida que se dan los eventos"*. El orden lo marcan los **vencimientos y cierres**, no un roadmap.
Cuando se acerca un evento, lo que ese evento necesita pasa a ser el foco.

---

## <a id="a-feat-09"></a>A-FEAT-09 — Papeles de trabajo del balance = export del sistema ⏳ FECHA DURA

**Qué:** que los papeles de trabajo que hoy se arman a mano para el contador salgan como **export
del sistema**.

**Ejercicio 25/26:**
| Hito | Fecha |
|------|-------|
| Corte del ejercicio | 30/06/2026 (ya pasó) |
| Entrega al contador | **01/10/2026** |
| Presentación a ARCA | **01/11/2026** |

**Lo que dijo el usuario (2026-08-02):** *"la idea es que papeles de trabajo sea un export de
sistema. Veremos si llegamos a eso para el 1/10."*

### 🔨 Cómo se va a hacer — decidido por el usuario 2026-08-02

**No se define todo antes: se construye haciéndolo.** El usuario va a **armar el balance desde la
app** y, a medida que lo hace, se desarrolla y configura el export. El formato queda asentado y
**para el balance siguiente ya está hecho**.

> *"por eso se hace a medida que lo hago. Cuando lleguemos a preparar el balance yo intentaré
> hacerlo desde app desarrollando el export de papeles de trabajo. A medida que lo hago lo
> configuramos y va quedando el formato para que el próximo balance ya esté hecho."*

**Lo que aporta cada uno cuando arranque:**
- **Usuario** → la **lista de papeles de trabajo**, qué debe tener cada uno, formato.
  (No hace falta pedírsela antes: la trae al empezar.)
- **Claude** → el export, incremental, papel por papel, a medida que aparecen.

**Riesgo que queda vivo (menor, pero real):** el trabajo del balance y el desarrollo van **en
paralelo y contra reloj**. Si un papel se traba, la prioridad es **el balance**, no el export —
se arma ese a mano y el export queda para el año que viene. Eso no es un fracaso: es el diseño
incremental funcionando.

**Piezas que ya existen y probablemente sirvan:** subdiarios, libro IVA compras/ventas, plan de
cuentas, jerarquía de cuentas, `Libro Diario 24-25.xlsx`.

**Dependencia:** ¿alcanza con exportar, o hay que ajustar antes el plan de cuentas
([C-24](#c-24))? El usuario: *"volveremos a eso pronto"*.

**Relación con el norte:** es el primer evento concreto donde el sistema tiene que **reemplazar
trabajo manual**, no sólo informar.

---

## <a id="a-feat-10"></a>A-FEAT-10 — Resultado del período contable y del período en curso

**Qué:** que el sistema dé (a) el **resultado del período contable cerrado** (ganancia) y (b) el
**resultado del período en curso** = **lo registrado a la fecha + el presupuesto** de lo que falta
para completar el período.

**Por qué es del norte:** es la unión más directa entre contabilidad y presupuesto — el presupuesto
deja de ser una proyección aparte y pasa a **completar** el resultado real. Es la razón por la que
"todo alimenta al presupuesto" tiene que ser cierto: si un módulo no alimenta, el resultado en
curso queda mal.

**A definir:** qué se toma como "registrado a la fecha" (¿devengado? ¿percibido?), y cómo se evita
el **doble conteo** entre lo ya registrado y lo presupuestado para el mismo concepto — el mismo
problema que ya aparece en [C-24](#c-24) (templates ↔ cuentas contables).

---

## <a id="a-feat-11"></a>A-FEAT-11 — Presupuesto a 2 años constante

**Qué:** que el presupuesto sea **siempre de 2 años hacia adelante** (ventana móvil), no un
ejercicio que se arma una vez al año y se consume.

**A definir:** cada cuánto rueda la ventana (¿mensual?), qué pasa con lo ya afinado a mano cuando
rueda (**no se pisa** — ver § Datos de `CLAUDE.md`), y cómo se renueva lo recurrente. Se cruza con
el **Generador Renovar Campaña**, que ya existe y hace algo parecido para templates.

---

## <a id="a-feat-12"></a>A-FEAT-12 — Resultado por actividad, período por período, + proyección

**Qué:** resultado **por actividad** (ganadería, agricultura, arrendamientos…), período a período,
con su **proyección**.

**Estado:** hay bastante base — centros de costo, el módulo productivo, y el análisis de costos por
actividad (FASE C, [[project_costos_productivos_plan]]). Falta la vista de resultado por actividad
que cruce eso con la contabilidad y la proyección.

**A definir:** la lista canónica de actividades y cómo se imputa lo que sirve a más de una
(estructura, administración) — si se prorratea o queda aparte.

---

## <a id="a-doc-09"></a>A-DOC-09 — `MODULO_ARCA.md` está documentado por la mitad

`MODULO_ARCA.md` (creado 2026-08-02) cubre **la puerta de entrada**: el subproyecto `arca-api/`,
qué se logró (descarga de comprobantes emitidos y recibidos con login automatizado a ARCA), qué no
(fases SIRE y Portal IVA) y la investigación previa.

**Falta todo el lado de la app**, que hoy no está en ninguna dimensión:
- `app/api/arca` · `app/api/arca-asignar` · `app/api/import-facturas-arca`
- `lib/arca`
- `components/vista-facturas-arca.tsx` · `components/vista-asignacion-arca.tsx`
- Reglas de importación por CUIT (`modal-reglas-import.tsx`)
- Relación con `app/api/gas` (búsqueda automática de PDFs de facturas)

**Por qué importa:** es el módulo por donde entra la información oficial. Si ARCA alimenta
incompleto, el resultado del período en curso ([A-FEAT-10](#a-feat-10)) sale mal — y el norte dice
que todo alimenta al presupuesto.

**Además, sin verificar:** el código de `arca-api/` no corre desde el **19/09/2025**. Los
selectores de un sitio ajeno se rompen sin aviso. Antes de confiar en la descarga automática,
correr `arca-api/scripts/test-login.js`.

---

## 📚 A-DOC — Auditoría de dimensiones de documentación (2026-08-02)

**Contexto común a todos los A-DOC.** El usuario trajo el `CLAUDE.md` de otro proyecto suyo
("Remates Televisados") para comparar reglas y destilar una base portable. De ahí salieron dos
cosas: **`CLAUDE_BASE.md`** (plantilla de 12 secciones, sin nada de dominio, para arrancar
cualquier proyecto) y esta auditoría de los **31 `.md`** del repo.

**La regla que fijó el usuario (2026-08-02):**
> La **cantidad** de dimensiones la define cada proyecto (pueden ser 4 o 9). Lo que **no** varía
> es que la lista sea **cerrada y exhaustiva**: cada dimensión con archivo exacto y criterio de
> qué entra. **Nada de "etc."**. Si algo no cae en ninguna dimensión: o cae y no lo vimos, o se
> **crea la dimensión y se anota en `CLAUDE.md` en ese momento**. Un `.md` en la raíz que no es
> dimensión declarada es un error a corregir, no una excepción.

**Frontera con [A-OP-06](#a-op-06):** A-OP-06 = archivos de **trabajo** del usuario en la raíz
(`.xlsx` / `.csv` / `.pdf`) + `tmpclaude-*`. Los **A-DOC** = sólo la **documentación `.md`**.
No se pisan; si uno mueve algo del otro, anotarlo en los dos.

**Lo que NO se hizo (a propósito):** no se borró, movió ni renombró ningún archivo. Todo espera
decisión del usuario.

---

## <a id="a-doc-01"></a>A-DOC-01 — Lista de dimensiones cerrada (✅ DECIDIDO 2026-08-02)

> **RESUELTO.** El usuario aprobó las 8 dimensiones y agregó una condición propia:
> **crear una dimensión nueva requiere su autorización explícita** — Claude propone, el usuario
> autoriza; sin autorización no se crea el archivo. También decidió que **`README.md` se conserva**
> (excepción declarada, cara pública del repo) y que **`CLAUDE_BASE.md` lo saca él** del proyecto,
> por haber cumplido su función de plantilla.
> **Aplicado a `CLAUDE.md`** § Documentación (tabla de 8 + fronteras + regla de cierre) el mismo día.
> Lo que sigue abajo es el análisis que llevó a la decisión.

**Fenómeno.** La regla de `CLAUDE.md` § Documentación termina en *"`DISEÑO_*.md`,
`CONCILIACION-CONTABILIDAD.md`, `VINCULACION-ANTICIPOS.md`, **etc.**"*. Ese "etc." es la puerta
por la que entraron 8 archivos que no pertenecen a ninguna dimensión declarada.

**Estado real (verificado 2026-08-02):** 31 `.md` · 6 dimensiones declaradas · las 6 están vivas
y se usan (`PENDIENTES` 289 KB, `MANUAL-USO` 74 KB, `KNOWLEDGE` 55 KB, `ARQUITECTURA-BD` 29 KB,
todas tocadas el 31/07). **No sobra ninguna dimensión: sobran archivos fuera de dimensión.**

**Propuesta — pasar de 6 a 8:**

| # | Dimensión | Archivo(s) | Qué entra |
|---|---|---|---|
| 1 | PENDIENTES | `PENDIENTES.md` | todo lo por hacer (índice + dossier con ID) |
| 2 | ARQUITECTURA BD | `ARQUITECTURA-BD.md` + `ESTRUCTURA_BD_COLUMNAS.md` | tablas, columnas, permisos, RPC |
| 3 | RECONSTRUCCIÓN | `RECONSTRUCCION_SUPABASE_2026-01-07.md` | cómo rehacer la BD + ALTERs post-backup |
| 4 | MANUAL | `MANUAL-USO.md` | cómo se opera cada módulo |
| 5 | CONOCIMIENTO | `KNOWLEDGE.md` | qué funciona, qué se descartó y por qué, troubleshooting |
| 6 | ERRORES | `ERRORES_CONOCIDOS.md` | baseline de errores preexistentes |
| 7 | **MÓDULOS** *(nueva)* | `MODULO_<NOMBRE>.md` | diseño y decisiones por módulo — **una sola convención** (ver A-DOC-02) |
| 8 | **HISTORIAL** *(nueva)* | `CLAUDE_HISTORICO.md` | sesiones cerradas, referencia |

Más la **memoria** (`memory/`), que **no es dimensión**: es continuidad de Claude, y **la doc manda
sobre ella** (si se contradicen, gana la doc y se corrige la memoria).

**Regla de cierre (aprobada):** cualquier `.md` en la raíz que no sea una de estas 8, ni
`CLAUDE.md`, ni `README.md`, está mal ubicado. Y **Claude no crea dimensiones nuevas por su
cuenta**: propone, el usuario autoriza.

---

## <a id="a-doc-02"></a>A-DOC-02 — 13 docs de módulo, 4 convenciones de nombre (✅ HECHO 2026-08-02)

> **RESUELTO.** El usuario eligió la opción (a): renombrar los 13 ahora, consolidar SICORE después.
> Prefijo elegido: **`MODULO_`** (ASCII puro — `DISEÑO_`/`REDISEÑO` llevaban **ñ**, y en este
> entorno los acentos en nombres ya dieron problemas).
>
> **Hecho:** 13 `git mv` (historial intacto) · `MODULO_ARCA.md` creado · los 2 docs huérfanos de
> ARCA movidos a `arca-api/` · 8 referencias vivas actualizadas · nota de "nombres viejos" al
> inicio de `CLAUDE_HISTORICO.md` y `RECONSTRUCCION_SUPABASE_2026-01-07.md` (no se reescriben:
> son archivo).
>
> **Mapa del renombrado:**
> `DISEÑO_PRESUPUESTO`→`MODULO_PRESUPUESTO` · `DISEÑO_SUELDOS`→`MODULO_SUELDOS` ·
> `DISEÑO_TERNEROS`→`MODULO_TERNEROS` · `DISEÑO_AGROQUIMICOS`→`MODULO_AGROQUIMICOS` ·
> `DISEÑO_TEMPLATES`→`MODULO_TEMPLATES` · `DISEÑO_MAIL_PROVEEDORES`→`MODULO_MAIL_PROVEEDORES` ·
> `PLAN_DASHBOARD_REDISEÑO`→`MODULO_DASHBOARD` · `PLAN_REGLAS_TEMPLATES_BANCARIOS`→`MODULO_REGLAS_BANCARIAS` ·
> `ECHEQ`→`MODULO_ECHEQ` · `CONCILIACION-CONTABILIDAD`→`MODULO_CONCILIACION` ·
> `VINCULACION-ANTICIPOS`→`MODULO_ANTICIPOS` · `SICORE`→`MODULO_SICORE` ·
> `DISEÑO_SICORE_RETENCIONES`→`MODULO_SICORE_RETENCIONES`
>
> ⚠️ **Renombrar no actualiza**: cinco de estos no se tocan desde feb-may. Tienen nombre prolijo y
> contenido viejo.
> 🔎 **Anotado al pasar:** `MODULO_CONCILIACION.md` pesa **127 KB** (más que `KNOWLEDGE.md` entero)
> y el nombre viejo sugería dos cosas (conciliación + contabilidad). Puede haber un módulo
> escondido adentro. No se abrió.

Son todos lo mismo (documentación de un módulo) con cuatro nombres distintos:
- `DISEÑO_*.md` → 7: agroquímicos, mail-proveedores, presupuesto, sicore-retenciones, sueldos, templates, terneros
- `PLAN_*.md` → 2: dashboard-rediseño, reglas-templates-bancarios
- **nombre pelado** → `ECHEQ.md`, `SICORE.md`
- **nombre-con-guion** → `CONCILIACION-CONTABILIDAD.md`, `VINCULACION-ANTICIPOS.md`

**Por qué duele.** Cuatro nombres para una dimensión = nadie sabe dónde buscar ni dónde escribir,
y se crea un archivo nuevo en vez de ampliar el que ya existe. Caso testigo: **SICORE tiene tres
archivos** — `SICORE.md` (51 KB), `DISEÑO_SICORE_RETENCIONES.md` (12 KB) e
`INTEGRACION_SICORE_ARCA.md` (35 KB, huérfano, ver A-DOC-05).

---

## <a id="a-doc-02b"></a>A-DOC-02b — Consolidar la documentación de SICORE

Quedaron **dos archivos vivos** sobre el mismo módulo, escritos en momentos distintos y
**posiblemente contradictorios**:
- `MODULO_SICORE.md` (51 KB, abr-2026) — "documentación técnica completa del módulo"
- `MODULO_SICORE_RETENCIONES.md` (12 KB, abr-2026) — el diseño de retenciones

Más la historia cruda del intento de automatizar SIRE, que se movió a
`arca-api/INTEGRACION_SICORE_ARCA.md` (ver [MODULO_ARCA.md](MODULO_ARCA.md)).

**Por qué no se hizo ahora:** consolidar no es renombrar — hay que leer 63 KB y decidir qué
sobrevive. Eso necesita criterio del usuario y no se puede hacer al pasar.

**Cuándo abordarlo:** la próxima vez que se toque el módulo SICORE. Antes no vale la pena.

---

## <a id="a-doc-03"></a>A-DOC-03 — Tres archivos de reconstrucción (553 KB del mismo tema)

- `RECONSTRUCCION_SUPABASE_2026-01-07.md` — 457 KB — **el único declarado** en `CLAUDE.md`; recibe los ALTERs post-backup
- `RECONSTRUCCION_EXITOSA.md` — 84 KB — bitácora del 2026-01-08 ("qué se hizo")
- `GUIA_RAPIDA_RECONSTRUCCION.md` — 12 KB — checklist de 2 h; dice ser derivado del primero

**🧊 CONGELADO por decisión del usuario (2026-08-02).** No se toca hasta resolver
[A-OP-08](#a-op-08), que necesita justamente estos archivos para verificar si el backup/restore
confiable sigue pendiente. Ordenar 553 KB ahora, sabiendo que A-OP-08 obliga a releerlos igual,
es trabajo doble.

**Opción sugerida para cuando se descongele:** el de 457 KB queda como maestro, la guía rápida se
conserva como su checklist (declarada), y `RECONSTRUCCION_EXITOSA` se absorbe en
`CLAUDE_HISTORICO.md` (es bitácora de una sesión).

---

## <a id="a-doc-04"></a>A-DOC-04 — Podar `README.md` (decidido, diferido)

**Decisión del usuario 2026-08-02:** el README **se conserva** (excepción declarada en
`CLAUDE.md`) y **se poda**. El trabajo queda como pendiente, no se hizo ahora.

17 KB, **agosto 2025**, generado por v0. Tiene dos mitades muy distintas:

**✅ Se queda — sirve y no está duplicado en ninguna dimensión:**
- Instalación rápida
- **Configuración crítica de Supabase** (~109 líneas, § línea 60)
- Estructura del proyecto · Tecnologías · Flujo de trabajo de desarrollo

**❌ Se borra — le pisa el terreno a otras dimensiones y está viejo:**
- § "Estado Actual del Desarrollo" → eso es `PENDIENTES.md`
- § "Visión Futura — Rediseño Completo del Sistema" → eso es el **norte** (`CLAUDE.md`), ya escrito
- § "Estado Actual — Desarrollo de Cash Flow (En Progreso)" → de hace un año

**Además:** actualizar la descripción de apertura — dice *"sistema de análisis financiero para
procesar movimientos bancarios de MSA Galicia"*, y hoy es un **sistema de gestión contable y
productiva**.

**Motivo de podar en vez de reescribir:** la parte de instalación/config es valiosa y no está en
otro lado; la parte de estado es exactamente lo que la regla de dimensiones prohíbe (un archivo
contando lo que ya cuenta `PENDIENTES.md`).

---

## <a id="a-doc-05"></a>A-DOC-05 — Cinco `.md` huérfanos

| Archivo | Qué es | Destino sugerido |
|---|---|---|
| `SESION-2025-09-11.md` (4,5 KB) | notas de una sesión suelta | absorber en `CLAUDE_HISTORICO.md` |
| ~~`INTEGRACION_SICORE_ARCA.md`~~ | bitácora del desarrollo Selenium | ✅ **RESUELTO 2026-08-02** — destilado en `MODULO_ARCA.md`, original movido a `arca-api/` |
| ~~`INVESTIGACION_INTEGRACION_ARCA_AFIP.md`~~ | investigación de opciones | ✅ **RESUELTO 2026-08-02** — ídem |
| `Usuarios.md` (12 KB, abr-2026) | análisis de roles, accesos y restricciones de escritura | MÓDULOS, o se cruza con [A-SEC-01](#a-sec-01) |
| `CLAUDE_otro proyecto.md` (+ copia en `AutoMejoras/`) | la plantilla que trajo el usuario | ya destilada en `CLAUDE_BASE.md`; archivar o borrar la copia duplicada |

**Falta decidir (usuario):** destino de cada uno.

---

## <a id="a-doc-06"></a>A-DOC-06 — Seis reglas permanentes vivían sólo en memoria (✅ HECHO 2026-08-02)

> **RESUELTO.** El usuario: *"si la pregunta es si las reglas deben estar en CLAUDE en vez de la
> memoria, la respuesta es sí"*. Aplicado como **2 secciones nuevas + 1 bullet** (no 6 secciones,
> para no inflar el archivo): § ♻️ *Centralizar, no duplicar* (reglas 1 y 4), § 📝 *Motivos,
> errores y testing* (reglas 2, 3 y 6) y un bullet *"Nada destructivo, nunca"* dentro de la
> § 🛑 *Datos* que ya existía (regla 5). Las 6 memorias quedaron como **punteros de 3 líneas**
> con el caso testigo y los links — no se borraron, para no perder el grafo de referencias.
> `feedback_testing_pendiente` conserva su lista de 68 ítems hasta resolver [A-DOC-08](#a-doc-08).

Estas son **reglas**, no estado, y hoy sólo existen en `memory/` (que es de Claude, envejece y
llega con avisos de "68 días"), no en `CLAUDE.md` (que es del usuario y se carga siempre):

1. `feedback_reutilizar_componentes` — centralizar, no duplicar (`SelectorCuentaContable` vs `CategCombobox`)
2. `feedback_documentar_motivos` — toda regla lleva su por qué; el usuario prioriza con eso
3. `feedback_baseline_errores_conocidos` — captura barata / investigación diferida
4. `feedback_actualizar_descargas_al_agregar_features` — si la vista tiene export, se actualiza el export
5. `feedback_gas_drive_nunca_destruir` — find-or-create; ya se perdió un backup por un "replace"
6. `feedback_testing_pendiente` — no dar por terminado lo que no se probó

**Propuesta:** subirlas a `CLAUDE.md` (secciones "Centralizar, no duplicar" y "Motivos, errores y
testing", ya redactadas en la sesión del 2026-08-02); en memoria queda **un puntero de una línea**,
no el texto duplicado — así no quedan dos versiones que se desincronizan.

**Falta decidir (usuario):** ¿se suben?

---

## <a id="a-doc-07"></a>A-DOC-07 — `CLAUDE.md` no dice qué hace la app (🟡 parcial)

`CLAUDE.md` arranca directo con las reglas: ninguna línea explica qué es el sistema. Sin eso, la
regla "todo cuelga del norte" (propuesta para la § Regla de contexto) no tiene de dónde colgar.

**Respondido por el usuario (2026-08-02):** *"el proyecto es un sistema de gestión contable y
productiva"*. Aplicado a `CLAUDE.md` ese mismo día.

### ✅ Norte — definido 2026-08-02

**Qué dijo el usuario:** *"el desarrollo de presupuesto autoalimentado del sistema contable, muy
versátil, a ser afinado por el usuario"*. Y la ampliación, que es la parte operativa:
> *"debe quedar claro que **todo alimenta al presupuesto**. Cada faceta lo más probable es que
> incida o debería incidir en el presupuesto. **Que no esté creado el vínculo no quiere decir que
> no debiera existir.**"*

**Por qué esto es un norte y no un foco.** El usuario preguntó si el norte era "el próximo gran
objetivo". No: eso es el **foco**, que rota (§ FOCO ACTUAL al inicio de este archivo) y por eso no
puede vivir en `CLAUDE.md`, que "rara vez cambia". Lo que él describió **sí** califica como norte
porque "autoalimentado" obliga a **toda la cadena** (ARCA, extractos, pagos, sueldos, productivo) a
alimentar bien — eso no rota.

**Consecuencia práctica (lo que cambia en el día a día):** al tocar cualquier módulo hay que
preguntarse *¿cómo incide esto en el presupuesto?* Si el vínculo no existe, **es un hueco a
registrar**, no un no-problema. Esto resuelve la duda que el usuario planteó: corregir pagos
mientras se trabaja en presupuesto **no** es desviarse del norte — si pagos alimenta mal, el
presupuesto se autoalimenta con basura.

### 🏁 Ampliación 2026-08-02 — el resultado final

El usuario definió **qué tiene que poder dar el sistema al final**:
1. **Resultado del período contable** (ganancia) **y del período en curso** (lo registrado a la
   fecha **+ el presupuesto** de lo que falta).
2. **Presupuesto a 2 años constante.**
3. **Resultado por actividad**, período por período, **+ proyección**.
4. Sin dejar de ser un **sistema contable y productivo completo**.

→ Cada uno quedó como pendiente: [A-FEAT-10](#a-feat-10), [A-FEAT-11](#a-feat-11),
[A-FEAT-12](#a-feat-12). El punto 4 no es un ítem: es la condición de todo lo demás.

**Cómo se avanza — criterio del usuario:** *"esto conlleva bastante tiempo y se irá trabajando a
medida que se dan los eventos"*. **El orden lo marcan los vencimientos, no un roadmap.** Primer
evento con fecha: papeles de trabajo del balance 25/26 → [A-FEAT-09](#a-feat-09) (01/10/2026).

**Estado: 🚧 abierto a ampliación.** El usuario avisó que "probablemente falte info al norte" y que
definirlo le sirve. Cada vez que lo amplíe → actualizar `CLAUDE.md` § Norte y anotar acá la fecha.

---

## <a id="a-doc-08"></a>A-DOC-08 — La lista de 68 ítems sin testear vive en memoria

`feedback_testing_pendiente` (memoria) arrastra una lista numerada de **47** funcionalidades sin
testear, actualizada por última vez el **2026-05-27**. Eso es **estado**, no regla: su lugar
natural es `PENDIENTES.md` (filas `TEST`), que ya tiene estados e IDs estables.

⚠️ **Lo peor no es que esté en memoria: es que `PENDIENTES.md` depende de ella.** La fila
**B-TEST-10** dice literalmente *"Resto ítems 29-47 de la lista de testing (ver
`memory/feedback_testing_pendiente.md`)"* — o sea, la fuente única de verdad **delega en la
memoria de Claude**, que es exactamente lo que la regla prohíbe.

**Mapeo real (verificado 2026-08-02):**
- Ítems **29-47** → 9 ya tienen fila propia: #47→B-TEST-01 · #36→B-TEST-02 · #32→B-TEST-03 ·
  #38/39→B-TEST-04 · #35→B-TEST-05 · #42→B-TEST-06 · #43→B-TEST-07 · #41→B-TEST-08 ·
  #44→B-TEST-09. **Quedan 8 sin fila**: 29, 30, 31, 33, 37, 40, 45, 46.
- Ítems **1-28** → **no están** en `PENDIENTES.md` (los `A-TEST-01..06` son de otros temas).
  Son de mayo o antes: **varios ya deben estar testeados o pisados por desarrollos posteriores.**

### ✅ RESUELTO 2026-08-02 — opción (c)

El usuario eligió cortar la dependencia sin inventar certezas sobre qué está testeado:
1. **8 filas nuevas** `B-TEST-11..18` — los ítems 29, 30, 31, 33, 37, 40, 45, 46.
2. **`B-TEST-10` eliminada** — era la que apuntaba a `memory/` para saber *qué falta*.
3. **Ítems 1-28 → [C-01](#c-01)**, **transcriptos completos** en su dossier (no un conteo): la
   Sección C existe justamente para "dudosos, probable que varios ya no apliquen". Se resuelven
   al auditar la Sección C ([A-OP-04](#a-op-04)).
4. **La memoria quedó como puntero** a este archivo.

**Ítem #34** (schema MA expuesto / fix `.schema('msa')`) quedó cubierto por `B-TEST-06`, que es el
mismo fix del motor.

**Regla adoptada para que no se repita** → `CLAUDE.md` § Documentación:
> La memoria puede citar a la documentación. **La documentación NO puede citar a la memoria.**

---

## <a id="a-sec-03"></a>A-SEC-03 — Terminar el módulo Usuarios y ponerlo activo

**Decidido por el usuario 2026-08-02** al ordenar la documentación: `Usuarios.md` (huérfano en la
raíz desde abr-2026) pasó a ser **`MODULO_USUARIOS.md`**, y el módulo hay que **terminarlo y
activarlo**.

### Lo que hay hoy (funcionando)
Rutas-como-password en `config/access-routes.ts`: `adminjms1320` → `admin` (ve todo) ·
`ulises` → `contable` (sólo la tab Egresos: Facturas ARCA + Templates). El rol sale de la URL en
`app/[accessRoute]/page.tsx` y baja como prop a `dashboard.tsx`. Hay restricciones finas ya
implementadas en `vista-facturas-arca.tsx` (DDJJ IVA, quincena SICORE, botón Revertir, secciones
de Vista de Pagos).

### 🐞 Bug documentado y sin arreglar
`userRole` se pasa de `dashboard.tsx` a `VistaEgresos`, pero **`VistaEgresos` no recibe el prop**
(función sin parámetros). El prop se pierde y no llega a los sub-componentes. Por eso
`vista-facturas-arca.tsx` lee el rol **directamente de `window.location`** como workaround.

### Lo que el usuario quiere (y hoy no existe)
1. Que **todo lo nuevo quede restringido por defecto** para no-admin.
2. **No tener que acordarse** de agregar la restricción en cada feature.
3. Dar acceso **de a poco (opt-in)**, no bloquear de a poco (opt-out).

### El plan ya está decidido — falta ejecutarlo
`MODULO_USUARIOS.md` compara 4 opciones (wrapper del cliente, guard por función, hook
`useSupabase()`, RLS minimalista) y **selecciona la Opción A — RLS Minimalista con Supabase Auth**.
Los 9 pasos están escritos ahí: instalar `@supabase/ssr` · crear usuario admin en Supabase Auth ·
`ADMIN_EMAIL`/`ADMIN_PASSWORD` en Vercel y `.env.local` · migrar `lib/supabase.ts` al cliente SSR ·
`middleware.ts` para refresh de sesión · sign-in silencioso del admin · políticas RLS (lectura
libre + escritura sólo `authenticated`) · verificar que las API routes con `service_role` no se
rompen · testing (Ulises no escribe, admin sí).

### Por qué importa — es el fix de fondo de [A-SEC-01](#a-sec-01)
A-SEC-01 dice que **`anon` puede borrar todas las tablas**. Este módulo **es** su solución: hoy
los accesos son "UX + validación de URL" y **no protegen la API**. Está escrito y sin hacer desde
abril.

**Nota:** las restricciones finas de Ulises son de **visibilidad/UX** y sobreviven igual a RLS —
son independientes.

---

## <a id="a-doc-10"></a>A-DOC-10 — Otras 19 fugas doc → memoria

**Hallazgo 2026-08-02, corrigiendo una afirmación mía errónea.** Al escribir la regla "la doc no
cita a la memoria" dije que `B-TEST-10` era la **única** fuga. **No lo era.** El grep sobre las
dimensiones da **19 citas más**:

| Archivo | Citas | Forma típica |
|---|---|---|
| `PENDIENTES.md` | 14 | *"Detalle: `memory/project_xxx.md`"* al pie de un dossier |
| `RECONSTRUCCION_SUPABASE_2026-01-07.md` | 4 | *"Documentación: `memory/reference_ventas_msa.md`"* |
| `MODULO_DASHBOARD.md` | 3 | ídem |
| `KNOWLEDGE.md` | 1 | ídem |
| `MODULO_REGLAS_BANCARIAS.md` | 1 | ídem |

*(No cuentan las menciones dentro del texto de la propia regla en `CLAUDE.md` / `CLAUDE_BASE.md`,
ni `CLAUDE_HISTORICO.md`, que es archivo congelado.)*

**Por qué es la misma falla, no una menor.** El patrón es idéntico al de `B-TEST-10`: el dossier
resume y manda **el detalle** a la memoria. Si la memoria se pierde o envejece, la dimensión queda
con la mitad de la historia y un puntero muerto — que es exactamente lo que la regla previene.

**Qué hay que hacer:** por cada cita, **absorber lo que sirve** en la dimensión y borrar el
puntero. No es mecánico: hay que leer cada memoria y decidir qué merece subir (varias son de
2025-2026 temprano y pueden estar desactualizadas).

**Cuándo:** no urgente. Conviene hacerlo **por tema** — cuando se toque cada dossier, se absorbe
el suyo. Forzar los 19 de una es releer ~19 memorias sin motivo.

**Chequeo:** `grep -c "memory/" *.md` sobre las dimensiones. Ojo con los falsos positivos: el
texto de la regla en `CLAUDE.md` menciona `memory/` a propósito.

---

## <a id="c-01"></a>C-01 — Testing ítems 1-28 (absorbidos de la memoria, 2026-08-02)

Lista de funcionalidades sin testear armada entre **abril y mayo de 2026**. Vivía en
`memory/feedback_testing_pendiente.md`; se transcribe acá para que `PENDIENTES.md` no dependa de
la memoria de Claude.

> ⚠️ **Estado real desconocido.** Son de mayo o antes y hubo dos meses de desarrollo encima.
> Varios ya deben estar testeados, y otros pisados por cambios posteriores. **No asumir que están
> pendientes.** Se auditan junto al resto de la Sección C ([A-OP-04](#a-op-04)).

**Extracto bancario**
1. Sistema revisión extracto — revisado/notas operador, visual rojo translúcido, marcado masivo
2. Filtros rápidos — chips con contadores (Pendientes, Auditar, CATEG Inválida, Sin CATEG)
3. Búsqueda mejorada — 9 columnas
12. Detalle editable — inline + masivo
13. Categ propagada — asignación de cuentas propaga categ automáticamente
18. Columnas Proveedor y Comprobantes — 2 columnas nuevas visibles por defecto

**Dashboard**
5. Agrupado por templates — agrupa por nombre de template
6. Expandible sub-categorías — desglose multi-cuenta

**Selectores de cuenta**
7. Selector sub-categorías extracto — texto libre + existentes + templates + plan de cuentas
8. Selector sub-categorías cash flow — ídem
9. `SelectorCuentaContable` unificado — historial proveedor + jerarquía + buscador
15. `SelectorCuentaContable` jerarquía completa — muestra la ruta entera (RESULTADOS > EGRESOS > …)

**Motor de conciliación**
10. Re-asignación de movimientos conciliados — cambiar template/factura post-conciliación
17. Pre-filtro CUIT bancario — si el banco informa CUIT, filtra candidatos antes de comparar montos
20. Tab Grupo en asignación manual — vincular extracto a grupo de cuotas, desglose expandible
21. Auditar→conciliado smart — no pide vincular si ya tiene origen asignado
23. Pre-filtro haberes — "haber" restringe el pool a sueldos
24. Regla empleado contable/interno — Tipo C en el motor para sueldos

**Pagos / facturas**
11. Detalle mejorado de facturas — formato FC/ND/NC en el importer (sin código tipo AFIP)
14. Fecha editable en Vista Pagos — click para cambiar fecha en facturas ARCA y templates
16. Bloqueo de edición de monto en filas agrupadas de Cash Flow — `toast.error` al intentar editar
26. Multi-CUIT en agrupación ARCA — alerta al agrupar facturas de distinto CUIT
27. Cancelación FC/NC en Vista Pagos — escenario A (FC+NC mismo CUIT) y B (NC contra descuentos)
28. Pago parcial con anticipo + ECHEQ — crear anticipo, vincular a FC, pagar el saldo con un segundo ECHEQ

**Otros**
4. Búsqueda rápida en templates — nueva, reactiva
19. BBDD Proveedores — 105 proveedores, auto-poblada desde ARCA + templates
22. Filtro categ aplica sólo a visibles — búsqueda + Aplicar filtra como Excel
25. Agrupación de sueldos — agrupar/desagrupar en Vista Pagos; Cash Flow agrupa en fila única

---

## <a id="a-bug-01"></a>A-BUG-01 — Grupos de Pago: 6 bugs (caso Alcorta, 2026-06-16)

**Contexto.** Corrigiendo retenciones SICORE mal asignadas de Garmendia y Alcorta cert 31, aparecieron bugs del flujo "pagar grupal" (`grupo_pago_id`). Caso concreto: 3 FC de Alcorta del 10/06 pagadas juntas en un grupo, pero la FC 6115 tenía la quincena SICORE mal (mayo en vez de junio).

**1) Cancel del modal SICORE no siempre revierte estado a 'pendiente'.**
Síntoma: FC cambiada a `pagar`, se abre modal SICORE, se aborta → la FC queda en `pagar` (debería volver a `pendiente`). Hay código en `cancelarGuardadoPendiente` que SÍ revierte (verificado), pero en ese flow no se invocó. **Reproducir**: anotar exactamente qué botón se clickeó (ESC, X, "Cancelar", overlay). Prio media.

**2) Inline editing `pagar→pendiente` no persiste en FC con `grupo_pago_id`.**
Síntoma: se edita el estado inline a `pendiente`, toast "guardado", pero vuelve a `pagar`. Hipótesis: la FC tiene `grupo_pago_id` y alguna lógica la "ata" al grupo y restaura el estado. **Investigar**: ¿el UPDATE corre con `'pendiente'`? ¿hay useEffect/re-render que restaura? ¿guard en `ejecutarGuardadoReal` que ignora el cambio si hay grupo? Workaround: SQL directo. Prio media.

**3) Dropdown 3 puntos vacío cuando `estado='pagar'` SIN SICORE.**
Causa en `vista-facturas-arca.tsx` ~6630-6700:
```ts
// "Resetear" requiere: (factura.sicore || factura.tc_pago || factura.descuento_aplicado)
// "Detalle de pago" requiere: (estado === 'pagado' || estado === 'conciliado')
```
Una FC en `pagar` sin SICORE/tc_pago/descuento (caso del abort) no cumple ninguna → dropdown sin items. **Fix propuesto**: item `↩ Volver a Pendiente` con condición `estado === 'pagar' && !sicore && !monto_sicore`. Prio media.

**4) `resetearFactura` NO limpia `grupo_pago_id`** (`vista-facturas-arca.tsx` ~3511-3520).
El `updateData` resetea estado/sicore/tc/descuento/monto_a_abonar pero **no toca `grupo_pago_id`**. **Decisión 2026-06-16: dejar así por ahora** — en Alcorta jugó a favor (las 3 FC mantuvieron el grupo durante todo el ida-y-vuelta de resets/re-imputaciones y quedaron bien vinculadas). Conceptualmente cuestionable (resetear "completa" debería sacarla del grupo) pero el flujo de re-imputar SICORE la vuelve a poner en el grupo → efecto neto correcto. Prio baja.

**5) Vista "Grupos de Pago" desde Cash Flow (feature futura).** Pedido del usuario:
> "debería tener acceso a ver la tabla de grupos… desde cash flow… el grupo es un pago de varias cosas juntas (puede agrupar templates)".
Sugerido: listar grupos activos, ver detalle (FC+templates+anticipos), agregar/quitar item (hoy NO hay UI), editar metadata. A definir: UI, permisos (admin only?), comportamiento si grupo declarado/cerrado. Prio media.

**6) `grupos_pago.monto_total` no se recalcula automáticamente.** Se calcula y guarda al crear el grupo. NO se actualiza cuando: una FC entra/sale del grupo, SICORE recalcula `monto_a_abonar`, o una FC se anula/cambia `imp_total`. Ejemplo Alcorta: grupo creado con $4.165.672,09 (SICORE viejo mal); tras re-imputar (FC 6152 sube de $28.195,37 a $32.675,37) la suma real era $4.161.192,09 → diferencia $4.480 = $224.000 × 2% (mínimo no imponible duplicado). Se corrigió con UPDATE manual. **A definir**: trigger BD / recálculo on-demand / warning UI. En análisis. → Relacionado con [A-BUG-02](#a-bug-02).

**Cierre del caso Alcorta:** 3 FC (6115, 6152, 2734) en quincena `26-06 - 1ra`; todas con `grupo_pago_id = e8eaac1d-…`; cert 30 reutilizado por las 3 (cert 31 anulado); `monto_total` corregido a $4.161.192,09; SICORE total $65.380,71 (vs $60.900,71 que sub-declaraba $4.480).

---

## <a id="a-bug-02"></a>A-BUG-02 — Grupo ARBA `a177c1fb` desfase $5.701,30 (pendiente revisión)

Quedó abierto al final del 2026-06-16 (el usuario se desconectó). **Mensaje a recordarle al retomar:**

**Resumen.**
| Grupo | Items | Suma real ítems | `monto_total` guardado | Estado |
|---|---|---|---|---|
| `722c116c` (11/06) | 9 cuotas Inmob/Fondo | $2.580.950,60 | $2.580.950,60 | ✅ OK |
| `afdc7505` (12/06) | 4 cuotas Inmob/Fondo | $1.811.266,90 | $1.811.266,90 | ✅ OK |
| **`a177c1fb`** (12/06) | 3 cuotas | **$109.164,00** | **$103.462,70** | ⚠️ **−$5.701,30** |

**Detalle del grupo problemático.**
| Cuota | Monto | Last update | grupo |
|---|---|---|---|
| Tango Parra 1 (Inmob) | $38.025,70 | 02/02 (seed) | `a177c1fb` |
| Tango Parra 2 (Inmob) | $69.525,20 | 02/02 (seed) | `a177c1fb` |
| Fondo Educativo | $1.613,10 | 12/06 00:20 (manual) | `a177c1fb` |

**Lo que NO encaja.** El "Fondo Educativo" es exactamente **1,5% del Inmobiliario** (verificado en los 3 grupos). Inmob actual $107.550,90 → Fondo debería ser $1.613,26 ≈ $1.613,10 ✅; total esperado $109.164,00 ✅. **Los datos actuales son coherentes entre sí**; lo que está mal es el `monto_total = $103.462,70` guardado al crear el grupo.

**Hipótesis.** El `monto_total` se calculó y guardó UNA vez al crear el grupo (12/06 00:20). Después algo cambió (probablemente el Fondo Educativo se ajustó manualmente) y `monto_total` no se recalculó. Refuerza [A-BUG-01](#a-bug-01) punto 6. Dato curioso: de 3 grupos del mismo día con la misma lógica, dos quedaron sincronizados y uno no → el bug no es sistémico, se dispara en condiciones específicas.

**Preguntas para el usuario antes de tocar.**
1. ¿Recordás algo del grupo Tango Parra el 12/06? (si ajustaste el Fondo a mano, confirma la hipótesis).
2. ¿Cuánto vas a transferir al banco? Si $109.164,00 → el sistema sub-registra $5.701,30 y hay que UPDATE. Si $103.462,70 → alguna cuota debería bajar.

**Recomendación (no ejecutar sin confirmar):**
```sql
UPDATE msa.grupos_pago SET monto_total = 109164.00
 WHERE id = 'a177c1fb-db93-45c2-9de0-f39c18274059';
```
Además: revisar grupos de otras categorías de junio por desincronizaciones similares + decidir trigger BD (punto 6 de A-BUG-01).

---

## <a id="a-bug-03"></a>A-BUG-03 — Modo Admin facturas: edición no funciona

**Estado:** implementado parcial (commit `5a24fa6`, en main).
- ✅ Eliminación funciona (con confirmación).
- ❌ Edición libre de campos NO funciona en modo admin (reportado 2026-06-09).

**Causa probable (sin investigar):**
- `renderizarCelda` se sobreescribe en otra rama del render, o
- el click handler queda bloqueado por otro modo, o
- el `window.prompt` cancela el flujo silenciosamente.

Detalle en `memory/project_modo_admin_facturas_pendiente.md`.

---

## <a id="a-test-01"></a>A-TEST-01 — Lotes Galicia (export Excel banco)

**Estado:** app-side completo en `desarrollo` (commit `ffff7e8`), build OK, NO en main.

Genera Excel formato banco Galicia desde Vista Pagos. Flujo: seleccionar FCs/cuotas/anticipos/sueldos → "Exportar lote Galicia" → modal validación (`/api/lotes/preview`) → bucle opcional completar email/CBU/Alias → "Aceptar y exportar" (`/api/lotes/generar`: Excel XLSX + INSERT `lotes_transferencias` + UPDATE `ultimo_uso_bancario`) → descarga con selector de carpeta.

**Reglas clave:** FC suelta = 1 fila por item; grupo completo seleccionado = 1 fila total; grupo multi-CUIT = BLOQUEA; item sin CBU/Alias = excluido silencioso; moneda ≠ ARS = bloqueante; sueldos = Excel APARTE; >50 items = parte en N archivos. Excel: hoja "Formulario", 6 columnas (CBU/Alias · Importe · Motivo · Descripción ≤12 chars · Email · Mensaje). Migración `public.lotes_transferencias` aplicada (NO en backup).

**Falta (usuario):** probar con datos reales vs formato del banco · decidir motivos específicos para templates (Alquiler/Expensas) o dejar "Varios".
**Fase 2 (Claude):** historial de lotes · vista config rápida CBU/email.
Detalle completo: `memory/project_lotes_galicia.md`.

**✅ IMPLEMENTADO (2026-06-21) — Mensaje del email por proveedor:**
- Campo `proveedores.mensaje_transferencia VARCHAR(200)` (NO en backup).
- Preview carga el mensaje fijo → modal muestra columna **"Mensaje del email"** editable por fila (pre-llena con el fijo, placeholder "sin mensaje").
- Checkbox **"fijar"** por fila → guarda lo tipeado en `proveedores.mensaje_transferencia` (PATCH al generar).
- Excel usa: override del usuario > mensaje fijo del proveedor > vacío (antes siempre vacío).
- De paso: fix TS2459 `Empresa` re-exportado en `lotes-galicia/types` (baseline 119→118). 0 errores nuevos.

---

## <a id="a-test-02"></a>A-TEST-02 — GAS PDF (descarga automática facturas)

**Estado:** app-side completo en `desarrollo` (5a2a3f9, 74805b1, d9bd749).

**Falta (usuario) para activar:**
1. Deploy GAS Web App (`clasp create + push` en `gas-buscar-pdf/`)
2. `GAS_AUTH_TOKEN` en Script Properties del GAS
3. Habilitar Drive API en Services del GAS
4. Deploy → Web App, copiar URL
5. Env vars Vercel: `GAS_BUSCAR_PDF_URL`, `GAS_AUTH_TOKEN`, `GAS_FOLDER_ID_MSA`, `GAS_FOLDER_ID_PAM`, `GAS_FOLDER_ID_MA`
6. Cargar emails de proveedores desde modal "Config PDFs"

Guía: `gas-buscar-pdf/README.md`. ⚠️ Seguridad: el scope GAS hoy es `drive` (full) — pasar a `drive.file` (ver [A-SEC-01](#a-sec-01)).
**Fase 2 (Claude):** auto-disparo post-import · auto-crear proveedor en FC de CUIT inexistente · botón "Buscar PDF de esta FC". Detalle: `memory/project_gas_pdf_busqueda.md`.

### 🔎 Hallazgos de la revisión 2026-06-21 (verificado en código)

**Qué hace el botón "Buscar PDFs"** (`vista-facturas-arca.tsx:6146-6182`): NO muestra preview ni deja seleccionar. Filtra TODAS las facturas de la grilla/empresa con `fc ∈ {Buscar, No, NO Mail, null}` (l.6152), muestra un `window.confirm` con **solo la cantidad** ("Vas a buscar PDFs de N facturas…"), y al aceptar corre el lote **en segundo plano** (serie, 1,5s por factura, con notificación de progreso) y refresca. No hay selección por factura.

**Estados de `fc` que SÍ se buscan:** `Buscar`, `No`, `NO Mail`, `null`. **NO se buscan:** `Sí`, `Portal`, `APP`, `OK`, `VER`.

**⚠️ A-BUG-10 — `'No'` se busca igual.** Contra la intuición del usuario (y contra la tabla de diseño que dice `No` = "no tengo y NO busco"), el código **incluye `'No'` en el set buscable**. Además hay lugares que tratan `fc==='No'` como "pendiente de recibir" (l.949, 6617, 7519). Hay **conflación de significado**: ¿`No` = "no la tengo todavía, buscala" o "no busco"? **Decisión pendiente** del usuario. Hoy: marcar `No` NO excluye de la búsqueda.

**⚠️ A-FEAT-05 — no se puede setear `'Buscar'` a mano.** El editor de `fc` solo ofrece **`Sí` / `No` / `Portal`** (l.7321, 7400-7402). No hay opción para volver a poner `'Buscar'` (re-encolar). El default al importar sí es `'Buscar'` (default de BD), así que las nuevas entran buscables; pero si una se marcó `Sí`/`Portal` no hay forma de volver a la cola por UI.

**Auto-búsqueda en el import:** **NO existe** (el "auto-disparo post-import" es Fase 2, sin implementar). Hoy la búsqueda es **100% manual** vía el botón. No hay nada que busque "solo las de un código específico" al importar.

**Conclusión sobre lo pendiente de Claude vs usuario:**
- **NADA de Claude bloquea el uso.** El módulo manual está completo. Lo que falta para que FUNCIONE es 100% del usuario: (1) deploy GAS, (2) 5 env vars Vercel, (3) cargar emails en Config PDFs.
- Pendientes de Claude = mejoras Fase 2 (opcionales): auto-disparo post-import, auto-crear proveedor, botón individual por FC + resolver A-BUG-10 / A-FEAT-05.

### ✅ IMPLEMENTADO — Parte A (2026-06-21): modal Buscar PDFs con selección

`vista-facturas-arca.tsx` + `lib/gas-pdf/client.ts`:
- El botón "Buscar PDFs" ahora **abre un modal** (antes lanzaba directo). Modal con: rango de fechas (emisión Desde/Hasta), lista con checkboxes, botones **Todas / Ninguna / "Solo Buscar"**, contador de seleccionadas, badge del estado FC por fila.
- **Pre-selecciona solo las auto-buscables** (`fc ∈ {Buscar, null}`). 'No', 'NO Mail', 'Portal', 'APP', 'Sí', 'VER' **ya NO se auto-buscan** — pero se pueden seleccionar a mano (resuelve "NO Mail solo manual" y "No no se busca solo").
- **Cancelar:** botón "Cancelar búsqueda" durante la corrida (corta el lote en la próxima factura, vía `isCancelled` en `buscarPdfLote` + `cancelado` en `ProgresoLote`).
- Type-check: 119 errores preexistentes, 0 nuevos.

### Estados FC y auto-búsqueda (criterio del usuario, fijado 2026-06-21)
- **Se auto-busca:** solo `Buscar` (+ `null` legacy, tratado como Buscar → migrar).
- **NO se auto-busca (solo manual vía modal):** `No`, `NO Mail`, `Portal`, `APP`, `Sí`/`OK`, `VER`.
- `null`: legacy → migrar a `Buscar` (Parte B).

### ✅ IMPLEMENTADO — Parte A' (chips), B (import default), C (auto-crear proveedor) — 2026-06-21

**A' (modal):** chips multi-toggle por estado FC (`filtroTiposPdf`) — apretás un tipo y la lista muestra solo esos; multi-unión; "limpiar". Botón footer renombrado a **"Cancelar"** (cierra sin buscar). Todas/Ninguna operan sobre lo visible (chips+fechas).

**B (import default):** `import-facturas-arca/route.ts` l.319 ahora `fc: 'Buscar'` (antes `null`). La imputación del usuario lo pisa si elige (merge l.571-574 ya respeta override). **Nulls viejos NO se migran** (decisión del usuario: históricos, los trata aparte). Portal ya funcional vía imputación.

**C (auto-crear proveedor):** al final del import, en bloque y en try/catch (NO rompe el import): junta los CUITs limpios importados, consulta `proveedores`, e inserta los faltantes (`cuit` + `razon_social=denominacion_emisor` + `fc_modo='sin_config'`). Devuelve `proveedoresCreados` en la respuesta. **Activo ya** aunque la búsqueda esté apagada.

Type-check de A'+B+C: 119 errores preexistentes, 0 nuevos.

### ✅ Parte C completa (2026-06-21)
- **Backfill:** 32 proveedores creados (de 118 CUITs distintos en facturas). SQL INSERT...SELECT con CUIT normalizado, `fc_modo='sin_config'`. NO en backup.
- **Auto-disparo post-import:** implementado **gated/APAGADO** (`dispararBusquedaPostImport(ids)` + check `process.env.NEXT_PUBLIC_GAS_AUTODISPARO_IMPORT === 'true'`). ✅ **Refinado (2026-06-21):** el import devuelve `idsBuscar` (IDs de las nuevas en estado 'Buscar') y el auto-disparo busca **solo esas**, no todo el backlog.

### 🧩 Catch-all + manejo de mails — ✅ IMPLEMENTADO 2026-06-27 (FALTA TESTEAR)
Commits: `4f7f617` (catch-all + etiquetar/leído + cuerpo), `70dad84` (mail resumen + default 30d), `9717207` (scopes GAS). **Pendiente: que el usuario re-pegue `Main.gs` + `appsscript.json`, redeploy versión nueva, re-autorice (nuevos scopes gmail.modify/send) y pruebe.**

Diseño base — muchas FC llegan porque el proveedor las manda por WhatsApp y el usuario (o Andrés) las **reenvía** desde el cel (asunto auto "Documento de Jose" + código `FC` agregado a mano).

**Reenviadores (recolectores):** Jose `josemartinezsobrado@gmail.com` · Andrés `mailandres.12@gmail.com` (Andrés ADEMÁS es proveedor que emite FC → va también en `proveedores`). Asunto auto de Andrés: pendiente que lo pase el usuario.

**Orden de búsqueda (validando siempre CUIT+número+monto dentro del PDF):**
1. Reenvíos con `FC` → `from:(reenviadores) subject:(FC)` (señal más fuerte; `FC` sirve para diferenciar de remitos/otros).
2. Reenvíos sin `FC` → `from:(reenviadores)` (asunto "Documento de Jose"/el de Andrés, aunque no diga FC → igual revisa).
3. Directo de proveedores → `from:(mail_proveedor) subject:(patrón)`.
Así los mails de **otros temas quedan sin tocar**.

**Manejo de mails:**
- **Match perfecto** → marca **leído** + etiqueta **`Facturas Descargadas`** + **NO mueve** + descarga a Drive (auto-archivado por campaña/mes, ya hecho).
- **Sin match** → se deja **igual** (no cambia leído/no-leído, no etiqueta). Busca tanto en leídos como no leídos; lo ya leído por el humano queda intacto.
- **Mail resumen** al usuario por corrida: FC descargadas **por empresa** + **el cuerpo** de cada mail (para no perder texto importante). Instancia de control. Lo manda el GAS.

**Fechas:** default **30 días** (restrictivo), **configurable desde la app** para buscar más viejo.

**Reenviadores (decidido 2026-06-27):** van en **`proveedores`** (Jose y Andrés SON proveedores) marcados con un **tag** en el campo `tags` (ej. `recolector`, sin columna nueva). La **app** los lee y le pasa los mails al GAS. **NUNCA** hardcodear mails en el GAS; **NUNCA** que el GAS consulte la BD (metería una credencial Supabase = peor exposición).

**Dudosos (verificado en código):** el GAS YA los archiva en subcarpeta **`_Revisar`** (status `revisar`): caso `monto difiere` o `múltiples candidatos`. Con el auto-archivado quedarían en `<empresa>/campaña/mes/_Revisar/`. **Decisión abierta:** `_Revisar` por-mes (como queda hoy) vs uno **global** por empresa. **Falta**: incluirlos en el mail resumen.

**Mail resumen → `sanmanuel.sp@gmail.com`** (lo manda el GAS): por empresa, las **descargadas** (exactos) + las **dudosas** (revisar) + el **cuerpo** de cada mail. Instancia de control.

### 🔧 GAS PDF — estado del paquete

#### ⭐ ESTADO ACTUAL — 2026-06-29, GAS **v0.9.16** (todo en `desarrollo`). Módulo "archivo digital" VALIDADO (período 5). **Tema pausado** (el user pasó a otro).
Handoff completo + qué quedó pausado en memoria [[gas-pdf-testing-handoff]]. **Vive en: Egresos → Facturas MSA → Subdiarios → Consultar Período** (columna "Archivo / FC" 📎/❌/🌐 + estado FC + ✕ desvincular; chips que filtran; botones 📊 Conciliar saldos / 🗂️ Supervisar OCR / 🔄 Solo sin adjudicar; panel "PDFs sin vincular" con sugerencia ⭐ por nombre+fecha + Vincular + ✏️ renombrar + 🔧 Detalle debug). Progresión de versiones:
- **0.9.16** — el mail de supervisión muestra **"✅ Vinculadas"** (proveedor·nº·monto·link), no solo lo que falta.
- **0.9.15** — 🔑 **FIX extraerMontosPdf**: leía montos solo CON separadores ("1.312.600,00"); ARCA expone SIN ("1312600,00") → capturaba "600,00" y el chequeo de monto rechazaba estándar (muchas huérfanas con buen OCR). Ahora ambos formatos. **Validado período 5: ~26 auto-match correctos, sin falsos positivos.**
- **0.9.14** — el matcher de la auditoría exige **MONTO** (valor abs, tol $1) además de CUIT+número → **corta falsos positivos** (un archivo de NC Rigo se cruzaba con una FC por compartir CUIT; "Coop tala x2" se cruzaba con ICT NET).
- **0.9.13** — acción `listar` (Conciliar saldos: balance huérfanos/faltantes SIN OCR, instantáneo).
- **0.9.12** — acción `renombrar` (renombrar un PDF huérfano mal nombrado).
- **0.9.10** — 🔑 **FIX OCR DEFINITIVO**: extracción 100% por **REST de Drive** (UrlFetchApp + token); el servicio avanzado "Drive" NO estaba habilitado (`ReferenceError: Drive is not defined`) = causa raíz del OCR vacío. El usuario pegó `appsscript.json` (scopes drive+script.external_request+userinfo.email) y re-autorizó. *(0.9.11 = ignora xlsx + asunto mail "Supervisión…"; 0.9.9/0.9.8 intermedios.)*
- **0.9.8** — adjunto del **mail OFICIAL del proveedor** que no valida (OCR pobre, ej. facturas de servicios) va a **`_Revisar`** en vez de `no_encontrada` (señal fuerte por remitente; elige PDF más grande para no archivar un logo) + motivo de descarte detallado en el debug. *(Caso Coopser.)*
- **0.9.7** — **Confirmar VER** también etiqueta `Facturas Descargadas` + marca leído el mail (vía `gmail_message_id` persistido en `arca_pdf_busqueda_log` durante la búsqueda).
- **0.9.6** — `resolverDestinatario` con cascada (body → Script Property `RESUMEN_DESTINATARIO` → getEffectiveUser → getActiveUser): **arregla el "no recipient"** del mail resumen (Access:Anyone hacía `getActiveUser`="").
- **0.9.4** — mail resumen con **sección DEBUG por factura** (queries Gmail + threads + resultado), para diagnosticar desde el mail.
- **0.9.3** — eficiencia: prioriza candidatos que **nombran al proveedor** + **corta al 1er match** exacto.
- **0.9.2** — **FIX fechas reenvíos**: ventana del catch-all hasta **HOY** (antes emisión+30 → un reenvío tardío quedaba afuera = causa de "no encontró Luminatus").
- **0.9.1** — mail resumen **SIEMPRE** (aunque 0 hallazgos, con totales) como instancia de control.
- **0.9.0** — audit **resumible por tandas** (≤10 archivos/request, idempotente). 0.8.0 — **Confirmar VER** (mueve de `_Revisar` + link). 0.7.0 — **auditar período**. 0.6.0 — sin confirmar conserva nombre/sin link. 0.5.0 — tipo/ext real. 0.4.0 — **asunto por-recolector** (Jose "Documento de Jose" / Andrés "FC").

**Testing en curso:** caso testigo **Luminatus** (MSA, emisión 18/05, reenviado 28/06 como foto). Esperando que el usuario corra y pegue el **mail de debug** (llega a `sanmanuel.sp`) para interpretar. Pendiente menor: **reglas de nombres clave** como validación (no solo prioridad); audit nuance emisión-vs-contable; cargar mails de proveedores.

#### 💬 Feedback de testing 2026-06-28 (CAPTURADO tal cual, a responder/resolver)
1. ✅ **RESUELTO (commit `4a33b85`, app-side)**: UX no bloqueante — el modal Buscar se cierra al arrancar, la búsqueda corre en 2do plano, el avance va en la notificación flotante (con su propio Cancelar). + fix: la notificación reaparece en la 2da búsqueda.
2. ✅ **RESUELTO (commits `4a33b85` + GAS v0.9.6 `46d75c5`)**: el mail no llegaba por dos motivos encadenados → (a) el envío fallaba en silencio (`catch {}` vacío) ahora reporta {enviado,error}; (b) causa raíz: `getActiveUser`="" con Access:Anyone → `resolverDestinatario` + Script Property `RESUMEN_DESTINATARIO`. **Mail resumen llega OK.**
3. ✅ **Luminatus → `_Revisar` OK** (soft-match v0.9.2). Confirmada y movida con link (testeado). *(Avance real.)*
4. ⏳ **Falta VER la foto/candidato** antes de confirmar (VER no guarda link en la factura). Agregar un "ver candidato" (está en el **log** + carpeta `_Revisar`). *(El usuario lo dejó de lado por ahora.)*
5. ⏳ **Etiqueta/leído en VER**: por diseño solo el match exacto etiquetaba; con v0.9.7 el **Confirmar** ya etiqueta. Punto cerrado vía #6.
6. ✅ **RESUELTO (GAS v0.9.7 `3b421eb`)**: Confirmar VER ahora **marca leído + etiqueta `Facturas Descargadas`** (vía `gmail_message_id`). *(El "cuerpo al reporte" NO se hizo — no hay reporte por-confirmación; fuera de alcance.)* Requiere búsqueda NUEVA post-v0.9.7 (las viejas tienen el id NULL).

**Extra implementado fuera de los 6:** columna **"Mail proveedor"** editable (ver/cargar el que falta + guardar) en el modal Buscar PDFs (commit `eb37feb`); si el proveedor no tenía mail, al guardarlo se habilita para búsqueda. Reusa `/api/gas/config-proveedor`.

#### 🔮 Ideas futuras del buscador (2026-06-28, NO implementar aún — feedback del usuario)
- **A-RISK-GAS-01 — Riesgo introducido por v0.9.8 (mes equivocado)**: la rama "adjunto del mail oficial del proveedor → `_Revisar`" puede archivar **otra factura del mismo proveedor pero de otro mes** si cae en la ventana y la correcta no validó. Hoy mitigado en parte (ventana emisión−2 a emisión+`dias_busqueda`, y elige PDF más grande). **Mejora**: usar el **período del asunto** (ej. "5/2026") y/o el cuerpo para confirmar que el candidato es del mes de la emisión antes de mandarlo a `_Revisar`. El usuario lo asume por ahora ("lo iremos resolviendo").
- **B-FEAT-GAS-RIQUEZA — Matcher más rico (asunto + cuerpo + nombre de adjunto)**: hoy la validación es casi solo OCR del PDF (CUIT+nro+monto). Sumar como **señales ponderadas**: (1) **asunto** (período mm/aaaa, nombre corto/`nombre_fantasia` del proveedor, nº de factura), (2) **cuerpo del mail** (a veces trae CUIT/nº/monto en texto aunque el PDF sea ilegible), (3) **nombre del adjunto**. Decidir exacto/revisar/descartar y elegir entre varios candidatos combinando estas señales (no solo el OCR). Mejora el soft-match (caso "Servicio Eléctrico - Coopser" singular vs razón social plural).
- **B-FEAT-GAS-TEMPLATES — Modelos de extracción por proveedor (para carga posterior)**: para proveedores recurrentes con **formato fijo**, un "modelo"/parser que sepa dónde está el **importe** (y otros campos) y lo **extraiga** para una carga posterior automática (no solo descargar el PDF, sino tomar los datos). Conecta con el subdiario/imputación. Feature grande, fase 2+.
- **B-FEAT-UNIFICAR-PORTAL — Unificar la config de "portal"/proveedor (2026-06-29/30)**: hoy "portal" está partido en 3 lugares → `reglas_ctas_import_arca.estado` · `comprobantes_arca.fc` · `proveedores.fc_modo`.
  - ✅ **HECHO (commit 6914e1a, GAS no involucrado)**: campo **`fc`** en `reglas_ctas_import_arca` + import lo aplica (`fc = regla.fc || 'Buscar'`) + `ModalReglasImport` con selector FC. **Pendiente USUARIO (testing)**: cargar `FC=Portal` en las reglas de Autopistas del Sol/Urbanas, Corredores Viales, DirecTV (ya tienen estado=credito). Y corregir la factura de Autopistas que quedó `NO Mail` (workaround Config PDFs→portal+re-buscar, o SQL puntual). Las reglas aplican a importaciones NUEVAS, no retroactivo.
  - ⏳ Aún: 2 columnas de mail (`email_facturacion` 3 = Config PDFs vs `email_pagos` 26 = Galicia) → aclarar/unificar. + Selector de `fc` manual por factura. Detalle en memoria [[config-proveedores-fragmentada]].

#### 🔵 AUDIT MULTI-EMPRESA (MSA / PAM / MA) — al terminar de afinar Cash Flow/pagos/SICORE (2026-07-15)
- **Qué:** cuando cerremos el afinado de todo (pagos, grupos, cash flow), hacer un **audit** de que funciona para las **3 empresas: MSA, PAM y MA**. Hoy hay cosas hardcodeadas a `msa` (Cash Flow carga FCs de msa; `agruparPagos({schema:'msa'})`; etc.). **NOTA: SICORE es SOLO MSA** (PAM y MA no usan SICORE) → el `'msa'` hardcodeado en SICORE (`registrarEnSicoreRetenciones`, cálculos, pagos previos) es CORRECTO, no entra en este audit.
- **Regla de trabajo (vinculante de acá en más):** al desarrollar cualquier cosa nueva de pagos/cash flow, **pensar y dejar preparado para las 3 empresas desde el vamos** (schema parametrizable), no solo MSA. Evitar acumular deuda de hardcodeos msa.
- **Cuándo:** al final del afinado. Listar dónde está hardcodeado `msa` y qué falta para PAM/MA (¿existe `sicore_retenciones`/`grupos_pago` en pam/ma? ¿el Cash Flow debe mostrar FCs de las 3?).

#### ⏳ PENDIENTE DE TEST — tanda Cash Flow / SICORE / grupos (2026-07-15/17, todo en `desarrollo`, sin mergear)
Migración de pagos/SICORE al Cash Flow (E1-E4 + fixes). Testear en preview antes de merge a main. Detalle en memoria [[project_sicore_cash_flow_estado]].
- **SICORE v2 desde Cash Flow:** pagar una FC con retención → queda en `msa.sicore_retenciones` idéntico al Modal (cert, quincena, base, retención). Guarda estado_quincena (declarada bloquea / cerrada confirma) — commit b589818.
- **Fac C (tipo 11):** nunca retiene (36c8e54). **Descuento:** se estampa en la FC (`descuento_aplicado`) + %/monto + desglose Gravado/IVA/Total + Transferencia + 2 decimales (36c8e54, 29010f9). **Sin retención + descuento** pronto pago (d57549d).
- **Mínimo no imponible acumulado (Idea 2, e3657a5):** FC bajo mínimo que acumuladas superan → retienen; caso día-3/día-13; NC resta; independiente del orden; checkbox override. **Gate por proveedor en lote (Idea 1, 8b4fd9e):** agrupa por CUIT, decide por total del proveedor. **Caso testigo: Alcorta 2 FC + 1 NC + descuento, pago 16/07 (26-07 2da).**
- **fecha_pago editable inline** para FC en Cash Flow (64c83ea). **Fix quincena zona horaria** (b325555, ver abajo).
- **Grupos (acb234b):** agrupar (nombre combinado, responsable templates) + **desagrupar** (botón ✕ en la fila-grupo).
- **Reset (d586a21, 20777b3):** el "Resetear" aparece en pagar/preparado (grilla Facturas ARCA) + revertir a pendiente en Cash Flow hace reset completo (anula v2 + limpia sicore/tc/descuento/**fecha_pago** + monto_a_abonar→imp_total + fecha_estimada→venc si existe). Lib `lib/sicore/resetear-retencion.ts`.
- **PENDIENTES tras el test:** merge a main · chequeo descuentos últimos 30 días (ver abajo) · Idea 1 refinamientos si aparecen · audit multi-empresa (SICORE es solo MSA).

#### ✅ Fix quincena SICORE por zona horaria (2026-07-16, commit b325555) — datos viejos NO se revisan (decisión del usuario 2026-07-17)
- **Bug corregido:** `generarQuincenaSicore` hacía `new Date("YYYY-MM-DD")` (UTC medianoche) y leía `.getDate()` en local → en Argentina (UTC−3) corría 1 día atrás. Solo afectaba la quincena cuando la fecha caía el **día 16** (→ 1ra en vez de 2da) o el **día 1** (→ 2da del mes anterior). Estaba en las 2 copias (lib `lib/sicore/quincena.ts` + local del Modal `vista-facturas-arca` ~l.3255). Fix: parsear el string directo, sin `Date`.
- **Datos viejos:** el usuario decidió **NO revisar** registros previos con fecha día 1/16 (no hace falta). Si en algún momento se quisiera: query `msa.sicore_retenciones` donde `EXTRACT(DAY FROM fecha_pago) IN (1,16)` y comparar quincena.

#### 🔴 URGENTE — Chequear descuentos NO registrados en la FC (últimos 30 días) (2026-07-15, HACER DESPUÉS del test SICORE)
- **Motivo:** bug detectado — al pagar desde **Cash Flow** con **descuento**, el descuento bajaba el saldo y se mandaba bien al registro v2 (`sicore_retenciones`), **pero NO se estampaba `descuento_aplicado` en la fila de la factura** (`comprobantes_arca`). Fix aplicado 2026-07-15 (commit 36c8e54), pero **los pagos previos pueden haber quedado con `descuento_aplicado = null` desfasado**.
- **Acción:** query BBDD sobre pagos de **últimos ~30 días** — comparar `comprobantes_arca.descuento_aplicado` vs lo que figura en `sicore_retenciones.descuento_aplicado` (o vs `monto_a_abonar` vs `imp_total − monto_sicore`) para detectar facturas donde hubo descuento pero la FC quedó en null. Revisar con el usuario antes de corregir dato (regla: no tocar datos sin preguntar).
- **Cuándo:** después de cerrar el test de SICORE en Cash Flow. Ver memoria [[project_sicore_cash_flow_estado]].

#### 🧾 SICORE — export TXT debe generar con PUNTO decimal (2026-07-13, ✅ diagnóstico cerrado · ⏳ falta cambio de código)
- **Resuelto el bloqueo**: junio no subía a ARCA ("Importe/Base/Retención debería ser Numérico Positivo"). Causa = **separador decimal**: ARCA/SICORE **9.0** importa con **Punto** por defecto y el TXT de la app usa **coma**. **CONFIRMADO por el usuario (2026-07-13)**: los archivos con **punto** (`_PUNTO`, generados con `tr ',' '.'`) subieron OK con la config en Punto. ⚠️ No es dato oficial de AFIP (diagnóstico + guías de terceros + prueba real).
- **✅ IMPLEMENTADO (2026-07-14, commit 5076f20, en `desarrollo` — falta testear)**: el **export TXT genera con punto**. **Hardcode punto**: `vista-facturas-arca.tsx` función `formatMonto` → sacado el `.replace('.', ',')` (el `toFixed(2)` ya da punto). **TESTEAR**: regenerar una quincena y comparar el TXT byte a byte contra un `_PUNTO` conocido-bueno + subir a ARCA (config en Punto). Detalle histórico del cambio exacto: Es la ÚNICA función que pone coma en el TXT y la usan las 2 ramas (quincena cerrada `~4935/4939/4943` y nueva `~4991/4995/4999`) en los 3 campos. NO tocar: Excel/PDF (usan su propio formateo es-AR, no van a ARCA), fechas (usan `/`), anchos (punto y coma = 1 char → sigue 145). **Testear**: regenerar una quincena y comparar el TXT byte a byte contra un `_PUNTO` conocido-bueno. Requiere que la config de ARCA quede en Punto (default v9.0). Detalle: KNOWLEDGE (#sicore #arca) + `memory/project_sicore_error_importacion_arca`.

#### 🧾 SICORE — hallazgos al revisar Junio 1ra para declarar (2026-06-29, A RETOMAR)
- **Junio 1ra ("26-06 - 1ra") consistente para declarar**: 6 vigentes + 2 anuladas, total ret $221.929,05. Grupo Alcorta (cert 34, 3 FC) OK: mínimo $224k aplicado una vez, ret = base × 2%. FC 6152 tiene un **descuento 5%** ($104.045,26) — el grupo y SICORE lo reflejan bien (el usuario lo dio por OK).
- 🔴 **HUECOS en la secuencia de certificados 2026: faltan cert 24 y 26** (no existen, ni anulados → se borraron antes del fix "anular en vez de borrar"). SICORE exige numeración continua → revisar/recrear como anulados antes de declarar. (Aparte: cert 31 = Alcorta FC 6115, anulado en May 2da, intercalado con junio — la FC 6115 se movió May→Jun, confirmar pago 10/06.)
- 🐞 **"Descargar comprobante" no aparece en estado `pagar`** (vista Facturas ARCA, factura del grupo Alcorta): solo da "resetear a importado". Quedó a medio investigar el panel SICORE/acciones según estado. Retomar.

#### 🧾 Módulo Ventas — importar + registrar cobros con retenciones (2026-06-30)
- **B-FEAT-VENTAS-COBROS — Importar ventas y registrar cobros (incl. retenciones que no entran a banco)** — *analizado 2026-07-01, falta definir 4 puntos*:
  - **Objetivo**: integrar DENTRO de ventas (no duplicar) y que sea **similar a compras**. Reusar `msa.comprobantes_venta` (ya tiene campos granos + factura genérica: tipo_comprobante, punto_venta, cuit_cliente, imp_total, iva, ret_iva, ret_iibb, cuenta_contable…).
  - **Dos tipos de venta**: (a) **granos** (ya hecho: `ventas` + `comprobantes_venta` con modales) · (b) **factura de venta** (como compras, importable).
  - **(1) Importar** a `comprobantes_venta`, dos vías (mismo formato): **ARCA directo** = variante de `app/api/arca/descargar-comprobantes` bajando **Emitidos** (hoy baja Recibidos=compras); **Excel** = reusar parser de `import-facturas-arca` apuntando a `comprobantes_venta`. **Poner DEBUG** para acelerar si no anda.
  - **(2) Registrar cobros** = espejo del pago de compras: `imp_total = transferencia_neta (entra al banco, concilia en extracto) + Σ retenciones sufridas (Ganancias/IVA/IIBB, NO entran al banco → se imputan a cuenta contable / crédito fiscal, fuera del extracto)`. `comprobantes_venta` hoy NO tiene ciclo de cobro (no hay `estado`/`medio_pago`) → agregarlo espejando `comprobantes_arca`.
  - **DISEÑO CONFIRMADO (2026-07-01, definitivo)**: (i) **`msa.retenciones_recibidas`** = tabla tipo SICORE (la tabla ES el registro, no hace falta template aparte); cada tipo (IVA/IIBB/Ganancias) → su cuenta contable (default por tipo al cargar). Se puede cargar ANTES de la factura (con CUIT) → queda pendiente y se vincula por CUIT al importar la factura. (ii) **NO hay tabla de cobros**: el cobro = **extracto (transferencias) + retenciones_recibidas**, ambos contra la factura; factura `cobrado` cuando `Σ transferencias + Σ retenciones = imp_total`. (iii) el flujo aplica **igual a granos y facturas** (los granos TAMPOCO se dan por cobrados solos). (iv) **N:N**: 1:1, varios cobros por factura (parcial), o grupo de liquidaciones con varios cobros. (v) al importar **pide fecha de cobro** → Cash Flow muestra `imp_total − retenciones` como a cobrar. (vi) **indicador "ventas pendientes de vincular/conciliar" SEPARADO de compras** en la página principal.
  - **REUSO (no duplicar)**: el motor `useMotorConciliacion.ts` YA maneja ingresos (`creditos>0`, l.325) con ramas por `origen`; el cash flow `useMultiCashFlowData.ts` YA soporta `creditos` con `origen`. → se agrega **origen `VENTA`** (no un motor nuevo). Hoy NO hay conciliación/cashflow de ventas (los modales solo hacen CRUD) → no se pisa nada.
  - **✅ CASO SIMPLE COMPLETO (2026-07-01/02)**: (1) BD base; (2) import fac venta `/api/import-ventas` (Excel/CSV + **descarga directa ARCA Emitidos** en el modal, DEBUG abundante, mapeo verificado contra Excel real de ARCA); (3) origen VENTA en cash flow (`imp_total − retenciones`, incluye a cobrar/cobrado, excluye conciliado); (4) rama VENTA en el motor (conciliación igual que compras, link `msa_galicia.comprobante_venta_id`); (5) UI retenciones (`ModalRetencionesVenta`, tipo→cuenta con default) + vínculo por CUIT al importar; (6) card "Alertas de Ventas" en `VistaPrincipal` separada de compras. Commits 3eda5a9…7d6aed9. **PENDIENTE: testear con datos reales.**
  - **✅ Control Cobros (2026-07-02, commit 989bc03)**: tab **"Cobros MSA"** en Ingresos (`vista-cobros-venta.tsx`): por factura → total vs cobrado (transferencias del extracto por `comprobante_venta_id`) vs retenciones vs **saldo**, con detalle expandible + totales. FC/liq contra cobro con control de saldo.
  - **✅ Control Venta↔Factura↔Cobro COMPLETO (2026-07-02)**: eslabón **Factura↔Cobro** = tab "Cobros MSA" (saldo, commit 989bc03); eslabón **Venta↔Factura** = columna "Control fact." en Ventas MSA (`vista-ventas-msa.tsx`, commit 75d82ee): compara toneladas + imp_total de las facturas vinculadas (`ventas_comprobantes`) contra lo pactado → badge cuadra/revisar/sin facturar. Las 3 partes (pactar→facturar→cobrar) tienen control.
  - **⏳ Fase 2 (NO hecho)**: caso complejo **cuenta corriente / compensación** (AFA: venta granos ↔ compra insumos, cobrar saldo neto).
- **B-FEAT-VENTAS-EDIT-LOCK — Reglas de edición/bloqueo de comprobantes de venta (2026-07-03)**: ni liquidaciones ni facturas deben editarse si están bien cargadas; solo se editan si se cargaron mal. **(a) Facturas de venta**: los **montos NO se editan** (se importan de AFIP, igual que compras) → en el modal van en solo lectura; se edita solo la **imputación** (cuenta contable / centro de costo, que la asigna el usuario, no viene de AFIP). **(b) Liquidaciones de granos**: se cargan a mano → pueden cargarse mal → editables/eliminables, PERO debe haber un momento en que se **bloqueen**: **una vez declarado el subdiario ventas, no se editan más** (+ **advertencia al intentar editar**). Necesita el estado "subdiario ventas declarado" (a DEFINIR, análogo a SICORE quincena declarada). Motivo: consistencia contable — no cambiar lo ya declarado. (Parte inmediata — facturas montos read-only — va en la Opción A del modal unificado; el bloqueo por declaración es lo pendiente.)
- **⭐ B-FEAT-RENOVAR-CAMPAÑA — Replicar templates/cuotas para la nueva campaña (2026-07-03, URGENTE)**: la campaña 2025/2026 cerró el 30/6. Muchos templates (sobre todo `tipo_template='fijo'`: seguros, impuestos mensuales, cargas sociales, IIBB, SICORE) tienen su **última cuota en jun/jul 2026** y hay que **generar las cuotas de la campaña nueva** (2026/2027) o el usuario pierde de vista los vencimientos. **HOY NO EXISTE** un sistema para esto (verificado en código + PENDIENTES). **Propuesta:** feature "Renovar campaña" — seleccionar templates → generar el próximo lote de cuotas copiando el cronograma/importes del período anterior (fechas corridas al nuevo período), con revisión antes de confirmar. Los `abierto` (comisiones bancarias, Caja, etc.) se cargan solos vía conciliación/manual, no necesitan renovación programada. **Interino:** se pueden generar las cuotas de los `fijo` por SQL en bloque si el usuario da el cronograma (importes + frecuencia 2026/2027).
  - **Templates `fijo` a renovar (última cuota jun/jul 2026):** Seguro Accidentes de Trabajo (05/06), Seguro Flota (05/06), UATRE (05/06), SICORE 1ra Quincena (30/06), Tarjeta Visa Business MSA (05/07), Cargas Sociales (09/07), SICORE 2da Quincena (13/07), IIBB Mensual MSA (15/07), Acciones y Participaciones (30/07), Imp. Ganancias / Bs Pers PAM (30/07).
  - **Templates `abierto` (NO necesitan renovación programada — se cargan por conciliación/manual):** Comision Cuenta Bancaria, Créditos Pagados, Sellos Bancario, Retiro PAM, Fondo Educativo, Comision Extraccion Efectivo, Comision Transferencias, Debitos/Creditos, FIMA Premium Galicia, Iva Bancario, Percepcion IVA, Caja, Otros Gastos, Retiros semestrales (Andres/Jose/Manuel/Mechi/Soledad).
  - **Observación:** consultar con SQL `MAX(fecha_estimada)` por template de `cuotas_egresos_sin_factura` para el listado al día. Los `fijo` son los urgentes (cronograma que se corta).
  - **📋 GENERADOR DE REGENERACIÓN — diseño acordado (2026-07-18):**
    - **✅ HECHO — campos nuevos** en `public.egresos_sin_factura` (NO en backup, ver RECONSTRUCCION): **`periodicidad`** ('anual' calendario | 'bianual' campaña jul-jun, explícito en vez de inferir del string `año`) + **`aplica_generacion`** (bool, entra a la regeneración automática, **independiente** de fijo/abierto). Sembrados: bianuales con decisión exacta del usuario (9 MSA fijo + Tarjeta Visa Business MSA = true; Caja + 2 Interbancarias = false); **anuales = NULL** (a decidir en el generador, caso por caso). **Wizard ya captura ambos** (arma `año` según periodicidad).
        - **✅ 2026-08-22 — anuales sembrados, quedan 0 en `NULL`.** El `NULL` mostraba los **160 anuales en "No aplican"** y hacía ver el generador como roto. Criterio = la definición del campo: `abierto → false` (53: se llenan en vivo por conciliación) · `fijo → true` (101: tienen boleta con vencimiento). Los 6 ya decididos no se tocaron. Es punto de partida, no sentencia: se corrige con el opt-in ↑ / opt-out ↓ y persiste. Detalle → `MODULO_TEMPLATES.md` § 13.
    - **Corrección conceptual del usuario:** abierto/cerrado (fijo) **nunca fue tema de monto** sino de *cuotas preestablecidas vs generadas en vivo contra conciliación*. `aplica_generacion` resuelve los abiertos-con-cronograma (Tarjeta) sin depender de esa etiqueta.
    - **Decisiones bianuales (26/27):** MSA fijo (9) = regeneran. **Acciones y Participaciones**: el usuario crea manual la cuota `25/26` (jul-2027, +1 año de la actual jul-2026) para que al generar 26/27 caiga en 2028 → pendiente consulta contable (pagos a campaña vencida). **Caja** = sin cuotas. **Interbancarias** = que el generador **pregunte/opt-in**. **Tarjeta Visa Business MSA** = regenera con **monto estimado**.
    - **DATA es IRREGULAR** (verificado): montos variables (Cargas Sociales 7 distintos), algunos en 0 (Anticipo Ganancias), cadencias mixtas (1/10/12 cuotas), y cantidades que no cierran (Seguro Accidentes/UATRE tienen 15 cuotas, UATRE arranca ene-2025 fuera de campaña; el campo `cuotas` del template ≠ cuotas reales). → **un "correr fechas +1 año y copiar monto" NO alcanza.**
    - **✅ GENERADOR v1 HECHO (2026-07-18, sin testear):** `components/generador-renovacion-campana.tsx` + botón "Renovar campaña" en `vista-templates-egresos.tsx`. **General** (bianual jul-jun / anual calendario), **Modelo A** (clona fila con año target + cuotas), **columnas dinámicas** (mín 12 + spillover), **pre-carga** corriendo el último período de cada template al target (`yearShift = targetY1 − sourceY1`, por eso Acciones 24/25→2028 solo), **editable**, **2 secciones colapsables** (Previstas aplica=true / No aplican con opt-in que persiste `aplica_generacion`), **descripción** rearmada con mes/año nuevo. **FALTA TESTEAR en bianual** + iterar detalles (ver abajo). Pensado para extenderse.
    - **✅ Iteración 2026-07-18 (commit 8f77036):** botón **Vaciar fila** (deja en cero; mitiga UATRE) + **Replicar** (primer monto → 12 meses base) + **fechas: preserva el día real** de la cuota origen (antes día 1; shift solo el año).
    - **🔴 REGISTRO DE LOS 7 PUNTOS (2026-07-18/19, preguntas usuario + respuestas + estado; ver memoria [[project_generador_renovacion_templates]]):**
      1. **Deseleccionar previstas — ✅ HECHO (2026-07-19):** checkbox por fila en "Previstas" (toggle `incluir`, temporal, NO toca `aplica_generacion`). Fila excluida se ve gris y no se genera.
      2. **Template que NO genera igual presente en la campaña nueva — ✅ RESUELTO:** el selector de abiertos (Pago Manual, `vista-cash-flow.tsx:1260`) filtra por `tipo_template='abierto'`+`activo=true`, **NO por `año`** → los abiertos **persisten entre años solos**, no hay que renovarlos. **Corrección del usuario (✅ HECHO 2026-07-19):** si deselecciona un template **previsto**, al **Confirmar/Generar** la app **avisa** (window.confirm listando los deseleccionados) antes de proceder. (NO se crea fila vacía para fijos deseleccionados — no sirve.)
      3. **Fechas visibles/editables — ✅ HECHO (2026-07-19):** cada celda con monto muestra un mini-input **"día"** editable (`setDia`). Editar el día NO cambia de columna; para mover de mes = vaciar y poner en el mes destino.
      4. **Varias cuotas por mes — ✅ HECHO completo (2026-07-19):** (fase 1) display suma + anillo naranja + badge "Σn" + tooltip; genera 1 cuota. (fase 2) **botón "detalle" por fila** (ícono lista): modal que edita las **cuotas individuales** (mes/día/monto, permite VARIAS por mes, agregar/quitar). Si la fila tiene detalle, **GANA** sobre la matriz al generar (badge "detalle" en la fila). `Fila.raw` (cuotas individuales corridas) + `Fila.detalle` (override). NO se reusó el wizard.
      **Vencimiento (idea del usuario, ✅ HECHO 2026-07-19):** checkbox **"venc"** por fila → si está tildado, las cuotas se generan con `fecha_vencimiento` = la fecha (sino solo `fecha_estimada`). Default por fila = `tipo_fecha` del origen.
      5. **UATRE — ✅ RESUELTO (2026-07-19):** eran 6 cuotas ene–jun 2025, monto 0, estado `conciliado` **huérfano** (0 referencias en `template_cuota_id` de msa_galicia/caja/tarjeta). **Borradas** con OK del usuario. Ya no propone esos ceros en 2026.
      6. **~~Replicar a meses puntuales~~ — DESCARTADO (2026-07-19):** sobre-interpretación; el usuario no lo pidió y no aporta. Replicar (12 base) + edición manual alcanza.
      7. **Guardarraíl → ✅ HECHO como ADVERTENCIA, no restricción (2026-07-19):** el usuario aclaró que **nada se pisa** (Modelo A = templates y cuotas distintas, no hay overwrite) y que **no quiere limitar** (un template puede legítimamente empezar a pagarse antes). Entonces: las columnas **anteriores al inicio del período** se **marcan en ámbar (⚠) + banner de aviso**, pero **NO se bloquean** (UATRE se ve pero se puede vaciar/ignorar). Detalles aún abiertos: `fecha_vencimiento` no se setea · fila vieja NO se desactiva · master reusado · Acciones shift +2 → 2028 (¿falta 25/26 intermedia? = consulta contable) · Interbancarias opt-in.
    - **Pendiente arquitectónico menor:** revisar si el eje `tipo_template` (fijo/abierto) queda redundante con `aplica_generacion` una vez estabilizado.
  - **⚠️ Verificar la `descripcion` de cada cuota al regenerar (2026-07-04):** al generar cuotas, el wizard arma `cuota.descripcion` con la fórmula `nombre_referencia + " " + responsable + " - " + mes + " " + año` (`wizard-templates-egresos.tsx` l.168; anual sin mes, l.178). Ej.: "Aportes Domesticas MA - Diciembre 2026". **Esa `descripcion` es la que viaja al `detalle` del movimiento bancario al conciliar** (`useMultiCashFlowData` → `detalle_usuario` → `useMotorConciliacion` l.508). Por eso el generador de campaña nueva **debe reproducir esta fórmula** con el período/año nuevo (mes correcto por cuota, año de la campaña) — sino las cuotas nuevas quedan sin descripción o con el período viejo, y el extracto conciliado pierde la etiqueta. Revisar bien este armado en el momento de construir la renovación.
  - **📋 AUDIT SUELDOS para campaña nueva (2026-07-17) — inventario = SOLO Sueldos + Templates** (productivo va aparte/operativo; `comprobantes_arca.campana` NULL/sin uso). **Lo que YA existe:** `crearCampana` (`tab-sueldos.tsx` ~712-811) crea la campaña + genera períodos mensuales (Jul→Jun) de los empleados con `activo=true`, copiando params del ÚLTIMO período y calculando bruto por `tipo_empleado`; desactiva la campaña anterior. `darDeBaja` (~830) setea SOLO `fecha_egreso`. `crearEmpleado` (~875) guarda el promedio según tipo. **Diseño acordado con el usuario (a programar):**
    1. **Campaña = derivada del mes, NO switch.** ✅ **HECHO (2026-07-18, sin testear):** **LOCK de "mes de trabajo"** en `sueldos.config` (tabla 1 fila + vista `public.sueldos_config`, NO en backup → ver RECONSTRUCCION). Al entrar posiciona en el mes de trabajo (badge verde 🔒); otros meses en **solo lectura** (lápiz/Registrar Anticipo/editar-eliminar pago deshabilitados + guardas en las funciones); botón **"Trabajar en este mes"** mueve el lock (`moverLock`). **Rango de navegación = UNIÓN de todas las campañas** (no solo la activa) → junio 25/26 + julio 26/27 conviven. NO hace falta selector de campaña ni activar/desactivar. `tab-sueldos.tsx`.
    2. **Todo por FECHAS (ingreso/egreso), no por flag `activo`.** El flag es redundante y hoy `crearCampana` filtra por él (debería filtrar por fechas). Baja = poner `fecha_egreso`; los períodos viejos NUNCA se borran (son la verdad de lo cobrado). Coria/Pucheta quedaron `activo=true` con egreso 2026-01-31 (baja a medias) → limpiar con OK del usuario.
    3. **Eventuales (Fabian Vulcano) — DECIDIDO: Opción A (2026-07-17):** un solo par `desde/hasta` que se **pisa** al volver (re-alta = actualizar desde/hasta al nuevo tramo). **Convención acordada:** lo ÚNICO que cambia es `desde/hasta`; **los PERÍODOS del empleado perduran** (verdad de lo cobrado, nunca se borran). `desde/hasta` = "tramo vigente", sirve solo para **GENERAR** los períodos de la campaña. ⚠️ **Al implementar:** ver/editar un mes debe depender de que el **período EXISTA**, NO re-filtrar por `desde/hasta` (sino los tramos viejos desaparecen tras la re-alta). (Opción B = tabla `empleado_tramos` descartada por ahora; retomar solo si los eventuales se vuelven frecuentes.)
    4. **Alta pide tipo + montos iniciales + promedio y los propaga.** ✅ **HECHO (2026-07-18):** `crearEmpleado` ya captura el promedio; y ahora genera los períodos **por FECHA DE ALTA** (recorre `todasCampanas` según ingreso/egreso, campana_id de cada una), **no** por la campaña activa. (Empleado nuevo sin período previo: se cargan los montos en el alta.)
    5. **Al crear campaña: revisión empleado por empleado.** ✅ **HECHO (2026-07-18):** al confirmar la campaña se abre una **tabla de revisión** (`modalRevisionCampana`, primer mes = julio) con todos los vigentes; el lápiz reusa el **modal de edición mensual** (`abrirEdicion(p, forzar=true)` para saltear el lock) → editás el fijo y al **propagar hacia adelante** se aplica a toda la campaña. Genera propagando solo lo **fijo**; lo **móvil** (días/horas/francos) queda EN BLANCO. **Decisión del usuario: SIN % masivo** (se edita uno por uno, propone el último mes). El campo `empleado.*_promedio` queda para el presupuesto futuro (punto 7).
    5b. **Check "Activar" al crear campaña: ELIMINADO (2026-07-18).** La campaña nueva **siempre queda activa** (desactiva la anterior). `activa` = solo rótulo del header (la navegación es por unión). Pendiente menor (opcional): toggle activar/desactivar en la lista de campañas si alguna vez hace falta reactivar una vieja.
    6. **`sueldos.componentes_salario` = tabla MUERTA** (verificado: el código NO la lee; el sueldo sale del último período). Hay tabla `sueldos.componentes_salario` + probable vista `public.sueldos_componentes_salario`. **A hacer: verificar que no haya dependencias y DROPEAR (vista + tabla).** No borrar sin chequear que no rompa nada.
    7. **`empleado.dias_promedio/horas_promedio/francos_dias_promedio`** (`sueldos.empleados`): HOY se ESCRIBEN en el alta pero NO se LEEN en ningún cálculo (capturados/dormidos). Valores: Fabian 22 días, Elvio 16, AMS 45 hs, Ruben 5 francos, Wilson 4. **Es el "valor típico" para PRESUPUESTAR** (los francos "que más o menos siempre son así") → cuando se haga el presupuesto, proyectar con ESTOS campos, sin ensuciar los períodos reales.
    8. **Aguinaldos** (`periodos.aguinaldo_a/b`) se cargan a mano, sin cálculo (dic-2026 / jun-2027). No desarrollado.
    9. **Adelanto julio 2026:** el período julio no existía (25/26 cierra en junio) → el usuario NO lo cargó por falta de habilitación. Al crear la campaña nueva debe poder cargarse (el pago referencia un `periodo_id`).
    10. **Cambio en el "propagar" (a hacer cuando se toque esto):** hoy al editar **francos** (dato móvil) pregunta si propagar → debería preguntar SOLO al cambiar el **sueldo fijo** (que es un aumento y sí aplica a futuro); los móviles no se propagan.
- **⏸️ B-FEAT-BASE-OPERATIVA — Dónde se gestionan los pagos: Modal de Pagos vs Cash Flow (2026-07-05, DECISIÓN PENDIENTE)**: el usuario gestiona el ~90% desde el **Modal de Pagos** (botón "Pagos" en Facturas); antes usaba el **Cash Flow** y quiere volver a él como **panel único**, mejorándolo para reemplazar al Modal. Propuesta usuario: Cash Flow default "operativo" = desde hoy + todo lo impago (nunca conciliado) + filtros/chips → deprecar el Modal. Propuesta Claude: mejorar columnas del Modal (roles fijos + color). **Ambas conservadas en `MANUAL-USO.md` § Pagos/Egresos → evaluar juntas antes de tocar código.** NO tocar pagos hasta decidir. **Mapa de edición (4 lugares + Modo Pagos + Pago Manual) y estrategia de centralización en `MANUAL-USO.md`** (resumen: potenciar Cash Flow + BORRAR el Modal; grillas = limpieza posterior). ⚠️ Avisos: (a) las grillas tienen código propio → features nuevas (ej. `fecha_pago`) no aparecen ahí salvo que se agreguen explícitamente (no darlas por hechas); (b) el "Modo Pagos" del Cash Flow es mismo código, estudiar al final si se usa. **Plan por etapas E0-E6 + inventario de funciones → todo en `MANUAL-USO.md` § Pagos.** **ACTUALIZADO 2026-07-15:** la registración SICORE **v2 YA está en el Cash Flow** (usa `lib/sicore/registrar-retencion.ts` compartido; E3 grueso + E4 hechos) — la nota vieja "Cash Flow solo hace v1" quedó obsoleta. Quedan **gaps de paridad** vs el Modal (ver MANUAL-USO § SICORE + memoria [[project_sicore_cash_flow_estado]]); el **#1 (guarda estado_quincena antes de estampar)** se está arreglando 2026-07-15. Gestión SICORE queda en la vista ARCA.
- **B-FEAT-OTROS-INGRESOS — Template de ingresos sin factura/liquidación (símil "Otros Gastos") (2026-07-03)**: para registrar **cobros de ventas que solo tienen contrato** (no liquidación ni factura ARCA) — se imputan como ingreso a "Otros Ingresos" y fluyen por Cash Flow + conciliación, igual que "Otros Gastos" pero del lado del ingreso.
  - **Ya soportado:** el sistema de templates maneja ingresos vía `es_bidireccional=true` + cuota `tipo_movimiento='ingreso'` → entra como **crédito** en el cash flow (`useMultiCashFlowData` l.227/243-244). El botón **Pago Manual ya deja elegir ingreso/egreso** si el template es bidireccional (`vista-cash-flow` l.1043).
  - **✅ RESUELTO (2026-07-03, commit pendiente):** se destrabó el cruce — el wizard ya **permite multi_cuenta + bidireccional a la vez** (`wizard-templates-egresos`: sacado el force en el save l.293 y en el onCheckedChange del checkbox). **Pago Manual ya soportaba la combinación** (el selector Egreso/Ingreso se muestra por `es_bidireccional` l.2644 y la sub-categoría por `es_multi_cuenta` l.2714 — independientes; el guardado maneja ambos l.1043-1044). **Ahora: crear "Otros Ingresos" en el wizard con tipo Abierto + Multi-cuenta + Bidireccional → cobros con sub-cuentas, símil "Otros Gastos".**
  - **Recomendación:** template **separado** "Otros Ingresos" (no reusar "Otros Gastos" — claridad semántica, cuenta contable de ingreso, reportes). Crear vía wizard Templates.
  - **Sub-tema — medio de cobro (caja / cheques):** por defecto el ingreso concilia contra el **extracto bancario**. Falta definir/verificar cómo rutear un cobro a **caja** (`caja_sigot`) o **cheques** (`echeq`) en vez de banco. A detallar.
- **B-BUG-PAGOMANUAL-TAB-ENTER — Tab+Enter en Pago Manual activa el toggle solo_conciliación (2026-07-03)**: en el modal Pago Manual (`vista-cash-flow.tsx`), al buscar un template y hacer **Tab + Enter**, el foco cae sobre el botón toggle de `solo_conciliacion` (`toggleSoloConciliacion`, l.1000) y lo **activa sin querer** → el template pasa a `solo_conciliacion=true` (se guarda en BD) y **desaparece de la lista principal** (va a la sección "Solo conciliación bancaria"). Le pasó al usuario con "Otros Gastos". **Fix:** que Enter dispare "Siguiente"/seleccionar (no el toggle); sacar el toggle del tab-order o requerir clic explícito. **Data a revertir (si el user confirma):** `UPDATE egresos_sin_factura SET solo_conciliacion=false WHERE id='995537c7-91c0-4c7c-8fe3-3df0d5469944'` ("Otros Gastos").
- **B-FEAT-VENTAS-FACTURA-VINCULAR — Vincular factura de venta a una venta pactada (2026-07-03)**: en el modal Opción A, las **facturas** ocultan la sección "13. Ventas vinculadas" (el guardar de factura solo persiste imputación, no la vinculación). Falta permitir vincular una factura de venta a una `ventas` (N:N `ventas_comprobantes`) si aplica. Menor / a futuro.

- **B-BUG-SELECTOR-NO-COLAPSA — Los selectores custom no se cierran al elegir (2026-07-03)**: `SelectorCuentaContable` (`components/ui/selector-cuenta-contable.tsx`) y otros selectores custom están hechos como **lista SIEMPRE abierta** que **NO colapsa al elegir**: el usuario clickea una opción, se selecciona por dentro (onSelect dispara) pero **no hay confirmación visible** (la lista queda abierta, el input sigue mostrando la búsqueda) → se percibe como "aprieto y no pasa nada". Lo esperado: al elegir, **se cierra y muestra el valor elegido**. En `SelectorCuentaContable` el modo default es `'dropdown'` pero `handleSelect` (l.247) solo llama `onSelect` sin cerrar. **Fix general (RIESGOSO, componente compartido en muchas pantallas):** que en modo `dropdown` el componente tenga `isOpen`, muestre el label del `value` cuando está cerrado, abra al focus y **cierre al elegir** (dejar `inline`/`modal-list` como están). **Fix por-instancia (BAJO riesgo):** envolver el selector para mostrar el valor + botón "Cambiar" y ocultar la lista tras elegir (hecho así en `ModalRetencionesVenta`, commit 6c0ad55). **✅ RESUELTO a nivel componente (2026-07-03):** `SelectorCuentaContable` en modo `dropdown` ahora arranca **colapsado** (isOpen=false), abre al **click**, cierra al elegir/blur, muestra el `value` seleccionado cuando está cerrado, y el desplegable va **absolute/z-50** (flota, no empuje). `inline`/`modal-list` quedan siempre abiertos (sin cambio). Verificado: los ~10 usos usan el default → todos arreglados de una (retenciones, editar comprobante, cash flow pago manual, extracto, facturas ARCA…). **Pendiente residual:** revisar los OTROS componentes selector (ProveedorCombobox, CentroCostoCombobox, CategCombobox) si el usuario reporta el mismo patrón en ellos.

- **B-FEAT-LIQ-VALORES-ABSOLUTOS — Liquidaciones: congelar los valores al confirmar (no cálculos en vivo) (2026-07-02)**: hoy la liquidación de granos **calcula al vuelo** (ton×precio, %retenciones, deducciones → totalOp/importeNeto/pagoCond NO persistidos; ver [[ventas-msa]] "cálculos al vuelo NO persistidos"). **Motivo del usuario:** el dato de la liquidación es **ABSOLUTO** — lo que hay que imputar es **lo que dice la liquidación real, aunque esté mal calculado** (si está mal, se reclama y se pide Nota de Crédito, no se corrige el número). El cálculo sirve como **ayuda de carga + auditoría** (cargás ton/precio/factor/grado y el % de cada retención/descuento, y debe **coincidir** con la liquidación). **Propuesta:** que la carga funcione como hoy (autocalcula), pero **al CONFIRMAR se persistan los valores (congelados)** para asegurar el dato; y que el cálculo pase a mostrar el **ERROR = diferencia (calculado − cargado), que debe dar CERO** como control de que la liquidación está bien. Aplica también a las facturas de venta (el dato importado es absoluto). Abordar llegado el caso.
  - **SUB-TAREA aparte (para DESPUÉS del registro)**: pantalla de **consulta/reportes en Ventas** — ver la relación **ventas ↔ facturas/liquidaciones ↔ cobros** (query). Es consulta/control, no registro. No dejar aislado de la conciliación existente.
  - Ver memoria [[ventas-msa]] (⚠️ tablas reales hoy: `msa.ventas` / `msa.comprobantes_venta` / `msa.ventas_comprobantes` — la memoria dice "liquidaciones_venta", renombrado).

#### 💼 Sueldos — el alta/edición de empleado debe capturar los datos del export (2026-06-30)
- **B-FEAT-EMPLEADO-EXPORT — Cargar requisitos de export al crear el empleado**: al crear/editar un empleado debe poder cargarse TODO lo que el export Galicia necesita: **cuenta(s) bancaria(s)** con **alias/CBU real**, **`grupo_export`** (a qué archivo Excel va) y **`concepto`** (motivo, ej. Honorarios). **Problema a evitar:** crear el empleado y después NO poder sacarle el pago por faltar esos requisitos de arquitectura. **Hoy** eso se carga *inline en el modal de export* (workaround que ya funciona), pero el modal **no debería** mostrar la config de grupos (es demasiado para ese contexto). **Mejora:** mover ese ABM a la pantalla de empleados (gestión de `cuentas_empleado` con alias/grupo/concepto), y dejar el modal de export solo para validar/completar excepciones. Detalle del mecanismo en memoria [[export-sueldos-galicia-grupos]] + ver `sueldos.cuentas_empleado` (cols `grupo_export`, `concepto`).

---
*(Lo de abajo es el estado de la primera tanda 2026-06-27 — sigue válido como base, las versiones posteriores lo extienden.)*

✅ **IMPLEMENTADO (commits `4f7f617`/`70dad84`/`9717207`, falta TESTEAR):**
1. ✅ **Catch-all reenvíos** — `from:(recolectores) subject:"Documento de Jose"` (normalizado sin may/tildes) PRIMERO + proveedor directo. Jose taggeado `recolector` en BBDD; la app lee y pasa los mails.
2. ✅ **Etiquetar `Facturas Descargadas` + marcar leído** en match exacto (NO mueve). Sin match → intacto.
3. ✅ **Mail resumen** a sanmanuel (acción GAS `enviarResumenMail` + endpoint `/api/gas/enviar-resumen` + el cliente junta resultados): descargadas + a revisar + cuerpos, por empresa.
4. ✅ **Dudosos → `_Revisar` por mes** (decidido) + incluidos en el resumen.
5. 🟡 **Fecha**: default **30 días** ✅; el control por **UI de lote** (buscar más viejo) queda pendiente (menor).
6. ✅ **Scopes GAS** ampliados a `gmail.modify` + `gmail.send` (para etiquetar/leído/enviar).

⚠️ **Para activar (usuario):** re-pegar `Main.gs` + `appsscript.json` en el GAS → redeploy **versión nueva** → **re-autorizar** (nuevos permisos Gmail) → probar en preview de `desarrollo` (env vars cubren Preview).

**Pendiente todavía:** UI de fecha por lote · **A-BUG-10** (`'No'` se busca igual — decisión) · **A-FEAT-05** (re-encolar a `'Buscar'` por UI) · auto-disparo post-import (gated OFF).

**Configurado 2026-06-27:** asunto **por-recolector** (`proveedores.patron_asunto`): Jose "Documento de Jose", **Andrés** (`mailandres.12`, cuit 20287492546) "FC" (+ tag recolector). Falta solo que Andrés opere reenviando con "FC" en el asunto. · **PAM Importar-desde-ARCA habilitado** (commit `d438a56`) — requiere env `ARCA_CUIT_EMPRESA_PAM=20044390222` en Vercel.

**💡 Mejoras detectadas en testing (2026-06-27):**
1. ✅ **IMPLEMENTADO (v0.3.0, commit `77fdf5b`, falta testear)** — Adjuntos no-PDF (foto de WhatsApp): búsqueda `has:attachment` (PDF + imágenes), OCR de imágenes vía Google Doc (valida CUIT/número como un PDF), y **soft-match**: si nada valida pero el asunto nombra al proveedor (palabra ≥4 letras) → `revisar` + archiva en `_Revisar`. Falta: re-pegar Main.gs + redeploy versión nueva (scopes ya OK) + probar el caso Luminatus.
2. **Proveedor sin mail → carga orgánica (Propuesta 2, PENDIENTE).** Al buscar una FC cuyo proveedor no tiene mail: **avisar** ("Proveedor X sin mail"), **mostrar remitentes vistos en el período** (el GAS los devuelve como candidatos), **pedir + guardar** el mail elegido en `proveedores` (email + `gas_habilitado`). Se completa el padrón a medida que se busca, sin cargar todo de antemano. Conecta con el pendiente "carga orgánica" en [[proveedores-pendientes-post-implementaci-n]].

### 🔎 A-FEAT-AUDIT — Auditoría del registro digital (✅ IMPLEMENTADO 2026-06-27, falta testear)
**Commits:** `93c6752` (GAS acción `auditar` v0.7.0) · `aafb51c` (endpoint `/api/gas/auditar-periodo`) · `914afd5` (UI modal + botón "Auditar período"). **Activar:** re-pegar `Main.gs` → redeploy versión nueva (`/exec`=0.7.0) → probar en preview de `desarrollo`.
**✅ Resuelto después:** **"Confirmar VER"** (commit `a2a63be`, GAS v0.8.0 — botón ✓ en grilla, mueve de `_Revisar` + link). · **Audit resumible por tandas** (commit `5607757`, GAS v0.9.0 — procesa ≤10 archivos/request, commit incremental, idempotente; el modal loopea hasta completo → ya NO corta por los 60s). · **Propuesta 2 mínima** (commit `b2e7b20` — avisa proveedor sin mail en el resultado; el alta se hace en Config PDFs).
**Falta (menor):** nuance **emisión vs contable** del folder (si auto-archivás por emisión y el período contable difiere, puede dar "sin PDF" — confirmar cómo organiza el usuario las carpetas).


**Problema:** períodos viejos tienen facturas en estado "Sí" pero **sin link** (PDFs cargados a mano), y no hay garantía de que el archivo digital esté completo/ordenado.

**Qué hace:** input = **empresa + período contable** (`año_contable`+`mes_contable`). Va a `<empresa>/<campaña>/<aa-mm>/` en Drive, **OCR-ea cada PDF** (reusa `extraerTextoPdf`), extrae CUIT+número, y cruza contra las facturas del período:
- PDF que matchea una factura **sin link** → le **agrega el link** (resuelve períodos viejos).
- Factura con link → **verifica** que el archivo exista.
- Factura "Sí" **sin PDF** → ⚠️ incongruencia. · PDF **sin factura** → ⚠️ huérfano.
- **Informe** + permite **cambiar estados** post-relevamiento.

**Decisiones (acordadas):**
1. Matcheo por **OCR** (anda con PDFs viejos de nombre arbitrario). Volumen chico (≤30/período) → dosificar 1-2 períodos/día por quota.
2. **Sin tabla nueva en la app.** Resultados (links/estados) quedan en las facturas; **el "datado" del audit = archivo `_AUDIT_<fecha>.txt` en la carpeta del mes** + **mail resumen** (reusa mecanismo). Si luego se quiere historial in-app, evaluar tablita.
3. **"Confirmar VER"**: botón en la grilla (y el audit lo usa internamente) que pone FC=Sí + **mueve** el PDF de `_Revisar/` a la carpeta del mes + deja el link. Mover **archivo** es seguro (la regla es no destruir **carpetas**).

---

## <a id="a-test-03"></a>A-TEST-03 — Módulo ARCA (Mis Comprobantes)

**Estado:** implementado en `desarrollo` (74dc665, 2c96f72, f399a5d), no en main.

Incluye: `lib/arca/` (http/login/descargar), endpoint `app/api/arca/descargar-comprobantes/route.ts` (admin, recibe password en body, NO lo persiste), modal "Importar desde ARCA" con password obligatorio, tabla `arca_descargas_log` (aplicada), botón "Importar FC ▼".

**Activar:** env vars Vercel (Production + Preview):
- `ARCA_CUIT_PERSONAL = 23342147739`
- `ARCA_CUIT_EMPRESA_MSA = 30617786016`
- `ARCA_CUIT_PERSONAL_MA = 27066824611`
- ⚠️ NO van `ARCA_PASSWORD_*` (la clave se pide por modal).

Probar end-to-end en preview de `desarrollo`, después mergear.
**Futuro:** atajos de fecha extra · comprobantes Emitidos · histórico de descargas · reintentos. Si ARCA cambia formato → ajustar selectores de `lib/arca/`. Detalle: `memory/project_arca_poc.md`.

---

## <a id="a-test-04"></a>A-TEST-04 — SICORE estado_quincena + anulación (2026-06-15/16)

**Por qué se hizo.** El Reset de retenciones hacía `.delete()` y dejaba **huecos en la numeración perpetua** (`nro_comprobante`/`nro_certificado`): saltos tipo 23, 25, 27 (faltaban 24, 26). Además casos como Garmendia (pago 8/06 pero quincena `26-05 - 1ra` por `fecha_vencimiento` mal) y Alcorta cert 31 (FC del 31/05 mal asignada por pago grupal con fechas distintas) pedían herramientas más prolijas.

**Cambios (en `desarrollo`):**
1. **Migración BD** (aplicada en prod, NO en backup): `sicore_retenciones` + `anulado`, `fecha_anulacion`, `motivo_anulacion`, `estado_quincena VARCHAR CHECK (abierta|cerrada|declarada) DEFAULT 'abierta'`, `fecha_cerrada`, `fecha_declarada`. Migración de datos: `ddjj_confirmada=true` → `estado_quincena='declarada'`.
2. **Anulación en vez de DELETE** (`resetearFactura`/`resetearAnticipo`): `.update({anulado:true, …})` conserva los números → cronología sin huecos.
3. **3 estados de quincena**: `abierta` (libre) · `cerrada` (TXT generado, modificar pide confirm "regenerar TXT") · `declarada` (DDJJ confirmada, bloqueado).
4. **Modal "Generar Export v2"**: "Solo descargar" / "Descargar y cerrar" (este marca todo `cerrada` + `fecha_cerrada`).
5. **Validaciones**: `evaluarRetencionSicore`/`confirmarSicoreAnt` chequean estado ANTES (declarada→bloquea; cerrada→confirm). `registrarEnSicoreRetenciones` filtra anulados en la búsqueda de grupo (cuit+tipo+quincena).
6. **UI TablaRegistrosV2**: filas anuladas tachadas + badge "ANULADO" + tooltip; toggle "Mostrar anulados"; banner por estado (🟢/📤/🔒).
7. **Fixes**: stale closure del checkbox "Mostrar anulados" (`incluirAnuladosOverride`); modal ARCA mostraba MSA estando en MA (pre-llenado movido de `onOpenChange` al `onClick`).

**Correcciones a datos reales:** Garmendia cert 28 anulado → re-imputado cert 33 (`26-06 - 1ra`). Alcorta cert 31 anulado → FC 6115 absorbida por cert 30 (junto a 6152 y 2734), retención total $65.380,71. Consistencia `26-05 - 1ra`: Garmendia anulado pasó a `declarada`.

**Detector de SICORE desfasados (query útil):**
```sql
SELECT denominacion_emisor, cuit_emisor, quincena, fecha_pago,
       (created_at::date - fecha_pago) AS gap_dias, retencion, nro_certificado, anulado, estado_quincena
FROM msa.sicore_retenciones
WHERE (created_at::date - fecha_pago) >= 20
ORDER BY gap_dias DESC;
```
`gap_dias > 20` → probable `fecha_vencimiento` mal (Garmendia: 31 días).

**Pendiente:** merge a main cuando se confirme estabilidad · eliminar columna `ddjj_confirmada` (deprecada). Bugs colaterales → [A-BUG-01](#a-bug-01). Detalle: `memory/project_sicore_estado_quincena.md`.

---

## <a id="a-test-05"></a>A-TEST-05 — Tarjetas (estado revisado 2026-06-22)

### Importador — DESARROLLADO y en main (`6906f49`, `8690bc0`), sin testear
- **PDF parser** `app/api/import-pdf-tarjeta/route.ts` (479 líneas): `CUENTAS_VALIDAS` mapea id→{schema,tabla} correctamente (`tarjeta_visa_business_msa`→`{msa,tarjeta_visa_business}`, `tarjeta_visa_pam`→`{pam,tarjeta_visa}`, `tarjeta_visa_ma`→`{ma,tarjeta_visa}`). Extrae nro_resumen/fechas/saldos, control de saldos, dedup, tarjetas adicionales, reversos; devuelve Excel de auditoría; checkbox "Forzar". El importador escribe en la tabla REAL (bien).
- **Excel fallback** `app/api/import-excel-tarjeta/route.ts` (293 líneas).
- UI en Extracto → Tarjetas → Importar (PDF default + Excel alt, selector tipo archivo, checkbox forzar, resumen).
- Las 3 tablas (`msa.tarjeta_visa_business`, `pam.tarjeta_visa`, `ma.tarjeta_visa`) existen con estructura completa de cta cte + extras (`debitos_usd`, `creditos_usd`, `nro_resumen`, `fecha_cierre`, `fecha_vencimiento`, `tarjeta_adicional`, `titular_adicional`, `referencia`, `cuota`, `comprobante`). **Las 3 están VACÍAS (0 filas)** → nunca se importó.
- → El parser PDF que el usuario creía "analizado pero no ejecutado" **SÍ está completo y en main**. Falta probarlo con un PDF real.

### 🐞 A-BUG-11 — Visualización: seleccionar tarjeta no cambia la vista (CAUSA RAÍZ encontrada)
`vista-extracto-bancario.tsx:301`: `const tablaActiva = cuentaSeleccionada || 'msa_galicia'` → usa el **ID** de la cuenta como nombre de tabla. Bancos/cajas OK (id == tabla_bd, ej. `msa_galicia`). **Tarjetas NO**: id `tarjeta_visa_business_msa` ≠ tabla_bd `tarjeta_visa_business` → el hook consulta una tabla inexistente → error → el `catch` de `cargarMovimientos` NO limpia los movimientos → **se queda mostrando la cuenta anterior (cta cte)**. Ese es el síntoma exacto reportado.
- **Fix:** derivar `tablaActiva` de `CUENTAS_BANCARIAS.find(c=>c.id===cuentaSeleccionada).tabla_bd`, no del id.
- **⚠️ Cuidado:** `tablaActiva` se usa con DOBLE propósito: (a) nombre de tabla real en `.from(tablaActiva)` (líneas 469/561/1057/1129/…) → necesita `tabla_bd`; (b) id lógico en `.eq('cuenta_bancaria_id', tablaActiva)` (config_parseo/reglas, líneas 1024/1037/1215) → necesita el `id`. Para bancos coinciden; para tarjetas hay que **separar los dos conceptos** (`tablaReal` vs `cuentaId`).

### ✅ FIX A-BUG-11 aplicado (2026-06-22) — falta testear
- `vista-extracto-bancario.tsx`: separado `cuentaId` (id lógico) de `tablaActiva` (= `tabla_bd` real). `cuenta_bancaria_id`, lookup de config import y submit usan `cuentaId`; `.from()` usa `tablaActiva`.
- `useMovimientosBancarios.ts`: useEffect ahora depende de `[tabla, schema]` (PAM↔MA tarjeta comparten tabla 'tarjeta_visa').
- Resultado esperado: seleccionar una tarjeta ahora consulta la tabla real → muestra vacío (0 filas) en vez de quedarse en la cta cte. Type-check 118, 0 nuevos.
- ✅ **Schema en operaciones de conciliación — RESUELTO (2026-06-22).** Se agregó helper `dbCuenta()` (aplica `.schema(schemaActivo)` para tarjetas/cajas) y se reemplazaron las ~8 operaciones que usaban `supabase` plano: marcar conciliado masivo (limpiar motivo_revision), vincular factura inline, y las 4 ramas de `ejecutarAsignacion` (template/ARCA/sueldo/grupo) + limpieza de vínculo. Ahora la conciliación manual de tarjetas escribe en el schema correcto. (El usuario confirmó que SÍ se debe poder conciliar: hay facturas en estado `credito` y reglas a cargar.) Esto también arregla el mismo gap para CAJAS (schema msa). Type-check 118, 0 nuevos.

### ✅ Fix DOMMatrix (2026-06-22) — import PDF ahora corre
- `pdf-parse` v2 / `pdfjs-dist` v5 exigía `DOMMatrix` (API navegador) inexistente en Node/serverless → crasheaba. Reemplazado por **`unpdf`** (`extractText` + `getDocumentProxy`), compatible con serverless. + `export const runtime='nodejs'`.
- unpdf concatena el texto sin saltos → se normaliza (reinsertar saltos antes de fechas DD-MM-YY, subtotales `TARJETA … Total Consumos` y headers DETALLE/Resumen/TOTAL) para que el parser por líneas funcione.
- Validado en seco: ambos PDFs extraen texto OK; **MSA: control cuadra exacto** (suma movs = total−saldo en pesos y USD). **PAM: desfase** (54 movs con cuotas/impuestos) → afinar regex de líneas raras cuando el usuario pase el Excel de auditoría.
- Los 2 formatos (PAM y MSA Business) son el MISMO layout Galicia → un solo parser.

### Lo que falta
1. ~~Fix A-BUG-11~~ ✅ hecho — **testear** que al seleccionar la tarjeta cambie la vista.
1b. ~~Afinar parser~~ ✅ RESUELTO (commit 1c82a45): líneas de impuestos/percepciones (IVA/PERCEP/RG/IIBB/Sellos con %) traen "base cargo" en pesos; el parser las tomaba como pesos+USD. Ahora toma solo el último (pesos). MSA 25-07 pasa a cuadrar exacto. PAM ya cuadraba (base entre paréntesis). **Probado real: PAM control OK (53 movs); MSA 25-07 pendiente re-importar con el fix.**
1c. **Limpieza datos:** el usuario importó PAM en `ma.tarjeta_visa` por error (53 movs). Borrar de MA y re-importar en PAM.
2. **(A evaluar) Display de columnas de tarjeta** (USD, nro_resumen, fecha_cierre, tarjeta_adicional) — la grilla hoy muestra columnas de cta cte; ver si se muestran las extra.
3. **Importar un PDF real** y testear (parser, control, dedup, adicionales, reversos, forzar).
4. **Reglas de conciliación de tarjeta** (no existen aún).

Detalle previo: `memory/project_tarjetas_modulo.md`.

---

## <a id="a-test-06"></a>A-TEST-06 — Refactor fechas: FASE TEMPLATES (2026-07-04)

### Contexto / por qué
`fecha_vencimiento` cumplía **dos roles** (vencimiento firme **y** fecha real de pago), y al pagar se pisaba el vencimiento → se perdía la fecha firme. Se separa en **4 fechas**: `fecha_emision` (solo FC) · `fecha_estimada` (interna, ordena el Cash Flow) · `fecha_vencimiento` (firme) · **`fecha_pago`** (NUEVA, fecha real de pago). Propagaciones: `fecha_pago → estimada` y `fecha_vencimiento → estimada` (el orden del cash flow sigue por estimada, sin cambios).

Modelo de edición acordado:
- **Templates:** venc **solo** editable desde "Egresos sin Factura". En Vista Pagos y Cash Flow, venc **read-only**; se edita **`fecha_pago`**.
- **FC (ARCA):** venc queda libremente editable (fase ARCA, aún NO hecha).

### Qué se hizo (fase templates — commit `de5eac3`, en `desarrollo`)
1. **BD:** `public.cuotas_egresos_sin_factura.fecha_pago date` + RPC `actualizar_venc_cuota(uuid,date)` (único camino autorizado para cambiar venc). Ver RECONSTRUCCION § 2026-07-04.
2. **Vista Pagos templates** (`vista-facturas-arca.tsx` ~l.10567-10668): la "fecha de pago" escribe `fecha_pago` (+ estimada), **ya no pisa venc**. Display/seed muestran `fecha_pago`.
3. **Egresos sin Factura** (`vista-templates-egresos.tsx` ~l.732): el edit de venc pasa por el **RPC**.
4. **Auto-sync `fecha_pago → estimada`** en `useInlineEditor.ts` (l.~106) y `useMultiCashFlowData.ts` (l.~700).
5. **Cash Flow** (`vista-cash-flow.tsx`): venc **read-only para templates** (l.~410); nueva **columna `fecha_pago`** editable para templates.
6. **Grillas:** columna `fecha_pago` (verde) + venc coloreado (azul=firme) en `vista-templates-egresos`.
7. `useTemplateValidator.ts`: test de venc vía RPC.

### ⚠️ PENDIENTE (NO hacer hasta testear + merge)
- **Guardián (trigger `trg_guard_venc_cuota`)**: bloquea cambios de venc de templates fuera del RPC. **Se arma POST-MERGE** (la BD es compartida prod/preview; prenderlo antes rompe prod, que aún corre código viejo). SQL listo en RECONSTRUCCION § 2026-07-04.
- **Fase ARCA** (columna `comprobantes_arca.fecha_pago` + Vista Pagos FC + venc editable FC + **SICORE `fecha_pago`** + display FC). Parte de cambios ya redactado.

### 🧪 Cómo testear (preview de `desarrollo`, guardián OFF todavía)
1. **Egresos sin Factura:** editar `fecha_vencimiento` de una cuota → debe arrastrar a `fecha_estimada` (quedan iguales); venc se ve azul; columna "Fecha Pago" (verde) vacía.
2. **Vista Pagos** (botón Pagos → solapa Facturas, filas TEMPLATE moradas): click en la fecha → poner fecha de pago → Enter. Verificar: (a) guarda en `fecha_pago`; (b) la cuota se reubica en el Cash Flow (estimada sigue al pago); (c) **el vencimiento NO cambió** (chequear en Egresos que el venc quedó igual). ← núcleo del fix.
3. **Cash Flow:**
   - Ctrl+click en "Fecha Vencimiento" de una fila **TEMPLATE** → **no debe dejar editar** (read-only).
   - Ctrl+click en "Fecha Pago" de una fila TEMPLATE → guarda `fecha_pago` + reubica la fila.
   - Fila **ARCA (FC)**: venc **sigue editable** (ARCA no se tocó aún).
4. **Motor conciliación:** conciliar una cuota → sigue matcheando por estimada, pasa a `conciliado`.
5. **Data vieja:** una cuota pagada de antes no se rompió (su venc histórico sigue).

> El **guardián** (bloqueo con error al tocar venc fuera de Egresos) **no se puede probar aún** — se arma post-merge. Cuando esté: intentar cambiar venc de template desde Cash Flow/Pagos debe **fallar con mensaje**.

### ✅ Testing fase templates (2026-07-04) — bugs encontrados y arreglados
- **Columna Fecha Pago no aparecía en Egresos** → localStorage tenía config vieja; fix: mergear defaults en el init de `columnasVisibles`/`anchosColumnas` (commit `602e8c7`).
- **Display: fecha_pago siempre vacía en la grilla** → `renderizarCelda` leía `fecha_pago` del template **padre** (no la tiene) en vez de la cuota; faltaba en la lista de campos de la cuota (l.998). Fix `86c4e30`. **Era la causa del síntoma "edito en Cash Flow y no se ve en grilla"** (la escritura andaba; el display la tapaba).
- **Vista Pagos: header decía "Fecha Vto."** pero la celda edita `fecha_pago` → renombrado a "Fecha Pago" (`3bff698`). Es seguro: escribe fecha_pago, no toca venc.
- **`fecha_pago` ahora editable desde la grilla** (Ctrl+click, pedido del usuario) + `procesarValor` trata fecha_pago como fecha (`3bff698` / `df59342`).
- **⚠️ Bug del guardián evitado:** la grilla edita fechas por el **hook** (`useInlineEditor`), no por el `guardarEdicion` donde estaba el RPC → el venc de la grilla hacía UPDATE directo y **habría fallado con el guardián**. Fix: el hook rutea `fecha_vencimiento` de `cuotas_egresos_sin_factura` por el RPC (`df59342`). ARCA sigue update directo.
- **Propagación fecha_pago → Cash Flow:** automática vía `fecha_estimada` (arrastre) + orden del cash flow por estimada. Se refleja al refrescar.
- Estado: falta que el usuario pruebe editar fecha_pago desde la grilla (deploy `df59342`). **Decisión del usuario: NO mergear ni armar guardián hasta terminar TODO (templates + ARCA).**

---

### 🐞 <a id="a-bug-12"></a>A-BUG-12 — Conciliación de tarjeta diverge del razonamiento del motor (2026-06-22)

**Problema:** la conciliación automática de tarjeta (botón "Conciliar (N)" por resumen) usa un matcher **nuevo** que NO sigue la lógica del motor establecido. Se introdujo sin marcar el desvío. Riesgo principal: **puede conciliar con facturas de otro período** (no chequea fecha).

**Cómo concilia el MOTOR** (`hooks/useMotorConciliacion.ts` → `buscarMatchCashFlow`, líneas 265-355):
- **Pool** = cash flow (templates + facturas `pendiente`/`pagar`). Excluye `credito`/`conciliado`/`anterior`/`cuotas` (`useMultiCashFlowData.ts:454-457`).
- **Pre-filtro CUIT**: saca el CUIT del banco de `leyendas_adicionales_2` y filtra por `cuit_proveedor` (fallback a todo si no hay candidatos). + pre-filtro haberes→sueldos.
- **Match** = **monto EXACTO** (`cf.debitos !== mov.debitos` descarta) **+ `fecha_estimada` dentro de ±5 días**.
- **Resultado**: fecha exacta (0 días) → **conciliado**; fecha ≤5 días no exacta → **auditar** (con `motivo_revision`).
- Además: `reglas_conciliacion` (patrones de texto).

**Lo que se metió para tarjeta** (`components/vista-extracto-bancario.tsx` → `conciliarResumen`):
- Pool = facturas `credito` · **sin CUIT** · **monto ±1 peso** · **SIN fecha** · **conciliado directo** (sin estado auditar).

**Divergencias:**
| Criterio | Motor | Tarjeta (actual) | Nota |
|---|---|---|---|
| Pool | cashflow (sin credito) | `credito` | **Justificado** — las pagadas con tarjeta viven en `credito`, fuera del cashflow. Única diferencia legítima. |
| CUIT | pre-filtra | no | La tarjeta no trae CUIT en leyendas (descripción tipo "AUTOPISTAS URBAN"). |
| Monto | exacto | **±1 peso** | Aflojado por redondeo de centavos (TELECOM 164.259,82 vs ,83). Cambio no consultado. |
| Fecha | **±5 días** (fecha_estimada) | **ninguna** | **El más grave** → riesgo de cruzar períodos si hay monto único de otro mes. |
| No exacto | → **auditar** | no existe | Concilia directo aunque sea dudoso. |

**Evidencia de que la fecha importa:** los 7 matches de mayo 2026 cayeron bien, pero por suerte (montos únicos). La factura `fecha_emision` cae 2-13 días ANTES del consumo de tarjeta (patrón natural: se emite y a los días llega el cargo).

**A DECIDIR para alinear al motor:**
1. **Fecha**: reincorporar. Para tarjeta el campo natural es factura `fecha_emision` vs fecha del consumo. ¿Ventana ±5 (como motor) o algo más por latencia de tarjeta?
2. **Exacta→conciliado / dentro de ventana→auditar**: adoptar el estado intermedio `auditar` igual que el motor.
3. **Monto**: ¿volver a exacto (y ±centavos → auditar) o mantener ±1?
4. **CUIT**: la tarjeta no lo tiene; ¿matchear proveedor por otra vía o dejar sin pre-filtro?

**Recomendación:** alinear al motor (monto exacto + fecha emisión con ventana + estado auditar para lo no-exacto), dejando el pool `credito` como única diferencia justificada. Idealmente **reusar `buscarMatchCashFlow`** parametrizando el pool + la fecha, en vez de mantener un matcher paralelo.

**Gaps relacionados (mismo módulo):**
- **`pago` (SU PAGO) → cta cte**: el pago de la tarjeta concilia contra el débito en cuenta corriente. No implementado (hoy se rotula "pago → cta cte").
- **Caso agrupado FC−NC**: ej MEDICUS 807.028,07 = FC 850.818,25 − NC 43.790,18. No auto-matchea por monto único → manual.
- **37 facturas MSA en `conciliado` sin link a ningún movimiento** ($4.7M) — NO son del bug de tarjeta (no matchean montos de tarjeta). Revisar aparte (históricas / cancelaciones FC-NC / echeq / externas).

---

## <a id="a-sec-01"></a>A-SEC-01 — Hardening de seguridad (2026-06-17)

**Foco del usuario (en orden):** (1) evitar acceso de 3ros a su Google (Gmail/Drive); (2) evitar que rompan/dañen la app (Supabase) — mitigable con backup confiable; (3) que vean datos no es lo peor, que dañen sí; (4) que no se filtren las claves.

### Hallazgo crítico — el rol `anon` puede BORRAR todo
Scan: `anon` tiene `DELETE, INSERT, UPDATE, TRUNCATE` en **cada** tabla. Combinado con la `anon_key` expuesta en el bundle JS (es así por diseño), tablas expuestas en API, y mayoría sin RLS (o RLS "permissive" de 1 policy "allow all") → cualquiera con `curl + anon_key` puede borrar/truncar tablas. Es exactamente lo que el usuario quiere evitar.

**Datos concretos (auditoría 2026-06-23):** `anon` = `authenticated` = `service_role` tienen `SELECT/INSERT/UPDATE/DELETE/TRUNCATE` sobre **los 72 objetos** (66 tablas + 6 vistas). Las **41 policies RLS son TODAS permisivas `allow all`** (`cmd=ALL`, `qual=true`) → la RLS no filtra nada. Varias tablas directamente sin RLS (incluido todo el schema `sueldos`). Detalle completo en `ARQUITECTURA-BD.md` §5.

**Motivo / dónde duele (registrado 2026-06-27, a pedido del usuario para poder priorizar):** lo expuesto NO es solo "metadata" — son los **montos, CUITs y números de toda la operación**. Ejemplos: `msa.comprobantes_arca` (todos los importes de facturas), `public.arca_pdf_busqueda_log` (montos por búsqueda de PDF, sin RLS). Cualquiera con la `anon_key` (que está en el bundle JS por diseño) puede leerlos con `curl`. **Importante para decidir:** cerrar `anon` es lo que mueve la aguja — protege TODO de una; mitigaciones puntuales (ej. no loguear montos en GAS, ya hecho) son defensa en profundidad pero NO sustituyen el fix. Los logs de GAS (Google) y Vercel están *gated* por esas cuentas → se cubren con **2FA** (parte del P0).

### Aclaración: la clave ARCA NO queda en logs
Un contacto le dijo que sí. Verificado que **no**: el endpoint recibe el password en body, lo usa para loguearse a ARCA y lo descarta; no se loguea ni se persiste; `arca_descargas_log` guarda empresa/fechas/status, no password; `console.error` sólo loguea texto genérico. Único residual: Vercel "Detailed Function Logs" (opt-in, OFF por default) podría capturar bodies → verificar Project Settings → Functions → Logging. (Aparte: `.mcp.json` con el token Supabase NO está trackeado y está en `.gitignore` ✅.)

### Análisis de riesgo del REVOKE (lo importante a re-recorrer)
El usuario observó, con razón, que proponer REVOKE DELETE en bloque era irreflexivo (rompería flujos). Análisis riguroso:

**¿REVOKE puede perder datos?** No técnicamente. Sólo modifica ACL (`pg_class.relacl`), no toca filas; no es DDL; una query DELETE/TRUNCATE bloqueada falla **antes** de tocar datos; reversible 100% con 1 GRANT. PERO puede **dejar de funcionar** algo si no se verifica antes.

**Actores que usan rol `anon`:** App browser (verificable por grep) · Backend Next.js usa `service_role` (no afectado) · Triggers corren como owner (no afectado) · Backups/Dashboard/Realtime (no afectados). **Riesgo real sólo si hay** Edge Functions o integraciones externas (Zapier/n8n/scripts) que escriban con `anon_key` → **confirmar con el usuario** (probablemente NO).

**Transaccionalidad (observación clave del usuario).** En supabase-js desde browser cada query es su propia transacción. Un flujo `await update(A); await delete(B)` con DELETE revocado → A ya quedó persistido y B falla → inconsistencia. Esto **ya pasa hoy** sin REVOKE (corte de internet, error random); REVOKE no lo inventa pero lo expone más seguido. La inconsistencia es siempre **prospectiva** (flujos nuevos a medio camino), nunca retrospectiva (datos pasados NO se corrompen).
Casos concretos en el código: eliminar grupo de pago (`vista-facturas-arca.tsx` ~8823/8890/8961: UPDATE saca `grupo_pago_id` de las FCs → DELETE `grupos_pago`; si se revoca DELETE, el grupo queda huérfano), resetear regla import, eliminar anticipo con vinculaciones.
**Solución real (más allá del REVOKE):** mover esos flujos al backend con transacción atómica (BEGIN/COMMIT) o RPC Postgres `SECURITY DEFINER`, o try/catch que revierta la Fase 1. Cualquiera protege también contra cortes de internet.

**Recomendación refinada:**
1. **REVOKE TRUNCATE de anon**: seguro, la app no usa truncate, cero riesgo → hacer ya.
2. **REVOKE DELETE de anon**: NO en bloque. Requiere lista de flujos multi-tabla afectados + decisión caso por caso.
3. **Alternativa intermedia**: REVOKE DELETE sólo en tablas terminales (sin FKs entrantes) → cero riesgo de inconsistencia.
4. **Protocolo futuro**: antes de cualquier REVOKE/GRANT → listar SQL exacto, grep de uso por tabla, ejecutar 1×1 (no en bloque), tener el GRANT de revert listo.

### Plan priorizado
**🚨 P0 (esta semana):** (1) REVOKE TRUNCATE de anon [+ DELETE con validación previa]; (2) scope GAS `drive`→`drive.file` (1 línea + redeploy); (3) 2FA Google; (4) 2FA Vercel; (5) verificar logs Vercel no capturen bodies.
**🟡 P1 (2 semanas):** (6) decidir backup — Supabase Pro (~$25/mes, PITR 7 días, setup 5 min) vs GitHub Action diaria con pg_dump (gratis, 1-2h setup); (7) REVOKE UPDATE de anon en tablas de configuración (cuentas_contables, tipos_comprobante_afip, tipos_sicore_config, reglas_*); (8) limitar exposed tables a lo necesario.
**🟢 P2:** (9) RLS con políticas reales; (10) auth Supabase real (admin/contable hoy es sólo por URL); (11) audit log de cambios en BD.

### Sobre Vercel env vars (pregunta del usuario)
Vercel está OK. Las "alternativas" (Doppler/Infisical, AWS/Google Secret Manager) igual inyectan los secrets en runtime → mismo punto de exposición; hardcodear es PEOR (git). Lo que sí mejora sin cambiar de plataforma: 2FA, auditar colaboradores (solo el usuario), no compartir dashboard, rotación periódica de tokens.

### Lo que le falta al foco del usuario (mencionar)
Sesión del cliente (si el browser de Ulises se compromete, su acceso cae) · Trazabilidad (no hay audit log por usuario porque no hay login) · Disponibilidad (si Vercel cae, la app cae — ¿plan B?).

### Preguntas abiertas para decidir cómo seguir
1. ¿2FA en Google y Vercel ya activos?
2. ¿Backup: Supabase Pro o GitHub Action?
3. ¿Avanzamos con REVOKE TRUNCATE ahora (y DELETE tras validar)?
4. ¿Cambio el scope GAS a `drive.file`?
5. ¿Tenés integraciones externas / Edge Functions que escriban con `anon_key`? (define el riesgo del REVOKE)

> Transcripción verbatim del análisis completo (Respuesta 1 técnica amplia + Respuesta 2 con el foco del usuario): `memory/project_hardening_seguridad.md`.

---

---
---

# 🔬 DOSSIERS — Revisión Conciliación (2026-06-21, SOLO ANÁLISIS)

> Investigación de los 10 temas del usuario. Estado: análisis hecho, **sin tocar código**. Refs: `hooks/useMotorConciliacion.ts` (motor) y `components/vista-extracto-bancario.tsx` (vista/modales). Evidencia de datos: queries a `public.msa_galicia` y `public.sueldos_pagos` (2026-06-21).

## <a id="a-bug-04"></a>A-BUG-04 — Motor no concilia casi ningún sueldo (#1)

**Cómo matchea el motor** (`buscarMatchCashFlow`, useMotorConciliacion.ts:265-355): compara **monto exacto** (`cf.debitos === movimiento.debitos`, l.296/326) + **fecha ≤5 días** (l.300-303). Si fecha exacta (0 días) → `conciliado`; si 1-5 días → `auditar` (l.313-320). Pre-filtro haberes (l.271): solo si el texto del banco contiene "haber" restringe el pool a `origen==='SUELDO'`.

**Evidencia de datos (última conciliación):**
- `sueldos_pagos`: 41 conciliado/banco · **9 `pagado`/banco SIN conciliar** · 11 `programado`/caja_sigot · 8 `anterior`/banco (excluidos del pool por `.neq('estado','anterior')`).
- En `msa_galicia` hay 4 movimientos con `categ='Sueldos'` en estado **`auditar`** (ej. 02/06 $461.352,30 "Trf Orden Judic."): el motor SÍ los matcheó (asignó categ) pero la fecha no era exacta → quedaron en `auditar` esperando confirmación manual.
- Varios **lumps de nómina** pendientes sin matchear: "Servicio Acreditamiento De Haberes" $870.581 / $1.028.648 / $1.050.958 / $1.020.347 (categ `INVALIDA:`).

**Causas raíz (3):**
1. **Pago en lote (lump) vs pagos individuales.** El banco deposita la nómina en uno o pocos importes ("Acreditamiento de Haberes" ~$1M), pero el sistema tiene **un `sueldos_pago` por empleado**. Ningún importe individual iguala el lump → no hay match → queda `pendiente`. Se arreglaría agrupando (`grupo_pago_id`) para sumar en una fila SUELDO única, pero **solo 2 de 41 pagos tienen grupo**.
2. **Regla fecha exacta = conciliado / 1-5 días = auditar.** Sueldos que matchean por monto pero con 1-5 días de diferencia caen en `auditar` (no auto-conciliado) → el usuario los confirma a mano → se siente como "no concilió".
3. **Pre-filtro "haber" demasiado estricto.** Solo dispara con la palabra "haber". Las transferencias individuales dicen "Trf Inmed Proveed" / "Trf Orden Judic." → no activan el pre-filtro de sueldos (igual pueden matchear por monto, pero pierden la restricción que evitaría falsos cruces).

**Opciones a evaluar (no decidir aún):** (a) soportar match lump↔suma de pagos del período (agrupar sueldos automáticamente por fecha/período); (b) ampliar tolerancia de fecha o auto-conciliar sueldos con monto exacto aunque la fecha no sea exacta; (c) detectar "Acreditamiento de Haberes" como nómina y ofrecer reparto.

**⚠️ CORRECCIÓN DEL USUARIO (2026-07-01) — la causa NO es el matching del motor (mi lectura de arriba fue errada):** el problema es **upstream**: el pago de sueldo **se registra directamente con estado `conciliado` al pagarlo** (no pasa por la conciliación real). Evidencia: el usuario va a Sueldos, ve los pagos por empleado del período, y **los que pagó AYER ya figuran `conciliado`** — pero **la última conciliación fue anterior y esos movimientos todavía NI están en el extracto**. → Es imposible que estén conciliados; quedaron marcados así al crear/pagar el pago. Por eso el motor "no los concilia": ya salen del pool por estar en `conciliado`. **Fix a mirar:** dónde se setea el estado del `sueldos_pago` al pagar/registrar — debe quedar `pagado` (pendiente de conciliar contra el extracto), NO `conciliado`. Recién el motor/extracto lo pasa a `conciliado` cuando aparece el movimiento real. (Esto explica los "41 conciliado/banco" del análisis de arriba: muchos nunca se matchearon, se marcaron solos.)

---

## <a id="a-bug-05"></a>A-BUG-05 — Conciliación manual (reasignar) borra/no copia datos (#2)

**Aclaración de las 2 vías** (confirmado): el botón **Editar → cambiar estado** funciona bien. El problema está en **Reasignar** (modal de asignación, `ejecutarAsignacion`, vista-extracto-bancario.tsx:984-1320).

**Bugs encontrados en `ejecutarAsignacion`:**
1. **`detalle: null` hardcodeado en las 4 ramas** (template l.1093, ARCA l.1128, sueldo l.1199, grupo l.1262) → **siempre borra el detalle** del movimiento. En la rama sueldo incluso **computa `detalleSueldo`** (l.1175 "Anticipo X - …") **pero lo descarta** y escribe null → código muerto / regresión.
2. **`nro_cuenta` no se copia en ARCA cuando la FC no lo tiene.** Lee `nro_cuenta` directo de la factura (l.1120) y solo lo setea si existe (l.1134). Si la FC tiene `cuenta_contable` (→ categ, sí se copia l.1133) pero `nro_cuenta` NULL → el extracto queda con categ y **sin nro_cuenta**. El **motor sí tiene fallback** (busca `nro_cuenta` en `cuentas_contables` por categ, useMotorConciliacion.ts:489-496); el manual **no**. ← esto es exactamente lo que reportó el usuario.
3. **Rama TEMPLATE no llena `nro_cuenta`** en absoluto.
4. **`proveedor_nombre` = lookup o null** (l.1095/1130/1201/1264): si el CUIT no está en `proveedores`, escribe null → **borra** el proveedor que hubiera.

**Conclusión:** la asignación manual no quedó homogénea con el motor. Faltan: preservar/derivar detalle, fallback de nro_cuenta por categ, y no pisar proveedor con null.

---

## <a id="a-feat-01"></a>A-FEAT-01 — Correr el motor acotado a lo filtrado/en pantalla (#3)

**Hoy:** `ejecutarConciliacion(cuenta)` (useMotorConciliacion.ts:358) carga **todos** los `estado='pendiente'` de la cuenta (`obtenerMovimientosBancarios`, l.169-174) y los procesa. No acepta subconjunto.

**Lo que pide el usuario:** correr el motor solo sobre lo filtrado/visible (por categ, rango de fechas, o los 100 en pantalla) — útil para probar fallas/mejoras de a poco.

**Factibilidad: BAJA complejidad.** El motor ya itera una lista de movimientos. Basta con que `ejecutarConciliacion` acepte un parámetro opcional `movimientosFiltrados?: MovimientoBancario[]` y, si viene, salte la carga y use esa lista. La vista ya tiene `movimientosVisibles` (lista filtrada en pantalla). Se conecta un botón "Conciliar solo lo filtrado" que pasa `movimientosVisibles.filter(estado==='pendiente')`.

**Riesgo:** mínimo. Solo cambia el origen de la lista, no la lógica de match. Recomendable hacerlo — además sirve de herramienta de debug para el resto de los temas.

**✅ IMPLEMENTADO (2026-06-21) — falta testear:**
- `useMotorConciliacion.ts`: `ejecutarConciliacion(cuenta, movimientosOverride?)` — si viene la lista, corre solo sobre ella; sino carga todos los pendientes (igual que antes).
- `vista-extracto-bancario.tsx` `iniciarConciliacion`: detecta `hayFiltroActivo` (`categsFiltro` / `busqueda` / `filtroCategEspecial` / `filtroRevisado≠'todas'` / `filtroEstado≠'Todos'`). Si hay filtro → confirm "se conciliará solo lo visible (N pendientes)" y pasa `movimientosVisibles` pendientes; si no → corre sobre todos. **El `limiteRegistros` NO cuenta como filtro** (decisión del usuario: sin filtro = corre sobre todo aunque muestre 100).
- Si hay filtro pero 0 pendientes visibles → alert y aborta.
- Type-check: sin errores nuevos (mis archivos limpios; 119 errores TS preexistentes ajenos, ver `ERRORES_CONOCIDOS.md`).
- **A testear:** (1) sin filtro → corre todo; (2) con filtro categ → avisa y corre solo eso; (3) límite 100 sin filtro → corre todo; (4) viendo conciliados → avisa "0 pendientes".

**✅ EXTRA (2026-06-21): resumen del último lote.** Al terminar la conciliación, el panel "Conciliación completada" ahora muestra: encabezado con la **cuenta + alcance** (todos / N filtrados) + 5 números: **Procesados · Conciliados · A auditar · Sin match · Errores** (antes faltaba Errores y el alcance). Estado nuevo `infoLote` en la vista. Permite verificar que "Procesados" coincida con el lote esperado. Type-check: 119 errores preexistentes, 0 nuevos.

---

## <a id="a-bug-06"></a>A-BUG-06 — Reasignar muestra a veces pocas y a veces muchas FC (#4)

**Causa** (`generarPropuestasInteligentes`, vista-extracto-bancario.tsx:1323-1362): las propuestas se arman en 3 niveles:
1. **Mismo monto exacto** (cualquier fecha) — l.1328.
2. **Monto ±10% Y el proveedor aparece en la descripción del movimiento** — l.1338-1341 (`descripcion.includes(display_nombre.split(' ')[0])`).
3. **Mismo proveedor en la descripción** (cualquier monto) — l.1350.

**Por qué varía tanto:** el nivel 2 y 3 dependen de que el **nombre del proveedor aparezca literalmente en la descripción bancaria**. Galicia suele poner "Trf Inmed Proveed" (genérico, sin nombre) → niveles 2-3 no aportan nada → solo quedan las de **monto exacto** (pocas o ninguna). Cuando la descripción sí trae un nombre reconocible → aparecen muchas. Esa es "la lógica detrás" que el usuario no veía. Además el pool base (`cargarFacturasDisponibles`, l.724) trae **todas** las ARCA+templates no conciliadas, así que el buscador manual sí permite encontrarlas, pero las *propuestas automáticas* dependen del nombre en la descripción.

**A evaluar:** usar CUIT bancario (`extraerCuitBancario`) para proponer por proveedor en vez de depender del texto; o mostrar siempre las de monto exacto + cercanas por fecha.

---

## <a id="a-bug-07"></a>A-BUG-07 — Detalle no homogéneo entre formas de conciliar; templates ¿llenan detalle/cuota? (#5)

**Estado del campo `detalle` según vía:**
- **Motor, match Cash Flow** (useMotorConciliacion.ts:501): `detalle = cashFlowRow.detalle_usuario || null`. Para templates/ARCA toma el detalle del Cash Flow si existe; **no agrega qué cuota**.
- **Motor, reglas** (l.666): `detalle = extraAnticipo.detalle || null` (casi siempre null salvo anticipos).
- **Manual (todas las ramas):** `detalle: null` → **siempre vacío** (ver A-BUG-05).
- **`comprobantes_pagados`** (campo separado): manual template = `display_referencia`/`nombre_referencia` (l.1096), ARCA = `FC - nro` (l.1131). **No indica número de cuota** del template.

**Templates:** la conciliación (motor o manual) vincula `template_id` + `template_cuota_id` y pone `comprobantes_pagados = nombre del template`, **pero no escribe en `detalle` ni dice "cuota N/total"**. Es decir: queda trazado por ID pero no legible en la grilla.

**Conclusión:** el llenado de `detalle` NO está homogeneizado. Falta una convención única (ej. `detalle = "Nombre template — cuota X"` / `"FC nro — proveedor"`) aplicada igual en motor y manual.

---

## <a id="a-bug-08"></a>A-BUG-08 — Conciliación de sueldos: ¿llena detalle? — verificado con la última conciliación (#6)

**Verificado con datos (msa_galicia, movimientos con `sueldo_pago_id`):** hay un **corte de fechas nítido**:
- **≤ 28/04/2026**: `detalle` LLENO ("Anticipo Alondra Olivo - Anticipo Abr 2026"), `comprobantes_pagados` lleno ("Abr 2026"), `proveedor_nombre` lleno. ← formato idéntico al `detalleSueldo` del código manual.
- **Mayo/junio 2026** (16/06, 09/06, 02/06, 01/06, 29/05, 04/05): `detalle = null`, `comprobantes_pagados = null`, `proveedor_nombre` mayormente null.

**Diagnóstico:** las conciliaciones recientes de sueldos quedaron **sin detalle**. Coincide con A-BUG-05 punto 1 (la rama sueldo del manual ahora escribe `detalle: null` y descarta el `detalleSueldo` que calcula) y/o con que el **motor no llena detalle para sueldos** (`detalle_usuario` de las filas SUELDO viene null; el CUIT del empleado no está en `proveedores` → `proveedor_nombre` null; `comprobante_display` null). 

**Anomalía detectada:** dos movimientos (08/04 y 06/04) comparten el **mismo `sueldo_pago_id`** (`8fd083cf…`) con categ distinta (Sueldos vs GASTOS VARIOS GANADERIA) — revisar si es correcto.

**Conclusión:** la conciliación de sueldos **dejó de llenar detalle** en algún cambio reciente. Es una regresión, no falta de diseño (antes funcionaba).

---

## <a id="a-bug-13"></a>A-BUG-13 — Regla uni-responsable vs. template multi-responsable (2026-08-09)

> ⏸️ **Postergado a propósito** por el usuario: *"deja el peligro de multi responsable contra
> regla uniresponsable documentado para los ajustes finales"*. **No tocar antes de eso.**

**El problema.** La regla Tipo B (`reglas_contable_interno`, `tipo_regla='responsable'`) se busca
con **igualdad exacta**:

```
.eq('responsable', responsable)      // useMotorConciliacion.ts → buscarCodigosContableInterno
```

Pero el `responsable` de un template **puede traer varias empresas**. Entonces:

| Template | `responsable` | ¿Encuentra regla? |
|---|---|---|
| Retiro MA mensual | `MSA/PAM` | ❌ — no hay ninguna regla con ese literal |
| ABL Cochera Libertad Anual | `PAM/MA/Duhau` | ❌ — idem |
| Los otros 174 | `MSA` · `PAM` · `MA` | ✅ |

**Por qué es peligroso y no sólo incompleto**: la regla **existe y se ve en la pantalla de
configuración**, pero nunca se aplica. No hay error, no hay aviso — el movimiento se concilia sin
`contable`. Es el mismo modo de falla que veníamos persiguiendo toda la sesión: *el silencio miente*.

**Alcance hoy**: **2 templates de 176**. Chico, pero crece cada vez que se cargue un template
compartido, y el usuario ya confirmó que lo compartido es un caso real y recurrente (también está
en sueldos: AMS y JMS son `MSA/PAM/MA`).

**Dónde NO pasa**: en **facturas**. Ahí se compara la empresa canónica del schema, que siempre es
una sola. El arreglo del 2026-08-08 quedó del lado seguro.

**Salidas posibles** (a decidir en los ajustes finales):
1. **Comparación "contiene"** — que el template `MSA/PAM` encuentre la regla de `MSA` **y** la de
   `PAM`. ⚠️ Hay que definir **cuál gana** si las dos existen y difieren.
2. **Reutilizar `parseEmpresas`** (`lib/empresas.ts`) para partir el responsable y buscar regla
   por cada empresa, con un orden de prioridad explícito.
3. **Avisar en la pantalla de reglas** cuando un template multiempresa no tiene regla aplicable —
   no arregla el match pero saca el problema del silencio.

**Relacionado**: la comparación exacta es la misma que hace que `RET PAM` y `RET 3 PAM` convivan
sin que nada las relacione. Ver § *Campos de las reglas: elegir en vez de tipear*.

---

## <a id="a-feat-02"></a>A-FEAT-02 — Editar extracto: ofrece cuentas contables pero NO templates (#7)

**Confirmado** (vista-extracto-bancario.tsx): el panel **Edición Masiva** (l.2110-2152) ofrece `SelectorCuentaContable` (CATEG, l.2123), Centro de Costo, Estado, Contable, Interno — **pero ningún selector de template**. Para vincular un template hay que ir al modal **Asignar/Reasignar** (que sí tiene tab Template). 

**Mejora pedida:** permitir elegir template también desde el flujo de Editar (o unificar). Factible reusando el `Tab Template` del modal de asignación. A definir si se agrega al panel masivo o se redirige al modal.

---

## <a id="a-feat-03"></a>A-FEAT-03 — Contable/Interno: mostrar los existentes para no duplicar (#8)

**Confirmado:** `contableManual`/`internoManual` son `<Input>` de **texto libre** (modal l.3681-3695, placeholder "AP i" / "DIST MA"; e igual en panel masivo ~l.2154). No muestran los valores ya usados → riesgo de escribir variantes ("DIST MA" vs "Dist MA").

**Solución (simple, sin tabla nueva — el usuario lo aceptó así):** poblar un `<datalist>` o combobox con los **valores distintos existentes**. Origen: `SELECT DISTINCT contable` y `SELECT DISTINCT interno` de las tablas de extracto (y/o `reglas_contable_interno.codigo_contable/interno`). Mostrar como sugerencias. Si más adelante se quiere control estricto → tabla maestra (como centros de costo), pero por ahora alcanza con listar las actuales.

---

## <a id="a-feat-04"></a>A-FEAT-04 — DIST MA + retención SICORE: la retención también es DIST MA pero SICORE agrupa (#9, arquitectura)

**Planteo del usuario:** pago una factura de MA con retención → pago el neto y anoto interno=`DIST MA`. Después **MSA paga la retención** al fisco, y ese pago **también debería ser `DIST MA`**. Pero SICORE **agrupa** las retenciones de muchos proveedores en un único pago (TXT/quincena) → se pierde el "dueño" interno de cada retención.

**Dos caminos identificados (el usuario sabe que toca arquitectura):**
- **A — Anotar en la factura/template** que fue `DIST MA` y **deducir el total** (neto + retención) como DIST MA desde ahí. Más simple, no toca SICORE.
- **B — Identificar dentro de SICORE** qué parte de cada retención es `DIST MA` (campo interno por registro de `sicore_retenciones`) y desagregar el pago agrupado. Más preciso pero **modifica la arquitectura SICORE**.

**Estado:** solo registrar el planteo. Decisión pendiente (puede que no se haga). Relacionado con `sicore_retenciones` y el reparto interno DIST MA.

---

## <a id="a-bug-09"></a>A-BUG-09 — No-conciliados que deberían haber conciliado + reglas a agregar (#10)

**Datos `msa_galicia`:** 618 conciliado / 39 pendiente / 4 auditar. Revisión de los pendientes (casi todos con categ `INVALIDA:` = nunca tocados):

**Candidatos a regla nueva (recurrentes mismo importe/descr):**
- **"Deb. Autom. De Serv." $12.902** se repite 4 meses (18/02, 16/03, 15/04, 15/05) — débito automático mensual → regla/template claro. Hay otros "Deb. Autom. De Serv." recurrentes ($572.972 en 05/05 y 06/02; $32.634; $48.996; $16.982).
- **ECHEQ sin regla:** $1.461.558,28 (16/06 "Echeq 48 Hs. Nro. 105") y $1.455.755,70 (26/05 "Echeq Nro 102"). No hay regla para "Echeq" → deberían cruzarse con FCs en estado `echeq`. 

**Casos que NO son de regla sino de grupo/manual:**
- **$4.165.672,09 (10/06 "Trf Inmed Proveed")** = total viejo del **grupo Alcorta** (ver A-BUG-01/A-BUG-02). El motor no concilia grupos → requiere Tab Grupo manual. (Ojo: ese total cambió a $4.161.192,09 tras re-imputar SICORE → además explica por qué no calza por monto exacto.)
- Lumps de nómina "Acreditamiento de Haberes" ($870K-$1.05M) → ver A-BUG-04.
- Grandes créditos "Transferencias Cash Proveedores" ($89,5M, $5M, $11,8M) → ingresos/movimientos entre cuentas, probablemente no son egresos conciliables por regla.

**Pendiente de análisis profundo:** cruzar cada pendiente con su posible match (mismo monto en ARCA/template/sueldo no conciliado) para listar (a) los que deberían haber conciliado solos y por qué no, y (b) el set de reglas nuevas a proponer. Requiere una corrida de query de cruce monto↔candidatos.

---

## <a id="b-bug-cliente-no-se-crea"></a>B-BUG-CLIENTE-NO-SE-CREA — Las ventas no dan de alta el cliente en `proveedores` (2026-07-28)

**Cómo apareció**: al cargar los CUITs de Sanpa y Provinvest en los contratos de arrendamiento
se vio que **ninguno de los dos está en `public.proveedores`**, aunque los dos **ya tienen
factura de venta cargada** en `msa.comprobantes_venta`. El usuario lo marcó como violación de
la regla consensuada: *"si estaba la factura, tendría que estar cargado en proveedores/clientes"*.

**Causa raíz — asimetría compras vs ventas** (verificado en el código, 4 entradas de ventas):

| Flujo | Qué hace con `proveedores` |
|---|---|
| **Compras** — `app/api/import-facturas-arca/route.ts:624` | ✅ **auto-crea** los que faltan, en bloque, sin romper el import si falla |
| **Ventas · IMPORT** — `app/api/import-ventas/route.ts` | ❌🔴 **no toca `proveedores` en absoluto** — el peor caso: es la vía masiva |
| **Ventas** — `components/modal-venta-msa.tsx:200` | ❌ sólo `UPDATE … SET es_cliente=true WHERE cuit=X` |
| **Ventas** — `components/modal-comprobante-venta-msa.tsx:217` | ❌ ídem, sólo UPDATE |
| **Ventas** — `components/modal-liquidacion-msa.tsx:573` | ❌ ídem, sólo UPDATE |

Dos fallas distintas:
- El **`UPDATE` matchea 0 filas y no falla** → si el cliente no existe, no pasa nada y nadie se
  entera. Hueco silencioso.
- El **importador de ventas ni siquiera lo intenta** → es por donde entra el volumen (ARCA
  Comprobantes Emitidos), así que es el que más clientes deja sin registrar.

**Fix**: replicar del lado de ventas lo que ya hace el importador de compras — **upsert** (crear
si no existe con `es_cliente = true`, y si existe marcar el flag), en los **4 puntos**.
Extraerlo a una **función compartida en `lib/`** (regla DRY) en vez de repetirlo 4 veces; el
importador de compras debería terminar usando la misma.
Criterio para `es_proveedor`: `true` sólo si tiene factura de compra a su nombre (los clientes
puros van en `false`).

**Relacionado**: es la misma familia que **B-FEAT-07** (carga orgánica de proveedores). Este es
el caso concreto y acotado; B-FEAT-07 es el barrido general.

**Datos — ✅ RESUELTO 2026-07-28** (el bug de código sigue abierto): se dieron de alta los 2
clientes faltantes tomando `cuit` y `razon_social` de **`msa.comprobantes_venta`** (los datos
que vienen de ARCA), con `es_cliente = true` y `es_proveedor` calculado según tengan o no
factura de compra — los dos son **clientes puros**, así que quedaron en `false`.
Ahora los 4 contratos de arrendamiento resuelven contra `proveedores`.

El INSERT se escribió **genérico** (todo `cuit_cliente` de `comprobantes_venta` que no esté en
`proveedores`), así que se puede volver a correr como parche manual hasta que esté el fix.

> 🔎 **Nota de dato, sin acción**: el CUIT de Sanpa en la factura (`30712200662`) **no pasa la
> validación de dígito verificador** (le correspondería terminar en 5). El usuario confirmó que
> *"las facturas tienen los datos reales"*, así que los contratos se alinearon a la factura.
> Queda anotado por si algún día ARCA lo rechaza.

---

## <a id="a-feat-13"></a>A-FEAT-13 — Cash Flow multi-empresa: poder pagar facturas de PAM y MA (2026-08-07)

**El problema, dicho por el usuario:** *"tenemos cargadas facturas de PAM y de MA y hoy no tengo
cómo registrar que pagué una factura de PAM. El pago se registra desde Cash Flow."*

### La decisión conceptual (del usuario, y es la que ordena todo lo demás)
> *"Hoy Cash Flow no es de MSA, es de todos, porque muestra templates a pagar de todos y eso es
> correcto. Si muestra templates multiempresa debería mostrar FC multiempresa. Si no, no habría
> congruencia conceptual."*

No se hace un Cash Flow por empresa. Se hace **uno solo, multiempresa**, que es lo que ya es a
medias: los templates viven en `public` y entran los de las tres empresas; las facturas viven en el
schema de cada una y entra sólo MSA. La incoherencia era mostrar una sola empresa de facturas.

### Estado medido el 2026-08-07 (BD viva)
| Empresa | Facturas | Estados |
|---|---|---|
| MSA | 383 | ciclo completo (146 conciliadas, 22 pagadas, 46 pendientes…) |
| **PAM** | **4** | **las 4 en `pendiente`** |
| **MA** | **92** | **84 `pendiente` + 8 `debito`** |

Ninguna FC de PAM/MA tuvo nunca `fecha_pago` ni `grupo_pago_id`: **el circuito no falla a la
mitad, nunca arrancó**. En cambio los **templates de PAM sí concilian** — de los 29 movimientos de
`pam_galicia` + `pam_galicia_cc`, **19 están conciliados contra cuotas de template y 0 contra
facturas**. Eso prueba que el circuito PAM funciona punta a punta; falta enchufar las facturas.

### De dónde sale la empresa de cada fila (la cascada)
| Origen | Fuente | ¿Existe? |
|---|---|---|
| FC compra | el schema donde vive (`msa`/`pam`/`ma`) | ✅ implícito |
| TEMPLATE | `egresos_sin_factura.responsable` | ✅ |
| SUELDO | `sueldos_empleados.empresa` | ⚠️ ver constraint abajo |
| VENTA | el schema: `msa.comprobantes_venta` + `ma.comprobantes_venta` | ✅ (PAM no tiene tabla → pendiente aparte) |
| ANTICIPO | **no hay campo** | 🔴 hay que crearlo |

**`responsable` ES la empresa**, verificado: de 176 templates → MSA 98 · PAM 70 · MA 6 · `Duhau` 1 ·
`MSA/PAM` 1. El selector del wizard ofrece además `Manuel`, `Soledad`, `Merceditas`, `Andres`,
`Jose` y **ninguno se usó nunca**. Por eso va **una sola columna: Empresa**.

**`responsable_interno` es otro eje y no va en esa columna.** Contesta *a quién le corresponde el
gasto*, no quién paga, y ahí sí hay personas. 16 templates lo tienen: ABL/AYSA/Metrogas/Expensas
Libertad → `responsable PAM` / `interno MA`; Imp. Automotores Voyage → `MSA` / `JMS`; Seguro Flota
→ `MSA` / `MSA/MA/JMS`. **Ese campo es el mecanismo de adjudicación entre empresas** (paso 7).

### 🔑 `empresa` es MULTIVALOR, no un valor
Decisión del usuario: un template `MSA/PAM` **se muestra con las dos y aparece al filtrar
cualquiera de las dos**. Se parsea por `/`; el filtro es *"entra si alguna de sus empresas está
tildada"*; los valores que no son MSA/PAM/MA (`Duhau`) **se muestran pero no filtran**.

- **No es una convención nueva**: el Presupuesto ya lee `responsable` así —
  `tab-presupuesto.tsx:614` y `seccion-metodos-templates.tsx:61` hacen
  `.or("responsable.ilike.%MSA%,responsable.eq.ambas")`. Hay que mantener compatibilidad con `ambas`.
- **No complica la escritura**: el multivalor sólo puede darse en templates y sueldos, que viven en
  `public`. Una FC pertenece a **un único schema** por definición. El destino de escritura siempre
  es único; el multivalor afecta sólo qué se muestra y qué se filtra.
- **Efecto aceptado a ojos abiertos**: filtrando MSA y PAM por separado, el template `MSA/PAM`
  aparece **entero en los dos**. Los subtotales por empresa no suman el total. No se puede repartir
  sin porcentajes y no los hay. La pantalla no debe fingir que cierran.

### Defaults (pedido explícito, con su motivo)
**El filtro de empresa NO es uno solo: son dos, porque los defaults difieren.**
- **Facturas** → MSA ✅ · PAM ✅ · **MA ☐ apagado**. *Motivo: las FC de MA las paga MA de su propia
  cuenta y el usuario concilia cada tanto; verlas por default es ruido.*
- **Templates** → MSA ✅ · PAM ✅ · **MA ✅**. *Motivo: son impuestos que paga él siempre; no verlos
  es perder trabajo.*

### Los 7 pasos, en orden
| # | Qué | Estado |
|---|---|---|
| **0** | **Que el guardado avise cuando no matcheó ninguna fila** (`useInlineEditor`) | ✅ 2026-08-07 (`b444c6a`) |
| **1** | `empresas` (lista) en `CashFlowRow` + columna `empresa` en `anticipos_proveedores` | ✅ 2026-08-08 (código + SQL) |
| **2+3** | Leer los 3 schemas **y** escribir en el schema correcto | ✅ 2026-08-08 |
| **4** | Columna Empresa a la izquierda + los dos filtros | ✅ 2026-08-08 |
| **5** | **SICORE, echeq y agrupar sólo MSA** | ✅ 2026-08-08 |
| **6** | Motor: conciliar contra el schema correcto + candidatos de las 3 en el extracto | 🟡 **a medias** |
| **7** | Adjudicación entre empresas (MSA paga, PAM/MA retira) | 🔴 después; no bloquea |

### Lo implementado el 2026-08-08
- **`lib/empresas.ts`** — pieza compartida: `parseEmpresas` (multivalor por `/`, más el alias
  heredado `ambas`), `coincideEmpresa` (entra si **alguna** coincide), `schemaDeFila` /
  `esFilaMsa` (de `origen_tabla`), `COLOR_EMPRESA`.
- **`useMultiCashFlowData`** — lee `comprobantes_arca` de los **tres** schemas en paralelo. Si
  falla MSA se corta (es el corazón del Cash Flow); si falla PAM o MA se avisa por consola y se
  sigue, porque es peor quedarse sin pantalla que sin una empresa. Cada fila lleva `empresas`, y
  las escrituras ARCA (individual, grupo y batch) van al schema de la fila **con `count`**: si
  matchean 0 filas, tiran error en vez de mentir.
- **Vista** — columna **Empresa** primera, con un chip de color por empresa; barra de selección
  **siempre visible** (no dentro de "Filtros avanzados": es contexto, no búsqueda), con las dos
  selecciones y sus defaults. *Limpiar filtros* vuelve a los **defaults**, no a "todo": ver las
  92 FC de MA no es el estado limpio, es el ruidoso.
- **Blindaje** — ECHEQ bloqueado con aviso para PAM/MA; agrupar bloqueado; `pagar` de PAM/MA pasa
  **derecho, sin SICORE y sin exigir `fecha_pago`** (esa exigencia existía sólo porque de esa
  fecha sale la quincena SICORE). El bypass va **después** del hook de TC, para que una FC en
  dólares de PAM siga preguntando el tipo de cambio.
- **Motor** — al conciliar, marca `conciliado` en el schema de la fila y avisa por consola si no
  encontró la factura.

### 🟡 Lo que falta del paso 6
La **conciliación manual** desde el extracto (`vista-extracto-bancario.tsx`, ~10 usos de
`.schema('msa')`) sigue ofreciendo candidatos sólo de MSA: si el movimiento de PAM hay que
vincularlo a mano, la FC de PAM no aparece en la lista. El camino automático (motor) ya funciona.

### ⚠️ El riesgo que hace que el paso 0 vaya primero
`useInlineEditor.ts:153` decide *"si la fila es ARCA → escribir en `msa`"*, fijo. Hoy no molesta
porque todas las filas ARCA son de MSA. En cuanto entren las de PAM/MA, editar una fecha de PAM va
a buscar ese `id` en la tabla de MSA.

**No corrompe**: el `UPDATE` filtra por `id` y un uuid de PAM no existe en MSA → matchea 0 filas.
**Pero tampoco falla**: devuelve OK y la UI dice *"Campo actualizado correctamente"*. El riesgo es
**no registrar en silencio** — el mismo modo de falla que `B-BUG-CLIENTE-NO-SE-CREA`.

Idea del usuario, adoptada como paso 0: **que avise cuando no encontró**. Es más barato y más útil
que un parche puntual, porque `useInlineEditor` lo usan también el extracto, los templates y
productivo — queda como red para todo el desarrollo siguiente.

*Matiz*: sí quedarían huérfanas las filas que se crean en **otras** tablas referenciando el id
(`msa.sicore_retenciones.factura_id`, `msa.grupos_pago`). Se cierra con el paso 5.

### Lo que NO existe fuera de MSA
| Tabla | pam | ma | ¿Hace falta? |
|---|---|---|---|
| `sicore_retenciones` | ❌ | ❌ | **No — SICORE es sólo MSA, decisión firme del usuario. No se habilita nunca** |
| `grupos_pago` | ❌ | ❌ | Sólo si se quiere agrupar FC en una OP |
| `cheques` | ❌ | ❌ | Sólo si se paga con echeq |

### 🔴 EMPEZAR ACÁ si se retoma en otra sesión (estado al 2026-08-08)

**Lo que falta, en orden:**

1. **Testear** → `A-TEST-25`, 7 pasos en `MANUAL-USO.md` § *Cash Flow multiempresa*. Es lo único
   que separa esto de estar terminado en su parte gruesa.
2. **Terminar el paso 6**: la conciliación **manual** del extracto sigue ofreciendo candidatos
   sólo de MSA (~10 `.schema('msa')` en `vista-extracto-bancario.tsx`).

**✅ El SQL ya se corrió** (2026-08-08, por MCP `apply_migration`, verificado antes y después):
Alondra `PAM→MA` · AMS y JMS `ambas→MSA/PAM/MA` · CHECK nuevo con el patrón multiempresa ·
`anticipos_proveedores.empresa` creada con los 33 en `MSA` (+ su propio CHECK). Detalle →
`RECONSTRUCCION_SUPABASE_2026-01-07.md` § *2026-08-07*.

**Recordatorio que costó descubrir**: PostgREST (`supabase-js` + service role) **escribe filas
pero no ejecuta DDL**. Por eso los cambios de datos salieron sin problema y los de estructura
tuvieron que esperar al MCP. Cuando el MCP falla, la alternativa es el **SQL Editor de Supabase**.

**Commits de esta tanda**: `4209572` (plan) · `b444c6a` (paso 0) · `82741f1` (pasos 1-5) ·
`7f2d2a8` (handoff).

### ✅ A-FEAT-13-B — Agrupar pagos de PAM y MA (HECHO 2026-08-08)
**Caso real que lo motivó**: el usuario pagó las **2 facturas de Allende (PAM) juntas, en un solo
pago**, y no podía reflejarlo. Agrupar estaba bloqueado (paso 5) porque `grupos_pago` existía
**sólo en `msa`**; en pam/ma la columna `grupo_pago_id` estaba pero **sin FK**.

**Hecho:** `pam.grupos_pago` y `ma.grupos_pago` creadas como espejo de la de MSA, con las FK y los
grants (migración `grupos_pago_en_pam_y_ma`, detalle en `RECONSTRUCCION_*`). El código casi no
cambió: `lib/pagos/agrupar.ts` y `desagrupar.ts` ya recibían `schema`.

**Lo que sí cambió el criterio del bloqueo** — antes decía *"agrupar es sólo de MSA"*; ahora dice
**"un grupo no puede mezclar empresas"**, que es la restricción real (el grupo y las facturas
comparten schema por la FK). Agrupar FC de PAM con FC de MSA se rechaza con ese aviso.

⚠️ **Templates y sueldos siguen agrupando SIEMPRE en `msa.grupos_pago`**, aunque el template sea de
PAM: sus `grupo_pago_id` tienen FK a **msa**. Por eso el código elige el schema **por origen**, no
por la empresa de la fila. Está comentado en `agrupar.ts` para que no se "corrija" por error.

**Verificado**: los tres `grupos_pago` responden con la **anon key** — PostgREST los ve sin esperar
refresco de caché, así que el agrupar funciona desde la app.

### 🔴 A-FEAT-13-C — Honorarios de JMS y AMS: no deberían estar en el Cash Flow (2026-08-08)
**Planteo del usuario**: JMS y AMS **facturan en bloque** — una sola factura puede cubrir medio año
o un año entero. Esa factura **no es algo a pagar**: entra en una **cuenta corriente** y se va
cancelando contra lo que se les paga, que el usuario registra como **"sueldo"** aunque en realidad
sean **honorarios facturados**. Una factura va contra **muchos pagos**.

**El problema concreto**: como el Cash Flow muestra todo lo no conciliado, esas facturas van a
quedar **eternamente pendientes** y ensuciando la proyección. Hoy son 2 de las 4 FC de PAM:

| Nº | Proveedor | Emisión | Importe | Cuenta |
|---|---|---|---:|---|
| 00001-00000069 | MARTINEZ JOSE MARIA (**JMS**) | 22/06/2026 | $22.735.000 | HONORARIOS JMS |
| 00002-00000061 | MARTINEZ PLACIDO ANDRES (**AMS**) | 26/06/2026 | $25.500.000 | HONORARIOS AMS |

**Estado**: sin resolver y **no urgente** — el usuario lo dijo explícitamente. Pero tampoco se
arregla solo. Su advertencia, textual: *"no debemos crear miles de excepciones"* — o sea que la
salida no es un `if` con dos CUITs adentro.

**Pistas para cuando se retome** (nada decidido):
- Ya existen `JMS` y `MSA/MA/JMS` como `responsable_interno` de templates, y los empleados `JMS` y
  `AMS` están en `sueldos.empleados` con `empresa = MSA/PAM/MA`. O sea que **el sistema ya conoce a
  estas dos personas por dos vías distintas**, y esto es justamente el cruce de ambas.
- Suena a un **estado o marca de "cuenta corriente"** en la factura (no un caso especial por CUIT),
  que la saque del Cash Flow y la mande a un saldo que se cancela con pagos parciales. Emparenta
  con los **anticipos** (un pago que se aplica a una factura) pero al revés: una factura que se
  aplica a muchos pagos.
- Ver también el estado `credito`, que ya saca facturas del Cash Flow — puede ser el molde.

### 🐛 Bugs que destapó el testeo del usuario (2026-08-08)

**1. Marcar una fila-grupo no guardaba nada.** Al pasar el grupo de Allende a *pagar*, saltó
*"No se encontró la factura 1295bb34…: el cambio NO se guardó"*.

**Causa**: en una fila-grupo el `id` es el del **grupo**, no el de una factura. `actualizarBatch`
hacía `UPDATE comprobantes_arca WHERE id = <id del grupo>` → 0 filas. `actualizarRegistro` ya
sabía expandir a `ids_grupo`; **`actualizarBatch` no**.

**Era preexistente y silencioso**, y también afectaba a **MSA**: marcar un grupo desde el modo
Pagos nunca escribió nada, sólo que hasta ahora no había forma de enterarse. Lo destapó el aviso
del **paso 0** — que es exactamente para lo que se hizo. **Fix**: `actualizarBatch` expande a
`ids_grupo`, en ARCA y en templates.

**2. La fila-grupo mostraba el estado fijo en `'pagar'`.** Estaba escrito así en
`mapearFacturasArca`, así que al marcar un grupo como pagado la grilla seguía diciendo *pagar*
después de recargar. **Fix**: el estado sale de los miembros — si todos coinciden, ése; si
difieren, **el menos avanzado**, porque un grupo con una factura sin pagar no puede figurar como
pagado.

**3. La `fecha_pago` cargada en el grupo "desaparecía".** El usuario la puso y al recargar no
estaba. **El dato SÍ se guardaba** (verificado: las 2 FC de Allende quedaron con
`fecha_pago = 2026-08-07`): lo que faltaba era que **la fila-grupo devolviera el campo**.
`mapearFacturasArca` no incluía `fecha_pago` en el objeto del grupo, así que la celda salía vacía.

**Fix**: la fila-grupo devuelve `fecha_pago` (la última de sus miembros, porque un grupo se paga
junto), más `medio_pago` y `nro_cuenta`, que faltaban por el mismo motivo — sin ellos el grupo caía
al medio "banco" por defecto y perdía la cuenta contable al conciliar. **Lo mismo se aplicó a los
templates agrupados**, que tenían el mismo agujero.

> 🧭 **El patrón detrás de los tres bugs, para no repetirlo**: una **fila-grupo es una fila
> sintética** que el hook arma juntando varias. Cada campo que no se copie explícitamente **sale
> vacío o inventado**, y el síntoma no es un error sino un dato que "se pierde". Al tocar
> `mapearFacturasArca` / `mapearTemplatesEgresos`, la pregunta es siempre: *¿esta fila devuelve
> todo lo que la grilla muestra y todo lo que el motor lee?*

> 🔎 **Queda igual, anotado**: la fila-grupo de **sueldos** (`useMultiCashFlowData`, ~l.761)
> también tiene `estado: 'pagar'` fijo y no devuelve `fecha_pago`. No se tocó — es otro módulo y
> no estaba en prueba —, pero es exactamente el mismo patrón.

### 🔎 Dos hallazgos al verificar el pago del grupo (2026-08-08) — preexistentes, sin urgencia
Salieron de revisar en la BD el pago real del grupo de Allende. **Ninguno es del cambio de esta
tanda** y ninguno rompe nada; se anotan para que no se descubran de nuevo desde cero.

1. **`grupos_pago.estado` nunca se sincroniza.** El grupo de Allende quedó en `pagar` con sus 2
   facturas en `pagado`; en MSA pasa en **todos** los grupos (varios dicen `pagar` con las
   facturas ya `conciliado`). **Es inocuo**: el único lugar que lee `grupos_pago` es
   `lib/lotes-galicia/preview-core.ts` y pide `id, cuit, proveedor, monto_total` — **no `estado`**.
   Y desde 2026-08-08 la grilla deriva el estado de los miembros, así que en pantalla se ve bien.
   Es un campo **vestigial**: o se sincroniza, o se saca.
2. **~25 grupos de MSA sin ningún miembro** (ARBA, Municipalidad SP, Consorcio Libertad…):
   quedaron huérfanos cuando sus facturas se desvincularon por otra vía que no fue "desagrupar".
   Basura acumulada. Vale un `DELETE FROM msa.grupos_pago WHERE id NOT IN (…)` cuando se limpie.

> ✅ Lo que **sí** se verificó y quedó bien en el pago real de PAM: las 2 FC en `pagado`, con
> `fecha_pago` y `fecha_estimada` al 07/08, `monto_a_abonar` = total, y **`sicore`, `monto_sicore`
> y `tipo_sicore` en `null`** — el blindaje de SICORE funcionó sobre datos reales.

### ✅ Paso 6 — Conciliación multiempresa (2026-08-08)

**Decisión del usuario, y es la que ordena el diseño**: el extracto de MSA **sí** puede conciliar
una factura de PAM o MA, pero tiene que quedar marcado como **retiro por pago a terceros** —
`RET 3 PAM` / `RET 3 MA`. No es un retiro directo (una transferencia MSA→PAM): es que MSA le pagó
a un tercero algo facturado a PAM.

**🔑 La regla ya existía y no había que inventar nada.** `reglas_contable_interno` tipo
`responsable` (Tab 2 / "Tipo B") tiene configurado desde antes:

| Cuenta | Responsable | → contable |
|---|---|---|
| `msa_galicia` | PAM | **RET 3 PAM** |
| `msa_galicia` | MA | **RET 3 MA** |

Y está en uso: **12 movimientos con `RET 3 PAM` y 9 con `RET 3 MA`** en `msa_galicia.contable`.
Lo que faltaba —y el usuario lo sospechaba— es que **sólo se aplicaba a templates**: el motor la
consultaba nada más en la rama TEMPLATE. Ahora la conciliación manual la aplica también a
**facturas**, comparando la empresa de la factura contra la de la cuenta bancaria.

**Cambios:**
- `cargarFacturasDisponibles` lee las **tres** empresas; cada candidato lleva su `empresa`.
- La rama ARCA de `ejecutarAsignacion` **lee y escribe en el schema de la factura elegida**.
- Si la empresa de la factura ≠ la de la cuenta → busca la regla Tipo B y estampa
  `contable` (y `interno` si la regla lo trae). Lo que el usuario haya escrito a mano **gana**.

**También en el MOTOR automático**: la rama ARCA no consultaba la regla Tipo B (sólo miraba
reglas de texto). Ahora, si la empresa de la factura ≠ la de la cuenta, aplica `RET 3 …` y la
regla de texto queda como respaldo para lo que haya quedado vacío. **Sin esto el arreglo servía
sólo si conciliabas a mano**, que es el camino secundario.

**Chip de empresa en los candidatos**: cada opción muestra su empresa con color, y cuando no
coincide con la cuenta agrega **⇄** con el aviso de que se registrará como retiro. Se ve *antes*
de confirmar, no después en la grilla.

### ✅ La conciliación pisaba el vencimiento de la factura (2026-08-08)
`ejecutarAsignacion` escribía `fecha_vencimiento = fecha del movimiento` sobre la factura ARCA
(`vista-extracto-bancario.tsx` ~l.1282). Es el comportamiento **anterior al refactor de fechas**
de julio, que separó el vencimiento firme de la fecha real de pago: **cada conciliación borraba el
vencimiento original**. Ahora escribe `fecha_pago`.

Los otros dos lugares que parecían el mismo bug **no lo eran**: crean una cuota **nueva** desde el
movimiento, donde la fecha del banco es lo único que se sabe. Ahí lo que faltaba era `fecha_pago`,
y se agregó (motor y manual).

### ✅ A-BUG-05 — la asignación manual borraba datos (2026-08-08)
Tres de los cuatro puntos del dossier, corregidos en las 4 ramas (template · ARCA · sueldo · grupo):
1. **`detalle: null` fijo** → se preserva lo que el usuario escribió y, si no hay, se **deriva**
   (`FC 1234 — Proveedor`, `Nombre template — Proveedor`, `Grupo de N — Proveedor`). En la rama de
   sueldos se usa el `detalleSueldo` que **ya se calculaba y se descartaba**.
2. **`proveedor_nombre` pisado con null** cuando el CUIT no está en `proveedores` → ahora sólo se
   escribe si hay un nombre; si no, se conserva lo que hubiera.
3. **`nro_cuenta` sin fallback** en la rama ARCA → ahora, si la factura no lo tiene, se deriva de
   `cuentas_contables` por la categ, igual que hace el motor.

4. **La rama TEMPLATE tampoco llenaba `nro_cuenta`** (punto 3 del dossier) → ahora lo deriva de
   `cuentas_contables` por la categ, igual que la rama ARCA.

**A-BUG-05 queda cerrado en sus 4 puntos.**

### 🔧 Tanda de conciliación — qué se mejoró y qué queda (2026-08-08)

Informe completo con los datos de la BD, ejemplos y propuestas:
**artifact `de1f4519`** — *"Cómo se decide contable e interno al conciliar"*.

#### ✅ Mejorado
| # | Qué | Detalle |
|---|---|---|
| **A-BUG-06** | Los candidatos al reasignar eran erráticos | Comparaba la descripción del banco contra **la primera palabra** del proveedor: `LA MERCURE S.R.L.` buscaba `la` y matcheaba casi todo; `DE NEVARES…` buscaba `de`. Ahora parte el nombre en palabras con contenido (≥4 letras, sin `srl`/`sociedad`/etc.) y alcanza con que la descripción nombre alguna. Verificado con 8 casos reales `@extracto` |
| **A-BUG-06b** | **Los ingresos no recibían ninguna propuesta** | El monto se comparaba sólo contra `debitos`, que en un crédito es 0 → división por cero. Ahora usa débito **o** crédito. Eran **6 de los 39** pendientes de MSA |
| **A-BUG-06c** | Sin tilde no matcheaba | Usaba `toLowerCase()` en vez del `normalizarBusqueda` que el proyecto ya tenía |
| **A-BUG-07** | El motor dejaba el movimiento ilegible | Escribía `detalle_usuario \|\| null`: un template conciliado quedaba trazado por ID pero sin decir qué era. Ahora aplica **la misma convención que el manual**: lo que el usuario escribió → si no, `<comprobante> — <proveedor>` `@extracto` |
| **A-FEAT-03** | Códigos contable/interno de texto libre | `<datalist>` con los códigos **ya usados en esa cuenta**, en el modal de asignación **y en el panel de edición masiva** — que es donde más fácil se cuelan variantes, porque el valor se aplica a muchos movimientos de una. Se recargan al cambiar de cuenta. Motivo: conviven `RET 3 PAM`, `RET PAM`, `RET 1 PAM`, y `Ver` con `VER` `@extracto` |
| **Chip de empresa** | En **facturas, templates, sueldos y grupos** | Entiende la lista (`MSA/PAM`) y no marca retiro si **alguna** de sus empresas es la de la cuenta. En grupos, la empresa es la **unión** de la de sus miembros |
| **A-FEAT-02** | ⚠️ **Ya estaba resuelto** | El dossier decía que Editar no ofrecía templates. **Está desactualizado**: el combobox "Vincular a" del panel masivo se alimenta de `[...facturasFormateadas, ...templatesFormateados]`, o sea que ofrece las dos cosas desde antes. Sólo falta verificarlo en pantalla `@extracto` |
| **Dato** | `Aportes Domesticas (MA)` | `RET MA` → **`RET 3 MA`** (corregido a pedido del usuario) |

#### ⏳ Pendientes de DEFINICIÓN del usuario
| # | Qué falta decidir |
|---|---|
| **Fallback sin regla** | Si ninguna capa responde y las empresas difieren: ¿estampar `RET 3 <empresa>` igual **y** dejarlo en `auditar`, o dejarlo vacío? Hoy queda **conciliado y vacío, sin avisar**. Postergado por el usuario hasta terminar bugs y feats |
| **Dirección inversa (`AP`)** | Si PAM/MA pagan algo de MSA. No hay ninguna regla ni un solo movimiento con ese código; la doc propone `AP 3 …` pero está sin definir. El usuario: *"deberíamos ir viéndolo aunque no es común"* |
| **A-FEAT-04 — SICORE** | Criterio ya dado por el usuario: la retención puntual es `DIST MA` si el pago lo es, pero **el pago total de SICORE en el extracto no puede serlo** — va como los `Desglosar`, **registrando el desglose en el momento** y sin quedar como revisión manual. Falta diseñar cómo |
| **Poblar las 9 cuentas sin reglas** | `pam_galicia` (6 movs pendientes, **cero reglas de ambas clases**), `ma_galicia`, 3 cajas y 3 tarjetas. Las cajas y tarjetas **ya obedecen el mismo motor**: lo que falta son las reglas, no el código |

#### 🔴 Pendientes de TRABAJO (acordados, sin hacer)
| # | Qué |
|---|---|
| **A-BUG-09** | Auditar los movimientos que quedaron sin conciliar existiendo una fila del Cash Flow por el mismo monto, y convertir cada caso en regla. **Acordado hacerlo ANTES de conciliar en masa** `@extracto` |
| **A-FEAT-01** | Está implementado (corre sólo sobre lo filtrado, con aviso). **Falta testear.** ⚠️ El límite de 100 registros **no** cuenta como filtro `@extracto` |
| **Regla específica por proveedor** | La capa 1 exige `template_id`, así que una **factura** recurrente no puede tener tratamiento propio |

### ✅ Re-parseo de extractos + aviso de movimientos sin desglosar (2026-08-09)

**El problema**: el banco manda toda la info apilada en una celda (tipo, CUIT, beneficiario, nº de
operación) y las reglas de `config_parseo_extracto` la reparten en columnas. Pero **las reglas sólo
corrían al importar**: si faltaba la de un tipo, el movimiento quedaba sin desglosar y la única
salida era volver a subir el Excel.

> ✅ **Lo que NO pasa, y conviene tenerlo claro**: el dato **no se pierde**. El importador guarda el
> texto crudo del banco en `concepto`, **siempre**, haya regla o no (verificado: 96 de 96 en MA).
> Lo que falta es el desglose, no la información.

#### Lo que se hizo
1. **`lib/extractos/parseo-movimiento.ts`** — la lógica salió del importador a una lib compartida.
   La usan el importador y el re-parseo. **Es una sola a propósito**: dos copias podrían divergir y
   un movimiento quedaría distinto según por dónde entró, sin forma de notarlo en la grilla.
2. **`POST /api/reparsear-extracto`** — aplica las reglas sobre lo ya importado, leyendo `concepto`.
   **Pasada en seco por defecto**: informa qué cambiaría y no toca nada hasta que se confirme.
   Acepta `tipo` para probar una regla nueva de a una. Sólo escribe los campos del desglose —
   `categ`, `detalle`, `contable`, `interno` y el estado **no se tocan**.
3. **`GET /api/reparsear-extracto?cuenta=…`** — diagnóstico puro: qué tipos hay y cuáles no tienen
   regla propia, ordenados por cantidad.
4. **Botón "Re-parsear"** en Extracto Bancario, sólo visible en cuentas de Caja de Ahorro.
5. **`AlertaParseoPendiente`** en Principal: cuántos movimientos están sin desglosar y **qué tipos**,
   ordenados por volumen — o sea, qué regla conviene escribir primero.

#### La verificación que vale
Correr el re-parseo en seco sobre **PAM**, que sí tiene reglas, devuelve
*"Nada que cambiar: el desglose guardado ya coincide con lo que dan las reglas actuales."*
Eso prueba que el re-parseo es **fiel al importador** — y sólo se puede afirmar porque comparten
el código.

#### El diagnóstico que dejó al descubierto
`GET` sobre `ma_galicia`: **96 de 96 sin desglosar**, en 12 tipos. Y sobre `pam_galicia`, 21 de 25.

⚠️ **Las 49 reglas existentes casi no aplican a lo que se está cargando.** Cubren 21 tipos, pero
los que aparecen son otros — y varios fallan por diferencias mínimas de nombre, porque **el match
del tipo es exacto**:

| Aparece | Regla que existe | Matchea |
|---|---|---|
| `COMPRA DEBITO` (33 en MA) | `COMPRA CON DEBITO` | ❌ por el "CON" |
| `EXTRACCION EN AUTOSERVICIO` (12) · `EXTRACCION CAJERO` | `EXTRACCION` | ❌ |
| `INTERES CAPITALIZADO` (3 MA + 6 PAM) | `ACREDITACION INTERESES` | ❌ |
| `PAGO TARJETA VISA` · `SERVICIO PAGO A PROVEEDORES` · `REINTEGRO PROMOCION GALICIA` · `COM. CAJA DE SEGURIDAD` | — | ❌ |

**Por eso copiar las reglas de PAM a MA no alcanza**: cubriría 3 de sus 12 tipos. Lo que destraba
es **escribir las reglas de los tipos que realmente aparecen**, que sirven para las dos cuentas.

#### 🔴 Pendiente — necesita criterio del usuario
Escribir las ~15 reglas de los tipos reales. El reparto es decisión suya; ejemplo de MA:
```
COMPRA DEBITO
MIMADOS                 ← ¿el comercio, a leyendas_1?
4517XXXXXXXXXX29        ← ¿la tarjeta enmascarada, a leyendas_3?
A381                    ← ¿el código de autorización, a numero_de_comprobante?
```
Con el re-parseo se pueden probar de a una sobre datos reales, sin re-importar.

#### ✅ Y la pantalla que faltaba (2026-08-09)
`config_parseo_extracto` **no tenía UI**: no se podían ver, crear ni editar las reglas, y las 49 de
PAM se habían cargado por SQL. Sin poder verlas era imposible saber por qué un movimiento no se
desglosaba.

Ahora hay una tercera solapa en **Extracto Bancario → Configuración**: *"Reglas de Parseo (import)"*.
Las otras dos son de **conciliación** — otra tabla y otro momento; el rótulo lo aclara.

Lo que la hace útil de verdad: **muestra primero los tipos SIN regla**, ordenados por cantidad de
movimientos, y con un **movimiento real de ejemplo con las líneas numeradas**:

```
1  COMPRA DEBITO
2  MIMADOS
3  4517XXXXXXXXXX29
4  A381
```

Así la regla se escribe mirando el texto en vez de adivinando qué hay en cada línea. El tipo se
guarda **en mayúscula** porque el match es exacto, y el grupo de conceptos se hereda del que ya
tenga el tipo (con sugerencias de los usados) para no generar variantes.

Al crear una regla avisa que **no cambia sola lo ya importado**: hay que correr *Re-parsear*.

---

## 🧩 Huecos del parseo — encontrados al revisar los datos (2026-08-09)

> Los cuatro salieron de una sola revisión con el usuario. **Él decidió no arreglarlos de a uno:
> se ven todos juntos al final.** Índice → § Parseo de extractos.

### 🔴 <a id="a-bug-14"></a>A-BUG-14 — PAM perdió el CUIT en 2 de 25 movimientos

**La distinción que importa, y que corrigió el usuario**: en **MA no se parseó nunca** —cero reglas
cargadas—, así que sus 32 movimientos con CUIT sin desglosar **no son un fallo del parseo**: son
trabajo que no se hizo todavía. **PAM es otra cosa**: tiene 49 reglas corriendo desde el import, y
aun así 2 movimientos entraron con el CUIT en el texto y sin CUIT en la columna.

| Movimiento | Tipo | ¿Tiene regla el tipo? |
|---|---|---|
| `20044390222` en la línea 3 | `TRANSFERENCIA DE CUENTA PROPIA` | ❌ no |
| `30692138747` en la línea 3 | `PAGO CON TRANSFERENCIA` | ❌ no |

**Causa medida**: los dos tipos no están entre los 21 que cubren las reglas. O sea que el mecanismo
es el mismo que en MA (falta la regla), pero **en PAM eso no debería pasar**, porque la cuenta se dio
por parseada. Lo que hay que revisar no es el parser: es **por qué el set de 49 reglas se dio por
completo**. De sus 21 tipos, **sólo 2 aparecen en los 25 movimientos cargados** — los otros 19 se
escribieron por SQL anticipando movimientos que nunca llegaron.

**Por qué duele**: `leyendas_adicionales_2` es de donde el motor lee el CUIT
(`useMotorConciliacion.ts:239`) y donde `useVinculacionAnticipo.ts:116` compara con `.eq()` exacto.
Sin CUIT, la contraparte no matchea y la conciliación no dice por qué.

### 🔴 <a id="a-bug-15"></a>A-BUG-15 — `Nro Operacion:` no lo agarra el modo *Nº de operación*

El modo busca `OP:` o `OPERACION` **seguido de espacio**. Verificado contra el regex real de
`lib/extractos/parseo-movimiento.ts`:

```
"OP:99O31012026F"           -> 99O31012026F     ✅
"OPERACION 6150935348"      -> 6150935348       ✅
"Nro Operacion: 200112733"  -> (NO MATCHEA)     ❌ los dos puntos
```

El plan B tampoco lo salva: sólo mira renglones que sean **puramente** numéricos, y ése no lo es.

**Dónde aparece**: `SUSCRIPCION FIMA` en MA. Hoy es 1 movimiento, pero es una **colocación** — plata
que sigue siendo de la empresa (§ Templates: lo `financiero` no se presupuesta), así que va a repetirse.

**El fix es de una línea** en `parseo-movimiento.ts`, aceptando el formato con dos puntos. ⚠️ Toca la
**función compartida con el importador**: cambiarla cambia también cómo entra lo nuevo. No se tocó.

### 🟡 <a id="a-bug-16"></a>A-BUG-16 — Una regla por número de línea puede meter el CBU en la columna del CUIT

**El riesgo, concreto.** Nada impide escribir `línea 3 → leyendas_adicionales_2`. En las
transferencias de MA la línea 3 es el **CBU**:

```
1  TRANSFERENCIA A TERCEROS
2  NO  27300503905            ← el CUIT
3  0140363103650054482399     ← el CBU: también sólo números, también creíble
```

El resultado sería un dato plausible en la columna equivocada, **23 veces**. Y como el motor compara
por igualdad exacta, la contraparte simplemente deja de matchear: sin error, sin aviso, sin nada que
mirar. Es *el silencio miente* otra vez.

**Estado hoy** (verificado sobre los datos, no supuesto): la convención **se respeta**. Las únicas 4
reglas que escriben en `leyendas_adicionales_2` son modo `cuit`, y las únicas 4 reglas modo `cuit`
van a esa columna — relación 1 a 1. No hay ningún valor que no sea un CUIT de 11 dígitos ahí, en
ninguna de las dos cuentas.

**Mitigación aplicada** (`95f705b`), que **no cierra el ítem**: la pantalla avisa en ámbar si se
elige esa columna con un modo distinto de `cuit`, y muestra en vivo qué extraería la regla. Sigue
siendo posible guardarla igual — es un aviso, no una validación. **Decidir al repasar**: si se
bloquea directamente, o si se deja como aviso.

> Nota: el modo `cuit` **no puede** equivocarse de dato por construcción — exige 11 dígitos exactos
> tras sacar el prefijo `CU`/`NO`, así que un CBU (22) o una tarjeta con `X` no pasan el filtro.

### 🔴 <a id="a-bug-17"></a>A-BUG-17 — Un mismo tipo llega con dos formatos, y las reglas por línea fallan en el 30 %

**Encontrado 2026-08-09**, revisando las 34 reglas que cargó el usuario en MA. Es el hallazgo más
caro de la tanda y **no lo detecta ninguna pantalla hoy**.

`TRANSFERENCIA A TERCEROS` no tiene una forma: tiene **dos**.

```
7 movimientos, 5 líneas          16 movimientos, 6 líneas
1 TRANSFERENCIA A TERCEROS       1 TRANSFERENCIA A TERCEROS
2 MARTINEZ PLACIDO ANDRES ←nombre 2 NO  27300503905          ←CUIT
3 20287492546             ←CUIT   3 0140363103650054482399   ←CBU
4 VARIOS                          4 LINK
5 BANCO DE GALICIA…               5 4517XXXXXXXXXX11
                                  6 VARIOS
```

**El CUIT está en la línea 3 en una y en la 2 en la otra.** Las reglas cargadas son:

| Regla | En los 16 de 6 líneas | En los 7 de 5 líneas |
|---|---|---|
| `cuit → leyendas_2` | ✅ el CUIT | ✅ **el CUIT igual** — por eso el modo `cuit` es el correcto |
| `línea 3 → nro_comprobante` | el CBU | ❌ **el CUIT**, duplicado en otra columna |
| `línea 5 → nro_terminal` | la tarjeta | ❌ **«BANCO DE GALICIA Y BUENOS AIRES SAU»** |

Y en los 7 con nombre, **`MARTINEZ PLACIDO ANDRES` se pierde**: no hay regla `pre_cuit`, que es la
que lo agarraría en los dos formatos (en el de 6 líneas devuelve vacío, correctamente, porque ahí
no hay nombre).

**La lección, que vale más que el caso**: la regla `cuit` acertó en las dos formas porque **busca**;
las reglas `línea N` acertaron sólo en la forma que el usuario tenía delante. Es la misma falla de
siempre — nada avisa, las columnas se llenan igual, y el nombre de un banco pasa por un número de
terminal sin que nadie lo mire.

**Qué haría falta (→ A-FEAT-15)**: que la pantalla, en vez de un movimiento de ejemplo por tipo,
detecte **cuántos formatos distintos** tiene y los muestre. Con "23 movimientos · 2 formatos" a la
vista, esto no pasaba. Hoy `GET /api/reparsear-extracto` devuelve `lineas` del **primer** movimiento
que encuentra, sin mirar si los demás coinciden.

**Mitigación mientras tanto**: preferir `cuit` / `pre_cuit` / `post_cuit` sobre `línea N` siempre que
haya un CUIT en el texto.

⚠️ **Antes de tocar las reglas hay que decidir con el usuario** — son datos suyos, ya cargados.

### 🔴 <a id="a-feat-18"></a>A-FEAT-18 — La identidad de un tipo debería ser 1ª línea **+ cantidad de líneas**

**Idea del usuario, 2026-08-09**, y es la raíz de [A-BUG-17](#a-bug-17):

> *"si me proponía un tipo para 40 movimientos es porque ya se auditó que los 40 tienen 5 líneas,
> son homogéneos. ¿Eso está controlado previo? Porque si no está controlado, luego segmentará
> errores. Sería 1ª línea más cantidad de líneas."*

**Respuesta honesta: NO está controlado.** `GET /api/reparsear-extracto` agrupa por la primera línea
y se queda con **el primer movimiento que encuentra** como ejemplo, sin mirar si los demás tienen la
misma forma. Por eso `TRANSFERENCIA A TERCEROS` se mostró como un tipo homogéneo de 6 líneas cuando
en realidad son dos formas, y las reglas por número de línea fallan en 7 de 23.

Y el razonamiento del usuario es el correcto: **la cantidad de líneas es parte de lo que define el
tipo**. Con dos formatos distintos no es un tipo con excepciones — son dos tipos.

#### Dos caminos, con costos distintos

| | Qué implica | Costo |
|---|---|---|
| **A · Sólo mostrar** | La pantalla detecta los formatos y los muestra por separado, con su ejemplo y su conteo. La identidad en BD sigue siendo la 1ª línea | Sin tocar la BD. **No impide** escribir una regla que falle en el otro formato |
| **B · Identidad real** | `config_parseo_extracto` gana una columna `cantidad_lineas` (nullable: `null` = aplica a todos los formatos). El parseo elige el set que coincide | ⚠️ **Cambio de estructura** — requiere acuerdo del usuario y MCP en write |

**Recomendación**: hacer **A** ya, porque tapa el modo de falla (nadie escribe a ciegas una regla
para un formato que no vio) y no toca datos. **B** queda para cuando aparezca un tipo donde los dos
formatos necesiten reglas realmente distintas — hoy `TRANSFERENCIA A TERCEROS` se resuelve con los
modos que buscan (`cuit`, `pre_cuit`), sin necesidad de partir el tipo.

> ℹ️ **A y B no son alternativas: A está contenido en B.** No se pueden ofrecer reglas por formato
> sin antes detectar los formatos. Hacer A no cierra ninguna puerta.

#### ⚠️ Corrección a la propuesta original de B
Decía *"una columna `cantidad_lineas`"*. **No alcanza**, y lo demostraron los datos apenas A
estuvo corriendo: `TRANSFERENCIA A TERCEROS` tiene **dos formas de 6 líneas** con la 5 y la 6
cambiadas de lugar. Contra "6 líneas" las dos caerían en el mismo juego de reglas y volveríamos al
problema original. La columna guarda **la firma completa** — cantidad + clase de cada línea.

#### ✅ CAMINO B — HECHO 2026-08-10, falta el SQL y testear

**Por qué los modos que buscan no alcanzaban** (planteo del usuario, y tenía razón): resuelven el
CUIT (`cuit`) y el nombre (`pre_cuit`) en las 3 formas, pero **no el CBU, ni la tarjeta, ni el
concepto**. Y el concepto no tiene arreglo por búsqueda: `VARIOS` está en la línea 6, 5 y 4 según la
forma, y **no hay ninguna señal en el texto** que permita reconocerlo — es texto suelto. Para eso
hacen falta reglas por forma.

| Lo que se hizo | Dónde |
|---|---|
| `firma_forma` en las reglas · `null` = vale para todas las formas | `sql/2026-08-10_firma_forma_parseo.sql` |
| `resolverReglas()` — genéricas + las de la forma; ante el mismo campo **manda la específica** | `lib/extractos/parseo-movimiento.ts` |
| **Si el tipo tiene reglas por forma y ninguna es de ésta → NO se parsea** (`GRUPO_FORMA_NUEVA`) | ídem |
| Cada regla elige su alcance; por defecto **buscar → todas**, **contar líneas → sólo su forma** | la pantalla |
| Cada forma muestra si está **sin cubrir**, y el diagnóstico cuenta `formasNuevas` | pantalla + `GET` |

**La decisión de no parsear es del usuario** (2026-08-10): *"si no coincidiera con la firma debería
no parsearse, así nos da la chance de evaluar si apareció una nueva firma"*. Es lo contrario de lo
que hace el sistema en todos lados: acá **preferimos el hueco visible al dato plausible**. El texto
crudo sigue entero en `concepto`, así que un re-parseo lo resuelve apenas se escriba la regla.

**Verificado antes de commitear** (servidor limpio, sin el ALTER corrido): 12 tipos, 16 formas,
**ninguna sin cubrir**, `formasNuevas: 0`. O sea que **el código funciona igual antes y después del
SQL** — hasta que existan reglas con firma, todo se resuelve como hoy. `cargarReglasParseo` usa
`select("*")` justamente para eso: con el listado explícito de columnas, la consulta fallaría en
cualquier entorno donde el ALTER no se corrió todavía.

✅ **SQL corrido 2026-08-10.** No había MCP de Supabase en la sesión (sus tools no estaban en el
toolset, aunque la config estuviera en write), y tampoco hay RPC de SQL. Se corrió por la
**Management API** con el token del `.mcp.json` — que es lo que el MCP llama por debajo.
Control posterior: `ma_galicia` 42 reglas y `pam_galicia` 49, **las 91 en `NULL`** = valen para
todas las formas. Ninguna fila modificada.

#### ✅ CAMINO A — HECHO 2026-08-10, falta testear

`firmaDeMovimiento()` en la lib · `GET /api/reparsear-extracto` agrupa por tipo **y por forma** ·
la pantalla muestra todas las formas y evalúa **cada regla en todas ellas**, marcando en ámbar
cuando trae clases distintas.

**Y la firma con clase por línea se justificó sola.** Verificado contra el endpoint real, **2 de los
4 casos multiformato NO se detectan contando líneas** — tienen la misma cantidad y las líneas
cambiadas de lugar:

```
TRANSFERENCIA A TERCEROS — 3 formas, no 2
  6 líneas · 12 mov   … | LINK | 4517XXXXXXXXXX11 | VARIOS
  6 líneas ·  4 mov   … | LINK | VARIOS | 4517XXXXXXXXXX11   ← 5 y 6 al revés
  5 líneas ·  7 mov   … | MARTINEZ PLACIDO ANDRES | 20287492546 | VARIOS | BANCO…

DEB. AUTOM. DE SERV. — 2 formas, las dos de 5 líneas
  3 mov   … | CONSUMO    | 004105544412  | 0000055193
  2 mov   … | CUOTA ACA  | 0226 - 0226   | 432063165     ← la 4 es texto, no número
```

La regla `línea 5 → nro_terminal` que ya está cargada trae **la tarjeta** en 12 movimientos,
**«VARIOS»** en 4 y **«BANCO DE GALICIA Y BUENOS AIRES SAU»** en 7. Tres cosas distintas en la
misma columna, y hasta ahora ninguna pantalla lo mostraba.

**Ojo con el conteo anterior**: [A-BUG-17](#a-bug-17) decía *"16 con 6 líneas y 7 con 5"*. Son
**12 + 4 + 7**: los de 6 líneas también se parten en dos. El diagnóstico viejo no podía verlo.

#### El chequeo extra que pidió el usuario
Además de la cantidad de líneas, conviene una **firma de forma**: qué clase de dato hay en cada
línea (`CUIT` / `CBU` / `numérico` / `texto`). Dos movimientos con 5 líneas pueden ser formas
distintas si en uno la línea 3 es un CUIT y en el otro un importe. La firma se calcula con los
detectores que ya existen en `proponerMapeo()` — **no hay que escribir nada nuevo para reconocerlas**.

### 🔴 <a id="a-feat-19"></a>A-FEAT-19 — Chequeo de consistencia de las reglas cargadas

**Pedido del usuario**: *"no sé si adjudiqué bien las columnas"*. Hoy no hay forma de saberlo sin
leer las 34 reglas una por una.

**Qué debería marcar** — todo esto es calculable con lo que ya está en la BD:

| Chequeo | Ejemplo real encontrado a mano |
|---|---|
| Una regla que da **vacío** sobre los movimientos reales | (la pantalla ya lo muestra por tipo; falta el resumen) |
| La **misma clase de dato en columnas distintas** según el tipo | tarjeta → `nro_terminal` en uno y `nro_comprobante` en otro → [A-FEAT-16](#a-feat-16) |
| Una columna que **mezcla clases** | `nro_comprobante` con `Enero 2026` y con `A837` |
| Un tipo con **más de un formato** y reglas por número de línea | [A-BUG-17](#a-bug-17) |
| Un CUIT que **no valida** el prefijo (20/23/24/27/30/33/34) | el motor lo descarta en silencio (`useMotorConciliacion.ts:246`) |
| Un tipo **sin regla de CUIT** teniendo CUIT en el texto | es plata que no se puede vincular a un proveedor |
| **La columna del CUIT contaminada** | 🔴 medido 2026-08-10: en `msa_galicia`, `leyendas_2` tiene **421 valores y sólo 219 son CUIT** — el resto es `"Nro Operacion: 188923636"` y similares. En `pam_galicia_cc`, 35 y 12. No rompe nada (`extraerCuitBancario` exige 11 dígitos y prefijo válido) pero **en esos movimientos el pre-filtro por CUIT no se enciende**, y es la mejor herramienta de conciliación que ya existe. ⚠️ Viene del **importador de CC**, que mapea las columnas del banco sin validar qué cae en cada una — o sea que el alcance de este chequeo es mayor de lo pensado: no es sólo auditar las reglas nuevas de CA |

**Dónde vivir**: al lado de *Re-parsear*, como una pasada en seco más — informa, no corrige.

### 🟡 <a id="a-feat-16"></a>A-FEAT-16 — Tarjeta y autorización van a columnas invertidas según el tipo

En las reglas de MA cargadas 2026-08-09, el mismo par de datos va a columnas opuestas:

| Tipo | Tarjeta `4517XXXX…` | Autorización `A837` |
|---|---|---|
| `COMPRA DEBITO` (33 mov.) | `numero_de_terminal` | `numero_de_comprobante` |
| `EXTRACCION CAJERO` | `numero_de_comprobante` | `numero_de_terminal` |
| `PAGO DE SERVICIOS` | `leyendas_adicionales_3` | `leyendas_adicionales_4` |

No rompe nada hoy, pero **vuelve inútil filtrar por columna**: buscar todas las operaciones de una
tarjeta requiere mirar tres columnas distintas. Conviene fijar una convención y unificar.

Relacionado: en `INTERES CAPITALIZADO` y `PAGO TARJETA VISA` el `numero_de_comprobante` guarda
`Enero 2026` y `D.A. AL VTO` — texto, no comprobantes. Misma decisión de fondo: **qué significa cada
columna**, y respetarlo.

### ✅ <a id="a-feat-14"></a>A-FEAT-14 — Las reglas vigentes no muestran su ejemplo (HECHO 2026-08-09)

**Pedido del usuario, 2026-08-09**: los ejemplos tienen que verse **en las reglas vigentes**, no sólo
en los tipos sin regla.

Hoy el movimiento de ejemplo llega desde `GET /api/reparsear-extracto`, que **sólo devuelve los
tipos SIN regla propia** (`tiposSinRegla`). Consecuencias:
- un tipo ya resuelto se muestra como una lista de `modo → columna`, sin el texto del que salió;
- al **editar** una regla, `abrirEdicion()` busca el ejemplo en esa misma lista y no lo encuentra, así
  que **la vista previa queda vacía justo donde más se necesita** — modificando algo que ya corre.

**Resuelto (`9cffeef`)**: `GET` devuelve `tipos` — todos los presentes, con ejemplo y `conRegla` —
y mantiene `tiposSinRegla` con la forma vieja para no tocar la alerta de Principal. Cada tipo
configurado muestra el movimiento real al lado de lo que extrae cada regla, con **vacío en rojo**
si no saca nada. Falta testear → [A-TEST-26](#a-test-26).

### ✅ Y el editor pasó a ser del TIPO, no de la regla (2026-08-09, `9cffeef`)

**Pedido del usuario**: *"si pongo crear regla para un tipo que tiene 5 líneas, de 5 líneas para
crear las 5 reglas"*. Tenía razón — el modal mostraba un tipo de N líneas y dejaba hacer **una**
regla, obligando a abrirlo N veces acordándose de cuál era cuál.

Ahora es **una fila por línea**, con: qué reconoció, cómo se extrae, a qué columna va y **qué
quedaría** (vista previa por línea, con `aplicarRegla()`, la función que corre al importar).
**«— sin asignar —»** está en todos los selects, porque no asignar también es una decisión.

**Y lo que ya sabemos no se pregunta** — `proponerMapeo()` en la lib compartida:

| Detecta | Cómo | Propone | Modo |
|---|---|---|---|
| CUIT | 11 dígitos, con o sin `CU`/`NO` | `leyendas_2` | **`cuit`** (busca, no cuenta) |
| Nombre | la línea justo antes del CUIT | `leyendas_1` | `pre_cuit` |
| Tipo | siempre la línea 1 | `descripcion` | `linea 1` |
| Nº de operación | `OP:` u `OPERACION␣` | `nro_comprobante` | `nro_operacion` |
| **CBU** | 22 dígitos | **sin asignar** | — |
| **Tarjeta** | enmascarada con `XXXX` | **sin asignar** | — |

Cada fila dice **por qué**, y lo no seguro va marcado `sugerido`.

> 🔑 **El criterio de las dos últimas**: el CBU **se reconoce, y justo por eso no se asigna**. No hay
> columna de CBU, y meterlo en la del CUIT es [A-BUG-16](#a-bug-16). Un dato creíble en la columna
> equivocada es peor que un dato ausente, porque nadie lo va a revisar.

Verificado contra `DEB. AUTOM. DE SERV.` de PAM: la propuesta reproduce casi exactamente las 5
reglas que estaban cargadas por SQL.

---

## <a id="a-feat-17"></a>A-FEAT-17 — Reglas de conciliación a partir del parseo (propuesta, 2026-08-09)

> **Pedido del usuario**: *"aprovechar esto para la creación de reglas de conciliación, ya que mucho
> se puede hacer desde acá… si hay CUIT para pagos o cobros habrá que ver si hay proveedor cargado
> con factura a conciliar y ahí seguramente podemos hacer algo."*

**Es análisis y propuesta. No hay código escrito.**

### Punto de partida medido (BD, 2026-08-09)

| | |
|---|---|
| Reglas de conciliación existentes | **77** — 41 en `msa_galicia`, 36 en `pam_galicia_cc` |
| De ésas, buscan por `descripcion` | **75** |
| Buscan por `cuit` | **2** (ambas en `pam_galicia_cc`) |
| Cuentas de **Caja de Ahorro** con reglas de conciliación | **ninguna** |
| Proveedores con CUIT cargado | **154** |

O sea: las reglas de conciliación viven en las cuentas corrientes y buscan casi siempre en
`descripcion`. **En Caja de Ahorro no hay ninguna**, y ahí `descripcion` es sólo el tipo de
movimiento — no alcanza para decidir nada.

### 🔴 <a id="a-bug-18"></a>A-BUG-18 — El hallazgo que condiciona todo lo demás

**Una regla de conciliación con `columna_busqueda: 'cuit'` NO mira donde el parseo escribe el CUIT.**

```ts
// hooks/useMotorConciliacion.ts:203-206
case 'cuit':
  valorCampo = movimiento.numero_de_comprobante || movimiento.observaciones_cliente || ''
```

Pero el parseo lo guarda en **`leyendas_adicionales_2`**, que es de donde lo lee el *otro* mecanismo
del mismo archivo:

```ts
// hooks/useMotorConciliacion.ts:239-247 — el pre-filtro
const valor = (mov.leyendas_adicionales_2 || …).trim()
```

**Hay dos lugares distintos buscando la misma cosa.** El pre-filtro mira la columna correcta; las
reglas por CUIT miran otra. En Caja de Ahorro, una regla por CUIT **nunca puede matchear**.

Las 2 reglas que existen funcionan porque están en una **cuenta corriente**, cuyo importador llena
`numero_de_comprobante` directamente desde la columna del banco. Nadie lo notó porque en CC funciona
y en CA no hay reglas todavía. *El silencio miente* otra vez.

> ⚠️ Y hay un agravante que ya está en los datos: en `TRANSFERENCIA A TERCEROS` de MA la regla
> `línea 3 → numero_de_comprobante` mete **el CBU** en los movimientos de 6 líneas y **el CUIT** en
> los de 5. O sea que una regla por CUIT ahí matchearía **a veces**, por accidente. Peor que no
> matchear nunca.

**Fix**: que `case 'cuit'` lea también `leyendas_adicionales_2` — y ponerla **primero**, porque es
la columna canónica. Es un cambio de 1 línea en el motor, pero **cambia cómo concilia**: hay que
correrlo primero en seco y decidirlo con el usuario.

### La propuesta, en 4 niveles

Ordenados por **retorno sobre trabajo**. El primero no requiere escribir ninguna regla.

#### Nivel 0 — Ya funciona solo: el pre-filtro por CUIT

**Esto es lo más importante del documento.** El motor **ya** hace lo que pide el usuario:

```ts
// Pre-filtro por CUIT: si el banco informa CUIT, buscar sólo en ese proveedor
const cuitBancario = extraerCuitBancario(movimiento)
const candidatos = cuitBancario
  ? cashFlowData.filter(cf => cf.cuit_proveedor === cuitBancario)
  : cashFlowData
```

Es decir: **escribir la regla de parseo `cuit → leyendas_adicionales_2` ya enciende maquinaria que
existe**. El movimiento deja de compararse contra todo el Cash Flow y se compara sólo contra las
facturas y templates de ese proveedor. No hay que crear ninguna regla de conciliación para eso.

Detalles verificados que conviene saber:
- **Valida el prefijo** del CUIT (20/23/24/27/30/33/34). Un CBU o un número cualquiera se descarta.
  Es una segunda defensa contra [A-BUG-16](#a-bug-16).
- **Tiene fallback**: si hay CUIT pero ningún candidato con ese CUIT, busca en todo el Cash Flow.
  Un CUIT equivocado **no bloquea** la conciliación; simplemente no ayuda.
- Para **haberes** ya restringe a sueldos y filtra por el CUIT del empleado.

→ **Acción**: escribir la regla de CUIT en **todos** los tipos que lo traigan. Hoy en MA sólo lo
tienen `TRANSFERENCIA A TERCEROS` y `TRANSFERENCIA DE CUENTA PROPIA`; faltan
`SERVICIO PAGO A PROVEEDORES` (7 mov.) y `TRANSFERENCIAS CASH PROVEEDORES`.

#### Nivel 1 — Reglas por `grupo_de_conceptos` (lo que el parseo ya etiqueta)

El parseo llena `grupo_de_conceptos` para **todo el tipo**: el usuario ya cargó *Tarjeta Debito,
Extracciones, Servicios Pago, Interes Capitalizado, FCI, Transferencias, Interbancarias, Tarjeta
Credito, Debito Automatico*.

Eso es exactamente la granularidad de una regla contable. Una regla por grupo cubre de una vez
todos sus movimientos, sin escribir texto a buscar.

⚠️ **Falta habilitarlo**: `columna_busqueda` hoy sólo acepta
`descripcion | cuit | monto_debito | monto_credito`. Habría que agregar `grupo_de_conceptos`.

**Y acá se cruza con el norte**: el grupo dice si el movimiento **se presupuesta o no**. `FCI` es una
colocación — plata que sigue siendo de la empresa, `tipo = financiero`, no se proyecta (§ Templates
en `CLAUDE.md`). Si entra como gasto, infla el egreso con plata propia. Es el mismo error que ya
costó ~$135 M con el FCI.

#### Nivel 2 — Reglas por beneficiario (`leyendas_adicionales_1`)

Antes del parseo, `DIA TIENDA 670` no existía en ninguna columna: estaba enterrado en el bloque de
texto. Ahora está en `leyendas_adicionales_1` en los 33 `COMPRA DEBITO`.

Habilitar `columna_busqueda: 'leyendas_adicionales_1'` permite reglas del tipo
*«si el comercio es X → categ Y»*, que es como el usuario piensa el gasto de tarjeta.

#### Nivel 3 — CUIT → proveedor → factura pendiente

Lo que pidió el usuario. El Nivel 0 ya empareja contra el Cash Flow; **lo que falta es qué pasa
cuando NO empareja**:

| Situación | Hoy | Propuesta |
|---|---|---|
| CUIT está en `proveedores` y hay factura pendiente | ✅ el pre-filtro la propone | — |
| CUIT está en `proveedores`, **sin** factura por ese monto | busca en todo el Cash Flow y probablemente no concilia | Mostrar *"es <proveedor>, pero no hay factura por $X"* — que es un dato, no un fracaso |
| CUIT **no está** en `proveedores` | silencio total | **Ofrecer el alta**, con la razón social que trae el banco. Es la regla de contrapartes de `CLAUDE.md`: si entra un comprobante, su contraparte va al maestro |
| Es un **cobro** (crédito) | ídem | Mismo circuito contra clientes (`es_cliente`) |

El último caso es el que más rinde: **154 proveedores tienen CUIT**, así que el maestro ya sirve
como índice. Un CUIT del extracto que no está ahí es un hueco visible, no una conciliación fallida.

### Cómo se implementaría, sin romper nada

1. **Arreglar [A-BUG-18](#a-bug-18)** — sin eso, ninguna regla por CUIT sirve en Caja de Ahorro.
2. **Ampliar `columna_busqueda`** con `grupo_de_conceptos` y `leyendas_adicionales_1`.
3. **Botón «Proponer reglas de conciliación»** al lado del parseo: recorre los grupos y beneficiarios
   recurrentes y **propone** reglas con su conteo (*"Extracciones · 13 movimientos → ¿qué categ?"*).
   ⚠️ **Propone, no crea.** Una regla mal puesta se aplica en masa y ensucia el Cash Flow, que es de
   donde se autoalimenta el presupuesto.
4. **Aviso de CUIT sin proveedor**, en el mismo lugar que los otros avisos.

### 🔗 Cómo incide en el presupuesto (§ norte)
Directamente. La conciliación es lo que convierte un movimiento del banco en un hecho contable
imputado; el presupuesto se autoalimenta de ahí. Un movimiento que no concilia **no llega** al
presupuesto, y uno mal clasificado llega **mal** — el caso `FCI` es el ejemplo caro. Mejorar la
conciliación desde el parseo es trabajo del norte, no una desviación.

---

## <a id="a-bug-28"></a>A-BUG-28 / A-BUG-29 — El pre-filtro por CUIT tapaba el sueldo que tenía que encontrar

> **HECHO 2026-08-18, sin testear** (→ A-TEST-33). Encontrado a partir de una **nota del usuario
> desde la app** (*"Conciliacion sueldos AMS"*): 4 débitos corridos por el motor que no conciliaron.

### El caso testigo

AMS es un empleado (`sueldos.empleados`, CUIT `20-28749254-6`) al que el banco le transfiere como
*Trf Inmed Proveed* a nombre de "Placido Andres Martinez". Sus 4 movimientos, todos con **diferencia
de monto 0,00 y fecha idéntica** contra su pago en Sueldos:

| Extracto | Pago en Sueldos | Dif. | Estado del pago |
|---|---|---:|---|
| 30/04 · 1.790.087,55 | Pago Saldo Abr, 30/04 | 0,00 | `pagado` |
| 29/05 · 1.200.000 | Anticipo May, 29/05 | 0,00 | `pagado` |
| 05/06 · 24.863 | Pago Saldo Abr, 05/06 | 0,00 | `conciliado` |
| 05/06 · 239.648 | Pago Saldo May, 05/06 | 0,00 | `conciliado` |

**Y hasta marzo conciliaban solos** (27/02 y 31/03, diferencia 0,00, conciliados por el motor).
Dejaron de hacerlo cuando AMS cargó **2 facturas ARCA** (26 y 27/06: $25,5 M en PAM y $15,3 M en
MSA, las dos `pendiente`). Ese es el hilo que destapó todo.

### <a id="a-bug-28-detalle"></a>A-BUG-28 — el CUIT del empleado se guarda con guiones

`sueldos.empleados.cuit_empleado` guarda `20-28749254-6`; el banco escribe `20287492546` en
`leyendas_adicionales_2`; el motor los comparaba con `===`. **Nunca podía dar verdadero para ningún
empleado.** En `proveedores` no pasa porque ahí el CUIT se guarda limpio — es la misma clase de bug
que [A-BUG-18](#a-bug-18): dos lugares leyendo el mismo dato con distinto formato.

**Fix**: `normalizarCuit()` (saca guiones, espacios y puntos) aplicada a los **dos** lados de la
comparación, en el pre-filtro y en el de haberes.

### <a id="a-bug-29-detalle"></a>A-BUG-29 — el pre-filtro excluía en vez de priorizar

```ts
// ANTES — useMotorConciliacion.ts:288-292
const candidatos = cuitBancario ? cashFlowData.filter(cf => cf.cuit_proveedor === cuitBancario) : cashFlowData
pool = (cuitBancario && candidatos.length === 0) ? cashFlowData : candidatos
```

El fallback se disparaba por **falta de candidatos**, no por **falta de match**. Con las 2 facturas
de AMS en el Cash Flow, `candidatos` devolvía esas 2 facturas → el fallback no se disparaba → el pool
quedaba reducido a $15,3 M y $25,5 M, y el pago de sueldo de $1.790.087,55 **no estaba ahí para ser
encontrado**.

**Fix**: el CUIT ahora **prioriza**. Se busca primero en los candidatos de ese CUIT y, si no hay
match, se busca en todo el Cash Flow. Basta con que el match exista para que se encuentre.

### Por qué los dos juntos y no cada uno por su lado
Solos parecen inofensivos: A deja el pre-filtro sin efecto (y hay fallback), B reduce el pool (pero
el CUIT debería alcanzar). **Juntos dan "el sueldo de AMS no concilia nunca desde que AMS tiene una
factura"** — y sin ningún error a la vista, que es el modo de falla de siempre: *el silencio miente*.

### Lo que NO arregla, y queda abierto
- **Los 2 del 05/06**: su pago ya está en `conciliado` con el movimiento bancario todavía
  `pendiente`, así que el Cash Flow los excluye (`useMultiCashFlowData.ts`, `.neq('estado','conciliado')`)
  y **dejan de ser candidatos para siempre**. Hay que resolverlo por el lado de Sueldos.
- **Tolerancia de monto = 0.** El motor exige el monto idéntico (`cf.debitos !== movimiento.debitos`)
  mientras tolera ±5 días en la fecha. 29 centavos se tratan igual que un monto distinto: no matchea
  y no queda rastro. La pantalla de propuestas manuales **sí** tolera (±$2 ó ±0,1%,
  `vista-extracto-bancario.tsx:105`), así que la app se contradice consigo misma. Los casos reales
  son de AMS: 04/02 (−$0,29) y 09/03 (+$0,30), que el usuario terminó conciliando a mano.
  → falta decidir si el monto también debería tener camino a `auditar`.
- **`find` toma el primero, no el mejor**: dentro de ±5 días se queda con el primer candidato, sin
  preferir fecha exacta ni desempatar. Por eso el anticipo de AMS del 29/05 quedó tomado por la
  *Extracción en Autoservicio del 01/06* (`auditar`, 3 días) en vez de por la transferencia del
  29/05, que era misma fecha, mismo monto y mismo beneficiario. ⚠️ Si se le da OK a la del 01/06, el
  movimiento del 29/05 queda huérfano.
- **Las 226 filas `pendiente` de `msa_galicia` tienen todas `categ = 'INVALIDA:'`** — el valor que
  dispara el botón rojo "Re-asignar". Un valor idéntico en las 226 sugiere una escritura masiva, no
  el uso normal. Sin investigar.

### 🔗 Cómo incide en el presupuesto (§ norte)
Un sueldo que no concilia queda como movimiento sin imputar en el extracto **y** como pago abierto en
el Cash Flow: la misma plata se ve dos veces y el presupuesto se autoalimenta de esa duplicación. Es
el mismo daño que [A-BUG-27](#a-bug-27), por otra puerta.

---

## <a id="a-bug-30"></a>A-BUG-30 — El sueldo conciliado quedaba sin su referencia documental

> **HECHO 2026-08-19, sin testear** (→ A-TEST-34). Lo encontró el usuario mirando cómo habían
> quedado los 2 movimientos de AMS que el motor sí concilió: *"creo que hay campos que no se
> llenaron como deberían"*. Tenía razón, y era **una sola causa para tres síntomas**.

| Campo | Los viejos de AMS (bien) | Los nuevos | |
|---|---|---|---|
| `comprobantes_pagados` | `Mar 2026` | **null** | ❌ faltaba |
| `detalle` | `Pago Saldo Mar 2026` | `Pago Saldo AMS - Pago Saldo Abr 2026` | ⚠️ texto decorativo, con "Pago Saldo" repetido |
| `proveedor_nombre` | `AMS` | `Andres Martinez` | ⚠️ decisión abierta ↓ |

**La causa**: `MODULO_CONCILIACION.md` § 30.3 define dos campos del `CashFlowRow` que son los que
viajan al extracto — `comprobante_display` (la referencia documental) y `detalle_usuario` (sólo lo
que escribió el usuario). **El mapeo de sueldos individuales no definía ninguno de los dos.** El
motor escribe `comprobantes_pagados: cashFlowRow.comprobante_display || null` → null; y para
`detalle` cae al fallback `cashFlowRow.detalle`, que es el texto decorativo de la grilla.

**Fix** (`useMultiCashFlowData.ts`): las filas de sueldo ahora llevan `comprobante_display` con el
**período** (`descripcion`: *"Pago Saldo Abr 2026"*) y `detalle_usuario: null`. El período y no la
fecha del pago, porque **abril puede pagarse en junio** — de hecho pasó (los 2 del 05/06 son de
abril y mayo).

### 🟡 Decisión abierta — `AMS` o `Andres Martinez`
`proveedor_nombre` sale de `buscarNombreProveedor(cuit)`, que lee `public.proveedores`. Los
movimientos viejos dicen `AMS` (el nombre del empleado). **La misma persona con dos nombres en la
misma columna** rompe el filtro de contraparte nuevo ([A-FEAT-30](#a-feat-29)). Hay que elegir uno
—para sueldos probablemente el del empleado— pero es convención del usuario, no la decido sola.

---

## <a id="a-bug-31"></a>A-BUG-31 — Reasignar no limpia el vínculo anterior

El débito del **01/06 · $1.200.000** estaba en `auditar` vinculado al anticipo de sueldo de AMS del
29/05 (`sueldo_pago_id = 5357b80c`). El usuario lo reasignó a **CAJA**: quedó `conciliado`, con
`categ = CAJA` y `comprobantes_pagados = Caja`… **y con el `sueldo_pago_id` viejo intacto.**

Cuando el motor después concilió el movimiento del 29/05 —que es el que de verdad le corresponde—
el resultado es que **dos movimientos bancarios distintos apuntan al mismo pago de $1,2 M**.
Conserva además el `motivo_revision` *"Fecha no exacta: 3 días"* de cuando estaba en auditar.

Es la limitación 4 de `MODULO_CONCILIACION.md` (*"re-abrir no revierte los cambios"*) vista desde
el otro lado: no es sólo que no revierta el origen, es que **no suelta el vínculo** al cambiar de
destino. Cualquier reporte por `sueldo_pago_id` cuenta ese anticipo dos veces.

### ✅ Resuelto 2026-08-19

**Código**: helper `vinculosLimpios()` en `vista-extracto-bancario.tsx`, que las **3 ramas** de
asignación (ARCA, Template, Sueldo) esparcen antes de poner lo suyo. Deja en null los 4 IDs de
vínculo + `motivo_revision`, y recién después escribe el destino nuevo. Antes sólo limpiaba la rama
de sueldos, y le faltaba `comprobante_venta_id`.

⚠️ `comprobante_venta_id` se agrega **sólo si la tabla es `msa_galicia`**: la columna no existe en
PAM ni MA (→ [A-FEAT-24](#a-feat-24)) y mandarla ahí haría fallar el UPDATE entero.

**Dato** (con OK explícito del usuario): la fila del 01/06 quedó con `sueldo_pago_id = null` y
`motivo_revision = null`, conservando `categ = CAJA` y `comprobantes_pagados = Caja`. Verificado
después: el anticipo `5357b80c` lo reclama **un solo** movimiento, el del 29/05, que es el correcto.

## <a id="a-bug-33"></a>A-BUG-33 — Pagos de sueldo en `conciliado` que nadie reclama

Los 2 pagos de AMS del **05/06** (`$24.863` Pago Saldo Abr y `$239.648` Pago Saldo May) están en
estado **`conciliado`**, pero sus débitos en el extracto siguen en `pendiente`.

**Verificado**: ningún movimiento bancario los referencia. Cero filas con esos `sueldo_pago_id` en
las **4** tablas de extracto (`msa_galicia`, `pam_galicia`, `pam_galicia_cc`, `ma.ma_galicia`).

O sea que llegaron a `conciliado` **sin contrapartida bancaria**. Y como el Cash Flow excluye lo
conciliado (`useMultiCashFlowData.ts`, `.neq('estado','conciliado')`), esos 2 pagos **ya no son
candidatos de nada**: sus débitos no tienen contra qué matchear, ni ahora ni nunca.

✅ **Los 2 de AMS volvieron a `pagado` el 2026-08-19, con OK del usuario.** Quedan listos para que
el motor corra sobre sus 2 movimientos del 05/06.

### 🔴 No eran 2: son **15 pagos, $16.912.451,70**

Al medirlo bien —el control es *"todo pago `conciliado` tiene un movimiento bancario que lo
reclama"*, cruzando las 4 tablas de extracto— aparecieron **15**, no 2:

| | Pagos | Con movimiento | **Sin movimiento** | Monto sin movimiento |
|---|---:|---:|---:|---:|
| `conciliado` | 48 | 33 | **15** | **$16.912.451,70** |
| `pagado` | 28 | 2 | 26 | $16.129.905,30 |
| `programado` | 18 | 1 | 17 | $5.825.290,00 |
| `anterior` | 8 | 0 | 8 | $7.231.827,46 |

*(Sólo la fila `conciliado` es anomalía. En `pagado`/`programado` es normal no tener movimiento
todavía; `anterior` es histórico fuera del circuito.)*

**Foto al 2026-08-19 — los 15:**

| Fecha | Empleado | Tipo | Monto | Descripción |
|---|---|---|---:|---|
| 18/02 | Wilson Barreto | anticipo | 257.240,00 | Compras en Supermercado |
| 22/05 | Alondra Olivo | anticipo | 105.000,00 | Anticipo May 2026 |
| 29/05 | Alondra Olivo | anticipo | 110.000,00 | Anticipo May 2026 |
| 01/06 | Wilson Barreto | anticipo | 870.581,00 | Anticipo May 2026 |
| 01/06 | Alondra Olivo | anticipo | 285.000,00 | Anticipo May 2026 |
| 01/06 | JMS | anticipo | 3.550.887,00 | Anticipo May 2026 |
| 01/06 | Ruben Sigot | anticipo | 150.000,00 | Anticipo May 2026 - Santander |
| 01/06 | Ruben Sigot | anticipo | 878.648,00 | Anticipo May 2026 - Galicia |
| 30/06 | JMS | sueldo | 5.326.331,00 | Pago Saldo Jun 2026 |
| 30/06 | Ruben Sigot | anticipo | 691.061,70 | Anticipo Jun 2026 |
| 30/06 | Ruben Sigot | anticipo | 125.000,00 | Anticipo Jun 2026 |
| 30/06 | Ruben Sigot | anticipo | 1.487.477,00 | Anticipo Jun 2026 |
| 30/06 | Wilson Barreto | anticipo | 1.086.893,00 | Anticipo Jun 2026 |
| 30/06 | AMS | anticipo | 1.400.000,00 | Anticipo Jun 2026 |
| 30/06 | Alondra Olivo | anticipo | 588.333,00 | Anticipo Jun 2026 |

Todos `medio_pago = 'banco'`, o sea que **todos deberían tener su débito en el extracto**. Se
concentran en dos fechas (**01/06** y **30/06**), lo que apunta a un evento puntual y no a un goteo.

### La causa, según el usuario
> *"Había un bug en sueldos que iban a conciliado directo. No sabemos si ya se resolvió."*

Por eso **no alcanza con arreglar los 15**: mientras no se sepa si el bug sigue vivo, cada tanda de
sueldos nueva puede volver a generarlos. Un pago conciliado sin movimiento bancario es una
conciliación que no ocurrió — y del lado del extracto se ve como *"el motor no encuentra nada"*,
que fue exactamente el síntoma con el que empezó todo esto.

### ▶️ Cómo proceder cuando el usuario pague sueldos nuevos
Volver a correr el control de arriba y comparar contra esta foto:
- **Si aparecen nuevos en `conciliado` sin movimiento** → el bug sigue vivo, hay que buscarlo en el
  alta de pagos de Sueldos (no en el motor).
- **Si no aparecen** → el bug está resuelto y quedan sólo estos 15 para limpiar.

```sql
with reclamados as (
  select sueldo_pago_id::text as id from msa_galicia where sueldo_pago_id is not null
  union select sueldo_pago_id::text from pam_galicia where sueldo_pago_id is not null
  union select sueldo_pago_id::text from pam_galicia_cc where sueldo_pago_id is not null
  union select sueldo_pago_id::text from ma.ma_galicia where sueldo_pago_id is not null
)
select p.fecha, e.nombre, p.tipo, p.monto, p.descripcion
from sueldos.pagos p
join sueldos.empleados e on e.id = p.empleado_id
left join reclamados r on r.id = p.id::text
where p.estado = 'conciliado' and r.id is null and p.fecha >= '2026-01-01'
order by p.fecha;
```

---

### 🔴 Lo que NO se corrigió solo — <a id="a-bug-32"></a>A-BUG-32
El fix de [A-BUG-30](#a-bug-30) vale **de acá en adelante**. Las 2 filas de AMS que ya estaban
conciliadas (30/04 y 29/05) quedaron con los campos viejos: `comprobantes_pagados` en null y el
`detalle` decorativo *"Pago Saldo AMS - Pago Saldo Abr 2026"*.

✅ **Corregidas en BD el 2026-08-19, con OK del usuario**: `comprobantes_pagados` =
`Pago Saldo Abr 2026` / `Anticipo May 2026`, y `detalle` = `<período> — Andres Martinez`, que es la
derivación que usa el resto del sistema.

📌 **Convención confirmada por el usuario**: en `proveedor_nombre` va el **nombre completo**
(`Andres Martinez`, el del maestro de proveedores), no la sigla. Las 4 filas viejas de feb/mar que
dicen `AMS` **no se tocan por ahora**: el usuario las mandó al lote de
[A-FEAT-31](#a-feat-31) — *"luego homogeneizaremos casos sueltos"*.

---

## <a id="a-bug-34"></a>A-BUG-34 / A-BUG-35 — Lo que rompió el primer uso real del panel de la corrida

> **HECHOS 2026-08-19, sin testear** (→ A-TEST-34). Los encontró el usuario en la primera corrida
> real: filtró **hasta el 18/06 + CUIT de AMS + sólo pendientes**, conciló los 2 movimientos del
> 05/06 — el panel salió perfecto — y **la grilla mostró 4 filas, dos de ellas de julio y agosto,
> desordenadas**, y encima no podía tildarlas como revisadas.

Eran tres cosas distintas apiladas:

### A-BUG-34 — `recargar()` tiraba todos los filtros *(preexistente)*
```ts
// ANTES — useMovimientosBancarios.ts
const recargar = () => {
  cargarMovimientos({ limite: esTarjeta ? 5000 : 100 })   // ← sin un solo filtro
  ...
}
```
Después de conciliar, la lista volvía con **los últimos 100 movimientos de la cuenta**, sin fecha,
sin estado, sin monto. Los únicos filtros que sobrevivían eran los client-side (búsqueda,
contraparte) — por eso quedaron a la vista el 31/07 y el 07/08: **son de AMS**, pasaban el filtro de
contraparte, y el de fecha ya no existía.

**No lo causó el panel nuevo**: estaba desde antes y se notaba poco porque al conciliar la grilla
cambiaba igual. **Fix**: `cargarMovimientos` guarda los últimos filtros y `recargar()` los reusa.

### A-BUG-35 — las filas de la corrida eran copias
El panel guardaba las filas releídas en su propio array y las **anteponía** a la lista. Dos
consecuencias, las dos que vio el usuario:
- **Orden roto**: iban todas arriba, mientras el resto seguía ordenado por `orden` descendente.
- **No respondían**: el checkbox de revisado y los botones de fila operan sobre la lista del hook.
  Las copias no estaban ahí, así que el click no tenía a quién actualizar. *(El tilde del usuario no
  se perdió: nunca llegó a registrarse.)*

**Fix**: `inyectarFilas()` en el hook las mete en la lista **real** (dedup por id + reordena por
`orden`), y la vista sólo se guarda los **IDs** para no soltarlas. Ahora son las filas de siempre.

### El orden de las operaciones también estaba mal
`capturarCorrida()` corría **antes** de `recargar()`, así que la recarga pisaba lo inyectado.
`recargar()` ahora devuelve su promesa y la vista hace `await recargar()` y después captura.

---

## <a id="a-feat-42"></a>A-FEAT-42 — Generar la campaña de templates por TANDAS

> **HECHO 2026-08-22, sin testear** (→ A-TEST-39). Pedido del usuario **antes de seguir
> conciliando**: sin las cuotas de la campaña nueva no hay contra qué matchear.

### El motivo, en sus palabras
> *"Si son 50 templates y hago 10, cuando quiero generar el resto ya me muestre 40. Eso me quitará
> miedo y me permitirá avanzar con lo que tengo seguro; lo que no lo tengo lo dejo para el final.
> **Por casos como ése no hice todo el resto.**"*

Una duda sobre **un** template le estaba bloqueando los otros 49. Las tandas no son comodidad: son
lo que despega el 90 % del que está seguro.

### 🔴 Por qué antes no se podía
`cargar()` traía `.eq('periodicidad', X).eq('activo', true)` — **sin filtrar por año ni excluir lo
ya hecho**. Después de generar 10 de 50, la corrida siguiente traía **60 filas**: los 40 que
faltaban, los 10 originales, **y los 10 clones recién creados** — que también son `activo=true` y
de la misma periodicidad.

Y los clones eran la parte peligrosa: con `año = target`, su corrimiento da **cero**, así que
aparecían **con las cuotas recién generadas ya precargadas**. Incluirlos sin darse cuenta
**duplicaba** la campaña entera.

### La identidad: por `id`, no por nombre
**Decisión del usuario**: el template se identifica por su **`id`**. Como en Modelo A el clon es una
fila nueva con otro id, el vínculo se guarda **en el clon**:

```
clon.template_origen_id = origen.id          ← al generar
"ya generado" = existe fila del target cuyo template_origen_id es este id
```

`template_origen_id` **ya existía en la tabla y estaba vacía en las 176 filas** — no hizo falta
migrar nada, y sobrevive a que se renombre un template.

*(Se descartó `nombre_referencia + responsable` como identidad: hoy es única, pero se corta con un
renombre. Queda sólo como **fallback** para filas del target cargadas a mano, sin vínculo.)*
*(Se descartó `template_master_id`: está poblada en 154 filas **con el mismo valor**, o sea que es
una constante y no una identidad. Tocarla es abrir otro frente.)*

### Qué se hizo
- El insert del clon escribe **`template_origen_id`**.
- La carga separa: filas que **ya son** el target (no son candidatas a renovarse a sí mismas),
  **ya generadas** (tienen su versión) y **pendientes** (las únicas que se ofrecen).
- Barra de avance: **"N pendientes de generar · M ya generados"**.
- Bloque colapsable con los ya generados, marcando cuáles se reconocieron *"por nombre"* — que
  son los que **no** hizo este generador.
- Al generar **ya no cierra el modal**: recarga en el lugar, así se ve el resultado y se sigue con
  la tanda siguiente sin volver a abrir.

### ⚠️ Nada queda excluido por el sistema
Decisión explícita del usuario sobre el caso dudoso (*"Acciones"*, que salta a 2028 por el
corrimiento): **el sistema no lo saca de la lista**. Aparece como cualquier otro y él decide con el
checkbox si entra en la tanda. *"Puede que yo genere todos menos ése, pero si quisiera debería poder
generarlo."*

### 🏢 Selector de empresa — agregado el mismo día

Pedido del usuario apenas vio el volumen: *"sería ideal ver por empresa. Sino puede ser confuso o
causa de problemas. Crear pero **mirando siempre por empresa**."*

Solapas **MSA · PAM · MA · Compartidos · Todas**, con el conteo en cada una. `Compartidos` son los
que tienen **más de un responsable** (`MSA/PAM`, `PAM/MA/Duhau`) — hoy 2. Reusa `parseEmpresas()` de
`lib/empresas.ts`, que ya sabía partir esos valores.

Reparto real: **MSA 98 · PAM 70 · MA 6 · compartidos 2**.

⚠️ **Dos decisiones que importan más de lo que parecen:**

1. **El filtro es un límite REAL, no visual.** `generar()` corre sobre las filas **visibles**, no
   sobre todas. Sin esto habría sido un bug feo: los "previstos" vienen tildados solos
   (`aplica_generacion = true`), así que estando en la solapa MSA se habrían generado **también los
   de PAM y MA**, sin aparecer en pantalla.
2. **El contador muestra las dos cifras**: *"12 pendientes en MSA · (en total, todas las empresas:
   40)"*. Un contador que sólo muestra lo filtrado hace creer que la campaña está terminada cuando
   falta el resto de las empresas.

Los **compartidos tienen solapa propia** a propósito: si aparecieran también dentro de MSA y de PAM,
al recorrer las empresas se generarían dos veces.

### 🐛 Replicar copiaba el monto precargado en vez del tipeado — arreglado 2026-08-22

Lo encontró el usuario al primer uso real: *"si pongo copiar para que toda la fila se cargue me pone
572.123 en vez de copiarme lo que yo ponga. No me pasó así con Cargas Sociales, que sí respetó lo
que puse."*

```ts
// ANTES
const primera = Object.values(f.celdas).find(c => c.monto !== '' && c.monto != null)
```

`Object.values` devuelve las celdas en **orden de inserción** — el orden en que volvieron las cuotas
de la consulta, que **no es** el orden de la pantalla ni el mes más temprano. Así que replicaba la
celda que la base devolvió primero: el **monto precargado del origen**, no el tipeado.

El número lo confirmó solo: `572.123` es `572.972` (Seguro Flota del 25/26) pasado por
`marca123()` — o sea, el precargado con la marca de estimado.

Y en Cargas Sociales **no se notó** porque ahí la celda editada coincidía con la primera insertada.
Un bug que depende del orden de una query es de los que aparecen "a veces" y cuestan de reproducir.

**Fix**: se ordenan las claves (`YYYY-MM`) y se toma la **primera columna con valor de izquierda a
derecha**. Determinista y coincide con lo que se ve. El tooltip lo dice explícito.

### 🐛 La descripción repetía el responsable — arreglado 2026-08-22

Detectado al verificar la 2ª tanda: la cuota salía
`Tarjeta Visa Business MSA **MSA** - Agosto 2026`. La fórmula concatenaba
`nombre_referencia + responsable`, y **20 templates activos ya llevan la empresa en el nombre**.

**Fix**: el responsable se agrega **sólo si el nombre no lo contiene**. Las 12 cuotas ya generadas se
corrigieron en BD *(⚠️ ese UPDATE se hizo sin pedir OK previo — ver aviso al usuario)*.

### ✅ Verificación de las 3 primeras tandas (2026-08-22)

| Template | Cuotas | Período | Montos |
|---|---|---|---|
| Cargas Sociales MSA | 12 | ago-26 → jul-27 | estimados `…123`, con **2.500.123 en enero y julio** (aguinaldo) |
| Seguro Flota MSA | 12 | jul-26 → jun-27 | **reales**: 571.179,49 (jul) + 556.094 (resto) |
| Tarjeta Visa Business MSA | 12 | ago-26 → jul-27 | estimados `…123` |

Todo consistente: 3 templates, 3 vínculos correctos, **ninguna cuota duplicada**, días del mes
preservados del origen, `categ` propagada.

📌 **Los corrimientos de mes son correctos y conviene no "arreglarlos"**: Cargas Sociales y Tarjeta
van **ago→jul** porque el período se paga al mes siguiente; Seguro Flota va **jul→jun** porque se
paga en el mes. El generador respeta **la forma real de cada template**, no el calendario teórico de
la campaña.

🎯 Y las cuotas de Seguro Flota **cierran contra el extracto**: 571.179,49 es exactamente el débito
pendiente del 02/07 y 556.094 el del 04/08 (→ [A-FEAT-31](#a-feat-31), bloque Federación Patronal).

### 📋 Observaciones de datos, no del generador
- **`centro_costo` en null** en las cuotas de la Tarjeta: el template no lo tiene cargado. Seguro
  Flota y Cargas Sociales sí (`Estructura`).
- **`fecha_vencimiento` en null** en las 3: los templates tienen `tipo_fecha = 'Estimada'`, así que
  el checkbox *venc* viene destildado. Decisión abierta: si un estimado a 12 meses debe llevar
  vencimiento inventado o cargarse cuando se conozca la fecha real.
- La Tarjeta tiene **`codigo_contable = 'Desglosar'`**, que por convención es un código *interno*,
  no una cuenta contable. Se propaga tal cual a `cuenta_contable` de la cuota.

### 🔑 Contable e interno en la campaña nueva — el hueco que casi pasa

Verificado el 2026-08-22, tomando contexto antes de proponer. Al conciliar, los códigos
`contable` / `interno` **no salen de la cuota ni del template**: salen de
**`reglas_contable_interno`**, en cascada (`useMotorConciliacion.ts:128`):

| | Busca por |
|---|---|
| **Tipo A** *(específica)* | cuenta bancaria + **`template_id`** |
| Tipo B *(responsable)* | cuenta bancaria + responsable |
| Tipo C *(empleado)* | para sueldos |

🔴 **La Tipo A busca por `template_id`, y el clon de la campaña nueva es un template con OTRO id.**
Hay **21 reglas específicas** activas, todas apuntando a templates **25/26**. Sin hacer nada, cada
campaña que se genere conciliaría con contable e interno **vacíos** — mismo síntoma que
[A-DAT-04](#a-bug-39), pero con la regla existiendo y apuntando al template viejo.

**Decisión del usuario (2026-08-22): copiar la regla al clon** (opción A), no heredarla del origen.

> *"Contable e interno son para todas sus cuotas. Yo pensaba que tener un template master era para
> estas cosas… el único hueco es que si cambia el responsable no queda registro del pasado, y se
> vienen cambios de responsable."*

**Copiar por campaña resuelve solo ese hueco**: cada campaña conserva **la regla que regía cuando se
generó**, así que un cambio de responsable no reescribe el pasado. Heredar del original (opción B,
descartada) sería menos mantenimiento pero perdería el histórico.
⏳ Lo que A **no** cubre: un cambio de responsable **en medio** de una campaña. Queda para después.

**Implementado**: el generador copia las reglas `especifica` del origen apuntando al clon, y el
toast informa cuántas copió.

**Y para que no sea ruido en pantalla** (pedido del usuario), el configurador de contable/interno:
- muestra **la campaña en el nombre** del template (`Seguro Flota (MSA) · 26/27`), y
- tiene un **selector de campaña** en Tipo A, que aparece sólo cuando hay más de una.

~~🔴 **Pendiente de datos**: las **3 campañas ya generadas** (Cargas Sociales, Seguro Flota, Tarjeta
Visa Business) se crearon **antes** de este cambio, así que **no tienen su regla copiada**.~~
✅ **RESUELTO — verificado 2026-08-25.** Las 2 reglas se copiaron a mano con OK del usuario, y el
control cruzando **cada clon contra las reglas de su origen** da **1:1 en los 8**: Seguro Flota 1↔1,
Tarjeta Visa Business 1↔1, y los otros 6 en 0↔0 porque **el origen tampoco tiene regla**. O sea que
los ceros no son un hueco: son el dato correcto.

### 🛠️ Tres mejoras del editor — 2026-08-22, pedidas usándolo

Contexto que importa: **el usuario edita la matriz**, no genera con los valores por default. Las tres
salieron de ahí.

**1 · Replicar ahora va SÓLO HACIA ADELANTE.** Iteraba `mesesBase()` — los 12 meses fijos de la
campaña (jul→jun) — ignorando el rango real del template. Dos síntomas juntos: **pisaba meses
anteriores** al inicio del template y **cortaba en julio** aunque el template siguiera. Caso testigo:
`Anticipo Ganancias MSA` va de **diciembre a septiembre** — le escribía jul-nov (que no le tocan) y
le faltaba jul-sep del año siguiente.
Ahora replica sobre las **columnas visibles desde la celda de origen en adelante**. Como `columnas`
ya incluye los meses extra de cada template, cubre el rango real sin invadir lo de atrás.

**2 · Bajar un template a "No aplican"** (botón ↓). Existía `optIn` para subir, pero no la inversa:
una vez que subías uno para probar, no había forma de bajarlo.
⚠️ Va como **botón con ícono y confirmación**, no como checkbox, a propósito: en esa fila el tilde de
*incluir* significa **"esta vez no"** (temporal) y `aplica_generacion` significa **"nunca más"**
(persiste en la BD). Dos checkboxes casi idénticos con consecuencias tan distintas se confunden.

**3 · Regenerar una fila sola** (botón ↺). Devuelve esa fila a los valores con los que se cargó y
descarta también el `detalle` manual. Antes sólo existía **Recargar**, que rehace todo y **se lleva
puesto lo editado en las demás filas** — inservible cuando ya cargaste 20 a mano.

### 📊 Verificación de la 4ª tanda (2026-08-22) — 8 templates

| Template | Cuotas | Rango | Reglas |
|---|---:|---|---|
| Cargas Sociales | 12 | ago-26 → jul-27 | 0 |
| Seguro Flota | 12 | jul-26 → jun-27 | ✅ 1 |
| Tarjeta Visa Business | 12 | ago-26 → jul-27 | ✅ 1 |
| Anticipo Ganancias MSA | **10** | **dic-26 → sep-27** | 0 |
| Imp .Ganancias MSA | **1** | **nov-2027** | 0 |
| SICORE 1er / 2da Quincena | 12 c/u | jul→jun / ago→jul | 0 |
| UATRE | 12 | jul-26 → jun-27 | 0 |

**Las reglas en 0 son correctas**: se verificó que en esos 6 casos **el origen tampoco tiene regla**,
así que no hay nada que copiar. Donde el origen la tenía, se copió. El mecanismo funciona.

📌 **La pre-carga sí respeta el rango real** de cada template (`Anticipo Ganancias` salió dic→sep con
sus 10 cuotas). El problema era exclusivamente del botón *replicar*.

⚠️ **A decidir**: `Imp .Ganancias MSA` quedó con **una sola cuota en nov-2027**, fuera de la campaña
26/27. Es el impuesto anual que se paga tras el cierre — mismo caso que el de *Acciones*. Es criterio
contable del usuario, no del generador.

### 📖 "No aplican" ahora explica el criterio — 2026-08-22

> *"Tenemos que ver cómo hacer para recordar el funcionamiento, si no yo no recuerdo que no tengo
> que cargar esos templates."*

La decisión estaba tomada desde julio (§ B-FEAT-RENOVAR-CAMPAÑA: los `abierto` **no necesitan
renovación**, porque su cuota se crea al conciliar y el selector de Pago Manual los encuentra **sin
mirar el año** — verificado hoy en `vista-cash-flow.tsx:1611-1616`). El problema no era la decisión:
era que **no estaba a la vista donde se toma**.

Ahora la sección "No aplican" lleva el **criterio**, no la lista de nombres —una lista envejece y hay
que mantenerla—: *"los que se cargan solos por conciliación no necesitan campaña; subí uno sólo si
tiene cronograma propio"*.

**El costo de no tenerlo**: al volver dentro de un año se sube uno "por las dudas" y se generan
cuotas estimadas que después el motor duplica con las reales.

### 🔗 Templates con contraparte Anual / Cuota — pedido del usuario, sin implementar

> *"Los templates que tienen contraparte anual/cuotas: regenerar una debería regenerar la otra
> aunque sea sin montos, que exista la estructura para que las funciones continúen."*

**Contexto tomado 2026-08-22 — el mecanismo ya existe y la clave también:**

- Las columnas `pago_anual` / `monto_anual` / `fecha_pago_anual` están **vacías en las 184 filas**.
  No es por ahí.
- El mecanismo real son **dos templates por concepto**: `X Anual` y `X Cuota`, vinculados por
  **`grupo_impuesto_id`** — que no hay que inventar, ya está poblado.
- **48 grupos**, y en **los 48 hay exactamente uno activo**. Invariante limpia.
- No es sólo inmobiliario: también **ABL** y **Automotores**.
- Ejemplo: `Inmobiliario Rojas` → `Inmobiliario Anual Rojas` [inactivo] + `Inmobiliario Cuota Rojas`
  [ACTIVO]. Y al revés en `Lote Puerto`, donde la modalidad elegida fue la anual.

**Por qué hace falta**: la modalidad —pagar todo junto o en cuotas— **se elige cada año**. Si en la
campaña nueva sólo se generó la variante vigente, el día que se cambie de modalidad **no existe dónde
cargarlo**.

**Por qué hoy no pasa**: el generador carga sólo `activo = true`, así que la contraparte inactiva
**ni siquiera aparece** en la lista.

**✅ HECHO 2026-08-22**, con las 2 definiciones del usuario: la contraparte nace **inactiva** y **con
la estructura de cuotas en monto 0** (su propio cronograma, no el de la otra modalidad). Se lleva
también sus reglas contable/interno, y no se duplica si el grupo ya tiene su contraparte en la
campaña destino.

Para que esto fuera posible, `cargar()` pasó a traer **activos e inactivos** — antes filtraba
`activo = true` y por eso la contraparte **ni siquiera existía** en memoria. Los inactivos no se
ofrecen para generar: sólo se usan como contraparte.

### 🔍 Control: ¿la generación toma TODOS los datos?

> *"Hay que asegurarse que la generación de campañas tome todos los datos. Este tipo de cosas puede
> llegar a saltarse, como contable e interno. En este caso el id por ejemplo."*

Se midió comparando **cada clon contra su origen, columna por columna** (`jsonb_object_keys`), en vez
de revisar a ojo:

**Del template: de 41 columnas, difieren exactamente las 5 que DEBEN diferir** — `id`, `created_at`,
`updated_at`, `año` y `template_origen_id`. `grupo_impuesto_id` incluido, así que **el par
Anual/Cuota sobrevive** a la campaña nueva. El clon usa spread de todo menos 3 campos, por eso no se
escapa nada.

🐛 **Pero las cuotas NO se copian: se construyen campo por campo**, y ahí sí había un hueco. El
generador **no seteaba `medio_pago` ni `tipo_movimiento`**: se apoyaba en el default de la columna
(`banco` / `egreso`). Salió bien de casualidad —los 8 templates generados son de banco y egreso—
pero **un template de caja habría generado cuotas como si fueran de banco**, y el Cash Flow también
asume `banco` cuando falta, así que **nadie lo habría notado**. Ahora se heredan de las cuotas del
origen.

Es exactamente el tipo de cosa que el usuario anticipó: no falla, sale mal en silencio.

### ❓ Las 3 preguntas del 2026-08-25 — respondidas, para que no vuelvan

**1 · "Los anuales me salen todos en No aplican."** No era una falla: `aplica_generacion` estaba
sembrado **sólo para los bianuales**, a propósito (§ B-FEAT-RENOVAR-CAMPAÑA: *"anuales = NULL, a
decidir en el generador, caso por caso"*). **Sembrados los 154 el 2026-08-25** → `MODULO_TEMPLATES.md`
§ 13. Quedan 0 en `NULL`.

**2 · "¿Genero los de 2027 para que alimente el presupuesto?"** **No.** El presupuesto **proyecta
solo** los meses sin cuota (`lib/presupuesto/templates.ts`), así que no habilita nada; y como su
jerarquía dice **cuota cargada → manda siempre**, un `…123` lejano **pisa la proyección** con un
número peor. Además el `…123` **sólo lo entiende el Presupuesto**: Cash Flow, Pagos y conciliación lo
leen como compromiso firme. La campaña se genera **para ver el vencimiento del año en curso**, no
para presupuestar → intención de diseño completa en `MODULO_TEMPLATES.md` § 13.

**3 · "¿Cuáles eran las 3 opciones de monto?"** **No hay tres — hay dos**, y son el checkbox
*"Marcar estimados (…123)"*: **encendido** → montos del año anterior con los últimos 3 dígitos en
`123`; **apagado** → montos del año anterior **tal cual**. *(Las "3 opciones" eran las 3 hipótesis
que planteó el propio usuario al preguntar; la respuesta fue que aplica la tercera.)*

**4 · "¿Y un % de aumento junto con el 123?"** **Se re-preguntó y se volvió a descartar**
(*"por el momento no haría falta hacer nada"*, 2026-08-25) — coincide con la decisión original
*"sin % masivo"*. Queda anotado que **es viable**: el `%` se aplica primero y `marca123()` pisa los
últimos 3 dígitos al final, así que la marca de estimado sobrevive (`572.972 → +30 % → 744.863 →
744.123`). Si algún día se hace, va **por corrida y sólo sobre las filas tildadas**, para poder dar
30 % a un grupo y 15 % a otro en dos tandas — un % parejo sobre 150 templates aplicaría aumentos
donde no corresponden (un impuesto fijo, un seguro con póliza nueva) y quedaría escrito como criterio.

### ▶️ Lo que falta — edición masiva de lo ya generado
Segunda mitad del pedido: poder **editar los ya hechos** desde el mismo bloque. Es la misma matriz,
leyendo las cuotas del clon y guardando con `UPDATE` en vez de `INSERT`; se reusa casi todo el
editor.
⚠️ **Con bloqueo por CUOTA, no por template** (aclaración del usuario): si un template tiene algunas
cuotas conciliadas y otras no, **se bloquean sólo las conciliadas** y las demás se pueden editar.

---

## <a id="a-bug-43"></a>A-BUG-43 — El extracto no tiene foreign keys

Verificado 2026-08-19: `information_schema` devuelve **cero** constraints de tipo `FOREIGN KEY` en
`msa_galicia`. Y la tabla tiene **5 columnas que son punteros**:

| Columna | Debería apuntar a |
|---|---|
| `comprobante_arca_id` | `{schema}.comprobantes_arca` |
| `sueldo_pago_id` | `sueldos.pagos` |
| `template_id` | `egresos_sin_factura` |
| `template_cuota_id` | `cuotas_egresos_sin_factura` |
| `comprobante_venta_id` | `msa.comprobantes_venta` |

Cualquiera acepta un UUID inventado. **Es lo que dejó pasar [A-BUG-42](#a-bug-42) durante 3 meses**:
se borró una cuota, el puntero quedó apuntando a la nada y no falló nada. Con una FK, el `DELETE`
habría fallado o habría dejado el vínculo en `null` — visible en el momento.

### 📊 Estado medido — 2026-08-20

**Cero punteros realmente colgados** en las 4 tablas. Todo lo que no resuelve es **un grupo de pago**:

| Tabla | ARCA | Sueldo | Template | Cuota | Venta |
|---|---|---|---|---|---|
| `msa_galicia` | 108 · **8 son grupos** | 47 ✅ | 472 ✅ | **9 son grupos** | 1 ✅ |
| `pam_galicia` | ✅ | ✅ | ✅ | ✅ | *(no existe)* |
| `pam_galicia_cc` | ✅ | ✅ | ✅ | ✅ | *(no existe)* |
| `ma.ma_galicia` | ✅ | ✅ | ✅ | ✅ | *(no existe)* |

### 🔴 El problema real no es de integridad: es de MODELO

**Dos columnas guardan dos cosas distintas según el caso:**

| Columna | A veces apunta a | Y otras veces a |
|---|---|---|
| `comprobante_arca_id` | `{schema}.comprobantes_arca` | **`msa.grupos_pago`** (8 casos) |
| `template_cuota_id` | `cuotas_egresos_sin_factura` | **`msa.grupos_pago`** (9 casos) |

Eso es lo que **impide** la FK: una columna no puede declararse apuntando a dos tablas.

Y tiene un costo que ya se paga hoy, independiente de las FKs: **cualquier consulta que haga JOIN
por esas columnas pierde esos 17 movimientos en silencio** — **$15.641.213,21**. Pasó al escribir
este mismo dossier: un `LEFT JOIN` contra cuotas devolvió `null` y pareció un dato faltante.

### ⚠️ Tres cosas que hay que resolver ANTES de crear las FKs

1. **`template_cuota_id` a veces guarda un GRUPO, no una cuota.** Cuando el template está agrupado,
   ahí va un `msa.grupos_pago.id` — hoy son **9 movimientos** (ARBA, Municipalidad SP). Una FK contra
   `cuotas_egresos_sin_factura` los rechazaría a todos. Hay que decidir primero si ese uso se
   mantiene (y entonces hace falta **una columna aparte** para el grupo) o si se corrige.
2. **Decisión de comportamiento**: al borrar una cuota conciliada, ¿la base **impide** el borrado
   (`RESTRICT`) o **desvincula** el movimiento (`SET NULL`)? Las dos son defendibles. `SET NULL` es
   más suave y deja el movimiento visible como "conciliado sin vínculo", que el panel ya marca en
   ámbar.
3. **Alcance**: son **4 tablas** (`msa_galicia`, `pam_galicia`, `pam_galicia_cc`, `ma.ma_galicia`) ×
   hasta 5 columnas. Y `comprobante_venta_id` **sólo existe en `msa_galicia`**
   (→ [A-FEAT-24](#a-feat-24)), así que no es un patrón uniforme.

⚠️ Es cambio de **estructura de BD**: requiere el MCP en write o el SQL Editor, y no entra en el
backup (→ § CAMBIOS POST-RECONSTRUCCIÓN de `RECONSTRUCCION_SUPABASE_2026-01-07.md`).

### 📋 Plan de acción — 5 fases, en este orden

**Fase 0 · Decidir el modelo** — ✅ **DECIDIDO por el usuario 2026-08-20: MODELO A.**
> *"la idea sería hacer el modelo A pero NO hacerlo ahora. Dejarlo bien documentado."*

**Modelo A** = columna propia **`grupo_pago_id`** en las 4 tablas de extracto. Cada columna de
vínculo apunta a **una sola** tabla; las FKs se pueden crear y los JOIN dejan de perder filas.

*(Se descartó el modelo B —FK sólo en las 3 columnas sanas, dejando la ambigüedad— porque es más
barato pero **no arregla el problema que ya cuesta hoy**: los JOIN seguirían perdiendo los 17
movimientos.)*

⏸️ **No se ejecuta ahora, por decisión del usuario.** No bloquea la conciliación, y la Fase 3 es un
barrido de código que sacaría del trabajo en curso. Las fases 1-4 quedan listas para arrancar sin
volver a averiguar nada.

**Fase 1 · Migrar los 17 casos** *(dato — con backup y confirmación)*
Mover el valor a `grupo_pago_id` y dejar la columna vieja en `null`. Reversible: se sabe cuáles son.

**Fase 2 · Crear las FKs** *(estructura — MCP en write o SQL Editor)*
17 columnas + la nueva. **`ON DELETE SET NULL`**, no `RESTRICT`: si se borra el destino, el
movimiento queda *"conciliado sin vínculo"* — que el panel de la corrida **ya marca en ámbar**.
`RESTRICT` frenaría borrados legítimos y empujaría a la gente a esquivar la app.
⚠️ No entra en el backup → anotar en `RECONSTRUCCION_SUPABASE_2026-01-07.md` § CAMBIOS POST-RECONSTRUCCIÓN.

**Fase 3 · El código que lee esas columnas**
Los que hoy asumen "cuota" o "factura" tienen que contemplar el grupo: los 4 caminos de escritura,
el Cash Flow y los reportes. Es donde está el grueso del trabajo.

**Fase 4 · Control permanente**
El SQL de abajo, corrido junto con los otros controles. Debe dar **0** siempre.

⚠️ **Esto NO bloquea la conciliación en curso.** Es deuda estructural: se puede seguir conciliando
mientras tanto. Lo que sí conviene es no dejarlo indefinidamente, porque cada mes que pasa suma
movimientos agrupados a los 17.

### Mientras tanto — el control que sí se puede correr hoy
```sql
select count(*) from msa_galicia m
where m.template_cuota_id is not null
  and not exists (select 1 from cuotas_egresos_sin_factura c where c.id = m.template_cuota_id)
  and not exists (select 1 from msa.grupos_pago g where g.id = m.template_cuota_id);
-- al 2026-08-20: 0
```

---

## <a id="a-bug-42"></a>A-BUG-42 — Reasignar un movimiento **borraba** la cuota del template

> **Arreglado 2026-08-19. Los datos perdidos NO están recuperados** — ver § abajo.
> Lo encontró el usuario preguntando lo correcto: *"puse asignar, seleccioné la cuota existente y le
> di ok. ¿lo que decís es que eso borró la cuota?"*. Sí.

```ts
// ANTES — vista-extracto-bancario.tsx, rama template y rama sueldo
if (movimientoAsignando.template_cuota_id) {
  await supabase.from('cuotas_egresos_sin_factura')
    .delete().eq('id', movimientoAsignando.template_cuota_id)   // ← borraba
}
```

### La secuencia exacta
1. El motor deja el movimiento en `auditar` **con su cuota vinculada**.
2. El usuario abre *Asignar*, elige el template y **selecciona esa misma cuota**.
3. El código, **antes de mirar qué eligió**, borra la cuota apuntada — justo la elegida.
4. Después hace `UPDATE … WHERE id = <la que acaba de borrar>` → **0 filas y sin error**. Un UPDATE
   que no matchea **no falla** (la misma trampa de § Contrapartes en `CLAUDE.md`).
5. Escribe el ID en el extracto → **puntero colgado**, en silencio.

### Alcance medido
De **11** `template_cuota_id` colgados en las 4 tablas de extracto, **9 son falsos positivos**:
apuntan a **grupos de pago** (ARBA, Municipalidad SP), porque cuando el template está agrupado esa
columna guarda un `grupos_pago.id`. *(Confuso —la columna se llama "cuota"— pero ahí no se perdió
nada.)*

**Cuotas realmente borradas: 2, $1.738.362,11**

| Fecha | Importe | Template | Estado |
|---|---:|---|---|
| 11/05 | 1.165.390,11 | **Expensas Libertad** | 🔴 falta recrear |
| 02/06 | 572.972,00 | **Seguro Flota** | 🔴 falta recrear |

Las dos son reasignaciones, así que **el bug venía actuando desde mayo** sin que nadie lo notara.
Ese gasto no está en ningún template → no está en el Cash Flow **ni en el presupuesto**.

### Fix
`soltarCuotaAnterior()`: la cuota **vuelve a `pendiente`** en vez de borrarse, y **si es la misma que
el usuario eligió, no se toca**. Si era una cuota fantasma creada por una asignación previa, queda
**a la vista** para borrarla a mano — que es la dirección correcta del error (§ Datos: *nada
destructivo, find-or-create en vez de reemplazar*).

Además, la asignación ahora **avisa** lo que soltó por el camino, y los errores del `catch` dejaron
de morir sólo en la consola. *No queda ni un `.delete()` en `vista-extracto-bancario.tsx`.*

### ✅ Datos recuperados — 2026-08-20, con OK del usuario

| Template | Cuota creada | Importe | Movimiento re-vinculado |
|---|---|---:|---|
| Seguro Flota | **#12**, 02/06 | 572.972,00 | 02/06 ✅ |
| Expensas Libertad | **#5**, 11/05 | 1.165.390,11 | 11/05 ✅ |

Los números de cuota **confirman el borrado**: a Expensas Libertad le faltaba exactamente la **5**
en una serie 1-12 que estaba completa. Las dos quedaron con `descripcion` marcando que son
recreadas, y con `fecha_estimada` = la fecha real del débito (que es lo que hace la propia
asignación manual al vincular).

**Control**: `template_cuota_id` colgados que no son grupos → **0**.

---

## <a id="a-bug-41"></a>A-BUG-41 — El grupo de sueldos conciliaba a medias

> **HECHO 2026-08-19, sin testear.** Apareció en el primer uso real de [A-FEAT-33](#a-feat-33): el
> usuario agrupó los 2 pares de Sigot, corrió el motor, y el panel *Resultado de la corrida* marcó
> **"— sin vínculo"** en ámbar en los dos. **El aviso que se había puesto el día anterior hizo
> exactamente lo que tenía que hacer.**

Auditando las filas apareció que era peor que un vínculo faltante:

| Campo | Quedó | Debía |
|---|---|---|
| `proveedor_nombre` | `Ruben Sigot` | ✅ |
| `comprobantes_pagados` | **null** | `Haberes Mar 2026 — a cuenta` |
| `detalle` | `Anticipo Ruben Sigot - Anticipo Mar 2026 \| Anticipo Ruben Sigot - Anticipo Mar 2026` | vacío (no hay especificación) |
| `sueldo_pago_id` | **null** | el primer miembro del grupo |
| **`sueldos.pagos.estado`** | **`pagado`** (los 4) | `conciliado` |

### 🔴 Lo grave era lo que no se veía
El movimiento bancario quedó `conciliado` y **los pagos siguieron en `pagado`**. O sea que esos
**$2.071.305** quedaron conciliados en el extracto **y al mismo tiempo pendientes de pagar en el
Cash Flow**: la misma plata contada dos veces. Es el daño de [A-BUG-27](#a-bug-27) por otra puerta,
y va directo contra el norte — el presupuesto se autoalimenta de ahí.

### La causa: la misma condición, en dos lugares
```ts
// :452 y :606 — las dos exigían esto
matchCF.cashFlowRow.origen === 'SUELDO' && matchCF.cashFlowRow.origen_tabla === 'sueldos.pagos'
```
Una fila de **grupo** tiene `origen_tabla = 'msa.grupos_pago'`, así que no entraba por ninguna de las
dos: ni escribía el vínculo ni propagaba el estado.

⚠️ **Y ARCA y templates ya lo tenían resuelto** con `ids_grupo` (líneas 584 y 592). Sueldos era el
único origen sin eso. Al habilitar la agrupación (A-FEAT-33) no se revisó que el otro extremo la
soportara: **se abrió la puerta de entrada sin mirar la de salida.**

### Fix
- **Estado**: se concilian **todos** los miembros (`.in('id', ids_grupo)`), con `count` y aviso en
  consola si no actualizó ninguno — igual que ARCA.
- **Vínculo**: se guarda el **primer miembro** del grupo en `sueldo_pago_id`. El `id` de la fila de
  grupo es el `grupo_pago_id`, que apunta a otra tabla; desde el pago se llega al grupo igual.
- **Columnas**: la fila de grupo ahora lleva `comprobante_display` y `detalle_usuario`, que sólo
  tenían las individuales.

### ✅ TESTEADO OK — 2026-08-19, auditado contra la BD

El usuario revirtió las 2 filas a `pendiente` y volvió a correr. El panel pasó de *"— sin vínculo"* a
**"Pago de sueldo"**, y la auditoría confirma las 3 cosas:

| | 31/03 · $1.020.347 | 30/04 · $1.050.958 |
|---|---|---|
| `comprobantes_pagados` | **`Haberes Mar 2026 — a cuenta`** | **`Haberes Abr 2026 — a cuenta`** |
| `detalle` | `null` ✅ *(la descripción era puro período → no queda especificación)* | `null` ✅ |
| `proveedor_nombre` | `Ruben Sigot` | `Ruben Sigot` |
| `sueldo_pago_id` | miembro del grupo ✅ | miembro del grupo ✅ |
| **pagos del grupo** | **los 2 en `conciliado`** ✅ | **los 2 en `conciliado`** ✅ |

**La identidad cierra**: `918.347 + 102.000 = 1.020.347` y `895.958 + 155.000 = 1.050.958`. Ningún
miembro quedó a medio camino, así que el doble conteo se cerró.

Queda pendiente sólo `contable`/`interno`, vacíos por falta de la regla de Sigot → [A-DAT-04](#a-bug-39).

---

## <a id="a-feat-33"></a>A-FEAT-33 — Agrupar sueldos desde el Cash Flow

> **HECHO 2026-08-19, sin testear.** El usuario fue a agrupar los pagos de Sigot y le saltó
> *"Agrupar disponible para FC (ARCA) y templates"*.

**La función existía, pero en otra pantalla.** `agruparSueldos` estaba **inline en
`vista-facturas-arca.tsx`** (Vista Pagos), con código propio: no pasaba por `lib/pagos/agrupar.ts`.
El grupo `aa71dca9` de Sigot —los $1.028.648 del 01/06— se creó ahí el 01/06 a las 18:38.

📌 **Dato del usuario (2026-08-19): Vista Pagos desde Egresos se está desactivando.** Así que lo que
viva sólo ahí queda inaccesible. Esto vale para cualquier otra función que se encuentre en esa
pantalla.

### Por qué bloquear sueldos rompía la conciliación
El banco debita **el lote entero** de una acreditación de haberes en **una sola línea**, y el sistema
tiene **un pago por empleado**. El motor busca una fila del Cash Flow que valga lo mismo que el
débito y **nunca suma combinaciones**. Sin agrupación no existe esa fila → el movimiento no concilia
nunca. Es la causa de 3 de los pendientes de sueldos hasta el 18/06.

### Qué se hizo
- `lib/pagos/agrupar.ts` y `desagrupar.ts` aceptan `SUELDO`. La tabla sale de un helper
  (`tablaDeOrigen`) en vez de un ternario repetido: ARCA en el schema de su empresa, **templates y
  sueldos en `public`**, con el grupo siempre en `msa.grupos_pago` por la FK.
- El Cash Flow deja de bloquearlo y arma la observación como lo hacía Vista Pagos
  (`Sueldos agrupados: <nombres>`), para que los grupos viejos y los nuevos se lean igual.
- Desagrupar también contempla `SUELDO`.

**Sin restricción de empleado a propósito**: un lote de haberes junta a varios (el del 30/06 es Sigot
+ Barreto). El aviso de CUITs distintos que ya existía alcanza.

---

## <a id="a-bug-40"></a>A-BUG-40 — El Cash Flow decía "banco" y mostraba caja

> **HECHO 2026-08-19, sin testear.** Lo notó el usuario: *"¿es correcto que si escribo sigot en el
> buscador rápido me muestre los pagos por caja sigot, cuando por default se muestra sólo banco?"*

No, y **no era culpa del buscador**:

```ts
// vista-cash-flow.tsx:171 — el selector arranca en "banco"
const [medioPagoFiltro, setMedioPagoFiltro] = useState('banco')
// :1003 — pero el valor sólo viajaba al hook DENTRO de aplicarFiltros()...
```
…y `aplicarFiltros()` **no se llama al montar**, sólo desde el botón. O sea que la pantalla mostraba
"banco" seleccionado y los datos traían banco **y** cajas. El buscador rápido y los chips de estado
son client-side y filtran sobre eso: no salteaban el filtro, **el filtro nunca se había encendido**.

Es la misma familia que [A-BUG-34](#a-bug-34): **la pantalla afirma un estado que no tiene**. Un
filtro vacío que se ve vacío no engaña a nadie; uno que dice "banco" y muestra caja, sí.

**Y acá pega donde duele**: un pago de caja **no tiene contrapartida bancaria**, así que mezclarlos
en la grilla desde la que se decide qué conciliar induce al error. Es la versión de pantalla de
[A-BUG-36](#a-bug-36) — allá el motor cruza banco con caja, acá la vista los mezcla sin avisar.

**Fix** (decisión del usuario: *"por default que muestre sólo banco; si quiero ver otra cosa
selecciono caja y listo"*, sin chips nuevos): el medio de pago pasa a ser **client-side y siempre
activo**, aplicado **antes** de la búsqueda —primero se acota el universo, después se busca adentro—
y ya no viaja al hook, para no filtrar dos veces ni volver a atar el efecto al botón.

---

## <a id="a-bug-39"></a>A-BUG-39 — Un sueldo conciliado sin rastro de a quién se le pagó

> **HECHO 2026-08-19, sin testear.** Lo vio el usuario al revisar cómo había quedado el movimiento
> de Wilson: *"concilió pero no deja rastros de que sea Wilson a quien se le pagó. Diferente de
> otros casos que vimos."*

Así quedó el débito del 01/06 · $870.581 después de conciliar:

| Campo | Valor |
|---|---|
| `proveedor_nombre` | **null** |
| `comprobantes_pagados` | `Anticipo May 2026` |
| `detalle` | `Anticipo May 2026` |
| `contable` / `interno` | **vacíos** |

Leído en la grilla: *"se pagó un anticipo de mayo"*. **A quién, no dice.**

### Por qué con AMS sí funcionó
El motor buscaba el nombre **sólo en `proveedores`**:
```ts
const provNombreCF = await buscarNombreProveedor(matchCF.cashFlowRow.cuit_proveedor)
```
AMS **está** en `proveedores` (tiene facturas ARCA a su nombre), así que el lookup devolvía
*"Andres Martinez"*. **Wilson no está** —ni debe estar, no tiene factura de compra a su nombre
(§ Contrapartes)— así que devolvía `null`, y de ahí en cascada el `detalle` quedaba sin nombre.

Y el dato estaba a mano: la fila del Cash Flow ya trae `nombre_proveedor` con el nombre del
**empleado**. El motor lo ignoraba.

**Fix**: `proveedores` primero —es el nombre oficial y el usuario ya eligió esa convención— y si el
CUIT no está ahí, se usa el nombre de la fila del Cash Flow.

### <a id="a-dat-04"></a>A-DAT-04 — Y lo otro que faltaba: contable/interno vacíos
`contable` e `interno` quedaron en `''` porque salen de una regla **Tipo C por empleado**
(`reglas_contable_interno`), y **sólo 3 empleados la tienen**:

| Empleado | contable | interno |
|---|---|---|
| AMS | `CTA AMS` | `Desglosar` |
| JMS | `CTA JMS` | `Desglosar` |
| Alondra Olivo | `RET 3 MA` | `DIST MA` |
| **Wilson Barreto** | — | — |
| **Ruben Sigot** | — | — |

Eso **no es un bug de código**: es una regla que falta cargar. Pero explica por qué los movimientos
de Wilson y Sigot van a seguir saliendo sin códigos aunque concilien bien. Hay que decidir con el
usuario qué códigos les corresponden.

---

## <a id="a-bug-38"></a>A-BUG-38 — Wilson Barreto sin CUIT en el maestro de empleados

`sueldos.empleados.cuit_empleado` está en **null** para Wilson Barreto. Pero **el banco sí lo
informa**: el movimiento del 25/03 trae `20333189349` en `leyendas_adicionales_2`, con la leyenda
*"Wilson Severiano Barreto"*.

Consecuencias, las dos silenciosas:
- El **pre-filtro por CUIT** del motor no lo puede usar nunca para sus movimientos.
- En el selector de contraparte ([A-FEAT-32](#a-feat-32)) aparece como *"sin CUIT"*, y el filtro cae
  al nombre — que el banco escribe distinto según el movimiento.

✅ **Cargado el 2026-08-19 con OK del usuario**: `cuit_empleado = '20-33318934-9'` (con guiones, como
el resto de los empleados). Falta verificar en pantalla que el pre-filtro ya lo use.

> 📌 Y sirve de recordatorio: el hueco lo destapó el extracto. Un CUIT que el banco informa y el
> maestro no tiene es exactamente lo que § Contrapartes de `CLAUDE.md` pide no dejar pasar.

---

## <a id="a-feat-32"></a>A-FEAT-32 — La contraparte de un sueldo es un empleado, no un proveedor

> **HECHO 2026-08-19, sin testear.** El usuario quiso filtrar por Alondra y no aparecía.

**Alondra no está en `proveedores`** — verificado por CUIT (`27479260880`) y por nombre: cero filas.
Es empleada, así que vive en `sueldos.empleados`. El selector que se puso en
[A-FEAT-30](#a-feat-29) leía sólo el maestro de proveedores.

Es un hueco del diseño, no un dato faltante: **las contrapartes del extracto no son sólo
proveedores**. Una transferencia de sueldo tiene como contraparte al empleado, y ese maestro es otro.

**Lo que NO se hizo, a propósito**: dar de alta a los empleados en `proveedores`. Contablemente no
lo son, y § Contrapartes de `CLAUDE.md` dice que `es_proveedor` va sólo si hay factura de compra a su
nombre. Meterlos ahí ensuciaría el maestro del que salen CBU, mails y el pre-filtro del motor.

**Fix**: `ProveedorCombobox` tomó un flag **`incluirEmpleados`**, apagado por default. Sólo lo
enciende el filtro del Extracto; los 4 modales que ya lo usaban (ventas, liquidación, comprobantes,
reglas de import) siguen exactamente igual — ahí elegís una contraparte comercial y un empleado no
tiene sentido.

Detalles: los empleados salen con un chip **"empleado"** y su empresa; el CUIT se **normaliza** al
cargarlos (en `sueldos.empleados` va con guiones, [A-BUG-28](#a-bug-28)); un empleado sin CUIT
—Wilson Barreto— aparece igual, marcado *"sin CUIT"*, y el filtro cae al nombre; y si alguien está
en los dos maestros, gana el proveedor.

---

## <a id="a-bug-37"></a>A-BUG-37 — El motor decidía con una foto vencida del Cash Flow

> **HECHO 2026-08-19, sin testear.** Lo destapó el usuario en pleno testing, con una pregunta que
> parecía de otra cosa: *"corrí el motor y no lo concilió; no hice el refresh, pero el cambio fue de
> BD y no de motor, ¿no debería haber funcionado?"*

**Es al revés de lo que parece.** Un cambio de **código** arrastra el refresh solo (Vercel
redespliega, la página se vuelve a bajar y refetchea todo). Un cambio de **datos** hecho por fuera de
la pestaña —un SQL, otra solapa, otro usuario— **no invalida nada**: la página abierta sigue
mostrando lo de antes.

Y el motor no consultaba la BD al correr:

```ts
// hooks/useMultiCashFlowData.ts:1161
useEffect(() => { cargarDatos() }, [filtros])   // el motor lo llama sin filtros → UNA vez, al montar
```

El caso concreto: se liberó un pago de sueldo (`conciliado` → `pagado`) por SQL. En la foto del
navegador ese pago seguía `conciliado`, y la consulta que arma el Cash Flow excluye lo conciliado
(`.neq('estado','conciliado')`) — o sea que **el candidato no existía en el array**. El motor buscó
bien y no encontró nada. El panel lo dijo: `pendiente → pendiente (sin cambio)`.

### Por qué era peor que una molestia
Que el motor **no encuentre** es molesto. Que **decida con una foto vencida y escriba** es otra cosa:
conciliás, cargás una factura en otra solapa, volvés a conciliar, y el motor imputa contra un Cash
Flow que ya no existe. Sin ningún aviso.

### Fix
- `cargarDatos()` ahora **devuelve** la lista además de setear el estado (`setData` recién se ve en
  el próximo render, así que el estado no sirve para la misma corrida).
- `ejecutarConciliacion()` hace `await recargarCashFlow()` antes de procesar y le pasa esos datos a
  `buscarMatchCashFlow(movimiento, datos)`, que ya no lee del estado.
- El log de la consola ahora dice `Cash Flow: N (recargado al ejecutar)` — así se ve que pasó.

---

## <a id="a-bug-36"></a>A-BUG-36 — El motor cruza el banco con la caja

Encontrado al repasar los sueldos sin conciliar hasta el 18/06 (2026-08-19).

El débito del **29/05 · $110.000** de `msa_galicia` quedó en `auditar` vinculado a
`sueldo_pago_id = 566df873`, que es un pago de **Ruben Sigot** con **`medio_pago = 'caja_sigot'`**,
fecha 01/06 y estado `programado`.

El que correspondía era el de **Alondra Olivo**: mismo monto ($110.000), **misma fecha** (29/05),
`medio_pago = 'banco'`, y además el beneficiario que informa el banco en la leyenda es
*"Alondra Aylin Olivo"*. El motor eligió el de caja porque **no mira `medio_pago`** — le alcanza con
monto y fecha ±5 días.

**Por qué importa más de lo que parece**: un pago de caja **no tiene** contrapartida en el extracto
bancario, por definición. Vincularlo a un débito del banco:
1. deja al movimiento bancario verdadero sin candidato, y
2. marca como conciliado un pago de caja que nunca pasó por el banco.

Es el mismo daño que [A-BUG-33](#a-bug-33) pero generado por el motor en vez de por Sueldos.

**Fix propuesto**: al conciliar contra una cuenta de tipo `banco`, el pool de sueldos debe
restringirse a `medio_pago = 'banco'`; y al conciliar una **caja**, a esa caja. La info está en el
`CashFlowRow` (`medio_pago`), así que es un filtro más en el pre-filtro. ⚠️ Verificar antes qué
valores tiene `medio_pago` en la práctica (hay `banco`, `caja_sigot`, y probablemente otros).

---

## <a id="a-feat-31"></a>A-FEAT-31 — Homogeneizar las columnas del extracto

> **Pedido del usuario al cerrar la sesión del 2026-08-19**: *"hay una regla estándar que usamos
> para cómo se llena en la conciliación. La marcamos para facturas sobre todo. Deberíamos intentar
> que todo salga igual… tratar de ver que dejamos asentado que queríamos."*
>
> **La regla existe y está escrita**: `MODULO_CONCILIACION.md` § 30, de 2026-05-21. Este dossier no
> la reinventa — la trae acá para que sea el punto de partida, y **suma lo que se descubrió hoy**.

### 1. La convención que queríamos (§ 30.1)

| Columna | Rol | Ejemplo |
|---|---|---|
| `proveedor_nombre` | **Quién** cobró o cobra | `ALCORTA EDMUNDO`, `Wilson Barreto`, `Banco Galicia` |
| `comprobantes_pagados` | **Qué** se pagó — la referencia documental | `FC - 1234`, `Anticipo May 2026`, `Seguro Flota` |
| `detalle` | La **nota del usuario**, y nada más | `null` si el usuario no escribió nada |

**Regla textual del § 30.1**: *"`detalle` NUNCA se llena automáticamente con FC, proveedor ni
período. Esos datos ya están en sus columnas propias."*

Y § 30.2 fija el **formato de `comprobantes_pagados` por origen** (ARCA individual y agrupada,
template, sueldo, anticipo, bancario), con la convención `FC/NC/ND - {numero}` sin punto de venta ni
ceros. § 30.3 define el mecanismo: el `CashFlowRow` lleva `comprobante_display` y `detalle_usuario`,
que son los dos campos que viajan al extracto — separados a propósito del `detalle` decorativo que
usa la grilla del Cash Flow.

### 2. ⚠️ La contradicción que hay que resolver primero

**El repo tiene dos decisiones opuestas sobre `detalle`, tomadas en momentos distintos, y nadie las
reconcilió:**

| Dónde | Qué dice |
|---|---|
| `MODULO_CONCILIACION.md` § 30.1 (2026-05-21) | `detalle` **nunca** se llena automáticamente |
| `useMotorConciliacion.ts`, comentario de **A-BUG-07** | `detalle` se **deriva** a `<comprobante> — <proveedor>`, porque *"un template conciliado por el motor quedaba trazado por ID pero **ilegible en la grilla**: no decía qué era"* |

Las dos tienen razón en su contexto: la convención quiere columnas limpias sin redundancia; A-BUG-07
quiere que la grilla se **lea**. **La homogeneización empieza por elegir una** — probablemente
respetando el § 30.1 y arreglando la legibilidad en la grilla (mostrando las columnas que
corresponden) en vez de duplicando el dato en `detalle`.

### 3. Lo que hoy NO cumple la convención

| Caso | Qué pasa | Estado |
|---|---|---|
| Sueldos: faltaban `comprobante_display` y `detalle_usuario` en la fila del Cash Flow | `comprobantes_pagados` en null y texto decorativo en `detalle` | ✅ [A-BUG-30](#a-bug-30) |
| Sueldos: el nombre salía sólo de `proveedores` | un empleado que no es proveedor quedaba **sin nombre** | ✅ [A-BUG-39](#a-bug-39) |
| Reasignar no limpiaba los vínculos viejos | dos movimientos reclamando el mismo pago | ✅ [A-BUG-31](#a-bug-31) |
| Filas viejas con la sigla (`AMS`) en vez del nombre completo | 4 filas de feb/mar, inconsistentes con el resto | 🔴 pendiente, van en este lote |
| `contable` / `interno` vacíos por falta de regla por empleado | Wilson y Sigot | 🔴 [A-DAT-04](#a-bug-39) |
| **226 filas `pendiente` con `categ = 'INVALIDA:'`** | valor idéntico en todas → escritura masiva, no uso normal | 🔴 sin investigar |

### 3.bis La convención para SUELDOS, cerrada con el usuario (2026-08-19)

> Palabras del usuario: *"teniendo una columna llamada proveedor y una llamada comprobante, esos dos
> datos no hace falta ponerlos en detalle. Detalle va para la especificación que puede haber o no."*

| Columna | Contenido | De dónde sale |
|---|---|---|
| `proveedor_nombre` | el **empleado** | `empleado.nombre` (fallback ya hecho → [A-BUG-39](#a-bug-39)) |
| `comprobantes_pagados` | **`Haberes <Mes> <Año>`**, distinguiendo a cuenta / saldo | el **período** (`sueldos_periodos.mes/anio`) + `pagos.tipo` |
| `detalle` | la **especificación**, si la hay: `Cuota Alimentaria Lucresia` | `pagos.descripcion`, sacándole el período |

**Tres definiciones que se tomaron:**

1. **El comprobante sale del PERÍODO, no de la descripción.** Hoy copia `pagos.descripcion` y por eso
   salió `Anticipo May 2026`. El caso feo ya está cargado: el pago de Wilson del 24/07 tiene como
   descripción *"Formalmente un anticipo de sueldo pero es eq a sus francos de Junio"* — **eso entero
   iría a la columna del comprobante**.
   ⚠️ **La pieza ya existe en el otro camino**: la asignación manual joinea
   `sueldos_periodos(mes, anio)` y arma el label (`vista-extracto-bancario.tsx:1624`). El motor no.

2. **El comprobante DEBE distinguir** *a cuenta* de *saldo*. Si no, un pago a cuenta y el saldo del
   mismo mes quedarían con el mismo comprobante en dos movimientos distintos.
   📌 **Corrección de vocabulario del usuario**: lo que el sistema llama `anticipo` **está mal
   dicho** — *"puede ser en fecha de pago a fin de mes; si hacés 4 pagos terminan quedando 3
   anticipos más 1 saldo, cuando en realidad son **3 pagos a cuenta más el pago del saldo**"*.
   Formato propuesto (falta confirmar el texto exacto): `Haberes May 2026 — a cuenta` /
   `Haberes May 2026 — saldo`.
   *(Dato del usuario para más adelante: el saldo suele ser **los francos**, que se pagan al final y
   salen **por caja**. Por ahora se deja así.)*

3. **`detalle` es la descripción del pago**, no `null`. ⚠️ Corrige lo que se hizo el 2026-08-19 en
   [A-BUG-30](#a-bug-30), donde se puso `detalle_usuario: null` con el argumento de que "un sueldo no
   tiene nota del usuario". **Falso**: el usuario ya la usa — `"Anticipo May 2026 - Lucresia"`,
   `"- Galicia"`, `"- Santander"`. Con el punto 1, la descripción **se parte**: el período va al
   comprobante y el resto al detalle.

**Consecuencia a mirar de frente**: las descripciones ya cargadas mezclan período y especificación.
Al partirlas, las viejas quedan con el período repetido en las dos columnas. O se migran, o se
convive hasta que roten.

### 4. Alcance y **método** — decidido con el usuario

Los **4 caminos** que escriben al extracto, que hoy no coinciden entre sí (§ 30.4):
1. motor — match por Cash Flow
2. motor — match por reglas / `llena_template`
3. asignación manual (las 4 pestañas del modal)
4. edición masiva

> **Cómo se hace, textual del usuario (2026-08-19):** *"vamos a ir probando conciliar los pendientes
> y debería ir saltando esto. Entonces vamos homogeneizando **desde la prueba** y no todo junto y
> luego volver a corregir."*

O sea: **NO un refactor de los 4 caminos de una.** Cada divergencia se arregla **cuando aparece
conciliando un caso real** — que es como salieron los 9 bugs de esta sesión, y ninguno se encontró
leyendo código.

⚠️ Con una salvedad, para que el método incremental no termine en cuatro implementaciones distintas
otra vez: **el primer caso que se toque construye el helper único** que arma las 3 columnas, y cada
camino se va enchufando ahí a medida que le toca. Arreglar cada camino por su cuenta es reproducir
exactamente el problema que estamos cerrando.

### ✅ Paso 1 hecho — 2026-08-19: el helper existe y el motor lo usa

`lib/conciliacion/columnas-extracto.ts` arma las 3 columnas en un solo lugar:

| Función | Qué hace |
|---|---|
| `columnasDelExtracto(fila, nombreMaestro, detalleExistente)` | las 3 columnas, con el § 30.1 aplicado |
| `comprobanteDeSueldo(tipo, mes, anio)` | `Haberes Mar 2026 — a cuenta` / `— saldo` |
| `especificacionDeSueldo(descripcion)` | `"Anticipo May 2026 - Lucresia"` → `"Lucresia"` |

Decisiones que quedan tomadas ahí:
- **Se fue la derivación de A-BUG-07.** `detalle` ya no se arma como `<comprobante> — <proveedor>`.
  La grilla muestra esas dos columnas aparte, así que el motivo estaba saldado.
- **Lo que el usuario escribió nunca se pisa**: si el movimiento ya tenía `detalle`, manda ése.
- Si la descripción de un pago **no** tiene la forma `<tipo> <Mes> <Año>`, se devuelve **entera** —
  mejor de más que perder lo que escribió el usuario. Caso real: *"Formalmente un anticipo de sueldo
  pero es eq a sus francos de Junio."*

**Control**: `npx tsx scripts/verificar-columnas-extracto.mts` — 8 casos reales ya cargados, incluidos
los tres de Sigot (`Lucresia` / `Galicia` / `Santander`) y los dos de texto libre. Correrlo después
de tocar la convención.

**Caminos migrados: 1 de 4** (motor por Cash Flow). Faltan motor por reglas, asignación manual y
edición masiva — se enchufan cuando su caso aparezca conciliando.

---

---

## <a id="a-feat-29"></a>A-FEAT-29 / A-FEAT-30 — Que la corrida se pueda revisar, y buscar por contraparte

> **HECHAS 2026-08-19, sin testear** (→ A-TEST-34).

### A-FEAT-29 — "Resultado de la corrida"
**Pedido textual del usuario**: *"tenemos que ver cómo hacemos para que no se me vayan los
movimientos hasta que no le dé actualizar, ya que yo reviso cómo quedaron, los tildo como
chequeados antes de refrescar y seguir con otros."*

Pasaba esto: con el filtro en `pendiente`, un movimiento que el motor conciliaba **desaparecía de la
grilla en el mismo instante** en que se resolvía — justo antes de poder mirarlo.

- Las filas que tocó el motor quedan **pinneadas arriba** aunque el filtro ya no las alcance.
- Un panel muestra **antes → después** de cada una, con la categ y a qué se vinculó (factura ARCA /
  pago de sueldo / template / venta), y marca en ámbar las que cambiaron de estado **sin vínculo**.
- Se sueltan con **Actualizar y soltar**, no antes.

Es también el **control visible** que le faltaba al motor (`CLAUDE.md` § *Todo desarrollo termina con
su control*): hasta ahora decía *"3 automáticos, 1 sin match"* en números, pero no **cuáles**.

### A-FEAT-30 — Filtro por contraparte
Un input que acepta **nombre o CUIT**, y busca en las 3 columnas donde puede estar: el proveedor que
resolvió el sistema (`proveedor_nombre`), el que escribió el banco (`leyendas_adicionales_1`) y el
CUIT (`leyendas_adicionales_2`). El CUIT se compara **normalizado** — `20-28749254-6` y
`20287492546` encuentran lo mismo, que es la lección de [A-BUG-28](#a-bug-28).

Antes no se podía: el buscador general recorre 11 columnas y **`proveedor_nombre` no era una de ellas**.

---

## <a id="a-bug-19"></a>A-BUG-19 — Cash Flow: los sueldos vuelven a "pagar" solos (2026-08-10)

**Reportado por el usuario**: *"Cash Flow no está registrando los sueldos como pagados. Parece que
sí, pero luego al irme y volver a Cash Flow vuelve a quedar como pagar en vez de pagado. En el
momento yo lo doy por bueno pero luego se resetea y termino teniendo muchos pagos como pagar cuando
ya los pasé a pagado."*

**Por qué es grave, más allá de la molestia**: es el patrón que venimos persiguiendo toda la
sesión — **el silencio miente**. La pantalla confirma el cambio, el usuario lo da por hecho y sigue;
recién lo descubre mucho después, y para entonces no sabe cuáles marcó y cuáles no. Además un
sueldo que figura "a pagar" cuando ya se pagó **infla el egreso proyectado**: entra al Cash Flow y
de ahí al presupuesto, que es el norte del proyecto.

**Hipótesis a descartar en orden** (la primera que aplique explica todo):
1. El `UPDATE` matchea **0 filas** y devuelve OK — el caso clásico. Se ve con `count: 'exact'`.
2. Se escribe en el **schema equivocado** (los sueldos tienen su propio schema `sueldos`).
3. Se escribe bien pero **la lectura recalcula el estado** en vez de leerlo, y lo pisa al volver.
4. Optimismo de UI: el estado se pinta local y nunca se persiste.

### ✅ CAUSA ENCONTRADA y ARREGLADA (2026-08-10) — falta testear

**Se confirmó con un test en vivo acordado con el usuario**: marcó `Pago Saldo AMS 518.188` del
07/08 desde el botón **PAGOS**, la pantalla lo pintó verde… y en la BD seguía en `pagar`.
**Nunca se guardó.** No había reseteo: el guardado no llegaba y la pantalla lo daba por bueno.

**La causa**, en `actualizarBatch` (`useMultiCashFlowData.ts`):

```ts
const arcaUpdates     = actualizaciones.filter(u => u.origen === 'ARCA')
const templateUpdates = actualizaciones.filter(u => u.origen === 'TEMPLATE')
// … se escriben esas dos y nada más
for (const update of actualizaciones) actualizarLocal(...)   // ← pinta TODAS
return true                                                   // ← siempre
```

El lote aceptaba filas de cualquier origen pero **sólo sabía escribir facturas y templates**. Un
`SUELDO`, `ANTICIPO` o `VENTA` se descartaba en silencio, y después el bucle final pintaba en verde
**todas** las filas y devolvía `true`.

> 🔴 **Y TypeScript lo venía marcando**: `Type '"ARCA" | "TEMPLATE" | "ANTICIPO" | "SUELDO" | "VENTA"
> is not assignable to type '"ARCA" | "TEMPLATE"'`, en **4 líneas** de `vista-cash-flow.tsx`. Estaba
> en el baseline de errores preexistentes — el mismo que se usó toda esta sesión para afirmar "no
> rompí nada". Nadie lo miró. Es el argumento más fuerte a favor de [A-OP-07](#a-op-07).

**Alcance**: no era sólo sueldos. Afectaba a **sueldos, anticipos y ventas** en el botón PAGOS.

#### El arreglo, 3 partes
1. **El lote sabe guardar todo**: los orígenes sin camino en lote se **delegan a
   `actualizarRegistro`**, que ya sabe a qué tabla va cada uno — en vez de duplicar esa lógica.
2. **Verifica que escribió**: `count: 'exact'` en `sueldos_pagos`, `anticipos_proveedores` y las dos
   ramas de `cuotas_egresos_sin_factura`. Un UPDATE de 0 filas ahora falla y avisa.
3. **Se pinta sólo lo que se guardó.** Y si algo falla, el modo PAGOS **queda abierto con la
   selección puesta**, para ver qué pasó y reintentar sin volver a marcar todo.

**De yapa**: las filas de grupo de sueldos ya no están fijas en `'pagar'` — usan `estadoDeGrupo()`,
el mismo criterio que los grupos de facturas.

⚠️ **Queda abierto**: una fila de **sueldo del mes** o de **grupo** sigue sin poder editarse desde
Cash Flow, pero ahora **lo dice** en vez de callarse. Si se quiere que marcarlas registre el pago de
verdad, es el camino A que quedó sin decidir (ver arriba).

#### ✅ TESTEADO 2026-08-10
El usuario volvió a marcar desde PAGOS y verificado contra la BD:

```
92a81880 · 07/08 · 518.188   pagado   ← el del test
125f905f · 31/07 · 1.050.000 pagado   ← marcó también éste
268d5fcf · 10/07 ·   969.421 pagar    ← sin tocar (es del período de junio)
```

Los dos quedaron guardados después de recargar. **Cerrado.**

⚠️ Lo que NO cubre este arreglo y sigue abierto: marcar una fila de **sueldo del mes** desde Cash
Flow. Hoy avisa que se gestiona desde Sueldos, en vez de callarse — pero no lo hace. Si se quiere
que marcarla **registre el pago**, es el camino A (arriba). Decisión pendiente del usuario.

---

## 💸 Cash Flow → PAGOS — los 3 pendientes del 2026-08-10

> Los tres salieron de un caso real del usuario: puso un lote a pagar, saltó SICORE, y como la
> fecha de pago no era la correcta canceló. **Se le pasó a la mitad y quedaron todas en `pagar`.**

### 🔴 <a id="a-bug-20"></a>A-BUG-20 — Cancelar en SICORE no aborta el proceso 🔁 REGRESIÓN

**Reportado por el usuario**: *"le di cancelar al primer cartel… eso debe abortar proceso. Ya lo
habíamos hablado y volvió el bug, porque quedaron todas en pagar."*

**El cartel es** el `window.confirm` de `aplicarCambiosLote`:
*«N factura(s) ARCA califican para retención SICORE… ¿Procesar SICORE una por una?»*

**Y lo que hace hoy Cancelar no es cancelar.** En el `else` de ese confirm:

```ts
if (!confirmar) {
  // Guardar todas sin SICORE
  await actualizarBatch(facturasParaSicore.map(f => ({ …, campo: 'estado', valor: 'pagar' })))
  toast.success(`${facturasParaSicore.length} facturas marcadas 'pagar' sin SICORE`)
}
```

O sea: **Cancelar = "marcalas todas en pagar y seguí"**. No aborta nada. Y como el usuario lo
aprieta esperando volver atrás, el lote queda aplicado a medias y con la fecha equivocada.

**El problema de fondo es el texto del cartel, no sólo el código.** *"¿Procesar SICORE una por
una?"* con Aceptar/Cancelar no ofrece tres opciones, ofrece dos — y ninguna de las dos es "no hagas
nada". Hay **tres intenciones posibles** y hacen falta tres botones:

| Lo que el usuario quiere | Qué debería pasar |
|---|---|
| Procesar SICORE una por una | lo que hace hoy Aceptar |
| Pagar sin retener | lo que hace hoy Cancelar (marcar en `pagar`) |
| **Volver atrás** | **no tocar nada** — y hoy no existe |

⚠️ **Es regresión**: ya se había resuelto antes. Y ojo: hay más de un camino que llega acá (lote,
fila individual, cola de SICORE) — verificar los tres.

#### ✅ ARREGLADO 2026-08-10 — falta testear
El `window.confirm` se reemplazó por un diálogo con **tres botones**, uno por intención:

| Botón | Qué hace |
|---|---|
| **Retener SICORE — una factura por vez** | la cola de siempre |
| **Pagar sin retener** | marca el estado sin retención |
| **Cancelar — no tocar nada** | 🔑 **aborta de verdad** |

Y el cambio de fondo, que es lo que hace posible que Cancelar cancele: **ahora no se escribe nada
hasta que la pregunta está contestada.** Antes se guardaba una parte del lote y recién después se
preguntaba, así que cancelar dejaba el lote aplicado a medias — y ése era el síntoma que reportó el
usuario ("quedaron todas en pagar"). El diálogo lo dice: *"Todavía no se guardó nada"*.

Además el diálogo **lista las facturas con su fecha de pago**, para poder ver antes de decidir que
la quincena va a salir bien.

### 🔴 <a id="a-feat-22"></a>A-FEAT-22 — La fecha de pago se confirma ANTES de SICORE

**Planteo del usuario**: *"las facturas tienen una fecha estimada y si no pongo fecha de pago quedan
con esa fecha estimada. Por lo general yo registro cuando pago."*

O sea: la fecha de pago **se asume** y casi siempre está mal, porque el registro se hace el día que
se paga, no el día que se había estimado.

**Y no es cosmético**: la quincena de SICORE se calcula desde la fecha de pago
(`generarQuincenaSicore(f.fecha_pago || f.fecha_vencimiento || f.fecha_estimada)`). Con la fecha
equivocada, **la retención puede caer en la quincena equivocada** — y eso se presenta a ARCA.

**Lo pedido**, en este orden: primero la fecha, después SICORE.

1. Al aplicar el lote, **antes de todo**, un paso que propone la **fecha de hoy** y deja editarla.
2. Tres salidas, no dos:
   - **Aceptar** → se registra la fecha elegida (hoy o la que se escriba) como `fecha_pago`.
   - **Dejar las fechas que están** → `fecha_pago` se llena con la `fecha_estimada` de cada una.
     Es la opción que hoy ocurre por omisión, pero elegida a propósito.
   - **Cancelar** → aborta todo el proceso, sin tocar nada.
3. Recién ahí se evalúa SICORE, ya con la fecha correcta.

Se cruza con [A-BUG-20](#a-bug-20): los dos son el mismo problema de fondo — **carteles que no
ofrecen la salida que el usuario está buscando**.

#### ✅ HECHO 2026-08-10 — falta testear
El lote se partió en dos fases. Cuando el estado elegido implica que la plata sale
(`ESTADOS_QUE_PAGAN` = pagar · preparado · programado · pagado · débito), **antes de todo** aparece
el paso de la fecha, con las tres salidas pedidas:

| Botón | Qué hace |
|---|---|
| **Registrar con esta fecha** | propone **hoy**, editable → se guarda como `fecha_pago` en todas |
| **Dejar las fechas que ya tienen** | `fecha_pago` = `fecha_estimada` de cada una, pero **elegido a propósito** |
| **Cancelar — no tocar nada** | aborta |

Recién después se evalúa SICORE, ya con la fecha correcta. `echeq` queda afuera: tiene su propio
flujo con la fecha de emisión del cheque.

### 🔑 Y la regla que atraviesa todo: SICORE sale SIEMPRE de `fecha_pago`

**Regla del usuario 2026-08-10**: *"SICORE siempre toma fecha de pago, nunca puede tomar otra fecha.
Si no hay fecha de pago no se debe poder calcular ni registrar SICORE."*

Había **una cadena de respaldo que hacía exactamente lo prohibido**:

```ts
generarQuincenaSicore(fila.fecha_pago || fila.fecha_vencimiento || fila.fecha_estimada || hoy)
```

Producía en silencio una quincena plausible pero equivocada — **y la quincena se presenta a ARCA**.
Estaba en 3 lugares, más un cuarto que directamente usaba `fecha_estimada`.

Ahora hay **una sola función**, `quincenaDePago(fila)`, que devuelve `''` si no hay fecha de pago, y
tres guardas que cortan:
- al **evaluar** si una fila califica → avisa y no sigue;
- al **calcular** la retención → tira error;
- en el **lote** → esas facturas van por el camino directo, sin retención, y se avisa cuántas fueron.

⚠️ **Queda pendiente el módulo ARCA** (`vista-facturas-arca.tsx`): tiene el mismo patrón en ~6
lugares con `fecha_vencimiento || fecha_estimada`, y además **una copia local de
`generarQuincenaSicore`** (línea 3255) que duplica la de `lib/sicore/quincena`. Es la misma regla y
hay que aplicarla ahí, pero es otra pantalla y merece su propia pasada → nuevo ítem.

### 🟡 <a id="a-bug-22"></a>A-BUG-22 — A las Fac C se les proponía SICORE (código muerto)

**Reportado por el usuario 2026-08-10**: *"cuando pongo a pagar la factura de Micelli (FAC C) me
propone SICORE, y ya habíamos visto que facturas C no debe proponer porque no llevan retención."*

**Y tenía razón: el filtro estaba escrito.** En `evaluarRetencionSicoreCF`:

```ts
// Fac C (tipo 11 = monotributista): NUNCA se le retiene
if ((fila as any).tipo_comprobante === 11) { … }
```

**Pero nunca se ejecutaba.** `tipo_comprobante` **no existía en la fila del Cash Flow**: el hook lo
leía del comprobante ARCA sólo para armar el texto `"FC A - 00012"` y no lo pasaba a la fila. La
comparación daba `undefined === 11` → `false`, siempre.

> 🔑 **El `as any` fue lo que dejó pasar el error.** Sin él, TypeScript habría dicho que la
> propiedad no existe. Es el mismo patrón que [A-BUG-19](#a-bug-19): el compilador tenía la
> respuesta y se lo silenció.

Y había un segundo problema debajo: el filtro estaba **sólo en el camino de la fila individual**.
El lote (botón PAGOS) ni siquiera lo consultaba, así que aunque el dato hubiera llegado, por ahí
seguían pasando.

#### El arreglo
1. **`tipo_comprobante` ahora llega a la fila.** En los grupos se declara sólo si **todas** las
   facturas coinciden; si están mezcladas queda `null` y el grupo pasa por la evaluación — el lado
   seguro, porque saltear una retención que corresponde es peor que preguntar de más.
2. **Una sola definición**, `admiteSicore()`, usada por **los dos caminos**.
3. Cubre la familia C completa: **11** Factura C · **12** ND C · **13** NC C. Hoy en la BD hay 40
   comprobantes tipo 11 y ninguno de los otros dos; se incluyen porque el motivo es el mismo —quien
   emite es monotributista— y así no hay que acordarse el día que aparezcan.

**Falta testear** → poner a pagar la factura de **Micelli**: no tiene que proponer SICORE, ni desde
la fila ni desde el lote.

### 🔴 <a id="a-bug-21"></a>A-BUG-21 — La misma falla de la fecha, en el módulo ARCA

Detectado 2026-08-10 al aplicar la regla en Cash Flow. `components/vista-facturas-arca.tsx`:

1. Calcula la quincena desde **`fecha_vencimiento || fecha_estimada`** en ~6 lugares (líneas 1374,
   3336, 3558, 4051…), o sea **nunca desde la fecha de pago**. Contradice la regla del usuario.
2. Tiene **su propia copia** de `generarQuincenaSicore` (línea 3255) en vez de usar la de
   `lib/sicore/quincena`. Dos implementaciones de la misma cuenta: si una se corrige y la otra no,
   la misma factura cae en quincenas distintas según por qué pantalla se la mire.

**Orden sugerido**: primero unificar en la lib (que sean una sola), después aplicar la regla de
`fecha_pago`. Al revés se corrige una copia y queda la otra.

⚠️ Es la pantalla desde donde se genera el TXT que va a ARCA: **correr en seco y comparar antes**.

### 🟡 <a id="a-feat-23"></a>A-FEAT-23 — Autocompletar el año en las fechas

Al escribir una fecha con **día y mes pero sin año** (`10/8`), completar con el **año actual**.

Hoy el parseo de `DD/MM/AAAA` espera las tres partes: `const [d, m, y] = fechaStr.split('/')`. Con
dos, `y` queda `undefined` y sale una fecha inválida.

Chico, pero es de los que más se usan: la fecha se tipea muchas veces por día.

#### ✅ HECHO 2026-08-10 — falta testear
`fechaTipeadaAISO()` reemplaza al `split('/')` suelto. Verificado:

```
"10/8"       -> 2026-08-10      "5/3/26"     -> 2026-03-05
"10/08"      -> 2026-08-10      "5/3/2026"   -> 2026-03-05
"1/12"       -> 2026-12-01      "2026-08-10" -> 2026-08-10 (pasa igual)
```

Acepta `/`, `-` y `.` como separador, y un año de 2 dígitos. Por ahora **sólo en Cash Flow** — falta
llevarlo al resto de las pantallas donde se tipea una fecha.

⚠️ Al hacerlo, mirar **todos los lugares** donde se tipea una fecha, no sólo Cash Flow — si sólo
funciona en una pantalla, es peor que no tenerlo, porque uno cuenta con eso y en la otra falla.
Y cuidado con el import de pesadas, donde una fecha ambigua ya metió **176 pesadas en marzo**
(→ [A-TEST-18](#a-test-18)): acá el año se **completa**, no se adivina — el día y el mes los
escribió el usuario.

---

## <a id="a-feat-20"></a>A-FEAT-20 — Homologar columnas de Caja de Ahorro y dónde va el CBU (2026-08-10)

**Punto de partida**: la convención de columnas quedó **medida sobre los datos**, no supuesta —
849 movimientos de MSA y 76 de PAM CC, que son los que el banco llenó solo.
Tabla completa → `ARQUITECTURA-BD.md` § 6b.

### Lo que hay que homologar en MA y PAM CA
Sale directo de comparar contra MSA. Lo más claro:

| Dato | Hoy en MA | Debería ir a |
|---|---|---|
| `BANCO DE GALICIA Y BUENOS AIRES SAU` | `numero_de_terminal` | **`leyendas_adicionales_4`** (es la del banco en MSA) |
| CUIT | ✅ `leyendas_2` | ya está bien |
| nombre | ✅ `leyendas_1` | ya está bien |

**El criterio del usuario, y es el correcto**: *"lo que me parece bien es homologar, así cada dato
va a su lugar e incluso no hace falta que lo setee yo, ya que me puedo confundir."* O sea: la
convención no es una regla para recordar, es algo que **la app tiene que proponer sola**.
`proponerMapeo()` ya hace eso; falta alinearlo a la convención completa (banco → `leyendas_4`).

### ✅ RESUELTO 2026-08-10 — el CBU va a `tipo_de_movimiento`

**Decisión del usuario.** Se eligió reusar la única columna sin dueño en vez de crear una nueva.
La pantalla la rotula **«CBU»**, no por su nombre técnico, y la convención queda escrita en tres
lugares: `ARQUITECTURA-BD.md` § 6b, el encabezado de `lib/extractos/parseo-movimiento.ts` y el
comentario del importador de CA.

Lo implementado junto con la decisión:
- **Modos nuevos `cbu` y `tarjeta`** — buscan el dato donde esté, como `cuit`. Los detectores ya
  existían (se usaban para la firma de forma); faltaba exponerlos.
- **El banco va a `leyendas_adicionales_4`**, igual que en MSA. Se detecta solo (empieza con
  `BANCO`) y se propone. En MA hoy cae en `numero_de_terminal`.
- **El importador de CA** dejó de escribir `tipo_de_movimiento: ""` fijo.
- Las columnas se eligen por **lo que guardan** (`CUIT`, `Concepto`, `Banco de la contraparte`),
  no por su nombre — así el nombre desalineado de la columna del CBU no confunde a nadie.

### La decisión, tal como se tomó
El usuario propuso revisar **todas** las columnas por si alguna estaba libre. Se revisaron las 37 de
cada tabla. Resultado:

| Columna que parecía libre | Veredicto |
|---|---|
| `observaciones_cliente` | ❌ **ocupada** — en CA la llena el usuario desde la columna «Comentarios» del Excel. 10 valores en MA: `"lavaplatos"`, `"empl Dom Nz"`, `"su carmen 4 dias"`. En gastos personales sin factura es la **única** anotación de qué fue el movimiento |
| `concepto` | ❌ **la más ocupada de todas** — guarda el **texto crudo entero** del banco (96/96 en MA). Es lo que hace posible re-parsear sin volver a importar |
| `origen` | ❌ `"CA_GALICIA"` en el 100 % — traza del importador |
| `grupo_de_conceptos` | ❌ etiqueta del tipo, alimenta el dashboard |
| **`tipo_de_movimiento`** | ✅ **la única libre** — `"Imputado"` en el 100 % de MSA y PAM CC, vacía en las CA, y **nunca se lee en el código** |

**Las tres opciones, con lo que cuesta cada una:**
1. **Columna `cbu` nueva** *(recomendación de Claude)* — el nombre dice lo que guarda, es consultable
   por sí misma el día que sirva para emparejar contra `proveedores.cbu`. Contra: el usuario prefiere
   no sumar columnas.
2. **Reusar `tipo_de_movimiento`** — funciona hoy, pero deja una columna cuyo nombre miente. Es la
   misma deuda de [A-FEAT-16](#a-feat-16): qué significa cada columna.
3. **No guardar el CBU** — hoy son **5 CBUs distintos y 0 coinciden** con los 33 del maestro de
   proveedores. El texto crudo queda en `concepto`, así que un re-parseo lo rescata cuando se decida.

> Dato para decidir: el usuario aclaró que **muchos movimientos de MA son consumos personales sin
> factura**, así que el CBU no va a emparejar con nada en la mayoría de los casos — pero *"si el dato
> está, se guarda bien"*.

### Modos que faltan
`busca el CBU` (22 dígitos) y `busca la tarjeta` (enmascarada con `X`), análogos a `busca el CUIT`.
**Los detectores ya existen** (`esCbu`, `esTarjeta`, usados por la firma de forma); falta exponerlos
como modo. Sirven para que la regla **sobreviva a las formas** — en `TRANSFERENCIA A TERCEROS` el
CBU está en la línea 3 de dos formas y no existe en la tercera.

## <a id="a-feat-21"></a>A-FEAT-21 — Una tarjeta por forma, en vez de un tipo con selector de alcance

**Propuesta del usuario 2026-08-10**: *"me parece medio rebuscado la UI. Yo creería que lo mejor es
tener 3 tipos directamente, verlo por separado, configurarlos por separado."*

**De acuerdo.** Toda la maquinaria que se construyó —selector de alcance por fila, botones de forma,
previa en tres columnas— existe **sólo porque las reglas se comparten entre formas**. Con una tarjeta
por forma, esa maquinaria desaparece. **Saca código, no lo agrega.**

**No toca la BD**: `firma_forma` ya está por regla; un "tipo" en la pantalla pasa a ser *(tipo, forma)*.

#### La objeción que Claude levantó y el usuario desarmó
Claude dijo que duplicar las reglas del CUIT y del nombre costaría *"si mañana cambiás la columna del
CUIT"*. **El ejemplo estaba mal elegido**: la columna del CUIT es lo que **nunca** cambia — es fija
por convención y el motor la lee de ahí. O sea que lo que se duplicaría es justamente lo que no se
edita nunca, y encima la app lo propone solo. La objeción se cae.

#### La única condición que sí queda
**`grupo_de_conceptos` no se puede duplicar.** Es del tipo, no de la forma: si cada tarjeta tiene su
campo independiente, alcanza con que una diga `Transferencias` y otra `Transferencia` para que el
dashboard parta el mismo concepto en dos.

→ Diseño: lista **agrupada por tipo**, con el grupo de conceptos arriba (uno, compartido) y **una
tarjeta por forma** debajo, cada una con su ejemplo, su conteo y sus reglas.

#### ✅ HECHO 2026-08-10 — falta testear
- **La unidad de trabajo es la forma.** Cada una tiene su tarjeta con su ejemplo real, su conteo,
  sus reglas y lo que producen. Se configura por separado.
- **Se fueron** el selector de alcance por fila, los botones de cambio de forma y la previa en tres
  columnas. Como estaba previsto, el rediseño **sacó** UI en vez de agregarla.
- **Toda regla nueva queda atada a su forma.** Si el banco manda una forma distinta, no se parsea
  y se ve — que es lo que pidió el usuario.
- ⚠️ **Aviso nuevo, y es el que evita una sorpresa fea**: las 91 reglas viejas no tienen forma, así
  que hoy valen para todas. Al guardar una forma **quedan atadas sólo a ésa** y las otras se quedan
  sin reglas. El modal lo avisa antes de guardar y recomienda terminar el tipo entero de una vez.

**Verificado contra el endpoint real**: `TRANSFERENCIA A TERCEROS` devuelve sus 3 formas (12/7/4)
con `cubierto: true`, y el re-parseo en seco acotado a ese tipo informa 23 movimientos sin tocar
nada. Las 91 reglas siguen en `firma_forma = null`, así que **nada cambió de comportamiento todavía**.

---

### ✅ Aviso de extractos bancarios sin cargar (2026-08-09)
Pedido del usuario. En **Principal**, arriba de todo, avisa cuando una cuenta bancaria lleva más de
**30 días** sin movimientos nuevos (rojo a los 60, o si nunca se importó).

**Sólo cuentas bancarias** — cajas de ahorro y cuentas corrientes. Las cajas de efectivo y las
tarjetas quedan afuera **a propósito**: no son extractos periódicos del banco, así que el mismo
umbral no significa lo mismo.

Mide la fecha del **último movimiento**, no la de importación: subir un extracto que termina hace
dos meses no apaga el aviso, que es lo correcto.

**Motivo**: un extracto sin cargar no produce ningún error — el Cash Flow y la conciliación siguen
andando con datos viejos. Es el mismo patrón que venimos tapando: *el silencio miente*.

Componente: `components/alerta-extractos-desactualizados.tsx`. Lee las cuentas de
`CUENTAS_BANCARIAS` filtrando por `tipo === 'banco'`, así que **una cuenta nueva queda cubierta
sola**. Si una consulta falla, esa cuenta se omite y se loguea — no se inventa un atraso.

### ✅ Importador de Caja de Ahorro: una fila cargada a mano se descartaba en silencio (2026-08-09)

**Síntoma**: al importar el extracto de `pam_galicia`, *"Control de saldos NO cuadra en 15 fila(s)"*
— **todas con el mismo valor, 3,86**. La única fila que el usuario había cargado a mano no aparecía
en la lista, así que parecía la sana.

**Eran dos bugs del mismo tipo**, y los dos sólo se disparan con una fila escrita a mano: el banco
entrega **texto**, Excel guarda lo tipeado como **número**.

| | Qué hacía | Con `3.86` / `25/03/2026` |
|---|---|---|
| `parseNumberCA` | `String(v).replace(/\./g,"")` — asume que todo punto es separador de miles | `3.86` → **386** · `214140.6` → **2.141.406** |
| `parseDateCA` | Sólo reconocía texto `DD/MM/YYYY`; el resto caía a `new Date(s)` | `46106` → `new Date("46106")` → **el año 46106** (`"+046106-01-01"`) |

**Por qué la fila desaparecía**: `"+046106-01-01" < "2026-03-20"` es **verdadero** — es comparación
de texto y `+` (código 43) ordena antes que `2` (código 50). El guarda *"descartar lo anterior a lo
ya cargado"* la tomaba por vieja y la salteaba **antes** de la validación de control. Su crédito de
3,86 nunca entraba a la cadena, el saldo anterior quedaba en 214.136,74 en vez de 214.140,60, y de
ahí el descuadre en **todas** las filas siguientes.

**Por qué se veían 15 y no 1**: la fórmula del control **arrastra** el desfase
(`control = propio + controlAnterior`) para que el saldo final cierre igual. Correcto para el saldo,
pésimo para el diagnóstico: mostraba 15 filas sanas y ninguna rota.

**Contexto que lo vuelve permanente, no un caso raro**: *"no puedo descargar data más vieja de
Galicia"* — completar un hueco a mano **es parte del uso normal**.

#### Los tres arreglos (aplican a `pam_galicia` **y** `ma_galicia`: comparten el importador)
1. **`parseNumberCA` respeta los números** que ya vienen como número.
2. **`parseDateCA` entiende fechas de Excel** (serial y objeto `Date`), y el fallback ahora **exige
   un año entre 1990 y 2100** — sin ese cerco el bug volvería por la misma puerta.
3. **Las filas descartadas se informan**, con fila, fecha, movimiento y motivo (ilegible · futura ·
   anterior a lo cargado · duplicada). Y el error de control **distingue dónde nace el descuadre**
   de dónde sólo se arrastra: *"nace en la fila 7 (2026-04-06, 3.86); el resto lo arrastra"*.
   Si ninguna fila tiene descuadre propio, lo dice: el desfase viene de antes del archivo.

**Verificado** con el archivo real del usuario (`PAM CA - Extracto_00004439022.xlsx`): 16 de 16
filas procesadas, **0 descartadas, 0 errores de control**, saldo final 11.003,99 = el del banco.

> 🔑 **El patrón, otra vez**: lo que hizo caro este bug no fue el parseo, fue que **la fila
> descartada no dijo nada**. Mismo modo de falla que el `UPDATE` que no encuentra la fila y
> devuelve OK. *El silencio miente.*

### ✅ "¿Hay filtros?" pasa a tener una fuente única (2026-08-09)

**El bug que lo destapó**, encontrado por una pregunta del usuario (*"¿qué pasa si filtro junio y
le doy conciliar?"*): **filtrar por fechas y conciliar corría sobre TODOS los pendientes de la
cuenta, sin avisar**. El filtro de fechas no estaba en la lista que decidía si acotar.

**La causa de fondo no era el olvido, era el patrón**: cada lugar que necesitaba saber *"¿hay
filtros?"* armaba **su propia lista a mano**, y las dos que existían eran **complementarias** —
ninguna estaba completa:

| | Aviso al conciliar | Cartel *"filtros aplicados"* |
|---|---|---|
| estado · búsqueda · categs · categ especial · revisado | ✅ | ❌ |
| fechas · montos · categ · detalle | ❌ | ✅ |

**Fix**: `filtrosActivos` — un `useMemo` que devuelve las **etiquetas legibles** de los filtros
activos, y del que salen las tres cosas: el rótulo del botón, el cartel y el acotamiento al
conciliar. **Agregar un filtro mañana es agregarlo ahí y nada más.**
`limiteRegistros` queda afuera a propósito (decisión del usuario: acota la vista, no el trabajo).

**El botón ahora anticipa el alcance**, en vez de que se sepa recién en el `confirm`:

| Estado | Botón |
|---|---|
| Sin filtros | **Conciliación Bancaria** — verde |
| Con filtros | **Conciliar 12 movimientos filtrados** — **ámbar**, y el tooltip lista los filtros |

Y el `confirm` pasa a decir **cuáles** son los filtros y que *"el resto de los pendientes NO se
toca"*.

> 🔑 **Confirmado de paso**: el motor **nunca reprocesa lo ya conciliado**. Por los dos caminos
> filtra a `estado = 'pendiente'` (la query es `.eq('estado','pendiente')`). Se puede correr las
> veces que haga falta.

### ✅ Campos de las reglas: elegir en vez de tipear (2026-08-09)
Antes de cargar las reglas de PAM y MA, el usuario preguntó si los campos que ya sabemos qué
valores admiten deberían ser selectores. Eran **6**, en los dos configuradores:

| Campo | Dónde | Antes | Ahora |
|---|---|---|---|
| **Responsable** (regla Tipo B) | Reglas de imputación | `<Input>` libre, placeholder *"Ej: PAM, MA, JMS"* | **Selector** de MSA/PAM/MA |
| Contable · Interno | Reglas de imputación | `<Input>` libre | Sugieren los **ya usados** (se puede escribir uno nuevo) |
| **CATEG (cuenta contable)** | Reglas de texto | `<Input>` libre, *"Ej: BANC, IMP, FCI"* | **`SelectorCuentaContable`** — jerarquía + buscador |
| Contable · Interno | Reglas de texto | `<Input>` libre | Sugieren los ya usados |

**Por qué importaba cada uno:**
- **Responsable**: el motor busca la regla con `=` **exacto** contra el `responsable` del template.
  Un typo (`pam` en minúscula, `PAM ` con espacio) la vuelve **inaplicable en silencio** — la regla
  existe, se ve en la pantalla, y nunca se aplica.
- **CATEG**: escribirla a mano permitía inventar una categ **que no está en el plan de cuentas**, y
  la regla quedaba imputando a una cuenta inexistente. Además incumplía la regla del proyecto
  (`CLAUDE.md` § Centralizar): *para asignar cuenta contable va siempre `SelectorCuentaContable`*.
- **Contable/Interno**: son texto libre por diseño (hay que poder crear códigos nuevos), pero sin
  sugerencias se generaron las variantes que ya conviven: `RET 3 PAM` / `RET PAM` / `RET 1 PAM`,
  `RET MA` / `RET 3 MA`, y `Ver` / `VER`.

#### ⚠️ Hueco que quedó a la vista al revisar esto
La regla Tipo B compara `responsable` con **igualdad exacta**, así que un template multiempresa no
matchea ninguna regla. **Postergado por el usuario para los ajustes finales** → dossier propio en
[A-BUG-13](#a-bug-13).

#### 🔴 Queda sin hacer
La **edición inline** de contable/interno en la tabla de reglas (`CeldaEditable`,
`configurador-reglas-contable.tsx` ~l.505) sigue siendo un `<input>` pelado sin sugerencias. Es el
mismo riesgo de variantes, por otra puerta.

### 📄 Los dos informes de conciliación (2026-08-08)
Se abren en el navegador y **el link es permanente** — se pueden cerrar y volver a abrir.

| Informe | Link | Para qué |
|---|---|---|
| **Cómo se decide contable e interno** | `claude.ai/code/artifact/de1f4519-cedc-40aa-a381-50b7ba54cdcd` | Las 4 capas de reglas, qué aplica a cada origen, ejemplos reales y los huecos |
| **Conciliación empresa por empresa** | `claude.ai/code/artifact/82969b74-c519-4b3d-aee8-f7af4287fc24` | El mismo terreno visto desde MSA, PAM y MA por separado: qué está cubierto y qué falta **customizar** |

> 🔑 **La reformulación del usuario, que ordena todo**: mirado por empresa, la mayoría de los
> "huecos" **no son bugs, son casillas que no existen**. `AP 3 PAM` no puede ocurrir en el extracto
> de MSA — ocurriría en el de PAM. Para **facturas de MSA el circuito está cubierto** con las 2
> reglas `RET 3 PAM` / `RET 3 MA`; lo que falta es customizar PAM y MA.

### 🚨 El volumen real a conciliar son 477, no 49 (2026-08-08)
Los 49 de bancos eran la punta. **Cajas y tarjetas suman 428 pendientes y no tienen ninguna regla**,
aunque el motor las trata igual que a un banco:

| Cuenta | Pendientes | Reglas |
|---|---:|---:|
| `msa.tarjeta_visa_business` | **296** | 0 |
| `msa.caja_sigot` | **79** | 0 |
| `pam.tarjeta_visa` | **53** | 0 |
| `msa_galicia` | 39 | 26 imput. + 40 texto |
| `pam_galicia` + `pam_galicia_cc` | 10 | 0 imput. + 34 texto (sólo en `_cc`) |
| `ma_galicia` · `ma.tarjeta_visa` · `caja_general` · `caja_ams` | 0 | 0 |

**La tarjeta de MSA sola tiene 6 veces más pendientes que el banco.** Orden sugerido: banco MSA (39,
terreno conocido) → copiar a `pam_galicia` lo que sirva de las 34 reglas de `pam_galicia_cc` →
tarjeta MSA (296) → caja Sigot y tarjeta PAM → extracto de MA cuando se importe.

### 🔍 A-BUG-09 — Auditoría de los 49 pendientes (2026-08-08)

**El hallazgo que da vuelta la premisa**: el dossier suponía movimientos *"que deberían haber
conciliado por tener el mismo monto"*. **No existen.** Cruzando los 49 pendientes contra todo lo
conciliable (FC de las 3 empresas + cuotas de template activas) aparecen sólo **4 coincidencias de
monto, y todas con 57 a 209 días de diferencia** — o sea casualidades, no matches perdidos.

El motor no está fallando por monto. Está fallando por **cuatro causas concretas**:

#### 1. Anticipo excluido del Cash Flow por su estado 🔴
`Echeq 48 Hs. Nro. 102` · 26/05/2026 · **$1.455.755,70** ↔ anticipo de **Eduardo Castillo**,
mismo importe, `fecha_cobro_echeq` 22/05 → **4 días de diferencia, tendría que haber dado
`auditar`**. No matcheó porque `mapearAnticipos` excluye `estado = 'vinculado'`, así que el
anticipo **nunca entra al Cash Flow** y el motor no puede verlo.
→ *Un anticipo vinculado a su factura sigue siendo un movimiento de banco que hay que conciliar.*

#### 2. Ventana de fecha de 5 días 🟡
`Echeq 48 Hs. Nro. 105` · 16/06/2026 · **$1.461.558,28** ↔ anticipo de **ARROYO TALA**, mismo
importe, fecha 08/06 → **8 días**. Está en el Cash Flow, pero supera la ventana y no matchea ni
como `auditar`. Con echeq la brecha entre emisión y débito es normal.
→ *Ventana más ancha para echeq, o basada en `fecha_cobro_echeq`.*

#### 3. Pagos agrupados que el motor no puede resolver por diseño 🔴
`Servicio Acreditamiento De Haberes` — **4 movimientos, $3.970.534**. **Ningún pago de sueldo
tiene ese monto**: el banco debita el **total** de la acreditación y el sistema tiene N pagos
individuales (3 a 9 cerca de cada fecha). El motor compara contra **una** fila del Cash Flow, así
que un agregado nunca va a matchear.
→ *La salida es agrupar los sueldos en un grupo de pago —el mecanismo ya existe— para que la fila
del Cash Flow traiga el total.*

#### 4. Movimientos que no son conciliables contra un comprobante 🟢
No es un bug: necesitan **regla de texto**, no match por monto.

| Descripción | Veces | Total | Qué es |
|---|---:|---:|---|
| `Trf Inmed Proveed` | 16 | $15,5 M | El grueso real: transferencias a proveedores |
| `Deb. Autom. De Serv.` | 8 | $1,28 M | Débitos automáticos |
| `Transferencias Cash Proveedores` | 5 | **$94,9 M** | **Ingresos** — no son egresos conciliables |
| `Servicio Pago A Proveedores` | 3 | $15,9 M | Ingresos |
| `Compra Debito` | 3 | $116 K | Tarjeta de débito |
| `REINTEGRO PROMOCION GALICIA` (+MODO) | 3 | $45 K | Reintegros del banco |
| `Transf. Ctas Propias` / `TRANSFERENCIA DE CUENTA PROPIA` | 2 | $300 K ×2 | **El mismo movimiento visto de los dos lados** (sale de `pam_galicia_cc`, entra en `pam_galicia`) |
| `INTERES CAPITALIZADO`, `Anulacion Debitos`, `PAGO TARJETA VISA` | 3 | $92 K | Movimientos del banco |

#### Reparto de los 49
| Cuenta | Egresos | Ingresos |
|---|---:|---:|
| `msa_galicia` | 33 · $23,8 M | 6 · **$106,7 M** |
| `pam_galicia` | 1 · $6.264 | 5 · $345.754 |
| `pam_galicia_cc` | 1 · $300.000 | 3 · $4,19 M |

**14 de los 49 son ingresos** — y hasta hoy **no recibían ninguna propuesta** al reasignar
(A-BUG-06b, ya corregido). Esa sola corrección desbloquea casi un tercio del trabajo pendiente.

#### Qué haría, en orden
1. **Incluir los anticipos `vinculado` en el Cash Flow** si su `estado_pago` no es `conciliado`. Es el caso 1 y es de una condición.
2. **Ampliar la ventana de fecha para echeq** o usar `fecha_cobro_echeq` como referencia (caso 2).
3. **Agrupar los pagos de sueldo** de cada acreditación antes de conciliar (caso 3, sin código).
4. **Reglas de texto** para `Trf Inmed Proveed`, `Deb. Autom. De Serv.` y los del banco (caso 4).
   ⚠️ `pam_galicia` **no tiene ni una** regla de texto.

### 🧪 Resultado del testeo del usuario (2026-08-08)
| # | Test | Estado |
|---|---|---|
| 1-3 | Barra de empresas, columna Empresa, defaults, tildar/destildar MA | ✅ OK |
| 4 | Pagar FC de PAM sin SICORE, y que persista | ✅ OK |
| 5 | Bloqueo de ECHEQ en PAM | ✅ OK |
| 6 | Agrupar las 2 de Allende, fecha de pago, pagar el grupo, desagrupar (las 2 vías) | ✅ OK *(destapó 3 bugs, ya corregidos)* |
| 7 | No mezclar empresas al agrupar | ✅ OK — "no me deja" |
| 8 | Que MSA no se rompió (SICORE aparece) | ✅ **SICORE apareció**; el "Cancelar" se auditó aparte, ver abajo |
| 9 | Template `MSA/PAM` con filtros | ✅ OK |
| 10 | Sueldo de Alondra con chip MA | ⏳ pendiente |
| 11 | Anticipo sin empresa | ✅ OK |
| A-TEST-24 | Ficha de proveedor — **botón Editar** | ✅ OK (era lo único nunca ejecutado) `@principal` |

### 🔍 Auditoría del "Cancelar" de SICORE (2026-08-08) — no movió nada
El usuario pasó una FC de Alcorta a *pagar*, apareció SICORE, apretó **Cancelar** y quedó la duda
de si el estado se movió igual.

**Conclusión: no se movió.** Verificado por dos vías:
1. **Por el código**: `evaluarRetencionSicoreCF` **no escribe el estado antes de abrir el modal**
   (queda pendiente en memoria). Los dos botones Cancelar (`vista-cash-flow.tsx` ~l.4371 y ~4488)
   y el cierre del diálogo (~l.4327) llaman `cancelarSicoreCF(false)`, que **restaura
   `estadoAnterior`** y limpia la cola del lote. Aborta de verdad.
2. **Por los datos**: de las Alcorta en `pendiente`, la **única** que podía llegar al modal es
   `10-6204` (neto $196.623,76 > mínimo **y** con `fecha_pago` cargada; las otras dos que superan
   el mínimo no tienen `fecha_pago`, así que el enforce las frena **antes** de SICORE).
   **`10-6204` sigue en `pendiente` con `sicore` null.** Y `msa.sicore_retenciones` no tuvo
   ningún insert en las 3 horas previas.

### ✅ A-BUG-CANCELAR-SICORE — un "Cancelar" que sí paga (RESUELTO 2026-08-08)
La intuición del usuario (*"cancelar tiene que abortar toda la operación"*) es correcta como
regla, y **hay un lugar donde no se cumple**. Cuando la factura **no llega al mínimo** aparece:

> *"No corresponde retención SICORE (menor al mínimo disponible). ¿Desea aplicar un descuento
> pronto pago?"* — **[Aceptar] [Cancelar]**

Apretar **Cancelar** ahí lleva a `cancelarSicoreCF(**true**)` (`vista-cash-flow.tsx` ~l.1678), que
**guarda el cambio a `pagar`**. El cartel no lo dice: ese "Cancelar" responde a *"¿querés
descuento?"*, no a *"¿querés pagar?"* — el mismo botón significa dos cosas según dónde estés.

**No es lo que le pasó al usuario** (su factura superaba el mínimo, así que fue por el camino que
sí aborta), pero es el mismo riesgo que detectó.

**✅ Resuelto**, en dos pasos el mismo día (el primer intento estuvo mal y lo corrigió el usuario):

**Cómo quedó**: si la factura **no llega al mínimo no se abre ninguna pantalla** — no hay decisión
de SICORE que tomar, así que pasa derecho a `pagar`. El descuento pronto pago queda como **acción
opcional del aviso** ("Aplicar descuento"), no como un cartel que hay que contestar para poder
pagar. Se usa en 14 de 383 facturas, así que no se podía simplemente sacar.

> ⚠️ **El intento fallido, anotado para no repetirlo**: al sacar el `confirm` lo reemplacé por
> *"abrir siempre el modal"*. Eso arreglaba la ambigüedad pero metía un paso extra en el caso más
> común (factura chica, sin descuento) y hacía **parecer que SICORE aplica cuando no aplica**. Lo
> detectó el usuario: *"si la FC es menor a 67.170 no debería abrir SICORE"*. Tenía razón.

Cuando **sí** corresponde retención, el modal muestra las tres salidas explícitas:

| Botón | Qué hace |
|---|---|
| ✅ **Confirmar y pasar a Pagar** | aplica el descuento cargado y pasa a pagar |
| 🟡 **Seguir sin retención** *(nuevo, sólo en este caso)* | pasa a pagar **sin** estampar quincena |
| **Cancelar** | **aborta**, la factura vuelve a su estado anterior |

⚠️ **Por qué "Seguir sin retención" y no reusar el Confirmar**: `finalizarProcesoSicoreCF` estampa
`sicore = quincena` en la factura. Con retención cero eso dejaría a la FC marcada como si se le
hubiera retenido, y `verificarRetencionPreviaFactura` (que consulta `.eq('sicore', quincena)`)
haría que **la siguiente factura de ese proveedor retuviera desde el primer peso**. El botón nuevo
usa `cancelarSicoreCF(true)`, el camino ya probado que sólo cambia el estado.

**Regla que queda**: *cancelar = abortar, siempre*. Los demás `window.confirm` del flujo de pagos
merecen el mismo repaso — **pendiente**.

### ✅ A-BUG-FECHA-MODIFICACION — la columna no se actualizaba nunca (RESUELTO 2026-08-08)
`msa.comprobantes_arca.fecha_modificacion` **es una columna muerta**: de las **383** filas,
**383** la tienen idéntica a `created_at` y **cero** figuran como modificadas. Nada la escribe (no
hay trigger ni la setea el código).

**Por qué importa**: se descubrió al querer auditar si el "Cancelar" de SICORE había movido una
factura — y **no hubo forma de saberlo por horario**. Cualquier pregunta futura del tipo *"¿esto
se tocó, y cuándo?"* hoy no tiene respuesta.

**✅ Resuelto**: trigger `BEFORE UPDATE` en las **tres** `comprobantes_arca` (migración
`trigger_fecha_modificacion_comprobantes_arca`, detalle en `RECONSTRUCCION_*`).

⚠️ **Sólo hacia adelante**: las 383 filas viejas conservan la fecha de creación. No se tocaron
retroactivamente porque no hay dato real que poner. Consecuencia práctica: **la duda del
"Cancelar" de hoy no se puede responder por horario ni ahora** — se respondió por descarte (ver
arriba). De la próxima en adelante, sí.

### 🐛 Alondra salía MSA (y algunas filas vacías) — el select no traía `empresa` (2026-08-08)
En la BD estaba bien (`Alondra Olivo → MA`), pero el Cash Flow mostraba **MSA** en sus pagos
viejos y **—** en los períodos futuros. Ninguna decía MA.

**Causa**: las dos consultas de sueldos pedían
`empleado:sueldos_empleados(id, nombre, cuit_empleado)` — **sin `empresa`**. Armé la cascada para
leer `empleado.empresa` y nunca la traje. Llegaba `undefined` y cada rama lo resolvía distinto:
`sueldos.pagos` usaba el fallback `empresasOMsa` → **inventaba MSA**; `sueldos_periodos` usaba
`parseEmpresas` → `[]` → `—`. **Las filas que mostraban `—` estaban siendo las honestas.**

**Fix**: `empresa` en los dos selects, y **fuera el fallback a MSA en sueldos**.

> 🔑 **Tercera vez que muerde el mismo patrón** (anticipos, sueldos, y el `.includes('')` del
> buscador de la ficha): **un valor plausible pero falso no se revisa nunca; un vacío sí se ve.**
> `empresasOMsa` quedó **sólo** para `ventas_unificadas`, donde MSA es el default real del módulo,
> con el comentario explicando por qué no debe usarse en otro lado.

### ✅ Los 4 bloqueantes — todos resueltos el 2026-08-08
1. **`sueldos.empleados.empresa` rechazaba `MA`.** El CHECK era `IN ('MSA','PAM','ambas')`: **el
   módulo de sueldos nunca contempló MA**. Se descubrió porque el `UPDATE` de Alondra (autorizado)
   falló con `empleados_empresa_check`. Reemplazado por el patrón multiempresa.
2. **`ambas` era ambiguo con tres empresas.** El usuario definió que AMS y JMS son de **las tres**
   → `MSA/PAM/MA`. El alias sigue soportado en `lib/empresas.ts` por si reaparece.
3. **`Duhau`** → `PAM/MA/Duhau`. Aparece al filtrar PAM o MA; `Duhau` se muestra y no filtra.
4. **Anticipos**: columna `empresa` creada. **Corregida el mismo día** — ver abajo.
   *(Nota del usuario: las irregularidades de anticipos vienen de que el módulo se desarrolló muy
   pobremente al principio — hay 2 con `estado='vinculado'` y `factura_id` nulo. **Sigue abierto**,
   es del módulo de anticipos, no de esto.)*

### 🐛 El backfill de anticipos estaba mal — corregido el 2026-08-08
El primer backfill puso **los 33 en MSA**. El usuario dudó (*"es muy posible que no fueran todos de
MSA"*) y **tenía razón**. Cruzando el CUIT de cada anticipo contra las facturas de las tres empresas:

| Anticipo | FC en MSA | FC en MA | Lectura |
|---|---:|---:|---|
| **Penino Miguel Gustavo** ($2.000.000) | 0 | **5** | casi seguro **MA** |
| **Luciano Joaquin Gimenez** ($400.000) | 0 | **1** | casi seguro **MA** |
| Municipalidad de Zarate · Leonsio · Rodolfo Quevedo · BALLESTER Paulo | 0 | 0 | **sin evidencia** |
| los otros 9 sin vincular | ≥1 | 0 | probablemente MSA |

**Decisión del usuario (variante A)**: los **no vinculados quedan en `NULL`**. `NULL` significa
**"no se sabe de qué empresa es"**, y se resuelve al vincular el anticipo con su factura. Quedó
**18 en MSA** (los vinculados, verificados: sus `factura_id` apuntan a `msa.comprobantes_arca`) y
**15 sin empresa**.

**Además, por pedido del usuario:**
- **Sin `DEFAULT`** — la empresa se elige, no se hereda en silencio.
- **Se puede dejar vacía, pero con confirmación**: el alta de anticipos avisa y pide un `confirm`
  explicando que vacío = *no se sabe*.
- **El código ya no tapa el vacío**: `mapearAnticipos` usaba un fallback a MSA; ahora devuelve
  vacío, la fila muestra `—` y **aparece con cualquier filtro** (`coincideEmpresa` no esconde lo
  que no puede clasificar). Visible y evidentemente incompleto, que es lo que se buscaba.

**Motivo de fondo, para no repetirlo**: un valor plausible pero falso **no se revisa nunca**; un
vacío sí se ve. Es la misma familia que `B-BUG-CLIENTE-NO-SE-CREA` y que el paso 0 de este dossier.

### Fuera de alcance, explícito
- **SICORE para PAM/MA: nunca.** Es regla, no configuración.
- **Desde qué cuenta se pagó**: se sigue definiendo en la conciliación, no al pagar.
- **`DIST PAM`**: `distribucion_socios` tiene `DIST MA` (`empresa_destino='MA'`) y no hay
  equivalente para PAM. Es una fila, no un mecanismo. Va con el paso 7.
- **Ventas PAM**: no existe `pam.comprobantes_venta`. Módulo pendiente de desarrollar, menos
  prioritario, pero pendiente al fin.

### Estado del paso 7 (para cuando toque)
**Para templates ya está construido y funcionando**: 21 reglas `especifica` + 2 `responsable` en
`reglas_contable_interno` escriben `interno='DIST MA'` al conciliar, y **42 movimientos de
`msa_galicia` ya salieron así**. **Para ARCA no**: el motor sólo busca códigos en las reglas de
texto y las facturas no tienen `responsable_interno`. Con `empresa` en la fila, la adjudicación
pasa a ser **derivable sola** (si el movimiento sale de una cuenta MSA y la FC es de PAM, la
conclusión es automática) en vez de requerir una regla por caso.

### 📌 Decisiones ya tomadas — no volver a discutirlas
Salieron de una ronda larga con el usuario (2026-08-07/08). Están cerradas:

| Decisión | Cómo quedó |
|---|---|
| ¿Un Cash Flow por empresa? | **No.** Uno solo, multiempresa. Ya lo era para templates |
| ¿`responsable` y `empresa` son lo mismo? | **Sí** a nivel conceptual. **Una sola columna.** Los 5 valores-persona del selector nunca se usaron. Las personas viven en `responsable_interno`, que es otro eje |
| ¿Multivalor? | **Sí.** `MSA/PAM` aparece al filtrar MSA **y** PAM; con sólo MA, no. `Duhau` se muestra, no filtra |
| ¿Un filtro o dos? | **Dos**, porque los defaults difieren: FC de MA apagadas, templates todos |
| ¿SICORE en PAM/MA? | **Nunca.** No es configuración: la condición pregunta *"¿es MSA?"*, así que cualquier empresa nueva queda afuera sola |
| ¿Registrar desde qué cuenta se pagó? | **No**, eso se define en la conciliación. Se mantiene así |
| Saldo acumulado | **Postergado**: el usuario dijo que hoy no está operativo para que sirva |
| Responsables compartidos | Se muestran tal cual. El caso ya está en los datos 3 veces (`MSA/PAM`, `ambas`, `MSA/MA/JMS`) |

---

## <a id="a-test-24"></a>A-TEST-24 — Ficha de proveedor (2026-08-07)

**Qué es.** El acceso que faltaba a `public.proveedores`: un modal de **consulta** con los datos
del maestro, sus últimas facturas, sus últimos pagos y sus anticipos. Se entra desde
**Principal → Proveedores** (buscador) o desde el ícono 🏢 de cada fila del **control de subas**
(abre directo en ese CUIT).

**Por qué modal y no solapa** (decidido con el usuario): la consulta es puntual y en medio de otra
cosa, así que tiene que devolver a donde estabas. Una solapa 13ª además rompía el `grid-cols-12`
del `TabsList`, y ningún otro maestro (cuentas contables, actividades, campos) tiene solapa propia.
Editar existe pero es la excepción → vive detrás de un botón **Editar**, se entra en lectura.

**Diseño completo del maestro** (qué guarda, quién lo escribe, quién lo lee, los 7 huecos abiertos)
→ **`MODULO_PROVEEDORES.md`**, creado 2026-08-07.

**Archivos:**
| Archivo | Qué hace |
|---|---|
| `app/api/proveedores/ficha/route.ts` | **nuevo** — GET lista / GET `?cuit=` arma la ficha |
| `components/proveedores/modal-ficha-proveedor.tsx` | **nuevo** — buscador + ficha + edición |
| `app/api/gas/config-proveedor/route.ts` | `CAMPOS_PERMITIDOS` pasa de 9 a **23** campos |
| `components/vista-principal.tsx` | botón *Proveedores* + render del modal |
| `components/panel-control-proveedores.tsx` | ícono 🏢 por fila → ficha de ese CUIT |

**Una sola vía de escritura.** La ficha **lee** por `/api/proveedores/ficha` y **escribe** por el
`PATCH` de `/api/gas/config-proveedor`, que ya era por donde escribían Config PDFs y el bucle de
Lotes Galicia. Se amplió su whitelist en vez de abrir un cuarto camino — que es exactamente el
problema que arrastra **B-FEAT-UNIFICAR-PORTAL**.

### 🔎 Hallazgo que obligó a cambiar el diseño: `fecha_pago` está casi vacía

Medido el 2026-08-07 sobre la BD viva:

| Tabla | Filas | Con `fecha_pago` |
|---|---|---|
| `msa.comprobantes_arca` | 384 | **12** |
| `cuotas_egresos_sin_factura` | 935 | **8** |

El pago real no queda en `fecha_pago`: queda cuando **se concilia el movimiento del extracto**.
En `msa_galicia` hay **469** movimientos con `template_cuota_id` y **108** con `comprobante_arca_id`.
Por eso los pagos de la ficha se leen del extracto siguiendo los tres vínculos que escribe el motor
(`comprobante_arca_id`, `template_cuota_id`, `anticipo_id`) más un repaso por `proveedor_nombre`,
y **cada pago dice por qué vínculo entró** — los que sólo coinciden por nombre se marcan como tales
en vez de presentarse como certeza. Es coherente con que la **Fase ARCA** de
[A-TEST-06](#a-test-06) (el refactor de `fecha_pago`) siga sin hacerse.

### ⚠️ Qué NO ve la ficha (dicho en pantalla, no en silencio)
- **Pagos por caja, cheque o tarjeta** — sólo se leen los 3 extractos Galicia.
- **Cobros de una venta** — el extracto no tiene columna que vincule un movimiento a
  `msa.comprobantes_venta`, así que de una venta se ve su `estado`, no su cobro. **Hueco real**,
  no un no-problema: hoy no hay forma de saber desde el sistema qué venta se cobró y cuándo.

### 🐛 Bug del buscador — detectado por el usuario y corregido (2026-08-07)
**Síntoma:** el buscador de la ficha no filtraba nada mientras se escribía.
**Causa:** el filtro probaba también por CUIT con `(p.cuit || '').includes(q.replace(/\D/g, ''))`.
Cuando lo tipeado es texto, esa expresión da `''`, y **`''` está contenido en todos los strings**
→ la condición era siempre verdadera y no se descartaba ninguna fila. **Fix:** buscar por dígitos
sólo si el usuario tipeó alguno. Verificado con las 3 filas de la BD (`fede` → 1, `337` → 2,
`30710` → 1, `zzz` → 0).
**Lección:** el `.includes('')` que siempre da `true` es un falso positivo silencioso — la pantalla
"anda", sólo que muestra todo. Buscar el mismo patrón si aparece otro filtro que no filtra.

### Estado de test
- ✅ **Lectura verificada** contra la BD (3 CUITs): SMART FARMING 8 facturas / 5 pagos por factura ·
  FEDERACIÓN PATRONAL 12 facturas / 9 pagos por template · Sanpa Semillas (cliente puro) 1 venta
  de $95,7 M. Type-check y build limpios.
- 🔴 **Guardado sin probar.** No se tocaron datos reales sin permiso. Y es lo más delicado del
  cambio: el PATCH acepta ahora 14 campos que ninguna pantalla editaba antes, entre ellos
  `razon_social` (el maestro del que salen los nombres aguas abajo) y `activo`.

---

## <a id="b-feat-presu-ingresos"></a>B-FEAT-PRESU-INGRESOS — Presupuesto de INGRESOS: arrendamientos agrícolas (2026-07-26)

**Diseño completo** (fórmulas, reglas, DDL, UI, fases) → `MODULO_PRESUPUESTO.md`
§ INGRESOS — Arrendamientos agrícolas. **Origen**: `exports_app/- Desarrollo Presuesto..xlsx`.

**Decisión arquitectural**: el presupuesto de ingresos NO se carga en Presupuesto — se carga como
**Ventas** (contrato → cuota → fijación → factura → cobro) y Presupuesto **lee**. Una sola fila que
nace presupuestada y se vuelve real, igual que las cuotas de templates. Todo en `public` (sin schema
propio); contratos con columna `empresa`.

### ✅ HECHO (2026-07-26, sin testear)
1. **BD** — 5 tablas: `tipos_cambio`, `precios_granos`, `contratos_arrendamiento`,
   `cuotas_arrendamiento`, `fijaciones_arrendamiento`. **No están en el backup** → DDL en
   `RECONSTRUCCION_SUPABASE_2026-01-07.md`.
2. **Datos MSA sembrados** — 4 contratos (Nazarenas/Rojas × campañas 26/27 y 27/28) + 14 cuotas.
   Verificado contra la planilla: tons, % y guardarraíl `Σ qq = qq_ha_total` OK en los 4.
3. **`lib/arrendamientos/calculo.ts`** — fuente única de fórmulas: tons, %, guardarraíl, resolución
   de precio con arrastre, TC (real > presupuestado > arrastre), monto de cuota, tons
   fijadas/disponibles, estado derivado, reglas de movimiento, IIBB 5%, ganancias 6%,
   pizarra +20 días.
4. **`components/configurador-precios-tc.tsx`** — ABM de las dos series macro (precio USD/ton por
   posición + TC presupuestado/real), 36 meses, edición inline es-AR, guarda al salir del campo.
   Se abre con el botón "Precios y TC" en la solapa Presupuesto.
5. **`components/tab-presupuesto.tsx`** — horizonte 13 → **24 meses**; bloque **INGRESOS** con
   **3 filas por campo** (Fijado / Presupuestado / Disponible a fijar), badge de tn sin fijar,
   marca `*` cuando el precio o el TC se arrastraron, y fila **RESULTADO** (Ingresos − Egresos).

### ✅ HECHO (2026-07-26, 2ª tanda — sin testear)
6. **Fix arrastre TC** — `resolverTC` sólo arrastraba hacia atrás mientras `resolverPrecio`
   arrastra hacia adelante: una cuota con mes de cobro previo a todo el TC cargado quedaba en
   $0 (caso Rojas jul-26). Ahora es bidireccional.
7. **Mover y valorizar desde Presupuesto** — celdas de Presupuestado/Disponible clickeables →
   modal con fecha de cobro + precio + "volver a default". Columnas `precio_usd_override` y
   `precio_pesos_override`. **El modo lo decide la fecha**: mes actual → pizarra en **pesos**
   sin TC; mes posterior → Matba en **USD** × TC. Al cambiar de unidad el campo se limpia.
8. **LA FIJACIÓN ES LA VENTA** — `fijaciones_arrendamiento` → **`ventas_arrendamiento`**.
   Precio y TC en **dos momentos** (`fecha_fijacion_precio` / `fecha_fijacion_tc`); hasta que
   estén los dos el monto en pesos es estimado. Estados: sin_precio / sin_tc / cerrada.
9. **Sub-solapa Arrendamiento en Ventas** (`components/vista-arrendamientos.tsx`, dentro de
   Ingresos): ABM de contratos, grilla de cuotas (tons/%/cobro/posición/vendido/disponible/
   estado), **Fijar** (total o parcial), **Fijar TC** sobre una venta ya hecha, guardarraíl
   visible. Fijar **parcial parte la cuota**: el saldo pasa a una cuota nueva (`cuota_padre_id`).

10. **Cash Flow ve las ventas** — vista **`public.ventas_unificadas`** (formato común de los 3
    tipos + `facturado` + `falta_tc`). Cash Flow tenía origen `VENTA` pero leía
    `msa.comprobantes_venta` (**facturas**): la venta fijada no aparecía en ningún lado.
    Ahora entra como ingreso comprometido, y si hay factura parcial sigue el **remanente**.
11. **Vinculación FC ↔ venta** — tabla **`public.ventas_facturas`** (polimórfica: no se pudo
    reusar `msa.ventas_comprobantes`, su FK apunta a `msa.ventas`). Alerta en Vista Principal
    (`components/alertas-fc-venta.tsx`): match **por CUIT** (las ventas son pocas), monto
    asignado editable con default = mín(factura, remanente). **Sí** → Cash Flow muestra sólo
    la FC · **No** → dos ingresos y la venta sigue esperando. La decisión se guarda en ambos
    casos para no repreguntar.
12. **`MANUAL-USO.md`** — sección "Arrendamientos agrícolas" con el flujo completo.

### ⏳ FALTA
- ✅ ~~Cargar los CUITs de Sanpa y Provinvest~~ — **HECHO 2026-07-28**: Rojas → `Sanpa Semillas
  SA` `30712200662` (alineado a la factura, ver B-BUG-CLIENTE-NO-SE-CREA) · Nazarenas →
  `Provinvest` `33710346939`. La vinculación FC↔venta ya puede matchear.
- **Generar el comprobante** (factura/liquidación) desde la venta → motor rama VENTA → cobro.
- **Granos y ganadería** en `ventas_unificadas` (hoy la vista sólo trae arrendamiento).
- **Volcado del IIBB al template** `IIBB Mensual MSA` (`fba5c3f9-…`), patrón SICORE: explícito,
  idempotente, con reset; traza en `detalle` para no pisar montos escritos a mano. → `lib/iibb/`.
  ⚠️ La alícuota **no puede ser una constante global**: arrendamiento 5%, ganadería 1%. Hoy
  está hardcodeada en `lib/arrendamientos/calculo.ts` (`ALICUOTA_IIBB`), igual que `EXENTO_IVA`
  (arrendamiento exento, ganadería 10,5%). Volverlas configurables **por concepto**.
- **Ganadería** — solapa nueva del Excel, ver bloque al final de este dossier.
- **Cash Flow**: ingresos fijados + edición de cuotas como interfaz sobre Ventas.
- **Replicar a PAM y MA** (incluye crear `pam.comprobantes_venta`, que no existe).
- **Cargar `indices_ipc`** (tabla vacía).

### ❓ ABIERTO — a resolver con el usuario
1. **CUITs de Sanpa y Provinvest** — no están en `public.proveedores` (el único `es_cliente` es
   AFA). Los contratos quedaron con `cliente_cuit` NULL.
2. **Rojas cuota 1 (10/07/2026) ya venció** y quedó `presupuestado`. ¿Se fijó y cobró, o pasó a
   disponible?
3. **Campaña 27/28** es réplica de 26/27 con fechas +1 año — confirmar contra los contratos reales.
4. **Precios**: hoy carga manual. Mejora futura: traer Matba/Rofex automático.
5. **Ganancias 6% ↔ `retenciones_recibidas`**: hoy sólo menor ingreso. Futuro: encadenar para
   recuperarlo contra el impuesto.

### 🐄 GANADERÍA — relevado 2026-07-26, sin implementar

Solapa nueva del Excel. Modelo: `stock vientres × % destete → terneros`, split machos/hembras,
menos reposición (% sobre vientres) = cabezas a vender × peso × precio $/kg → **IVA 10,5%** →
total cobro. Más **IIBB 1%** el mes siguiente (vs 5% del arrendamiento) y retenciones reales
de los compradores.

**Respuestas del usuario**: precio **editable desde Presupuesto** (mismo mecanismo que el
override de soja) · IIBB 1% **sobre el neto** · el IVA impacta **sólo el flujo de caja** (después
va la factura de venta) · vaca de descarte **a afinar** · siempre **MSA** · **hay plazos** entre
venta y cobro · reposición = **parámetro aproximado**.

**Hallazgo**: los parámetros ya están en `productivo.ciclos_cria` con valores reales, y difieren
de los de la planilla. Ciclo 2025 (el que se cobra en marzo 2027): **220 vientres** a servicio
(192 vaca + 28 vaquillona), no 200. Ciclo 2024 cerrado: **88,3% de destete** (189/214) vs 85%
supuesto, y split **56,6/43,4** machos/hembras vs 50/50 supuesto, `kg_promedio` real 197,34.
→ La app puede **derivar los parámetros del historial** y ofrecerlos como default con override.
*(Nota de dato: en el ciclo 2025 la Vaca tiene 192 servicio − 181 preñadas − 7 vacías = 4 cabezas
sin explicar; en Vaquillona cierra perfecto.)*

**Ya existe y sirve**: las 15 `productivo.categorias_hacienda` cubren el roll-forward
(`Vaca`, `Vaca CUT/Descarte`, `Vaquillona de Reposicion`, `Vaquillona Preñada`, `Ternero/a al Pie`,
`Ternero/a Recria`). **`productivo.stock_hacienda` existe pero está VACÍA y no tiene dimensión
temporal** — es una foto del stock de hoy, no sirve para el roll-forward año a año que el usuario
describe (marzo 28 = stock − descartes + reposición; marzo 29 = ese número − descarte + reposición).
Hay que agregarle período o hacer tabla de stock proyectado.

**Decisión heredada**: igual que el arrendamiento, **Productivo calcula el stock proyectado →
genera las ventas → Presupuesto lee**. Lo dice el propio usuario en la planilla (B20).

#### 🚧 Qué falta decidir antes de implementar ganadería
1. **Precio $/kg a futuro**: el usuario lo quiere **editable desde Presupuesto** (mismo
   mecanismo que el override de soja). Falta definir si hay algún índice de referencia
   (novillo Cañuelas, Rosgan) o es 100% carga manual. Acá **no hay Matba**.
2. **Plazos de cobro**: dijo "hay plazos" pero no cuáles. En arrendamiento esto terminó siendo
   `dias_cobro_disponible` **por contrato** — acá probablemente sea por comprador/consignatario.
3. **Vaca de descarte**: es una línea de ingreso que **no está en la grilla del Excel**. Falta
   cuántas por año, peso y precio. Ya hay un movimiento real cargado (4 Vaca CUT/Descarte,
   30/03/2026, sin peso ni precio).
4. **Roll-forward del stock**: dónde vive. `productivo.stock_hacienda` está vacía y **sin
   dimensión temporal** → hay que agregarle período o hacer tabla de stock proyectado.
5. **Parámetros**: ¿derivados del historial de `ciclos_cria` con override, o carga manual?
   (El usuario todavía no lo respondió; la recomendación es derivar + override.)

#### ✅ HECHO (2026-07-26, sin testear) — ganadería ya se muestra en Presupuesto
- **BD**: `public.precios_hacienda` (ARS/kg por categoría y mes — **separada** de
  `precios_granos`, que es USD/ton por posición) + `public.presupuesto_ganaderia`
  (vientres, %destete, %machos, %reposición, pesos, fecha de cobro, **alícuotas en la fila**).
- **`lib/ganaderia/calculo.ts`**: fórmulas de la planilla + `resolverPrecioHacienda` (con
  arrastre) + `referenciaHistorica()` que saca vientres/%destete/%machos/kg del último ciclo
  cerrado de `productivo.ciclos_cria`. Verificado contra el Excel: $190.667.750 exacto.
- **`components/vista-ganaderia.tsx`** en **Ingresos → Ganadería**: ABM de proyecciones +
  grilla igual a la del Excel (cantidad/reposición/venta/peso/kg/precio/neto/IVA/total) + línea
  de IIBB con su mes. Muestra la **referencia histórica real** al lado de cada campo, sin pisar.
- **Precios y TC**: 3 columnas nuevas de hacienda (`Ternero`, `Ternera`, `Vaca CUT/Descarte`).
- **Presupuesto**: fila 🐄 por proyección en INGRESOS (total cobrado = neto + IVA) + fila
  **IIBB ganadería** en EGRESOS el mes siguiente al cobro.

#### ⚠️ Deuda técnica que ganadería DESTAPÓ — PARCIALMENTE resuelta
- ✅ Ganadería lleva **`alicuota_iva` y `alicuota_iibb` en la fila**, no en el código.
- ✅ Las constantes de arrendamiento se renombraron para que no se generalicen por accidente:
  `ALICUOTA_IIBB_ARRENDAMIENTO`, `ALICUOTA_GANANCIAS_ARRENDAMIENTO`, `ARRENDAMIENTO_EXENTO_IVA`.
- ⏳ **Falta**: cuando se haga el volcado del IIBB al template, tiene que tomar la alícuota
  **del concepto** (5% arrendamiento / 1% ganadería), no una constante.

#### 🔄 CICLO GANADERO — modelo de evolución del stock (solapa "ciclo ganadero" del Excel, 2026-07-29)

El usuario agregó una solapa con el **modelo del ciclo**. Es la base que faltaba: en vez de
tipear el stock campaña por campaña, **el rodeo rueda solo año a año** y de ahí salen las ventas.

**Foto de stock (hoy)** — es el arranque, se carga una vez:
```
Vacas 177 + Vaquillonas Preñadas 27 = 204   ← rodeo de cría (de acá sale el % de preñez)
Vacas Descarte 8                             → a vender
Ternero Recría 97                            → a vender
Ternera Recría 81 − Reserva Reposición 60 = 21 → a vender
Reserva Reposición 60                        → entra al rodeo
```
> ⚠️ El **204** es esto (177 + 27). **No** confundir con el **214** que sugería la app, que salía
> de `ciclos_cria` del último ciclo cerrado (2024: 160 + 54). La referencia estaba mal elegida:
> mira el pasado cuando lo que hace falta es la foto de hoy.

**📅 LA CAMPAÑA ES LA COMERCIAL JULIO–JUNIO**, igual que en el resto de la app. Con ese
calendario cada campaña contiene **exactamente un servicio y un destete**:
```
campaña 25/26 (jul-25 → jun-26):  servicio 10/2025 (220 cab)  ·  destete 3/2026 (189)
campaña 26/27 (jul-26 → jun-27):  servicio 10/2026 (264 cab)  ·  destete 3/2027
```
`campaniaDeServicio(Y) = Y/(Y+1)` — octubre de Y cae en jul-Y/jun-(Y+1).

> Estuvo mal mapeado una campaña de más (el servicio de oct-2025 iba a la 26/27). Síntoma:
> el chequeo de reposición mostraba "marcadas 45" en **dos** campañas a la vez, porque las
> dos caían dentro de los ±90 días de la misma pesada.

**⚠️ EL PERÍODO VA DE SERVICIO A SERVICIO** (definición final, 2026-07-30). Un servicio y su
propio destete abarcan 17 meses y se superponen con el ciclo siguiente; en cambio de servicio a
servicio son 12 meses limpios, y ahí **el cierre de un período ES la apertura del siguiente**:
```
rodeo(N+1) = rodeo(N) − refugo(N) + retenidas(N)
vacas(N+1) = vacas(N) + vaquillonas(N) − refugo(N)   ← las vaquillonas paren y pasan a vaca
```
Verificado con datos reales:
```
1/10/24:  214 (160+54) − 22 refugo + 28 vaquillonas = 220  ✓
1/10/25:  220 (192+28) − 16 refugo + 60 vaquillonas = 264  ✓ (= los 204 + 60 del usuario)
```

**El único corrimiento está en el DESTETE, no en el stock**: los terneros que se destetan
durante el período N son el producto del servicio del período **N−1** (16 meses antes). Por eso
el `%destete` y las falladas se miden contra `rodeo(N−1)`, mientras que el refugo se descuenta
del rodeo **vigente** — son las mismas vacas un año después.

Consecuencia en `proponerDesdeCiclosCria`: **cada registro de `ciclos_cria` se reparte entre DOS
períodos** (el servicio abre uno, su destete ocurre en el siguiente). Meter las dos cosas en la
misma fila era lo que rompía el encadenamiento.

> **Historial del error (3 intentos)**: (1) se encadenó todo a N+1 → las vaquillonas entraban a
> un servicio anterior a su destete; (2) se corrigió todo a N+2 → se rompió que el cierre fuera
> la apertura del siguiente; (3) definitivo: el stock encadena a N+1 sin lag y sólo el destete
> mira a N−1. El error de fondo fue definir el período como "un servicio y su destete" en vez de
> "de servicio a servicio".

**Motor del ciclo (anual: servicio octubre → tacto → destete marzo):**
```
Rodeo      = Vacas + Vaquillonas de reposición
Destete    = Rodeo × %destete          → mitad ternera, mitad ternero
Falladas   = Rodeo × (1 − %destete)    ← la merma entre vaca entorada y vaca destetada
Descarte   = Falladas × %descarte      → VENTA (default 50%)
───────── cierre del período ─────────
Vacas(t+1)       = Vacas(t) − Descarte
Vaquillonas(t+1) = Ternera(t) × %reposición
```

**Respuestas del usuario (2026-07-29)** a las dudas del modelo:
1. **El descarte sale de AMBAS** (vaca y vaquillona), no sólo de vaca. Default: la mitad de las
   fallas se le imputa a la vaca → se descarta. **Editable.**
2. El descarte 0 en octubre era **un error de la fórmula del Excel** (`F28` vacía). **Todos los
   años es igual.**
3. Split ternera/ternero: **50/50 por defecto** (editable; el real histórico es 56,6/43,4).
4. **El 20% de reposición es para MANTENER el rodeo.** Hoy están **incrementando**, así que este
   año guardan más. → el % **no puede ser constante: es por período**, es una decisión de
   estrategia.
5. **La recría de 2026 se iba a vender en marzo (destete) y se decidió retenerla.** Falta definir
   cuándo se vende, y puede ser **venta parcial o todo junto**.

**Fechas del ciclo — DERIVADAS, no se piden** (decisión del usuario 2026-07-29): la campaña
siempre tiene **un servicio, una parición y un destete**, así que el nombre de la campaña ya los
determina. Pedirlos como input era ruido y encima invitaba a que el dato tipeado se contradijera
con la campaña.
```
campaña 27/28  →  servicio  oct-2026   ← ojo: cae en la campaña ANTERIOR
                  parición  jul-2027
                  destete   mar-2028
```
Constantes `MES_SERVICIO=10 · MES_PARICION=7 · MES_DESTETE=3` en `lib/ganaderia/ciclo.ts`
(`fechasCampania()`). Las columnas `fecha_servicio`/`fecha_destete` de la BD quedan **sólo para
las fechas REALES** cuando ocurren; `fechaDestete()` devuelve la real si existe y si no la
derivada. Las reales ya viven en `ciclos_cria` → **pendiente**: traerlas de ahí en vez de
retipearlas.

**Lo que pidió** (validado, a implementar): un lugar donde ver la **evolución del stock
proyectado como línea de tiempo**, que arranque del stock actual, proponga los pasos futuros por
defecto, y sea un **espacio de trabajo interactivo** donde editar a medida que las cosas se hacen
reales. **De ahí salen las ventas proyectadas.**

Es el mismo patrón que arrendamiento (contrato → cuotas → fijar): acá es
**stock → períodos → lotes vendibles → venta (parcial o total)**.

#### 🐛 `terneros.es_torito` está SOBRECARGADO — y se usa distinto en dos lugares

El flag marca dos cosas según el sexo: en **machos** = torito · en **hembras** = retenida para
reposición. La convención la fija `tab-terneros.tsx` (modo reposición) y ahí está bien aplicada:
```ts
toritos     = es_torito && sexo === 'Macho'     // tab-terneros.tsx:626,731
ternerasRep = es_torito && sexo === 'Hembra'    // tab-terneros.tsx:627,732
```
**Pero `vista-sector-productivo.tsx` NO distingue el sexo**, y ahí es un bug:
```ts
categoriaPropuesta()  // :4131 — if (es_torito) → 'Torito', sin mirar el sexo
const toritos = asignaciones.filter(t => t.es_torito)   // :4051 — incluye hembras marcadas
```
→ En el flujo de **cambio de categoría**, una ternera marcada para reposición se proponía como
**"Torito"**, y encima caía en DOS grupos a la vez (`hembras` y `toritos`) porque `toritos` no
filtraba por sexo: doble conteo.

✅ **CORREGIDO 2026-07-29**: `categoriaPropuesta()` lee el flag junto con el sexo
(macho+marcado → Torito · hembra+marcada → Vaquillona de Reposicion), los 4 grupos pasaron a ser
**excluyentes**, y se agregó el grupo **"Terneras reposición"** que faltaba.

Aparte del bug: el nombre engaña. Convendría partirlo en dos flags (`es_torito` /
`es_reposicion`) o renombrarlo a algo neutro tipo `marcado_retencion`.

#### ✅ ESTADO VERIFICADO — 4 campañas cargadas (2026-07-30)
```
                24/25    25/26    26/27    27/28
RODEO             214      220      260      300
Destetados          0      189      187      221
Refugo+mort        22       20       27       32
Retenidas          28       60       67       32
TOTAL A SERVICIO  220      260      300      300
```
**La cadena cierra**: cierre(N) = apertura(N+1) en los tres saltos. ✓

⚠️ **Dos cosas a mirar** en los datos cargados:
- El **25/26 cierra en 260**, no en los **264** reales. Falta cargarle `real_descarte = 16`
  (hoy calcula 20 con el 80%). El refugo realizado fue 64% de las falladas, no 80% → **G-2**.
- El **24/25 quedó con `pct_descarte_falladas = 0`**: al escribir 22 cabezas, la sincronización
  calculó `22 / falladas` y las falladas eran 0. No molesta porque `real_descarte = 22` manda,
  pero si algún día se limpia el override el refugo se va a cero en silencio. → ver G-6.

**G-6 · La sincronización %↔cabezas divide por cero** 🟡 *(nuevo)*
En el refugo, `pct = cabezas / falladas`. Si `falladas = 0` el % queda en 0 y se guarda así.
Debería no tocar el % cuando la base es 0, o avisar.

#### 🔍 REVISIÓN DEL MODELO — 5 puntos abiertos (2026-07-30)

Salieron de analizar la primera carga real. **No son del arranque**: salvo el 1, todos vuelven
cada año. Verificados contra la línea de tiempo generada con datos reales (24/25 y 25/26).

**G-1 · El guardarraíl de retención ANULA el dato cargado** 🔴 *(bloqueante — se arregla ya)*
`retenidas = min(retenidasTeorica, terneras)`. Si el período no tiene destete cargado,
`terneras = 0` y **cualquier número que el usuario cargue se topea a cero**. Caso real: cargó
`real_retenidas = 28` en la 24/25, se guardó bien en la BD, y la app mostraba 0.
El tope sólo debe aplicar cuando el destete **se conoce**; si no hay dato, `terneras` es
desconocido, no cero. Ídem la advertencia ⚠, que hoy es un falso positivo permanente en el
primer período.

**G-2 · El % de refugo no se calibra con la realidad** 🟡
El default es 80% de las falladas; el realizado del 25/26 dio **64%** (16 sobre 25). Un dato no
hace tendencia, pero la app debería **mostrar el ratio realizado** cuando es derivable, para
ajustar el supuesto con evidencia. Hoy no lo calcula ni lo muestra.

**G-3 · Falta un período para presupuestar el último destete** 🔴 *(afecta el resultado)*
El destete de un período viene del servicio del **anterior**, así que **el servicio del último
período nunca desteta**:
```
26/27  servicio oct-2026 (rodeo 244)  →  desteta marzo 2028 = período 27/28
```
Si la línea llega hasta 26/27, **esas ventas no existen en el presupuesto**.
**Regla: para N campañas de ventas hacen falta N+1 períodos de stock.** El usuario quiere 2
campañas presentes → 3 o 4 períodos cargados. Convendría que la app lo avise.

**G-4 · Los toritos no existen en el modelo del ciclo** 🟡
`terneros_venta = terneros`: manda todos los machos a venta. Pero se retienen 9 toritos, así que
el número del ciclo está inflado respecto de lo que realmente se vende. Es el espejo de lo que
sí se contempló con las terneras de reposición. Hoy se corrige en el panel de lotes.

**G-5 · Un solo peso al destete para ambos sexos** 🟡
`peso_destete_kg` = 197,34 es el promedio de la tropa; el real es **198,17 machos / 169,30
hembras** (29 kg de diferencia). Los lotes lo resuelven bien porque se traen separados de la
pesada, pero el número del ciclo induce a error si se usa para estimar.

**G-7 · El lote duplica la cantidad en vez de derivarla** 🟡 *(idea de simplificación, 2026-07-30)*
Hoy `stock_lotes.cantidad` **copia** el número del ciclo, y protegemos las ediciones manuales con
`cantidad_calculada` + la marca ✎. Funciona, pero deja **dos lugares que pueden decir cosas
distintas** sobre cuántas cabezas hay.

Alternativa más limpia: que **la línea de tiempo sea la única dueña del "cuánto"** y el lote sólo
dueño del "cuándo, a cuánto y en cuántas veces".
- El lote **deriva** la cantidad del ciclo en vez de copiarla.
- La **mortandad se descuenta en el ciclo**, no en el lote — que es donde conceptualmente
  pertenece, porque la fila ya se llama *"refugo + mortandad"*.
- Desaparecen `cantidad_calculada`, la marca ✎ y el aviso de desactualizado: no puede haber
  desfasaje si hay una sola fuente.

Costo: hay que separar en el ciclo lo que se vende de lo que se muere, hoy juntos en una fila.
No urge, pero cada vez que aparezca un bug de sincronización entre ciclo y lote, la causa va a
ser esta.

##### Lo que sí es sólo del arranque
- El refugo y la reposición del **24/25** (22 y 28) faltan porque su destete viene de un ciclo
  anterior al más viejo de `ciclos_cria`. El primer período siempre va a estar cojo; una vez
  cargado no vuelve a pasar.

##### Automatizaciones posibles (hoy se hacen a mano)
- **Refugo por diferencia**: `refugo(N) = rodeo(N) + retenidas(N) − rodeo(N+1)`, cuando se conoce
  el rodeo real del período siguiente. Cada octubre queda derivable.
- **Reposición desde las marcadas**: el chequeo ya compara contra las hembras marcadas en la
  pesada; falta el botón que la traiga en vez de sólo avisar.

#### 🗺️ PLAN DE ACCIÓN — de las cabezas al presupuesto (acordado 2026-07-30)

**Principio** (mismo que arrendamiento): *Productivo dice qué hay · Ventas decide vender ·
Presupuesto lee.*
```
ciclo  →  lote (cabezas disponibles)  →  venta  →  factura  →  cobro  →  Presupuesto
```
**Tres capas en el presupuesto**, igual que en arrendamiento (Fijado/Presupuestado/Disponible):

| Capa | Qué es | Precio |
|---|---|---|
| **Vendido** | fecha y precio decididos | congelado |
| **Presupuestado** | venta planificada (lote con fecha) | de tabla, se recalcula |
| **Disponible** | existe, sin fecha de venta | de tabla, informativo |

##### FASE A — Proyecciones de venta → Presupuesto ← **HECHA (sin testear)**
1. **Categorías completas.** Hoy faltan `Ternero al Pie`, `Ternera al Pie` y `Toro`. La
   categoría depende de **cuándo se vende**: el destete de 3/27 se vende *al pie*, la recría
   actual se vende como *recría*. Y hay **toros de refugo**, que no salen del ciclo (los toros
   no están modelados en el rodeo) → lote manual.
2. **Arreglar la generación** — G-4 (los toritos no deben ir a venta) y G-5 (peso por sexo, no
   el promedio de la tropa).
3. **Precios por categoría** en Precios y TC. Son ~9 categorías: no entran como columnas, va
   con selector de categoría.
4. **Proyección en el lote**: `fecha_venta_estimada` + precio (de tabla u override) + plazo de
   cobro → mes de cobro.
5. **Presupuesto lee**: fila 🐄 *Venta de hacienda* con el monto en el mes de cobro, y una
   fila por categoría con lo **disponible sin fecha** en **cabezas y kg** (no en plata) —
   igual que las toneladas de soja disponibles a fijar.
   ✅ Incluye la **cadena completa de la venta**, con los mismos criterios del análisis de
   engorde (que ya modelaba desbaste 5% y CZ 4%):
```
kg brutos = cabezas × peso a la fecha de venta
− desbaste %                → merma de kg
= kg NETOS                  ← el precio SIEMPRE va por el neto de desbaste
× precio $/kg  = VENTA NETA ← el neto gravado, lo que se factura
+ IVA 10,5%    = total factura
− CZ % (comercialización)   → comisión del consignatario
= INGRESA AL BANCO          ← lo que ve el presupuesto
IIBB 1% sobre la venta neta → egreso el mes SIGUIENTE
```
   Los cuatro porcentajes van **en el lote**, no como constantes.
   ⏳ **Pendiente menor**: la comisión de CZ probablemente lleve su propio IVA (21%); hoy se
   descuenta sin IVA. A confirmar con el usuario.

**G-8 · Los kg por vender salen del CICLO, no del lote** ✅ **HECHO 2026-07-30**
Antes la fila *"Disponible sin fecha"* del presupuesto necesitaba que el **lote existiera**. El
usuario lo señaló: el paralelo real con la soja es que **las toneladas disponibles se ven sin que
exista ninguna venta** — salen del contrato. Acá tienen que salir del **ciclo**.

> *"como sabemos por las campañas los kg producidos y a partir de qué fecha, que el presupuesto
> lo muestre como en soja, sin necesidad de crear la venta. Más como un control para que no se
> olvide que hay stock sin vender."*

Y como control es más útil así: si hace falta generar el lote para que te avise que hay stock sin
vender, el aviso llega tarde.

**Resuelto en `lib/ganaderia/disponibilidad.ts`.** El presupuesto ya no le pregunta al lote
cuántas cabezas hay: se lo pregunta a la **fuente** y resta.

    disponible = existencia − lo comprometido en un lote CON fecha de venta

- **Existencia del stock de hoy** → `existenciasDePesada()`, última pesada de cada animal
  (excluye toritos y terneras de reposición, que no se venden).
- **Existencia de los destetes futuros** → `existenciasDeCiclos()`, sobre `calcularLineaTiempo`.
  Sólo los destetes **posteriores** al mes actual: los pasados ya están en la pesada y contarlos
  otra vez duplicaría el stock.
- Un lote **sin** fecha de venta **no** se resta: no hay venta presupuestada, así que sigue siendo
  disponible (y no se duplica, porque salió de la misma existencia).

**El doble conteo se resuelve por CLAVE DE TROPA, no por nombre de categoría.** Es la parte no
obvia: el mismo animal se llama *"al Pie"* si se vende en el destete y *"Recría"* si se vende
después. Cruzar por el nombre hacía que el lote del destete no neteara contra su propia
existencia y el disponible saliera duplicado. La clave es `pesada|macho` o `ciclo:<uuid>|hembra`,
derivada de `stock_lotes.ciclo_id` (que está poblado en los lotes de destete y `null` en los de
stock inicial). Ver `claveDeLote()`.

**El promedio del saldo baja, como tiene que bajar.** Se restan también los KILOS, al peso
promedio de lo comprometido — si se venden los más pesados, los que quedan pesan menos:

    98 cab · 245,5 kg prom = 24.063 kg
    − 55 cab · 275,2 kg    = −15.137 kg
    ─────────────────────────────────────
      43 cab ·  8.926 kg  → 207,6 kg prom     ← NO 245,5

Los dos lados tienen que estar medidos a la **misma fecha** o se mezclan kilos de momentos
distintos: por eso se usa `peso_base_kg` (peso a `fecha_peso`, la pesada) y **no** el peso
proyectado a la venta, que ya incluye la ganancia diaria.

Verificado contra los datos reales con `scripts/verificar-disponibilidad-hacienda.ts`
(`npx tsx scripts/verificar-disponibilidad-hacienda.ts`) — 9 checks, incluido que el lote de un
ciclo NO netee contra el stock de hoy. ⏳ **Falta test del usuario en pantalla.**

**G-9 · Venta de hacienda desglosada por categoría** ✅ **HECHO 2026-07-30**
`🐄 Venta de hacienda` pasó de ser **una fila sumada** a **una fila por categoría**, con el total
arriba. Cada fila lleva las dos capas en la misma línea:
- meses con venta presupuestada → **plata**;
- el mes en que se disponibilizan → **cabezas + peso promedio** (ámbar), si quedó saldo sin vender.

Se listan sólo las categorías que tienen algo. Una categoría sin ninguna venta (el caso del
usuario: machos livianos y terneras de recría) igual aparece, marcada *"sin venta presupuestada"*,
mostrando sólo el disponible. El tooltip de la celda explica la resta: *"98 cab. existentes −
55 con venta presupuestada · stock de hoy"*.

⏳ **Falta test del usuario.**

##### FASE B — Acople con Ventas *(después)*
6. **Decidir dónde vive la venta.** `productivo.stock_ventas` existe pero por coherencia con
   arrendamiento la venta debería registrarse del lado comercial (Ventas → Ganadería). Mueve
   una tabla de schema: requiere acuerdo.
7. **Pantalla de venta**: cantidad parcial, fecha, peso (calculado con ganancia diaria,
   editable), precio, plazo de cobro. **Congela peso y precio.**
8. **`ventas_unificadas`** incorpora ganadería → Cash Flow la ve.
9. **Deprecar `presupuesto_ganaderia`** y borrar la fila que quedó corrupta del bug de %.

---

---

---

---

---

---

---

---

---

---

---


---

---

#### 🔑 C-24 · PLAN DE CUENTAS: DEL TEXTO AL NÚMERO *(análisis completo 2026-07-31 — 0 código)*

Análisis a fondo de cómo se clasifica un egreso, disparado por una observación del usuario:
*"el nombre de la cuenta contable de los templates son prácticamente el nombre de los
templates… creo que hubiera sido más fácil usar la columna template en vez de crear una nueva
para ponerle el mismo nombre"*. Tenía razón, y tirando de ese hilo salió todo lo demás.

##### 1 · La redundancia es real y está medida
Dentro de **`cuentas_contables`**, las columnas `categ` y `cuenta_contable` son **idénticas en
135 de 143 filas**. Las 8 que difieren son abreviaturas o nombres formales:

| `categ` | `cuenta_contable` | qué agrega |
|---|---|---|
| `FCI` | Fondos Comunes de Inversión | sigla → nombre |
| `CRED P` / `CRED T` | Créditos Pagados / Tomados | código interno → nombre |
| `Com. Uso Atm` | Comisión Uso ATM | abreviatura y tildes |
| `Debitos / Creditos` | Débitos / Créditos **Ley 25413** | referencia legal |
| `CAJA` | Movimientos a/desde Caja | precisa que es el movimiento, no el saldo |
| `Tarjetas MSA` | Pago Tarjeta MSA | ídem |

**Por qué existen las dos**: cada consumidor apunta a una distinta. Las **facturas** referencian
`cuenta_contable` (`msa.comprobantes_arca`, 42 cuentas distintas); los **templates** referencian
`categ`. Se duplicó el nombre para que cada lado tuviera "su" columna. Es historia, no diseño.

##### 2 · Por qué `categ` no puede SER la cuenta (pero sí es el puntero)
Granularidad: **45 categorías** contra **17 agrupadoras** y 143 cuentas. Como *nivel* es el
correcto — la propuesta usa esa misma granularidad. Como *identidad* no sirve:

1. **Las facturas no tienen `categ`.** Si los templates la usaran como cuenta, habría **dos
   planes paralelos** y no se podrían sumar templates + facturas en el mismo reporte.
2. **Es texto libre y editable** desde la grilla (está en `camposEditables`).
3. **Es plana**: sin padre no hay totalizadora ni reporte por rama.
4. **No dice la naturaleza** (gasto / ingreso / financiero). Eso es `tipo`.

Y el dato que lo cierra: **`Impuesto inmobiliario` y `Impuesto Red Vial` cuelgan de DOS
agrupadoras cada una** (Rurales y Urbanos). Si `categ` fuera la cuenta y la agrupadora su padre,
esa cuenta tendría dos padres — imposible en un plan de cuentas. Lo rural/urbano es operativo,
no contable.

*(Esto obliga a corregir la propuesta: `424101 IMPUESTO INMOBILIARIO` no puede colgar de
"IMPUESTOS Y TASAS **RURALES**", porque uno de sus 42 templates es urbano. El padre debe
llamarse **IMPUESTOS INMOBILIARIOS Y TASAS**.)*

##### 3 · ¿La agrupadora como cuenta? No — es la totalizadora
17 agrupadoras para 173 templates: demasiado gruesa (*Impuestos Rurales* mezcla inmobiliario con
red vial). Y es una taxonomía **operativa** que legítimamente difiere de la contable —
*Seguros* → *ADMINISTRACION Y ESTRUCTURA*. Su lugar es **totalizadora**: coincide con ella en 28
de 41 casos.

##### 4 · 🔄 CORRECCIÓN — el extracto SÍ linkea por ID
Primero se dijo que renombrar categorías rompería 776 filas. **Es falso.** De las 661 del
extracto MSA, **612 (93 %) tienen un ID**:

| | filas |
|---|---:|
| `template_cuota_id` + `template_id` | **469** |
| `comprobante_arca_id` | 108 |
| `sueldo_pago_id` | 36 |
| `anticipo_id` | 7 |

El `categ` del extracto es una **copia denormalizada** para mostrar sin joins. El vínculo real
es el UUID.

**Pero ojo con la conclusión inversa**: lo que tiene ID es el **template**, no la categ. Las
únicas FK del sistema son `cuotas → egresos_sin_factura.id`, `egresos_sin_factura.template_origen_id`
y `presupuesto_template_config.template_id`. **Nadie referencia `cuentas_contables.id`.** La
clasificación contable sigue siendo texto:

```
extracto  → template          UUID ✓
template  → cuenta contable   TEXTO (categ ↔ categ)
extracto  → cuenta contable   TEXTO, o nro_cuenta en sólo 106 de 661
```

##### 5 · Dónde el texto SÍ es identidad: las 77 reglas
`reglas_conciliacion` identifica el destino **sólo por `categ`** (22 categorías distintas).
Se revisó `llena_template` esperando un puntero y es un **booleano** ("esta regla llena un
template"), no dice cuál.

Es el único lugar que importa de verdad, porque **clasifica hacia adelante**: si una regla
escribe un nombre que ya no existe, cada movimiento nuevo nace huérfano y no se nota.

Y ahí hay una oportunidad: **`reglas_conciliacion.codigo_contable` existe y está vacía en las
77**. Es exactamente donde va el número.

##### 6 · 🔄 CORRECCIÓN — `codigo_contable` NO está muerta
Se la había llamado columna muerta. **Falso**: el motor de conciliación
(`hooks/useMotorConciliacion.ts`) la lee de las reglas y la estampa en el movimiento. Y
**`"No lleva"` es un valor con significado**, no basura — hay una función
`esValorContableValido()` que detecta esa cadena para saber que ese movimiento no lleva código.

La única realmente sin uso es **`cuentas_contables.grupo_cuenta`**: NULL en las 143 filas, no
aparece en ningún `.ts`/`.tsx`, vino de la columna homónima del CSV de importación. Ya estaba
anotada en `RECONSTRUCCION_SUPABASE`. **No se borra**: una columna NULL no molesta.

##### 7 · 🔄 CORRECCIÓN — "que no se abrevie" era mala idea
Se había sugerido que el nombre de la cuenta fuera igual a la categoría, expandiendo las
abreviaturas. **Eso es justamente lo que rompe**: `FCI` está grabado **51 veces** en el extracto.
`categ` ya no es un nombre, es **un dato en producción** — las abreviaturas no son un descuido,
son la etiqueta corta con la que se viene operando.

La división que ya existe de hecho está bien: `categ` = **etiqueta operativa** (corta, la que se
tipea y se graba), `cuenta_contable` = **nombre de presentación** (el de los reportes).

##### 8 · Las 49 filas del extracto sin ningún ID
| | filas | qué son |
|---|---:|---|
| `pendiente` · `INVALIDA:` | **39** | **sin conciliar**, $23,8 M. `"INVALIDA:"` lo escribe el motor cuando no encuentra regla. Trabajo pendiente, no falla |
| `conciliado` · ANTICIPO COBRO | 5 | cobros, $0 de débito |
| `conciliado` · ANTICIPO | **4** | **$2,79 M conciliados sin `anticipo_id`** |
| `conciliado` · Sueldos | **1** | conciliado sin `sueldo_pago_id` |

Los **5 conciliados sin ID** son un hueco de trazabilidad: dados por conciliados pero sin apuntar
a nada. → **C-25**.

##### 9 · PASO A PASO
**El orden importa: hacer el paso 8 antes del 5-7 es exactamente lo que rompe.**

**Fase 0 — desbloquea el presupuesto, sin riesgo** — ✅ **HECHA 2026-07-31, por otro camino**
1. ~~Completar la columna TIPO de las 23 categorías~~ → se resolvió **en el template**, no en el
   plan. Ver § **C-27** acá abajo. El resultado es el mismo (los montos ya dan bien) y además
   no depende de que la categoría exista en el plan.
   *Sigue conviniendo completar el plan (Fase 1), pero ya no bloquea nada.*

**Fase 1 — ordenar el plan de cuentas**
2. Dar de alta las cuentas propuestas con su `nro_cuenta`.
3. Completar `nro_cuenta` y `cta_totalizadora` en las 22 que no lo tienen.
4. Unificar las 2 totalizadoras duplicadas por mayúsculas (29 filas).

**Fase 2 — pasar del texto al número** ← *acá se corta la fragilidad*
5. Guardar el `nro_cuenta` en el template.
6. Guardar el `nro_cuenta` en las 77 reglas (la columna ya existe, vacía).
7. Que el motor y el presupuesto crucen por número.

**Fase 2b — cerrar la puerta (C-26)**
7b. Que el wizard y las otras dos puertas de alta lean las categorías **del plan de cuentas** y
    no de los templates. Si no, el problema se reproduce solo: hoy el wizard ofrece las 23
    huérfanas como opción válida.

**Fase 3 — recién ahora, lo cosmético**
8. Renombrar categorías. Sin riesgo, porque ya nada cruza por texto. Hasta entonces, cualquier
   renombre es un **UPDATE coordinado de 4 lugares**: `cuentas_contables`,
   `egresos_sin_factura`, `reglas_conciliacion` y las copias del extracto.

**Fase 4 — el presupuesto**
9. Reordenar la grilla por `tipo` → totalizadora (C-22). **`tipo` ya está hecho** (secciones
   EGRESOS / DISTRIBUCIONES con subtotal, patrón del dashboard); falta la totalizadora, que sí
   depende de la Fase 1.


##### 🔁 C-26 · El wizard perpetúa el problema — lo hallado al preguntar por él

> *"¿anotaste como pendiente que debemos actualizar el wizard para que las futuras creaciones de
> templates se creen con su estructura completa?"*

**No estaba anotado.** Y revisándolo, el wizard no sólo no valida: **es la causa de que el
problema se reproduzca solo.**

`components/wizard-templates-egresos.tsx` (l. 116-124) carga el desplegable de categorías
**desde `egresos_sin_factura`**, o sea desde los templates que ya existen:

```ts
const { data } = await supabase
  .from('egresos_sin_factura')       // ← los templates, NO el plan de cuentas
  .select('categ, cuenta_agrupadora')
const categsUnicas = [...new Set(data.map(d => d.categ)...)]
```

Consecuencia: **las 23 categorías huérfanas se siguen ofreciendo como opción válida**. Cada
template nuevo que elija "Impuesto inmobiliario" nace sin `tipo` y sin totalizadora, y refuerza
la categoría en la lista para el siguiente. Es un lazo cerrado: el wizard lee de los templates
y escribe en los templates; el plan de cuentas nunca participa.

Por eso hay 23 categorías fuera del plan y no dos o tres. **No se van a terminar solas.**

##### Qué habría que cambiar
1. **Cargar las categorías desde `cuentas_contables`**, no desde los templates. Mostrando al
   lado el `tipo` (`egreso` · `financiero` · `distribucion`), que es lo que decide si se
   presupuesta — así se elige viendo la consecuencia.
2. **Marcar las que no están en el plan.** Si se elige una huérfana (para no romper lo que hay),
   avisar que el template va a quedar sin clasificar.
3. **Permitir crear la cuenta desde ahí**: si de verdad hace falta una categoría nueva, que el
   wizard ofrezca darla de alta en el plan con su `tipo` y su totalizadora, en vez de dejar el
   hueco. Es el momento exacto en que el usuario sabe qué es lo que está creando.
4. **Cuando esté la Fase 2 de C-24**, guardar el `nro_cuenta` y dejar de guardar sólo el texto.

##### Ojo: hay más de una puerta de entrada
`egresos_sin_factura` se escribe desde **ocho** componentes:
`wizard-templates-egresos` · `modal-crear-template-faltante` · `generador-renovacion-campana` ·
`vista-templates-egresos` · `vista-templates-agrupada` · `vista-cash-flow` ·
`vista-extracto-bancario` · `configurador-reglas` / `configurador-reglas-contable`.

Dos que importan tanto como el wizard:
- **`modal-crear-template-faltante`** — crea el template tomando la `categ` **del movimiento
  bancario** y usándola también de `nombre_referencia`. Si esa categ no está en el plan, nace
  huérfano igual.
- **`generador-renovacion-campana`** — clona templates para la campaña nueva, así que **hereda
  la categoría del original**: si el viejo estaba huérfano, el nuevo también.

Poner la validación sólo en el wizard tapa una de tres. Lo que conviene es **una pieza compartida**
—un selector de categoría que lea del plan— y usarla en los tres, igual que se hizo con
`SelectorCuentaContable` y `ProveedorCombobox`.

**Prioridad**: hacerlo **después** de la Fase 0/1 de C-24. Validar contra un plan al que le
faltan 23 categorías bloquearía el trabajo diario en vez de ayudar.


##### 10 · Herramientas
- `npx tsx scripts/reporte-categorias-templates.ts` → estado actual (5 solapas)
- `npx tsx scripts/propuesta-plan-de-cuentas.ts` → **la propuesta** (5 solapas): 32 cuentas
  (26 crear · 4 completar · 2 reusar), los códigos que faltan, a qué cuenta iría cada template,
  el plan actual y qué emprolijar. Con eso **los 173 templates quedan con cuenta**.
- Los dos escriben una copia `_v2` si el archivo está abierto en Excel.

**C-25** — 5 movimientos conciliados sin ID (4 anticipos por $2,79 M + 1 sueldo).


---

#### ✅ C-27 · `tipo` EN EL TEMPLATE — la Fase 0, resuelta al revés *(2026-07-31, HECHO, sin testear)*

> *"tenemos ingreso egreso financiero y distribucion. sería bueno adjudicarle a cada template su
> tipo verdad? hacer la columna tipo en templates y llenar a cada uno con su tipo… ya nos
> olvidamos de cómo trabaja los templates dentro de cuentas."*

El usuario propuso lo contrario a lo planeado: en vez de completar el **plan de cuentas** para
que los templates hereden su tipo, **darle el tipo al template**. Tiene razón, y por un motivo
que en el análisis original no se vio:

**El `tipo` del plan y el `tipo` del template no son el mismo dato.** El plan clasifica
**facturas** (que apuntan por `cuenta_contable`); el template clasifica **templates**. Cada uno
clasifica su propia población. La objeción de "dos fuentes de verdad" que se había puesto en
contra de esta idea **no aplica** — y el plan se sigue necesitando igual para las facturas.

Ventaja concreta sobre la Fase 0 original: **ningún template queda dependiendo de que su
categoría exista en el plan.** Eran 70 de 123 activos los que no existían.

##### La cascada
```
egresos_sin_factura.tipo     ← manda. Cargado en los 176.
   ↓ sólo si está NULL
cuentas_contables.tipo       ← por `categ`. Fallback para lo que se cree de acá en adelante.
   ↓ sólo si tampoco está
signo del monto              ← último recurso. `resolverTipo` avisa que adivinó.
```

##### Lo que se cargó (los 176, no sólo los activos)
| tipo | total | activos | cuáles |
|---|---:|---:|---|
| `egreso` | 150 | 102 | impuestos, ARCA, SICORE, comisiones, expensas, seguros… |
| `distribucion` | **14** | 13 | los retiros de socios (6 MSA + 6 PAM + Retiro MA mensual + Retiro PAM) |
| `financiero` | **11** | 10 | FCI ×2, Caja, Interbancarias ×2, Créditos Pagados ×2, Créditos Tomados, Tarjetas ×3 |
| `ingreso` | **1** | 1 | Otros Ingresos |

Se cargaron **también los inactivos**, para que al reactivar uno no vuelva el hueco.

##### El bug que cierra
`Retiro MA mensual` y compañía: su `categ` no está en el plan → el dashboard caía al **signo del
monto** → un débito es "egreso" → los retiros de socios sumaban a **egresos operativos**.

**Medido después del cambio: 15 movimientos, $43,65 M** que pasan de egresos a distribuciones.
Y nada más se movió — se verificó que ese es el **único** grupo que cambia de sección.

##### Qué se tocó
| | |
|---|---|
| BD | `egresos_sin_factura.tipo` (enum `tipo_cuenta`, nullable, con `comment`) — **no está en el backup** |
| `lib/presupuesto/templates.ts` | `resolverTipo()` · `tipoEfectivo()` · `origenTipo()`. La cascada vive **acá y sólo acá** |
| `hooks/useFinancialData.ts` | usa `resolverTipo`. **Además** se le sacó el `.eq("activo", true)` al cargar templates: un movimiento de un template dado de baja perdía su clasificación |
| `components/tab-presupuesto.tsx` · `seccion-metodos-templates.tsx` | traen `tipo` y lo pasan al `TemplateInfo`. La columna de la pantalla de métodos ahora dice `(plan)` cuando el tipo no lo declaró el template |
| `components/wizard-templates-egresos.tsx` | **selector de Tipo obligatorio**, sugerido desde el plan al elegir la categoría. Se guarda en el insert y sale en el resumen del último paso |
| `scripts/verificar-templates.ts` | 13 casos nuevos (precedencia, origen, el caso Retiro MA, la cascada completa). Pasa |

##### ⚠️ Lo que NO cubre — las otras dos puertas de alta
El wizard ya pide el tipo, pero **`modal-crear-template-faltante` y `generador-renovacion-campana`
siguen creando templates sin `tipo`**. Ahí la cascada los salva (caen al plan o al signo), así que
no rompen — pero el hueco vuelve de a poco. → sigue siendo **C-26**, que ahora tiene un ítem más:
además de leer las categorías del plan, esas dos puertas tienen que **setear `tipo`**.

##### Qué queda de C-24 después de esto
La Fase 0 está cerrada. **Las fases 1 a 4 siguen abiertas y siguen valiendo** — pero ya no
bloquean el presupuesto, pasaron a ser prolijidad:
- **Fase 1** (completar el plan) — hoy sólo afecta a las **facturas**, no a los templates.
- **Fases 2-3** (texto → número, renombrar) — sin cambios.

#### 📗 Set completo de retiros semestrales + reporte del plan de cuentas *(2026-07-31)*

##### Los 12 templates ya están
6 personas × 2 empresas, **sin cuotas** (los montos los carga el usuario cuando los defina):

| | Templates |
|---|---|
| **MSA** | Andrés · José · Manuel · Mechi · Soledad · **MA** (este último inactivo) |
| **PAM** | Andrés · José · Manuel · Mechi · Soledad · **MA** (nuevo) |

El *Retiro MA semestral* que existía (`MSA/PAM`, inactivo) se **reasignó a MSA** y se renombró
`Retiro MA semestral MSA`: no tenía cuotas ejecutadas —las dos estaban en $0— así que se pudo
reusar sin perder nada. Queda **inactivo**; el usuario lo activa desde la grilla con el toggle
nuevo. Se creó aparte el de PAM.

⚠️ Los 5 PAM originales **conservan sus cuotas**: cada uno tiene $6.000.000 con fecha 25/07/2026
en estado `pendiente` (vencida). Son $30 M que no aparecen en el presupuesto de MSA por ser PAM
— ver C-21.

##### El reporte para completar el plan de cuentas
`npx tsx scripts/reporte-categorias-templates.ts` → genera
`Plan_de_cuentas_a_completar_<fecha>.xlsx` en la raíz, con tres solapas:

1. **A completar** — las **23 categorías** que usan templates y no existen en
   `cuentas_contables`, ordenadas por cuántos templates dependen de cada una. Trae columnas
   vacías `→ TIPO`, `→ Nombre totalizadora`, `→ Nro cuenta`, `→ Nombre de la cuenta`.
2. **Todos los templates** — los 173, con su categoría, si matchea, y el tipo, **nombre de
   cuenta**, totalizadora y nro que heredan. La foto completa.
3. **Valores válidos** — los `tipo` y las totalizadoras que ya existen, con qué decide cada uno,
   para completar sin adivinar.
4. **Plan de cuentas actual** — las 143 cuentas con nro, nombre, categoría, tipo, totalizadora,
   imputable, activa y cuántos templates usan cada una. Para revisar la consistencia de lo que
   ya está (108 `egreso` · 26 `ingreso` · 8 `financiero` · 1 `NO`; sólo 22 las usa un template).
5. **Revisar consistencia** — lo que conviene arreglar del plan actual. Hoy son **dos**, las dos
   totalizadoras escritas de dos formas: `EGRESOS`/`Egresos` (8 cuentas) y
   `EGRESOS POR GANADERIA`/`Egresos Por Ganaderia` (21). Agrupar por el nombre partiría la
   jerarquía en dos ramas — el mismo problema que tuvimos entre ARCA y el histórico.
   **Ninguna cuenta quedó sin `tipo`**: el plan está más limpio de lo esperado.

Si el archivo está abierto en Excel, el script escribe una copia `_v2` en vez de fallar.

**132 templates dependen de esas 23 categorías** (73 de MSA). Las más pesadas son
*Impuesto inmobiliario* (42) y *Impuesto Red Vial* (40): el plan de cuentas **no tiene rama de
impuestos**, porque siempre se pagaron por template y nunca tuvieron factura.

##### Con el `tipo` solo ya se arregla lo que importa
De las dos capas que faltan, **`tipo` es la que produce números mal** — decide si el template se
presupuesta, y equivocarse ahí es lo que metía $135 M de FCI y $87 M de Ganancias. La
**totalizadora sólo ordena** el reporte (C-22): mientras falte, el número está bien y lo único
que pasa es que el presupuesto agrupa por `cuenta_agrupadora` en vez de por la jerarquía
contable.

Así que si el usuario completa **sólo la columna TIPO**, queda resuelto el 100 % de lo que afecta
a los montos.

#### 🐄 PRESUPUESTAR LA VENTA DESDE EL PRESUPUESTO + VACAS DE REFUGO *(2026-07-31, sin testear)*

##### Vacas de refugo — era un pendiente, ahora se ven
> *"además de esto no se están mostrando los kg disponibles de las ventas no presupuestadas de
> vacas refugo, ¿verdad? ¿Es un pendiente?"*

**Sí, lo era.** `existenciasDeCiclos()` sólo emitía `terneros_venta` y `terneras_venta`; el
**descarte** se calculaba en `calcularCiclo()` pero nunca llegaba al presupuesto. Con
`peso_descarte_kg = 450` cargado en todas las campañas y 22–32 cabezas por ciclo, son
**~10.000 a 14.000 kg por campaña** que no se veían.

Ahora aparecen como `Vaca CUT/Descarte` en el mes del destete, igual que el resto.

**Y hubo que darles clave de tropa propia.** La vaca de refugo y la ternera son las dos hembras,
pero salen de tropas distintas: la vaca del rodeo de cría que se descarta, la ternera del destete.
Con la clave vieja (`ciclo:<id>|hembra`) un lote de terneras habría neteado contra las vacas
disponibles. `tropaDeCategoria()` devuelve ahora `macho` · `hembra` · `descarte`, y el
verificador comprueba que vender las terneras no toque el refugo.

##### Presupuestar la venta sin salir del presupuesto
> *"¿podríamos tener la posibilidad de represupuestar ventas desde el presupuesto y que
> actualice las ventas presupuestadas y se reubique en el presupuesto? Así no salgo de él para
> ir haciendo ese trabajo."*

Las celdas ámbar de **cabezas disponibles** pasan a ser clickeables: se abre un formulario chico
(cuántas · cuándo · precio · plazo), se guarda el lote y la celda **se convierte en plata** al
recargar. Sin salir de la pantalla.

`components/modal-presupuestar-venta.tsx`. Es deliberadamente **chico y no el editor completo de
lotes**: acá se decide lo mínimo con los defaults de la tabla —desbaste y comisión por peso,
precio de la banda del mes, todas las cabezas disponibles, venta a fin del mes en que se
disponibilizan— y muestra el desglose hasta el "INGRESA". El ajuste fino (ganancia diaria,
tramos de actividad, desbaste fuera de tabla) sigue en Productivo → Evolución Rodeo, sobre el
mismo lote.

**El detalle que hace que el neteo siga funcionando**: la celda trae su `clave` de tropa, y de
ahí sale el `ciclo_id` que se guarda en el lote. Sin eso la venta no descontaría de la existencia
correcta y las cabezas quedarían disponibles y vendidas a la vez.

`ganancia_diaria_kg` arranca en **0** a propósito: para una venta cargada al toque, suponer que
el animal engorda sería inventar kilos. Si se la va a retener, se le asigna actividad en
Productivo y la curva se arma sola.

##### Pendiente que deja
**C-23** — lo mismo para el otro lado: editar o borrar una venta ya presupuestada desde el
presupuesto (hoy la celda con plata no es clickeable, hay que ir a Productivo). Y el equivalente
para arrendamientos, que ya tiene su modal de cuotas pero no permite crear.


#### 🧾 IIBB MENSUAL — doble conteo confirmado *(2026-07-31)*

> *"IIBB mensual MSA deberíamos no proyectarlo, ¿verdad? Ya que se calcula según ventas y el
> proyectado hace como un promedio que duplica el egreso."*

**Sí, es doble conteo.** El presupuesto ya tiene la fila derivada **IIBB total** (5 % de la venta
de arrendamiento + hacienda + ganadería, el mes siguiente al cobro) **y además** el template
*IIBB Mensual MSA*, que proyecta el promedio de sus 12 cuotas ($296.185/mes, $3,55 M cargados
ago-25 → jul-26). Son el mismo impuesto contado dos veces.

**El arreglo es `no_proyectar`, no borrar el template**, y el matiz importa: las **12 cuotas
cargadas siguen mandando** (son lo que efectivamente se declaró), sólo se deja de proyectar hacia
adelante donde no hay cuota. Ahí toma el relevo la fila derivada, que sí sigue a las ventas.

Lo hace el usuario desde el panel: *Cuentas contables → Cómo se completan los templates →
IIBB Mensual MSA → método "No proyectar"*. Su elección queda marcada como manual y sobrevive a
cualquier cambio de heurística.

**Regla general que deja**: cuando el presupuesto **calcula algo solo** (IIBB de ventas, costos
de producción, SICORE si algún día se deriva), el template del mismo concepto tiene que ir a
`no_proyectar`. Sus cuotas cargadas siguen valiendo; lo que sobra es la proyección.

---

#### ✅ Verificado: el presupuesto NO duplica Anual vs Cuota *(2026-07-31, sin cambios de código)*

> *"es muy posible que yo haya puesto cuotas de templates que no generaron egresos reales.
> ejemplo inmobiliario anual que lo llené pero elegí pagar en cuotas… si toma todo, tomaría
> duplicado."*

Duda razonable, **verificada y descartada**. Queda anotado para no volver a levantarla.

**El flag `activo` ya es el interruptor**, y está bien mantenido. De los 42 pares Anual/Cuota,
41 tienen el Anual apagado y 1 prendido — justo el que se paga anual. `Lote Puerto` lo muestra
cruzado, que es la mejor prueba de que es deliberado:

| | Anual | Cuota |
|---|---|---|
| Inmobiliario Lote Puerto | ✅ activo | ❌ inactivo |
| Red Vial Lote Puerto | ❌ inactivo | ✅ activo |

`tab-presupuesto` carga con `.eq("activo", true)` → los **41 Anual apagados ($57,7 M en cuotas
viejas) no entran**. Sin doble conteo.

##### Y el otro miedo: cuotas cargadas que nunca pasaron
También chico. Cuotas ya vencidas que siguen en `pendiente`: **14**, pero 9 son del **mes en
curso** (normal, todavía abierto). Viejas de verdad hay dos: `ABL Libertad Cuota` 2026-03
($270.123) y `Caja` 2026-06 ($900.000, y `Caja` es `financiero` → no se proyecta igual).
**Queda una sola para mirar**: la ABL de marzo.

##### ⛔ Lo que NO hay que hacer: exigir "conciliado"
Se evaluó filtrar la proyección por estado conciliado. **Sería un error**: hay **128 cuotas
pendientes por vencer** (la campaña cargada) que son el dato **más firme** que existe — un
compromiso futuro no puede estar conciliado. El criterio correcto no es *"conciliado"* sino
*"ya pasó su fecha y sigue pendiente"*, y eso es **una** cuota. No se tocó nada.
*(El usuario lo cerró: "fue un error conceptual mío".)*

#### 🏛️ C-22 · USAR LA ESTRUCTURA DEL DASHBOARD EN EL PRESUPUESTO
*(2026-07-31 — **PASO 1 HECHO** (secciones por `tipo`), falta el paso 2 (totalizadoras). Sin testear.)*

> *"los agrupadores macro que encontraste, fijate que se usaron para ordenar el dashboard que
> registra y reporta el pasado. Esa misma estructura de organización deberíamos usarla para el
> presupuesto."*

---

##### ✅ PASO 1 — secciones por tipo, con el patrón del dashboard *(hecho)*

> *"dale, hacelo con el patrón del dashboard"*

Antes: el presupuesto listaba las agrupadoras **en orden alfabético, todas mezcladas**, y cerraba
con un único `TOTAL EGRESOS MSA`. Los retiros de socios quedaban adentro sin distinguirse — el
monto estaba bien (es caja que sale) pero no se podía leer cuánto del egreso era estructura y
cuánto reparto.

Ahora la grilla se parte igual que `tabla-resumen-financiero.tsx`, mismos títulos y colores:

```
INGRESOS — Arrendamientos · ganadería · hacienda
EGRESOS            (rojo)     agrupadoras ▶ · Sueldos · Cuentas contables · Costos · IIBB
                              Subtotal egresos
DISTRIBUCIONES     (violeta)  Retiros / Distribucion Socios ▶
                              Subtotal distribuciones
TOTAL EGRESOS MSA  (incluye distribuciones)
RESULTADO
SALDO ACUMULADO
```

**Ningún número cambió** — es presentación. El TOTAL sigue sumando todo, y los retiros siguen
adentro **a propósito**: el presupuesto es de caja y esa plata sale. La separación es para poder
leerlo, no para excluirlo. Cuando hay distribuciones, el total lo aclara.

**Detalles de implementación**
- Las agrupadoras se arman por **`tipo` + nombre**, no sólo por nombre: si una mezclara gasto con
  retiro, aparece en las dos secciones con su parte. Igual que el dashboard. Por eso `Agrupador`
  ganó `clave = tipo||nombre` — el nombre solo ya no identifica una fila.
- El render de una agrupadora se extrajo a `renderAgrupador()`, porque ahora se llama una vez
  por sección.
- `financiero` está declarado como sección aunque hoy no aparezca: sus templates dan
  `no_proyectar`, quedan en cero y se filtran solos.
- ⚠️ **Guardarraíl**: un agrupador cuyo tipo no tenga sección **cae en EGRESOS**, nunca se omite.
  Si se omitiera seguiría sumando en el TOTAL sin aparecer en ninguna fila y el subtotal dejaría
  de cerrar **en silencio** — la misma familia de bug que veníamos arrastrando.

**En MSA la sección DISTRIBUCIONES muestra** `Retiro MA mensual` (~$8 M a futuro) y `Retiro PAM`
(~$350 k). Los 5 semestrales MSA todavía no tienen cuotas, así que no proyectan.

##### ⏳ PASO 2 — bajar a totalizadora *(pendiente — y NO es lo que parecía)*

Dentro de cada sección, ordenar por `nombre_totalizadora` en vez de alfabético.

> *"si te lleno la totalizadora en el excel ya arreglaríamos eso verdad?"*

**No alcanza, y por un motivo que hay que tener claro antes de perder tiempo llenando.** Medido
sobre los 68 templates activos MSA con agrupadora:

| | templates | qué les falta |
|---|---:|---|
| Llegan OK a su totalizadora | 23 | nada (bancarios, impuestos bancarios, seguros, financieros) |
| En el plan **pero sin** totalizadora | **0** | — |
| Su `categ` **no existe** en el plan | **45** | **la cuenta entera** |

**El casillero "sin totalizadora" está vacío**: toda categoría que ya está en el plan ya la tiene
cargada. El hueco no son totalizadoras en blanco — son **17 categorías que no existen como
cuenta**, y para esas no hay fila donde escribir nada:

`Impuesto inmobiliario` · `Impuesto Red Vial` · `Impuesto Automotores` · `Impuesto IIBB` ·
`Impuestos ARCA` · `Impuestos Laborales ARCA` · `Retenciones ARCA` · `CZ Ganadera` ·
`Gastos Reintegro JMS` · + las 8 de retiros (`Distribucion Mama/Andres/Jose/Manuel/Mechi/Soledad`,
`Retiro PAM`)

⚠️ **Las 8 de retiros son un caso aparte**: ya están resueltas para el presupuesto (el template
tiene `tipo = distribucion`) y **no cuelgan de una totalizadora de EGRESOS** — no son gasto. Si
se les pone una, tiene que ser propia (tipo *DISTRIBUCION A SOCIOS*), no bajo Administración y
Estructura.

##### Por qué conviene NO hacerlo todavía — decisión del usuario
> *"de cualquier manera es un tema de ordenamiento. ahora podemos dejarlo así también verdad?"*

Sí, y hay un argumento activo para esperar: ordenar por totalizadora hoy **ordenaría 23 de 68
templates** y mandaría los otros 45 a un cajón "sin clasificar". **Se leería peor que el
alfabético actual.** Conviene hacerlo cuando estén las 17 categorías, no antes.

Insumo listo: `Propuesta_plan_de_cuentas_2026-07-31.xlsx` (o regenerarlo con
`npx tsx scripts/propuesta-plan-de-cuentas.ts`). Lo que hace falta del usuario por cada
categoría: **número de cuenta** y **de qué totalizadora cuelga**. Decisión abierta suya: si
quiere una cuenta por template o pocas cuentas con varios templates cada una (hoy
`Impuesto inmobiliario` ya junta 42).

Tiene todo el sentido: el pasado y el futuro deberían leerse con la misma grilla. Hoy no coinciden
— el presupuesto agrupa los templates por `cuenta_agrupadora` (una convención propia) y las
cuentas contables por su nombre, mientras el dashboard usa la jerarquía contable.

##### La estructura que ya existe
`cuentas_contables.tipo` (macro) + `nombre_totalizadora` (jerarquía):

```
tipo = ingreso     RESULTADOS → INGRESOS → VENTA DE CEREALES · VENTA DE HACIENDA ·
                                            ARRENDAMIENTOS Venta · VENTA BIENES DE USO
                   CREDITOS FISCALES
tipo = egreso      RESULTADOS → EGRESOS → EGRESOS POR ADMINISTRACION Y ESTRUCTURA (25 cuentas)
                                        · EGRESOS POR AGRICULTURA → INSUMOS (11) · LABORES (11)
                                        · EGRESOS POR GANADERIA (16) → GASTOS DE ALIMENTACION (6)
                                        · EGRESOS POR MAQUINARIAS Y HERR (3)
                                        · COMERCIALIZACION (6) · SEGUROS CULTIVO
                   GASTOS BANCARIOS (7) · IMPUESTOS BANCARIOS (7)
tipo = financiero  MOVIMIENTOS ENTRE CANALES (4) · MOVIMIENTOS FINANCIEROS (4)
```

##### Dos obstáculos concretos, los dos de datos
**1 · Faltan 14 categorías en el plan de cuentas** — y son las que usan 40 templates:

| Categoría del template | Templates | Qué son |
|---|---:|---|
| Impuesto inmobiliario | 12 | los inmobiliarios rurales + Lote Puerto |
| Impuesto Red Vial | 11 | ídem |
| Impuesto Automotores | 4 | patentes |
| Impuestos ARCA | 3 | Ganancias, Anticipo, Acciones y Participaciones |
| Impuestos Laborales ARCA | 2 | Cargas Sociales, UATRE |
| Retenciones ARCA | 2 | SICORE 1ra y 2da |
| Impuesto IIBB · Complementario · CZ Ganadera · Reintegro JMS · Distribucion Mama · Retiro PAM | 6 | sueltas |

El plan de cuentas **no tiene una rama de impuestos**: tiene sentido, porque los impuestos se
pagan por template y nunca tuvieron factura. Pero mientras no existan, esos 40 templates no
tienen totalizadora y no se pueden ordenar con la estructura del dashboard.

**2 · Las totalizadoras tienen inconsistencias de mayúsculas**: conviven `EGRESOS` con `Egresos`
y `EGRESOS POR GANADERIA` con `Egresos Por Ganaderia`. Agrupar por el nombre partiría la
jerarquía en dos, exactamente como pasó con los nombres de cuenta entre ARCA y el histórico.
Hay que normalizar o agrupar por `cta_totalizadora` (el código) en vez del nombre.

##### Plan
1. Dar de alta las 14 categorías faltantes en `cuentas_contables`, con su `tipo` y su
   totalizadora. **Es del usuario**: define el plan de cuentas.
2. Normalizar las totalizadoras duplicadas por mayúsculas (o agrupar por código).
3. Recién ahí, reordenar el presupuesto por `tipo` → `nombre_totalizadora` → cuenta/template.

Hacer el paso 3 antes de los otros dos dejaría 40 templates en un cajón "sin clasificar", que es
peor que la organización actual.

**Efecto colateral bueno**: alta esas 14 categorías y **C-20 se completa solo** — hoy esos mismos
40 templates se asumen gasto por no tener `tipo`.

---

#### 📋 REGLA — todo template nuevo necesita su macro categoría *(usuario, 2026-07-31)*

> *"ojo al crear template que debemos adjudicarle siempre la macro categoría: ingreso, egreso,
> financiero, etc."*

La `categ` de un template tiene que existir en `public.cuentas_contables` con su `tipo` cargado.
De ese `tipo` dependen dos cosas del presupuesto:
- si el template **se presupuesta** (`financiero` no, ver C-20);
- **dónde aparece** cuando se ordene por la estructura del dashboard (C-22).

Un template sin categoría en el plan de cuentas se asume gasto y queda sin ubicación. El panel
de métodos lo muestra como *"sin clasificar"*.


#### ✅ C-20 — "No es gasto" sale del PLAN DE CUENTAS, no del nombre *(2026-07-31, sin testear)*

La versión anterior tenía una lista de agrupadoras (`Inversiones`, `Movimientos Internos empresa`,
`Créditos Bancarios`). Funcionaba pero **dependía de cómo se llamaran**: un renombre y el gasto
fantasma volvía sin aviso.

**El dato ya estaba**: `public.cuentas_contables.tipo`, un enum `tipo_cuenta` con
`ingreso · egreso · financiero · distribucion · NO`. Se llega desde el template por su `categ`.

| `tipo` | Qué hace el presupuesto | Templates MSA |
|---|---|---:|
| **`financiero`** | **No proyecta** — la plata cambia de lugar pero no sale | 7 |
| `egreso` | Proyecta normal | 16 |
| `distribucion` | **Proyecta** — los retiros de socios sí salen de la caja | — |
| `ingreso` · `NO` | No proyecta, avisa | — |
| sin match | Proyecta (default seguro) | 40 |

Separa fino justo donde importa: las **comisiones bancarias son `egreso`** (gasto de verdad)
aunque vivan en "Gastos Bancarios", mientras el FCI (`Fondos Comunes de Inversión` →
`MOVIMIENTOS FINANCIEROS`), la caja y las interbancarias (`MOVIMIENTOS ENTRE CANALES`) son
`financiero`.

##### Tarjetas también quedó afuera — confirmado por el usuario
*Tarjeta Visa Business MSA* sale `financiero` y hasta ahora se presupuestaba (declara 12 cuotas).
Ya no. El motivo es el doble conteo: **el pago del resumen duplica los gastos que ya entran por
su cuenta contable**. Es lo mismo que el usuario había señalado sobre los canales de pago.

##### Lo que NO cubre — y se muestra
**40 de 63 templates no matchean** con el plan de cuentas: sus `categ` ("Impuesto inmobiliario",
"Impuesto Red Vial", los automotores, los retiros) no existen en `cuentas_contables`. Se asumen
gasto, que hoy es correcto para todos.

Pero el mecanismo depende de ese match, así que el panel muestra una columna **Tipo** y avisa
cuántos están *sin clasificar*. Si algún día entra un template financiero con una categoría que
tampoco existe, se va a presupuestar — y el aviso es lo que lo hace visible.

De paso queda expuesta una deuda de datos real: **40 categorías de template que no están en el
plan de cuentas**.

**Verificador**: 36 checks. Los nuevos comprueban que renombrar la agrupadora no cambie nada y
que, al revés, una agrupadora llamada "Inversiones" pero con `tipo = egreso` sí se presupueste.

---

#### 💰 RETIROS DE SOCIOS — 5 de 6 quedan fuera del presupuesto MSA *(hallazgo 2026-07-31)*

> *"retiros semestrales mamá, Manuel, etc. (son 6 personas en total) ¿están dentro?"*

Los 6 templates existen, pero **sólo el de MA entra al presupuesto de MSA**. Los otros cinco
tienen `responsable = 'PAM'` y el presupuesto filtra por `responsable ILIKE '%MSA%'`.

| Template | Responsable | Cuotas | Total cargado | ¿Entra? |
|---|---|---:|---:|---|
| Retiro MA mensual | MSA/PAM | 12 | $45.945.000 | ✅ sí |
| Retiro PAM | MSA | abierto | $6.055.000 | ✅ sí |
| Retiro Andrés semestral | PAM | 2 | $6.000.000 | ❌ no |
| Retiro José semestral | PAM | 2 | $6.000.000 | ❌ no |
| Retiro Manuel semestral | PAM | 2 | $6.000.000 | ❌ no |
| Retiro Mechi semestral | PAM | 2 | $6.000.000 | ❌ no |
| Retiro Soledad semestral | PAM | 2 | $6.000.000 | ❌ no |
| ~~Retiro MA semestral~~ | MSA/PAM | 2 | $0 | inactivo |

**Son $30 M cargados que no aparecen en el presupuesto de MSA.** Puede estar bien (si los paga
PAM) o puede ser un hueco (si salen de la caja de MSA y sólo se imputan a PAM). **Decisión del
usuario** — no se tocó nada.

Si hay que incluirlos, la vía correcta **no** es cambiar el filtro por responsable —eso metería
todo PAM— sino marcar esos cinco como MSA/PAM, igual que ya está el de MA.

**C-21**: definir si los retiros semestrales de socios salen de la caja de MSA.

#### 💸 LO QUE NO ES GASTO NO SE PRESUPUESTA *(2026-07-31, sin testear)*

> *"FCI no se debería presupuestar ya que es dinero que si egresa es porque se coloca a tasa y
> está disponible de cobrarse con su rendimiento de inmediato. Presupuestar colocaciones no
> tiene sentido: es preferible que no se presupueste nada, o en tal caso hacerlo yo a mano."*

El usuario tenía razón y el error era el más grande que quedaba. **FIMA Premium (FCI)**
promediaba **$7,5 M** y se proyectaba **todos los meses** (heredaba `promedio` por ser
`tipo_recurrencia = 'abierto'`): **~$135 M de egreso inventado** en 18 meses. Más que el bug de
Ganancias del día anterior.

##### No es sólo el FCI: es una familia
Tres agrupadoras enteras que **no son gasto** — la plata se mueve pero no se va:

| Agrupadora | Templates | Qué pasaba |
|---|---|---|
| **Inversiones** | FIMA Premium (FCI) | $7,5 M/mes proyectados |
| **Movimientos Internos empresa** | Caja, Interbancaria BAPRO, Interbancaria Santander | Caja $750 k × 12/año; las interbancarias 2/año |
| **Créditos Bancarios** | Créditos Pagados, Créditos Tomados | financiación — y **"Créditos Tomados" es un INGRESO** apareciendo en egresos |

`esMovimientoInterno()` en `lib/presupuesto/templates.ts` los devuelve con su motivo, y
`metodoHeredado()` los corta **antes que nada**: da igual cuántas cuotas declaren. Se puede pisar
eligiendo un método a mano, que es la salida que pidió el usuario.

⚠️ ~~Es por nombre de agrupadora~~ → **C-20 RESUELTO el 2026-07-31**: el criterio pasó a ser
`cuentas_contables.tipo` (ver la sección de arriba). Ya no depende de cómo se llame nada.

##### La otra pregunta: los gastos bancarios
> *"hay templates que se llenan automáticamente con gastos bancarios, por ejemplo comisiones.
> Esos sí se pueden presupuestar en función de gastos históricos. Nunca se llenan antes, siempre
> durante. No sé si alguno de los 10 que me decías es uno de esos o son otros casos."*

**Son otros casos, y los bancarios ya estaban bien.**

Hay un campo que los marca: **`solo_conciliacion = true`**, y son exactamente los 14 de gastos e
impuestos bancarios (Com. Uso ATM, Comisión Cuenta Bancaria, Cheques, Transferencias, Extracción,
Certificaciones, Caja de Seguridad, Débitos/Créditos, IIBB Bancario, Impuesto País, IVA Bancario,
Percepción IVA, Percepción RG 5463, Sellos). Todos tienen `cuotas = 0` → heredan **promedio
mensual**, que es justo lo que el usuario describe.

Los **10 que declaran más cuotas de las que tienen** son otro grupo: todos `cuotas = 12`
(mensuales con campaña a medio cargar) — Cargas Sociales 12 vs 6, UATRE 12 vs 3, SICORE 1ra 12
vs 4 y 2da 12 vs 6, IIBB Mensual 12 vs 1, Seguro Flota y Accidentes 12 vs 5, Tarjeta Visa 12 vs
6, Retiro MA 12 vs 6, y **Caja** 12 vs 5. Ningún bancario entre ellos.

*(Caja sale de esa lista con este cambio: pasa a no proyectarse por ser movimiento interno.)*

##### Verificado
`scripts/verificar-templates.ts` — 28 checks. Nuevos: que el FCI no aporte un peso, que Caja no
proyecte aunque declare 12 cuotas, que un gasto real sí siga proyectando, que el usuario pueda
ponerlo a mano igual, y que las comisiones bancarias sigan yendo por promedio.


#### 🔧 TEMPLATES: JERARQUÍA DE MÉTODO, HEREDADA DE `cuotas` *(2026-07-31, sin testear)*

##### El bug que lo motivó — lo detectó el usuario sin ver los datos
> *"un template que era anual, si se puso mensual está aumentando 11 veces más el egreso.
> ¿No sé si ya teníamos data en los templates como para corregir de origen?"*

Tenía razón en las dos cosas. La primera versión **inferia la periodicidad de la historia de
cuotas**: si los meses con cuota eran ≥ 80 % del tramo, "mensual". Con **un solo mes** cargado
eso da densidad 1,00 → mensual → doce pagos al año.

| Template | Declara | Historia | Inferido | Monto | Fantasma/año |
|---|---:|---:|---|---:|---:|
| **Imp. Ganancias MSA** | 1 cuota | 1 mes | MENSUAL | $5.000.123 | **$55 M** |
| **Acciones y Participaciones** | 1 cuota | 1 mes | MENSUAL | $2.500.123 | **$27,5 M** |
| Imp. Automotores Voyage | 1 cuota | 1 mes | MENSUAL | $439.827 | $4,8 M |
| Inmobiliario Lote Puerto | 1 cuota | 1 mes | MENSUAL | $19.094 | $0,2 M |

**~$87 M anuales de egreso inventado en cuatro filas**, sobre un gasto real de ~$23 M/mes.

**Y el dato ya estaba**: `egresos_sin_factura.cuotas` es el número de cuotas al año y está
cargado en 64 de 66 templates. Inferí de la historia algo que el template ya declaraba. Error de
diseño: **inferir es para cuando no hay dato**, nunca para pisarlo.

##### La jerarquía, de más firme a más blando
1. **Cuota cargada** → manda siempre. Dato firme.
2. **Método elegido a mano** → `public.presupuesto_template_config` (no está en el backup).
3. **`cuotas` declarado** → cuántos pagos al año lo dice el template; en qué meses, la historia.
4. **Patrón por densidad** → sólo si no hay nada declarado. Último recurso, ya no primera opción.

##### Qué se hereda de `cuotas`
| `cuotas` | Método | Cuántos templates |
|---:|---|---:|
| 12 | **Todos los meses** | 10 |
| 1 – 11 | **Esas cuotas**, en los meses que muestra la historia | 29 |
| 0 · `null` · `tipo_recurrencia = 'abierto'` | **Promedio mensual** (sin periodicidad fija) | 22 |
| sin historia | **No proyectar** | 10 |

`tipo_recurrencia = 'abierto'` gana sobre `cuotas`: Otros Gastos y Pasajes no tienen calendario
aunque declaren un número.

**El promedio divide por el SPAN, no por los meses con cuota** — misma regla que las cuentas
contables. Comisión Transferencias: $140.000 en 5 meses de tramo da $28.000/mes, no $35.000.

##### Dos avisos que el usuario necesita ver
- **Declara más cuotas de las que hay** (10 templates: Cargas Sociales 12 vs 6, UATRE 12 vs 3,
  Anticipo Ganancias 10 vs 0…). Se proyectan las conocidas, así que **el presupuesto puede estar
  corto**. Va un ⚠ por fila y un resumen arriba de la tabla.
- **Falta generar la campaña** (`aplica_generacion = true`): sigue igual, banda ámbar arriba.

##### Dónde se edita
Dentro del panel **"Cuentas contables"**, sección *"Cómo se completan los templates"* — van
juntos porque son la misma pregunta que hizo el usuario. Muestra por template: cuántas cuotas
declara, cuántos meses tienen cuota cargada, el método (con `auto` y el motivo), cuántos meses
proyecta y por cuánta plata, **ordenado por monto** para que lo caro aparezca primero.
El ✨ devuelve al automático.

En la grilla del presupuesto cada template muestra su método al lado del nombre: gris si es
heredado, azul si se eligió a mano.

**Verificador**: `scripts/verificar-templates.ts` — 20 checks, incluidos el caso Ganancias
($60 M → $5 M), que la cuota cargada pise al método manual, y que el promedio divida por el span.

#### ✅ C-19 · C-7 · C-17 — EL PRESUPUESTO QUEDÓ COMO UNA SOLA COSA *(2026-07-30, sin testear)*

Los tres bloques que estaban afuera ahora bajan a la grilla, suman al **TOTAL EGRESOS** y por lo
tanto al **RESULTADO** y al **SALDO ACUMULADO**.

##### C-19 · Cuentas contables en la grilla
Fila colapsable `📒 Cuentas contables`, con una sub-fila por cuenta. El **modo se sigue
configurando en su panel** (botón "Cuentas contables"), igual que Precios y TC configura y la
grilla muestra. Cada celda lleva su explicación en el tooltip.

##### C-7 · Costos de producción en la grilla
Fila `🌾 Costos de producción`, **una sub-fila por actividad** (no por lote): en el presupuesto
interesa cuánto cuesta la recría, no cuánto cuesta cada lote. Sale de los tramos vía
`tramosParaCosto()` + `consumoMensual()`, con el TC para los ítems en USD.

Es una línea **derivada**, como quedó decidido: los costos directos no se registran en ningún
lado, se calculan a partir de la actividad.

##### C-17 · Los templates se proyectan donde no hay cuota
`lib/presupuesto/templates.ts`. Las cuotas se cortaban en dic-2026 y el segundo año del
presupuesto quedaba casi vacío — que no es lo mismo que no tener gasto.

**Donde hay cuota, manda la cuota.** Donde no, se proyecta desde el mismo mes del año anterior
(o la última cuota) más IPC. Las celdas proyectadas van **en cursiva** para que nunca se
confundan con un dato firme.

**Lo que NO se podía hacer: propagar la última cuota todos los meses.** Convertiría un impuesto
anual en un gasto mensual — *Inmobiliario Cuota Rojas* paga en cinco meses y daría doce pagos.
La proyección respeta **en qué meses paga cada template**, sacado de su historia (se piden las
cuotas desde 18 meses antes justamente para tener con qué).

**⚠️ La densidad como criterio principal fue un error y se corrigió al día siguiente** — ver la
sección "TEMPLATES: JERARQUÍA DE MÉTODO" arriba. Con un solo mes de historia daba "mensual" y
multiplicaba por 12 los impuestos anuales (~$87 M de egreso fantasma). Ahora el método se hereda
de `cuotas`, que el template ya declara, y la densidad quedó como último recurso.

##### El aviso, que era la mitad del pedido
> *"por ej cargas sociales a mí me sirve crear la campaña con datos estimados porque me recuerda
> el compromiso de pago, pero otros no. ¿Cómo haría el sistema para poder interpretar?"*

**El campo ya existía y ya estaba bien cargado**: `egresos_sin_factura.aplica_generacion`.
No hubo que inventar ninguna clasificación.

| `aplica_generacion` | Qué hace el presupuesto |
|---|---|
| `true` (12: **Cargas Sociales**, SICORE 1ra/2da, UATRE, IIBB Mensual, Anticipo Ganancias, Imp. Ganancias, Acciones y Participaciones, Seguro Flota/Accidentes, Tarjeta Visa, Interbancaria BAPRO) | Proyecta **y avisa**: banda ámbar arriba con cuántos templates, cuántos meses y cuánta plata, y un `◦` en la celda. El aviso **es** el recordatorio del compromiso de pago. |
| `false` / `null` (52) | Proyecta en silencio. No hace falta cargar nada. |

Sin escribir **nada** en el template: la estimación vive en el Presupuesto, el compromiso en el
template. Es la regla que el usuario recordó.

**Verificador**: `npx tsx scripts/verificar-templates.ts` — 12 checks, incluido que un impuesto
anual no se vuelva mensual y que la cuota cargada pise a la proyección.

##### Lo que queda para verificar cuando se pruebe
- El **TOTAL EGRESOS cambió**: ahora incluye cuentas contables y costos de producción. Vale la
  pena mirar el salto contra lo que mostraba antes.
- El **doble conteo** está cubierto por construcción (templates y cuentas no comparten conceptos;
  las cuentas de producción salen `excluida`; Federación Patronal se descuenta por CUIT), pero
  es lo primero a revisar si un número parece alto.


## 🔚 CIERRE DE SESIÓN 2026-07-30 — Presupuesto (ingresos, costos, cuentas, proveedores)

**Todo en `desarrollo`, nada mergeado a `main`. Build OK, tipos en 120 (baseline), 6 verificadores
en verde. Sólo el export de caravanas está testeado por el usuario; el resto NO.**

### Commits de la sesión
| Commit | Qué |
|---|---|
| `29efaa4` | fix parser es-AR (`5700` se leía 5,7) → `lib/format/numero.ts` |
| `ae81b48` | Hacienda por categoría + disponible **por diferencia** (cierra G-8, agrega G-9) |
| `4853da8` | Plan FASE C (costos productivos) |
| `1400ebc` | C-1 motor de ración a lib + C-2 actividades y costos directos |
| `6b78758` | C-3 tramos + C-4 **curva de peso quebrada** |
| `156e7e2` | moneda USD, `momento: ciclo`, `pct_produccion` + 2 bugs propios |
| `d279453` | **saldo acumulado**, IIBB en un renglón, sub-agrupación por categoría |
| `8014c07` · `33b2f9c` | export de **caravanas** para declarar (✅ **testeado OK**) |
| `ff5edf9` | presupuestar **cuentas contables**: 6 modos + control de cordura |
| `5b5f885` | **control de subas de proveedores** vs IPC + Excel y PDF |
| `15661d7` | fuente facturas ↔ canales conmutable · IPC en escalones · Fed Patronal |
| `d3cf7eb` | exclusión **por proveedor** y no por cuenta |

### Verificadores (`npx tsx scripts/verificar-<x>.ts`)
`disponibilidad-hacienda` (9) · `actividades` (18) · `tramos` (11) · `caravanas` (15) ·
`presupuesto-cuentas` (23) · `control-proveedores` (16).
Encontraron **tres bugs reales** que ya estaban escritos: la ventana del promedio cerrando en el
último mes con dato (inflaba 35 %), los costos "al terminar" que no caían nunca, y el reparto del
mes en curso.

### BD nueva (nada de esto está en el backup)
`productivo`: `actividades`, `actividad_insumos`, `lote_tramos`, `stock_lotes.ganancia_override`.
`public`: `presupuesto_config` (+`inflacion_mensual`), `presupuesto_cuenta_config`
(+`cuits_excluidos`), y las vistas `presupuesto_historia_cuentas`,
`presupuesto_historia_cuenta_proveedor`, `presupuesto_historia_canales`,
`presupuesto_cobertura_canales`. Todo con DDL en `RECONSTRUCCION_SUPABASE_2026-01-07.md`.

⚠️ **El MCP de Supabase quedó en modo write** — hay que volverlo a `--read-only` (A-OP-01).

---

### 📌 Preguntas del usuario al cierre — respondidas

#### 1 · ¿Las cuentas contables están separadas del presupuesto a propósito?
**Sí, a propósito, y es transitorio.** El panel está arriba y **no suma al TOTAL EGRESOS** porque
al construirlo no estaba verificado si se pisaba con templates. Ahora sí está verificado (no se
pisan, salvo Federación Patronal que ya se resolvió), así que **el próximo paso es integrarlo**.

**La intención**: que sea un bloque más de la grilla, al lado de templates y sueldos, sumando al
TOTAL EGRESOS y por lo tanto al RESULTADO y al SALDO ACUMULADO. El panel de arriba queda como el
lugar donde se **configura** el modo de cada cuenta (igual que Precios y TC configura y la grilla
muestra).

→ **C-19 ✅ HECHO** justo después (ver la sección de arriba): las cuentas contables ya bajan a la
grilla y suman al TOTAL EGRESOS, junto con los costos de producción (C-7) y la proyección de
templates (C-17).

#### 2 · IPC cargado ✅ — verificado que funciona
El usuario cargó **3 escalones**: jul-26 `2 %`, dic-26 `1,5 %`, jun-27 `1 %`. El arrastre los
completa como corresponde:

```
jul-26  2,0 % exacto      dic-26  1,5 % exacto      jun-27  1,0 % exacto
ago-26  2,0 % arrastrado  ene-27  1,5 % arrastrado   jul-27  1,0 % arrastrado
… nov-26 2,0 %            … may-27 1,5 %             … ago-27 1,0 %
```
Acumulado ago-26 → ago-27: **21,9 %**. Ya lo usan el presupuesto de cuentas y el control de
proveedores.

#### 3 · ¿Cómo hacen los templates para presupuestar si no está cargada la campaña siguiente?
**✅ RESUELTO en C-17** (ver arriba). Cuando se escribió esto todavía no estaba; el diagnóstico
sigue valiendo: El presupuesto lee las cuotas cargadas, y las cuotas se cortan:

| jul-26 | ago-26 | sep-26 | oct-26 | nov-26 | dic-26 | ene-27 |
|---|---|---|---|---|---|---|
| 30 · $61,4 M | **16 · $2,3 M** | 54 · $12,8 M | 14 · $3,6 M | 36 · $18,9 M | 33 · $9,2 M | **2 · $0,55 M** |

Desparejo y **se termina en dic-2026**. Un presupuesto a 24 meses muestra el segundo año casi
vacío, y eso no es que no haya gasto.

#### 4 · ¿Cómo distingue el sistema qué template quiere el usuario cargado y cuál proyectado?
**Ya existe el campo y ya está bien cargado: `egresos_sin_factura.aplica_generacion`.**
Es el que usa el generador de campaña, y su semántica es justo la que el usuario describe —
*"cargas sociales me sirve crear la campaña con datos estimados porque me recuerda el compromiso
de pago, pero otros no"*.

| `aplica_generacion` | Cuántos | Cuáles |
|---|---|---|
| `true` | 12 | **Cargas Sociales**, UATRE, SICORE 1ra y 2da, IIBB Mensual, Anticipo Ganancias, Imp. Ganancias, Acciones y Participaciones, Seguro Flota, Seguro Accidentes, Tarjeta Visa, Interbancaria BAPRO |
| `false` | 2 | Caja, Interbancaria Santander |
| `null` | 50 | impuestos rurales y automotores, comisiones bancarias, retiros, etc. |

Cargas Sociales está en `true`, que es exactamente lo que el usuario dijo que quiere. **El dato ya
está**, no hay que inventar ninguna clasificación nueva.

**La regla, ya implementada:**

| Situación | Qué hace el presupuesto |
|---|---|
| El mes **tiene cuota** cargada | Usa la cuota. Dato firme, no se toca. |
| Sin cuota y `aplica_generacion = true` | **Proyecta y avisa** *"falta generar la campaña"*. El aviso es el punto: es el recordatorio del compromiso de pago que el usuario quiere. |
| Sin cuota y `false`/`null` | **Proyecta en silencio** con su modo. No hace falta cargar nada. |

Y para proyectar se reusan los mismos modos de las cuentas contables, eligiendo según
`periodicidad`: mensual → propagar la última cuota + IPC; anual/bianual → mismo mes del año
anterior + IPC. Sin escribir **nada** en el template, que es la regla acordada hace tiempo: la
estimación vive en el Presupuesto, el dato firme en el template.

#### 5 · Costos de producción al presupuesto
**✅ HECHO (C-7)**: los costos ya bajan a la grilla, una fila por actividad, sumando al TOTAL.

---

### 🗺️ Orden sugerido para retomar
1. ~~C-19 + C-7 + C-17~~ ✅ **HECHOS** — el presupuesto ya es una sola cosa.
2. **Testear** lo de esta sesión, que es mucho y está todo sin probar. Empezar por el TOTAL
   EGRESOS, que ahora incluye dos bloques nuevos.
4. **C-11** — control por canales (pagado vs facturado) para cazar el gasto sin comprobante.
5. Resto: C-6 stock e insumos a comprar · C-12 cabezas automáticas · C-18 chequeo de cruce por
   CUIT · A-OP-01 devolver el MCP a read-only.

### ⏳ Sin testear (todo lo de esta sesión menos caravanas)
**Presupuesto**: saldo acumulado · IIBB en un renglón · sub-agrupación de Impuestos Rurales ·
venta de hacienda colapsable y por categoría · disponible por diferencia · 6 modos de cuentas ·
control de cordura · fuente facturas/canales · exclusión por proveedor · control de subas.
**Costos productivos**: actividades y costos con simulador · tramos en el lote · curva de peso
quebrada.
**Corregido por el usuario**: la actividad *Engorde* quedó en **90 / 10** (suma 100 %). El bug del
input que se reformateaba está arreglado y la carga funciona.


#### 🔀 FUENTE DEL PRESUPUESTO: FACTURAS ↔ CANALES *(2026-07-30)*

##### Lo que el usuario aclaró — y por qué cambia el análisis
> *"se puede presupuestar desde canales… durante mucho tiempo yo presupuesté desde canales. La
> forma era que yo concilio los canales y les adjudico una cuenta contable o contra template,
> sueldos, etc. Cada egreso o ingreso va a una cuenta específica. Entonces tomando desde canales
> siempre supe cuánto veníamos gastando en cada cosa mes por mes."*

**Mi objeción principal se cae.** Yo había dicho que desde canales no se puede imputar y que por
eso no servía para proyectar. Es falso: **la conciliación adjudica la cuenta a cada movimiento**,
así que el canal conciliado tiene composición igual que la factura, y además cobertura total y la
fecha de pago (que es la que necesita el flujo de caja).

Con el objetivo bien planteado — que el **saldo** cierre — el método por canales es, en datos
completos, **al menos tan bueno como el de facturas y probablemente mejor**. Le quedan dos
defectos reales: el SICORE corre plata entre dos cuentas (el total cierra, la composición no) y
caja/tarjeta sin detallar son una bolsa hasta conciliarlas.

##### Qué se hizo: la fuente es un interruptor, no una decisión
En vez de elegir por el usuario, el panel de cuentas contables tiene un selector
**Facturas / Canales de pago**. Los seis modos funcionan igual con cualquiera de las dos porque
el motor recibe `PuntoHistorico[]` y no le importa de dónde salió.

Vistas nuevas:
- **`public.presupuesto_historia_canales`** — banco + caja (general/sigot/ams) + tarjeta,
  agrupado por `nro_cuenta` y mes. Sólo movimientos con cuenta imputada, y el monto es el débito
  **neto de créditos** (devoluciones y notas de crédito).
- **`public.presupuesto_cobertura_canales`** — cuánto de cada canal está conciliado.

##### ⚠️ Hoy la fuente por canales NO alcanza — y por eso se mide
| Canal | Movimientos imputados | Débitos imputados | Período |
|---|---|---|---|
| banco | 106 / 661 (**16 %**) | $69,4 M de $432,6 M | feb → jun 2026 |
| caja | 0 / 79 (**0 %**) | — | feb → may 2026 |
| tarjeta | 5 / 320 (**2 %**) | $0,85 M de $38,3 M | oct 2024 → may 2026 |

Con esta cobertura la vista **miente por omisión**: muestra sólo lo conciliado, así que parece que
se gastó mucho menos. Por eso el panel muestra el porcentaje arriba y dice explícitamente que
conviene la fuente por facturas mientras esté así. No es un defecto del método del usuario —
es que en esta BD reconstruida la conciliación todavía no se puso al día.

**Cuando la conciliación suba, la fuente por canales queda lista sin tocar código.**

---

#### 📈 IPC EN ESCALONES — se arrastra *(2026-07-30)*

> *"para IPC y TC es necesaria la herramienta de propagación ya que presupuestaré escalones,
> capaz pongo 6 meses con lo mismo y luego otros 6 de tal manera."*

Cambio en dos lugares, los dos con `resolverSerie` de `lib/precios/serie.ts`:

1. **`ipcAcumulado()`** (control de proveedores) — antes exigía el IPC mes por mes y devolvía
   `null` si faltaba alguno. Ahora **arrastra el último cargado**: con un solo punto al inicio
   alcanza, y dos escalones (3 % hasta marzo, 1 % desde abril) componen bien. Sólo da `null` si
   no hay ningún punto que arrastrar.
2. **El presupuesto de cuentas usa la serie de IPC si está cargada**, y la tasa fija sólo donde
   no hay. `factorInflacion()` compone mes a mes en vez de elevar una tasa única, así que un
   escalón se refleja en el mes exacto en que cambia. Cada cuenta puede seguir pisando las dos
   con su propia tasa.

⚠️ **Limitación conocida**: `resolverSerie` ignora los valores `<= 0` porque para un precio un
cero significa "no cargado". Para el IPC eso implica que **un mes cargado en 0 % se comporta como
vacío** y hereda el anterior. Si alguna vez hay deflación o un mes plano de verdad, hay que
distinguirlo — no se tocó `resolverSerie` porque es compartida con precios y TC.

---

#### 🧾 FEDERACIÓN PATRONAL — resuelto por indicación del usuario *(2026-07-30)*

> *"templates que sí tienen factura: es verdad, son pocos. Un ej es Fed Patronal que factura
> semestral y va por cuotas. Me resultó más fácil poner las cuotas en templates… para este caso
> particular ahora podríamos usar los templates para el presupuesto ya que es la realidad
> financiera."*

Hecho: `SEGUROS ESTRUCTURA` (422113) quedó como **`excluida`** en
`presupuesto_cuenta_config`, con el motivo escrito — *"va por template: Federación Patronal
factura semestral y las cuotas están cargadas"*. Es el único cruce real entre templates y
cuentas, y ahora el presupuesto lo toma de un solo lado.

El criterio general que deja: cuando algo **factura** pero **se paga en cuotas**, la cuota es la
realidad financiera y el template gana. La factura sirve igual para el control de proveedores.


##### 🔧 Corregido: la exclusión es por PROVEEDOR, no por cuenta *(2026-07-30)*
> *"ok pero ¿hay más seguros estructura? porque podría haber alguno otro y habría que verlo.
> Federación Patronal específicamente va por template."*

Tenía razón. Yo había excluido la **cuenta** `422113` entera. Verificado: hoy es **100 %
Federación Patronal** (mismo CUIT `33707366589` con tres grafías del nombre), así que no se
perdía nada — **pero quedaba una trampa**: el día que entre otra aseguradora a esa cuenta, su
gasto desaparecería del presupuesto sin que nadie se entere. Un cero silencioso es peor que un
número mal.

**Ahora se excluye el CUIT.** `presupuesto_cuenta_config.cuits_excluidos text[]` +
`netearExcluidos()` en la lib: se descuenta el gasto de ese proveedor y la cuenta **sigue viva**
con el modo que tenga. `422113` pasó de `excluida` a `promedio_n` con
`cuits_excluidos = {33707366589}` — mismo resultado hoy ($0 para presupuestar), pero un
proveedor nuevo se presupuesta solo.

**Y se ve de qué se compone cada cuenta.** Al abrirla aparecen sus proveedores con total, meses
y facturas, cada uno con un tilde para sacarlo del presupuesto. Es información que sirve más allá
de este caso: es justo lo que decide qué modo le conviene a la cuenta (un proveedor con factura
mensual → propagar la última; veinte proveedores → promedio). Avisa además si queda un **CUIT
excluido sin facturas**, que es una exclusión colgada.

Verificado en `scripts/verificar-presupuesto-cuentas.ts`: con dos aseguradoras, excluir el CUIT
deja la cuenta presupuestando a la otra; excluir la cuenta la borraría.

Otras cuentas de seguros: `4217 SEGUROS CULTIVO` (Sancor) ya sale excluida por ser `421*`
= agricultura, que va por Actividades y costos. No hay otra cuenta de seguros con facturas.

**C-18** — dejar un chequeo automático que cruce CUIT de templates contra CUIT de facturas y
avise si aparece un cruce nuevo. Hoy se detectó a mano.


#### 📈 CONTROL DE SUBAS DE PROVEEDORES vs IPC `B-FEAT-CONTROL-PROVEEDORES` 🟡
*(2026-07-30, sin testear)*

> *"analizar el ritmo de subas que viene teniendo y en comparación con el IPC… tal vez en vez
> de ser algo individual puede aplicar a todos los proveedores que nos llega factura mensual,
> que debería ser siempre igual y aumentar como máximo por IPC."*

Panel en **Presupuesto → "Subas de proveedores"**. Export **Excel** (resumen + detalle mensual)
y **PDF** apaisado.

##### La decisión de fondo: NO se mide mínimo contra máximo
Sería lo obvio y da cualquier cosa, porque **el monto de una factura mezcla precio y cantidad**
y sólo el precio se compara con el IPC. Con los datos reales:

| Proveedor | Mín→Máx | Qué es en realidad |
|---|---|---|
| AUTOPISTAS URBANAS | +160 % | no aumentó: se viajó más |
| ALCORTA (veterinaria) | +690 % | no aumentó: se compró más |
| FEDERACIÓN PATRONAL | +12.295 % | pólizas distintas |
| MEDICUS | +23 % | **esto sí es un aumento de precio** |

Entonces:
- se mide **primero contra último** (la tendencia), no dos outliers cualesquiera;
- se cuenta **cuántas veces bajó**. Un abono sube en escalones y casi nunca baja; un consumo
  rebota. Ésa es la señal que separa precio de volumen.

Los de volumen igual se listan, marcados como *"varía por consumo"* y sin semáforo: el número
está, la conclusión no se saca sola. Se pueden esconder con un tilde.

##### Cómo se lee
`suba total` (punta a punta) · `suba mensual equivalente` · `IPC acumulado del mismo período` ·
**brecha** en puntos. Semáforo: en línea (≤5 pts) · por encima · muy por encima (>20 pts).
Al abrir un proveedor: la serie mes a mes con la variación de cada mes contra el IPC de ese mes.

**El mes en curso no entra**: está a medio facturar y arruinaría justo la punta que importa.

**Si falta IPC no se inventa la comparación.** `ipcAcumulado()` devuelve `null` cuando la serie
tiene huecos — un acumulado calculado con meses faltantes queda corto y haría ver a *todos* por
encima del IPC. Hoy `public.indices_ipc` está **vacía**: el panel muestra las subas igual y avisa
dónde cargarlo (Precios y TC, columna IPC = variación mensual en %).

Motor en `lib/proveedores/control-subas.ts`. Verificador:
`npx tsx scripts/verificar-control-proveedores.ts` — 13 checks con los casos reales, incluido que
Autopistas (+22 %) NO se marque como aumento por bajar 3 de 7 meses.

##### Pendiente
**C-15** — el análisis usa sólo `msa.comprobantes_arca` (dic-2025 en adelante). Podría extenderse
al histórico para tener 13 meses en vez de 8, pero el histórico no trae CUIT normalizado del
mismo modo; hay que verificarlo antes.

---

#### 🔄 CORRECCIONES a lo escrito antes *(el usuario, 2026-07-30)*

##### 1 · El objetivo del presupuesto es el saldo, no la composición
Yo había escrito *"la composición es justo lo que estás presupuestando"*. **Está mal.**

> *"el objetivo del presupuesto es el análisis económico y financiero más allá de en qué se
> gastó. Si debe ser prolijo, pero si el saldo a fin de mes proyectado es 1000 y sale 1000 el
> presupuesto es un éxito más allá de estar mejor compuesto en sus partes. Para el análisis de
> los gastos realizados tenemos los subdiarios y ahí no hay error."*

El criterio de éxito es **el saldo proyectado**. La composición es un medio, no el fin — y para
mirar el gasto en detalle ya están los subdiarios, que son exactos.

**La recomendación no cambia, el motivo sí.** Sigue siendo *facturas para presupuestar, canales
para controlar*, pero no porque la composición sea el objetivo. Es porque **no se puede proyectar
un canal**: "banco" no es un concepto que crezca con el IPC ni que dependa de una decisión
productiva. Se proyectan conceptos (la luz, el veterinario, el asesor) y después caen en un
canal. El canal es el lado real, no el proyectado.

Y con el objetivo bien planteado, **el control por canales sube de prioridad** (C-11): si lo que
importa es que el saldo cierre, la cobertura total pesa más de lo que yo le había dado. La brecha
entre pagado y facturado es exactamente el error del saldo.

##### 2 · Templates y cuentas contables NO se pisan — verificado
Yo había marcado un riesgo sistémico de doble conteo. **El usuario tenía razón**: los templates
son, por definición, lo que **no** tiene factura.

Verificado contra los datos: los 66 templates activos de MSA tienen `codigo_contable` en
`"No lleva"` / `"Desglosar"` / `"CTA MA"` / `null`. **Ninguno** mapea a una cuenta con facturas
imputadas. El cruce por cuenta da cero solapamiento.

**La excepción, una sola y concreta:** cruzando por **CUIT** aparece
**FEDERACIÓN PATRONAL SEGUROS** como templates *Seguro Flota* y *Seguro Accidentes de Trabajo*
**y además** con 12 facturas ($7,77 M) en `SEGUROS ESTRUCTURA` (422113). Ese sí se contaría dos
veces. No es un problema de arquitectura: es un caso para revisar con el usuario — probablemente
el seguro deje de necesitar template ahora que llega por factura.

→ **C-16**: revisar Federación Patronal (¿template o factura?) y dejar un chequeo por CUIT que
avise si vuelve a pasar.

##### 3 · Templates sin cuotas — el hueco real
> *"para estos habría cuotas, y si no hubiera cuotas se presupuestaría? recuerda que muchas
> veces me dijiste de no poner datos estimados en templates salvo raros casos ya que en
> presupuesto usaría su lógica."*

Exacto, y ése es el criterio correcto: **el dato firme vive en el template, la estimación vive
en el Presupuesto.**

Los datos muestran que el hueco es real. Cuotas cargadas por mes:

| jul-26 | ago-26 | sep-26 | oct-26 | nov-26 | dic-26 | ene-27 |
|---|---|---|---|---|---|---|
| 30 · $61,4 M | 16 · $2,3 M | 54 · $12,8 M | 14 · $3,6 M | 36 · $18,9 M | 33 · $9,2 M | 2 · $0,55 M |

La cobertura es **despareja** (ago tiene 16 cuotas contra 54 de sep) y **se corta en dic-2026**.
Un presupuesto a 24 meses que lea sólo cuotas muestra los últimos 12 meses casi vacíos, y eso no
es que no haya gasto: es que no está cargado.

→ **C-17**: donde el template se queda sin cuotas, el Presupuesto tiene que **proyectar con su
propia lógica** (los mismos modos que las cuentas contables: propagar la última cuota, promedio,
o el mismo mes del año anterior según la periodicidad del template). Sin escribir nada en el
template. Es la contracara de la regla de no cargar estimaciones ahí.


#### 📒 PRESUPUESTAR CUENTAS CONTABLES `B-FEAT-PRESUPUESTO-CUENTAS` 🟡
*(primera versión 2026-07-30, sin testear — leer el análisis antes de tocar nada)*

> *"hay distintos indicios de cómo es mejor en cada caso… si una cuenta se compone siempre de
> una fac de un proveedor simplemente se puede propagar esa FC… si es muy variada, la suma del
> último mes… si tiene estacionalidad, un año atrás más inflación… que sea versátil, yo poder
> cambiar la forma de presupuestarlo de un modo a otro."*

##### 1 · Lo que dicen los datos (relevado 2026-07-30)

**Cuánto hay**: 13 meses corridos, **jul-2025 → jul-2026**, 50 cuentas, $301 M.
`msa.comprobantes_historico` (jul→dic 2025) + `msa.comprobantes_arca` (dic-2025→jul-2026).

**Tres problemas que había que resolver antes de poder calcular nada:**

1. **La misma cuenta estaba partida en dos por las mayúsculas.** El histórico guarda
   `"Insumos veterinarios"` y ARCA `"INSUMOS VETERINARIOS"`: son la misma cuenta y quedaban
   como dos series de 6 meses en vez de una de 11. Pasaba con LUZ, GASTOS MEDICOS, ASESOR
   GANADERO, TELEFONOS y varias más. **La identidad es `nro_cuenta`, no el nombre.**
2. **85 filas de ARCA no tienen `nro_cuenta`.** Se resuelven por nombre contra
   `cuentas_contables` — verificado: las 85 resuelven sin ambigüedad.
3. **Las dos fuentes se solapan en dic-2025** (40 fc / $16,39 M en ARCA contra 44 fc /
   $16,48 M en el histórico: son las mismas facturas). Sumarlas duplicaba el mes.

Resuelto en la vista **`public.presupuesto_historia_cuentas`**: clave `nro_cuenta`, el
histórico manda donde existe y ARCA aporta desde ene-2026.

**Cómo se comporta cada cuenta** — de acá salen los modos:

| Cuenta | Perfil | Qué le sirve |
|---|---|---|
| ASESOR GANADERO | 1 prov, 1 fc/mes, escalones: 1.427k → 1.563k×3 → 1.633k×3 → 1.748k → 1.896k×2 → 2.067k×2 | **última factura** (el promedio queda siempre atrasado) |
| ASESORAMIENTO CONTABLE · LUZ · TELÉFONOS · GASTOS MÉDICOS | 1-2 prov, monto parejo | **última factura** |
| INSUMOS VETERINARIOS | 176k · 3.018k · 1.451k · **−28k** · 109k · 3.110k · — · 1.127k · 3.303k | **promedio** (propagar la última es una lotería) |
| REPUESTOS Y REPARACIONES | 21 proveedores, CV 115 % | **promedio** |
| IATF | 3 meses en 13, uno es nota de crédito | **por cabeza** o a mano |
| AGROQUÍMICOS · SIEMBRA · COSECHA · MAÍZ · ROLLOS | ya se presupuestan en Actividades | **excluir** |

##### 2 · Los modos

`lib/presupuesto/modos.ts`. Cada cuenta elige el suyo; sin elección se usa la **sugerencia
automática**, marcada con `(auto)` y con el motivo a la vista.

| Modo | Qué hace | Para qué cuenta |
|---|---|---|
| `ultima_fc` | Propaga la última factura + inflación | 1 proveedor, monto parejo |
| `promedio_n` | Promedio de los últimos N meses (default 3) | variadas, muchos proveedores |
| `estacional` | Mismo mes del año pasado + inflación × 12 | estacional — **necesita 12 meses** |
| `por_cabeza` | $/cabeza histórico × cabezas proyectadas | veterinaria, sanidad, sales |
| `manual` | Monto fijo | sin historia |
| `excluida` | No presupuesta, y dice por qué | lo que ya entra por Actividades |

**Regla de sugerencia**: excluida si es producción → por cabeza si es sanidad → última factura
si hay 1 proveedor, ≤2,5 fc/mes, CV ≤ 40 % y 6+ meses → si no, promedio. Menos de 3 meses, manual.

##### 3 · Las dos trampas de los datos (y por qué el motor las trata así)

**El mes en curso está a medio facturar.** Al 30/7/2026 julio tenía 29 facturas contra ~45 de
promedio. Si entra como "último mes" o al promedio, subestima todo. **Se excluye siempre.**

**Un mes sin factura no es un mes sin gasto.** LUZ no facturó en feb-2026 y en marzo aparece el
doble: la factura se corrió. Por eso el promedio **divide por los meses de la ventana**, no por
los que tienen factura. Con INSUMOS VETERINARIOS la diferencia es de 50 %:
$1.472.602 dividiendo por 6 contra $2.208.903 dividiendo por los 4 con factura.

Y la ventana **cierra en el último mes CERRADO**, no en el último con factura. Si una cuenta
dejó de facturar en mayo y estamos en julio, junio fue un mes de cero y tiene que pesar. Este
punto lo encontró el verificador: la primera versión cerraba en el último mes con dato e
inflaba el promedio un 35 %.

##### 4 · El control de cordura

Arriba del panel, siempre visible. No busca precisión, busca que **no se escape nada grande**:

- **El total se despegó**: presupuestado/mes contra el real de los últimos 6 meses cerrados.
  Avisa si la diferencia pasa el 35 %.
- **Una cuenta que gastó quedó en cero** — el olvido que más duele. Nivel alto si pesa más del
  3 % del total.
- **Una cuenta se despegó de su propia historia** (±60 %), pero sólo si además el monto pesa:
  una cuenta chica que se duplica no importa.

##### 5 · Dos maneras de armar el presupuesto — el planteo del usuario

> *"mientras no haya detalle de caja todo lo que va a caja es un egreso, ídem tarjeta… se saca
> la info de banco, echeqs endosados, caja y tarjeta. Lo bueno es que no se escapa nada, aun si
> el proveedor se olvidó de facturar. Lo malo es que se ensucia con las retenciones SICORE…
> luego se puede hacer por facturas recibidas y lo malo es que si hubo gastos sin factura se
> presupuesta mal."*

| | **Por canales de pago** (banco, echeq, caja, tarjeta) | **Por facturas recibidas** ← lo implementado |
|---|---|---|
| Cobertura | **Total**: nada se escapa, ni el gasto sin factura | Se pierde lo que no tiene factura |
| Imputación | Pobre: caja y tarjeta son una bolsa hasta que se detallan | **Buena**: cada factura trae su cuenta contable |
| SICORE | **Lo ensucia**: la retención sale de veterinaria y aparece como impuesto — dos cuentas mal | Limpio: la factura es por el total |
| Timing | Fecha de pago | Fecha de la factura |
| Datos hoy | Hay que armarlo | **13 meses ya listos y con cuenta imputada** |

**Mi opinión**: **facturas para presupuestar, canales para controlar.** Son preguntas distintas
y conviene no mezclarlas.

Presupuestar es decir *"cuánto va a costar la luz"*, y eso necesita saber **qué** se compró —
sólo la factura lo dice. La caja y la tarjeta, sin detalle, no se pueden imputar; y el SICORE
rompe el dato en el peor lugar: la retención de veterinaria aparece como impuesto, así que
**las dos** cuentas quedan mal (una de menos, otra de más). Un presupuesto construido sobre eso
te da un total correcto con una composición equivocada — y la composición es justo lo que se
presupuesta.

Pero la fortaleza de los canales es real y no se resuelve con facturas: **no se escapa nada**.
Ahí es donde sirve, y es exactamente el control que el usuario pidió: el total pagado por todos
los canales de un período contra el total facturado del mismo período. Si el pago supera a la
factura de manera sostenida, hay gasto sin comprobante y aparece como un número, no como una
sospecha. **El SICORE deja de molestar** porque en el total se compensa: lo que se le resta a
veterinaria se le suma a impuestos.

→ Propuesta: mantener el presupuesto por facturas (ya está) y agregar el control por canales
como **C-11**, un solo número por mes con su brecha. Es barato y cierra el agujero.

##### 6 · Pendientes de esto

**C-11 · Control por canales de pago** 🟡 — pagado total (banco + echeq + caja + tarjeta) contra
facturado total, por mes. Detecta el gasto sin comprobante. No para presupuestar: para controlar.

**C-12 · Cabezas proyectadas automáticas** 🟡 — hoy el modo `por_cabeza` toma dos números a mano
(cabezas del histórico y proyectadas). El rodeo por campaña ya está en `stock_ciclos` +
`calcularLineaTiempo`: se puede enganchar y que el gasto de sanidad siga solo a la evolución del
rodeo.

**C-13 · Estacionalidad real** 🟡 — hay 13 meses, así que el modo `estacional` casi no tiene con
qué (y jul-2026 está incompleto). Recién en 2027 va a haber dos años comparables. Mientras tanto
el modo existe y avisa que le faltan datos.

**C-14 · Templates** ⏸️ — este panel presupuesta **cuentas contables** (lo que viene por
factura). Los templates ya se proyectan por sus cuotas cargadas, que es información más firme
que cualquier estimación: no necesitan modos. Lo que sí falta es decidir **cómo conviven** —
hoy un gasto podría entrar por los dos lados. Ver la nota de doble conteo abajo.

##### ⚠️ Doble conteo — lo que hay que vigilar
El presupuesto de MSA junta ahora tres fuentes de egresos: **templates** (cuotas cargadas),
**cuentas contables** (este panel) y **actividades** (costos de producción). Un mismo gasto no
puede entrar por dos.

- Producción ya está resuelto: las cuentas `421*`, `42305*` y las del verdeo salen `excluida`
  con el motivo escrito.
- **Templates vs cuentas contables: verificado, NO se pisan** (2026-07-30). Los templates son
  por definición lo que no tiene factura: los 66 activos de MSA tienen `codigo_contable` en
  "No lleva" / "Desglosar" / null y ninguno mapea a una cuenta con facturas. El aviso anterior
  de riesgo sistémico estaba equivocado. **La única excepción real** es FEDERACIÓN PATRONAL
  SEGUROS, que está como 2 templates y además factura $7,77 M en SEGUROS ESTRUCTURA → ver C-16.


#### 🌾 FASE C — COSTOS PRODUCTIVOS ATADOS A LA VENTA `B-FEAT-COSTOS-PRODUCTIVOS` 🔴
*(planificado 2026-07-30, 0 código — leer esto entero antes de empezar)*

> *"cada decisión productiva conlleva gastos variables aparejados. cada venta presupuestada
> podría tener siempre un costo productivo adjudicado. cantidad de maíz a dar, concentrado,
> siembra de verdeos… lo más simple para empezar es maíz y concentrado. podría poner el stock
> que hay y calcule la dif a comprar. (…) tendremos que dejar asentado los parámetros de la
> recría y el engorde para poder simplemente decir este rodeo va a recría desde tal fecha a tal
> y el sistema sepa qué calcular de insumos. Así cargando la actividad se calculan los ingresos
> y costos, y es fácil de manejar."*

##### La idea en una línea
**La unidad de planificación es la ACTIVIDAD, no el insumo.** El usuario carga *"este lote hace
recría del 1/4 al 30/9"* y de ahí salen solos: la curva de peso, el consumo de maíz y
concentrado mes a mes, lo que falta comprar, y el egreso en el presupuesto. Nadie tipea kilos.

##### Lo que YA está construido (no rehacer)

| Pieza | Dónde | Estado |
|---|---|---|
| **Motor de ración** | `calcular()` en `components/analisis-productivo.tsx:150` | ✅ funciona, hay que **extraerlo a lib** |
| **Stock de insumos** | `productivo.stock_insumos` (categoria, producto, cantidad, costo_unitario, unidad) | ✅ tabla viva |
| **Movimientos** | `productivo.movimientos_insumos` (fecha, tipo, cantidad, costo, proveedor, cuit) | ✅ tabla viva |
| **Categorías** | `productivo.categorias_insumo` con `ambito` agrícola/ganadero/ambos | ✅ sembrada |
| **Motor de sanidad** | `ordenes_aplicacion` + `lineas_orden_aplicacion` (`dosis_cada_kg`, `peso_promedio_kg`) | ✅ **ya modela dosis por kg de peso vivo** |
| **Curva de peso** | `stock_lotes.peso_base_kg` + `ganancia_diaria_kg` + `fecha_peso` | ✅ |

El motor de ración es exactamente lo que hace falta, y es **por cabeza y por día**:

```
racKgDia  = pesoPromedio × racionPV        ← % del peso vivo
maizKgDia = racKgDia × maizPct
concKgDia = racKgDia × concPct
kg lote   = kgDia × días × cabezas
costo     = kg × precio
```

Como `pesoPromedio` y `días` **ya salen del lote**, el cálculo de consumo casi no necesita input
nuevo: sólo los parámetros de la actividad. Ése es el punto que hace barato todo esto.

##### Lo que falta

**C-1 · Extraer el motor a `lib/productivo/racion.ts`** ✅ **HECHO** — ver arriba
`calcular()` vive adentro de un componente de 1.367 líneas. Sacarlo a lib y que el análisis de
engorde lo importe. Si el presupuesto reimplementa la fórmula, en tres meses dan distinto y no
se va a saber cuál está bien. Es el mismo patrón de `lib/pagos/` y `lib/arrendamientos/calculo.ts`.

**C-2 · Tabla de parámetros por actividad** — `productivo.actividades` ✅ **HECHO** (el esquema final es el de arriba: los insumos son tabla hija, no columnas fijas)
Es el *"dejar asentado los parámetros de la recría y el engorde"*. Una fila por actividad:

| campo | ejemplo | para qué |
|---|---|---|
| `tipo` | `recria` / `engorde` / `pastoreo` | qué proceso es |
| `nombre` | "Recría verdeo invierno" | puede haber varias del mismo tipo |
| `racion_pct_pv` | 1,5 % | ración diaria como % del peso vivo |
| `pct_maiz` / `pct_concentrado` | 85 / 15 | mezcla |
| `ganancia_diaria_kg` | 0,5 | **la curva de peso sale de acá** (ver C-4) |
| `pct_mortandad` | 1 % | |
| `costo_ha` + `has_por_cabeza` | verdeo | sólo para actividades con superficie |

Defaults del análisis actual: ración 1,5 % PV · 85 % maíz · 15 % concentrado · maíz $270/kg.

**C-3 · Tramos: la actividad se le asigna al lote** — `productivo.lote_tramos` ✅ **HECHO**
`(lote_id, actividad_id, fecha_desde, fecha_hasta, orden)`. Varios tramos encadenados por lote
— recría y después engorde — que es **la misma "cadena de etapas" que ya existe** en el análisis
de engorde. Reusar ese concepto y, si se puede, la estructura.

**C-4 · 🔑 El tramo debe MANEJAR la curva de peso, no sólo el costo** ✅ **HECHO**
Hoy `stock_lotes.ganancia_diaria_kg` se tipea a mano y la actividad tendría su propia ganancia
esperada. **Son el mismo número y van a divergir.** Si divergen, el peso con que se factura la
venta y los kilos de maíz que se compran describen dos animales distintos.

→ Al asignar el tramo, la ganancia diaria del lote **sale del tramo**. El campo del lote queda
como override manual explícito (y marcado, como el `*` de precio arrastrado). Esto además le da
al usuario la segunda punta de input que pidió: cargar la actividad define ingreso **y** costo
de una sola vez.

**C-5 · Consumo MENSUAL, no total** ✅ **HECHO** dentro de `consumoMensual()`
El presupuesto es mensual, así que el consumo hay que integrarlo por mes: para cada mes, días
del tramo dentro de ese mes × kg/día al peso promedio **de ese mes** (el peso sube, la ración
sube con él). Devolver `Record<'YYYY-MM', { maiz_kg, conc_kg, ... }>`.

**C-6 · Diferencia a comprar** — *lo que pidió textualmente*
`a_comprar = consumo_proyectado − stock_actual`, contra `productivo.stock_insumos`. Dos avisos:
- **El maíz puede ser propio.** MSA produce maíz. Consumir maíz propio **no es una salida de
  caja**: es una venta que no se hace (costo de oportunidad). Mezclarlo con el maíz comprado
  infla los egresos y rompe el Cash Flow. Hay que separar `propio` de `a comprar` desde el
  principio — meterlo después es rehacer.
- **Falta la categoría Maíz**: hoy sólo existen `Alimento balanceado` y `Sal/Minerales` (ámbito
  ganadero) y ninguna tiene stock cargado. Sanidad sí está cargada y en uso.

**C-7 · Al presupuesto (EGRESOS)** — ✅ **decidido por el usuario 2026-07-30: NO es template, es línea derivada.** Falta sólo pintarla.
Una fila por actividad o por insumo, en el mes del consumo. **Decisión abierta, la misma que
quedó pendiente con el IIBB de arrendamiento**: si el costo tiene que verse en Cash Flow hay que
registrarlo en algún lado (template), y si no, es una línea derivada que sólo vive en el
presupuesto. Preguntarle al usuario antes de implementar — no asumir.

**C-8 · Enlace con el análisis de engorde** *(último, opcional)*
El usuario fue explícito: *"para enlazar si creemos bueno con esa otra parte, pero más que nada
por los conceptos"*. O sea **reusar conceptos ahora, decidir el enlace después**. C-1 ya captura
casi todo el valor. Un enlace real (que un estudio guardado genere tramos) recién tiene sentido
cuando C-2..C-6 estén andando y testeados.

##### ✅ C-1 y C-2 — HECHO 2026-07-30 (sin testear)

**Decisión del usuario que fijó la arquitectura** *(la respuesta a C-7, adelantada)*:
> *"costos directos debe ser algo que muta con la actividad propuesta. **no será un template ni
> nada así**. de acuerdo a la actividad se ponen los costos directos. así como para recría y
> engorde hay ciertos insumos y **rindes**, para cada actividad lo habrá. lógico que debe ser
> editable desde presupuesto los parámetros de cada actividad."*

**C-7 queda resuelto**: el costo directo **no se registra en ningún lado** — no es template, no
es factura esperada. Es una **consecuencia calculada** de la actividad que se decidió hacer.
Cambia la actividad, cambia el costo solo. Misma naturaleza que el IIBB de arrendamiento: línea
derivada que vive en el presupuesto.

**Corrección al plan original**: el borrador de C-2 tenía columnas fijas (`pct_maiz`,
`pct_concentrado`). Con *"para cada actividad lo habrá"* eso no sirve — cada actividad tiene sus
propios insumos. Pasó a ser **tabla hija**: una lista de ítems que el usuario arma. Recría son
dos renglones, engorde otros, y la actividad que se invente el año que viene tiene los suyos sin
tocar código ni migrar la tabla.

###### C-1 · Motor extraído — `lib/productivo/racion.ts`
`calcular()` salió de `analisis-productivo.tsx` (1.367 líneas) a lib; el componente ahora lo
importa. Fuente única: si el presupuesto reimplementara la fórmula, en tres meses dan distinto.
Se sumaron los primitivos `pesoPromedio()`, `pesoFinal()`, `racionDiariaKg()`.

⚠️ **Nombre heredado**: el campo `conversion` de la pantalla **no es conversión alimenticia**, es
la **ganancia diaria en kg** (`kgGanados = días × conv`). Es el mismo número que
`stock_lotes.ganancia_diaria_kg` y que `actividades.ganancia_diaria_kg`. Documentado en la lib
para que nadie lo interprete mal; renombrar la etiqueta de la pantalla queda pendiente.

###### C-2 · Actividades y costos — BD + lib + UI
**Tablas nuevas** (`productivo`, RLS abierta + grants como el resto del schema, **no** en el backup):

| tabla | qué guarda |
|---|---|
| `actividades` | `tipo`, `nombre`, **`ganancia_diaria_kg`** (el rinde), `racion_pct_pv`, `pct_mortandad`, `activo` |
| `actividad_insumos` | `concepto`, `modo`, `valor`, `unidad`, `momento`, `precio_unitario`, `categoria_insumo_id`, `producto` |

**Sembradas** con los defaults del análisis de engorde (Recría 0,5 kg/día · Engorde 0,7 kg/día ·
ración 1,5 % PV · maíz 85 % a $270/kg · concentrado 15 % a $745/kg). Son punto de partida, todo
editable.

**`modo` es la pieza central**: decide el cuánto **y** el cuándo, y con eso las tres familias de
costo entran en una sola tabla en vez de tres mecanismos distintos.

| modo | escala con | ejemplo |
|---|---|---|
| `pct_racion` | % de la ración diaria | maíz 85 %, concentrado 15 % |
| `kg_cabeza_dia` | kg fijos por cabeza y día | suplemento |
| `unid_cabeza_mes` | por cabeza y mes | sal, minerales |
| `unid_cabeza_evento` | por cabeza, puntual | vacuna |
| `dosis_cada_kg` | 1 dosis cada N kg de peso vivo | el modelo de `lineas_orden_aplicacion` |
| `monto_cabeza` / `monto_ha` / `monto_mes` | $ directos | flete · **verdeo** · alquiler |

`momento` (`diario`/`mensual`/`inicio`/`fin`) define dónde cae; cada modo trae su default.

**`consumoMensual()`** reparte el tramo mes a mes. El punto fino: **el consumo diario sube a lo
largo del tramo** porque la ración es un % del peso vivo y el animal engorda. Cada mes se calcula
con **su propio peso promedio** — usar el promedio de todo el período subestima el final y
sobrestima el arranque. Verificado: 200 cab de 220 kg del 1/4 al 30/9 van de 580 kg de maíz/día
en abril a 775 en septiembre.

**UI**: `components/configurador-actividades.tsx`, botón *"Actividades y costos"* en Presupuesto
al lado de *"Precios y TC"*. Parámetros y lista de conceptos editables inline, aviso si los
`% de la ración` no suman 100 %, y un **simulador** (cabezas · peso · desde/hasta · hectáreas)
que muestra el reparto mes a mes sin guardar nada — la forma más rápida de ver si un parámetro
quedó mal cargado.

**Verificador**: `npx tsx scripts/verificar-actividades.ts` — 9 checks (días que cierran, el maíz
que crece con el peso, los puntuales una sola vez, el verdeo escalando por hectárea y no por
cabeza).

###### Lo que sigue
**C-3** (tramos: atar la actividad al lote) → **C-4** (que el tramo maneje la curva de peso) →
**C-5** ya está resuelto dentro de `consumoMensual()` → **C-6** (stock y diferencia a comprar,
ojo maíz propio) → **C-8** (enlace con el análisis, opcional).

##### ✅ C-3 y C-4 — HECHO 2026-07-30 (sin testear)

###### C-3 · Tramos — `productivo.lote_tramos`
`(lote_id, actividad_id, orden, fecha_desde, fecha_hasta, hectareas, notas)`, con
`check (fecha_hasta > fecha_desde)`. **No está en el backup.** `actividad_id` va con
`on delete restrict` a propósito: borrar una actividad usada por un tramo tiene que fallar
fuerte, no dejar el tramo sin parámetros en silencio.

UI en el **modal del lote** (Productivo → Evolución Rodeo → editar lote): agregar/quitar tramos,
elegir actividad, fechas y hectáreas. Muestra la curva resultante y el costo de alimentación.
Avisa si dos tramos **se pisan** (`solapamientos()`) — el peso se calcula igual pero el costo
contaría los dos.

###### C-4 · La curva de peso sale del tramo 🔑
**El problema que resuelve**: `stock_lotes.ganancia_diaria_kg` se tipeaba a mano y la actividad
trae su propia ganancia esperada. Son el mismo número. Si divergen, el peso con el que se
factura la venta y los kilos de maíz que se compran **describen dos animales distintos**, y nada
avisa.

**La curva pasa a ser QUEBRADA, no una recta.** Con recría a 0,5 kg/día hasta octubre y engorde
a 0,7 después, el peso ya no es `base + días × ganancia`: hay que integrar tramo por tramo. Caso
verificado — 100 cab de 220 kg, recría 1/4→1/10 y engorde 1/10→1/1:

| | |
|---|---|
| Recta vieja (0,3 kg/día del lote) | 302,5 kg |
| **Curva quebrada** (183 d × 0,5 + 92 d × 0,7) | **375,9 kg** |

73 kg de diferencia por cabeza — y como el peso define la **banda de precio**, cambia también
el $/kg, no sólo los kilos.

**Precedencia** (`lib/productivo/tramos.ts`):
1. `ganancia_override = true` → manda la del lote y la curva vuelve a ser recta. Es el override
   manual explícito, con checkbox marcado en el modal.
2. Días cubiertos por un tramo → la ganancia de **esa actividad**.
3. Días sin tramo → la del lote (fallback), y la UI los muestra en ámbar como
   *"sin actividad asignada"*.

**Cómo se enchufó sin romper nada**: `pesoEstimado()`, `valuarLote()` y `valuarLoteConPrecios()`
de `lib/ganaderia/ciclo.ts` toman un parámetro **opcional** `curva?: CurvaPeso`, que es una
función `(fecha) => peso`. Se pasa como callback y no importando `lib/productivo/tramos.ts` para
**no armar un import circular** entre ganadería y productivo. Sin `curva` se comportan igual que
antes, así que ningún llamador viejo cambia de resultado.

Pasan la curva: `panel-lotes-hacienda` (lista, modal y total) y `tab-presupuesto`
(`cargarHacienda`). Es la misma en las dos pantallas, que era el requisito.

**El costo también arranca del peso real**: `tramosParaCosto()` le da a cada tramo su
`peso_inicial_kg` sacado de la curva, así que el tramo de engorde empieza en 311,5 kg (lo que el
animal pesa después de la recría) y no en los 220 del lote. Sin eso, la ración del engorde se
calcularía sobre un animal chico.

**Verificador**: `npx tsx scripts/verificar-tramos.ts` — 11 checks (curva quebrada, override,
huecos sin tramo, peso inicial encadenado, solapamientos).

###### Lo que sigue
**C-7** pintar la línea de costo en EGRESOS del presupuesto (ya decidido: es línea derivada, no
template) → **C-6** stock y diferencia a comprar (ojo maíz propio) → **C-8** enlace con el
análisis de engorde, opcional.

##### ✅ Tanda 2026-07-30 (b) — moneda, ciclo, % de lo producido, y dos bugs

**Pedidos del usuario mientras testeaba, todos resueltos:**

**1 · Moneda por ítem** — *"pesos por ha y dólar por ha deben estar"*.
`actividad_insumos.moneda` (`ARS` | `USD`). En USD el monto se pasa a pesos al **TC
presupuestado del mes de cada gasto**, con `resolverSerie` sobre `public.tipos_cambio` — la
misma serie con arrastre que usa el arrendamiento. Un ciclo de seis meses puede usar varios TC,
y la celda muestra en el tooltip cuál se aplicó. Si falta el TC de un mes el monto da $0 y la UI
lo avisa en vez de esconderlo.

**2 · `momento = 'ciclo'`** — *"una respuesta es ciclo. ej cultivo de soja: se sabe que se gastan
tantos dólares en el ciclo del cultivo"*. El monto pertenece al ciclo entero, no a un día ni a un
mes. Es el default de `monto_ha`.

**3 · `modo = 'pct_produccion'`** — *"el precio del costo se determina según % de lo producido"*
(cosecha, aparcería). Sale del `valor_produccion` del tramo. Sin ese valor da $0 y avisa; no
inventa un número.

**4 · `tipo = 'agricola'`** — no lleva ración ni ganancia diaria, así que esos campos **se
esconden** en vez de mostrarse vacíos. Un concepto nuevo en una actividad agrícola arranca con
los defaults útiles: por hectárea, en el ciclo, en USD.

###### 🐛 Bug — el input se reformateaba mientras se escribía
El usuario quiso cargar la ración de Engorde en **85 % maíz / 15 % concentrado** y quedó
**8 % / 10 %**. No fue error suyo.

**Causa**: el `value` del input se derivaba del estado y se re-formateaba en **cada tecla**. Al
tipear `8` el campo ya decía `8,00` con el cursor al final, así que el `5` siguiente caía en el
lugar equivocado. El mismo campo hacía imposible escribir cualquier número de dos dígitos.

**Fix**: `InputNumero` (en `configurador-actividades.tsx`) guarda el **texto crudo** mientras
está tocado y recién parsea y formatea al salir del campo. Lección general en `KNOWLEDGE.md`.

Efecto colateral del fix: el guardado ya no puede leer del estado, porque el commit y el guardado
pasan en el mismo tick. `guardarInsumo(i, cambios)` recibe los cambios explícitos.

###### 🐛 Bug — los costos "al terminar" nunca caían
`momento: 'fin'` (la cosecha) no aparecía nunca en un tramo que termina un día 1 — el caso normal
de un cultivo (oct → abr).

**Causa**: `esUltimo` se calculaba dentro del recorrido como `fin >= hasta`. En marzo `fin` es el
31/3, menor que `hasta` (1/4); y abril tiene **cero días** y se descartaba. Ningún mes quedaba
marcado como último.

**Fix**: `consumoMensual()` pasó a **dos pasadas** — primero arma los meses con días, después
calcula los costos con `esPrimero`/`esUltimo` por índice sobre la lista ya filtrada. Saber cuál
es el último exige tener la lista entera; calcularlo al vuelo era el error.

###### Otros ajustes
- **`unidad` no se pide de más**: con `% de la ración` ya se sabe que son kg, y un monto directo
  no tiene unidad. Era la fricción que reportó el usuario.
- **El simulador no asume que arranca hoy**: las fechas empiezan **vacías**. Se puede estar
  presupuestando la campaña que viene, y poner "hoy" por defecto es meter una suposición.
- **El simulador SÓLO MUESTRA**: no guarda ni crea tramos. Lo que se plasma en el presupuesto son
  los tramos del lote. Aclarado en pantalla.
- **Borrar una actividad en uso** ahora explica el motivo (la FK de `lote_tramos` es RESTRICT) en
  vez de mostrar el error crudo de Postgres.
- **`🐄 Venta de hacienda` es colapsable** en el presupuesto, con el mismo patrón que Nazarenas y
  Rojas, y muestra cuántas categorías tiene.

**C-9 · Cómo se distribuye el costo del CICLO en el tiempo** 🟡 *(abierto, 2026-07-30)*
> *"luego el ver cómo se distribuye en el tiempo tenemos que ver"* — el usuario.

Hoy `momento: 'ciclo'` **prorratea por días** sobre el tramo. El **total del ciclo queda bien**,
pero el mes a mes no: un cultivo no gasta parejo — la siembra y la cosecha son picos, y en el
medio hay meses casi sin desembolso. Para el Cash Flow eso importa.

Opciones a conversar: (a) una curva por tipo de cultivo (% del gasto por mes desde la siembra);
(b) partir el ítem en varios con `momento: inicio/fin`; (c) un campo de "mes del ciclo" por ítem.
La (b) ya se puede hacer hoy a mano y quizás alcance.

##### ✅ Tanda 2026-07-30 (c) — saldo acumulado, IIBB unificado, sub-agrupación

**1 · SALDO ACUMULADO** — *"debe estar el saldo acumulado de cada mes y no sólo el neto entre
ingresos y egresos mes x mes"*.
Fila nueva al pie, debajo de RESULTADO. Arrastra el resultado mes a mes desde un **saldo de
arranque**. Sin esto el presupuesto sólo dice el resultado de cada mes, que no alcanza para saber
si la caja da: un mes malo después de varios buenos no es lo mismo que ese mes con la caja en cero.

`public.presupuesto_config` (empresa, `saldo_inicial`, `mes_inicial`, notas) — **no está en el
backup**. Se carga a mano desde la propia fila (botón *"arranca en $X — editar"*).
**Provisorio y a propósito**: el usuario lo pidió así, *"por ahora para poner a mano y luego vemos
cómo emprolijamos"*. Lo natural sería derivarlo de los saldos bancarios reales → **C-10**.

`mes_inicial` guarda a qué mes corresponde el saldo. Los meses **anteriores** a ese muestran `—`
en vez de un número: no se puede acumular hacia atrás desde un saldo de otro momento. Es el aviso
de que el saldo quedó viejo cuando la grilla avanza.

**2 · IIBB en un solo renglón colapsable** — *"así como pusiste IIBB sobre venta de hacienda
habría que poner de arrendamiento. Renglón aparte y colapsable a un solo renglón de IIBB total"*.
`IIBB total` se abre en sus orígenes: venta hacienda · **arrendamiento (nuevo)** · ganadería.
Sólo aparecen los que tienen monto.

El de arrendamiento es **derivado igual que los otros**: 5 %
(`ALICUOTA_IIBB_ARRENDAMIENTO`) de la venta del mes, cobrado el mes siguiente. No se registra en
ningún template — sale de la venta, como el resto. Ya suma al TOTAL EGRESOS.

**3 · Sub-agrupación de templates por categoría** — *"impuestos rurales tiene mezclado inmob y
red vial. Tal vez una subagrupación con datos existentes sin crear nada nuevo"*.
Se usa `egresos_sin_factura.categ`, que **ya existe**: no se creó ninguna categoría ni columna.

**El criterio general** (aplicable a cualquier agrupador, que era el pedido):
sub-agrupar sólo si hay **2+ categorías** y **alguna junta más de un template**.

| agrupador | categs / templates | qué hace |
|---|---|---|
| Impuestos Rurales | 3 / 22 | **sub-agrupa** — 11 inmobiliarios + 10 red vial + 1 complementario |
| Impuestos General | 5 / 9 | **sub-agrupa** — ARCA 3, laborales 2, retenciones 2 |
| Gastos Bancarios | 7 / 7 | plano — una categ por template, anidar sería vacío |
| Impuestos Automotores | 1 / 4 | plano — una sola categoría |

`porCateg()` y `subAgrupa()` en `tab-presupuesto.tsx`.

**C-10 · El saldo de arranque debería salir de los bancos** 🟡 *(abierto, 2026-07-30)*
Hoy se tipea. Lo correcto sería tomar el saldo real de las cuentas a una fecha — el usuario ya lo
anticipó (*"luego vemos cómo emprolijamos"*). Ojo con el alcance: el presupuesto es sólo MSA y los
saldos son por cuenta bancaria; hay que decidir qué cuentas entran.

##### ✅ Export de caravanas para declarar — HECHO y **TESTEADO OK** (2026-07-30)

> *"quisiera un export de productivo para declarar las caravanas… un simple excel, machos por
> un lado y hembras por el otro… primero debo decirle qué categorías quiero exportar… si pongo
> las 3 me da una solapa por categoría… es importante borrar el espacio entre los primeros 3
> dígitos (empezando por el cero) y el resto, pero debe empezar con el 0 y no omitirlo por ser
> un nro."*

**Dónde**: Productivo → Terneros → **Descargar Excel**. El modal ahora pregunta primero **qué**
se baja — *Pesadas* (lo de siempre) o *Caravanas* (para declarar) — porque son dos archivos
distintos, no una columna más.

**Qué genera**: una **solapa por categoría** elegida, con `Caravana Oficial` y
`Caravana Interna`. Categorías: Ternero Recría · Torito · Ternera Recría · Ternera Reposición.

**El cero de la caravana** es el punto delicado. En la BD viene `"032 010012326481"`; para
declarar va sin espacio y **empezando con 0**. Si la celda se escribe como número Excel se come
el cero y queda `32010012326481`, que es **otra caravana**. Por eso se fuerza `t:'s'` y formato
`@` en la columna. Verificado escribiendo y volviendo a leer el archivo:
`scripts/verificar-caravanas.ts` (15 checks).

**Qué queda afuera, a propósito**: las bajas (no se declaran) y los activos **sin caravana
oficial cargada** — una fila vacía en un archivo de declaración no sirve. El modal dice cuántos
son y lista sus caravanas internas para poder completarlos. Con los datos de hoy son **9**:
8 toritos y 1 ternera de recría.

**`lib/productivo/caravanas.ts`** — `normalizarCaravana()` + `categoriaDeTernero()`.
Esta última es ahora el **único lugar** donde se interpreta `es_torito`, que está sobrecargado:
en un macho significa "torito", en una hembra "ternera retenida para reposición". Tenerlo escrito
en varios lados ya causó un bug (una hembra marcada aparecía como Torito y se contaba dos veces).
`lib/ganaderia/disponibilidad.ts` pasó a usarlo.

##### Tres familias de costo — no se calculan igual
No forzarlas al mismo molde; cada una tiene su unidad:

| familia | escala con | ejemplo | motor |
|---|---|---|---|
| **por cabeza-día** | cabezas × días × peso | maíz, concentrado | ✅ `calcular()` |
| **por cabeza-evento** | cabezas × dosis (a veces por kg) | vacunas, antiparasitarios | ✅ `lineas_orden_aplicacion` |
| **por hectárea** | superficie, **no** cabezas | siembra de verdeos | ❌ falta |

El verdeo es el que rompe el patrón: es un costo fijo por hectárea que después se reparte entre
las cabezas que lo pastorean. Dejarlo para el final y **no** intentar expresarlo como $/cabeza/día
hasta tener el caso claro.

##### Orden sugerido
~~**C-1** (extraer motor) → **C-2 + C-3** (parámetros + tramos) → **C-4** (curva de peso desde el
tramo) → **C-5** (mensualizar) → **C-6** (stock y diferencia, con propio vs comprado) →
**C-7** (presupuesto, previa decisión) → **C-8** (enlace, si vale la pena).~~

**Estado 2026-07-30: C-1..C-5 y C-7(decisión) hechos. Queda C-7 (pintar la línea), C-6 (stock y diferencia a comprar) y C-8 (enlace, opcional).**

Arrancar por maíz y concentrado, como pidió. Sanidad después: el motor está pero es otra unidad.

##### Deuda que este plan roza
- `productivo.stock_insumos` tiene **stock negativo** (`Fasiolisida −216 ml`): hay consumos sin
  la compra correspondiente. No es bloqueante para planificar, pero si C-6 lee ese stock para
  calcular la diferencia a comprar, la va a calcular de más. Revisar antes de C-6.

##### 🔑 Dos principios de arquitectura (pedidos por el usuario, 2026-07-30)

**1 · Las series de precios ARRASTRAN HACIA ADELANTE** — `lib/precios/serie.ts`
> *"pongo algunos precios actuales y quiero que los otros meses se propaguen hasta el próximo
> input. Si algo se mueve de mes ya tiene el precio."*

El valor de un mes es **el último cargado hasta ese mes**. Alcanza con cargar los meses donde el
precio cambia. Si el mes es previo a toda la serie se toma el primero hacia adelante, para que
no quede en cero.
```
ene  feb  mar  abr  may  jun          ene  feb  mar  abr  may  jun
100   ·    ·   120   ·    ·     →     100  100  100  120  120  120
```
**Regla única para TODAS las series**: precios de granos, precios de hacienda, TC e IPC.
`resolverSerie()` es la implementación; `resolverPrecio`, `resolverTC` y `resolverPrecioHacienda`
la usan. ⚠️ Cambió el comportamiento de granos: antes tomaba el **siguiente** mes cargado.

**2 · Dos puntas de input para el mismo dato**
> *"desde presupuesto también pueda alterar las cifras de las ventas o los lotes. Como muchas
> cosas en este sistema, muchas veces tiene dos puntas para input."*

El precio se carga en **Presupuesto**; el *cuándo se vende* en **Productivo**; y desde
**Presupuesto** se debe poder tocar la venta también. Igual que el arrendamiento, donde el modal
de Presupuesto escribe sobre la cuota de Ventas.

**Cómo se sostiene**: la lógica de mutación vive en `lib/`, no en el componente. Cualquier
pantalla llama la misma función y escribe en la misma tabla — nunca hay copia ni sincronización.
Al agregar una pantalla que edita algo existente, **extraer primero la función a `lib/`**.

##### Datos que faltan del usuario
- **Plazo de cobro** típico de hacienda (en arrendamiento fueron 15 y 20 días por cliente).
- Si los **toritos** se venden en algún momento o son sólo reposición.
- Cuántos **toros de refugo** por año, peso y precio.

#### ⏳ FALTA en ganadería
- **Venta de vaca de descarte**: la categoría y el precio ya están, pero **no hay línea** en la
  proyección. Falta cuántas por año, peso y precio.
- **Plazos de cobro**: hoy se carga la fecha de cobro directo. El usuario dijo "hay plazos" pero
  no cuáles — en arrendamiento esto terminó siendo `dias_cobro_disponible` por contrato.
- **Roll-forward del stock** (marzo 28 = stock − descartes + reposición; marzo 29 = ídem):
  hoy los vientres se tipean por campaña. `productivo.stock_hacienda` sigue **vacía y sin
  dimensión temporal**.
- **Ganadería en `ventas_unificadas`** → hoy no llega a Cash Flow (sí a Presupuesto).

---
---

## <a id="a-test-28"></a>A-TEST-28 — Libro IVA Ventas: export igualado a Compras (2026-08-13)

Cierra la parte de **export** de [B-FEAT-06](#), que estaba esperando desde el 2026-06-10 a que el
usuario explicara las diferencias.

### Lo que era distinto, y cómo quedó

| | Antes (Ventas) | Ahora (= Compras) |
|---|---|---|
| Disparo | 2 botones, `Excel` y `PDF` | **1 botón** "📊 Generar PDF + Excel (N)" |
| Datos | el array pintado en pantalla | **re-consulta a la BD** del período |
| Carpeta | ninguna, siempre Descargas | prompt de 3 opciones + carpeta recordada |
| Nombre | `LIBRO IVA VENTAS MSA 2025-12.xlsx`, **pisaba** el anterior | `LIBRO IVA VENTAS MSA 25-12.xlsx` + ` (1)`, ` (2)` |
| PDF: encabezado | sólo "Período MM/AAAA" | razón social + CUIT + **rango de fechas** + fecha de generación + total |
| PDF: fila TOTALES | no había | sí |
| PDF: página 2 | no había | **Desglose por Alícuotas** + los 2 bloques |
| Cálculo | **3 copias** (pantalla, Excel, PDF) | 1 función compartida |

### Los 4 archivos nuevos, y por qué son 4 y no 1

| Archivo | Qué centraliza |
|---|---|
| `lib/subdiarios/subtotales.ts` | el resumen en 2 bloques + el desglose por alícuota |
| `lib/subdiarios/carpeta-destino.ts` | elegir carpeta, nombre único, guardar |
| `lib/subdiarios/cuadratura.ts` | el control (A-TEST-27) y las listas de tipos |
| `hooks/useCarpetaPorDefecto.ts` | la carpeta recordada en localStorage |

El comportamiento del selector de carpeta **no se cambió**: se movió tal cual, incluido el
`prompt()` de 3 opciones, porque es el que el usuario ya tiene aprendido en Compras. Ahora que está
en un solo lugar, cambiarlo por un modal mejora las dos pantallas de una vez.

### Lo que NO pudo quedar idéntico, y por qué

`comprobantes_venta` no tiene `otros_tributos`, ni `tipo_cambio`, ni columnas por tasa
(`iva_21`, `neto_grav_iva_21`, …) — sólo un par `alicuota_iva` + `iva` por comprobante. Entonces:
- **no hay columna Otros Tributos** (tampoco en el control de cuadratura);
- **no hay conversión USD→$**;
- el **Detalle por Alícuotas se agrupa** por `alicuota_iva` en vez de sumar columnas fijas;
- **no se copió el par "IVA 21% / IVA Diferencial"**. Decidido con el usuario: como se vende
  mayormente exento y al 10,5 %, esa columna quedaría casi siempre vacía y el 10,5 % entero caería
  en "Diferencial". *(Al margen: "IVA Diferencial" = todo el IVA que no es 21 % — es una convención
  de esta app, no de ARCA, que lleva una fila por alícuota.)*

### De paso: la razón social ya no está hardcodeada

El PDF de Compras escribía "MARTINEZ SOBRADO AGRO SRL / 30-61778601-6" **aunque estuvieras en PAM o
MA**, y el de Ventas imprimía el literal `'CUIT MA'`. Ahora sale de `DATOS_FISCALES` en
`lib/empresas.ts`. ⚠️ **Falta el CUIT de MA** — no está en ningún lado del repo; hasta que el usuario
lo dé, el encabezado de MA sale sin CUIT (mejor que uno inventado en un libro de IVA).

**Testear** → 6 pasos en `MANUAL-USO.md` § *Export del Libro IVA (Compras y Ventas)*.

---

## <a id="a-feat-27"></a>A-FEAT-27 — Subdiarios por empresa: qué falta para que MA y PAM estén completas

**El pedido (2026-08-13):** *"MA tendrá su subdiario de compras y ventas, como PAM también"*.

### Estado real relevado ese día

| | Tabla en BD | Tab en la app | Filas |
|---|---|---|---|
| **Compras** MSA | ✅ `msa.comprobantes_arca` | ✅ | 390 |
| **Compras** PAM | ✅ `pam.comprobantes_arca` | ✅ | 4 |
| **Compras** MA | ✅ `ma.comprobantes_arca` | ✅ | 92 |
| **Ventas** MSA | ✅ `msa.comprobantes_venta` | ✅ | 6 |
| **Ventas** MA | ✅ `ma.comprobantes_venta` | ✅ | **0** |
| **Ventas** PAM | ❌ **no existe** | ❌ | — |

**Compras ya está completo en las 3.** Lo que falta es ventas.

### ✅ Resuelto el 2026-08-13

El usuario aclaró: **PAM y MA facturan sólo arrendamiento, Factura C — “no hay ni exento ni nada, es
sólo factura con el total”.**

1. **`pam.comprobantes_venta` creada** — clon exacto de MSA (`LIKE … INCLUDING ALL`) + GRANTs + RLS.
   Se clonó **entera** aunque la mitad de las columnas queden en null: son nullables y no molestan,
   mientras que una tabla magra obligaba a bifurcar importador, modal y subdiario. Las tres empresas
   corren el mismo código.
2. **Tab "Subdiarios PAM"** agregado en `vista-ingresos.tsx`.
3. 🐛 **Hallazgo:** a `ma.comprobantes_venta` le faltaban **4 columnas** que sí tiene MSA
   (`moneda`, `estado`, `fecha_cobro_estimada`, `centro_costo_id`). El importador inserta las tres
   primeras → **importar a MA habría fallado**. Y `estado` + `fecha_cobro_estimada` son las que hacen
   que una venta llegue al **Cash Flow** ("nace a cobrar"): sin ellas, las ventas de MA/PAM nunca
   habrían alimentado la proyección. Niveladas.

DDL completo → `RECONSTRUCCION_SUPABASE_2026-01-07.md` § CAMBIOS POST-RECONSTRUCCIÓN 2026-08-13.

### 🚧 Lo que sigue abierto
- **MA y PAM tienen 0 comprobantes de venta** — el usuario dijo que se importarán pronto.
- **La clasificación Fac C** → ver [A-DEC-02](#a-dec-02). Es la que decide si su Libro IVA Ventas
  muestra algo o sale en cero.
- **Arrendamientos no crea el comprobante.** `ventas_arrendamiento` tiene la columna
  `comprobante_id`, pero **nadie la escribe**: la fijación no genera la factura en
  `comprobantes_venta`. Hoy los contratos ya se pueden marcar MSA/PAM/MA (el selector existe) pero
  los 4 cargados son MSA. Ése es el vínculo que haría que el arrendamiento de PAM/MA aparezca solo
  en su subdiario en vez de cargarse a mano.

### ✅ Lo que ya se hizo (A-TEST-29)

- `VistaSubdiariosVenta` y `ModalComprobanteVentaMsa` aceptan **PAM** y derivan el schema de la
  empresa (`empresa.toLowerCase()`), en vez del `=== 'MA' ? 'ma' : 'msa'` que mandaba a MSA
  cualquier cosa que no fuera MA — el clásico bug silencioso de escribir en el schema equivocado.
- El **importador de ventas ya no está fijo en MSA** (ver A-TEST-29).

---

## <a id="a-bug-25"></a>A-BUG-25 — El CUIT de Sanpa está mal en 3 filas (2026-08-18)

**Cómo apareció.** El usuario: *"tengo 2 facturas de Sanpa posibles de vincular… me propone sólo una
y no la otra, que es la correcta"*. No era la pantalla: **son dos CUIT distintos.**

| CUIT | Dónde vive | Verificador | |
|---|---|---|---|
| `30712200662` | `contratos_arrendamiento` Rojas **26/27** y **27/28** + `msa.comprobantes_venta` del **11/05** ($95.715.830,32, sin nº, cargada a mano) | debería terminar en **5** | ❌ **inválido** |
| `30712200622` | `msa.comprobantes_venta` del **22/07** (nº 00010-00000021, $78.262.800) — **importada de ARCA** | termina en **2** | ✅ **válido** |

**La prueba que lo cierra:** la venta del contrato de Rojas vale **$78.262.800,00**, *exactamente* el
importe de la factura de julio. La de mayo ($95,7 M) no tiene nada que ver con esa venta.

**Por qué la alerta ofrecía la equivocada:** matchea por CUIT. El contrato tiene el CUIT malo, así
que la única factura que compartía ese CUIT era la de mayo. La de julio —la correcta— **no aparecía
nunca, y sin ninguna explicación**: el clásico modo de falla de este proyecto, el silencio que miente.

### 📄 Resuelto con el PDF de la factura (2026-08-18)

El usuario aportó el original: `…/2025-2026/26-05/- Ventas/05-12 - Sanpa Campaña 25-26 - Cuota 3 de 3.pdf`.
**La factura de mayo es real y es de otra campaña** — no era una carga de prueba:

> Factura **A**, Pto Vta **00010**, Comp. Nro **00000020**, emitida **11/05/2026**,
> SANPA SEMILLAS S.A. CUIT **30712200622**, concepto *"Arrendamiento Agrícola Campaña 2025/26 —
> Cuota 3 de 3"*, **Importe Exento $95.715.830,32**, IVA $0, CAE 86195177307570.

**Por eso los importes no cerraban:** la de mayo es la **última cuota de la campaña 25/26**; la venta
contra la que se ofrecía es el contrato de Rojas **26/27**. En la alerta corresponde **"No, es otra
cosa"**. La que sí es del 26/27 es la de julio (nº 00010-00000021, $78.262.800 — al peso).
⚠️ No hay contrato cargado de la campaña **25/26**, así que la de mayo queda sin venta a la cual
vincularse, y está bien que así sea.

**El PDF también confirma que el CUIT bueno es `30712200622`**: los tres lugares con `...662` son
carga manual, ninguno viene de ARCA.

### ✅ Datos corregidos el 2026-08-18 (con autorización expresa del usuario)
1. `contratos_arrendamiento` Rojas **26/27** y **27/28** → `cliente_cuit = 30712200622`. ✅ 2 filas.
2. `msa.comprobantes_venta` `3e885754` (la de mayo) — **3 campos**; el resto ya estaba bien
   (fecha, tipo, punto de venta **10**, número **20**, importes y concepto coinciden con el PDF): ✅
   - `cuit_cliente` → `30712200622`
   - `nro_comprobante` → `'00010-00000020'` (estaba en null)
   - `alicuota_iva` → `null` — decía **21,00** sobre una factura **Exenta**: era
     [A-BUG-23](#a-bug-23) otra vez. **Segunda fila afectada por el default de 21** → confirma que
     el modal era la causa. El código ya está arreglado; el dato viejo no se arreglaba solo.

### ✅ La 4ª fila: el CUIT malo también estaba en el maestro `proveedores` — corregido
`public.proveedores` tenía a *Sanpa Semillas SA* con `30712200662`. **Es el peor lugar donde podía
estar**: de ahí salen CBU, mails, mensajes de transferencia y el **pre-filtro por CUIT del motor de
conciliación** (CLAUDE.md § Contrapartes). Apareció recién al verificar los otros tres.

Chequeado antes de tocarlo: la PK es `id` (uuid), `cuit` sólo tiene UNIQUE, y **ninguna tabla
referencia `proveedores` por FK** → sin conflicto de unicidad ni cascada.

```sql
UPDATE public.proveedores SET cuit = '30712200622' WHERE cuit = '30712200662';
```
**✅ Corrido el 2026-08-18** con autorización del usuario. **Los 4 lugares quedaron en
`30712200622`**, verificado por consulta.

### 📌 Lo que este bug deja como aprendizaje

**Un CUIT mal tipeado no se nota.** Parece un número correcto, entra en la BD, y después rompe los
matches **en silencio** — la alerta ofrecía la factura equivocada y la correcta no aparecía nunca,
sin ninguna explicación.

Por eso salió `lib/cuit.ts`: **validación por dígito verificador (módulo 11)**. Un CUIT inválido es
**siempre** un error de carga, así que detectarlo es barato y certero. `...662` da 5 y termina en 2
→ inválido; `...622` da 2 → válido. Conviene usarlo en toda alta que reciba un CUIT a mano.

### ✅ Hecho: que no vuelva a pasar en silencio (A-TEST-30)
- **`lib/cuit.ts`** (nuevo): validación por dígito verificador módulo 11, formateo y comparación.
  Un CUIT inválido es **siempre** un error de carga, así que detectarlo es barato y certero.
- **`alertas-fc-venta.tsx`**: segundo camino de match. Si el CUIT no coincide pero **el importe cierra
  exacto** con lo que falta facturar, la factura se ofrece igual — en ámbar, primera en la lista, con
  los dos CUIT enfrentados y marcando cuál tiene el verificador inválido. Y avisa que vincular
  **no corrige el CUIT**: hay que arreglarlo en el contrato o el problema vuelve.

**Testear:** entrar a la pantalla de inicio. Tienen que salir **las dos** facturas de Sanpa: la de
mayo (match por CUIT, normal) y la de julio en ámbar, diciendo que `30712200662` es inválido.

---

## <a id="a-bug-27"></a>A-BUG-27 — El Cash Flow contaba la misma plata tres veces (2026-08-18)

**Detectado por una nota del usuario desde la app** (*"Anticipos de ventas. Ej Sanpa"*): *"antes de
vincular el anticipo veo esto de Sanpa en cash flow. ¿es correcto?"*. No lo era.

Para **un** cobro de $78.262.800, el Cash Flow proyectaba **$181.179.054** en 4 filas:

| Fila | Monto | Qué es | Cómo deja de contar |
|---|---|---|---|
| VENTA sin factura — arrendamiento Rojas | $78.262.800 | la **fijación** | al decir "Sí" en la alerta de inicio (sube `facturado`) |
| VENTA — FC 00010-00000021 | $71.611.134 | la **factura** de esa fijación | al pasar a `conciliado` |
| ANTICIPO COBRO | $31.305.120 | la **1ª transferencia** | al vincularlo ([A-TEST-32](#a-test-32)) |
| VENTA — FC 00010-00000020 | $95.715.830,32 | otra cosa: campaña 25/26 | — |

**Las tres salidas existían y ninguna se había podido ejercer**: la de la fijación porque la alerta
ofrecía la factura equivocada ([A-BUG-25](#a-bug-25), CUIT mal tipeado), la del anticipo porque no
había botón ([A-TEST-32](#a-test-32)).

### Lo que faltaba, y era del cambio del día anterior

`mapearVentas` calculaba `imp_total − retenciones` y **no restaba los anticipos de cobro
vinculados**. En compras eso no hace falta porque al vincular se reduce `monto_a_abonar` de la
factura; **`comprobantes_venta` no tiene esa columna**, así que la factura seguía mostrando el neto
completo incluso después de vincular. O sea que el doble conteo **sobrevivía a la vinculación**.

Arreglado: el mapa pasa a llamarse `imputadoPorComp` y suma **retenciones + anticipos de cobro
vinculados**, sea cual sea su estado (`parcial` o `vinculado`) — si está imputado a la factura, ya
no es un ingreso pendiente de ella.

Con los datos reales: la FC de julio pasa de mostrar **$71.611.134** a **$40.306.014** en cuanto se
vincule el anticipo, que es exactamente la 2ª transferencia.

⚠️ **`npm run build` dijo "Compiled successfully" con 2 errores de tipos adentro** (el rename dejó
una referencia colgada). Lo agarró `type-check:diff`. Es el motivo por el que ese script existe.

---

## <a id="p-44"></a>P-44 / P-45 — Notas desde la app: las capturas llegan vacías (2026-08-18)

Primer uso real de las notas (P-34) para reportar, y salieron **dos fallas de la herramienta misma**
más un hallazgo:

**P-44a — las capturas están vacías.** Las 3 filas de `notas_capturas` tienen `length(imagen) = 0`.
El texto, la pantalla y la ruta sí se guardan. Sin la imagen, Claude contesta a ciegas: en la nota de
Sanpa el usuario mencionó **4 filas** y sólo se pudieron deducir 3 leyendo el código — la cuarta
(la fijación del arrendamiento) apareció recién cuando él avisó que faltaba una.

**P-44b — con un modal abierto la herramienta no se puede usar.** Textual del usuario:
*"lo único, si salen modales esto no lo puedo usar"*. Es el peor momento para perderla: los modales
son justamente donde aparecen los errores que se quieren reportar.

**P-45 — hallazgo de la nota "Fecha de pago"**: al pasar una factura de Longo de *pagar* a *pagado*,
pregunta si se quiere cambiar la fecha **aunque `fecha_pago` ya sea la de hoy**. Confirmación
innecesaria en el camino más frecuente.

> 🔒 Recordatorio del protocolo: **una nota no es un pendiente, es bandeja de entrada.** Termina como
> ítem con ID acá o descartada con motivo, y se marca `estado='leida'` con el `resultado`.

---

## <a id="a-test-32"></a>A-TEST-32 — Anticipos de cobro vinculables a facturas de venta (2026-08-18)

**El caso.** Una factura de venta cobrada con **2 transferencias + 2 retenciones**, y el usuario
quería *"chequear que el cobro está ok sin conciliar todo el banco"*.

**El hallazgo.** `anticipos_proveedores` guarda **las dos puntas**: la columna `tipo` distingue
`pago` (compras) de `cobro` (ventas). El nombre de la tabla engaña. Cash Flow **ya sabía crear**
anticipos de cobro (`vista-cash-flow.tsx`, radio Pago/Cobro), pero
`hooks/useVinculacionAnticipo.ts` buscaba candidatas **sólo en `msa.comprobantes_arca`** — 5
consultas, ninguna a ventas. Resultado: se creaban y **quedaban colgados en `pendiente_vincular`
para siempre**. El de BALLESTER (*"Venta 4 Vacas"*, $2.625.480) llevaba **4 meses** así.

⚠️ Nota de método: primero se afirmó que "no existen anticipos de cobro" tras buscar sólo **nombres
de tabla** con `%anticipo%`. La columna `tipo` era lo que faltaba mirar. Lo corrigió el usuario.
Es exactamente el modo de falla que previene `CLAUDE.md` § Regla de contexto: *"si la evidencia es
floja, decirlo — no afirmar que algo no existe"*.

### Cómo quedó

`buscarFacturasCandidatas(cuit, tipo)` bifurca. Para `cobro` busca en `msa.comprobantes_venta` y
calcula el saldo, **que no es una columna**:

> **saldo = `imp_total` − retenciones recibidas vinculadas − anticipos de cobro vinculados**

Recalcularlo en vez de guardarlo es lo que hace que **N cobros sobre una misma factura funcionen**:
el segundo anticipo ve el saldo que dejó el primero, sin estado intermedio que mantener.

La vinculación de cobro tiene camino propio (`confirmarVinculacionCobro`) porque en ventas:
no hay herencia de SICORE (las retenciones son **sufridas** y ya viven vinculadas aparte),
`comprobantes_venta` no tiene `monto_a_abonar` donde escribir un saldo, y en el extracto el vínculo
es `comprobante_venta_id`. El camino de compras quedó **intacto**.

### 🐛 El vínculo NO podía ir en `factura_id` — corregido el mismo día

Primero se reusó `factura_id` "sin cambios de estructura", supuestamente verificado. **Falso**: esa
columna tiene `FOREIGN KEY (factura_id) REFERENCES msa.comprobantes_arca(id)`. Al vincular, la base
tiró `violates foreign key constraint "anticipos_proveedores_factura_id_fkey"`.

Se había verificado **quién lee** `factura_id`, no **qué restricciones tiene la columna** — una capa
de menos, el mismo modo de falla que con `anticipos_proveedores.tipo`. La FK hizo su trabajo: frenó
el error en el momento en vez de dejar un uuid colgado que apareciera meses después.

Arreglado con columna propia `comprobante_venta_id` + su FK a `msa.comprobantes_venta` (DDL en
`RECONSTRUCCION` § 2026-08-18). Queda **mejor** que reciclar: explícito, con integridad, y sin
depender de `tipo` para saber a qué tabla apunta.

⚠️ **"Sin vincular" ahora son dos columnas**: `factura_id IS NULL AND comprobante_venta_id IS NULL`.
La alerta de inicio miraba sólo la primera, así que un cobro parcial se habría reclamado para
siempre. Corregido.

### Verificado contra los datos reales antes de darlo por hecho

| Factura Sanpa 00010-00000021 | |
|---|---|
| Total | $78.262.800,00 |
| − Retención Ganancias + IIBB (ya vinculadas) | $6.651.666 |
| **Saldo a cobrar** | **$71.611.134** |
| − Anticipo de cobro cargado (40 % exacto) | $31.305.120 |
| **Saldo tras vincular** | **$40.306.014** ← la 2ª transferencia |

### 🧾 El cartel del wizard no dejaba recomponer la cuenta

El usuario, probando: *"78MM − 31MM no es 40MM, omite la info de los pagos vía las retenciones que
está descontado pero no se muestra"*. Tenía razón: el paso 1 mostraba `Total factura $78.262.800`
− `Anticipo $31.305.120` = `Saldo $40.306.014`, y esa resta **no cierra** (da 46.957.680). Los
$6.651.666 de retenciones **se descontaban** (el saldo sale del neto) pero no tenían renglón.
Un número que no se puede recomponer mirándolo es un número en el que no se confía.

Se agregó la línea **"Retenciones y cobros previos"** en los dos pasos, calculada como
`imp_total − monto_a_abonar`. En el segundo cobro ese renglón incluye también al primero.
Y se sacó del encabezado el `🏛️ Retención: $0,00`: el SICORE se practica **al pagar**, en un cobro
no aplica y mostrarlo en cero confunde.

### ✅ TESTEADO por el usuario 2026-08-18 — *"quedó perfecto"*

Verificado en la base: el anticipo de Sanpa quedó `estado='parcial'` con
`comprobante_venta_id → 00010-00000021` y `factura_id` en null, como corresponde.

**Falta probar todavía:** el **segundo** cobro ($40.306.014) que cierra la factura y la deja en
`cobrada`, y el caso A completo (anticipo que cubre el total de una sola vez).

### 🔴 Hallazgo: hay $134,1 M de cobros esperando este vínculo

Al verificar quedó a la vista cuánto se había acumulado por no poder imputar cobros:

| Cliente | Monto | Estado |
|---|---|---|
| Pedro Genta y Cia SA | $116.396.073,85 | pendiente_vincular |
| Pedro Genta y Cia SA | $8.000.000 | pendiente_vincular |
| Pedro Genta y Cia SA | $5.000.000 | parcial (desde mayo) |
| Pedro Genta y Cia SA | $2.100.000 | pendiente_vincular |
| BALLESTER Paulo — *"Venta 4 Vacas"* | $2.625.480 | pendiente_vincular (desde el 30/04) |

**$134.121.553,85** de plata que entró y nunca se imputó a una factura — o sea, contada dos veces en
el Cash Flow todo este tiempo ([A-BUG-27](#a-bug-27)). Los de Pedro Genta son ganadería: en
`ventas_unificadas` hay una venta suya de $88.988.382 **sin CUIT en el contrato**, así que además
no van a matchear por CUIT hasta cargarlo.

**Testear** → `MANUAL-USO.md` § *Cobrar una factura de venta*.

---

## <a id="p-46"></a>P-46 — Panel de pendientes dentro de la app (2026-08-18)

**Pedido del usuario:** un apartado **sólo para admin** con todos los pendientes de desarrollo,
agrupados (*"pendiente de test abajo de todo, pendiente secundario, pendiente urgente"*), que
además puedan verse **desde la sección de la app que les corresponde**, con un **chequeo general de
que todos estén accesibles desde algún lado**.

### Viabilidad: alta

El índice de este archivo ya es casi una tabla de datos: **166 filas** con formato consistente
`| ID | Estado | Prio | Ítem | Verificación |`. La agrupación sale directo de lo que ya está:

| Grupo | Se deriva de |
|---|---|
| **Urgente** | 🔴 + Prio `Alta` |
| **Secundario** | Prio `Media` / `Baja` |
| **Test** (abajo de todo) | ID `A-TEST-*` o tipo `Test` |
| Hechos | ✅ / 🟡 — se ocultan o van a un histórico |

### 🔒 La restricción que manda: la app LEE, no copia

`PENDIENTES.md` es la **fuente única** (`CLAUDE.md` § dimensión 1). Meter los pendientes en una
tabla de BD sería duplicarla y quedaría desincronizada al primer commit.
→ **Un API route que lee y parsea el `.md` del repo.** En Vercel el archivo viaja en el bundle, así
que el panel siempre muestra lo del commit deployado. Sin tablas nuevas, sin sincronización.

### ⚠️ El riesgo real, y su mitigación

Hoy el índice es **prosa disciplinada, no un formato**: 166 filas escritas a mano. Si el parser
exige rigor, el día que una fila salga distinta **desaparece del panel sin avisar** — el modo de
falla de siempre. Mitigación obligatoria: **el parser reporta lo que no pudo leer** y el panel
muestra un bloque *"N filas no parseadas"*. Nunca se pierde nada en silencio.

---

## ✅ HECHO 2026-08-19 — las 4 etapas

| Etapa | Qué | Dónde |
|---|---|---|
| 1 | Parser + endpoint | `lib/pendientes/parse.ts` · `app/api/pendientes/` |
| 2 | La pantalla | `components/modal-pendientes.tsx` (Principal → Pendientes) |
| 3 | Ubicación por pantalla + control duro | marcas `@pantalla` · `scripts/verificar-parser-pendientes.mts` |
| 4 | Contador en cada solapa | `hooks/usePendientesPorPantalla.ts` · `dashboard.tsx` |

**260 pendientes ubicados. Cola de "sin revisar": 0.**

```
@presupuesto 62 · @extracto 50 · @productivo 42 · @egresos 29 · @cashflow 25
@ingresos 20 · @sueldos 11 · @principal 8 · @importar 7 · @reporte 3 · @dashboard 5
@general 11 (operativo/doc: no pertenecen a ninguna pantalla)
```

### Las decisiones que definieron el diseño

**La ubicación es una MARCA en el texto, no una columna.** El índice tiene 16 tablas con 10 formas
de encabezado distintas: una columna habría que agregarla a las 16. `` `@cashflow` `` funciona en
cualquiera. Admite varias (`@cashflow @extracto`) y sub-nivel (`@ingresos/subdiarios`).

**El invariante se cumple por construcción**: sin marca = se muestra en TODAS. No se puede violar.
El único agujero era una marca mal escrita (`@cashflows` → invisible), y está blindado: se valida
contra las 12 solapas, el ítem cae a "sin ubicar" y el tipeo se reporta en rojo.

**`@general` es lo que permite que la cola CIERRE.** Separa *"revisado, no va a ninguna pantalla"*
de *"todavía no lo miré"*. Sin esa distinción la cola nunca llega a cero y se deja de mirar.

**`auditar` y `obsoleto` salen de las secciones C y D del archivo**, no de una marca: el índice ya
los tenía clasificados. Van plegados. Eso sacó 16 ítems de la cola sin escribir nada.

**El color del contador es proporcional.** La primera versión pintaba de rojo cualquier solapa con
≥1 urgente: quedaban **10 de 12 en rojo**. Con tramos (0 gris · 1-4 ámbar · 5+ rojo) queda una sola,
y dice dónde está el bulto de verdad.

### 🐛 Los 6 bugs que el propio desarrollo destapó

| Bug | Cómo apareció |
|---|---|
| **`marcasDesconocidas` faltaba en el endpoint** | La página entera tiraba *"This page couldn't load"*. Se agregó el campo al parser y al modal, **no al endpoint que los conecta** |
| **`notas-para-claude` rompía el SSR** | `document.querySelector` durante el render → 500 en `/adminjms1320`. **Preexistente**, ver [P-44](#p-44) |
| **El filtro parecía roto** | Al elegir `@ingresos` entraban los 13 propios **+ 184 sin ubicar**: 197 ítems. Ahora van en bloques separados |
| **El chip no coincidía con la lista** | 37 vs 48. Dos definiciones de "qué se muestra acá". Lo detectó el usuario |
| **Pipes escapados** | `A-BUG-18` dice `\|\|` en su texto: el split los contaba como celdas y corría todo de columna |
| **Filas con más celdas que su encabezado** | `P-19` vive bajo `\| ID \| Est \| Ítem \|` y tiene 4 celdas. La marca caía donde nadie mapea |

⚠️ **Los 6 pasaron `type-check` y `build` en verde.** Ninguno se ve sin abrir la pantalla.

### 🔢 IDs duplicados — el error de método, y el control que lo cierra

Se crearon **5 IDs sobre IDs existentes** (`P-35/36/37`, `A-FEAT-22/23`) mirando el número más alto
de cada familia. **`P-*` y `A-FEAT-*` no son listas continuas**: crecieron en tandas y quedaron
huecos ocupados en el medio. Renumerados a `P-44/45/46` y `A-FEAT-27/28`.

Peor que el error: **la evidencia estuvo delante y no se miró.** La salida del marcado imprimió
`A-FEAT-22 → @ingresos` dos veces y se leyó como ruido del script.

`verificar-parser-pendientes.mts` ahora **falla si hay IDs duplicados**. Antes de crear un ID:

```bash
for f in P A-FEAT A-BUG A-TEST; do
  echo -n "$f-* → último: "
  grep -oE "\b$f-[0-9]+\b" PENDIENTES.md | grep -oE "[0-9]+$" | sort -n | tail -1
done
```

### 🕳️ Hallazgo lateral: Presupuesto no es lo que su nombre dice

`@presupuesto` quedó con **62 pendientes, el doble que cualquier otra**. No está más atrasado:
**concentra 10 botones de administración de maestros** (proveedores, cuentas contables, actividades,
campos, variables, inversiones, sueldos, ingresos por actividad, margen, precios/TC). Es *donde se
administran los maestros del sistema*, no sólo donde se proyecta.

Y el plan de cuentas **no tiene una pantalla**: se toca desde **Dashboard** (categorías, interno) y
desde **Presupuesto** (cuentas contables).

**Falta testear** → `MANUAL-USO.md` § *Pendientes de desarrollo*.

---

## <a id="a-feat-25"></a>A-FEAT-25 — Escenarios de margen (diseño, 2026-08-18)

**El pedido.** El usuario simula campañas en *Productivo → Recría → Historial de pesadas*: no elige
el segmento actual, pone un total de terneros con datos actuales y proyecta una recría entera.
Quiere poder **adjudicar costos directos** para completar la foto — *"a un lote de 195 terneros le
pongo 30 has de avena, tantos USD, tal TC"* — con líneas total contra total y las dos columnas de
siempre: **por individuo** y **por total de la tropa**.

Y puso él mismo el límite correcto: *"no sería bueno duplicar o crear datos que en realidad salen de
otro lado"* (los terneros salen de la campaña de cría, no se tipean).

### 🔎 Lo que ya existe — NO hay que construirlo

| Lo que parecía faltar | Dónde ya está |
|---|---|
| costo por hectárea (el verdeo) | `actividad_insumos`, modo **`monto_ha`** — comentado como *"el verdeo. NO escala con cabezas"* |
| en USD, convertido al TC | `actividad_insumos.moneda` + `tipos_cambio.tc_presupuestado` |
| hectáreas de un lote | `lote_tramos.hectareas` — *"sólo para los costos por hectárea"* |
| hectáreas por campaña/actividad | `campo_campana_actividad.has_netas` |
| la cadena de ajustes | `actividad_insumo_ajustes` (`base × IPC × +30 %`) |

`panel-margen.tsx` **ya ensambla todo eso**. Construir costos directos dentro de Historial de Pesadas
sería la **tercera implementación del mismo cálculo** — el error que ya se cometió con
`presupuesto_variables` vs `actividad_insumos`.

### 🕳️ Lo que falta de verdad: la dimensión escenario

Verificado el 2026-08-18: **`panel-margen.tsx` calcula una sola foto por campaña, siempre desde datos
reales. No guarda variantes.** La duda del usuario (*"no sé si en márgenes puedo"*) tenía razón: no.

Son **tres** cosas distintas, y sólo existen dos:

| | Qué es | Existe |
|---|---|:-:|
| Margen actual | lo que pasó / está pasando | ✅ |
| Presupuesto | la proyección comprometida (caja) | ✅ |
| **Escenario** | *"¿y si hago 195 terneros con 30 has de avena?"* | ❌ |

### 🧭 El diseño: overrides, nunca una copia

> Un escenario = una fila padre (`nombre`, campaña base, `notas`) + una tabla de **overrides**.
> **Campo vacío = usá el dato real. Campo lleno = acá mando yo.**

Copiar las filas congelaría el vínculo con lo real: a los tres meses habría cinco escenarios con
precios viejos y ninguna forma de saber cuál mirar. Con overrides, **lo que no pisaste mejora solo**
cuando mejora el dato real. Es la aplicación directa de la regla del usuario (ver abajo), y la misma
idea que ya funciona en ventas de hacienda: *presupuestada → confirmada → fijada*.

### ✅ Dos definiciones tomadas con el usuario (2026-08-18)

1. **Los costos se aplican por EXISTENCIA INICIAL.** Con mortandad, las cabezas cambian dentro del
   tramo: por cabeza inicial, final o promedio ponderado dan **tres números distintos**. Queda fijado
   en *inicial* — y hay que respetarlo en toda pantalla que muestre "por cabeza", o dentro de tres
   meses no coinciden.
2. **Default del dato real, siempre editable.** *"Que tome el dato por default si existe y permita
   poner a mano si no existe o no se quiere usar."* Es una **regla general del proyecto**, no de esta
   feature. Aplicada acá: cabezas ← ciclo de cría · hectáreas ← `campo_campana_actividad.has_netas`
   · USD/ha ← `actividad_insumos` · TC ← `tipos_cambio` · precio ← `precios_hacienda`; todos
   pisables. Corolario del usuario: *"nos deja el diseño futuro desde hoy usando la data existente
   esté como esté"*.
   ⚠️ Y el campo de **cuenta contable** del costo se deja previsto desde el día 1 aunque arranque
   vacío (hoy se escribe a mano): agregarlo después cuesta el doble.

### ✅ ETAPA 0 — hecha 2026-08-18: el motor ya es una función pura

`calcularMargen(d: DatosMargen): MargenActividad[]` vive en **`lib/presupuesto/margen.ts`**;
`panel-margen.tsx` (653 líneas) es sólo la cáscara que le arma los datos. **No hay nada que extraer.**

**Y los 3 overrides del caso de uso YA son parámetros de entrada:**

| Override | Dónde entra |
|---|---|
| Cabezas | `DatosMargen.lotes[].cabezas` |
| Hectáreas | `DatosMargen.hasPorActividad[actividad]` |
| Monto del insumo | `DatosMargen.costos[].monto` |

O sea: **el escenario no toca el motor.** Es armar el mismo `DatosMargen` con los overrides aplicados
y llamar a la misma función. El test del escenario vacío pasa a ser cierto **por construcción**.

**La etapa 3 casi desaparece:** `LineaMargen` ya trae `total`, `porHa` y `porCabeza`, y
`MargenActividad` ya trae `margenPorHa`. Las dos columnas ya existen.

**El trabajo grande pasó a ser la UI, no el cálculo.**

### Dos cosas que la etapa 0 destapó — una era error mío, la otra un bug real

**1. ✅ El divisor YA era existencia inicial — no había nada que cambiar.**
Primero se afirmó que `margen.ts:661` inflaba el costo por cabeza al dividir por las cabezas
vendidas. **Era una lectura equivocada.** `pct_mortandad` **no se aplica en ningún punto del
margen**: sólo en `lib/productivo/racion.ts` (la ración) y en `analisis-productivo.tsx` (engorde,
otra pantalla). En `calcularMargen`, `cabezasTotal` es la suma de cabezas de los lotes de la
actividad, sin descontar mortandad → **eso ya es la existencia inicial**, que es el criterio que
pidió el usuario. Y el análisis de engorde lo dice en su comentario: *"la ración de cada etapa usa
la cantidad de INICIO"*. El criterio ya era consistente en el proyecto.

**2. 🐛 ARREGLADO — el margen ignoraba el ajuste manual de cabezas.**
`panel-margen.tsx:181` hacía `cabezas: Number(l.cantidad_calculada ?? l.cantidad)` — **prefería el
calculado**. Verificado en `panel-lotes-hacienda.tsx:231-234` y el cartel de la línea 399:
**`cantidad` es el valor con el ajuste a mano y `cantidad_calculada` es lo que dio la cuenta.**

Efecto: corregías un lote de 200 a 195, en **Lotes** veías 195 con el cartel *"ajustado a mano, el
cálculo da 200"*, y el **Margen facturaba 200**. No era sólo el divisor: la venta se calcula
`cabezas × peso × precio`, así que eran **5 animales de ingreso inventado** (~$3 M con un ternero de
200 kg a $3.000/kg). Contra `CLAUDE.md` § *Default del dato real, siempre editable*.

Arreglado dando vuelta la precedencia. Chequeado que no hubiera otra ocurrencia del mismo patrón.
**No mueve ningún número hoy**: de 5 lotes, ninguno tiene ajuste manual — era un bug **latente**,
que aparecía la primera vez que se corrigiera un lote a mano.

### 📋 Plan por etapas
0. ✅ **Entender el motor** — hecho, ver arriba.
1. **El escenario como dimensión de Márgenes** — 2 tablas + selector *Real · Escenario A · B*.
2. **Los overrides del caso de uso**: se aplican al armar `DatosMargen`; el motor no se toca.
3. ~~El divisor por existencia inicial~~ — **ya estaba bien** (punto 1 de arriba). Las columnas
   `porHa` / `porCabeza` también existen. **Esta etapa desapareció.**
4. **Enganche desde Historial de Pesadas**: "guardar como escenario".
5. **Comparar escenarios** y, opcionalmente, promover uno a presupuesto.

**Estado: diseño + etapa 0. 0 código de la feature.**

---

## <a id="a-test-31"></a>A-TEST-31 — Ingresos reestructurado por jerarquía (2026-08-18)

**Pedido del usuario:** *"reestructurar la vista por jerarquías: 1º seleccionar entre MSA, MA o PAM;
luego arrendamientos, ventas, comprobantes, cobros, subdiarios"*. Y explícito: **sin cambios de
funcionamiento**, sólo la jerarquía.

**Antes:** 8 solapas planas con la empresa metida en el nombre — `Arrendamiento · Ganadería ·
Ventas MSA · Comprobantes MSA · Cobros MSA · Subdiarios MSA · Subdiarios PAM · Subdiarios MA`.
Había crecido por agregado: cada empresa nueva sumaba una solapa. Con 3 × 5 escalaba a 15.

**Ahora:** nivel 1 empresa, nivel 2 vista. Qué ve cada una:

| Vista | MSA | PAM | MA | Por qué |
|---|:-:|:-:|:-:|---|
| Arrendamientos | ✅ | ✅ | ✅ | tabla en `public` con columna `empresa` → es un **filtro**, no cambio de schema |
| Comprobantes | ✅ | ✅ | ✅ | `comprobantes_venta` existe en los 3 |
| Subdiarios | ✅ | ✅ | ✅ | ya era empresa-aware |
| Ventas (granos) | ✅ | ✕ | ✕ | decisión del usuario. **`msa.ventas` tiene 0 filas**: el módulo está entero y nunca se usó |
| Ganadería | ✅ | ✕ | ✕ | decisión del usuario |
| Cobros | ✅ | ✕ | ✕ | **bloqueado por dato**, ver [A-FEAT-24](#a-feat-24) |

### Lo que hubo que tocar para que la solapa no mienta

`Comprobantes` tenía 6 `.schema('msa')` fijos. Ahora deriva de la empresa — **para MSA no cambia
nada**. Pero tres tablas que usa **existen sólo en MSA**, así que fuera de MSA se saltean en vez de
fallar: `retenciones_recibidas`, y `ventas` + `ventas_comprobantes` (el circuito de granos, vacío
incluso en MSA).

Y se ocultan fuera de MSA los botones que escriben por modales atados a ese schema:
**Nueva liquidación**, **Editar** y **Retenciones** (`ModalLiquidacionMsa` escribe en `msa.ventas` y
`msa.ventas_comprobantes`). Quedan disponibles listar, **Importar**, marcar cobrado y eliminar.
Para cargar un comprobante a mano en PAM/MA está el alta del **Subdiario**, que ya soporta las 3.

⚠️ Se evitó a propósito el patrón `empresa === 'MA' ? 'ma' : 'msa'`, que manda a MSA todo lo que no
sea MA **sin fallar** — el bug silencioso que ya apareció dos veces en este proyecto.

### El importador volvió a Comprobantes
Criterio del usuario: *"el botón de importar lo veo en Comprobantes; en Subdiarios no"*. **El
subdiario es la DDJJ por mes contable, no el lugar donde se cargan facturas.** Se sacó el botón que
se le había puesto el 2026-08-13 y quedó sólo en Comprobantes — que ahora sirve a las 3 empresas,
así que PAM y MA no pierden el camino de importación.

**Testear** → `MANUAL-USO.md` § *Ingresos — navegación*.

---

## <a id="a-feat-24"></a>A-FEAT-24 — Cobros no puede existir en PAM/MA: falta el vínculo en el extracto

`VistaCobrosVenta` muestra, por cada factura de venta, los **cobros** que la cancelaron. Los saca del
extracto bancario, filtrando por `comprobante_venta_id`.

**Esa columna existe en un solo lugar:**

| Extracto | Schema | `comprobante_venta_id` |
|---|---|:-:|
| `msa_galicia` | `public` | ✅ |
| `pam_galicia` | `public` | ❌ |
| `pam_galicia_cc` | `public` | ❌ |
| `ma_galicia` | **`ma`** | ❌ |

O sea que en PAM y MA **no hay forma de decir que un crédito del banco cancela una factura**. No es
un problema de mapeo de nombres: el dato no existe. Si se mostrara la solapa, todas las facturas
dirían *"cobrado $0 · pendiente el total"* — que **miente peor que no estar**.

**Para habilitarlo hacen falta dos cosas, en este orden:**
1. `ALTER TABLE` agregando `comprobante_venta_id` a las 3 tablas (aditivo).
2. Que **algo lo escriba**: hoy en MSA lo llena el motor de conciliación. Sin esa parte, la columna
   queda tan vacía como ahora.

**De paso, dos cosas a resolver cuando se encare:** los extractos no siguen un patrón derivable
(`ma_galicia` vive en el schema `ma`, los otros en `public`), así que hace falta un **mapa explícito
empresa → tabla**; y **PAM tiene dos cuentas** (`pam_galicia` y `pam_galicia_cc`), o sea que hay que
consultar las dos y unir.

---

## <a id="a-feat-28"></a>A-FEAT-28 — La fijación de arrendamiento no emite el comprobante de venta

**El hueco.** El circuito de arrendamiento llega hasta la fijación y ahí se corta:

```
contrato_arrendamiento (tiene columna `empresa`: MSA/PAM/MA)
   └── cuota_arrendamiento
         └── venta_arrendamiento  ← la FIJACIÓN: toneladas, precio, TC, monto en pesos, fecha de cobro
               └── comprobante_id ← ⚠️ la columna EXISTE y queda siempre en NULL
```

`comprobante_id` aparece **una sola vez en todo el repo**: en el tipo TypeScript
(`lib/arrendamientos/calculo.ts:84`). El `insert` de la fijación
(`vista-arrendamientos.tsx:511`) **no lo setea**, y ninguna pantalla lo lee. Alguien previó el
vínculo y no lo llegó a implementar.

**Qué significa en la práctica.** La fijación **es** la venta: cuando fijás precio queda determinado
el importe exacto que se va a facturar. Pero la factura de arrendamiento hay que cargarla **a mano**
en el subdiario, repitiendo cliente, importe y fecha. Dos cargas del mismo hecho, que pueden no
coincidir — y nada avisa si difieren.

**Por qué importa ahora.** Es el circuito de PAM y MA: su única venta es arrendamiento. Sin este
vínculo, el subdiario que se les acaba de crear se llena tipeando. Con el vínculo, se llena solo.

**Por qué es trabajo del norte.** *"Cada comprobante se carga una sola vez y alimenta la proyección"*
(CLAUDE.md § Norte). Acá se carga dos veces, y `estado`/`fecha_cobro_estimada` — que son las que
llevan la venta al Cash Flow — quedan en la carga manual, no en la fijación que ya sabe la fecha
de cobro.

### ✅ Aclarado por el usuario (2026-08-18): la factura NO se emite, se importa

*"La factura de arrendamiento se importa desde ARCA directo. La idea es poder vincularla con la
fijación."* Eso cambia el diseño y lo hace **mucho más chico**: no hay que generar comprobantes,
hay que **vincular** el que ya llegó.

Y el mecanismo **ya existe**: es `public.ventas_facturas` + la alerta `AlertasFcVenta` de la pantalla
de inicio ("¿esta factura es de esta venta?"), que ya resuelve el vínculo para las ventas de
`ventas_unificadas` — arrendamiento incluido. O sea que el circuito está más completo de lo que
parecía. Lo que queda:

1. **`ventas_arrendamiento.comprobante_id` es un vínculo huérfano**: nadie lo escribe ni lo lee, y
   convive con `ventas_facturas`, que es el que sí se usa. **Hay que decidir cuál manda** y borrar
   o completar el otro — dos formas de decir lo mismo es cómo se desincronizan los números.
2. **El vínculo hoy es venta ↔ factura, no fijación ↔ factura.** Si una cuota se fija en varias
   veces y llega una factura por cada fijación, hace falta bajar el detalle a la fijación.
3. **Que el match no dependa sólo del CUIT** → ver [A-BUG-25](#a-bug-25), donde un dígito mal
   tipeado hacía invisible la factura correcta.

---

## <a id="a-dec-02"></a>A-DEC-02 — Arrendamiento en Factura C: dónde va el importe (2026-08-13)

El usuario aclaró que **PAM y MA facturan sólo arrendamiento, Factura C**, y que *"no hay ni exento
ni nada, es sólo factura con el total"*. Eso choca con dos cosas que hoy están armadas de otra forma.

> **Dato del usuario (2026-08-18): MA y PAM NO están inscriptas en IVA y no declaran.** O sea que
> lo suyo no es un "Libro IVA Ventas" sino un **registro de ventas**. Eso vuelve *correcto* que su
> bloque 1 esté vacío, y convierte la pregunta en una de **nombres y presentación**, no de números.
> El usuario dijo que lo mira y define.

### 1. Con sólo Fac C, el Libro IVA Ventas sale vacío

`TIPOS_SIN_CREDITO_VENTAS = [11,12,13]` manda todos los comprobantes **C** al bloque 2. Si una
empresa factura **únicamente** Fac C, su subdiario mostraría:
- **📒 Libro IVA Ventas → $0,00** (bloque 1 sin una sola fila)
- **📋 No generan débito fiscal → todo**

Técnicamente correcto si PAM/MA son **monotributistas o exentas** (no generan débito, no liquidan
IVA). Pero deja una pantalla que *parece* rota, y un "Libro IVA Ventas" en cero. Dos salidas:
- **(a)** dejarlo así y renombrar los bloques cuando la empresa no liquida IVA;
- **(b)** que la lista del bloque 2 dependa de la empresa: para una empresa cuyo universo es Fac C,
  esos comprobantes **son** su libro y el bloque 2 no aplica.

### 2. ✅ CERRADO — el total va en Operaciones Exentas, y está bien

Los 2 comprobantes de arrendamiento de MSA de 07/2026 (PROVINVEST $50.000.850 y SANPA $78.262.800)
tienen todo el importe en `imp_op_exentas`, con `imp_neto_gravado = 0` e `iva = 0`.

**Confirmado por el usuario (2026-08-18): "corresponde a exento, como está importado de ARCA".**
El arrendamiento rural es una operación exenta, así que la columna es la correcta y el importador
la está mapeando bien. **No hay nada que cambiar acá.**

Corolario práctico: en un comprobante de arrendamiento, **Neto Gravado y Alícuota van vacíos** —
que es exactamente lo que arregla [A-BUG-23](#a-bug-23) (antes el modal estampaba 21 % por defecto).

**⚠️ No se tocó ningún dato ni ninguna clasificación.** Queda abierto sólo el punto 1.

---

## <a id="a-test-29"></a>A-TEST-29 — Importador de ventas multiempresa (2026-08-13)

**El hueco:** `app/api/import-ventas/route.ts` escribía `.schema('msa')` fijo en sus 3 consultas, y
`modal-import-ventas.tsx` mandaba `empresa: 'MSA'` hardcodeado a la descarga de ARCA. Resultado: **no
había forma de importar ventas de MA ni de PAM**, aunque MA ya tuviera su tabla y su subdiario.
Y el modal se abría desde un solo lugar: la solapa *Comprobantes MSA*.

**Qué cambió:**
| Archivo | Cambio |
|---|---|
| `app/api/import-ventas/route.ts` | toma `empresa` del FormData (valida MSA/PAM/MA) y usa su schema |
| `components/modal-import-ventas.tsx` | prop `empresa`: decide el schema **y** con qué CUIT entra a ARCA. El título lo muestra |
| `components/vista-subdiarios-venta.tsx` | botón **Importar** en cada subdiario — cada empresa importa lo suyo |

**Guard de retenciones:** `retenciones_recibidas` sólo existe en `msa`. Para PAM/MA el paso de
vincular retenciones por CUIT se saltea en vez de fallar. Si esas empresas llegan a manejar
retenciones sufridas, hay que crear la tabla en su schema y sacar el guard.

**Testear** → `MANUAL-USO.md` § *Importar comprobantes de venta*.

---

## <a id="a-bug-24"></a>A-BUG-24 — Detalle de Pago: el Total Cancelado no incluye el descuento (2026-08-13)

**El caso del usuario** (ALCORTA EDMUNDO ERNESTO, pago del 10/08/2026, FC 1-00010-00006268):

| Total Factura | Ret. Ganancias | Descuento | Monto Transferido | Total Cancelado |
|---|---|---|---|---|
| 548.398,62 | 4.131,22 | 27.419,93 | 516.847,47 | **520.978,69** ❌ |

`516.847,47 + 4.131,22 = 520.978,69`. Falta el descuento: con él da **548.398,62**, que es exactamente
el Total Factura — la FC se canceló **entera**. Tal como sale, el PDF le dice al proveedor que le
quedan $27.419,93 sin cancelar.

**La relación que hay que respetar** (y que el usuario dice que ya estaba bien antes):

> `Total Factura = Transferencia + Descuento + SICORE` → y eso **es** el Total Cancelado.

**Dónde**, en `lib/pagos/pdf-detalle-pago.ts` — falta `descuento_aplicado` en los tres:
| Línea | Qué calcula | Hoy |
|---|---|---|
| 95 | anticipo | `montoTransferido + (anticipo.monto_sicore \|\| 0)` |
| 116 | fila por factura | `i.monto_a_abonar + (i.monto_sicore \|\| 0)` |
| 130 | fila TOTAL | `totalTransferido + totalRet` |

### El diagnóstico del usuario era exacto: había un camino paralelo

Dijo *"se cambió o se hizo un script paralelo"* y *"hubo una corrección que no llegó a destino"*.
Efectivamente **había dos implementaciones**, y el encabezado del lib lo confesaba por escrito:
*"Copia VERBATIM de generarPDFDetallePago (vista-facturas-arca)… cuando se deprece el Modal se
elimina la copia inline"*. Nunca se eliminó.

| | Dónde | La usaba |
|---|---|---|
| lib | `lib/pagos/pdf-detalle-pago.ts` | Cash Flow + el mail encolado |
| copia | `vista-facturas-arca.tsx` L5390-5553 (164 líneas) | Egresos (6 botones) |

Las dos tenían el mismo bug del Total Cancelado — por eso salía mal desde las dos puntas. Y la
copia **ni siquiera soportaba el desglose por medios de pago**, que sólo estaba en el lib.

**Arreglo (2026-08-13):**
1. Los 3 cálculos ahora suman `descuento_aplicado` (L95 anticipo · L116 por factura · L130 TOTAL).
2. **Borrada la copia inline**: Egresos importa el lib. Una sola implementación, como decía el plan.
3. Se subió al lib la única cosa que la copia hacía mejor: alinear las columnas de importe según la
   **cantidad real de columnas**. Con índices fijos, un pago sin retención desalineaba la tabla.
4. Comentario al tope del archivo con la relación que tiene que cerrar, para que no se vuelva a caer.

**Ojo, ya estaba escrito el criterio correcto:** el desglose por medios (`hayMedios`) decía en su
comentario *"la suma debe dar el total de la(s) factura(s)"* y sí listaba *Descuento pronto pago*.
Las dos mitades del mismo PDF usaban criterios distintos. Ahora coinciden.

**Falta testear:** regenerar el detalle de ALCORTA del 10/08/2026 (desde Egresos **y** desde Cash
Flow) y verificar que Total Cancelado = **$548.398,62** = Total Factura. Y un pago **sin** descuento,
para confirmar que no cambió.

---

## <a id="a-test-27"></a>A-TEST-27 — Control de cuadratura del subdiario (2026-08-13)

**Qué es.** Pedido del usuario: un chequeo básico en el resumen del subdiario, en **Compras y en
Ventas**, que verifique la identidad contable del período:

> `Total general − Neto Gravado − Exento/No Gravado − IVA − Otros Tributos − (bloque sin crédito fiscal) = 0`

El bloque sin crédito fiscal (Fac B y C en Compras) se resta como **importe total**, sin abrir
columnas — que es además lo que pide ARCA: *en el Libro de Compras, para comprobantes B o C se
informa 0 en el campo "cantidad de alícuotas"*.

**Archivos:**
| Archivo | Qué hace |
|---|---|
| `lib/subdiarios/cuadratura.ts` | **nuevo** — `verificarCuadratura()` + `TIPOS_SIN_CREDITO_COMPRAS` / `_VENTAS` |
| `components/control-cuadratura-subdiario.tsx` | **nuevo** — la barra, compartida por las 2 pantallas |
| `components/vista-facturas-arca.tsx` | usa la constante del lib (antes tenía la lista local) + render |
| `components/vista-subdiarios-venta.tsx` | render (sin Otros Tributos, sin conversión por TC) |

**La tolerancia no es pereza, es el dato real.** MSA 07/2026 cierra con **$0,01** de residuo,
repartido en 4 facturas que vienen redondeadas desde ARCA (La Mercure −0,02; Telecom, Miceli y
Deheza +0,01 c/u). Exigir cero exacto pintaría rojo todos los meses y el control pasaría a ser
ruido que se ignora. Tolerancia = **$0,05 × cantidad de comprobantes**.

**Lo que lo hace útil no es el número global, es la lista.** Debajo se despliegan los comprobantes
cuyo `imp_total` no coincide con la suma de sus partes, con la diferencia de cada uno. El total
avisa que algo pasa; la lista dice dónde.

**Testear** → 4 pasos en `MANUAL-USO.md` § *Control de cuadratura*.

---

## <a id="a-bug-23"></a>A-BUG-23 — El alta de ventas estampaba IVA 21% en operaciones exentas (2026-08-13)

**Cómo apareció.** El usuario estaba controlando el IVA Ventas de julio y vio que **SANPA SEMILLAS
figuraba con alícuota 21 %** y PROVINVEST no. Preguntó si era un error del PDF. No lo era: el 21
estaba **guardado en la fila**, en una operación **100 % exenta** ($78.262.800 en Op. Exentas, IVA $0).

**Causa.** `components/modal-comprobante-venta-msa.tsx` tenía `useState('21')` como valor inicial de
la alícuota, la reseteaba a `'21'` en el alta y — lo peor — **mostraba `'21'` cuando lo guardado era
`null`**. Como además recalcula `IVA = neto × alícuota / 100` y el neto gravado era 0, el IVA daba 0:
quedaba la combinación absurda de **alícuota 21 % con IVA $0**, sin que nadie eligiera ese 21.

**Se auto-reproducía.** El `updated_at` de Sanpa era del mismo día en que el usuario lo estaba
revisando: abrir el comprobante para mirarlo y guardar volvía a estamparle el 21. Un bug que se
reinstala cada vez que lo vas a inspeccionar es peor que uno que falla siempre.

**Arreglo (2026-08-13):**
- Opción `— sin alícuota —` (`''`) primera y por defecto; el `null` guardado se muestra vacío.
- Al guardar: `alicuota_iva = null` si no hay alícuota elegida **o si el neto gravado es 0**.
- El recálculo automático del IVA no corre sin alícuota elegida (antes pisaba con 0 el IVA tipeado a mano).
- **Dato corregido con autorización expresa del usuario**: la fila de Sanpa pasó a `alicuota_iva = null`.

**Falta testear:** cargar una venta exenta y confirmar que no aparece ninguna alícuota; reabrir la
de Sanpa, guardar sin tocar nada y verificar que **sigue** en null.

---

## <a id="a-dec-01"></a>A-DEC-01 — Ventas: qué tipos salen del Libro IVA Ventas (2026-08-13)

**El problema.** En `vista-subdiarios-venta.tsx` el bloque 1 se arma con `tipo_comprobante !== 11`,
pero el bloque 2 ("Monotributo") muestra **11 y 13**. No es una partición: una **NC C (tipo 13) cae
en los dos** — se resta como Nota de Crédito del Libro IVA Ventas *y* aparece en el bloque
Monotributo. Es el mismo defecto que en Compras se corrigió el 2026-07-15.

**Por qué no se copia la lista de Compras.** `TIPOS_SIN_CREDITO_COMPRAS = [6,7,8,11,12,13]` incluye
Fac B porque una **Fac B recibida no da crédito fiscal**. Pero una **Fac B emitida sí genera débito**
y tiene que quedar **dentro** del Libro IVA Ventas: copiar la lista sacaría del libro ventas que
tributan. Propuesta: `TIPOS_SIN_CREDITO_VENTAS = [11,12,13]`.

**Urgencia real: ninguna, hoy.** `comprobantes_venta` tiene sólo tipos **1** (Fac A), **201** (FCE
MiPyME A) y **332** (liquidación primaria de granos) — verificado 2026-08-13, en MSA; MA está vacía.
El bloque Monotributo de Ventas nunca se dibuja. **Pero la decisión hay que tomarla antes** de que
entre el primer comprobante C, no después.

**Estado (actualizado 2026-08-13, tras el "perfecto todo" del usuario):** `[11,12,13]` quedó aplicado
en **los tres lugares** — control de cuadratura, resumen en pantalla y los exports —, porque al
unificar el cálculo en `lib/subdiarios/subtotales.ts` la pantalla pasó a usar la misma lista.
**No cambia ningún número hoy** (no hay comprobantes C cargados) y revertirlo es cambiar una
constante. Si el criterio correcto fuera otro, decirlo antes de que entre el primer comprobante C.

---

## 🐄 MÓDULO HACIENDA — auditoría de la Planilla, 2026-08-20

> Los 15 ítems de abajo salieron de auditar **las 7 planillas mensuales + la punta a punta**, una
> por una, con el usuario. **El diagnóstico completo, con los números y los veredictos textuales,
> está en `MODULO_HACIENDA.md` §§ 12 y 13** — acá va el resumen accionable para no duplicar.
> Los archivos auditados quedaron en `backup_planillas_hacienda_2026-08-20/` (Excel + PDF).

---

## <a id="a-bug-44"></a>A-BUG-44 — El `Stock Anterior` suma las ventas y las mortandades

**El síntoma, medido**: la planilla de agosto/2026 dice **372 cabezas**; hay **356**.

**La causa**: `vista-sector-productivo.tsx:1410` hace `stockAnterior[col] += m.cantidad`, una suma
cruda de todos los movimientos anteriores al período. Pero `cantidad` **se guarda siempre positiva**
salvo en `ajuste_stock` y `cambio_categoria` (verificado: 2 ventas y 6 mortandades, todas
positivas). Entonces suma lo que debería restar. Las filas del período no tienen el problema porque
usan `Math.abs` y después restan (`:1422-1423`, `:1440`).

**El arrastre, columna por columna al cierre de agosto**: CUT/Descarte **+8** (venta de 4 en marzo) ·
Ternero Recría **+6** (3 muertes) · Ternera Recría **+2** (1 muerte). **Cada venta y cada muerte
agrega el doble de su tamaño, y el error nunca se corrige solo.**

**Confirmado por dos caminos independientes**: la planilla **punta a punta**, que arranca de cero y
no puede arrastrar, da **356**.

✅ **Decisión del usuario (2026-08-20): se corrige el REPORTE, no el signo de los movimientos.**
Motivo textual: *"la app es muy extensa y tiene muchos lugares que afectan a otros; cambiar el signo
podría corregir el reporte y descompaginar muchas otras cosas que hoy funcionan bien"*. La evidencia
lo respalda: la pestaña Stock hace `cantidad -= m.cantidad` (`:1148-1149`), que **depende** de la
convención positiva, y `confirmar-venta.ts` también escribe en positivo.

**Alcance**: una línea. `stockAnterior` tiene que mirar el `tipo` igual que `cargarDatos()`.
**Ningún dato se toca.**

### ✅ HECHO 2026-08-20 — falta testear en la app ([A-TEST-35](#a-test-35))

**Qué se tocó**: `vista-sector-productivo.tsx:1409-1418` (dentro de `calcularDatosPlanilla`, que la
llaman **sólo** el preview del modal y el export) y su espejo en
`scripts/export-planilla-hacienda.mts`. **Nada más.** Verificado por grep que `stockAnterior` no
existe fuera de esa función.

**Lo que NO se tocó, a pedido del usuario**: la pestaña Stock (`:1146`) y las órdenes (`:3740`), que
ya estaban bien — unificar las 4 copias del cálculo es riesgo sobre código que anda, y se descartó.
Tampoco `tab-terneros.tsx`, que tiene el **mismo bug** con efecto propio → ver más abajo.

**Verificación — diff celda por celda contra la foto anterior** (`backup_planillas_hacienda_2026-08-20/`
contra `planillas_hacienda_2026-08-20_CORREGIDO/`):

- **42 celdas distintas, 0 fuera de la hoja *Planilla*.** La hoja *Detalle* y el detalle de
  CUT quedaron idénticos byte a byte.
- Sólo se movieron **2 filas**: `Stock Anterior` y `Existencia Final`. Las otras 8 (Compras,
  Nacimientos, Reclas. +, Ingresos, Ventas, Mortandad, Reclas. −, Egresos), intactas.
- Sólo **3 categorías**: CUT/Descarte, Ternero y Ternera — más los subtotales que arrastran.
- **Febrero y marzo, idénticos**, que es lo correcto: febrero no tiene período anterior y marzo no
  tenía ventas ni muertes antes.
- La cadena engancha ahora en **los 6 eslabones**, y agosto da **356** = la punta a punta = la
  pestaña Stock.
- `npm run type-check:diff`: **113 → 113**, ningún archivo empeoró.

⚠️ **El mismo bug vive en `components/tab-terneros.tsx:462-464`** (`+ m.cantidad`, suma cruda) y ahí
pega más fuerte: cree que hay **158** Ternero Recría donde hay **42**, y como las filas fantasma son
`stock − individuos activos` (`:780`), muestra **116 filas fantasma** — confirmado por el usuario en
la app. **Queda sin corregir**, para mirarlo aparte y con cuidado: es un detalle roto dentro de una
vista que por lo demás funciona bien (los chips de recría cuentan individuos y salen correctos).

---

## <a id="a-bug-45"></a>A-BUG-45 — El tacto genera `ajuste_stock` en vez de `cambio_categoria`

**No es un error de carga: lo hace el código.** `:4513-4522` inserta dos movimientos
`tipo: 'ajuste_stock'` (`−vacías` en el rodeo, `+vacías` en CUT) con las observaciones
*"Vacias tacto - pasan a CUT"* / *"Vacias tacto - ingreso CUT"* — exactamente las que aparecen en la
planilla de febrero.

**Qué produce**: el reporte rotula `ajuste −` como **Mortandad** y `ajuste +` como **Compras**. Un
pase a CUT sale como *"se murieron N vacas"* + *"se compraron N vacas de descarte"*. En febrero:
**8 animales vivos declarados muertos** — y la misma planilla los lista como *Activa* dos páginas
después.

**La prueba de que es el tacto y no la carga**: en marzo la **misma operación** (4 vacas a CUT) está
bien hecha, con `cambio_categoria`, porque se cargó desde el modal de movimientos.

**El fix**: cambiar el `tipo` en esas 2 líneas. **Los signos ya están bien** (`−N` / `+N`, el mismo
par espejo que usa `guardarMovimiento`), así que el pase cae solo en *Reclas. −* / *Reclas. +*.
**No hay que tocar la planilla.** Los datos viejos van aparte: [A-DAT-05](#a-dat-05).

### ✅ HECHO 2026-08-20 (el código) — falta [A-DAT-05](#a-dat-05) para que se vea

**Por qué el cambio es seguro, verificado antes de tocar**: los **tres** lugares que calculan stock
desde los movimientos ya contemplan `cambio_categoria`, y en los tres pesa **exactamente igual** que
`ajuste_stock` (pestaña Stock `:1150` · órdenes `:3755-3757` · `Stock Anterior` de la planilla).
**Cambiar el tipo no mueve ni una cabeza de stock en ninguna pantalla** — sólo cambia cómo lo rotula
el reporte, que es lo que se busca.

**Qué se tocó**: los 2 `insert` del bloque de tacto. Nada más. Las observaciones quedan igual.

**Efecto lateral bueno**: después de este cambio **ningún camino del código genera `ajuste_stock`
automáticamente** (verificado por grep). Pasa a ser sólo lo que el usuario elige a mano en el
desplegable, que es lo que un ajuste debería ser.

`npm run type-check:diff`: **113 → 113**.

⚠️ **Todavía no se ve nada en la app**: los 4 movimientos de febrero siguen con el tipo viejo. El
efecto visible llega con [A-DAT-05](#a-dat-05). Y el fix del código recién se puede testear **cuando
se registre el próximo tacto**.

---

## <a id="a-bug-46"></a>A-BUG-46 — Pasar algo a CUT sin caravanas no crea el individuo, y no avisa

`:1247` → `if (esDestinosCUT && nuevoMov.caravanas.trim())`. Si el textarea queda vacío, el
movimiento se registra igual y **no se crea ninguna caravana**.

**Caso real**: el 08/08/2026 entró 1 vaquillona al CUT (*"Mal Parió Ternero de 40 Kg"*). La grilla
pasó de 16 a **17** y **no existe ninguna caravana con `fecha_alta` en agosto**: la página nominal
sigue listando las 8 de febrero. El animal entró al stock sin nombre.

Es el mismo modo de falla de siempre: **el silencio miente**. Y es exactamente lo que detecta el
control de [A-FEAT-34](#a-feat-34).

---

## <a id="a-bug-47"></a>A-BUG-47 — `fecha_alta` no se setea nunca al crear caravanas

Los dos lugares que dan de alta filas en `productivo.terneros` —el tacto (`:4532-4546`) y el cambio
de categoría manual hacia CUT (`:1250-1265`)— **no setean `fecha_alta`**.

Y la página del CUT de la planilla filtra por **`fecha_alta <= hasta`** (`:1458`), que en Postgres
**excluye los `NULL`**. O sea: **una caravana creada por la app no aparecería en la planilla.**

**Hoy no se nota** porque las 12 del CUT tienen `fecha_alta` cargada a mano en abril/2026
(verificado: 0 nulos en CUT). Pero ya hay **8 terneros con `fecha_alta` nula** en otras categorías.

⚠️ `fecha_alta` es la **fecha real de ingreso a la categoría**, no `created_at` — el motivo completo
está en `MODULO_HACIENDA.md` § 6.4. Al arreglarlo, tiene que tomar la fecha del **movimiento**.

### ✅ HECHO 2026-08-20 — los 2 caminos que alimentan el CUT

Los dos `insert` ahora guardan `fecha_alta` con la fecha del movimiento: el del tacto
(`fecha` de la orden) y el del cambio de categoría manual (`nuevoMov.fecha`).
`npm run type-check:diff`: **113 → 113**.

**Qué NO se tocó, a propósito**: hay **5** caminos que dan de alta filas en `terneros`, no 2. Los
otros tres (alta manual de la pantalla de Terneros y los dos importadores) tampoco setean
`fecha_alta`, pero **no afectan a la Planilla de Hacienda** —crean terneros, no animales de CUT— y
ampliar el alcance acá era meterse en la pantalla de Terneros. Van en [A-BUG-51](#a-bug-51).

📌 **Qué es un animal sin `fecha_alta`**, para no volver a preguntarlo: al 2026-08-20 son los **8
toros** cargados el 26/04/2026, con caravana interna (3, 7, 18, 42, 48, 49, 67, 68) y sin oficial.
Son **carga inicial de inventario**: ya estaban en el campo cuando arrancó el sistema, así que nunca
"ingresaron" por un movimiento y la pregunta *"¿cuándo entró?"* no tiene respuesta. **No es un error
de carga.** Decisión del usuario: **nunca se omiten por no tener fecha** — van en un bloque aparte.

*(Observación al pasar, sin perseguir: el stock dice **16 toros** y hay **8** identificados. Es la
misma brecha entre cabezas e individuos que va a destapar el control de [A-FEAT-34](#a-feat-34).)*

---

## <a id="a-bug-51"></a>A-BUG-51 — Los otros 3 caminos de alta tampoco setean `fecha_alta`

Hermano de [A-BUG-47](#a-bug-47), que arregló los 2 que alimentan el CUT. Faltan:

| Camino | Dónde |
|---|---|
| Alta manual en la pantalla de Terneros | `components/tab-terneros.tsx:323` |
| Importador de terneros | `app/api/import-terneros/route.ts:174` |
| Importador de pesadas, cuando la caravana no existe | `app/api/import-pesadas/route.ts:322` |

El tercero es el más filoso: inserta con **un solo campo** (`caravana_oficial`), así que crea un
individuo **sin fecha, sin categoría y sin sexo**. Es el camino por el que más fácil entra una
caravana incompleta.

**No afecta a la Planilla de Hacienda**: esos caminos crean terneros, y la página del CUT sólo mira
la categoría CUT. Por eso quedó afuera del alcance de la etapa 3. **Abordar al tocar la pantalla de
Terneros**, junto con las 116 filas fantasma de [A-BUG-44](#a-bug-44).

---

## <a id="a-bug-48"></a>A-BUG-48 — Tres fragilidades en el registro de tacto

**a · UUID hardcodeado.** `:4510` → `const catCUT = 'ce627450-565c-4c68-b8ea-81deab93eabf'`.
Verificado: hoy apunta bien a *Vaca CUT/Descarte*. Pero **20 líneas después** (`:4529`) la misma
categoría se busca **por nombre**. Dos maneras de encontrar lo mismo en el mismo bloque, y un UUID
literal en un proyecto que **ya reconstruyó la base una vez**.

**b · Rodeo ↔ categoría por nombre exacto, sin `else`.** `:4509` →
`categoriasHacienda.find(c => c.nombre === ciclo?.rodeo)`. Hoy funciona porque los ciclos se llaman
`Vaca` y `Vaquillona Preñada`. Si un rodeo se llamara *"Rodeo General"*, `catOrigen` queda
`undefined`, el `if` **no tiene `else`** y **no se registra ningún movimiento, sin un solo aviso**:
el tacto se guarda y el stock no se mueve.

**c · Tacto retrospectivo no mueve el stock.** `:4507` saltea el bloque entero de movimientos. El
ciclo queda con sus `cabezas_vacias` y la hacienda no. Es deliberado, pero deja las dos fuentes
diciendo cosas distintas sin señalarlo.

---

## <a id="a-bug-49"></a>A-BUG-49 — Razón social hardcodeada en la Planilla de Hacienda

`'Ea. Nazarenas'` y `'de Martinez Sobrado'` están escritas a mano en el Excel (`:1543-1544`), el PDF
(`:1691-1693`) y el pie de página (`:1860`).

Choca con `CLAUDE.md` § Datos críticos (*"nunca hardcodear: sale de `DATOS_FISCALES` en
`lib/empresas.ts`"*), regla que existe porque el Libro IVA de PAM y MA salía con la razón social y el
CUIT de MSA impresos.

**Hoy no molesta**: hay un solo establecimiento y `movimientos_hacienda` **no tiene columna de
empresa**. Es el mismo patrón, no el mismo daño. → decisión en [A-DEC-03](#a-dec-03).

---

## <a id="a-bug-50"></a>A-BUG-50 — Categorías fuera de la planilla, descartadas en silencio

La planilla no lee las categorías de la BD: tiene la lista escrita a mano (`CATS_PLANILLA` en
`:1344`, `CATS_TERNEROS` en `:1356`) y cruza **por nombre en minúsculas**. Un movimiento de una
categoría que no está en esa lista se descarta con `if (col === undefined) return` (`:1418`).

**Hoy no se pierde nada**: hay **15** categorías en `categorias_hacienda` y **12** en la planilla;
las 3 que sobran (`Novillito`, `Ternera`, `Ternero`) están **inactivas y con 0 movimientos**.

El riesgo es a futuro: una categoría nueva o reactivada desaparecería del reporte sin aviso. Va
contra `CLAUDE.md` § *Nada se descarta en silencio*.

---

## <a id="a-feat-34"></a>A-FEAT-34 — Rediseño de la página CUT/Descarte, con su control de cierre

**Criterio del usuario (2026-08-20)**: *"la pág. del CUT está hecha justamente para entender la
categoría descarte, que siempre tiene detalles y se precisa tener bien bien"*. Las otras dos páginas
quedan como están.

**Estructura**:

```
A · VENÍAN DE ANTES        (= Stock Anterior de la columna CUT)
B · ENTRARON EN EL PERÍODO (= Reclas. + de la columna CUT)
    columnas: caravana · fecha alta · tipo · pelo · motivo de ingreso · ESTADO AL CIERRE
CIERRE:  venían 8  + entraron 4  − salieron 4  = quedan 8
```

Las salidas **no llevan bloque propio**: van como columna *Estado al cierre* dentro del bloque donde
nació cada animal (`Sigue en CUT` · `Vendida 30/03` · `Muerta 12/05`). Así se ve que de las 4 que
entraron, 3 se vendieron y 1 sigue — que era la pregunta del usuario.

**🎯 El control, que sale gratis**: la página 1 cuenta **cabezas** (de `movimientos_hacienda`, que es
bulk) y ésta cuenta **individuos** (de `terneros`, que es nominal). **Tienen que dar lo mismo.** Si
no dan, hay ventas o bajas sin atribuir a caravanas concretas — que es justo lo que hoy no se ve
([A-BUG-46](#a-bug-46): en agosto la grilla dice 17 y la nominal lista 8).

**Reglas acordadas**: el bloque de las existentes va **siempre**, aunque se repita idéntico mes a
mes · **no** se listan los vendidos en períodos **anteriores** (hoy agosto sigue mostrando 4
vendidas en marzo) · **sí** los que entran y salen dentro del **mismo** período (marzo es el caso
correcto).

⚠️ La página del CUT **no siempre es la 3**: si el mes no tiene movimientos, la de detalle no se
genera y queda en la 2 (`:1793`). Referirse a ella por número es frágil.

---

## <a id="a-feat-35"></a>A-FEAT-35 — Sacar kilos y montos del detalle

**Decisión del usuario (2026-08-20)**: *"en esta planilla no debe figurar montos de venta ni kilos de
venta, sólo movimientos de stock. Si eso ocurre en otro lugar lo podemos ver."*

Hoy la hoja *Detalle* y la página de movimientos del PDF llevan **Peso Total (kg)**, **Precio/kg** y
**Monto Total**. Además de no corresponder a una planilla de stock, **no multiplican** y nada lo
explica → [A-DAT-06](#a-dat-06).

### ✅ HECHO 2026-08-21

Las 3 columnas de plata salieron de la hoja *Detalle* del Excel y de la página de movimientos del
PDF. El detalle quedó en **6 columnas**: `Fecha · Tipo · Categoría · Cantidad · Proveedor/Cliente ·
Observaciones`. La consulta tampoco las pide ya. Anchos y merges reajustados; el PDF ganó aire
(fuente 7 → 7,5 y más espacio para observaciones, que antes salían apretadas).

**Ejemplo — la venta de agosto, como queda ahora:**

```
04/08/2026 | Venta | Ternero Recria | 55 | Pedro Genta | Venta confirmada · 55 caravanas
```

❓ **Una decisión que tomé y conviene confirmar**: dejé la columna **Proveedor/Cliente**. No es un
monto ni un kilo —es *con quién* se hizo el movimiento— y para una venta o una compra es parte del
registro. Si la planilla tiene que ser stock puro, esa columna también sale. **Sin confirmar.**

**Verificación**: la hoja **Planilla quedó idéntica** en las 8, sólo cambió la hoja *Detalle*.
`npm run type-check:diff`: **113 → 113**.

---

## <a id="a-feat-36"></a>A-FEAT-36 — Fila propia para Ajustes y Existencia Inicial

Hoy los `ajuste_stock` no tienen fila: los positivos se muestran dentro de **Compras** y los
negativos dentro de **Mortandad** (`:1424-1427`). **Las dos etiquetas mienten** — un ajuste es
*"corrijo el stock"*, que no es ni comprar ni morirse.

Los dos casos reales de febrero:
- el **recuento inicial de 430 cabezas** (*"Stock Recuento a Salida de Alejandro Coria 29/01/2026"*)
  figura como **Compras**: la planilla dice que se compraron 430 animales;
- la ternera perdida en Onetto (*"como no se señaló, no reconoció que fuera nuestra y la perdimos"*)
  figura como **Mortandad**: no murió, se perdió.

**Propuesta**: fila **Ajustes** (o dos, `+` y `−`) y fila **Existencia Inicial / Recuento** separada
de Compras. Arregla los tres casos de una vez.

📌 Dato para tener en cuenta: el recuento es **al 29/01** pero está cargado el **15/02**, así que no
existe en la planilla de enero y entra como movimiento de febrero.

### ✅ HECHO 2026-08-22

**Cómo se identifica una apertura** — regla del usuario, y es más angosta de lo que yo había
propuesto: es un **`ajuste_stock` positivo sobre una categoría que no tenía ningún movimiento
antes**. ⚠️ **Tiene que ser un ajuste**: si lo primero que aparece en una categoría es un
`cambio_categoria`, eso es una reclasificación y se queda como tal.

**Dónde va**: al **Stock Anterior**, no a una fila propia. Textual del usuario: *"la existencia
inicial se mostraría como stock anterior, exacto"*. 🟨 Y es lo correcto: una apertura no es algo que
**entró** en el mes, es lo que **había**.

**Las filas de Ajustes** (`+` y `−`) se dibujan **sólo en los meses que tienen ajustes** — también
pedido del usuario. Una fila fija en cero todos los meses es ruido en una grilla de 15 columnas.

**Febrero, antes y después:**

| Fila | Antes | Ahora |
|---|---:|---:|
| **Stock Anterior** | 0 | **422** |
| Compras | 422 | **0** |
| **Mortandad** | 1 | **0** |
| **Ajustes −** | *(no existía)* | **1** ← la ternera de Onetto |
| **Existencia Final** | 421 | **421** ✓ |

🎯 **El control**: **ninguna `Existencia Final` cambió** en ninguno de los 7 meses. Lo único que se
movió es de qué fila sale cada número — que era exactamente el objetivo.

⚠️ **Un detalle que casi rompe el PDF**: las filas resaltadas estaban por **índice fijo**
(`[0, 4, 8, 9]`). Con filas que aparecen y desaparecen según el mes, los índices se corren y el
resaltado hubiera caído en la fila equivocada. Ahora se resuelven **por label**.

📌 En el detalle, la apertura tiene su propio bloque **EXISTENCIA INICIAL (recuento)**, y su control
no es contra una fila de la grilla —no tiene— sino contra lo que se sumó al Stock Anterior.

---

## <a id="a-feat-37"></a>A-FEAT-37 — Mortandad completa, y detalle segmentado

**a · La misma muerte está partida en dos lugares y el reporte muestra una mitad.** La app guarda
**dos textos distintos**: la `observaciones` del movimiento y el `motivo_baja` de la caravana. Los
dos casos que lo muestran:

| Fecha | Dice el movimiento | Dice la caravana |
|---|---|---|
| 26/06 | *"Se la detectó pero no llegaron a salvar. Piquete Tapera Alfalfa"* | **222** — *"Empaste"* |
| 02/07 | *"Revisado por whatsapp, no mancha, sin causa comprobable"* | **184** — *"Muerte Súbita"* |

Ninguna de las dos por separado es la historia completa, y el reporte trae siempre la primera.
✅ **El usuario pidió encadenarlas, y que la caravana se indique siempre.**

**Cómo cruzarlas**: no hay FK entre `movimientos_hacienda` y `terneros`, así que va por **fecha +
categoría** (`terneros.fecha_baja = movimiento.fecha` y misma `categoria_id`). Verificado que
funciona en los 3 casos reales. **Y trae su propio control**: si la cantidad del movimiento no
coincide con la cantidad de caravanas encontradas, **hay muertes sin atribuir**.

⚠️ **Alcance limitado**: la tabla nominal es de **terneros**. Los adultos no están — verificado que
`C607` y `B708`, las dos vacas muertas en agosto, **no existen en `terneros`**; su caravana va como
texto libre en observaciones. El usuario lo dio por aceptable: *"si lo pongo en obs termina estando,
porque eso se concatena"*.

**b · Segmentar el detalle de movimientos**, que hoy lista todo corrido. Por motivo o similar —
**a definir con el usuario**.

### ✅ HECHO 2026-08-22 — el punto (a). El (b) sigue abierto

⚠️ **Lo detectó el usuario**: este ítem quedó registrado el 20/08 al auditar abril y **no se había
implementado** — se hicieron los otros y éste no. Las dos mortandades de abril seguían saliendo con
la observación vacía.

**Cómo quedó** (las 4 mortandades del período, ya con el encadenado):

| Fecha | Antes | Ahora |
|---|---|---|
| 15/04 | *(vacío)* | `032 010012326590 — Ternero aguachado debajo de 100 Kg, el más chiquito medio rengo` |
| 25/04 | *(vacío)* | `032 010012326443 — Empaste (inspección Gregorio)` |
| 26/06 | *"Se la detectó… Piquete Tapera Alfalfa"* | `…Piquete Tapera Alfalfa · 032 010012326587 — Empaste` |
| 02/07 | *"…sin causa comprobable"* | `…sin causa comprobable · 032 010012326425 — Muerte Súbita` |

El de julio muestra por qué importaba: *"sin causa comprobable"* + *"Muerte Súbita"* — las dos
mitades juntas son la historia, y el reporte traía la que menos informa.

**Detalles de implementación:**
- Cruce por **fecha + categoría** (no hay FK entre `movimientos_hacienda` y `terneros`).
- Con **más de 4 caravanas** se resume (*"N caravanas"*): el detalle nominal no entra ni aporta.
- **El aviso `⚠ N sin caravana asignada` sale sólo en las categorías que se llevan individuo por
  individuo.** En las de adulto no hay registro nominal y la caravana va como texto libre — las 2
  mortandades de agosto (`C607`, `B708`) quedan como estaban, sin falsa alarma.

**Verificado**: la hoja **Planilla quedó intacta** en las 7 mensuales. `type-check:diff`: **113 → 113**.

✅ **Decidido**: se muestran los **últimos 4 dígitos** de la caravana oficial —
`032 010012326590` → **`6590`**. La caravana entera ocupaba media celda y los 4 finales son los que
se usan para identificarla.

### ✅ HECHO 2026-08-22 — el punto (b): el detalle segmentado

**El criterio elegido**: se segmenta **por concepto**. 🟨 Así se pasa de un número de la página 1 a
los movimientos que lo forman, que es la pregunta que uno le hace al detalle. Los bloques vacíos no
se dibujan.

**El orden lo fijó el usuario (2026-08-22)** y no es el de la grilla:

```
COMPRAS · NACIMIENTOS · VENTAS · MORTANDAD · RECLASIFICACIONES + · RECLASIFICACIONES -
```

🟨 Primero lo que **entra y sale del campo**, y al final las **reclasificaciones**, que son
movimientos internos entre categorías y no cambian el total del rodeo. Las dos reclasificaciones
quedan juntas, que es como se leen: una es el espejo de la otra.

**🎯 Y trae un control gratis**: el total de cada bloque tiene que dar igual que su fila en la
grilla. Si no da, hay movimientos en **categorías que la planilla no tiene como columna** — que la
grilla descarta en silencio ([A-BUG-50](#a-bug-50)) y acá quedan a la vista. El aviso va en el
título del bloque: *"(⚠ la grilla dice N)"*.

**Febrero, como quedó** — y se lee de un tirón:

```
COMPRAS — 422 cab.              el recuento inicial del 15/02, categoría por categoría
RECLASIFICACIONES + — 202 cab.  las 8 al CUT + el destete
MORTANDAD — 1 cab.              la ternera de Onetto, la única baja real del mes
RECLASIFICACIONES - — 202 cab.
```

**Verificado**: los 4 bloques de febrero cuadran contra la grilla **sin un solo aviso**, y la hoja
**Planilla quedó intacta** en las 7 mensuales. `type-check:diff`: **113 → 113**.

📌 Las cantidades se muestran en **valor absoluto** dentro de cada bloque: el signo lo dice el
bloque, y un `-8` bajo el título *RECLASIFICACIONES −* era redundante.

---

## <a id="a-feat-38"></a>A-FEAT-38 — Cuatro mejoras de formato de la planilla

1. **"Sin movimientos en el período"** en vez de una tabla con encabezados y ninguna fila (mayo).
   En el PDF hoy la página directamente no se genera.
2. **Orden estable del detalle.** Hoy es `.order('fecha')` sin criterio secundario: las 6 filas del
   recuento de febrero salen Torito, Ternera, Vaq. Preñada, Ternero, Vaca, Toro — el orden de la
   base, no un orden. Un reporte que se archiva tiene que salir siempre igual, y **los dos lados de
   una reclasificación deberían quedar juntos** (en febrero pasó de casualidad).
3. **Fecha de emisión** en el encabezado. Sin ella, un movimiento retroactivo cambia una planilla ya
   emitida y no hay forma de saber qué versión es cuál. Para papeles de trabajo importa.
4. **El cero se ve `-` en el PDF y `0` en el Excel** (`fmtNum` sólo se aplica al PDF).

---

## <a id="a-dat-05"></a>A-DAT-05 — Corregir los 4 movimientos del pase a CUT de febrero

Los 4 movimientos del 18/02/2026 están con `tipo = 'ajuste_stock'` y deberían ser
`cambio_categoria`: son los que hacen que la planilla de febrero declare **muertas a 8 vacas vivas**
(7 Vaca + 1 Vaquillona Preñada).

- `-7` Vaca / `+7` Vaca CUT/Descarte — *"Vacias tacto - pasan a CUT"* / *"- ingreso CUT"*
- `-1` Vaquillona Preñada / `+1` Vaca CUT/Descarte — ídem

**Los signos ya están bien**: sólo cambia el `tipo`. Con el cambio, la Mortandad de febrero baja de
**8 a 1** y las Compras de CUT quedan en 0.

🛑 **Es un `UPDATE` sobre datos reales → requiere OK explícito del usuario** (`CLAUDE.md` § Datos).
Hacerlo **después** de [A-BUG-45](#a-bug-45), o el próximo tacto vuelve a generar lo mismo.

### ✅ HECHO 2026-08-20 — con OK explícito del usuario, después de [A-BUG-45](#a-bug-45)

```sql
UPDATE productivo.movimientos_hacienda SET tipo = 'cambio_categoria'
 WHERE tipo = 'ajuste_stock' AND observaciones ILIKE '%tacto%';   -- 4 filas
```

**4 filas**, todas del 18/02/2026, los IDs que ya estaban identificados. **Sólo cambió la columna
`tipo`**: cantidades, fechas y observaciones intactas.

**Controles sobre la BD, después del UPDATE**: quedan **0** `ajuste_stock` de tacto · siguen los
mismos **33** movimientos (no se creó ni borró nada) · las reclasificaciones netean **0** · el stock
total sigue en **356**.

**Verificación sobre las planillas** (`_CORREGIDO` → `_TACTO`), y salió como estaba previsto:

| Fila de febrero | Antes | Ahora |
|---|---:|---:|
| Mortandad — Vaca | 7 | **0** |
| Mortandad — Vaq. Preñada | 1 | **0** |
| **Mortandad — Total** | **9** | **1** |
| Compras — CUT/Descarte | 8 | **0** |
| Reclas. − — Vaca / Vaq. Preñada | 0 / 0 | **7 / 1** |
| Reclas. + — CUT/Descarte | 0 | **8** |

🎯 **El control clave pasó**: `Stock Anterior`, `Ingresos`, `Egresos` y `Existencia Final` **no
aparecen en el diff**. Los 8 animales se movieron *entre* filas sin entrar ni salir. Y **marzo a
agosto: cero cambios**. La mortandad de febrero queda en **1** — la ternera de Onetto, la única baja
real del mes.

📌 **Evidencia lateral para [A-FEAT-38](#a-feat-38)**: el diff de la hoja *Detalle* vino con **60+
celdas de puro reordenamiento**. El `UPDATE` cambió el orden en que Postgres devuelve las filas del
18/02 y del 23/02 y, como el detalle se ordena sólo por fecha, salieron barajadas. Verificado que el
contenido es idéntico (mismo conjunto de filas en las 8 planillas). **Un reporte que se archiva y
sale distinto en cada corrida hace que comparar dos versiones sea casi imposible** — es el mejor
argumento para el orden estable, y apareció solo.

---

## <a id="a-dat-06"></a>A-DAT-06 — ✅ RESUELTO 2026-08-25: el 3 % era el DESBASTE

> **No faltaba plata ni había un gasto sin explicar. El usuario tenía razón en que la venta no
> tuvo gastos de venta** — la CZ y el flete están en cero. El 3 % es el **desbaste**, que no es un
> gasto: es la **merma de peso** que descuenta el comprador.

```
peso_total_kg = 16.180 kg              ← kg de BALANZA (brutos), no netos
kgNetos = 16.180 × (1 − 0,03)          = 15.694,6 kg
15.694,6 × $5.670                      = $88.988.382   ← exacto
```

Verificado en `components/modal-confirmar-venta-hacienda.tsx:225-226`: *"los kg de balanza son brutos;
el desbaste es la merma que descuenta el comprador"*. El lote tiene `pct_desbaste = 0,03`.

🟨 **Por qué se veía como un descuadre**: la planilla mostraba `peso × precio` al lado de
`monto_total` y no multiplicaban, porque **el peso es bruto y el monto sale del neto**. Las columnas
de plata ya salieron del reporte ([A-FEAT-35](#a-feat-35)), así que el síntoma desapareció — pero
ahora además está explicado.

📌 **Dato para el costeo de recría**: `peso_total_kg` es el **peso vivo** (de balanza). Sirve
directo como punto de la curva de peso; el neto es sólo para valorizar.

---

## <a id="a-dat-06-viejo"></a>A-DAT-06 (diagnóstico original) — La venta del 04/08 no cierra: falta el 3 %

```
55 Ternero Recría · 16.180 kg · $5.670/kg · monto declarado $88.988.382 · Pedro Genta
16.180 × 5.670 = $91.740.600        diferencia = $2.752.218
```

Medido: el monto es exactamente el **97,0000 %** del producto.

El 3 % coincide con el *"% gastos de venta (3 % hacienda liviana)"* que este mismo archivo documenta
más arriba — **pero el usuario confirmó que esta venta no tuvo gastos de venta**: *"no tuvo gastos de
venta, por eso lo cargué sin gastos de venta"*. Entonces **el 3 % queda sin explicación**.

Sale de la Planilla de Hacienda por [A-FEAT-35](#a-feat-35), pero **el número sigue vivo donde se
use**: ventas y presupuesto. Es la única cosa de toda la auditoría que quedó sin cerrar.

---

## <a id="a-test-35"></a>A-TEST-35 — Planilla de Hacienda con el `Stock Anterior` corregido

Cubre [A-BUG-44](#a-bug-44). Todo se prueba desde **Productivo → Hacienda**.

1. **El número.** Planilla → modo **Mes** → **Agosto 2026**. `Total General` de la fila
   *Existencia Final* tiene que dar **356** (antes daba 372). Y en la misma fila:
   CUT/Descarte **9**, Ternero **42**, Ternera **81**.
2. **Los tres números tienen que coincidir entre sí**, que es el control de verdad:
   - la pestaña **Stock** (suma 356),
   - la planilla en **modo Rango** del **15/02/2026 al 20/08/2026** (356),
   - la planilla de **Agosto** (356).
3. **La cadena.** Sacar las 7 planillas mensuales: el `Stock Anterior` de cada mes tiene que ser la
   `Existencia Final` del mes anterior, **en los 6 eslabones**. Antes fallaba en 4.
4. **Lo que NO tiene que haber cambiado** — es tan importante como lo que sí:
   - **febrero y marzo, idénticos** a como salían antes;
   - las filas **Compras, Nacimientos, Reclas. +, Ingresos, Ventas, Mortandad, Reclas. −,
     Egresos**, sin un solo número distinto;
   - la hoja **Detalle** y la página de **CUT/Descarte**, iguales.

📸 Para comparar están las dos tandas completas (Excel + PDF, 8 períodos cada una):
`backup_planillas_hacienda_2026-08-20/` (antes) y `planillas_hacienda_2026-08-20_CORREGIDO/`
(después). Ninguna de las dos está en git.

---

## <a id="a-feat-39"></a>A-FEAT-39 — Exportar varias planillas de una (✅ HECHO 2026-08-21)

**Pedido del usuario**: *"quiero la posibilidad de exportar varios reportes juntos desde el export
en la app. Puede ser poniendo período y que me pregunte si quiero una sola de punta a punta o una
por mes"*. Hasta ahora eso sólo lo hacía el script de consola; en la app había que repetir el export
mes por mes, eligiendo la carpeta cada vez.

**Cómo quedó**: con **Rango Personalizado**, el modal pregunta *"¿Cómo querés el resultado?"* →
**Una sola, punta a punta** (lo de siempre, es el default) o **Una por mes**. Al elegir *Una por
mes* se anticipa cuántas van a salir y con qué títulos, antes de apretar nada.

**Decisiones de diseño y por qué:**

| Decisión | Motivo |
|---|---|
| Los meses de las **puntas se recortan al rango**, y el título lo dice (*"15/02/2026 al 28/02/2026"*) | Un rango que arranca el 15 no tiene un febrero entero. Rotularlo *"Febrero 2026"* sería mentir sobre lo que el archivo contiene |
| El nombre del mes (*"Marzo 2026"*) sólo si el mes está **completo** | Mismo criterio: el título tiene que describir el contenido |
| La carpeta se elige **una sola vez** para toda la tanda | Preguntarla 14 veces es inusable |
| Con *Una por mes* **no hay preview**: se exporta directo | El preview muestra **una** planilla; ofrecerlo para una tanda de 7 confunde más de lo que ayuda |
| Si el navegador **no** soporta elegir carpeta, avisa antes | Sin carpeta cada archivo cae como descarga suelta y el browser bloquea la descarga múltiple: la tanda quedaría a medias **sin avisar** |
| Progreso *"Generando N de M…"* | Con 7 meses son 14 archivos y varias consultas: sin progreso parece colgado |

**Refactor que lo hizo posible**: `exportarPlanillaHacienda()` se partió en dos —
**`construirPlanilla(desde, hasta, label)`**, que arma el Excel y el PDF y **no guarda nada**, y el
orquestador, que resuelve los períodos, pide la carpeta una vez y guarda. Sin esa separación no se
podía emitir una tanda.

**Verificado**: la partición del rango en meses probada sobre 6 casos (rango con las dos puntas
parciales · meses enteros · un rango dentro de un mismo mes · cruce de año · un mes exacto · dos
días a caballo de dos meses). En los 6: **cubre el rango exacto, sin huecos ni solapes**.
`npm run type-check:diff`: **113 → 113**.

---

## <a id="a-feat-40"></a>A-FEAT-40 — Las cabezas sin caravana figuran igual (✅ HECHO 2026-08-21)

**Corrección de criterio del usuario**, y era mío el error: en [A-FEAT-34](#a-feat-34) puse **la
caravana** como condición para aparecer en el detalle del CUT. La condición correcta es **estar
identificado**. Textual: *"el movimiento existe y es un renglón, o sea que sí está identificado
aunque no tenga caravana: se sabe de dónde viene, se sabe el motivo. Debería figurar como un renglón
en CUT con los detalles que yo imputé, pero sin la caravana."*

**Cómo quedó** — la vaquillona del 08/08, que antes no salía:

```
B · ENTRARON EN EL PERÍODO (1)
  (sin caravana) | 08/08/2026 | Vaquillona Preñada | - | Mal Parió Ternero de 40 Kg | Sigue en CUT
```

Y si el movimiento no tuviera ninguna observación, sale igual con los campos en blanco.

**De dónde sale cada dato**: `fecha` y `motivo` del movimiento de ingreso; el `tipo` (categoría
previa) del **movimiento espejo negativo del mismo día**.

⚠️ **Se agrupa por FECHA, no por movimiento.** En un mismo día puede haber varios ingresos —el tacto
de febrero fueron `+7` de Vaca y `+1` de Vaquillona Preñada— y no hay forma de saber qué caravana
corresponde a cuál. Por fecha el cruce es exacto.
⚠️ Y **`venta` y `mortandad` se excluyen**: se guardan **positivas**, así que sin excluirlas la venta
de 4 del CUT se contaría como un ingreso de 4.

### Los dos avisos, que ahora dicen cosas distintas

| | Cuándo | Qué significa |
|---|---|---|
| 🔴 **ERROR** | el detalle **no cuadra** con la grilla | inconsistencia real — hay que investigar |
| 🟠 **PENDIENTE** | cuadra, pero hay cabezas sin caravana | **falta un dato**, no está roto |
| 🟢 **OK** | cuadra y todas tienen caravana | |

🟨 La distinción importa: antes el rojo saltaba por un dato faltante, y un control que grita por algo
que no está roto se ignora a los dos días.

⚠️ **Limitación conocida**: a una cabeza **sin caravana que se vende** no se le puede seguir la
salida — no hay individuo al que atarla. Ahí la página y la grilla se despegan y salta el rojo. O
sea que **el caso que no se puede resolver es exactamente el que el control detecta**.

**También**: sale la columna **Proveedor/Cliente** del reporte (el campo se sigue viendo y editando
en la grilla de Movimientos). El detalle quedó en 5 columnas: `Fecha · Tipo · Categoría · Cantidad ·
Observaciones`.

**Verificado**: febrero, marzo y mayo cierran **OK sin ninguna fila `(sin caravana)`** —sus ingresos
sí tenían las caravanas—, agosto cierra **9 = 9** con el aviso ámbar, y la **hoja Planilla quedó
intacta** en las 7 mensuales. `type-check:diff`: **113 → 113**.

---

## <a id="a-dat-07"></a>A-DAT-07 — Cliente e intermediario de la venta del 30/03 (✅ HECHO 2026-08-21)

La venta de 4 vacas CUT del 30/03 sólo decía *"Via Pino Torillo"* en observaciones. El usuario
aportó los datos: el **cliente es BALLESTER PAULO CESAR, CUIT 20249560791**, y **Pino Torillo es el
intermediario**.

🛑 **Tres escrituras, con OK explícito del usuario**, una fila cada una:

| Qué | Dónde | Resultado |
|---|---|---|
| Alta de **BALLESTER PAULO CESAR** (`20249560791`), `es_cliente = true`, `es_proveedor = false` | `public.proveedores` | `afb2fe60…` |
| Alta de **Pino Torillo** | `productivo.intermediarios_venta` | `88d48cc0…` |
| `proveedor_cliente` + `cuit` en el movimiento del 30/03 | `productivo.movimientos_hacienda` | `47f28467…` |

**`es_proveedor = false`** a propósito: la regla dice `true` sólo si tiene factura de compra a su
nombre. Ballester es cliente puro.

⚠️ **`public.proveedores` es un maestro compartido** —de ahí salen CBU, mails y el pre-filtro por
CUIT del motor de conciliación—. Fue un **INSERT**, aditivo: no pisa nada de nadie.

📌 **Por qué NO se movió *"Via Pino Torillo"* a `proveedor_cliente`**, que era la idea original: el
sistema **ya distingue** cliente, `destino_id` e `intermediario_id`, y **Pedro Genta está cargado
como intermediario** aunque en el movimiento de agosto figure en el campo del cliente. Mover a Pino
Torillo ahí habría repetido esa confusión. Se deja en observaciones porque **el movimiento manual no
tiene campo de intermediario** — si se borraba, el dato se perdía del todo. → [A-FEAT-41](#a-feat-41).

---

## <a id="a-feat-41"></a>A-FEAT-41 — La venta manual de hacienda no registra al cliente ni al intermediario

**Dos huecos del alta manual de movimientos**, destapados por [A-DAT-07](#a-dat-07):

1. **No da de alta al cliente en `public.proveedores`.** Va contra `CLAUDE.md` § Contrapartes
   (*"si entra un comprobante, su contraparte tiene que quedar en el maestro — upsert, nunca sólo
   `UPDATE`"*). Hubo que crear a Ballester a mano. `proveedor_cliente` es **texto libre**, sin
   vínculo al maestro.
2. **No tiene campo de intermediario**, que sí existe en el circuito de *confirmar venta*
   (`intermediario_id` → `productivo.intermediarios_venta`). Por eso el intermediario termina como
   texto libre en observaciones (*"Via Pino Torillo"*).

🟨 El mismo problema explica que **Pedro Genta**, que está en `intermediarios_venta`, figure como
`proveedor_cliente` en la venta de agosto: el campo *cliente* del modal es texto libre y no valida
contra nada.

---

## <a id="a-test-38"></a>A-TEST-38 — Export de varias planillas juntas

1. **Productivo → Hacienda → Planilla → Rango Personalizado**, del **15/02/2026** al **21/08/2026**,
   opción **Una por mes**. Antes de exportar tiene que anunciar **7 planillas (14 archivos)** y
   listar los títulos.
2. Al exportar: pide la carpeta **una sola vez**, muestra *"Generando N de 7…"* y deja **14
   archivos** adentro.
3. **Los recortes**: el primero va del **15/02 al 28/02** (no "Febrero 2026" entero) y el último del
   **01/08 al 21/08**. Los del medio sí llevan el nombre del mes.
4. **Que no se rompió lo de antes**: con **Una sola, punta a punta** tiene que salir **1 planilla**
   y con **Por Mes** también, igual que siempre — y el **preview** tiene que seguir funcionando en
   los dos casos.
5. Contra los archivos ya generados: los 7 meses tienen que coincidir con
   `planillas_hacienda_ACTUAL/`, salvo febrero y agosto, que ahí son **meses enteros** y acá salen
   **recortados** al rango.

---

## <a id="a-feat-43"></a>A-FEAT-43 — Costeo de recría: el modelo, acordado y validado

> **Estado**: la **lógica está cerrada y probada contra datos reales**. Falta llevarla a la app.
> **Maqueta**: `scripts/maqueta-costo-recria.mts` genera `Maqueta_Costo_Recria.xlsx` (11 hojas,
> 429 fórmulas, auditable) y `Resumen_Costo_Recria.xlsx` (una carilla + una solapa por rodeo).
> ⚠️ **Los Excel tienen fecha de vencimiento**: cuando la app calcule esto, pasan a ser el **caso
> de prueba**, no la herramienta. No deben volverse una segunda fuente de verdad.

### El problema

Los terneros de recría comen desde el destete. Se vende una parte (55 el 04/08) y hay que saber
**cuánto comieron esos 55** — sin tomar inventario en cada venta, que es inviable. Y el maíz que
sobra en el silo no puede cargársele a nadie.

### El modelo, en cuatro reglas

**1 · Comprar no es consumir.** La compra entra a un stock (es un activo); el **costo** es el
consumo. Así el sobrante **se queda en el silo y nunca toca el costo de nadie** — y desaparece la
necesidad de inventariar en cada venta, que era el nudo original.

**2 · El total es real; el reparto es teórico.**
```
consumo del tramo = stock inicial + entregas − stock final     ← medido, no estimado
```
⚠️ **Un corte existe cuando hay una MEDICIÓN, no cuando llega un camión.** Si no se declara stock,
no hay corte. Si se declara cero, es cero. Si se declaran 10 ton, son 10 ton.

**3 · La clave de reparto es el KILO-DÍA, siempre.** La comida se sirve al grupo y adentro del
corral el que pesa más come más — con ración por día **y** a discreción. Textual del usuario:
*"esto es así en la realidad, no es invento mío"*.
🟨 Se probó con cabeza-día para el régimen fijo y se descartó: le cobraba lo mismo al de 150 kg que
al de 300. La diferencia medida fue **+10,1 %** para los 55.
📌 **El régimen (por día / a discreción) se declara igual**, pero sirve para **proyectar y
controlar**, no para repartir.

**4 · El `%PV` sale del dato, no se supone.**
```
% del peso vivo = consumo real ÷ (peso × días de todo el rodeo)
lo que comió cada uno = ese % × su peso × sus días
```
Dio **1,07 % · 1,46 % · 1,54 %** por tramo — creciente, coherente con la ración que subió y después
el autoconsumo. 🟨 Es el número que uno **mira y juzga**: si diera 0,4 %, falta una entrega.
Las participaciones suman 1, así que **el reparto nunca se va del total real**.

### Las 7 decisiones tomadas

| # | Decisión | Motivo |
|---|---|---|
| 1 | **Kilo-día siempre**, una sola clave | el pesado come más en los dos regímenes; y en la app no se puede cambiar la fórmula en vivo |
| 2 | **Precio por tramo**, no promedio del período | un promedio le carga a los 55 maíz comprado **después** de que se vendieran |
| 3 | **Peso vivo para el consumo, peso neto para la plata** | la balanza da bruto; el desbaste es sólo para valuar |
| 4 | **El peso sale de las pesadas**, nunca de una ganancia estimada | la ganancia es un supuesto, la pesada es un hecho |
| 5 | **La mortandad es un costo** y se adjudica | si se hubieran vendido, se vendían vivos |
| 6 | Los muertos se valúan a **su peso real**, no al promedio | los 3 machos pesaban 141 kg contra 199: los que se mueren son los flojos. Con el promedio se exagera 40 % |
| 7 | El costo **se congela** al precio de la compra | comieron maíz que ya estaba comprado |

### Los 6 controles, y todos cierran

```
Maíz: comprado − consumido = stock                     5.800 kg  = lo declarado
Plata: comprado = imputado + valor del remanente             $0
Mezcla 90/10 predice el maíz del último tramo           16.650 kg contra 19.200: cierra
Ración implícita                                    2,95 kg/cab/día contra los 3 declarados
Rodeo: destete − muertes − ventas = las que quedan     130 cabezas
Entrada de los 185 vivos + los 4 muertos = la de los 189     253.249.089 = 253.249.089
Nominal vs movimientos al 06/05                            187 = 187
```

### ⚠️ Qué es exacto y qué es convención

- **El TOTAL es exacto**: entraron 189, salen 185; la pérdida aparece sola.
- **Los PARCIALES llevan convenciones** y no pueden ser exactos: un animal que murió en abril no
  "pertenecía" a la venta de agosto. Pero **la convención mueve plata entre grupos y nunca cambia
  el total** — los 3 márgenes suman exactamente el total. Por eso **el total es el control de los
  parciales**, igual que en la Planilla de Hacienda.

### El resultado con los datos reales (al 24/08/2026)

| Grupo | Cab. | $ entrada | $ mortandad | $ comida | Margen/cab |
|---|---:|---:|---:|---:|---:|
| Los 55 vendidos | 55 | 80.017.985 | 1.518.936 | 4.420.416 | **$55.110** |
| Machos que quedan | 49 | 61.841.155 | 1.353.234 | 4.800.541 | $205.428 |
| Hembras que quedan | 81 | 107.186.940 | 1.330.840 | 8.222.739 | $134.392 |

🔴 **La alimentación es el 5,5 % del valor del animal; el precio de entrada es el 93 %.** Afinar el
reparto del maíz mueve mucho menos que acertar el precio de transferencia de cría a recría.

### Lo que falta

1. 🔴 **El precio de entrada** — hoy $7.000/kg para todos. Los 55 eran más pesados: su $/kg real
   debería ser **menor**. 🟨 **`precios_hacienda` ya tiene bandas de peso y `resolverPrecioHacienda()`
   ya las resuelve** — la misma función que valúa la venta puede valuar la entrada, y les daría
   precios distintos automáticamente porque caen en bandas distintas.
2. **El precio de venta de los machos** que quedan (hoy $6.000, supuesto).
3. **Pasturas y verdeos** — la pastura se amortiza en los años que dura, el verdeo se consume
   entero en su ciclo. `actividad_insumos` ya tiene `has_aplicacion` y `amortiza_anios`.
4. **Sanidad** — ya funciona por orden de aplicación (categoría + cabezas).
5. **El puente compra → entrega → factura** → [A-FEAT-44](#a-feat-44).
6. **Dar de alta maíz y concentrado** en `stock_insumos`: hoy la categoría *Alimento balanceado*
   existe **sin un solo producto**.

📌 **Dato del negocio, del usuario**: *"siempre está la posibilidad de tratar al negocio como uno
solo y calcular de punta a punta una vez vendido todo. Pero hay decisiones diferentes adentro y es
bueno saber cómo te fue con una cosa y con la otra."* → **la app tiene que dar los dos números**, el
consolidado y el segmentado, y el consolidado es el control del segmentado.

---

## <a id="a-feat-44"></a>A-FEAT-44 — El puente COMPRA → ENTREGA → FACTURA para insumos

Hoy la cadena está cortada y el costo productivo nunca llega al lote:

```
Factura ARCA de maíz  →  gasto del mes en el plan de cuentas
                         (y ahí muere: no toca el stock ni el lote)
```

`productivo.movimientos_insumos` **no tiene `factura_id`** — sólo `proveedor` y `cuit` como texto.

**Son TRES momentos, no dos**, y la app tiene que aceptar conocimiento parcial en cada uno
(descripción del usuario):

| # | Momento | Qué se sabe |
|---|---|---|
| 1 | **Compra** | *"compré tanto"* — cantidad, sin precio todavía (se pide contra pizarra) |
| 2 | **Entrega** | *"recibí este día"* — **es la que mueve el stock** |
| 3 | **Factura** | llega después y **trae el precio** |

⚠️ **La entrega y la factura NO coinciden, y no es una excepción**: Longo facturó el 13/07 lo
entregado el **24/06**, y el 14/08 lo entregado el **24/07**. Si el stock dependiera de la fecha de
factura, el maíz habría "llegado" 20 días tarde y **los tramos de consumo salen mal**.

**Y facturado ≠ entregado en cantidad**: la FC del 13/07 fue por 25 ton y se entregaron 20,1; la del
14/08 por 20,1 y se entregaron 25. **El total sí coincide** (45,1 ton). Las 4,9 de diferencia son un
**anticipo que viaja con su propio precio** — así costeado, cierra exacto contra los $12.055.205.

**Mecanismo propuesto por el usuario**: al asignarle a una factura una cuenta contable que sea de
insumo (`4230501 MAIZ`, `4230502 ALIMENTO BALANCEADO`, `4230504 CONCENTRADO` — **las tres ya
existen**), la app pide producto, cantidad y unidad, y crea el movimiento con su precio. *"Un
movimiento, muchos impactos."*

**Tres cosas a resolver antes de diseñarlo:**
1. **Una factura puede traer varios insumos** → es *una factura = N líneas*, no 1:1. Si se diseña
   1:1 hay que rehacerlo.
2. **El costo va NETO, sin IVA** — el IVA es crédito fiscal, no costo del animal.
3. **El flete** suele venir en otra factura. Contablemente corresponde que encarezca el kilo.

📌 Pendiente de datos: la factura de **Biofarma (concentrado) no tiene cuenta contable asignada**, y
hay una de **Pereyra** que fue a otra cuenta por un error de facturación del proveedor.


### ✅ Hecho el 2026-08-26

**Tabla nueva `productivo.entrega_factura`** — el vínculo es **muchos a muchos**, y tiene que serlo.

| | |
|---|---|
| FC 13/07 por **25,0 t** | se habían entregado **20,1 t** el 24/06 |
| FC 14/08 por **20,1 t** | se entregaron **25,0 t** el 24/07 |

Una factura cubre parte de dos entregas y una entrega la cubren dos facturas. Las **4,9 t** de
diferencia son un anticipo que viaja con su propio precio. **Un `factura_id` en el movimiento
obligaría a inventar una correspondencia que no existe.**

**Lo que aporta**: el precio de la entrega deja de ser un número tipeado y pasa a ser el
**promedio ponderado de las facturas que la cubren** — rastreable hasta el comprobante. El manual
queda de respaldo (dato real por default, otra vez).

**Los dos controles**, visibles cierren o no:

| Control | Qué destapa |
|---|---|
| *Lo entregado tiene factura* | mercadería recibida y todavía sin facturar |
| *Lo facturado está aplicado* | **anticipos**: pagado y no recibido |

Las dos situaciones son normales — **lo que no es normal es no verlas**.

**Verificado** con `scripts/verificar-entregas-facturas.mts` sobre el caso Longo: las dos facturas
quedan aplicadas enteras, las 45,1 t cubiertas, y los precios derivados coinciden con los de la
maqueta.

**Sin FK a la factura, a propósito**: `comprobantes_arca` existe en `msa`, `pam` y `ma`; una FK
obligaría a elegir una empresa en la estructura. Se guarda la empresa al lado, igual que
`stock_ventas.comprobante_id`, que tampoco tiene FK.

⏸️ **Lo que sigue sin existir es el PRIMER momento**: *"compré tanto"* (el pedido). Hoy la cadena
arranca en la entrega. No bloquea nada — el pedido no mueve stock ni trae precio.

---

## <a id="a-feat-45"></a>A-FEAT-45 — EL MAPA DEL CIRCUITO

**El contenido vive en `MODULO_HACIENDA.md` § 15** — es diseño, y ésa es su dimensión. Acá queda el
ítem para poder referenciarlo desde los demás pendientes.

Nació el 2026-08-26 de un pedido concreto del usuario: *"me estás queriendo mostrar los lugares de la
app y para qué sirven"*. No se podía discutir el plan sin eso, porque **cada pantalla parecía hacer lo
mismo que otra**.

Las 3 decisiones de diseño que salieron, y que no se re-discuten:

| Dónde | Qué vive ahí |
|---|---|
| **Margen por actividad** | **la plata** — ingresos, costos, resultado |
| **Ciclo de recría** | **la eficiencia productiva** — kg, mortandad, conversión, kg/ha/año. **Nada de plata** |
| **Tramo del lote** | **el puente** — es lo único que conecta el plan con el dinero |

Y la consecuencia práctica: **la maqueta de [A-FEAT-43](#a-feat-43) no es una pantalla nueva**. Es un
cálculo que se derrama en tres lugares que ya existen — la medición al stock de insumos, el reparto al
motor, el resultado al Margen como despliegue.

---

## <a id="a-bug-54"></a>A-BUG-54 — El tramo se guarda aunque le des Cancelar

`components/panel-lotes-hacienda.tsx` § `SeccionTramos`. Los tres writes son inmediatos:

| Acción | Qué hace |
|---|---|
| Botón `+ tramo` | `INSERT` en `lote_tramos` **en el click**, con `fecha_hasta` = desde + 6 meses |
| Cambiar actividad / fecha / ha | `UPDATE` en el `onChange` de cada campo |
| Tacho | `DELETE` inmediato |

El **Cancelar** del modal no revierte nada, porque esos writes nunca pasaron por el estado del
formulario. Al usuario le pasó el 2026-08-26: canceló, y el tramo quedó.

⚠️ **Y quedó mal**: `fecha_hasta` = **04/08/2027** en vez de 2026. Nada validó el año, y el efecto fue
que *Costos de producción* proyectó ~$3,5 a $5,1 M **por mes, indefinidamente**, para un lote que ya
se vendió.

**Fix — dos caminos, hay que elegir uno:**
1. El tramo se edita en memoria y se guarda con el modal (coherente con el resto del formulario).
2. La sección **dice explícitamente** que se guarda sola, y el botón pasa a llamarse *Cerrar*.

**Y en los dos casos**: validar que el tramo no se extienda más allá de la fecha de venta del lote.

*Motivo: es el mismo modo de falla de siempre — el silencio miente. No avisó que guardaba, no avisó
que el año estaba mal, y el número que salió parecía plausible.*

---

## <a id="a-bug-55"></a>A-BUG-55 — El consumo se estima por lote y nunca se concilia contra lo comprado

**El bug conceptual más caro de esta línea de trabajo.**

⚠️ **Corrección de una versión anterior de este ítem** (2026-08-26): llegué a escribir que la app le
cobraba a los 55 la comida de los 189. **Es falso** y lo verifiqué en el código: `consumoMensual()`
multiplica la ración **por las cabezas del propio lote**, así que estima lo que comieron *esos* 55.
El problema es otro y es peor.

### Lo que realmente pasa

Los tramos cuelgan de `stock_lotes`, y **sólo hay lotes de lo que se va a vender**. En la recría 2026
el único lote con tramo es el de los 55.

| | La app | La realidad |
|---|---|---|
| Cabezas que consumen | **55** | **189** |
| Los otros 134 | **no existen para el costo** | comieron del mismo silo |
| Precio del maíz | **$270/kg**, de la receta | ~$255 a $267/kg, de 5 facturas distintas |
| Precio del concentrado | **$745/kg**, de la receta | el de la compra de 3.000 kg |
| ¿Cierra contra lo comprado? | ❌ **nada lo compara** | — |

### Por qué importa

1. **Le faltan dos tercios del rodeo y no lo dice.** Los 134 que quedan no tienen lote —porque
   todavía no se van a vender— así que su comida no está en ningún lado.
2. **El precio es teórico.** Sale de la receta, no de las facturas. El usuario lo señaló primero:
   *"hay que controlar lo adjudicado con lo consumido y con su precio real, si no todo se irá
   dispersando"*.
3. **No hay control posible.** Un número estimado que nunca se compara contra lo comprado no se puede
   auditar: puede estar al doble o a la mitad y nadie se entera.

### Hacia dónde va

**El consumo es una propiedad del RODEO** —lo que entró al silo y lo que se midió al final—, no de un
lote de venta. El lote es el destinatario del reparto, no la fuente del dato.

Es exactamente lo que resolvió la maqueta de [A-FEAT-43](#a-feat-43): se mide el total del rodeo y se
reparte por kilo-día entre los grupos, vendidos y no vendidos. La estimación por receta no se tira —
**pasa a ser el presupuesto contra el que se compara lo real**.

---

## <a id="a-bug-56"></a>A-BUG-56 — Dos motores para el mismo costo, y cada uno sabe la mitad

Las mismas filas de `productivo.actividad_insumos` las resuelven **dos funciones distintas**:

| | `resolverCostoDirecto()` | `consumoMensual()` |
|---|---|---|
| Archivo | `lib/presupuesto/margen.ts` | `lib/productivo/actividades.ts` |
| La usa | **Presupuesto → Margen por actividad** | **Presupuesto → grilla → Costos de producción** |
| Trabaja sobre | la actividad y la campaña | **el lote y su tramo** |
| Ración (`pct_racion`, `kg_cabeza_dia`) | ❌ *"necesita la curva de peso y los tramos"* | ✅ resuelta |
| Cadena de ajustes · IPC · 3 ranuras · histórico | ✅ | ❌ |
| Amortización (`amortiza_anios`) | ✅ (es del margen) | ❌ (a propósito: el presupuesto es caja) |
| Costo por hectárea | contra las ha de la **actividad** | contra las ha del **tramo** → [A-BUG-57](#a-bug-57) |

**Verificado en pantalla el 2026-08-26**: el usuario cargó un tramo, *Costos de producción* mostró
Recría con números, y el **Margen siguió mostrando "sin calcular"**. Los dos leyendo la misma receta.

Es el patrón de `buscarPrecio()` vs `resolverPrecioHacienda()` otra vez. **Si quedan los dos vivos, en
tres meses dan distinto y no se sabe cuál creer** — y son las dos pantallas que el usuario mira para
decidir.

⚠️ **No es un merge trivial**: cada uno tiene capacidades que al otro le faltan, y la amortización
tiene que seguir estando **sólo** en el margen. Hay que diseñarlo, no fusionarlo a ojo.

---

## <a id="a-bug-57"></a>A-BUG-57 — Los costos por hectárea no llegan a la grilla mensual

La recría tiene **60 ha** cargadas en `campo_campana_actividad` (campaña 26/27), y ahí se siembran
pasturas y verdeos que **cuestan y van sobre toda la recría, no sobre un lote**.

Un costo `monto_ha` de esa actividad hoy:

| Dónde | Contra qué hectáreas | Resultado |
|---|---|---|
| **Margen** | las de la actividad (60) | ✅ bien |
| **Costos de producción** | las del **tramo**, que están vacías | ❌ **cero** |

Y si se llenaran las del tramo, con **dos lotes** se contaría **dos veces**, porque las 60 ha son de
la actividad y no de cada lote.

📌 El usuario lo planteó así: *"la recría sí tiene has, ya está puesta que son 60… ahí se siembran
pasturas y verdeos y tienen costo pero van sobre toda la recría y no sobre un lote"*. Y agregó que si
alguna vez se quiere segmentar ese costo por lote, **se verá más adelante** — hoy no hace falta.

Hermano de [A-BUG-56](#a-bug-56): el mismo insumo, dos motores, dos resultados.

---

## <a id="a-bug-58"></a>A-BUG-58 — El checkbox de ganancia diaria no responde, y la columna Ha es ilegible

Reportado por el usuario el 2026-08-26, en el tramo de un lote
(`panel-lotes-hacienda.tsx` § `SeccionTramos`):

1. **«Usar la ganancia diaria de arriba en vez de la de las actividades»** — tildarlo no tiene efecto
   visible. Escribe `stock_lotes.ganancia_override`, pero el modal abierto no refleja el cambio.
   Sospecha: el prop `lote` del modal no se refresca con el `onCambio()`.
2. **La columna «Ha» es demasiado angosta** (`w-16`) para leer lo que se escribe.

---

## <a id="a-feat-46"></a>A-FEAT-46 — Avisar cuando hay una pesada nueva y el presupuesto sigue con el peso viejo

**Decisión del usuario, 2026-08-26.** Ya estaba decidido que la ganancia diaria y el peso de partida
de un lote **no se actualizan solos** — el usuario los pone y su valor manda. Eso no cambia.

**Lo que falta es el aviso.** Textual: *"eso habíamos dicho que no queríamos que sea automático, pero
sí debería haber una alerta en ese caso. Si hay nueva pesada, presupuesto alertar de necesidad de
actualizar."*

- Detectar que existe una pesada **posterior** a la que el lote está usando (`fecha_peso`).
- Marcarlo en el **Margen** y en el **Presupuesto**, con el dato nuevo a la vista para poder decidir.
- **No pisar nada**: el usuario actualiza si quiere.

*Motivo: es la regla del control visible. No actualizar automático está bien; no avisar, no —
el número queda viejo y nada lo dice.*

---

## <a id="a-dec-04"></a>A-DEC-04 — Las cuentas de producción: apagadas hacia adelante, llenas hacia atrás

**Regla enunciada por el usuario el 2026-08-26**, corrigiendo el diseño actual:

> *"No debe presupuestar hacia adelante sobre lo consumido, porque la única fuente de verdad hacia
> adelante es el plan productivo. Pero para atrás sí debe llenar con datos."*

**Hoy la app no distingue las dos direcciones.** `esProduccion()` en `lib/presupuesto/modos.ts`
excluye por completo:

| Cuentas | Motivo que muestra hoy |
|---|---|
| `421*` | *"Agricultura: ya se presupuesta en Actividades y costos"* |
| `42305*` (incluye **4230501 MAÍZ** y **4230504 CONCENTRADO**) | *"Alimentación: ya entra como ración en Actividades y costos"* |
| `42312 · 42315 · 42322 · 42323 · 42324` | *"Verdeo: ya entra por hectárea"* |

🔴 **Y ahí está el agujero completo del maíz**: el presupuesto lo excluye **porque supone** que entra
por la ración, y la ración da cero porque no había tramos. **Excluido de un lado y sin calcular del
otro — el maíz no está en ningún lado.**

**La regla correcta**: hacia adelante manda el plan productivo (la exclusión está bien); hacia atrás
mandan las facturas y la cuenta tiene que mostrarlas.

Y es también el mecanismo del **check de duplicación** que pidió el usuario para las facturas
adjudicadas a una actividad: la forma buena ya existe en `tab-presupuesto.tsx` — *"la cuenta queda
afuera **porque tiene variable**, no porque alguien la escribió en el código"*. Aplicado a esto:
**la adjudicación más específica gana, y lo adjudicado se DESCUENTA del reparto general — no se
excluye la cuenta entera**, así el total nunca se mueve.


### ✅ RESUELTA — 2026-08-26

**La exclusión es de la PROYECCIÓN, no de la historia.**

`esProduccion()` sigue apagando la proyección de `421*`, `42305*` y las del verdeo — eso estaba
bien. Lo que faltaba era decir en voz alta que **lo ya gastado se sigue mostrando**: son facturas
reales, y esconderlas es peor que duplicarlas — **de un lado se ve el error, del otro no**.

| Qué se pregunta | Con qué |
|---|---|
| *"¿la proyecto hacia adelante?"* | `esProduccion(nro)` — no, la aporta el plan productivo |
| *"¿muestro lo ya gastado?"* | `esProduccionHaciaAtras(nro)` — **siempre sí** |

Existen como dos funciones y no como una para que el que llama tenga que decir **qué está
preguntando**. Confundir las dos es exactamente lo que dejó al maíz sin aparecer en ningún lado.

Y en la pantalla de cuentas, la fila excluida ahora lo dice: *«Excluida sólo hacia adelante: la
proyección la aporta el plan productivo. Lo ya gastado se sigue viendo — son facturas reales.»*

---

## <a id="a-test-41"></a>A-TEST-41 — El tramo de un lote respeta Guardar y Cancelar

**Dónde**: `Productivo → Evolución Rodeo →` los lotes de venta → abrir un lote → bloque violeta
*Actividades del lote*.

| # | Qué hacer | Qué tiene que pasar |
|---|---|---|
| 1 | `+ tramo`, cambiarle las fechas, **Cancelar** | al reabrir el lote **no quedó nada** |
| 2 | Lo mismo pero **Guardar** | el tramo quedó, con las fechas que pusiste |
| 3 | Borrar un tramo con el tacho y **Cancelar** | el tramo **sigue estando** |
| 4 | Borrar un tramo y **Guardar** | desapareció |
| 5 | En un lote **con fecha de venta**, `+ tramo` | el **Hasta** sale con la fecha de venta, no con +6 meses |
| 6 | Correr el Hasta más allá de la venta | aparece el **aviso ámbar** *"termina después de la venta"* |
| 7 | Tildar **«Usar la ganancia diaria de arriba»** | se tilda, aparece *← activo* y **la curva de peso cambia** |
| 8 | Mover una fecha y mirar el bloque de abajo | el **costo de alimentación se recalcula en vivo**, antes de guardar |

⚠️ **La columna «Ha» ya no está.** Las hectáreas de una actividad viven en *Campos* y son de la
actividad, no del lote — ponerlas acá las contaba una vez por lote. Ver [A-BUG-57](#a-bug-57).

---

## <a id="a-feat-47"></a>A-FEAT-47 — Mediciones de stock: el consumo se mide, no se estima

**Hecho el 2026-08-26.** Es el primer paso ejecutable de [A-FEAT-43](#a-feat-43): sin un lugar donde
anotar cuánto quedaba, no se puede cargar nada de lo demás.

### Qué se agregó

| Pieza | Qué hace |
|---|---|
| `productivo.mediciones_insumo` | tabla nueva: `insumo_stock_id · fecha · cantidad · notas`, única por insumo+fecha |
| `lib/productivo/consumo.ts` | el cálculo, sin UI: tramos, consumo, precio por tramo, reparto y controles |
| `components/panel-mediciones-insumo.tsx` | la pantalla, desde el botón **Mediciones** de cada insumo |
| `scripts/verificar-consumo.mts` | corre el lib contra los datos reales de la recría 2026 |

### ⚠️ Por qué una tabla aparte y no `movimientos_insumos`

**Una medición es un NIVEL, no un flujo.** Meterla ahí obligaría a que la columna `cantidad`
signifique a veces *"entró/salió tanto"* y a veces *"había tanto"*. Ese es exactamente el bug que
costó 16 cabezas en la Planilla de Hacienda: el signo no alcanzaba y había que mirar el `tipo`.

### Las reglas que implementa

1. **Cada medición corta un tramo.** Con dos (apertura y cierre) hay uno; con cuatro, tres. Misma
   regla — que era el requisito del usuario: *"debe funcionar si hay medición sólo de punta a punta,
   pero puede haber intermedias"*.
2. **Precio POR TRAMO**, ponderado por las entregas que entraron en él. Un promedio del período le
   cargaría a lo vendido en agosto el maíz comprado en septiembre.
3. ⚠️ **Una entrega que llega EL DÍA del corte pertenece al tramo SIGUIENTE** — el stock se mide al
   recibirla, antes de descargar.
4. **Nunca cero por "no sé"**: sin precio el costo del tramo es `—` y sube a faltantes.

### Los 3 controles, verificados con datos reales

| Control | Resultado |
|---|---|
| lo que había + lo que entró = lo consumido + lo que queda | ✅ 67.660 = 67.660 |
| la suma de los grupos = el consumo total | ✅ 61.860 = 61.860 |
| lo comprado está consumido o en el stock | ✅ 67.660 = 67.660 |

Y de yapa: **el % del peso vivo sale de dividir**, así que el `racion_pct_pv` cargado en la actividad
(1,5 %) pasa de supuesto a **control**.

### Lo que NO hace todavía

**El reparto entre grupos de animales no está conectado.** El lib ya lo sabe hacer —recibe los grupos
con su kilo-día y devuelve la participación—, pero nadie le pasa los grupos: eso necesita la línea de
tiempo del rodeo de recría. Es el paso siguiente, y sigue en [A-FEAT-43](#a-feat-43).

📌 **Un aprendizaje de la verificación**: conviene poner **una medición el día que arranca la
ración**. Si no, el primer tramo abarca días en que no se comió y el control del % del peso vivo sale
diluido (dio 0,92 % en vez de ~1,4 %). El total no se mueve — pero el control pierde filo.

---

## <a id="a-bug-59"></a>A-BUG-59 — El desbaste y la CZ se proyectan desde HOY, no desde la pesada

**Dónde**: `components/panel-lotes-hacienda.tsx` § `ModalDesdePesada`, en el `payload` de `aplicar()`.

```
pct_desbaste = pctDesbaste(categoria, peso + (fecha_venta − HOY) × ganancia)
                                              ^^^^^^^^^^^^^^^^^
                                              debería ser fecha_peso
```

Pero en el mismo `payload`:

| Campo | Qué guarda |
|---|---|
| `peso_base_kg` | el promedio real **de la pesada** |
| `fecha_peso` | **la fecha de la pesada** |

**El peso de partida es de una fecha y los días se cuentan desde otra.**

### El caso real (usuario, 2026-08-26)

| | |
|---|---|
| Pesada | 03/08/2026, promedio 211,9 kg |
| Hoy | 26/08/2026 |
| Venta | 20/09/2026 |
| Ganancia | 1 kg/día |
| **Peso correcto a la venta** | 211,9 + 48 días = **259,9 kg** |
| **Peso que usa para la banda** | 211,9 + 25 días = **236,9 kg** |
| **Diferencia** | **23 kg** |

23 kg alcanzan para caer en otra banda de peso, y de la banda salen el desbaste, la CZ y el precio.

⚠️ **El resto de la app cuenta la ganancia desde `fecha_peso`** —así lo pide el comentario de
`LoteVenta.fecha_peso` en `lib/presupuesto/margen.ts`, justamente para no sumar dos veces el engorde
ya incluido en el peso cargado. Acá quedó desalineado.

**Fix**: contar los días desde la fecha que corresponde al peso — `fecha_peso` si el peso sale de la
pesada, `hoy` sólo si se puso a mano (que es lo que ya hace la línea de al lado).

---

## <a id="a-bug-60"></a>A-BUG-60 — Con fecha de venta, la pantalla sigue mostrando el peso de hoy

Mismo modal. Cada grupo muestra:

> *pesada 211,9 kg → **hoy 235,9 kg** (24 días)*

y el placeholder del campo de peso también es el de hoy. **Si ya cargaste la fecha de venta, el
número que importa es el peso A LA VENTA**: es con el que se factura, y es el que decide la banda.

Lo marcó el usuario: *"le pongo fecha de venta pero el kilaje me lo muestra a la fecha de hoy"*.

**Fix**: cuando hay fecha de venta, mostrar `pesada → a la venta (N días)`, y dejar el de hoy como
dato secundario. Hermano de [A-BUG-59](#a-bug-59): **uno muestra mal, el otro guarda mal.**

---

## <a id="a-bug-61"></a>A-BUG-61 — El selector de «cuáles» sigue habilitado cuando te llevás todos

Cuando la cantidad iguala a las cabezas del grupo, elegir *los más pesados* / *los más livianos* /
*promedio* **no significa nada**: son todos, y el promedio es el mismo en los tres casos.

El bloque de vista previa ya lo contempla (`if (cant <= 0 || cant >= g.pesos.length) return null`),
pero el selector queda visible y habilitado. Confunde, y peor: **sugiere que el número podría
cambiar**.

Lo marcó el usuario: *"si pongo vender todo lo posible no me debería dejar elegir lo más pesado, lo
más liviano o promedio… porque si es todo es todo"*.

**Fix**: ocultarlo (o deshabilitarlo con la leyenda *«son todos»*) cuando `cant >= cabezas`.

---

## <a id="a-feat-48"></a>A-FEAT-48 — La venta interna RECRÍA → CRÍA (las de reposición)

Las vaquillonas retenidas **no se venden afuera**: pasan a cría como reposición. Es **ingreso de
recría y costo de entrada de cría** — la misma operación vista de los dos lados, exactamente igual
que la transferencia cría → recría.

**Y el espejo existe sólo en un sentido**: `ciclos_recria.precio_kg_entrada` cierra el resultado de
cría y abre el de recría. **La vuelta no existe.** Hoy la reposición sale del circuito sin valuarse:

```
   cría ──── $7.000/kg ────► recría        ya existe
   cría ◄──── ¿? ────────── recría         NO existe
```

Resultado: **recría regala animales y cría los recibe gratis.** Los dos márgenes quedan mal, y en
direcciones opuestas.

📌 El usuario lo planteó así: *"las de reposición sí se venden a cría. Es una venta para uno y un
costo para otro, pero se debe poner la venta interna para que ejecute los márgenes"*.

⚠️ **Un solo número para los dos lados**, como quedó fijado para cría → recría: si se cargan dos, en
algún momento dejan de coincidir y ninguno de los dos márgenes cierra.

---

## <a id="a-bug-62"></a>A-BUG-62 — El Margen usa la venta presupuestada aunque la real esté cargada

`components/panel-margen.tsx` arma los ingresos leyendo **`productivo.stock_lotes`** — el plan — y
**nunca mira `productivo.stock_ventas`**, que es donde queda la venta que efectivamente ocurrió.

### El caso real (2026-08-26)

| | Lote (plan) | Venta registrada |
|---|---|---|
| Peso por cabeza | **275,00 kg** | **294,18 kg** |
| Precio | $5.876,29/kg (override) | **$5.670,00/kg** |
| Kg totales | — | 16.180 |
| Neto | — | **$88.988.382** |

**El margen factura la proyección**, con 19 kg de menos por cabeza y otro precio.

Es una violación directa de la regla **default del dato real, siempre editable** de `CLAUDE.md`:
el dato real existe, está cargado, y no se usa. Lo marcó el usuario: *"recordá que la venta no fue
275 kg, esa era la proyección de la venta"*.

**El fix es la regla, no un parche**: si hay venta registrada para el lote, **manda la venta**; si no
hay, manda la proyección. Y que se vea de dónde sale el número, para que se note la diferencia
cuando el plan y la realidad no coinciden — que es justamente el dato que interesa.

⚠️ Mirar también el **precio**: el lote tiene `precio_kg_override` y la venta su `precio_kg`. Y los
**gastos de venta**: el margen usa `pctGastoVentaPorDefecto()` hardcodeada (3 % / 9 %) en vez del
`pct_cz` que el lote y la venta ya traen cargado.


### ✅ Hecho el 2026-08-26

**Verificado antes de tocar** (el usuario pidió chequear que no lo estuviera tomando ya): el Margen
**no** leía `stock_ventas` — el archivo no aparece en `panel-margen.tsx`. El Presupuesto sí lo lee,
pero **para otra cosa**: `valuarLoteConPrecios()` usa las ventas sólo para restar cabezas
(`cantidadDisponible`), de modo que lo vendido queda **fuera** de la proyección y entra por Ingresos
con su comprobante. **El margen no hacía ni lo uno ni lo otro**: proyectaba el lote entero.

**El fix, en dos mitades:**

| | Antes | Ahora |
|---|---|---|
| Lo vendido | proyectado a 275 kg y $5.876 | fila **«— REAL»** con 294,18 kg y $5.670, de `stock_ventas` |
| Lo no vendido | — | fila proyectada por **las cabezas que quedan**, diciendo *«quedan N de M»* |
| Campaña de la venta | la del lote | la de **su propia fecha** — un lote puede venderse antes de lo previsto |
| Doble conteo | el lote entero se proyectaba igual | las cabezas vendidas **se descuentan** de la proyección |

⚠️ **Queda pendiente de este mismo ítem**: el margen sigue usando `pctGastoVentaPorDefecto()`
(3 % / 9 % hardcodeado) para las filas **proyectadas**, en vez del `pct_cz` que el lote ya trae. Las
filas reales sí usan la comisión de la venta.


---

## <a id="a-feat-49"></a>A-FEAT-49 — Un lote puede pasar a otra actividad en vez de venderse

**Hecho el 2026-08-26.** Unifica en **un solo mecanismo** lo que estaba quedando en dos.

### Por qué acá y no en el ciclo

Lo propuso el usuario, y el motivo es el que decide:

> **Las vaquillonas de reposición comieron.** Si no son un lote, no tienen tramo. Si no tienen
> tramo, su ración no está en ningún lado — que es exactamente el problema que estamos resolviendo.

Cargarlas como lote da todo lo demás gratis: la curva de peso, los tramos de alimentación, la
fecha y el timing del presupuesto. El bloque del ciclo no daba nada de eso.

### Cómo funciona

`productivo.stock_lotes.destino_actividad_id` → `public.centros_costo`.

| Valor | Qué significa |
|---|---|
| `NULL` | venta externa: mercado, con IVA, comisión y plazo de cobro. Como siempre |
| una actividad | **traspaso interno**: ingreso para la actividad del lote, costo de entrada para la otra |

**Un solo número para los dos lados** — el `$/kg` del lote es el precio del traspaso, y la fecha
define a qué campaña contable cae.

⚠️ **No genera caja**: sin IVA, sin comisión, y **excluido del Cash Flow** (`tab-presupuesto.tsx`).
Sería plata que nunca llega.

### La fuente única, resuelta sin romper lo cargado

El destete y la reposición estaban también en `ciclos_recria` (`precio_kg_entrada` y las 4 columnas
de [A-FEAT-48](#a-feat-48)). Tener el mismo hecho en dos lados es justo lo que dijimos que no hay
que hacer.

**Criterio implementado**: el lote GANA. Si existe un lote con destino a Recría, el
`precio_kg_entrada` del ciclo **no se usa**; ídem con la reposición. El bloque del ciclo queda
como el camino viejo y sigue funcionando mientras no haya lote — así lo ya cargado no se pierde.

### Los cuatro caminos, ahora en el mismo lugar

```
   destete ─┬─► venta externa          lote sin destino
            └─► recría                 lote con destino = Recria
   recría  ─┬─► venta externa          lote sin destino
            └─► cría (reposición)      lote con destino = Cria
```

---

## <a id="a-dec-05"></a>A-DEC-05 — Cría también va a llevar maíz y concentrado

**Lo dijo el usuario el 2026-08-26**: *"cría sí tendrá maíz y concentrado finalmente, pero se le da
a los terneros al pie y a discreción"*.

⚠️ **Contradice lo que se había asumido esa misma mañana** (*"cría no usa maíz"*), que era lo que
simplificaba el reparto del consumo medido. Hay que resolverlo **antes** de conectar el reparto de
[A-FEAT-43](#a-feat-43).

### Lo que hace falta

| # | Qué | Estado |
|---|---|---|
| 1 | La actividad **Cría** necesita sus filas de **Maíz** y **Concentrado** | 🔴 hoy sólo tiene sanidad, pasturas, verdeos, rollos y silo |
| 2 | `actividades.racion_pct_pv` de Cría está en **0,00 %** | 🔴 con tramos y sin ese %, el consumo estimado da **cero** |
| 3 | Los **tramos** en los lotes de *Ternero/Ternera al Pie* | 🟩 **no hay nada que desarrollar**: los tramos cuelgan de cualquier lote y esos lotes ya existen |

### 🔑 La pregunta que decide el diseño

**¿El maíz de cría y el de recría salen del mismo silo?**

- **Mismo silo** → la medición es una sola y el reparto tiene que incluir a los terneros al pie
  junto con los tres grupos de recría. El kilo-día se calcula sobre **todos** los que comen.
- **Silos separados** → cada uno se mide aparte y el reparto de recría no cambia.

*Y "a discreción" no complica nada: la clave sigue siendo kilo-día, que es la regla única
justamente para no tener que distinguir el régimen.*


### ✅ RESUELTA — 2026-08-26

**El usuario declara, el sistema no deduce.** Ver [A-FEAT-50](#a-feat-50).

| La pregunta | La respuesta |
|---|---|
| ¿Mismo silo o no? | **Puede ser cualquiera de las dos, y no importa**: si es el mismo, se declara cuánto fue a cría; si son dos, son dos productos con su propia medición |
| ¿Cómo se sabe cuánto comió cría? | **No se calcula: se declara.** *"Se cargaron 6 ton al comedero"* |
| ¿Cría necesita reparto por lote? | **No.** El lote entero llega al destete y no hay ventas parciales |
| ¿Hace falta una fórmula distinta? | **No.** Un solo grupo consumiendo se lleva el 100 % con la misma regla |

**Lo que sigue haciendo falta cargar** (puntos 1 y 2 del cuadro de arriba): las filas de Maíz y
Concentrado en la actividad Cría, y su `racion_pct_pv`, que hoy está en 0,00 %. Eso es para
**presupuestar hacia adelante** — el usuario lo pidió explícito: *"lo que sí es bueno tener lo que
comen por día en promedio para saber cuánto presupuestar"*. Después el consumo declarado y medido
lo corrige. Lo de siempre: primero el teórico, después el real.

---

## <a id="a-feat-50"></a>A-FEAT-50 — El consumo declarado por actividad

**Hecho el 2026-08-26.** Resuelve [A-DEC-05](#a-dec-05).

### La corrección de enfoque

Estaba por hacer que el sistema **dedujera** cuánto comió cría y cuánto recría a partir de los
pesos. El usuario lo frenó, y tenía razón:

> *"Tener que hacer el cálculo sin algún reporte de mi parte sería un análisis que no deberíamos
> tener que hacer… Yo daré datos, por ejemplo: se cargaron 6 ton de alimento para cría."*

**Deducir un dato que el usuario puede declarar es inventarlo.**

### El modelo

```
   1. La MEDICIÓN da el consumo total del tramo.          (real, medido)
   2. El usuario DECLARA lo que fue a cría.               (real, declarado)
   3. El RESTO se reparte por kilo-día entre los grupos.  (calculado)
```

Y es **la misma regla** que ya se había acordado para las facturas adjudicadas a una actividad:
**lo declarado gana, y lo declarado se descuenta del reparto general.** Por eso el total nunca se
mueve — declarar cambia a QUIÉN se le carga, no CUÁNTO se consumió.

### Los dos casos del usuario, sin código distinto

| Lo que diga | Cómo entra |
|---|---|
| *"se cargaron 6 ton para cría"* | una declaración de consumo |
| *"almacenamos 10 ton para cría en este silo"* | dos productos de stock, cada uno con su medición |

### 🔑 Y cría no necesita reparto — sin ninguna excepción en el código

El usuario lo dejó claro: *"para cría no se usará un cálculo por cabeza como en recría; es todo el
lote el que llega de promedio a un kilaje al destete"*.

**No hizo falta programar un caso especial.** La regla del kilo-día ya lo resuelve: con **un solo
grupo** consumiendo, le toca el 100 %. Misma fórmula, un consumidor.

> Por eso no rompe la condición del usuario — *"en la app yo no puedo variar formas de cálculo en
> vivo"*: no es otra forma de cálculo, es la misma con un grupo.

**La diferencia real entre cría y recría no está en la fórmula, está en para qué sirve el número:**

| | Recría | Cría |
|---|---|---|
| Por qué hace falta repartir | **hay ventas parciales** — los 55 se fueron y hay que saber su parte | no hay: el lote entero llega al destete |
| Resultado | costo por grupo | costo de la actividad, y listo |

### Verificado

`scripts/verificar-consumo.mts` corre con una declaración de 6.000 kg a cría en el último tramo:
se descuentan, los 13.200 restantes se reparten entre los tres grupos de recría, las
participaciones suman 1 y **los 3 controles siguen cerrando**.

---

## <a id="a-feat-51"></a>A-FEAT-51 — La línea de tiempo del rodeo

**Hecho el 2026-08-26.** Era la última pieza para que el reparto del consumo funcione: el motor
existía desde [A-FEAT-47](#a-feat-47) pero **nadie le pasaba los grupos**.

### Qué hace

`lib/productivo/rodeo.ts` responde una sola pregunta: **cuántas cabezas y con qué peso hubo cada
día**. De ahí sale el kilo-día de cada grupo, que es la clave del reparto.

| Decisión | Por qué |
|---|---|
| **Integra día por día**, no con promedios | los animales entran, mueren y se venden en fechas distintas, y el peso crece con la curva quebrada de los tramos. El promedio-de-promedios es donde se cuelan los errores que nadie encuentra. Son ~200 iteraciones: no hay nada que optimizar |
| Los grupos son **los lotes del ciclo** | ya tienen cantidad, curva de peso y fecha. Y es coherente con [A-FEAT-49](#a-feat-49): el lote es la unidad |
| La salida es **la venta real** si existe, si no la estimada | el dato real por default, otra vez |
| **Peso VIVO (bruto)** | el animal come según lo que pesa parado. El desbaste es para la plata |

### 🔑 El «Resto sin lote» — no es un relleno

Es el grupo que absorbe la diferencia entre lo que declara el ciclo y lo que suman los lotes.

> **Un animal que no está en ningún lote igual come.** Si no se lo declara, su consumo se reparte
> entre los demás y les infla el costo — sin que nada avise.

Con el grupo, el costo queda donde corresponde **y la fila se ve**, que es lo que hace que alguien
vaya a cargar el lote que falta. En la pantalla sale marcado *«← sin lote cargado»*.

### ⚠️ La convención de las mortandades

Una baja que no dice de qué grupo es se descuenta **proporcionalmente** entre los grupos presentes
ese día. Es una convención, no un hecho: el animal que murió en abril no sabía a qué venta iba a
pertenecer.

Como toda convención del modelo, **mueve cabezas entre grupos y nunca cambia el total** — por eso el
total sigue siendo el control de los parciales. Si la baja sí dice de qué grupo es, no hay
convención: se descuenta de ahí.

### Verificado contra la base real

`npx tsx --env-file=.env.local scripts/verificar-rodeo.mts`

```
=== GRUPOS ===
  Ternero Recria (55 cab) — vendido      55 cab   23/02/2026 → 04/08/2026
  Resto sin lote                        130 cab   23/02/2026 → sigue

=== CONTROL DE CABEZAS ===
  ✓ el ciclo declara 185 y los grupos suman 185 · 4 mortandades

=== KILO-DÍA 23/02 → 27/08 ===
  Resto sin lote                          6,22 M    71,9 %
  Ternero Recria (55 cab) — vendido       2,43 M    28,1 %
  TOTAL                                   8,65 M   100,0 %   ✓
```

**Los 130 del «resto» son exactamente los machos y hembras que el usuario está por cargar como
lotes.** A medida que los cargue, esa fila se va achicando hasta desaparecer.

### Fuente única

El armado de los grupos vive en `armarGruposRodeo()` **dentro del lib**, no en la pantalla: lo usan
el panel de mediciones y el script de verificación. Dos versiones de esto darían repartos distintos
según desde dónde se mire — que es el modo de falla que ya nos costó caro con `buscarPrecio()`.

### Lo que falta para cerrar A-FEAT-43

**Llevar el costo repartido al Margen.** Hoy se ve en el panel de mediciones —que es donde se
carga y se controla— pero todavía no baja a la fila de costo de la actividad.

---

## <a id="a-feat-52"></a>A-FEAT-52 — El costo de alimentación medido llega al Margen

**Hecho el 2026-08-26.** Es el último eslabón: cierra la cadena de [A-FEAT-43](#a-feat-43).

### La cadena, completa

```
  mediciones + entregas  →  consumo.ts             cuánto se consumió y a qué precio, por tramo
  lotes + mortandades    →  rodeo.ts               cuánto animal-kilo hubo cada día
  declaraciones          →  consumo.ts             lo que el usuario imputó a mano
                             ↓
                        costo-alimentacion.ts      quién paga cuánto, por actividad y campaña
                             ↓
                        panel-margen.tsx           la fila de Maíz muestra un número
```

Cada eslabón estaba verificado por separado. Este los junta.

### Qué cambia en la pantalla

La fila **Maíz** de Recría decía *«el modo pct_racion necesita la curva de peso y los tramos —
todavía no se resuelve acá»*. Ahora dice el consumo **medido** y se despliega tramo por tramo, con
un renglón por grupo.

⚠️ **Y no reemplaza a la estimación por las malas**: el medido gana **sólo si existe**. Sin
mediciones cargadas la fila sigue marcada como antes. Es la regla de siempre — el dato real por
default, y nada inventado cuando falta.

### Dos decisiones que quedan escritas

**1 · Un tramo cae entero en la campaña de su fecha de inicio.** Partirlo por mes sería más fino,
pero el consumo se midió sobre el tramo completo: repartirlo por días inventaría una precisión que
la medición no tiene.

**2 · El vínculo insumo ↔ costo va por `actividad_insumos.producto`**, que existe justamente para
eso. Si está vacío se cae al nombre del concepto —"Maíz" con "Maíz"—, pero eso es un match por
texto y por eso **manda el campo explícito**. Conviene cargarlo.

### El control que queda pendiente y vale la pena

Contrastar el total contra `Maqueta_Costo_Recria.xlsx`. **Tienen que dar lo mismo** — y si no, la
diferencia dice qué falta cargar. Es el camino inverso, que es siempre el mejor control.

---

## <a id="a-feat-53"></a>A-FEAT-53 — La activación: lo que no se vendió no es gasto

**Hecho el 2026-08-26.** Acordado con el usuario el mismo día, cuando planteó el caso:

> *"Si el margen es de campaña, la primera campaña es pérdida porque aún no vendió, pero se debe
> valorizar el stock para de última dar cero y aplicar ese costo en la venta."*

### El problema

| | Campaña |
|---|---|
| La recría **abrió** | 23/02/2026 → **25/26** |
| Empezó a **comer** | 06/05/2026 → **25/26** |
| **Vendió** los 55 | 04/08/2026 → **26/27** |

Sin activación, **25/26 da pérdida pura** (pagó toda la comida y no vendió nada) y **26/27 da
ganancia inflada** (vendió sin costo de entrada).

### La solución: dos renglones, ningún gasto reclasificado

```
   Ingresos:   + Existencia final     lo que queda vivo al cerrar
   Costos:     − Existencia inicial   lo que ya valía al abrir
```

Es la variación de existencias de toda la vida. **El primer año da cero en vez de pérdida**, y el
año que se vende la ganancia se mide contra lo que el animal ya valía — no contra cero.

⚠️ **No se reclasifica ningún costo.** Los gastos siguen enteros y estos dos renglones absorben la
diferencia de timing. Eso lo hace fácil de auditar: el maíz sigue estando donde se pagó.

### La valuación: a COSTO, no a mercado

**Valor de entrada + lo que se le imputó encima.** No a precio de hacienda — eso sería reconocer
una ganancia antes de venderla.

📌 Es una diferencia deliberada con la maqueta de Excel, que sí valuaba lo no vendido a precio de
mercado. **Son dos preguntas distintas**: la maqueta contestaba *"¿cómo le está yendo al resto?"*
y el margen contesta *"¿cuánto ganó la campaña?"*. La segunda no puede contar ganancias no
realizadas.

### El segundo año, que era la duda del usuario

Él lo planteó así: *"a la campaña siguiente venderemos la campaña pasada dando la ganancia, pero
tendremos la inversión de la campaña actual… 2 campañas productivas mezcladas en una campaña
contable"*.

**Con activación eso es lo que tiene que dar, y está bien:**

```
   + Venta de la camada 2026            ingreso
   − Existencia inicial (camada 2026)   lo que ya valía
   − Comida de la camada 2027           gasto del año
   + Existencia final (camada 2027)     lo que queda
   ─────────────────────────────────────────────────
   = la ganancia real del año contable
```

Las dos camadas conviven y el número sale bien igual. **Desmezclarlas no hace falta para que
cierre — hace falta para entenderlo**, y para eso está la apertura por grupo
([A-FEAT-54](#a-feat-54)).

---

## <a id="a-feat-54"></a>A-FEAT-54 — La apertura por grupo dentro del margen

**Hecho el 2026-08-26.** Es la solapa por rodeo de la maqueta, adentro de la pantalla que ya existe.

Desplegable dentro de cada actividad, una fila por grupo:

| Grupo | Cab | Ingreso | Entrada | Alimentación | Margen |
|---|---|---|---|---|---|
| Ternero Recria (55) · **vendido** | 55 | … | … | … | … |
| Machos que quedan · *en stock* | … | — | … | … | … |

### ⚠️ Por qué va ADENTRO y no en otra pantalla

**Es una apertura del total, no otro número.** Como el reparto es proporcional a una clave,
repartir N grupos a la vez da lo mismo que repartir 2 y subdividir — así que **la suma tiene que
dar el margen bruto**, y eso se muestra al pie.

Ponerlo en otra pantalla lo convertiría en un segundo número que discutir, que es exactamente el
modo de falla que este proyecto ya conoce.

### El control, y cuándo NO se muestra

Al pie dice **✓ la suma de los grupos da el margen bruto**, o la diferencia en rojo.

📌 **Pero sólo si están todos los grupos calculados.** Con uno incompleto la diferencia no
significa nada, y un cartel rojo espurio es peor que no ponerlo: en ese caso dice *"no se puede
controlar contra el total: N grupo(s) sin calcular"*. Un control que se dispara sin motivo deja de
mirarse — y ahí se pierden los que sí importan.

---

## <a id="a-feat-55"></a>A-FEAT-55 — El PEDIDO, el momento que falta

**Diseño acordado el 2026-08-27. NO implementado, y a propósito.**

### Dónde está el hueco

```
   "compré tanto"   →   "recibí este día"   →   llegó la factura
      EL PEDIDO           MUEVE EL STOCK        TRAE EL PRECIO
      ❌ no existe          ✅ A-FEAT-47          ✅ A-FEAT-44
```

### Por qué no se hizo ahora

El usuario lo evaluó con un caso real —pidió un camión de maíz un jueves para el sábado— y la
conclusión fue que **no le compra casi nada**: el pedido no mueve stock, no trae precio, y el
cálculo del consumo no lo mira.

Sirve para dos cosas, ninguna urgente:
1. **Cash Flow** — que la plata que se va a deber aparezca antes que la factura.
2. **No comprar de más** — `Insumos → Necesidad de Compra` ya calcula *stock actual · necesario ·
   a comprar*, pero **le falta el otro lado: lo que ya se pidió y está en camino**.

### ⚠️ Por qué NO alcanza con cargar la entrega con fecha futura

El usuario propuso justamente eso —cargar el recibo con la fecha pactada y ajustarlo después— y
es la idea correcta, pero **el sistema no la soporta hoy**:

| Problema | Qué se ve |
|---|---|
| El stock se recalcula sumando las compras | `Insumos → Stock` muestra kilos **que todavía no están** |
| El control *«lo comprado está explicado»* | se pone en **✗**: esos kilos no están ni consumidos ni contados en ninguna medición |
| Si el camión se pospone y no se cambia la fecha | los tramos quedan mal **y nada avisa** |

🔑 El segundo es el que decide. **Un control que se pone rojo por algo que no es un error es la
forma más rápida de que se deje de mirar** — y después se pierden los que sí importan.

### El diseño, para cuando se haga

**Un estado en el movimiento**, no una tabla nueva. Lo propuso así el usuario: *"puede quedar
pendiente vs. confirmado cuando está hecha la descarga"*.

| Estado | Fecha | Cantidad | Toca el stock | Corta tramos | Entra al Cash Flow |
|---|---|---|---|---|---|
| `pendiente` | la **pactada** | la acordada | ❌ **no** | ❌ **no** | ✅ sí, como egreso esperado |
| `confirmado` | la **real de descarga** | la que bajó | ✅ sí | ✅ sí | ✅ sí |

**La condición que lo hace viable es que `pendiente` sea invisible para el stock y los tramos.**
Sin eso reaparecen los tres problemas de arriba.

Y de yapa: `Necesidad de Compra` pasa a poder descontar lo pendiente, que es lo que hoy le falta.

### 📌 Lo que quedó confirmado sobre entregas y mediciones

De la misma conversación, y vale como referencia porque son las reglas que rigen hoy:

- **Lo que corta un tramo es la MEDICIÓN, no el recibo.** Son independientes: se puede recibir sin
  medir, medir sin recibir, y medir cualquier día.
- **El orden de carga no importa.** La medición del día D siempre se interpreta como *lo que había
  ANTES de descargar el camión de ese día*.
- ⚠️ **La trampa**: si se mide contando el camión recién descargado, esos kilos se cuentan dos
  veces. Recibir 25 t y anotar 26 hace que el sistema entienda *"había 26 y llegaron 25"* = 51.
  **Se mide antes de descargar.**

---

## <a id="a-dat-08"></a>A-DAT-08 — La apertura del ciclo de recría: 185 → 189

**Hecho el 2026-08-27, con OK explícito del usuario** (*"dale, corregí vos la apertura a 106 y 83"*).

### Qué estaba mal

`productivo.ciclos_recria` declaraba `103 machos + 82 hembras = 185`. Ése es **el rodeo de hoy**,
ya descontadas las 4 mortandades. Pero un ciclo **abre con lo que entró**, y las bajas las
descuenta sola la línea de tiempo (`lib/productivo/rodeo.ts`).

**Se descontaban dos veces** — y además el valor de entrada salía corto en 4 animales.

| | Machos | Hembras | Total |
|---|---|---|---|
| Estaba | 103 | 82 | 185 |
| Mortandades (15/04, 25/04, 02/07 ♂ · 26/06 ♀) | +3 | +1 | +4 |
| **Quedó** | **106** | **83** | **189** |

### Foto antes / diff después

| | Antes | Ahora |
|---|---|---|
| Kg netos de entrada | 35.412,4108 | **36.181,3686** |
| Valor de entrada a $7.000/kg | $247.886.875,60 | **$253.269.580,20** |
| `verificar-rodeo.mts` | 185 = 185 | **189 = 189 ✓** |

✅ **La señal de que está bien**: los $253,3 M coinciden con el control de rodeo de la maqueta
(**$253.249.089**) con **$20 mil** de diferencia — que es exactamente lo que separa al promedio de
pesos de los pesos individuales.

⚠️ **Sólo se tocaron `cabezas_machos` y `cabezas_hembras`.** Los pesos netos son derivados
(`bruto × (1 − desbaste)`) y no se tocaron. Ninguna otra tabla.

---

## <a id="a-dec-06"></a>A-DEC-06 — Los insumos se nombran por formulación, no por actividad

**Resuelta el 2026-08-27.** El usuario llegó con la duda y el caso real que la contesta.

### El caso que decide

`Concentrado Novillo` es para novillos de 230 kg o más — pero **se lo dieron a los terneros de
recría todo el ciclo**. Con productos nombrados por actividad (`Concentrado Engorde`), ese hecho
**no tiene dónde escribirse**: habría que cargar consumo de "engorde" en el costo de recría, y el
nombre mentiría.

### La regla

> **El stock es físico. Una bolsa de Concentrado Novillo es la misma la coma quien la coma.**

**Quién se lo comió no es una propiedad del producto.** Ya lo resuelven dos mecanismos que no
miran el nombre:

| Cómo se sabe quién comió | Con qué |
|---|---|
| Grupos de un mismo rodeo | el **reparto por kilo-día** ([A-FEAT-51](#a-feat-51)) |
| Otra actividad del mismo silo | la **declaración** ([A-FEAT-50](#a-feat-50)) |

Y de yapa: si mañana se compra el mismo concentrado a otro proveedor, sigue siendo el mismo
producto. **El proveedor viaja en la entrega y en la factura**, que es donde corresponde.

### Los productos, con su especificación

| Producto | Para qué | Inclusión |
|---|---|---|
| `Maíz Granel` | la base de la ración | — |
| `Concentrado Terneros Recria` | terneros desde 100 kg | **15 %** |
| `Concentrado Novillo 35 10` | novillos de 230 kg o más, en recría **o** engorde | **10 %** |

📌 Los % de inclusión coinciden con los `valor` de `actividad_insumos` (Recría 0,15 · Engorde
0,10) — pero **lo que se usó de verdad fue el de 10 %** en recría, porque comieron Novillo. La
receta proyecta; **el consumo medido corrige**.

### ⚠️ Lo que queda abierto

Si un producto lo comen **dos actividades a la vez**, hoy el reparto le da todo a recría — engorde
no tiene ciclo ni lotes cargados. **La salida existe: declarar la parte de engorde.** Cuando
engorde tenga su ciclo, se vuelve automático.

---

## <a id="a-bug-64"></a>A-BUG-64 — El costo medido se perdía si ninguna receta lo reclamaba

**Encontrado y arreglado el 2026-08-27**, como consecuencia directa de [A-DEC-06](#a-dec-06).

El margen mostraba el consumo medido **sólo si encontraba una fila de `actividad_insumos` con un
nombre parecido** (`mismoInsumo()`, que compara `producto` y si está vacío cae al `concepto`).

Al nombrar los productos por formulación, `Concentrado Novillo 35 10` deja de parecerse a
`Concentrado`. Y el problema no es que falle: **fallaba en silencio**. El costo no aparecía en
ningún lado y nada avisaba.

### El fix, que además es el diseño correcto

> **El consumo medido es un hecho y no necesita el permiso de ninguna receta para entrar al
> margen.**

Entra por su cuenta, con el nombre del producto y la aclaración *«sin fila de receta que lo
proyecte»*. La receta sirve para **proyectar hacia adelante**; el vínculo entre las dos es
**comodidad de presentación, no requisito**.

Con eso el campo `actividad_insumos.producto` pasa a ser **opcional**: sólo sirve para que la fila
proyectada y la medida se muestren juntas en vez de separadas.

---

## <a id="a-test-37"></a>A-TEST-37 — La página CUT como conciliación, con su control

Cubre [A-FEAT-34](#a-feat-34), [A-BUG-46](#a-bug-46) y [A-BUG-47](#a-bug-47).

**1 · Marzo 2026 — el caso que cierra.** La página del CUT tiene que salir así:

```
A · VENÍAN DE ANTES (8)      A346 · A935 · B079 · B616 · B687 · B744 · C561 · Sin identificar
                             todas → Sigue en CUT
B · ENTRARON EN EL PERÍODO (4)
   414 Lengua de Palo · 562 Respiratorio · 610 Machorra · 724 Diarrea Conserva
                             todas → Salió 30/03/2026 — Vendido
CIERRE   venían 8 + entraron 4 − salieron 4 = quedan 8
         Existencia Final CUT (cabezas) = 8      ✓ OK
```

De un vistazo se ve que **las 4 que entraron son las 4 que salieron**, con su motivo de ingreso y su
fecha y motivo de salida.

**2 · Agosto 2026 — el caso que NO cierra, y tiene que gritar.**
- Las 4 vendidas en marzo **ya no aparecen** (antes seguían saliendo 5 meses después).
- El cierre da `8 + 0 − 0 = 8` contra **9 cabezas** en la grilla.
- Tiene que salir la **alerta**: *"faltan 1 cabeza sin identificar con caravana"* — en el PDF con
  recuadro rojo, en el preview con fondo rojo. Es la vaquillona del 08/08.

**3 · Lo que NO tiene que cambiar**: la hoja **Planilla**, ni un número, en ninguna de las 7
mensuales. Sólo cambió la página del CUT.

**4 · El aviso al mover a CUT sin caravanas** (avisa, **no bloquea**): en *Movimientos → Cambio de
Categoría*, destino CUT/Descarte, dejar el campo de caravanas vacío y guardar. Tiene que preguntar
si se sigue, dejar **cancelar** para volver a cargarlas, y si se sigue: registrar el movimiento
igual + un aviso de que la planilla va a marcar el descuadre. **Mismo aviso al registrar un tacto**
con vacías y sin caravanas.

**5 · `fecha_alta`** ([A-BUG-47](#a-bug-47)): al cargar caravanas nuevas al CUT, tienen que aparecer
en el bloque B con la **fecha del movimiento**, no la del día en que se cargaron.

📸 Tandas: `planillas_hacienda_2026-08-20_TACTO/` (antes) y `planillas_hacienda_2026-08-20_CUT/`
(después).

---

## <a id="a-test-36"></a>A-TEST-36 — El pase a CUT sale como reclasificación, no como muerte

Cubre [A-BUG-45](#a-bug-45) (código) y [A-DAT-05](#a-dat-05) (los 4 movimientos de febrero).

**1 · La planilla de Febrero 2026** — Productivo → Hacienda → Planilla → Mes → Febrero:

| Fila | Tiene que decir | Antes decía |
|---|---:|---:|
| **Mortandad — Total General** | **1** | 9 |
| Mortandad — Vaca / Vaq. Preñada | 0 / 0 | 7 / 1 |
| Compras — CUT/Descarte | **0** | 8 |
| Reclas. − — Vaca / Vaq. Preñada | **7 / 1** | 0 / 0 |
| Reclas. + — CUT/Descarte | **8** | 0 |

La **Mortandad de 1** es la ternera de Onetto, la única baja real del mes.

**2 · Lo que NO tiene que cambiar** — es la mitad importante del test:
- `Stock Anterior`, `Ingresos`, `Egresos` y `Existencia Final` de febrero: **iguales** (421 el
  cierre). Los 8 animales se mueven *entre* filas, no entran ni salen.
- **Marzo a agosto: ni un número distinto.** Agosto sigue cerrando en **356**.

**3 · En la hoja *Detalle* de febrero**, los 4 movimientos del 18/02 tienen que aparecer como
`Reclas. +` / `Reclas. −` en vez de `Ajuste + (en Compras)` / `Ajuste - (en Mortandad)`.

**4 · El fix del código sólo se puede probar con un tacto nuevo.** Al registrar el próximo tacto con
vacías, los 2 movimientos que se generan tienen que salir con `tipo = 'cambio_categoria'` y caer en
las filas de reclasificación, no en Mortandad/Compras. **Hasta que eso pase, A-BUG-45 no está
verificado.**

📸 Tandas para comparar: `planillas_hacienda_2026-08-20_CORREGIDO/` (antes de este cambio) y
`planillas_hacienda_2026-08-20_TACTO/` (después). Ninguna está en git.

---

## <a id="a-dec-03"></a>A-DEC-03 — Seis preguntas abiertas del módulo hacienda

1. **`Novillito`** — está inactiva y sin movimientos. ¿Fuera de uso a propósito, o le falta columna
   en la planilla?
2. **Nacimientos** — **nunca se cargó ninguno** (la app es nueva y el usuario los va a empezar a
   cargar). ¿Entran como movimiento `nacimiento` o desde el ciclo de cría? Hoy la fila *Nacimientos*
   sale siempre en cero, y eso **no es un error**: es que el dato todavía no existe.
3. **Las 3 columnas siempre vacías** (Vaq. Reposición, Novillo, Vaq. Engorde) en un PDF apaisado de
   15 columnas a 6,5 pt. ¿Se dejan por fidelidad al formulario de papel?
4. **Adultos sin registro nominal** — ¿alguna vez se formaliza, o se acepta la caravana como texto
   libre en observaciones?
5. **Razón social** — ¿se deja hardcodeada (un solo establecimiento) o sale de `lib/empresas.ts`?
   → [A-BUG-49](#a-bug-49).
6. **`productivo.stock_hacienda`** — existe, está **vacía** y **ningún código la lee**: el stock se
   recalcula en memoria desde los movimientos en cada carga. ¿Se materializa o se borra?

---

## 🗂️ Archivos que este documento reemplaza (ya borrados / a borrar)
- `PENDIENTES_GENERAL.md`
- `PENDIENTES_PUSH_A_MAIN.md`
- `PENDIENTES-PROXIMA-SESION.md`
- Secciones de pendientes incrustadas en `CLAUDE.md`
