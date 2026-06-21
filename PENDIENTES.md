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

### Bugs (sesiones de junio)
| ID | Estado | Prio | Ítem | Detalle |
|----|--------|------|------|---------|
| A-BUG-01 | 🔴 | Media | Grupos de Pago — 6 bugs caso Alcorta | → [A-BUG-01](#a-bug-01) |
| A-BUG-02 | 🔴 | Media | Grupo ARBA `a177c1fb` desfase $5.701,30 | → [A-BUG-02](#a-bug-02) |
| A-BUG-03 | 🔴 | Media | Modo Admin facturas — modificar campos no funciona | → [A-BUG-03](#a-bug-03) |

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

**Falta (usuario):** probar con datos reales vs formato del banco · decidir si llenar "Mensaje del email" · decidir motivos específicos para templates (Alquiler/Expensas) o dejar "Varios".
**Fase 2 (Claude):** historial de lotes · vista config rápida CBU/email.
Detalle completo: `memory/project_lotes_galicia.md`.

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

## <a id="a-test-05"></a>A-TEST-05 — Tarjetas Fase 2 (testing PDF real)

**Estado:** implementado en main (`6906f49`, `8690bc0`). Parser PDF Galicia + Excel auditoría. **Sin probar con un PDF real:** parser de movimientos · control de saldo · deduplicación · tarjetas adicionales. Detalle: `memory/project_tarjetas_testing_pendiente.md`.

---

## <a id="a-sec-01"></a>A-SEC-01 — Hardening de seguridad (2026-06-17)

**Foco del usuario (en orden):** (1) evitar acceso de 3ros a su Google (Gmail/Drive); (2) evitar que rompan/dañen la app (Supabase) — mitigable con backup confiable; (3) que vean datos no es lo peor, que dañen sí; (4) que no se filtren las claves.

### Hallazgo crítico — el rol `anon` puede BORRAR todo
Scan: `anon` tiene `DELETE, INSERT, UPDATE, TRUNCATE` en **cada** tabla. Combinado con la `anon_key` expuesta en el bundle JS (es así por diseño), tablas expuestas en API, y mayoría sin RLS (o RLS "permissive" de 1 policy "allow all") → cualquiera con `curl + anon_key` puede borrar/truncar tablas. Es exactamente lo que el usuario quiere evitar.

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

## 🗂️ Archivos que este documento reemplaza (ya borrados / a borrar)
- `PENDIENTES_GENERAL.md`
- `PENDIENTES_PUSH_A_MAIN.md`
- `PENDIENTES-PROXIMA-SESION.md`
- Secciones de pendientes incrustadas en `CLAUDE.md`
