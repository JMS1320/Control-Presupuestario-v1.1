# 📋 PENDIENTES — Fuente única de verdad

> Único lugar donde se documentan los pendientes (bugs, testing, features, operacional, seguridad, datos).
> Reemplaza a `PENDIENTES_GENERAL.md`, `PENDIENTES_PUSH_A_MAIN.md`, `PENDIENTES-PROXIMA-SESION.md` y a las secciones de pendientes sueltas en `CLAUDE.md`.

**Última actualización:** 2026-06-21

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

**Regla de mantenimiento (Claude — SIEMPRE):**
1. Feature nueva implementada → fila 🔴 `A-TEST-xx` en el índice.
2. Cuando analizamos un problema y surge razonamiento que vale guardar → crear/ampliar su dossier en DETALLES con el mismo ID.
3. Usuario confirma testeo/resolución → ✅ y limpiar al cerrar sesión.
4. Promover de B/C/D a A cuando se confirma vigencia (y recién ahí escribir su dossier).
5. Al cerrar sesión → revisar que la Sección A esté al día.
6. Cuando el usuario pregunte "qué falta" → leer **sólo el ÍNDICE de este archivo**.

---
---

# 📑 PARTE 1 — ÍNDICE

## 🅰️ SECCIÓN A — CONFIRMADOS (re-verificados 2026-06-21)

