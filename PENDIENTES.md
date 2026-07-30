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
| A-TEST-06 | 🟡 | Refactor fechas FASE TEMPLATES (`fecha_pago` separado de venc) — testear en preview ANTES de fase ARCA | → [A-TEST-06](#a-test-06) |

### Seguridad
| ID | Estado | Prio | Ítem | Detalle |
|----|--------|------|------|---------|
| A-SEC-01 | 🔴 | Alta | Hardening — anon puede borrar todo + plan P0/P1/P2 | → [A-SEC-01](#a-sec-01) |
| A-SEC-02 | 🔴 | **Urgente** | **Token Supabase filtrado en el repo** — había un PAT (`sbp_dc35…`, admin de toda la cuenta) hardcodeado en `KNOWLEDGE.md`. GitHub Secret Scanning bloqueó el push (2026-07-09). **Redactado** del archivo, PERO **sigue en el historial de git**. **Hallazgo (2026-07-09):** en ESTA PC el token filtrado NO está en ningún config activo (solo en artefactos de Claude Code: file-history + transcript de la sesión). El `.mcp.json` activo usa OTRO token ("claude-mcp-control-presupuestario", 30 min). **ORIGEN DEL "14 días" IDENTIFICADO (2026-07-09):** el token filtrado está en `.mcp.json`/KNOWLEDGE.md de **carpetas de BACKUP viejas del proyecto** (`Control-Presupuestario-v1.1 - 250817...` y `..._BACKUP_...20250815...`) → trabajar en una copia vieja lo usó. También en **`CREDENCIALES_SUPABASE_NUEVO.md`** (carpeta activa, sin commitear) + artefactos Claude Code. **Acción:** revocar el filtrado en Supabase (el proyecto activo usa otro token → NO rompe nada actual; solo las copias viejas, que si las usás les ponés el nuevo). Limpiar el token de `CREDENCIALES_SUPABASE_NUEVO.md` y backups. |

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
| B-FEAT-PRESU-INGRESOS | 🟡 | Alta | **Presupuesto de INGRESOS — arrendamientos agrícolas** (ver [dossier](#b-feat-presu-ingresos)). Diseño CERRADO + BD creada + datos MSA sembrados + `lib/arrendamientos/calculo.ts` + ABM precios/TC + 3 filas por campo en Presupuesto. **Falta:** ABM de contratos en Ventas, acción Fijar (parcial), volcado IIBB al template, Cash Flow, replicar PAM/MA. (2026-07-26) |
| B-FEAT-01 | 🔴 | Alta | Órdenes de Pago — tabla intermedia `extracto → orden_pago → [FC1,FC2...]` (hoy `comprobante_arca_id` permite 1 sola FC) |
| B-FEAT-02 | ⏸️ | Media | Arquitectura bidireccional FCI/Caja — diseñado, migración SQL lista sin ejecutar |
| B-FEAT-03 | ⏸️ | Media | Dashboard rediseño — decisión arquitectural (5 opciones, recomendada B). Plan: `PLAN_DASHBOARD_REDISEÑO.md` |
| B-FEAT-04 | 🔴 | Media | Templates bancarios separar MSA/PAM/MA + reglas PAM/MA |
| B-FEAT-05 | 🔴 | Media | Plan reglas+templates bancarios PAM/MA — Paso 4 (CAJA / CRED P); pasos 1-3 hechos |
| B-FEAT-06 | 🔴 | Media | Subdiario Ventas — igualar flujo a Compras (esperando que el usuario explique diferencias) |
| B-FEAT-07 | 🔴 | Media | Proveedores — carga orgánica (poblar desde facturas/extractos, no de a uno) |
| B-BUG-CLIENTE-NO-SE-CREA | 🔴 | Alta | **Las VENTAS no dan de alta el cliente en `proveedores`** (compras sí) — rompe la regla consensuada "si hay factura, tiene que estar en proveedores/clientes". Causa raíz identificada, ver [dossier](#b-bug-cliente-no-se-crea). (2026-07-28) |
| B-FEAT-08 | 🔴 | Baja | Margen por superposición — órdenes agrícolas (diseño aprobado, ~25-30 líneas) |
| B-FEAT-09 | 🔴 | Baja | Editar empleado existente (hoy sólo SQL) |
| B-FEAT-10 | 🔴 | Baja | `formatoCantidad('L')` — muestra ml como L ("1122 L" vs "1,122 L") |
| B-FEAT-11 | 🔴 | Media | **Extracto bancario de ECHEQs endosados** — los echeqs endosados entran y salen pero NUNCA se acreditan en cuenta bancaria → es el único medio de pago que queda sin conciliar. Hace falta un "extracto" propio (importar por Excel o carga directa) para registrarlos y conciliarlos. NO desarrollar ahora — pedido del usuario 2026-06-22. |
| B-FEAT-12 | 🔴 | Baja | **Tarjeta — tabla colapsable por mes**: hoy es tira-resumen arriba + tabla plana completa abajo (commit 1c0ebc5). Mejora: unificar en una sola grilla colapsable por resumen (meses plegados → desplegar filas) manteniendo columnas/edición/selector. (2026-06-22) |
| B-FEAT-MAIL-DETALLE | 🟢 | Media | **Mail automático de Detalle de pago al proveedor** (con certificado SICORE adjunto si hay retención). Un mail POR PAGO (1 FC o grupo de N → 1 mail). Flujo: tilde "✉ enviar detalle" en el pago (default ON si SICORE) → app arma Detalle PDF (`lib/pagos/pdf-detalle-pago`, ya renombrado Comprobante→Detalle) + certificado (`generarCertificadoRetencion(...,true)` en vista-facturas-arca, a extraer a lib) → encola en `public.mails_pago` (CREADA 2026-07-09, ver RECONSTRUCCION). **GAS** lee `pendiente` → crea **BORRADORES** en Gmail (asunto+cuerpo+adjuntos) → marca (después: enviar directo). Sin horarios, en lote manual. Email = `proveedores.email_pagos` (sin campo nuevo). Mensaje = template autollenado editable (el mensaje del **lote Galicia/banco es OTRO**, no se mezcla). **HECHO:** rename Comprobante→Detalle · tabla `mails_pago` · **GAS** `gas-mail-detalle/EnviarMailsDetalle.gs` (crea borradores desde la cola). **Decidido:** encolar va en el **botón Pagos (Modal = vista-facturas-arca)** donde ya está SICORE + el detalle PDF + `generarCertificadoRetencion(...,true)`; el **panel de seteo/revisión** va en Cash Flow. **HECHO (2026-07-09, sin testear):** modo base64 en detalle PDF del Modal · `encolarMailDetalle` (detalle+certificado+email_pagos+INSERT) · botón **✉** junto al 📄 en **Pagos ARCA** del Modal · **panel `PanelMailsPago`** ("✉ Mails de detalle" en Cash Flow: lista cola, edita destinatario/asunto/cuerpo, toggle adjunto, borra, ve estado). **✉ en:** ARCA (grupo + por FC) y Templates (grupo + por item) — templates sin certificado (no tienen SICORE), email por `cuit_quien_cobra`. **TESTEADO OK (2026-07-10):** borradores creados en Gmail (cuenta San Manuel) con detalle + certificado adjuntos y fecha de pago en el cuerpo. **NUEVO (2026-07-10):** (a) línea `Fecha de pago:` en el cuerpo (de `sicore_retenciones.fecha_pago`; si no, la estimada; si no, puntos `..............` para completar a mano); (b) botón **'Enviar Borrador'** por fila **+ 'Enviar todos los pendientes'** en el panel — disparan el **GAS web app** vía `fetch` **no-cors** (`?id=<uuid>` uno / sin id todos); URL guardada en localStorage `gas_mails_url`; refresca estado a ~3-4s; (c) **GAS = Web App** (`doGet`) en proyecto **SEPARADO** de la cuenta **sanmanuel.sp@gmail.com** (Execute as: Me=San Manuel · Who has access: Anyone) → los borradores salen de esa casilla. **LockService + guarda por `gmail_draft_id`** → no duplica ante doble disparo; (d) **REFACTOR a lib compartida** (regla DRY): `lib/pagos/encolar-mail-detalle.ts` (lógica, UI-agnóstica, devuelve resultado) + `lib/pagos/certificado-retencion.ts` (cert movido del inline) + `lib/pagos/pdf-detalle-pago.ts` (opción `returnBase64`). El modal (`encolarMailDetalle` = wrapper con alert) y Cash Flow llaman la MISMA función; (e) **Cash Flow: botón '✉ Encolar mail detalle'** sobre filas seleccionadas (agrupa x proveedor, junta `id`/`ids_grupo` como `factura_id` para el cert) → **sirve para proveedores YA pagados** (el modal de Pagos no muestra pagadas; Cash Flow es lo que se usa de acá en más). Cert matchea por `sicore_retenciones.factura_id` (ya no depende de `registrosV2`). **Config real del GAS:** `SUPABASE_URL='https://lyojiaglcictmboqwxfm.supabase.co'` + anon key. **FALTA:** (1) los 2 sitios del modal-detalle interno (7373/7400) sin ✉ (secundario); (2) pasar `createDraft`→`sendEmail` en el GAS cuando el user valide envío directo; (3) al cambiar el código del GAS → redeploy 'Gestionar implementaciones → Nueva versión' (la URL no cambia); (4) duplicación pre-existente pdf/cert inline en el modal (se limpia al deprecar el Modal, E5). (2026-07-10) |
| B-BUG-PDF-DETALLE | 🟢 | Media | **PDF "Detalle de pago" no muestra descuentos / SICORE** — ✅ **RESUELTO (2026-07-21, commit 0d21d58, sin testear).** Causa: el generador (`lib/pagos/pdf-detalle-pago.ts`) SÍ maneja SICORE/descuento (columnas condicionales), pero la **`CashFlowRow`** del hook (`useMultiCashFlowData`) NO incluía `monto_sicore`/`descuento_aplicado`/`monto_a_abonar` (solo `sicore`/`imp_total`) → el caller del Cash Flow (`generarPDFPagosSeleccionados`) recibía `undefined` → columnas no aparecían. **Fix:** exponer los 3 campos en la fila ARCA individual + de grupo (suma). El **Modal** (`mapFacsAItems`) ya los pasaba bien (bug era solo Cash Flow). **Testear: descargar detalle desde Cash Flow y ver Retención/Descuento.** |
| B-FEAT-PAGO-MULTIMEDIO | 🟢 | Media | **Detalle de pago con VARIOS medios (transferencia + echeq)** — ✅ **HECHO (2026-07-21, commit 4e033f1, sin testear).** Nueva lib `lib/pagos/medios-pago.ts` (`obtenerMediosPagoFactura`: reúne anticipos=transferencia + cheques=echeq + transferencias directas del extracto `msa_galicia`, por `factura_id`/`template_cuota_id`). El **PDF Detalle de pago** ahora agrega una sección **"Desglose del pago"**: cada medio (con banco/nro/fecha del echeq) + Retención SICORE + Descuento = **Total factura** (con aviso ⚠ si no cuadra ±$1); la tabla principal oculta Transferido/Cancelado cuando hay desglose. Lo pasa el caller del Cash Flow (`generarPDFPagosSeleccionados`, solo ARCA). **Caso testigo Longo:** anticipo 6.505.867,50 + echeq 1.456.737,50 + SICORE 129.270 = 8.091.875. **✅ FASE 2 HECHA (2026-07-21, commit 3819fb5):** el **✉ mail-detalle** también usa el desglose — PDF adjunto con la sección + cuerpo del mail listando cada medio (transferencia/echeq). Seleccionando **solo el echeq** el mail incluye la transferencia automáticamente. **BUG CORREGIDO (mismo commit):** el cert SICORE no se adjuntaba al seleccionar echeq+transferencia juntos → el `tipo` se decidía por `fs[0].origen` (si la 1ra fila del grupo era la transferencia/ANTICIPO, `tipo=template` y se salteaba el cert). Fix: `tipo='arca'` si CUALQUIER fila es ARCA (mail + PDF). **Testear.** Residual menor: seleccionar las 2 líneas duplica el anticipo en los totales del cuerpo → mejor marcar solo el echeq (o pulir para que la transferencia no haga falta seleccionarla). **Falta:** la vista pantalla-detalle (secundario). |
| B-FEAT-14 | 🔴 | Media | **Análisis productivo-económico (engorde)** — módulo NUEVO en Historial pesadas (`components/analisis-productivo.tsx` + `segmentador.tsx`). Incluye: multi-segmentador · marcado reposición (es_torito) · análisis margen (calcular) · escenario B dinámico (16 vars) · cadena de etapas · punto de equilibrio · análisis de sensibilidad · guardar/cargar/borrar estudios (localStorage+.json) · **precios de mercado** (scraping entresurcosycorralesya, botón mkt auto-poblar por kg neto+sexo). **Falta TESTEAR TODO** contra el Excel del usuario (ver `MANUAL-USO.md` + memoria `project_analisis_productivo`). **v2 pendiente:** (a) **sub-modal** para ver la sensibilidad más ancha; (b) **persistir** la config de sensibilidad en el estudio (hoy sesión); (c) **export Excel/PDF**: hoy cada segmento exporta lo suyo, PERO no hay export **COMBINADO** (todos los segmentos + la combinada) y el export **no refleja** el punto de salida (sigue "punta a punta") ni el tilde incluido/A-vs-B. El **guardado local + JSON SÍ captura todo** (incluido, salidaEtapa, duplicados). (d) agrupador de segmentos + sensibilidad de cadena. (2026-07-09) · **HECHO 2026-07-10/11 (commits 0551bb8/2941fb5/aff89e6/88a3a5a):** (1) precios de mercado scrapeados se **guardan/restauran CON el estudio**; (2) **congelar segmentado** con foto + receta → al cargar la app pregunta **📌 foto** (snapshot, no toca BD) vs **🔄 re-link** (reproduce del config); (3) **Estimado configurable** *desde* (pesada base) / *hasta* (fecha del análisis) → reproduce el kilaje exacto y permite recuperar estudios viejos a mano; (4) **import pesadas por columna `Caravana` no oficial** (CUT/Descarte en `caravana_oficial`, toros en `caravana_interna`). Testeado visualmente OK por el usuario. · **HECHO 2026-07-13:** (5) **export COMBINADO del estudio** (⬇ PDF total = resumen + detalle por segmento · ⬇ Excel total = hoja Resumen + hoja por segmento; PDF declarativo reusado del export individual; respeta tilde `incluido`) → cierra el v2-(c); (6) **💾 Actualizar «estudio»** (sobrescribe el estudio abierto sin re-tipear nombre) + **Guardar como…** (nuevo) → evita duplicados. · **⏳ PENDIENTE DE TEST (2026-07-13, el usuario testea luego):** commits `9150fdb` (export combinado PDF/Excel + Actualizar), `93f540e` (detalle por etapa en el export), `9da43e8` (panel de sección Fase 1: individuos + sub-segmentar), `f58bf39` (panel de sección Fase 2: índices históricos ganancia p-p / últimas pesadas + promedio grupo). Todo en `desarrollo`, sin mergear. |
| B-FEAT-COSTOS-PRODUCTIVOS | 🔴 | Alta | **Costos productivos atados a la venta (ganadería)** — cada venta presupuestada lleva su costo variable: maíz, concentrado, sanidad, verdeos. **La unidad de planificación es la ACTIVIDAD**: se carga "este lote hace recría del 1/4 al 30/9" y salen solos la curva de peso, el consumo mes a mes, lo que falta comprar y el egreso. El motor de ración YA existe (`calcular()` en `analisis-productivo.tsx:150`) y el stock de insumos también (`productivo.stock_insumos` / `movimientos_insumos`). Plan C-1..C-8 en el dossier § FASE C. **0 código** — planificado 2026-07-30. |
| B-FEAT-PRESUPUESTO-CUENTAS | 🟡 | Alta | **Presupuestar cuentas contables** — panel nuevo en Presupuesto (`components/panel-presupuesto-cuentas.tsx` + `lib/presupuesto/modos.ts`). 6 modos por cuenta (última FC · promedio N · estacional · por cabeza · manual · excluida) con sugerencia automática según cómo se comportó la cuenta, explicación de cómo se calculó cada celda, y control de cordura contra los últimos 6 meses reales. Vista `presupuesto_historia_cuentas` unifica ARCA + histórico por `nro_cuenta` (estaban partidos por mayúsculas y solapados en dic-2025). **Sin testear** — 2026-07-30. |
| B-FEAT-CONTROL-PROVEEDORES | 🟡 | Media | **Control de subas de proveedores vs IPC** — panel en Presupuesto (`components/panel-control-proveedores.tsx` + `lib/proveedores/control-subas.ts`) con export Excel y PDF. Mide punta a punta (NO mín-máx: el monto mezcla precio y cantidad) y separa precio de consumo contando cuántas veces bajó. Semáforo contra el IPC acumulado del mismo período; si falta IPC no inventa la comparación. **`indices_ipc` está vacía** — se carga en Precios y TC. **Sin testear** — 2026-07-30. |
| C-17 / C-19 | 🔴 | Alta | **Cerrar el presupuesto como una sola cosa.** (a) **C-19**: bajar el bloque de cuentas contables a la grilla y sumarlo al TOTAL EGRESOS (hoy está en un panel aparte a propósito, ver cierre de sesión); (b) **C-7**: ídem costos de producción, que ya se calculan por tramo pero no bajan; (c) **C-17**: proyectar los templates donde no hay cuota cargada — las cuotas se cortan en dic-2026. La distinción de qué template quiere el usuario cargado a mano ya existe en `egresos_sin_factura.aplica_generacion` (true = Cargas Sociales, SICORE, UATRE… = avisar 'falta generar la campaña'; false/null = proyectar en silencio). 2026-07-30. |
| B-FEAT-15 | ⏸️ | Baja | **Pesadas sin caravana (`sin_idv`)** — hoy se cuentan y se **descartan**. Pedido: en el import preguntar "dejar de lado / sumar al total (sin caravana)" y que cuenten en el promedio de la segmentación. **Diferido por el usuario**: complica el sexo (un pesaje sin caravana no tiene sexo → no cae limpio en Machos/Hembras del multi-segmentador). Retomar con calma. (2026-07-09) · **Nota:** distinto del import por columna `Caravana` NO oficial (CUT/Descarte, toros) que SÍ se hizo (commit aff89e6, B-FEAT-14); `sin_idv` = pesaje sin ninguna caravana, sigue diferido. |
| B-FEAT-17 | 🔴 | Media | **Precios de mercado desde web (entresurcosycorralesya.com)** — traer Prom.Kilo / Kilo+ / Kilo− / Bulto por categoría-rango (URL parametrizable `?desde=&hasta=`) para poblar los precios del análisis de engorde según nuestros kilajes/categorías. **La tabla se carga por JS** (no viene en el HTML). **ENDPOINT ENCONTRADO (2026-07-09):** `https://www.entresurcosycorralesya.com/ajax-modulo-ternero.php?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` → devuelve la tabla HTML completa (15 filas, 8 cols: Categoría, Cantidad, Prom.Kilo, Kilo+, Kilo−, Prom.Bulto, Bulto+, Bulto−). Server-side, sin CORS issue vía API route. **HECHO (2026-07-09):** `app/api/precios-mercado/route.ts` (param `sexo=macho/hembra` → ternero/ternera, excluye Holando, parsea límites de peso). En el análisis: panel "Traer precios" + botón `mkt` por segmento/etapa que autopobla. **Matemática acordada:** base = **Kilo+ (máx) del rango asignado a su extremo liviano (pesoLo), interpolado** por kg NETO (post-desbaste) × (1+prima% calidad, editable default 0). Sexo derivado de la Fuente. Resalta el rango usado. **Ojo:** el sitio publica con demora → días recientes vienen VACÍOS (default de fechas ya termina 3 días atrás; mensaje claro si no hay datos). El usuario reportó que el sitio no abría ni desde Chrome (2026-07-09) → verificar si es caída temporal del sitio. |
| B-FEAT-16 | 🔴 | Media | **Import pesadas SIN dedup** — `productivo.pesadas_terneros` solo tiene PK en `id` (NO unique por `ternero_id+fecha`, verificado 2026-07-09). Re-importar un animal sobre una fecha ya cargada **duplica** la pesada en silencio. Columnas del historial = por fecha (mismo día → misma columna). Evaluar: unique constraint `(ternero_id, fecha)` o chequeo previo en el import. (2026-07-09) |
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

## <a id="b-feat-presu-ingresos"></a>B-FEAT-PRESU-INGRESOS — Presupuesto de INGRESOS: arrendamientos agrícolas (2026-07-26)

**Diseño completo** (fórmulas, reglas, DDL, UI, fases) → `DISEÑO_PRESUPUESTO.md`
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

**Y hubo que distinguir mensual de puntual por DENSIDAD, no por el patrón de meses.** El
verificador lo encontró: *Cargas Sociales* con seis meses cargados (ene-jun) parecía no pagar de
julio en adelante. La densidad — meses con cuota sobre meses del tramo — lo resuelve: ≥ 80 % es
mensual y se proyecta todo el año; menos es de meses puntuales y se respeta el patrón.

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

## 🗂️ Archivos que este documento reemplaza (ya borrados / a borrar)
- `PENDIENTES_GENERAL.md`
- `PENDIENTES_PUSH_A_MAIN.md`
- `PENDIENTES-PROXIMA-SESION.md`
- Secciones de pendientes incrustadas en `CLAUDE.md`