### Operacional
| ID | Estado | Prio | Ítem | Verificación |
|----|--------|------|------|--------------|
| A-OP-01 | 🔴 | Alta | MCP Supabase quedó en WRITE — revertir a read-only | ✅ `.mcp.json` sin `--read-only` |
| A-OP-02 | ✅ | Media | Archivo `nul` basura en el repo — BORRADO 2026-06-21 (era el error capturado "dir: cannot access 'vercel.json'"). `git add -A` ya funciona | resuelto |
| A-OP-03 | 🔴 | Alta | Merge `desarrollo` → `main` (20 commits) | ✅ `git rev-list --count main..desarrollo` = 20 |
| A-OP-04 | ⏸️ | Media | Auditar Secciones C y D junto al usuario | — |
| A-OP-05 | 🔴 | Baja | Carpeta vacía `arca-poc/` — borrar a mano (Windows handle) | — |
| A-OP-06 | 🔴 | Baja | Limpieza raíz: ~40 archivos sueltos (.xlsx/.csv/.pdf/.md untracked) **+ varios `tmpclaude-XXXX-cwd`** (temporales). ⚠️ Claude debe EXPLICAR qué es cada grupo antes de tocar | → [A-OP-06](#a-op-06) |
| A-OP-07 | 🔴 | Baja | **Triagear errores previos** del baseline (cuando haya entradas + tiempo). Log: `ERRORES_CONOCIDOS.md` | → [A-OP-07](#a-op-07) |
| A-OP-08 | 🔍 | **A verificar** | **Backup/restore Supabase confiable** — el CLAUDE histórico repetía "nunca logramos subir backup, prerequisito ABSOLUTO antes de datos reales, prioridad MÁXIMA". Puede estar parcialmente resuelto por la reconstrucción de enero (vía scripts). **Verificar si sigue vigente** y, si sí, lograr un backup/restore probado antes de producción | → [A-OP-08](#a-op-08) |

### Bugs (sesiones de junio)
| ID | Estado | Prio | Ítem | Detalle |
|----|--------|------|------|---------|
| A-BUG-01 | 🔴 | Media | Grupos de Pago — 6 bugs caso Alcorta | → [A-BUG-01](#a-bug-01) |
| A-BUG-02 | 🔴 | Media | Grupo ARBA `a177c1fb` desfase $5.701,30 | → [A-BUG-02](#a-bug-02) |
| A-BUG-03 | 🔴 | Media | Modo Admin facturas — modificar campos no funciona | → [A-BUG-03](#a-bug-03) |
| A-BUG-11 | 🔴 | Alta | Tarjetas: seleccionar tarjeta no cambiaba la vista — ✅ FIX APLICADO (tabla_bd vs id + hook recarga por schema), falta testear | → [A-TEST-05](#a-test-05) |
| A-BUG-12 | 🔴 | **Alta** | Tarjeta — conciliación auto contra `credito` **diverge del motor** (sin fecha → riesgo cruzar períodos; ±1 monto; sin estado auditar). Hay que alinearla al razonamiento del motor | → [A-BUG-12](#a-bug-12) |

### Testing — módulos recientes
| ID | Estado | Ítem | Detalle |
|----|--------|------|---------|
| A-TEST-01 | 🔴 | Lotes Galicia — export Excel banco | → [A-TEST-01](#a-test-01) |
| A-TEST-02 | 🔴 | GAS PDF — descarga automática facturas | → [A-TEST-02](#a-test-02) |
| A-TEST-03 | 🔴 | Módulo ARCA Mis Comprobantes | → [A-TEST-03](#a-test-03) |
| A-TEST-04 | 🔴 | SICORE estado_quincena + anulación | → [A-TEST-04](#a-test-04) |
| A-TEST-05 | 🔴 | Tarjetas — probar PDF real | → [A-TEST-05](#a-test-05) |

### Seguridad
| ID | Estado | Prio | Ítem | Detalle |
|----|--------|------|------|---------|
| A-SEC-01 | 🔴 | Alta | Hardening — anon puede borrar todo + plan P0/P1/P2 | → [A-SEC-01](#a-sec-01) |

### Datos (los carga el usuario)
| ID | Estado | Ítem |
|----|--------|------|
| A-DAT-01 | 🔴 | Stocks negativos agroquímicos — cargar compras (2,4 DB −42 · Coadyuvante −12,85 · Flumetsulam −11,2 · 2,4D −23,2 · Metsulfuron −0,15) |
| A-DAT-02 | 🔴 | Revisar 4 facturas excluidas del fix motor (ICT NET 10558/10661/10762 + FERNANDEZ 1168) |
| A-DAT-03 | 🔴 | Revisar Excel jerarquía de cuentas (`Jerarquia_Cuentas_Contables.xlsx`) |

### 🔬 Revisión Conciliación (2026-06-21) — SOLO ANÁLISIS (decidir qué hacer después)
> 10 temas que el usuario pidió investigar. Estado: análisis en curso. NO tocar código todavía. Mapeo a la lista original del usuario entre paréntesis.

| ID | Estado | Tipo | Tema (nº del usuario) | Detalle |
|----|--------|------|------------------------|---------|
| A-BUG-04 | 🔍 | Bug | Motor no concilia casi ningún sueldo (#1) | → [A-BUG-04](#a-bug-04) |
| A-BUG-05 | 🔍 | Bug | Conciliación manual (reasignar) borra/no copia datos: nro_cuenta, proveedor, detalle (#2) | → [A-BUG-05](#a-bug-05) |
| A-FEAT-01 | 🔴 | Feat | Correr el motor acotado a lo filtrado/en pantalla (#3) — ✅ IMPLEMENTADO, falta testear | → [A-FEAT-01](#a-feat-01) |
| A-BUG-06 | 🔍 | Bug | Reasignar muestra a veces pocas y a veces muchas FC — lógica poco clara (#4) | → [A-BUG-06](#a-bug-06) |
| A-BUG-07 | 🔍 | Bug | Detalle no homogéneo entre las formas de conciliar; templates ¿llenan detalle+cuota? (#5) | → [A-BUG-07](#a-bug-07) |
| A-BUG-08 | 🔍 | Bug | Conciliación de sueldos ¿llena detalle? — verificar con la última conciliación (#6) | → [A-BUG-08](#a-bug-08) |
| A-FEAT-02 | 🔍 | Feat | Editar extracto: ofrece cuentas contables pero NO templates (#7) | → [A-FEAT-02](#a-feat-02) |
| A-FEAT-03 | 🔍 | Feat | Contable/Interno: mostrar los existentes para no duplicar parecidos (#8) | → [A-FEAT-03](#a-feat-03) |
| A-FEAT-04 | 🔍 | Feat | DIST MA + retención SICORE: la retención también es DIST MA pero SICORE agrupa (arquitectura) (#9) | → [A-FEAT-04](#a-feat-04) |
| A-BUG-09 | 🔍 | Bug | Revisar no-conciliados que deberían haber conciliado (mismo monto) + reglas a agregar (#10) | → [A-BUG-09](#a-bug-09) |

### 📎 GAS PDF — hallazgos 2026-06-21 (revisión del módulo)
| ID | Estado | Tipo | Tema | Detalle |
|----|--------|------|------|---------|
| A-FEAT-06 | 🔴 | Feat | Modal Buscar PDFs con selección (individual/todo-nada/Solo Buscar) + rango fechas + cancelar — ✅ IMPLEMENTADO, falta testear | → [A-TEST-02](#a-test-02) |
| A-BUG-10 | 🟡 | Bug | `fc='No'`/`NO Mail` ya NO se auto-buscan (modal pre-selecciona solo Buscar/null). Falta Parte B (import default) | → [A-TEST-02](#a-test-02) |
| A-FEAT-05 | ⏸️ | Feat | Editor de `fc` solo ofrece Sí/No/Portal — no se puede marcar 'Buscar' (mitigado: el modal deja buscar cualquiera a mano) | → [A-TEST-02](#a-test-02) |
| A-FEAT-07 | 🔴 | Feat | **Parte B** — import default `fc='Buscar'` — ✅ IMPLEMENTADO (nulls viejos NO se migran por decisión del usuario; Portal ya funcional vía imputación), falta testear | → [A-TEST-02](#a-test-02) |
| A-FEAT-08 | 🔴 | Feat | **Parte C** — ✅ auto-crear proveedor al importar · ✅ backfill 32 proveedores creados (2026-06-21) · ✅ auto-disparo post-import gated APAGADO (`NEXT_PUBLIC_GAS_AUTODISPARO_IMPORT`). Falta testear | → [A-TEST-02](#a-test-02) |

---

## 🅱️ SECCIÓN B — PROBABLEMENTE PENDIENTES (recientes, sin re-verificar 1×1)

### Features a medio hacer
| ID | Estado | Prio | Ítem |
|----|--------|------|------|
| B-FEAT-01 | 🔴 | Alta | Órdenes de Pago — tabla intermedia `extracto → orden_pago → [FC1,FC2...]` (hoy `comprobante_arca_id` permite 1 sola FC) |
| B-FEAT-02 | ⏸️ | Media | Arquitectura bidireccional FCI/Caja — diseñado, migración SQL lista sin ejecutar |
| B-FEAT-03 | ⏸️ | Media | Dashboard rediseño — decisión arquitectural (5 opciones, recomendada B). Plan: `PLAN_DASHBOARD_REDISEÑO.md` |
| B-FEAT-04 | 🔴 | Media | Templates bancarios separar MSA/PAM/MA + reglas PAM/MA |
| B-FEAT-05 | 🔴 | Media | Plan reglas+templates bancarios PAM/MA — Paso 4 (CAJA / CRED P); pasos 1-3 hechos |
| B-FEAT-06 | 🔴 | Media | Subdiario Ventas — igualar flujo a Compras (esperando que el usuario explique diferencias) |
| B-FEAT-07 | 🔴 | Media | Proveedores — carga orgánica (poblar desde facturas/extractos, no de a uno) |
| B-FEAT-08 | 🔴 | Baja | Margen por superposición — órdenes agrícolas (diseño aprobado, ~25-30 líneas) |
| B-FEAT-09 | 🔴 | Baja | Editar empleado existente (hoy sólo SQL) |
| B-FEAT-10 | 🔴 | Baja | `formatoCantidad('L')` — muestra ml como L ("1122 L" vs "1,122 L") |
| B-FEAT-11 | 🔴 | Media | **Extracto bancario de ECHEQs endosados** — los echeqs endosados entran y salen pero NUNCA se acreditan en cuenta bancaria → es el único medio de pago que queda sin conciliar. Hace falta un "extracto" propio (importar por Excel o carga directa) para registrarlos y conciliarlos. NO desarrollar ahora — pedido del usuario 2026-06-22. |
| B-FEAT-12 | 🔴 | Baja | **Tarjeta — tabla colapsable por mes**: hoy es tira-resumen arriba + tabla plana completa abajo (commit 1c0ebc5). Mejora: unificar en una sola grilla colapsable por resumen (meses plegados → desplegar filas) manteniendo columnas/edición/selector. (2026-06-22) |
| B-FEAT-13 | 🔴 | Media | **Organización de mails propaganda** (2º módulo de mail, junto al de FC). **Fase 1 REVISIÓN** = entender qué remitentes van a qué etiqueta/carpeta → herramienta **YA hecha**: `gas-buscar-pdf/ReporteEtiquetas.gs` (CSV label·remitente·count). **Fase 2 AUTO-MOVER** (sin desarrollar): replicar el movimiento manual (de:X → etiqueta Y + sacar de Recibidos). Luego se **desactiva la revisión** y queda solo el auto-mover. Reportes pueden ir a `sanmanuel.sp`. (2026-06-27) |

### Testing pendiente (commits de mayo, sin testear)
| ID | Estado | Ítem |
|----|--------|------|
| B-TEST-01 | 🔴 | Centros de costo controlado (99fa03a) — tabla maestra + combobox en 6 lugares |
| B-TEST-02 | 🔴 | UI Reglas Import ARCA (61ae7f6) — ABM reglas CUIT→cuenta |
| B-TEST-03 | 🔴 | Estado `cuotas` (805f226) — factura Federación Patronal sale de Cash Flow/Pagos |
| B-TEST-04 | 🔴 | Sueldos estado `anterior` (8b9215e+71a788c) + saldo ≤0 oculto (eabc988) |
| B-TEST-05 | 🔴 | Tildes en buscadores (83052ca, 9921d26) |
| B-TEST-06 | 🔴 | Fix motor conciliación (9877cc3) — factura pasa a `conciliado` y sale de Cash Flow |
| B-TEST-07 | 🔴 | Insumos — unidad correcta (f6a7a61) · sólo EJECUTADAS (ddef961) · agrícola=ganadero (85924fa) · InsumoCombobox (bf75b18) |
| B-TEST-08 | 🔴 | Import pesadas — validación fecha única + popover ayuda (b559843) |
| B-TEST-09 | 🔴 | Órdenes ganaderas — recría + carga manual (c4d2bab) |
| B-TEST-10 | 🔴 | Resto ítems 29-47 de la lista de testing (ver `memory/feedback_testing_pendiente.md`) |

---

## 🅲 SECCIÓN C — DUDOSOS / A AUDITAR JUNTOS (probable que varios ya no apliquen)

| ID | Estado | Ítem | Por qué dudoso |
|----|--------|------|----------------|
| C-01 | ❓ | Testing ítems 1-24 (extracto, dashboard, selectores sub-categorías, etc.) | De abr/may; muchos quizá ya testeados |
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

#### ⭐ ESTADO ACTUAL — 2026-06-29, GAS **v0.9.14** (todo en `desarrollo`). Módulo "archivo digital" andando en Subdiarios.
Handoff completo + plan de registro integral en memoria [[gas-pdf-testing-handoff]]. **Vive en: Egresos → Facturas MSA → Subdiarios → Consultar Período** (columna "Archivo / FC" 📎/❌/🌐 + estado FC + ✕ desvincular; chips que filtran; botones 📊 Conciliar saldos / 🗂️ Supervisar OCR / 🔄 Solo sin adjudicar; panel "PDFs sin vincular" con sugerencia ⭐ por nombre+fecha + Vincular + ✏️ renombrar + 🔧 Detalle debug). Progresión de versiones:
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
---

## 🗂️ Archivos que este documento reemplaza (ya borrados / a borrar)
- `PENDIENTES_GENERAL.md`
- `PENDIENTES_PUSH_A_MAIN.md`
- `PENDIENTES-PROXIMA-SESION.md`
- Secciones de pendientes incrustadas en `CLAUDE.md`
