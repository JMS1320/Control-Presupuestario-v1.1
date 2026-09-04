# 📖 MANUAL DE USO — flujo de trabajo del sistema

> **Qué es:** cómo el USUARIO opera cada módulo (el flujo real de trabajo), no la arquitectura de datos (eso → `ARQUITECTURA-BD.md`).
> **Para qué:** entendimiento compartido usuario↔Claude del "cómo se usa", que hoy estaba desparramado.
> **Cómo se mantiene:** cuando el usuario diga *"registra"*, actualizar la sección del módulo tocado (además de las otras dimensiones — ver `CLAUDE.md` § Dimensiones de registro).
> **Estados:** ✅ definido y en uso · 🟡 en uso pero con propuesta de cambio · ⏸️ decisión pendiente (a evaluar juntos).

---

## 💸 Módulo: Pagos / Egresos

### Base de operación del usuario (cómo trabaja hoy) 🟡
- El usuario gestiona los pagos desde el **Modal de Pagos** = botón **"Pagos"** dentro de la vista **Facturas/Egresos** (abre un modal/diálogo). Es su **~90%**.
- Históricamente usaba el **Cash Flow** (panel consolidado). Lo dejó porque el Modal de Pagos le muestra **más rápido lo pendiente de pago**, sin el "ruido" de lo pendiente de conciliar.
- **Ventaja del Cash Flow:** pantalla más grande, se ven y editan **más datos** a la vez.
- **Definición del usuario:** la gestión es desde el **panel central consolidado** (incluye TODAS las categorías: ARCA, templates, anticipos, sueldos, ventas), **no** desde las grillas por módulo (grilla FC / grilla templates). Ir a esas grillas para gestionar **no** es el flujo deseado.
- Regla del Cash Flow: **`conciliado` NUNCA se muestra** en Cash Flow (sale al conciliar).

### Modelo de fechas (4) ✅
- `fecha_emision` — solo FC, viene de AFIP.
- `fecha_estimada` — interna; **ordena el Cash Flow**.
- `fecha_vencimiento` — firme.
- `fecha_pago` — pago real.
- **Propagación:** `venc → estimada` y `pago → estimada`. **venc y pago NO se tocan entre sí** (ambos alimentan estimada).
- **Templates:** venc **solo** editable desde "Egresos sin Factura" (guardián de BD). **FC:** venc editable.
- Detalle técnico del refactor: `PENDIENTES.md` A-TEST-06.

### ⏸️ DECISIÓN PENDIENTE — dónde se gestionan los pagos (evaluar juntos)
Dos propuestas sobre la mesa. **Conservar ambas hasta decidir.**

**Propuesta A — Claude (mejorar columnas del Modal de Pagos):**
Vista Pagos con roles fijos + color para el estado (sin columnas "mágicas" que muten):
- *Templates:* **Vence** (read-only; muestra venc firme, o estimada en color suave si no hay venc) + **Fecha Pago** (editable).
- *ARCA:* **Emisión** (RO) + **Vence** (editable = fecha objetivo de pago) + **Fecha Pago** (editable).
- Re-estimar / editar venc de templates: desde grilla/cash flow.
- *Contra:* obliga a ir a otras vistas para algunas ediciones (el usuario NO quiere eso).

**Propuesta B — Usuario (Cash Flow como base única, reemplazar el Modal):**
Mejorar el Cash Flow para que **reemplace** al Modal de Pagos y usarlo como panel único (como hacía siempre):
- **Vista default "operativo":** desde **hoy en adelante** + **todo lo impago** (vencido impago pasado + futuro), **nunca `conciliado`**. Así entra y ve lo mismo que el Modal, sin ruido.
- Agregar **filtros/chips/botones** para acotar (estado, origen, fecha) sin ir a grillas.
- Objetivo: **un solo flanco** de gestión; luego **deprecar/borrar** el Modal de Pagos.
- *A favor del usuario:* pantalla grande, todo editable, panel central por definición.

**A resolver:** qué le falta al Cash Flow (filtros/botones) para cubrir el 100% de lo que hoy hace el Modal, y si conviene converger todo ahí. NO tocar pagos hasta decidir.

### Nomenclatura
- **"Modal de Pagos"** = botón "Pagos" en la vista Facturas → abre un modal (diálogo). En código: `mostrarModalPagos` / "Vista Pagos". Sí, es técnicamente un **modal**.
- **"Cash Flow"** = panel consolidado (`vista-cash-flow`).
- **"Modo Pagos" del Cash Flow** = botón "PAGOS" DENTRO del Cash Flow (`modoPagos`, `vista-cash-flow` l.799): NO es otra pantalla, es un **modo** del mismo Cash Flow (filtros por origen + multiselección para pago en lote). Usa el mismo código.
- **"Pago Manual"** = modal chico aparte (`modalPagoManual`) para cargar un pago a mano (ej. Otros Gastos).

### 🗺️ Mapa de edición (centralización) — base del plan de migración
**Pieza compartida:** `hooks/useInlineEditor.ts` = definición central de "cómo se edita un campo" (parsea, aplica venc/pago→estimada, rutea venc de templates→RPC, guarda + avisa a la pantalla).

| Lugar | Fechas | Otros campos | Centralizado |
|---|---|---|---|
| **Cash Flow** `vista-cash-flow` (incl. "Modo Pagos") | hook ✅ | hook ✅ (+ `actualizarRegistro` grupos) | 🟢 casi todo |
| **Grilla templates** `vista-templates-egresos` | hook ✅ (l.566) | propio `guardarEdicion` (l.715) | 🟡 mitad |
| **Grilla ARCA** `vista-facturas-arca` (grilla) | hook ✅ (l.1118) | propio `celdaEnEdicion`+`guardarCambio` (l.730/1158) | 🟡 mitad |
| **Modal de Pagos** `vista-facturas-arca` (modal) | propio `editandoFechaPagos`+`.update` a mano | propio | 🔴 nada |

*(Bonus: `vista-sector-productivo` también usa el hook.)* La "migración gradual" movió **solo fechas** al hook y se frenó; el resto de campos y el Modal nunca migraron.

**Estrategia (converge con Cash-Flow-como-base):**
1. **Cash Flow** ya es el que más usa el hook → mejor base, casi no se toca. Dejarlo **impecable** (es el 90% del usuario).
2. **Modal de Pagos** (peor infractor) → **NO migrar: BORRAR** y reemplazar por Cash Flow.
3. **Grillas** (templates/ARCA) → terminar de migrar "otros campos" al hook = **limpieza posterior**, menor prioridad.

**⚠️ AVISOS del usuario (no relajarse):**
- **a) Las grillas tienen código propio.** Aunque el foco sea Cash Flow, cuando el usuario edite en la grilla ARCA/templates, features nuevas (ej. `fecha_pago`) **NO estarán ahí salvo que las agreguemos explícitamente**. Riesgo de "en Cash Flow anda pero en la grilla no". Mantener las grillas **consistentes** (o saber que están incompletas) — no darlas por hechas.
- **b) El "Modo Pagos" del Cash Flow** usa el mismo código (no es flanco aparte), pero **estudiar al final** si el usuario lo usa o se descarta.

### ⚠️ SICORE — v1 vs v2 (ACTUALIZADO 2026-07-15: la registración v2 YA está en Cash Flow)
- **v2 (correcta, en uso):** sistema completo → tabla `msa.sicore_retenciones` + `estado_quincena` (abierta/cerrada/declarada) + certificados perpetuos + anulación (no DELETE) + Export v2 + `TablaRegistrosV2` + DDJJ.
- **La registración v2 ya está compartida y la usa el Cash Flow:** helper `lib/sicore/registrar-retencion.ts` (`registrarEnSicoreRetenciones`, "mirror verbatim" del que tiene el Modal) + `lib/sicore/quincena.ts` (`generarQuincenaSicore` centralizado). El Cash Flow (`finalizarProcesoSicoreCF`) ya (1) cambia estado, (2) estampa la FC compat y (3) **llama `registrarEnSicoreRetenciones`** → escribe `sicore_retenciones` igual que el Modal (numeración perpetua, dedup cuit+tipo+quincena, certificados). El **cálculo** (`calcularRetencionSicoreCF`) usa la misma fórmula que el Modal.
- **La GESTIÓN v2** (TablaRegistrosV2, cierre/declaración, certificados, Export TXT, DDJJ) **sigue viviendo en el Modal / vista ARCA** — no se mueve; Cash Flow solo dispara el registro.
- **Gaps de paridad Cash Flow vs Modal:** (1) ✅ guarda de `estado_quincena`; (2) 🟡 quincena desde `fecha_pago` (CF) vs `fecha_vencimiento` (Modal); (3) ✅ Fac C skip; (4) ✅ `descuento_aplicado`; (5) ✅ **eCheq (2026-07-21, sin testear)**.
- **eCheq en Cash Flow (paridad, 2026-07-21):** cambiar estado de una FC (o anticipo) a **ECHEQ** abre un modal (banco, número, fecha emisión, fecha cobro). Funciona desde el **Shift+Click** (modalito Cambiar Estado) y desde el **selector de estado en LOTE**. El echeq **pasa por el mismo flujo SICORE que "pagar"** (la retención se calcula igual, la fecha de emisión define la quincena). Al finalizar: `estado='echeq'`, `metodo_pago='echeq'`, `fecha_cobro_echeq`, y se **registra el cheque en `msa.cheques`** por el **neto a librar** (imp_total − retención − descuento). Lógica de guardado compartida en `lib/pagos/echeq.ts`.
  - **Si la FC YA tiene SICORE aplicado** (p.ej. un saldo con anticipo vinculado que ya heredó la retención): el echeq es **directo** — registra el cheque por el **saldo real (`monto_a_abonar`)** sin recalcular SICORE.
  - **Distintivo visual:** las filas en echeq muestran un badge **"📝 ECHEQ"** en la columna proveedor + fondo verde con borde izquierdo.
  - **Para re-hacer el echeq de una FC que ya está en `echeq`:** primero cambiala a `pagado` (o pendiente) y volvé a ponerla en echeq (sino no reabre el modal).
  - Los cheques se ven/gestionan en la sección **Cheques** del Cash Flow.
- **Detalle de pago multi-medio (PDF + mail, 2026-07-21):** si la FC se pagó con **varios medios** (ej. transferencia + echeq del saldo), tanto el **PDF de descarga** como el **✉ mail-detalle** muestran una sección **"Desglose del pago"**: cada tramo (Transferencia, ECHEQ con banco/nro/fecha de cobro, transferencia directa) + la **Retención SICORE** + descuento, que **suman el total de la factura** (avisa si no cuadra). Reúne los medios de `anticipos_proveedores` + `msa.cheques` + `msa_galicia` (lib `lib/pagos/medios-pago.ts`). **"Anticipo" se muestra como "Transferencia"** (término interno, no va al proveedor). **Recomendado: para el mail seleccioná SOLO el echeq (la factura)** — el desglose incluye la transferencia automáticamente y adjunta el certificado SICORE. (Seleccionar echeq+transferencia juntos también adjunta el cert, pero duplica el anticipo en los totales del cuerpo.)
- **Reset de FC a pendiente (2026-07-21):** al revertir una FC, **avisa siempre** lo que hará (anula SICORE, borra descuento, restaura el monto). Si tiene **anticipo vinculado**, ofrece 2 opciones: **Mantener** (la FC recuerda el saldo: monto = total − anticipo, el anticipo sigue vinculado) o **Eliminar** (borra la fila del anticipo + su SICORE/cheque, el monto vuelve al total).

### Inventario de funciones del Modal (qué debe existir en el "centro de mandos")
| Función | Hoy dónde | ¿En Cash Flow? |
|---|---|---|
| Subtotales por estado (preparado/pagar/pendiente) | Modal (l.9271, 10037…) | ❌ portar |
| Agrupar pagos/templates | Modal (l.9293/9381/9445) | ✅ `agruparSeleccionados` (lib/pagos/agrupar) + paridad fina (nombre combinado, responsable templates, monto en pesos) |
| **Desagrupar** (deshacer grupo) | Modal (desagruparPago/desagruparTemplates) | ✅ **botón ✕ en la fila-grupo** (lib/pagos/desagrupar; deshace todo el grupo). En CF el grupo = 1 fila consolidada → no hay desagrupar parcial |
| PDF detalle de pago | `lib/pagos/pdf-detalle-pago.ts` | ✅ **unificado 2026-08-13** — se borró la copia inline de Egresos (arrastraba el bug del Total Cancelado, A-BUG-24) |
| Export Excel de pagos | Modal | ❌ extraer a util |
| Cambiar estado (pagar/preparado/pagado) | ambos | ✅ ya |
| Editar fechas/campos | hook | ✅ ya (fecha_pago incl.) |
| **SICORE v2 (registración)** | `lib/sicore/registrar-retencion.ts` (compartido) | ✅ **ya lo usa** (`finalizarProcesoSicoreCF`) — faltan gaps de paridad (ver arriba) |
| SICORE v2 GESTIÓN (TablaRegistrosV2, cierre/declaración, certificados, export, DDJJ) | Modal / vista SICORE | ⏸️ **NO mover** → queda en vista SICORE dedicada; Cash Flow solo dispara el registro |

**Complejidad honesta:** la mayoría son funciones que **ya existen** → se **extraen a un módulo/util compartido** y ambas pantallas las usan (mover, no reescribir; mecánico, riesgo bajo-medio). La excepción es **SICORE v2**: ahí la clave es **separar registración (compartir/disparar desde Cash Flow) de gestión (dejarla en su vista)** — así no hay que mudar todo el subsistema.

### 🪜 Plan de migración por etapas (Cash Flow como base)
- **E0 — refactor `fecha_pago`**: templates ✅ completo. ARCA = **solo la columna creada**; el pago-write FC + SICORE→fecha_pago **se pliegan a E2/E3** (capa compartida / Cash Flow), **NO se construyen en el Modal** (se deprecará). Para FC no es bug urgente (venc≈fecha a pagar hoy). Guardián templates + merge = al final.
- **E1 — Vista operativa del Cash Flow** (bajo riesgo, alto valor): default "impagos: vencidos + hoy en adelante, nunca conciliado" (usa `aplicarFiltros` que ya existe) + **chips estado/origen con Todos/Ninguno** + arreglar el filtro avanzado. Con esto ya ves lo mismo que el Modal.
- **E2 — Paridad de funciones de pago:** subtotales + agrupar + PDF detalle + export Excel pagos → **extraer a utils compartidas**.
- **E3 — SICORE v2 en Cash Flow** (pesada, fiscal): 🟢 **el grueso YA está** — Cash Flow usa la registración v2 compartida. Falta cerrar los **gaps de paridad** (arriba); el #1 (guarda estado_quincena) es el fiscal/prioritario. Testear a fondo con un pago real.
- **E4 — Centralizar `generarQuincenaSicore`**: 🟢 **hecho** (`lib/sicore/quincena.ts`). Pendiente residual: el Modal todavía tiene su copia local de `registrarEnSicoreRetenciones` (dedup al deprecarlo, E5).
- **E5 — Deprecar/borrar el Modal de Pagos** cuando Cash Flow cubra el 100%.
- **E6 (posterior, baja prio) — migrar "otros campos" de las grillas al hook.**

**Estado de ejecución:**
- **E1 implementado** (commit `b0028d3`, pend. test). Flecos abiertos (estéticos, cerrar después): (1) arreglar el "filtro avanzado" (falta que el user diga qué falla); (2) sacar el filtro viejo de "Modo Pagos" (arca/template/anticipo), redundante con los chips; (3) revisar labels de los chips de estado; (4) **filtro fecha para estado `debito`**: ocultar débitos anteriores a hoy (se asumen pagados por débito automático), mostrar futuros, con ventana de gracia ~1 semana hacia atrás. Refinamiento del default operativo.
- **⚠️ REGLA E2 (reuso, no reescribir):** al llevar PDF detalle / Export Excel al Cash Flow, **extraer las funciones EXISTENTES tal cual a `lib/`** (con toda su lógica: CBU, mail, agendar proveedores, etc.) y que ambas vistas las llamen. NO escribir generadores nuevos → cero bugs nuevos. Extracción = mover verbatim + parametrizar, verificando que la salida sea idéntica.
- **⚠️ SICORE en Cash Flow = v1 INCOMPLETA** (estampa el campo pero NO crea el registro v2). Hasta E3: **pagar FC con retención → desde el Modal** (v2), sino se sub-declara. Cash Flow OK para ver + pagar templates/anticipos/sueldos. SICORE completo = **E3**.
- **E2 COMPLETO** (pend. test, commits `2fe8c89`/`48019a0`/`0cd2617`/`681b515`): ✅ **E2.1 Subtotales** (`lib/pagos/subtotales.ts`) · ✅ **E2.2 Agrupar** (`lib/pagos/agrupar.ts`) · ✅ **E2.3 Comprobante PDF** (`lib/pagos/pdf-detalle-pago.ts`, verbatim) · ✅ **E2.4 Export lote Galicia** (reusa `ModalExportarLote`). Todos como botones en Modo Pagos del Cash Flow. Capa `lib/pagos/` establecida.
  - ⚠️ **A testear con cuidado** (no se testeó): (a) **Agrupar ESCRIBE en BD** (`grupos_pago` + `grupo_pago_id`) → probar con 2 FC mismo proveedor; si sale mal, desagrupar desde el Modal. (b) Export: armado de items (grupos/schema, empresa='MSA' hardcode). (c) PDF idéntico al del Modal.
- **E3 SICORE en Cash Flow — desarrollado, ⚠️ FISCAL sin testear** (commits `dd9214a`/`e17bebe`): capa `lib/sicore/` (`quincena.ts` helper único + `registrar-retencion.ts` mirror del registro v2). `finalizarProcesoSicoreCF` ahora **crea el registro v2** (`sicore_retenciones` con numeración de certificados) además del estampado v1, y la **quincena sale de `fecha_pago`** (fallback venc/estimada). Abort del Cash Flow ya era correcto (restaura a pendiente).
  - 🔴 **NO usar SICORE desde Cash Flow hasta testear JUNTOS** (crea certificados con numeración perpetua — un bug ensucia la numeración fiscal). Mientras tanto: **SICORE desde el Modal** (v2, intacto). Test: pagar 1 FC de prueba con retención desde Cash Flow → verificar el registro en `sicore_retenciones` (quincena desde fecha_pago, nro_certificado correcto, montos) vs lo que haría el Modal; si está mal, **anular desde el Modal**.
  - Refinamiento pendiente: enforce `fecha_pago` obligatoria al pasar a pagar (hoy usa fallback venc/estimada).
- **E4 (lado Cash Flow) HECHO** (commit `06c2653`): borrada la copia local `generarQuincenaSicoreLocal`; las 5 llamadas del Cash Flow usan el helper único `lib/sicore/quincena` (fórmula idéntica, sin cambio de comportamiento). Falta **E4 lado Modal** (su `generarQuincenaSicore` propia) → se hace al deprecar el Modal (E5), para no tocarlo antes.

### 🔍 Auditoría migración Cash Flow (2026-07-07) — pendientes + riesgos de bug
**Dejado de lado (pendiente):**
- Guardián templates **no armado** (post-merge) → hoy la protección de venc de templates es **solo UI**, no BD.
- **Nada mergeado** a main; **nada testeado**.
- ✅ ~~Grilla ARCA sin `fecha_pago` editable~~ HECHO (commit `411b810`): columna `fecha_pago` editable en la grilla ARCA (config+interfaz+render+hook+fix localStorage).
- **Desagrupar NO está en Cash Flow** (si agrupás mal, se desagrupa desde el Modal).
- ✅ ~~enforce `fecha_pago` obligatoria al pagar~~ HECHO (commit `c52fbe4`): bloquea pasar FC a 'pagar' sin fecha_pago cargada.
- E1 flecos: filtro avanzado (falta que el user diga qué falla), labels de chips (cosmético). ✅ ~~filtro origen redundante~~ HECHO (`411b810`, los chips lo cubren). ✅ ~~filtro fecha para `debito`~~ HECHO (`c52fbe4`): oculta débitos vencidos + toggle.
- E5 (deprecar Modal), E6 (grillas), E4 lado Modal.

**Riesgos de bug a verificar en el test:**
- 🔴 **SICORE v2 (fiscal, sin testear):** numeración de certificados; que la quincena salga de `fecha_pago`; que el registro quede igual al del Modal. **Los writes de desarrollo van a la BD compartida → visibles en prod.**
- 🔴 Si NO cargás `fecha_pago`, SICORE cae a venc (fallback) → puede no ser la quincena que querés (enforce pendiente).
- 🟡 **Agrupar:** `monto_total` usa `debitos` (revisar vs `montoEnPesos` del Modal en FC USD); origen `agrupacion/directo` del último ítem del lote (metadata menor).
- 🟡 **PDF:** si seleccionás una **fila de grupo**, sale 1 línea agregada (el Modal saca por-FC); FC USD (montos).
- 🟡 **Export:** `empresa='MSA'` hardcode (ok si Cash Flow siempre es MSA).
- 🟢 Chips: contador usa data completa vs visible (cosmético con búsqueda); mensaje de "sin datos" viejo.

### ✅ CHECKLIST DE TEST — Cash Flow (listo para usar, numerado)
> Cuando el usuario pida testear, presentar esta lista tal cual para que responda punto por punto.

**🟦 E1 — Vista operativa**
1. Barra de chips (Estado + Origen) siempre visible arriba de la tabla, con contadores.
2. Default operativo al entrar: se ven impagos (todo menos `pagado`); `conciliado` nunca aparece.
3. Todos / Ninguno en cada grupo de chips (al instante).
4. Botón "Ver todo" → muestra también `pagado`.
5. Filtro `debito`: los débitos vencidos (anteriores a hoy−7d) se ocultan; toggle "ver débitos vencidos" los muestra.
6. Búsqueda rápida + filtro avanzado siguen andando encima de los chips.

**🟩 E2 — Funciones (botones en "Modo Pagos")**
7. Subtotales (barra): Débitos / Créditos / Neto + desglose por estado — se recalcula con chips/búsqueda.
8. 🔗 Agrupar ⚠️(escribe BD): ≥2 filas mismo proveedor → grupo de pago. (Si sale mal, desagrupar desde el Modal.)
9. 📄 Comprobante PDF: seleccionás filas → PDF por proveedor. ¿Sale igual al del Modal?
10. 🏦 Exportar lote Galicia: seleccionás filas → modal de export (CBU/mail/completar). ¿Igual que desde el Modal?

**🟥 E3 — SICORE (FISCAL, cuidado)**
11. SICORE v2 desde Cash Flow: pagar FC con retención → crea el registro en `sicore_retenciones` (certificado). ⚠️ probar 1 FC controlada; si está mal, anular desde el Modal.
12. Quincena desde `fecha_pago` (no desde venc).
13. Enforce `fecha_pago`: no deja pasar FC a "pagar" sin fecha de pago (avisa).
14. Abort SICORE: cancelar → la FC queda en pendiente (no pasa a pagar).

**🟨 Fechas (refactor — Cash Flow + grillas)**
15. `fecha_pago` editable en: columna Cash Flow · grilla templates · grilla ARCA.
16. Venc read-only para templates en Cash Flow (editable solo en "Egresos sin Factura").
17. Propagación: editar `fecha_pago` → la fila se reubica en el Cash Flow (arrastra a estimada).

---

## 🐄 Módulo: Análisis productivo-económico (engorde) 🟡 (nuevo, sin testear)

**Dónde:** Sector Productivo → Recría → botón **"Historial pesadas"** (modal). Debajo de las pesadas históricas.
**Para qué:** decidir, por segmento de peso, si conviene comprar/engordar/vender, con proyección de margen y punto de equilibrio.
**Código:** `components/segmentador.tsx` (segmentación) + `components/analisis-productivo.tsx` (análisis). Todo **client-side** (no toca BD salvo el marcado de reposición y el import de pesadas). Estudios se guardan en **localStorage** + archivo `.json`.

### Marcar reposición (grilla Recría, botón 🐂 Reposición) ✅
- Reusa la columna `es_torito` como flag de **reposición** (macho→torito, hembra→ternera rep).
- Chips de filtro por grupo + columnas ordenables + **"Seleccionar N más pesadas"** (respeta el chip activo) → **Marcar / Quitar**. La escritura la dispara el usuario.

### Importar pesadas (Excel) 🟡
- Columnas: **Fecha** (una sola por archivo, DD/MM/AAAA), **Peso** (kg), y la identificación del animal:
  - **IDV** → número de caravana del lector; se convierte a la caravana oficial (15 díg) y matchea `terneros.caravana_oficial`.
  - **Caravana** (opcional, nueva) → caravana **no oficial** (CUT/Descarte, toros): texto tal cual (ej. `B079`). Matchea **texto exacto** contra `caravana_oficial` o `caravana_interna`. Si esta columna tiene valor, se usa en vez de IDV. Resuelve que antes estos animales caían en "sin IDV" y no se podían pesar por import.
- El análisis clasifica en **OK / no encontradas / duplicadas**; para las no encontradas elegís *sin vincular / crear nuevo / ignorar* (amortiguador ante errores). El código de matcheo vive en `app/api/import-pesadas/route.ts`.

#### 🔴 La fecha se CONFIRMA, no se detecta 🟡 *(2026-08-03, sin testear)*
En el **paso 1** la fecha es un **campo editable**. La app propone la que leyó del archivo, pero
**la que se graba es la que quede ahí**.

Si el archivo es **ambiguo** —el número que guardó Excel y el texto que muestra la celda no
coinciden— el recuadro se pone **ámbar** y ofrece **las dos opciones en botones**, con el texto de
la celda a la vista:

> ⚠️ La celda muestra **8/3/2026**, pero Excel la guardó como **03/08/2026**. Confirmá cuál es.

**Por qué existe esto.** Un `3/8` en una planilla **no se puede resolver con certeza**: depende del
formato de la celda, no de lo que se tipeó. El 2026-08-03 entraron **176 pesadas de agosto con
fecha de marzo**, en silencio, y sólo se notó porque el peso promedio del rodeo hacía un pico y
volvía a bajar. Detalle → `KNOWLEDGE.md` § *Fechas de Excel*.

##### 🧪 Cómo probarlo
1. Importar un archivo de pesadas → en el paso 1 tiene que aparecer **la fecha en un campo `date`**,
   con la fecha en letras al lado.
2. **Cambiarla a mano** y confirmar → las pesadas tienen que quedar con **la fecha tipeada**, no con
   la detectada. *(Verificable en el historial: la columna nueva lleva esa fecha.)*
3. Dejar el campo **vacío** → el botón *Importar pesadas* queda **deshabilitado**.
4. Si tenés a mano un archivo con la fecha en formato `m/d`: tiene que salir el **recuadro ámbar**
   con los dos botones, y elegir uno tiene que cambiar el campo.
5. **Control de sanidad después de importar**: el peso promedio de la columna nueva tiene que ser
   **mayor que el de la columna anterior**. Si baja, la fecha probablemente quedó en el lugar
   equivocado de la línea de tiempo.

### 🐂 Comercialización — a quién conviene venderle 🟡 *(nuevo 2026-08-04, sin testear)*

**Dónde está.** Dentro del **Análisis productivo**, en el bloque de entrada/salida de la **etapa 1**.
*(Las etapas 2+ todavía no lo tienen.)*

**Lo primero que hay que entender:**

> **CZ = comercialización = comisión + flete + otros.** No es sinónimo de comisión.
> `CZ = comisión del intermediario + gasto del destino + flete`

Son **tres cobros de tres actores distintos**. Por eso el destino y el intermediario son cosas
separadas: *gordo a Cañuelas* paga 3,5 % a Sáenz Valiente **más** 0,75 % del frigorífico.

#### Cómo se usa
```
Vende como [gordo ▾]  Destino [Arrebeef ▾]  Intermediario [— ninguno ▾]
$/kg res [5.400]  Categoría [Novillo Gordo ▾]  Rinde [58] %
Camino [53 km · Ruta 9 ▾]  Camión [jaula · $445.500 (hasta 15.500 kg) ▾]

  Flete                          $445.500    1,05 %
  ──────────────────────────────────────────────────
  CZ total                       $445.500    1,05 %
```
Al elegir se completan **Desbaste %** y **CZ %** de salida, y **se siguen pudiendo pisar**.

| Se completa solo | De dónde sale |
|---|---|
| **Ración % PV** y **ganancia kg/día** | `productivo.actividades` según el tipo: recría 1,5 % y 0,700 · engorde 3 % y 1,200 |
| **Desbaste** | invernada por peso (≤300 → 3 %, ≤360 → 4 %, ≤400 → 5 %) · gordo siempre 8 % |
| **Comisión** | del intermediario, según invernada o gordo |
| **Flete** | `arranque + seguro + km × $/km`, por la cantidad de viajes |
| **Categoría y rinde** | del sexo del segmento + el tipo |
| **Precio del matarife** | el de Cañuelas menos 10,5 % |

**La mortandad va en CERO** al cambiar el tipo, a propósito. La actividad tiene 1 % cargado pero
el análisis arranca sin mortandad; se pone a mano si el caso la tiene.

#### Lo que NO se elige solo, y por qué
- **El camino.** Arrebeef tiene tres (53 / 63 / 88 km) y *"no siempre se pueden usar los mismos"*:
  es la distancia **pactada con el transportista**, no la más corta. Hasta que lo elijas, **no
  calcula**.
- **El camión.** Se sugiere por **si entra o no entra** —chasis cuando hay poco, jaula si no
  entra—, **no** por cuál sale más barato. Se puede cambiar.
- **El precio.** Cada destino paga **lo suyo**, en su unidad. Los derivados vienen **en gris** como
  sugerencia y se pisan: la referencia del matarife es el *máximo* de Cañuelas, que no es lo que
  vas a conseguir ahí.

#### Ventas a la RES
Arrebeef compra **a la carne**, así que el precio va en un campo aparte (`$/kg res`) y se convierte:

```
$/kg vivo = $/kg res × rinde        (5.172 × 0,58 = 3.000)
```

Todo el análisis trabaja en **peso vivo**. ⚠️ **Sin rinde no calcula nada** — antes multiplicaba el
precio de la carne por los kilos vivos y daba **72 % de más**.

#### Comparar en vez de elegir
Botón **"Comparar los destinos"**: la misma tropa contra los tres, cada uno con su precio editable.
La columna **$/kg vivo** es la comparable — ya tiene descontados flete, comisión y gastos, y el
rinde pasado a vivo. Las filas incompletas **nunca ganan**.

#### 🧪 Cómo probarlo
1. Elegir **gordo** → el desbaste tiene que ir a **8 %** y la ración a **3 %**, la ganancia a **1,200**.
   Cambiar a **invernada** → desbaste según el peso (**4 %** a 320 kg), ración **1,5 %**, ganancia **0,700**.
   ⚠️ **Si el desbaste no se mueve, la derivación no está corriendo.**
2. Con **invernada**: no tiene que aparecer selector de destino, y el flete tiene que ser **0**.
3. Con **Cañuelas + Sáenz Valiente**: la CZ tiene que desglosarse en **3,50 % + 0,75 % + flete**.
4. Con **Arrebeef**: elegir el camino (si no, avisa y no calcula). Poner `$/kg res` y verificar que
   **el precio de venta del análisis quede en ~58 % de ese número**. Si se parecen, la conversión
   no corre.
5. **Comparar los destinos** → poner un precio distinto a cada uno y confirmar que el orden cambia.
6. Borrar el precio de la res → tiene que decir el **monto** del flete y avisar que **la CZ no se
   toca**; el CZ % de la etapa debe quedar como estaba, **no en 0**.
7. La **CZ de entrada** arranca en **3,5 %** y el selector no la toca (la entrada siempre es
   invernada).

#### ⚠️ Lo que falta
- Las **etapas 2+** de la cadena todavía no tienen el selector.
- **Km del matarife** sin cargar (no cobra flete, pero queda para el registro).
- **No hay precio de gasoil** en el sistema: sin él, la proyección del flete a futuro no corre.
- **Plazos de pago**: se ponen al vender, no son estándar por destino.

## 🐄 Vender desde Productivo → Movimientos *(nuevo 2026-09-04)*

**Para qué sirve.** Registrar una venta desde donde es más natural pensarla: *"vendí estas 7 vacas
de descarte"*. No hace falta que salgan de un lote.

> 🔑 **Un movimiento de venta ahora crea también la venta comercial.** Antes sólo daba de baja
> los animales, y esos animales no entraban a facturación, cobro ni presupuesto.

### Cómo se usa
1. **Productivo → Hacienda → Ver Movimientos**.
2. **+ Nuevo Movimiento**, tipo **Venta**. Aparece un aviso verde recordando que se va a crear la
   venta. Cargá lo que tengas; lo que falte se completa después.
3. En la grilla, cada venta muestra su estado a la derecha:
   - **⚠ sin venta** (ámbar) — dio de baja animales pero **no entra al circuito comercial**
   - **💰 venta** — ya la tiene
4. Tocando ese botón se abre la venta entera para completarla.

### Completar la venta
Se carga **lo que se sabe al momento de la venta**: kilos vivos de carga, desbaste, CZ, cliente,
destino y precio si ya se acordó. Lo demás llega después.

**El cliente sale del maestro.** Si no está, tocá **«No aparece — cargar nuevo cliente»** y poné el
CUIT. **Sin CUIT esa venta no se va a poder cruzar con su factura**, así que no lo saltees.

**El destino define si el precio es a la res o al vivo** — Arrebeef compra a la res, Cañuelas al
vivo. Por eso el precio dice *"$/kg res"* o *"$/kg vivo"* según cuál elijas.

> ⚠️ **Si el destino compra a la res y todavía no llegó el romaneo, el importe queda vacío.** Está
> bien: falta saber cuántos kilos de carne dieron. Es preferible a un número inventado con un rinde
> estimado que después no va a coincidir con la liquidación.

### Las caravanas
Se listan **los animales de esa categoría** — una venta de vacas de descarte nunca te va a mostrar
terneros de recría. Tildás los que se fueron.

- El **kilo de cada uno** se precarga con su última pesada y **se puede pisar**: si el día de la
  carga pesaste en el campo, ponés ese.
- Los que **no tienen caravana** se muestran por su observación (*"Vaca Dura que malparió. Robocop"*)
  — para las de descarte, esa razón **es** su identificación.
- Y los que ni siquiera existen como individuo se agregan con **«+ agregar un animal sin caravana»**.

### 🚛 La carga: el camión se pesa UNA vez
Si el camión llevó **varias ventas** —vacas y toros juntos— no cargues el pesaje dos veces:

1. En la primera venta dejá **«nueva carga»**, poné **bruto y tara**, guardá.
2. En la segunda, **elegí esa misma carga** en el desplegable. El pesaje **se trae solo**.

Abajo aparece el control con los tres orígenes del kilaje:

```
✓ Kilos de carga 3.640 · animales 3.640 (0) · otras ventas de la carga 2.661
  · camión 6.500 (+199) — comparando el total de la carga
```

Verde si cierran, ámbar si no. **La diferencia contra el camión no es un error**: son dos balanzas
distintas, y ese desvío repetido a lo largo de varias cargas es lo que después te dice cuál está
descalibrada.

⚠️ *Sin probar todavía → `A-TEST-86`, `A-TEST-87`*

---

## 🐄 Identificar animales de un cambio de categoría *(nuevo 2026-09-04)*

**El problema que resuelve.** Cuando movés vacas al CUT y sólo escribís una observación
—*"Vaca que dejó al ternero"*— ese texto queda **en el movimiento**, no en un animal. No aparece en
la planilla ni se puede adjudicar a una venta.

### Cómo se usa
En **Productivo → Hacienda → Ver Movimientos**, cada fila de **Cambio de Categoría** muestra:

- **⚠ falta identificar N** (ámbar) — hay cabezas sin individuo
- **🐄 N identificados** (gris) — ya está

Tocás el botón y se abre una grilla con **una fila por cabeza que falte**, y **la observación que ya
escribiste viene precargada** como razón. Le agregás caravana y pelo si los tenés, y guardás. Si no
tenés caravana, guardá igual: queda identificado por su razón.

### Al cargar un cambio de categoría nuevo
En el modal, tocá **«identificarlos uno por uno»** y se abren tantas filas como cabezas estés
moviendo. **La razón va por animal**: una se descarta por machorra y la de al lado por diarrea, y
ése es justo el dato por el que se lleva la planilla.

⚠️ *Sin probar todavía → `A-TEST-86`*

---

## 🐄 Ventas de hacienda — el circuito completo 🟡 *(nuevo 2026-08-05, sin testear)*

**Dónde:** Ingresos → **Ganadería**. Separado por **actividad** y por **campaña**.

### El circuito, y qué pasa en cada paso
```
existe y no se decidió    [Presupuestar venta →]
        ↓
PRESUPUESTADA             entra al Presupuesto y al margen
        ↓                 [Confirmar venta →]  ← un solo paso, con las caravanas
CONFIRMADA                baja el stock · va al Cash Flow como ingreso comprometido
        ↓                 llega la liquidación
FIJADA                    se vincula desde Ventas; si es parcial, sigue el remanente
```

### 1 · Presupuestar
En *sin venta presupuestada*, botón **Presupuestar venta →**. El **desbaste** viene de las normas
según categoría y peso (no del 5 % fijo viejo) y es editable. El **precio se puede dejar vacío**:
lo toma de *Precios y TC* por banda de peso, que es lo habitual.

⚠️ **No deja guardar sin ciclo.** Sin ciclo el lote no tiene campaña y el presupuesto no sabe a
qué año imputarlo.

### 2 · Confirmar — un solo paso
Corregís los datos reales, pegás o subís las caravanas, y **un botón** hace tres cosas:
la venta queda registrada, **baja el stock**, y las caravanas quedan adjudicadas.

**Antes de confirmar** se ve la tropa animal por animal —qué es, sexo, pelo, primera y última
pesada— y el cruce que da la certeza:

> Balanza de venta **276,0 kg**/cab · última pesada **278,6 kg** · diferencia **−2,6 kg**
> — *la venta pesa MENOS que la última pesada. O perdieron peso, o la tropa no es ésta.*

**Los kg NO se reparten entre los animales.** La pesada de venta es grupal; prorratearla supondría
que todos ganaron lo mismo por día. Lo que sí se calcula es la **ganancia diaria real del grupo**.

**Dos cosas no dejan confirmar:** una caravana **ya dada de baja** (venderla dos veces no es un
típeo) y que **las caravanas no coincidan con las cabezas**.

### 3 · Editar una confirmada
Botón **Editar** en la fila verde. Se corrigen **sólo las condiciones comerciales** —desbaste, CZ,
flete, precio, plazo, cliente, notas—. **Cabezas y caravanas no**: cambiarlas exigiría revertir la
baja de los animales, y hacerlo a medias dejaría el stock mintiendo.

### 🧪 Cómo probarlo
1. **Presupuestar** desde un disponible → tiene que aparecer como **presupuestada** en su campaña.
2. **Confirmar** con menos caravanas que cabezas → **no debe dejar**, y decir cuántas faltan.
3. Confirmar bien → la fila pasa a **confirmada** en verde, y en *Sector Productivo → Recría* las
   cabezas activas bajan en esa cantidad.
4. ⚠️ **El control que caza el error más caro**: después de confirmar, el **disponible tiene que
   bajar**. Si sigue ofreciendo las mismas cabezas, la existencia no está descontando las bajas.
5. En *Evolución Rodeo*, el lote vendido **no** debe marcarse «desactualizado» (saldo 0).
6. Verificar que la venta aparece en el **Cash Flow** como ingreso comprometido.

### ⚠️ Lo que falta
- El panel *"Cabezas disponibles para vender"* de Evolución Rodeo **muestra lotes, no disponibles**:
  lo que no tiene lote no aparece (`G-04`).
- Hay **dos editores de venta** con capacidades distintas: el de Evolución Rodeo deja elegir *los N
  más pesados* y saca el promedio de ese subconjunto; el de Ingresos no (`G-01`).

### 🐄 Ciclo de recría 🟡 *(nuevo 2026-08-05, sin testear)*
**Dónde:** Sector Productivo → **Recría / Engorde**, arriba de los terneros.

Abre con la **pesada del destete**: cabezas y peso bruto, y el **neto lo calcula la base**
(`bruto × (1 − desbaste)`) — no se carga a mano. El promedio ♂+♀ es **kg totales ÷ cabezas
totales**, ponderado por cantidad.

⚠️ **Sin `$/kg de entrada` el margen de recría no cierra**: los animales entran a costo cero y la
ganancia sale de más. Ese monto es **ingreso de cría y costo de recría a la vez**.

⚠️ El ciclo se nombra por **año** (`2026`), no por campaña jul-jun: arranca con el destete
(feb/mar) y cierra antes de diciembre. El corte contable al 30/06 lo **atraviesa**, no lo limita.

### 🐂 La marca de reposición y la categoría 🟡 *(nuevo 2026-08-05, sin testear)*

**Dónde:** Sector Productivo → Terneros, arriba de la tabla.

**La regla, y la diferencia que importa:**

| | Qué es la marca | ¿Puede diferir de la categoría? |
|---|---|---|
| **Torito** | un **hecho**: no está capado | **NO** — se avisa como error |
| **Ternera de reposición** | un **plan** hasta que se insemina (octubre) | **SÍ** — y esa diferencia *es* el dato |

Por eso el control corre **sólo en machos**. Si corriera en los dos, marcaría como error las 60
vaquillonas, que están bien.

**Si la app avisa** *"9 marcados vs 7 con categoría Torito"*, hay **dos salidas** y elegís vos:

1. **Sacar las marcas de más** — botón *Reposición*, si en realidad no son toritos.
2. **Recategorizarlos** a Torito en Sector Productivo — si sí lo son. Eso **mueve el stock**.

⚠️ **El stock va por CATEGORÍA, no por la marca.** Marcar solo no alcanza para que aparezcan ahí.
Ese fue el caso real: 2 toritos marcados que el stock nunca vio.

#### 🧪 Cómo probarlo
1. Marcar un macho como reposición sin cambiarle la categoría → tiene que aparecer el aviso
   ámbar con los dos números y las dos salidas.
2. Marcar una **hembra** → **no** tiene que avisar nada. La reposición femenina es un estimado.
3. Recategorizar ese macho a Torito → el aviso desaparece solo.

### Segmentadores (multi) 🟡
- **Uno o varios** (botón "＋ Segmentador"). Cada uno tiene su **población** (chips Machos/Hembras/Toritos/Terneras rep) + sus cortes.
- El **sexo arrastra su reposición**: sacar ♂ Machos saca 🐂 Toritos; sacar ♀ Hembras saca ♀ Terneras rep. La reposición se puede togglear sola (Machos sin toritos = "Machos venta").
- Eje de densidad vertical: **arrastrás los divisores** para mover cortes, colapsás contra un vecino para **borrar**, botones **＋ sección** para crear. Excluye bajas (mortandad).
- **Origen del peso:**
  - **Estimado** = pesada base **+ aumento diario (kg/día) × días**. Elegís *desde* (pesada base: **última** por defecto, o una pesada puntual) y *hasta* (fecha del análisis: **hoy** por defecto, o una fecha puntual, con botón "hoy" para volver). Así podés proyectar "desde la pesada X hasta la fecha Y", no solo desde la última.
  - **Pesada** = usa el peso de una pesada elegida tal cual (sin proyección).
  - Al guardar el estudio, *desde/hasta* se **resuelven a fechas concretas** → el estudio reproduce el kilaje exacto aunque después importes pesadas nuevas.
- Así conviven **Machos y Hembras a la vez** sin mezclarse.
- **Panel de sección (▶ desplegar una fila de la tabla):** clickeás un rango y se abre debajo: **(1) Sub-segmentar** — "cada X kg" divide ese rango en sub-rangos (cant/prom/%) para informar al comprador cómo viene el lote; **(2) Individuos e índices históricos** — tabla con caravana + peso + **ganancia diaria punta a punta** (1ª → última pesada) + **ganancia diaria últimas pesadas** (entre las 2 últimas fechas), más el **promedio del grupo** arriba. Usa el **mismo peso estimado** que la segmentación. Solo lectura (no re-hace el proceso).

### Análisis por segmento (columnas) 🟡
- Cada columna es un **Segmento** (＋ Segmento). **Fuente** = elegís una sección de cualquier segmentador (etiqueta "A·Machos: 230/250"). Copia Cantidad + Peso inicio (editables).
- Modelo de engorde (reconstruido del Excel del usuario): precios, desbaste, CZ (comercialización), ración (maíz/concentrado), mortandad. Muestra Entrada/Salida con mermas, precio neto $/kg (con y sin desbaste), y **Ganancia /cab + total**.
- **Escenario B (dinámico):** botón "＋ agregar variable" ofrece las **16 variables de A**; agregás solo las que cambiás → tabla A | B | Δ.
- **Análisis de sensibilidad:** "＋ Ver sensibilidad" → "＋ agregar variable" (base default = presupuestado + paso editable) · escalones por lado (2). Tabla de ganancia/cab moviendo SOLO esa variable (BASE resaltado, verde/rojo). Ves cuánto pesa cada palanca (dónde te destacás). Sumar filas = aproximado (interacciones). No persiste aún.
- **Precios de mercado (referencia + auto-poblar):** panel "Traer precios" (fechas → trae machos+hembras de entresurcosycorralesya). Botón **`mkt`** junto a Compra/Venta/etapas → autopobla el $/kg según el **sexo** del segmento (de la Fuente) y el **kg neto** (post-desbaste). Base = máx del rango en su extremo liviano, interpolado, × (1+prima% calidad). Resalta el rango usado; editar a mano limpia la marca. *(Si "Traer precios" falla: el sitio publica con demora → probá fechas anteriores.)*
- **Cadena de etapas** ("＋ Encadenar etapa"): peso bruto y fecha propagan; mortandad reduce la cantidad; ración usa cant de inicio. Ganancia etapa k = Vk − V(k−1) − ración (costo de oportunidad). Total **punta a punta**.
- **Punto de equilibrio:** misma ganancia por otro camino (pérdida inicial /cab, costo y margen por kg, kg/días para recuperar, días "tuyos"). Coincide exacto (test verificado).
- **Export Excel/PDF** por segmento (botones `⬇xls`/`⬇pdf` en cada uno) **y COMBINADO del estudio** (barra Estudio → **⬇ PDF total** / **⬇ Excel total**): el PDF trae una hoja **resumen** (una fila por segmento: cant, peso ini→fin, $/cab, $ total + TOTAL de incluidos) y después el **detalle completo de cada segmento**; el Excel trae una hoja **Resumen** + una hoja por segmento. Respeta el tilde **incluido** (el TOTAL suma solo los incluidos). **Regla:** al agregar campos al análisis, actualizar SIEMPRE los exports (individual + combinado).

### Guardar estudios ✅
- Barra "Estudio": **💾 Actualizar «nombre»** (aparece cuando hay un estudio abierto → **sobrescribe ese mismo estudio** con confirm, sin re-tipear el nombre → evita ir acumulando duplicados) · **💾 Guardar como…** (crea uno nuevo: pide nombre; avisa si ya existe) · **Cargar guardado** (dropdown) · **🗑 borrar…** (selector: borra cualquier estudio con confirm, sin cargarlo) · **⬇/⬆ Archivo `.json`** (portable).
- Guarda TODO: segmentadores + segmentos + etapas + escenario B + el vínculo Fuente + **los precios de mercado scrapeados** (rango de fechas, prima calidad y las tablas machos/hembras traídas). Al cargar un estudio se restauran esos precios tal cual (con la fecha en que se trajeron, que se muestra en el panel), así el análisis queda reproducible sin volver a scrapear. localStorage = esta PC/navegador/URL; el **archivo** = backup a prueba de todo.

**Congelar el kilaje del estudio (para revisar análisis viejos sin que se muevan):** cada segmentador guarda la **receta** (pesada base *desde* + fecha *hasta*, resueltas a fecha concreta) **y una foto congelada** de los cortes/pesos. Al cargar un estudio la app **pregunta** cómo linkear el segmentado:
  - **📌 Datos guardados (foto)** → muestra la foto tal cual; no depende del rodeo actual → inmune a pesadas nuevas o borradas (es el modo "a prueba de bugs"). El segmentador muestra el badge **📸 foto guardada** + tabla read-only.
  - **🔄 Re-linkear con el rodeo** → recalcula usando *desde/hasta* guardados (el propio config), no "la última + hoy" → reproduce el mismo kilaje aunque hayas importado una pesada nueva. Requiere que las pesadas viejas sigan en la base.
  - Estudios viejos (sin receta/foto) cargan en vivo como antes.

**Recuperar un estudio viejo (sin receta):** abrilo, y en cada segmentador poné *desde* = la pesada que era la última cuando lo hiciste y *hasta* = la fecha de aquel análisis → reproducís el kilaje original a mano. **Volvé a guardarlo** y queda con receta + foto (y el vínculo con los segmentos). *(El análisis económico en sí ya se conservaba: peso inicio/cantidad por segmento se guardan siempre.)*

**Pendiente:** export combinado + agrupador de segmentos (B-FEAT-14). Todo **sin testear**.

---

## ✉ Módulo: Mail de "Detalle de pago" al proveedor ✅ (funcionando)

Manda al proveedor un mail con el **Detalle de pago** en PDF adjunto (+ **certificado de retención** si hubo SICORE). **Un mail por PAGO** (una FC o un grupo de N facturas → un solo mail). Es un template autollenado y **editable**. NO se mezcla con el aviso de transferencia del banco (ese llega aparte desde `go@bancogalicia.com.ar` con asunto "Aviso de transferencia").

### Cómo se opera (2 formas de encolar)
1. **Desde el Modal de Pagos (Egresos → ARCA/Templates):** botón **✉** al lado del 📄, por grupo o por FC. Sirve mientras la factura está en estado de pago.
2. **Desde Cash Flow (recomendado de acá en más):** seleccionás las filas → botón **✉ Encolar mail detalle**. Agrupa por proveedor. **Sirve también para proveedores YA pagados** (el Modal de Pagos no muestra las pagadas).

Ambos botones llaman la misma función (`lib/pagos/encolar-mail-detalle`) → insertan el mail en la cola `public.mails_pago` (estado `pendiente`).

### 🧮 Qué tiene que decir el PDF adjunto 🟡 (corregido 2026-08-13, sin testear)

La relación que **siempre** tiene que cerrar en el Detalle de Pago:

> **Total Factura = Monto Transferido + Retención (SICORE) + Descuento**, y eso **es** el Total Cancelado.

El descuento por pronto pago **cancela factura** aunque no salga plata por él. Hasta el 2026-08-13 el
Total Cancelado no lo sumaba: el pago de ALCORTA del 10/08 decía **$520.978,69** sobre una factura de
**$548.398,62** — justo el descuento de $27.419,93 de menos —, o sea que le informaba al proveedor un
saldo impago inexistente.

**Cómo verificarlo:** abrí el detalle de un pago **con descuento**, desde Egresos *y* desde Cash Flow
(antes eran dos códigos distintos, ahora es uno solo), y chequeá que la última columna dé igual al
**Total Factura**. Con un pago sin descuento, nada tiene que haber cambiado.

### Panel de revisión + envío (Cash Flow → "✉ Mails de detalle")
- Lista la cola por estado (pendiente / borrador / enviado / error). Podés **editar** destinatario, asunto y cuerpo, togglear los adjuntos (detalle / retención) y **borrar**.
- **Guardar** = solo persiste tus ediciones (no envía).
- **Enviar Borrador** (por fila) = guarda + dispara el GAS → crea el **borrador** en Gmail. **Enviar todos los pendientes** = lo hace para todos de una.
- El GAS crea **BORRADORES** (no envía): los revisás en Gmail y los mandás vos. El estado del panel pasa a "borrador" a los pocos segundos.

### Contenido del mail (auto)
- Cuerpo: "Adjuntamos el detalle del pago de: FC…" + desglose (Importe facturas / Retención / Descuento / **Total transferido** / **Fecha de pago**) + aviso de que llegará el comprobante de transferencia del banco.
- **Fecha de pago:** sale de la retención SICORE; si no hay, de la fecha estimada; si no hay ninguna, quedan puntos `..............` para completar a mano.
- **Adjuntos por default:** certificado = SIEMPRE que haya retención; detalle PDF = solo si hubo descuento (editable con los checkboxes del panel).
- **Los ANTICIPOS también llevan su retención** ✅ *(arreglado y testeado 2026-08-31 — [A-TEST-80](PENDIENTES.md#a-test-80))*. El certificado de un anticipo se vincula por `anticipo_id`, no por factura: hasta esa fecha **no se buscaba**, así que el mail no mencionaba la retención ni la adjuntaba, aunque estuviera bien registrada. Si pagás **facturas y un anticipo juntos** al mismo proveedor, los certificados de los dos orígenes salen en el mismo PDF. El rótulo del bruto dice *"Importe"* en un anticipo y *"Importe facturas"* sólo cuando hay facturas.
  ⚠️ **Un mail ya encolado no se corrige solo**: si venía mal, hay que **volver a encolarlo**.
- Email destino = `proveedores.email_pagos`. Si el proveedor no tiene, se encola igual "SIN email" y lo completás en el panel.

### Setup del GAS (una vez)
- Proyecto de Apps Script **separado** en la cuenta **sanmanuel.sp@gmail.com** (de ahí salen los borradores). Código: `gas-mail-detalle/EnviarMailsDetalle.gs` (con `SUPABASE_URL` + anon key configurados).
- Deploy: **Implementar → Nueva implementación → Web app** (Ejecutar como: San Manuel · Acceso: Cualquiera) → copiar la URL `.../exec`. La primera vez que tocás "Enviar Borrador" la app te la pide y la guarda.
- Si cambiás el código del GAS: **Implementar → Gestionar implementaciones → editar → Nueva versión** (la URL no cambia).

---

## 🚩 Marcar algo para revisar — desde cualquier pantalla

**Para qué sirve.** Estás haciendo otra cosa y ves algo que no cierra: una imputación rara, un monto
que no cuadra. No hace falta que lo arregles en el momento ni que te lo anotes aparte: **lo marcás y
seguís**. Después aparece todo junto en Principal.

### Dos formas de levantar una marca

**1 · Desde cualquier lado — `Alt + R` o el botón 🚩 flotante.** Está en **toda la app**, siempre.
Sirve para lo que **no es de una fila**: *"la declaración de marzo no cuadra"*, *"falta cargar algo
de este período"*. Guarda solo dónde estabas — pantalla y solapa — y podés **pegar una captura**
con `Win+Shift+S` y `Ctrl+V`.

**2 · Desde una fila**, cuando esa pantalla tiene la banderita al costado. Ahí la marca queda pegada
a **ese** registro, y la fila se ve marcada para el que entre después.

> Las dos terminan en el mismo lugar. La de fila es más precisa; la global **anda siempre**, aunque
> esa pantalla todavía no tenga banderita.

### Cómo se usa
1. En la fila que te llamó la atención, **al final de todo, en el margen derecho**, hay una
   **🚩 gris**. Tocala.
2. Se abre una ventanita que **ya sabe de qué fila hablás** — te muestra el proveedor, el número y el
   monto sin que escribas nada. Vos sólo escribís **qué viste**.
3. **Marcar**. Listo, diez segundos. La banderita de esa fila queda **ámbar**, así el que entre
   después se entera ahí mismo.

### Dónde se ven
**Principal → 🚩 Para revisar.** Están todas las abiertas, con tu comentario, de qué fila eran y
cuándo las marcaste.

### Ir siguiendo la tarea

Una marca **no nace con el diagnóstico, nace con la sospecha**. Por eso se puede abrir y agregarle lo
que vayas averiguando:

1. En **Principal → Para revisar**, tocá la marca (o el botón **Abrir**).
2. Veés el motivo original, la captura si hay, y todo lo que se fue agregando con su fecha.
3. Escribís en **Agregar** y listo.

**Se agrega, no reemplaza.** La observación original queda como estaba — a veces resulta equivocada,
y eso también sirve saberlo.

### Cómo se cierra
Tocás **Cerrar** y **escribís qué se hizo**. Es obligatorio: sin eso, *«resuelta»* termina
significando *«la miré y me pareció que estaba bien»*, que no es lo mismo que *«la corregí»*.

Si al mirarla resulta que no era un problema, está el botón **No era un problema** — que también pide
que escribas por qué. Así queda el motivo y no vuelve a aparecer la misma duda dentro de tres meses.

> 📍 **Hoy está en las facturas del subdiario.** Se va a ir poniendo en otras pantallas a medida que
> haga falta: ponerla en una grilla nueva es un trabajo de minutos.

> 👥 **Por ahora es una lista tuya.** La app todavía no sabe quién sos, así que no se le puede asignar
> a nadie. Cuando esté el módulo de usuarios vas a poder decir *"esto lo revisa Ulises"* y que le
> aparezca a él.

✅ *Probado el 2026-09-04: el banderín de fila, el warning global con `Alt+R`, la captura y el seguimiento.*

---

## 📒 Módulo: Subdiario IVA Compras (Egresos → Facturas → Subdiarios)

**Dónde:** Egresos → Facturas → botón **Subdiarios** → "Consultar período" → elegís período → sale el **resumen en 2 bloques** (+ el detalle de cada factura debajo).

**Resumen en 2 bloques** (mismo cálculo en pantalla, Excel y PDF — función compartida `calcularSubtotalesSubdiario`):
1. **📒 Libro IVA Compras** = comprobantes que **SÍ generan crédito fiscal** (Fac **A** y **M**). Filas Facturas / Notas de Crédito / Total Neto, con Neto Gravado, Exento/No Gravado, IVA, Otros Tributos, Total.
2. **📋 Comprobantes que no generan crédito fiscal (Fac C y B)** = Fac **B** (6/7/8) + Fac **C** (11/12/13). Filas Comprobantes / Notas de crédito / Total Neto (por importe total).

**Ojo (cambio ARCA):** antes el bloque 2 era solo Fac C; ahora incluye **B y C**, y esas salen del bloque 1 (no se cuentan dos veces).

**Export Excel/PDF** (botón que baja LIBRO IVA COMPRAS): traen los **mismos 2 bloques** que la pantalla + el **Detalle por Alícuotas** (IVA discriminado 0/10,5/21/27%). El detalle por factura no cambió.

### 🗂️ Archivo digital — vincular cada factura con su PDF ✅ *(reescrito 2026-09-03)*

**Dónde:** Egresos → Facturas → **Subdiarios** → *Consultar período* → elegís el período. Arriba, a la
derecha del título **📋 Facturas del Período**, están los tres botones.

**Para qué sirve.** Que cada factura del subdiario tenga **su PDF colgado**, para no buscarlo nunca
más en el mail. Los archivos viven en Drive, ordenados por empresa, campaña y mes; la app guarda el
link en la factura.

#### Los tres botones — y cuál usar

| Botón | Qué hace | Cuándo lo usás |
|---|---|---|
| **📊 Contar (no vincula)** | Cuenta nomás. Lista los archivos de la carpeta y los cruza contra los links que ya existen. **No abre ningún archivo y no vincula nada.** Es instantáneo | Para ver rápido cómo viene el mes |
| **🔗 Vincular PDFs (lee el contenido)** | **El que hace el trabajo.** Abre cada archivo, le lee adentro el CUIT, el número y el monto, y lo vincula a su factura cuando los tres coinciden | Cuando querés que se vinculen. Es el normal |
| **🔗 Vincular sólo los que faltan** | Lo mismo, pero saltea los que ya están vinculados | Para re-correr sin repetir trabajo |

> ⚠️ **El error más fácil de cometer.** «Contar» **no vincula**. Si lo corrés y ves todo *«sin
> vincular»*, no está fallando nada: nadie miró los archivos todavía. Pasó de verdad el 2026-09-03 y
> se reportó como un bug del sistema que no existía.

**Mientras corre** vas a ver un cartel *«Vinculando… (tanda N, X archivos revisados)»*. Trabaja de a
**4 archivos por vuelta** y sigue aunque cambies de pantalla. Si una tanda falla, **reintenta sola con
1 archivo** y te avisa; si tampoco anda, te muestra el motivo escrito.

#### 🔑 Cómo decide que un PDF es de una factura — leelo una vez

Esto es lo que más se malinterpreta, así que va sin vueltas:

> **La vinculación automática NO mira el nombre del archivo. Mira lo que dice adentro.**

Para vincular exige **las tres cosas, todas**:

| | Qué busca dentro del archivo |
|---|---|
| **1 · CUIT** | los dígitos del CUIT del emisor |
| **2 · Número** | el número de comprobante (acepta 5 formatos: `00002-00002021`, `2-2021`, etc.) |
| **3 · Monto** | el importe total, con tolerancia de **$1** (en valor absoluto, porque las NC vienen en negativo) |

Si falla **una sola**, no vincula y el archivo queda como huérfano. Es estricto a propósito: un
vínculo equivocado es peor que uno que falta. El chequeo del monto se agregó justamente porque sin él
un archivo de nota de crédito se enganchaba a una factura por compartir el CUIT.

**Sí funciona con fotos.** El archivo se transcribe con reconocimiento de texto antes de compararlo,
así que una foto de una factura se lee igual que un PDF. *(Verificado el 2026-09-03 en MSA 07/2026:
vinculó **20 de 20**, incluidas dos fotos `.jpeg`.)*

**El nombre del archivo sirve para otra cosa:** para la sugerencia ⭐ del panel de abajo, que es para
vincular **a mano**. Nunca para vincular solo.

#### El panel «🖼️ PDFs sin vincular» — acá vinculás a mano

Aparece cuando quedan archivos sin asociar. Cada fila trae el archivo, una **⭐ sugerencia** (por
nombre y fecha) y el botón **Vincular**. También podés ✏️ renombrar el archivo si está mal nombrado.

**👁 Ver — mirá el archivo sin salir de la pantalla.** Al lado de cada nombre hay un botón **👁 ver**
que abre el archivo ahí mismo, debajo de la fila. Sirve igual para un PDF que para una foto. Al lado
te recuerda qué comparar: **CUIT, número y monto** contra la factura que elegiste en el desplegable —
que son los tres datos que la vinculación automática exige.

**La ⭐ propone entre TODAS las facturas sin PDF del período**, incluidas las marcadas `fc=No` y las
de `Portal`. El criterio es el nombre y la fecha del archivo, así que **confirmalo mirando**: es una
pista, no una certeza.

⚠️ **Fijate de dónde salió la lista**, porque el mismo panel significa dos cosas opuestas:
- si venís de **«Contar»** → esos archivos **todavía no se intentaron vincular** (te lo avisa en ámbar);
- si venís de **«Vincular PDFs»** → se leyeron y **no matchearon**: falló el CUIT, el número o el monto.

#### Cuando una factura no tiene PDF

Eso **no** se arregla con estos botones: no hay archivo en la carpeta para vincular. Mirá la columna
**FC** de la factura, que dice de dónde tiene que salir:

| FC dice | Qué significa | Qué hacés |
|---|---|---|
| **Portal** | La factura se baja del sitio del proveedor. Nunca llega por mail | Entrás al portal y la bajás a mano |
| **Sí** | Debería llegar por mail | Corrés el **buscador de PDFs** (otro circuito), o la pedís |
| **No** | Se decidió que ésta no se busca | Revisás si esa decisión sigue valiendo |

*Ejemplo real, MSA 07/2026: de 37 facturas quedaron 20 vinculadas y 17 sin PDF — pero de esas 17,
**7 eran de Portal** (Autopistas, Corredores Viales, DIRECTV) y **2 estaban marcadas para no
buscar**. O sea que las que realmente faltaban por mail eran **8**, no 17.*

#### El mail de supervisión

**Lo manda «Vincular PDFs» al terminar. «Contar» no manda nada** — es un vistazo en pantalla, y un
mail por cada conteo sería ruido. Si contaste y no te llegó mail, está bien.

Trae tres cosas: **✅ vinculadas** (con proveedor, número, monto y link), **⚠️ sin PDF agrupadas por
motivo** — así ves cuáles son trabajo de verdad — y **❓ huérfanos con su candidata ⭐**.

#### 📧 Enviar estado actualizado

**El mail automático queda viejo apenas vinculás algo a mano.** Por eso hay un cuarto botón:
**📧 Enviar estado actualizado**. Vuelve a leer la carpeta y manda el reporte con el estado de
**ahora**, incluido lo que vinculaste vos.

Tocalo **cuando terminaste** de acomodar el mes. Puede ser al toque, mañana, o después de cerrar y
volver a abrir la pantalla: no depende de que la app adivine cuándo terminaste.

*(Por eso son dos mails y no uno: el automático es la constancia de que la corrida se hizo — sale
siempre, aunque después no toques nada — y éste es la foto final.)*

---

### 📋 Pendientes de desarrollo — verlos desde la app 🟡 (2026-08-19, sin testear)

**Dónde:** **Principal → botón "Pendientes"**. Sólo admin. Es **lectura**: para cambiar un pendiente
hay que editar `PENDIENTES.md`.

**Qué muestra**, de arriba hacia abajo:

| | |
|---|---|
| 🔴 **Urgente** | prioridad Alta o bugs |
| 🟠 **Secundario** | Media / Baja |
| 🧪 **Sin testear** | hecho pero falta probarlo |
| 🔍 **A auditar juntos** | Sección C del archivo — plegado |
| 🗄️ **Probablemente obsoleto** | Sección D — plegado |
| ✅ Hechos · filas ignoradas | detrás de un toggle |

Arriba hay un **buscador** (por ID, texto o sección) y **chips para filtrar por pantalla**. Cada
ítem enlaza a su dossier en GitHub.

**El número en cada solapa.** Arriba de todo, al lado del nombre de cada pestaña, hay un contador
con sus pendientes vivos. **Gris** = ninguno urgente · **ámbar** = 1 a 4 · **rojo** = 5 o más. Pasás
el mouse y te dice cuántos son urgentes.

#### Cómo se etiqueta un pendiente

Cada fila del índice puede cerrar con una marca que dice en qué pantalla se muestra:

```markdown
| A-BUG-30 | 🔴 | Bug | El motor no matchea X … | → [A-BUG-30](#a-bug-30) `@extracto` |
```

**No se tipea a mano** — hay comando:

```bash
npx tsx scripts/marcar-pendiente.mts A-BUG-30 extracto cashflow   # admite varias
npx tsx scripts/marcar-pendiente.mts A-BUG-30 --quitar            # lo vuelve a "sin ubicar"
npx tsx scripts/marcar-pendiente.mts --sin-ubicar                 # la cola de trabajo
npx tsx scripts/marcar-pendiente.mts --pantallas                  # las 12 válidas + @general
```

- **`@general`** = revisado, no pertenece a ninguna pantalla (ej. *"MCP quedó en WRITE"*). Se ve en
  todas, pero **no cuenta como pendiente de etiquetar**.
- **Sin marca** = todavía no se revisó. También se ve en todas, y **sí** está en la cola.
- ⚠️ **Conciliación no es una pantalla**: un bug del motor va `@extracto`.

#### 💬 Dejarle un comentario a Claude sobre un pendiente 🟡 (2026-08-19, sin testear)

En cada pendiente hay un ícono 💬. Lo apretás, escribís, y opcionalmente le ponés **tu estado**:

| | |
|---|---|
| ✅ **Yo lo doy por terminado** | vos creés que ya está, aunque Claude lo tenga en 🔴 |
| 👀 **Lo chequeé** | lo miraste |
| 🔍 **Hay que revisarlo** | algo no cierra |
| 🗑️ **Se puede descartar** | ya no aplica |

Los comentarios se ven **en verde debajo del pendiente**, para distinguirlos de un vistazo del texto
del ítem — que es de Claude y viene del `.md`. Los no leídos dicen **"sin leer"**.

> **Tu estado NO pisa el de Claude.** Él dice 🔴 en el `.md`; vos decís *"para mí está terminado"*
> desde la app. Los dos quedan visibles y la diferencia se ve. El `.md` es de Claude, la base es
> tuya, y el ID los une — **la app no puede escribir el `.md`** (Vercel es de sólo lectura).

**Al abrir sesión, Claude lee los que estén sin leer** y te los menciona, igual que hace con las
notas (P-34).

**Cómo probarlo:**
1. Abrí el panel, elegí cualquier pendiente y apretá 💬.
2. Escribí algo y elegí *"Lo chequeé"* → Guardar.
3. Tiene que aparecer **en verde debajo del ítem**, con la fecha y la marca **"sin leer"**.
4. Cerrá y volvé a abrir el panel: el comentario tiene que seguir ahí (está en la base, no en memoria).
5. El ícono 💬 del pendiente ahora muestra **el número de comentarios**, en verde.

#### ➕ Proponer un pendiente desde la app 🟡 (2026-08-19, sin testear)

Botón **"Proponer"** arriba del panel. Ponés qué hay que hacer, opcionalmente el detalle, la
prioridad y la pantalla — la pantalla se elige de la lista, no se escribe.

**Queda como propuesta, no como pendiente.** Aparece arriba de todo en un bloque azul
*"✍️ Propuestos por vos"* hasta que Claude lo incorpore a `PENDIENTES.md` con su **ID, sección y
dossier**. La app **no puede escribir ese archivo** (Vercel es de sólo lectura), y aunque pudiera no
debería: un pendiente necesita más que un título.

Es la misma lógica que las notas: **bandeja de entrada, no fuente**. Cuando Claude lo incorpora,
queda registrado en qué ID se convirtió.

**Cómo probarlo:**
1. Panel → **Proponer** → título, prioridad *Secundario*, pantalla *@cashflow* → Proponer.
2. Tiene que aparecer arriba en el bloque azul, con la fecha.
3. Cerrá y reabrí: sigue ahí (está en la base).

#### 🚨 Comentarios sin pendiente

Si un comentario apunta a un ID que **ya no está** en `PENDIENTES.md` —porque el pendiente se borró
del archivo—, sale un bloque rojo *"Comentarios sin pendiente"* con el texto completo.

**No es un error a corregir: es para que no se pierda lo que escribiste.** Borrar pendientes viejos
está bien; lo que no está bien es que se lleven puesto un comentario tuyo sin avisar.

#### 🧮 El control — se corre, no se confía

```bash
npx tsx scripts/verificar-parser-pendientes.mts
```

**Sale con error** si hay IDs duplicados, filas del índice que no se pueden leer, marcas mal
escritas, o algún pendiente que no llegue a ninguna pantalla. Correlo **después de agregar
pendientes**, sobre todo si hay dos terminales trabajando.

**Cómo probarlo:**
1. Principal → Pendientes: tiene que abrir con **260 pendientes** y las 6 categorías.
2. Filtrá por **@extracto**: el número del chip tiene que coincidir con lo que ves abajo. Si no, sale una alerta roja avisándolo (es un control, no un adorno).
3. Al filtrar aparece un bloque **📥 Sin ubicar** al pie: hoy tiene que estar **vacío o no aparecer** (la cola está en cero).
4. Buscá `A-BUG-27`: tiene que salir con su chip `@cashflow` y el link al dossier.
5. Mirá las solapas de arriba: **Extracto** en rojo (18 urgentes), el resto ámbar o gris.
6. Escribí a mano una marca inválida (`@conciliacion`) en cualquier fila y recargá: el panel tiene que avisarlo en rojo y el ítem caer a "sin ubicar". Después sacala.

### 💵 Cobrar una factura de venta (1 o varias transferencias) ✅ (2026-08-18, el 1er cobro testeado OK)

**Sirve para registrar el cobro sin tener que conciliar todo el banco.** Es el espejo de los
anticipos de compras.

**Dónde:** Cash Flow → **Anticipos** → *Nuevo* → elegí **Cobro** (no Pago) → cliente, monto, fecha.

Al guardar, si hay facturas de venta pendientes de ese CUIT, te ofrece vincularlo ahí mismo. Si no,
lo vinculás después desde **Anticipos existentes** o desde la alerta de la pantalla de inicio.

**Con dos transferencias**: cargás **un anticipo de cobro por cada una** y los vinculás a la misma
factura. El saldo se recalcula solo:

> **saldo = Total de la factura − retenciones ya cargadas − cobros ya vinculados**

El primero deja la factura en saldo parcial; el segundo la cierra y pasa a **cobrada**.

> ⚠️ Las **retenciones** van por otro lado y **antes**: Ingresos → Comprobantes → ícono **%**.
> Ya descuentan del saldo, así que no las cargues como cobro o vas a contar dos veces.

**El cartel del wizard tiene que cerrar solo.** Antes de confirmar, la cuenta se lee de arriba abajo:

```
Total factura                    $78.262.800
Retenciones y cobros previos   − $6.651.666     ← retenciones ya cargadas + cobros anteriores
Cobro aplicado                 − $31.305.120
Saldo pendiente                  $40.306.014
```

Si esa resta no cierra, **cancelá**: hay algo que el cartel no te está mostrando.

**Cómo se probó (caso Sanpa) — ✅ el 1er cobro anduvo OK:**
1. Ingresos → MSA → Comprobantes: la factura **00010-00000021** es de **$78.262.800**.
2. Ya tenía 2 retenciones cargadas (Ganancias $4.695.096 + IIBB $1.956.570 = **$6.651.666**).
3. Cash Flow → Anticipos existentes: el cobro de **$31.305.120** → **Vincular**.
4. Quedó **saldo $40.306.014** y el anticipo en **parcial**. ✅
5. En el Cash Flow, la fila de la factura bajó de $71.611.134 a **$40.306.014** — deja de contarse dos veces.

**🟡 Falta probar:** el **segundo cobro** por $40.306.014, que tiene que dejar la factura en
**cobrada** con saldo 0; y el **caso A** (un cobro que cubre el total de una sola vez).

### 🧭 Ingresos — navegación 🟡 (2026-08-18, sin testear)

**Ahora son 2 niveles: primero la EMPRESA, después la vista.** Antes eran 8 solapas planas con la
empresa en el nombre ("Ventas MSA", "Subdiarios MA"…).

```
Ingresos  →  [ MSA | PAM | MA ]
                 └── Arrendamientos · Ventas · Comprobantes · Cobros · Subdiarios · Ganadería
```

**No todas las empresas muestran las 6** — y no es un olvido:

| Vista | MSA | PAM | MA |
|---|:-:|:-:|:-:|
| Arrendamientos · Comprobantes · Subdiarios | ✅ | ✅ | ✅ |
| Ventas (granos) · Ganadería · Cobros | ✅ | — | — |

- **Ventas** y **Ganadería**: sólo MSA, por definición del negocio.
- **Cobros**: sólo MSA porque el extracto de PAM y MA **no tiene la columna** que vincula un crédito
  con una factura. Mostrarla diría "cobrado $0" siempre (ver `PENDIENTES.md` § A-FEAT-24).

**Qué es cada una:**
- **Comprobantes** = la *lista* de facturas de venta (el equivalente a Facturas en Egresos). Acá está el botón **Importar**.
- **Subdiarios** = la *DDJJ por mes contable*: cuánta venta hubo en cada período. Acá no se importa nada.

**En PAM y MA, Comprobantes tiene menos botones**: no están *Nueva liquidación*, *Editar* ni
*Retenciones*, porque esos formularios son del circuito de granos de MSA. Para cargar un comprobante
a mano en esas empresas, usá **Nuevo comprobante** desde su **Subdiario**.

**Cómo probarlo:**
1. Entrá a Ingresos: arriba las 3 empresas, debajo las vistas. Arranca en **MSA / Arrendamientos**.
2. En **MSA** tienen que estar las **6** vistas y todo funcionar igual que antes (nada cambió).
3. Pasá a **PAM**: quedan **3** vistas. Arrendamientos tiene que mostrar **sólo contratos de PAM** (hoy los 4 son de MSA → debería salir vacío).
4. Si estabas parado en *Cobros* (MSA) y cambiás a PAM, te tiene que llevar a *Arrendamientos*, no dejarte en una solapa que no existe.
5. **MA → Comprobantes**: la lista tiene que salir vacía (0 comprobantes) y **no** mostrar los de MSA. ⚠️ Este es el punto clave: si aparecen los de MSA, hay un schema mal derivado.
6. En **MA/PAM → Comprobantes** tiene que estar **Importar** y **no** estar *Nueva liquidación*.

### 🔗 Alerta "Facturas de venta sin vincular" (pantalla de inicio) 🟡 (mejorada 2026-08-18, sin testear)

**Qué es:** llegó una factura de venta y hay una venta esperando factura del mismo cliente. La app
pregunta *"¿esta factura es de esta venta?"*. Si decís **sí**, el Cash Flow deja de mostrar la venta
y muestra la factura. Si decís **no**, quedan como dos ingresos y la venta sigue esperando.

**El match es por CUIT** — pero **un CUIT mal tipeado hacía desaparecer la factura correcta sin
decir nada**. Pasó con Sanpa: el contrato tenía `30712200662` y la factura de ARCA `30712200622`
(un dígito), así que la alerta ofrecía una factura vieja y la correcta no aparecía nunca.

**Ahora hay un segundo camino:** si el CUIT no coincide **pero el importe cierra exacto** con lo que
falta facturar, la factura se ofrece igual — **en ámbar, primera de la lista**, mostrando los dos
CUIT enfrentados y marcando cuál tiene el **dígito verificador inválido** (un CUIT inválido es
siempre un error de carga).

> ⚠️ **Vincular NO corrige el CUIT.** Si aceptás el vínculo pero no arreglás el CUIT en el contrato
> (Ingresos → Arrendamiento) o en el comprobante, el problema vuelve con la próxima factura.

**Cómo probarlo:**
1. Entrá a la pantalla de inicio: tienen que aparecer **las dos** facturas de Sanpa.
2. La de **julio** ($78.262.800) tiene que salir **en ámbar y primera**, avisando que `30712200662` es inválido y que el válido es `30712200622`.
3. La de **mayo** ($95.715.830,32) sale en blanco, como match normal por CUIT.
4. Corregí el CUIT del contrato de Rojas y recargá → la de julio tiene que pasar a match normal (sin ámbar).

### 📤 Importar comprobantes de venta 🟡 (2026-08-13, sin testear)

**Dónde:** Ingresos → **Subdiarios** de la empresa (MSA / MA) → botón **Importar**.
Cada subdiario importa **a su propia empresa**: el modal lo dice en el título ("Importar facturas de
venta — MA") y es también el CUIT con el que entra a ARCA.

> Antes esto sólo existía en la solapa *Comprobantes MSA* y escribía siempre en MSA, aunque
> estuvieras mirando MA.

**Dos formas de traer los comprobantes:**
1. **Directo de ARCA** — clave fiscal + rango de fechas → "Bajar de ARCA" (Mis Comprobantes Emitidos).
2. **Archivo** — Excel/CSV de ARCA o del mismo formato.

Después: *Fecha de cobro estimada* (la usa el Cash Flow) → **Previsualizar** (dice cuántas son nuevas
y cuántas duplicadas, sin insertar nada) → **Importar**.

**Cómo probarlo:**
1. Subdiarios **MA** → Importar → el título tiene que decir **MA**.
2. **Previsualizar** primero: no debe insertar nada, sólo contar.
3. Importar y confirmar que los comprobantes aparecen en el subdiario **de MA**, no en el de MSA.
4. Reimportar el mismo archivo → todas tienen que salir como **duplicadas**, 0 insertadas.
5. En MSA, además, tiene que seguir informando *retenciones vinculadas* (en MA/PAM ese paso no corre porque `retenciones_recibidas` sólo existe en MSA).

**Desde 2026-08-13 las tres empresas tienen subdiario de ventas**: Subdiarios **MSA**, **PAM** y
**MA**, cada uno con su tabla propia y el mismo comportamiento. PAM y MA arrancan vacíos.

> ⚠️ **PAM y MA facturan arrendamiento (Factura C, sólo el total).** Con comprobantes C, el bloque
> "📒 Libro IVA Ventas" del resumen sale en **$0** y todo aparece en "no generan débito fiscal" —
> está pendiente de definir si así corresponde (ver `PENDIENTES.md` § A-DEC-02).

### 📥 Export del Libro IVA (Compras y Ventas) 🟡 (2026-08-13, sin testear)

**Desde 2026-08-13 las dos pantallas funcionan igual.** En Ventas antes había dos botones separados
(`Excel` y `PDF`) que bajaban siempre a Descargas pisando el archivo anterior.

**Dónde:**
- Compras → Egresos → Facturas → **Subdiarios** → Consultar período → **"📊 Generar PDF + Excel (N)"**
- Ventas → Ingresos → **Subdiarios IVA Ventas** → Consultar período → **"📊 Generar PDF + Excel (N)"**

**Qué pasa al apretarlo:**
1. Re-consulta el período a la base (no usa lo que quedó pintado en pantalla).
2. Pregunta dónde guardar, con 3 opciones:
   - **1** = elegir otra carpeta (y queda como la nueva por defecto)
   - **2** = usar la carpeta por defecto actual
   - **3** = cancelar — *no genera nada*
3. Genera **los dos archivos**: `LIBRO IVA COMPRAS 26-07.xlsx` y `.pdf` (año corto-mes).
4. **Nunca sobrescribe**: si ya existe, agrega ` (1)`, ` (2)`.
5. Avisa cuántos comprobantes salieron y en qué carpeta quedaron.

> **Ojo con la carpeta después de recargar la página.** El navegador no puede guardar el permiso de
> escritura, sólo el nombre. Si recargaste, la opción **2** te va a volver a abrir el selector una vez.
> No es un error.
>
> En **Firefox y Safari** no existe el selector de carpetas: no pregunta nada y baja a Descargas.

**El PDF, en las dos:** página 1 con el detalle comprobante por comprobante y fila **TOTALES
GENERALES**; página 2 con el **Desglose por Alícuotas** y los **2 bloques** del resumen.

**Diferencias que quedan entre Compras y Ventas** (son de la base, no del reporte): Ventas **no
tiene** columna *Otros Tributos*, no convierte USD→$ y arma el desglose agrupando por la alícuota de
cada comprobante. Tampoco tiene el par *IVA 21 % / IVA Diferencial*, que en ventas no sirve porque se
vende mayormente exento y al 10,5 %.

**Cómo probarlo:**
1. **Compras, período 07/2026** → el botón dice "(37 facturas)". Apretá, elegí opción **3** → tiene que decir *"Descarga cancelada"* y **no** bajar ningún archivo.
2. Repetí con opción **1**, elegí una carpeta → tienen que aparecer **los dos archivos** ahí.
3. Volvé a apretar y elegí opción **2** → los archivos nuevos tienen que llamarse `… (1).xlsx` y `… (1).pdf`, **sin pisar** los anteriores.
4. Abrí el PDF: encabezado con razón social, CUIT y *"desde el 01/07/2026 hasta el 31/07/2026"*; página 2 con alícuotas y los 2 bloques. Los 2 bloques tienen que dar **igual que la pantalla**.
5. **Ventas, período 07/2026** (2 comprobantes) → mismo flujo, un solo botón. El PDF **no** debe tener columna *Otros Tributos*.
6. ⚠️ **Si mirás PAM o MA**: el encabezado tiene que decir *su* razón social, no "MARTINEZ SOBRADO AGRO SRL" (era un bug). En **MA el CUIT sale vacío** porque no lo tenemos cargado — si lo pasás, se completa.

### ✅ Control de cuadratura 🟡 (2026-08-13, sin testear)

Debajo de los 2 bloques, tanto en **Compras** como en **Ventas**, sale una barra que verifica:

> **Total general − Neto Gravado − Exento/No Gravado − IVA − Otros Tributos − (bloque sin crédito fiscal) = 0**

- **Verde** = cuadra. Si el residuo son centavos, lo dice: *"es redondeo del emisor, dentro de la tolerancia"*.
- **Rojo** = la diferencia supera la tolerancia (**$0,05 × cantidad de comprobantes**) → el período **no cierra**.
- Si hay comprobantes que no cierran uno por uno, aparece **"Ver los N comprobantes que no cierran"**: los lista con Imp. Total, suma de las partes y la diferencia. **Ese listado es lo que sirve para arreglarlo** — el número global sólo avisa.

**Por qué hay tolerancia:** los emisores redondean. En MSA 07/2026 el residuo fue de **$0,01** repartido en 4 facturas (La Mercure −0,02; Telecom, Miceli y Deheza +0,01 c/u) que vienen así desde ARCA. Exigir cero exacto daría rojo todos los meses y el control se volvería ruido.

**Cómo probarlo:**
1. Egresos → Facturas → Subdiarios → período **07/2026** → tiene que dar **verde**, diferencia **$0,01**, y el detalle debe listar esas 4 facturas.
2. Abrí el detalle y verificá que para cada una `Imp. Total ≠ suma de partes` por 1 o 2 centavos.
3. Ingresos → Subdiarios IVA Ventas → **07/2026** → verde, **$0,00** (2 comprobantes, ambos exentos). Ahí la barra **no** muestra el término *Otros Tributos*, porque Ventas no tiene esa columna.
4. Para ver el rojo: elegí un período donde falte cargar un importe, o cambiale a mano el Imp. Total a una factura (⚠️ si tocás un dato, dejalo como estaba).

## 👷 Módulo: Sueldos 🟡 (lock de mes sin testear)

**Dónde:** tab Sueldos. Navegás por mes con las flechas ◀ ▶.

### Lock "mes de trabajo" (2026-07-18, sin testear)
El sistema tiene **un único mes editable a la vez** = el **"mes de trabajo"** (persiste en `sueldos.config`, una fila). Sirve para no equivocarte de mes al cargar datos.
- Al entrar, la vista se posiciona en el **mes de trabajo** (badge verde 🔒 "Mes de trabajo · editable").
- Podés **navegar** a cualquier otro mes (◀ ▶) pero sale en **"Solo lectura"**: los botones de editar/registrar (lápiz, Registrar Anticipo, editar/eliminar pago) quedan deshabilitados.
- Para editar otro mes: navegás a ese mes y apretás **"Trabajar en este mes"** → el lock se mueve ahí. Ej.: hoy el lock está en junio (saldos); para cargar el **adelanto de julio** movés el lock a julio.
- **Rango de navegación = unión de todas las campañas** (no solo la activa) → podés ir de junio 25/26 a julio 26/27 sin cambiar de campaña.

### Crear campaña nueva (generación de períodos)
**Dónde:** botón "Gestionar Campañas" → Nueva campaña (etiqueta ej. `26/27`) → "Crear campaña y generar períodos".
- La campaña nueva **queda activa** (la anterior pasa a inactiva; se sigue viendo/editando por el rango unificado). Ya **no** pregunta si activar.
- Genera períodos (julio→junio) **solo para los empleados vigentes**: los que tienen **fecha hasta (egreso)** anterior al inicio de la campaña **NO se generan** (baja = fecha_egreso; los períodos viejos perduran).
- Propaga el **sueldo FIJO** del último período de cada uno. Los **datos móviles** (francos, días, horas) quedan **en blanco** → se cargan reales mes a mes.
- **Revisión de nómina (al confirmar):** se abre una **tabla con todos los empleados** de la campaña (Empleado · Tipo · Bruto base). Click en el **lápiz** de una fila → abre el **mismo modal de edición** mensual, ya con el fijo propagado; editás lo que quieras y **cuando pregunta "¿propagar a los meses siguientes?" decís que SÍ** → el cambio se aplica a toda la campaña. Lo móvil sigue en blanco. No hay % masivo: se edita **uno por uno** según haga falta.

### Alta de empleado
- Los períodos del nuevo empleado se generan **según su fecha de alta (ingreso)**, en las campañas que correspondan desde su ingreso en adelante — **no** según la campaña activa.

## 🧾 Módulo: Templates (Egresos) — Renovar campaña 🟡 (v1 sin testear)

**Dónde:** Egresos → Templates → botón **"Renovar campaña"**.

**Qué hace:** genera las cuotas del **próximo período** de los templates (Modelo A: crea una **fila nueva** del template con el año nuevo + sus cuotas; la vieja queda como historial). Sirve para **bianual** (campaña jul–jun, ej. 25/26 → 26/27) y **anual** (calendario, ej. 2026 → 2027): elegís periodicidad + período a generar.

**Secciones:**
- *Previstas a generar* (`aplica_generacion=true`) — se generan; podés **destildar** alguna por fila para excluirla de esta corrida (temporal, no cambia el flag). Al **Generar**, si dejaste previstas afuera, **te avisa** y confirmás.
- *No aplican* (colapsable) — tildás para **incluir alguno suelto** → persiste `aplica_generacion=true`.

**Matriz de meses** (filas = templates, columnas = meses del período nuevo, **mín. 12** + extras por spillover). Cada celda:
- **Monto** (editable; casi todos estimados) + un mini-campo **"día"** (día del mes de la cuota; editar el día no cambia de columna). **Vacío = sin cuota** ese mes.
- **Varias cuotas en un mes:** se muestran **sumadas** con anillo naranja + badge **"Σn"** + tooltip con la composición (genera 1 cuota con la suma).
- **Meses antes del inicio del período** salen en **ámbar (⚠) + banner de aviso** (suele ser dato viejo mal cargado, ej. UATRE) — **no se bloquea**, podés vaciar/ignorar.

**Herramientas por fila** (íconos a la izquierda del nombre):
- 📋 **Replicar** el primer monto a los 12 meses base · 🧹 **Vaciar** toda la fila.
- 📃 **Detalle** → modal para editar las **cuotas individuales** (mes/día/monto), permite **varias por mes**, agregar/quitar. Si la fila tiene detalle, **ese detalle GANA** sobre la matriz (badge "detalle").
- ☑ **"venc"** → las fechas de esa fila se generan como **vencimiento** (`fecha_vencimiento`); sin tildar, solo `fecha_estimada`.

**Pre-carga:** corre el último período conocido de cada template al nuevo (por eso Acciones 24/25 cae en 2028 por el shift +2). La **descripción** de cada cuota se rearma con el mes/año nuevo (para que concilie bien en el extracto).

**Los campos que lo alimentan** (`egresos_sin_factura`): **`periodicidad`** (anual/bianual) y **`aplica_generacion`** — se cargan en el **wizard** al crear el template (paso 1). Los **abiertos** (comisiones, Caja…) **no se renuevan**: persisten entre años solos (el selector de Pago Manual los busca por `tipo_template`+`activo`, no por `año`).

##### 🏷️ El campo **Tipo** — al crear un template *(nuevo 2026-07-31, sin testear)*

En el **paso 1 del wizard**, al lado de Categoría y Cuenta Agrupadora, hay un campo **Tipo**
obligatorio. Es lo que decide **si el Presupuesto lo proyecta** y **en qué sección del Dashboard
suma**:

| Elegir | Cuándo | Qué pasa |
|---|---|---|
| **Egreso** | gasto de verdad (el 85 % de los casos) | se presupuesta como gasto |
| **Distribución** | retiros de socios | **se presupuesta** (la plata sale de la caja) pero **no** cuenta como gasto operativo |
| **Financiero** | colocaciones (FCI), transferencias entre cuentas propias, pago de tarjeta, créditos | **NO se presupuesta**: la plata cambia de lugar pero no sale de la empresa |
| **Ingreso** | entra plata | no se proyecta como egreso |
| **No computar** | | se ignora |

Al elegir una categoría que ya está en el plan de cuentas, **el tipo se sugiere solo** y abajo
avisa de dónde salió. Se puede cambiar siempre: **manda lo que quede en el template**.

⚠️ **La regla práctica**: si dudás entre *Egreso* y *Financiero*, preguntate **si esa plata deja
de ser de la empresa**. Si sigue siendo tuya (un plazo fijo, pasarla de Galicia a Santander), es
**Financiero**. Presupuestar una colocación como gasto infla el egreso con plata que no se fue —
el FCI llegó a meter ~$135 M fantasma.

⚠️ Las otras dos formas de crear un template (**"crear template faltante"** desde un movimiento
del extracto, y el **generador de Renovar Campaña**) todavía **no piden el Tipo** — lo dejan
vacío y el sistema lo deduce. Si creás uno por ahí y no es un gasto común, conviene revisarlo
después en el panel de **métodos de templates** del Presupuesto, que muestra el tipo de cada uno
(pendiente **C-26**).

**⚠️ Estado: v1 SIN TESTEAR end-to-end.** Falta probar en bianual (crear 26/27 real + revisar cuotas/fechas/descripciones/detalle/vencimiento). Pendiente contable: si Acciones necesita la cuota 25/26 intermedia (cae en 2028 saltando 2027).

---

## 🌾 Módulo: Arrendamientos agrícolas (Ingresos → Ventas) 🟡 (nuevo, sin testear)

> **La regla que ordena todo**: *"Venta origina Factura/Liquidación que origina Cobro"*.
> El presupuesto de ingresos **no se carga en Presupuesto**: se carga en **Ventas**, y
> Presupuesto lo lee. **Fijar = vender.**
> Arquitectura y fórmulas → `MODULO_PRESUPUESTO.md` § INGRESOS — Arrendamientos agrícolas.

### Dónde está cada cosa

| Necesito… | Voy a… |
|---|---|
| Cargar/editar un contrato, ver cuotas, **fijar** | **Ingresos → Arrendamiento** |
| Cargar precios de soja y TC | **Presupuesto → botón "Precios y TC"** |
| Ver la proyección mes a mes, mover o valorizar cuotas | **Presupuesto** (filas por campo) |
| Ver el ingreso comprometido a corto plazo | **Cash Flow** |
| Vincular la factura que llegó con la venta | **Vista Principal** (alerta) |

### 1. El contrato

`Has × qq/ha ÷ 10 = toneladas`. Ej.: Rojas = 242 ha × 24 qq/ha = 580,80 tn.
Se reparte en **cuotas**, cada una con **fecha de cobro** y **posición de fijación**
(que son **independientes**: podés cobrar el 20/04 con posición mayo).

La suma de qq de las cuotas debería dar el arrendamiento total. Si no da, la app **avisa
pero no bloquea**.

**`Días de cobro del disponible`**: días corridos entre la fijación y el cobro cuando vendés
disponible. **Es por cliente**: Sanpa 15, el resto 20.

### 2. Fijar = vender

Botón **Fijar** en cada cuota que tenga disponible. Se elige:

- **Fecha de fijación** = la **fecha de la venta**. No es necesariamente hoy, y es **desde
  donde se cuentan los días de cobro**.
- **Toneladas**: todo o parte.
- **Modo**:
  - **Matba** → precio USD/ton × TC. La fecha de cobro es la de la cuota.
  - **Pizarra disponible** → precio en **pesos**, sin TC. El cobro se calcula solo:
    fijación + los días del cliente.

**El precio y el TC son dos momentos distintos.** Podés fijar el precio y dejar el TC para
después: la venta queda registrada, el monto en USD ya es cierto y el de pesos queda
**estimado** (marcado con `*`) hasta que uses **Fijar TC**.

**Fijación parcial**: si fijás menos toneladas que las disponibles, la app **parte la cuota**.
La original queda con lo vendido y el saldo pasa a una **cuota nueva** marcada `(saldo)`, que
después movés y valorizás por su cuenta. Una cuota se fija entera o se parte.

### 3. Mover y valorizar (simulación financiera)

En **Presupuesto**, las celdas de *Presupuestado* y *Disponible a fijar* son **clickeables**.
Sirve para probar *"¿qué pasa si la cobro ahora o la guardo hasta enero?"*.

- **Presupuestada** → sólo se mueve **hacia adelante**.
- **Disponible** → cualquier dirección, con piso **hoy + los días del cliente**.
- **Fijada** → **no se mueve**: ya es una venta.
- Al mover, **la posición pasa a ser el mes destino** (Rosario no tiene futuros).
- **El precio cambia de unidad según la fecha**: si el cobro cae en el **mes actual** se carga
  en **pesos** (pizarra, sin TC); de ahí en adelante en **USD** (Matba). Si el cambio de fecha
  cambia la unidad, **el campo se limpia solo** para que no guardes dólares como pesos.
- **"Volver a default"** restaura fecha, posición y borra el precio manual.

### 4. Precios y TC

Botón **"Precios y TC"** arriba en Presupuesto. Precio USD/ton por posición y TC
presupuestado/real, mes a mes. Se guarda al salir del campo.

**Si falta un mes**, la app toma el **siguiente cargado** (o el anterior, para el TC) y marca
la celda con `*` para que sepas que es arrastrado, no cargado.

### 5. Las tres filas del Presupuesto, por campo

| Fila | Qué es |
|---|---|
| **Fijado** | ya vendido. Si falta el TC, el peso es estimado (`*`) |
| **Presupuestado** | tons sin vender × Matba de la posición × TC |
| **Disponible a fijar** | tons cuya fecha de cobro pasó sin fijar. Se muestran en el mes actual hasta que les des fecha nueva |

### 6. Cuando llega la factura

En **Vista Principal** aparece la alerta: *"Llegó la factura X de Sanpa por $Y. ¿Es de la venta
de Rojas?"* — el match es **por CUIT** (las ventas son pocas).

- **Sí** → Cash Flow deja de mostrar la venta y **muestra la factura**.
- **No** → la factura es de otra cosa: quedan **dos ingresos** y la venta **sigue esperando**
  la suya.

En los dos casos la decisión queda guardada y **no vuelve a preguntar** por ese par.

**Factura parcial**: el monto asignado es editable. Si cubre menos que la venta, Cash Flow
sigue mostrando el **remanente** hasta que termines de facturar.

> ⚠️ **Si el contrato no tiene CUIT cargado, no hay match posible** y la alerta te lo avisa.
> Cargalo en Ingresos → Arrendamiento → Editar contrato.

### 7. Impuestos

- **Exento de IVA**.
- **Ganancias 6%**: se descuenta del cobro (menor ingreso), sobre el neto.
- **IIBB**: son **dos cosas distintas**.
  - La **retención que te practican al cobrar** no se presupuesta: se carga cuando ocurre y
    **descuenta el pago del mes siguiente**.
  - El **pago mensual al fisco** es 5% del neto, menos esas retenciones, y vence el mes
    siguiente al cobro. *(Todavía no se vuelca solo al template IIBB Mensual — pendiente.)*

---

## 🐄 Módulo: Ganadería — venta de destete (Ingresos → Ganadería) 🟡 (nuevo, sin testear)

> Mismo criterio que arrendamiento: **la venta vive en Ventas y Presupuesto la lee**.
> Modelo tomado de la solapa "Ganadería" de `- Desarrollo Presuesto..xlsx`.

### Dónde está cada cosa
| Necesito… | Voy a… |
|---|---|
| Cargar/editar la proyección de una campaña | **Ingresos → Ganadería** |
| Cargar el precio **$/kg** por categoría | **Presupuesto → "Precios y TC"** (columnas verdes) |
| Ver el ingreso en el mes de cobro y el IIBB del mes siguiente | **Presupuesto** |

### Cómo se calcula
```
terneros    = vientres × % destete
machos      = terneros × % machos       ·  hembras = terneros − machos
reposición  = vientres × % reposición   ← sale de las HEMBRAS
venta       = cabezas − reposición
kg          = venta × peso
neto        = kg × precio $/kg
IVA         = neto × 10,5%              →  total cobrado = neto + IVA
IIBB        = neto × 1%                 →  se paga el MES SIGUIENTE al cobro
```
Ejemplo de la planilla: 200 vientres × 85% = 170 terneros → 85 machos × 200 kg y 45 hembras
× 170 kg → 24.650 kg × $7.000 = **$172.550.000** neto + IVA = **$190.667.750**.

### El precio
Se busca en **Precios y TC** por **categoría** (`Ternero`, `Ternera`, `Vaca CUT/Descarte`) y
mes de cobro. Si falta el mes, arrastra el siguiente cargado y marca con `*`.
En la proyección hay un **precio $/kg opcional** que **pisa** la tabla (marcado con `m`).
No hay Matba de hacienda: es carga manual.

### Referencia del historial real
Arriba de la lista se muestran los valores **reales del último ciclo cerrado** de
`productivo.ciclos_cria` (vientres a servicio, % destete, % machos, kg promedio) y también al
lado de cada campo del formulario. **Es sólo referencia: no pisa lo que cargues** — la
proyección puede ser deliberadamente más conservadora.

> ⚠️ Ojo: el ciclo 2025 real tiene **220 vientres** (192 vaca + 28 vaquillona), no 200; el
> ciclo 2024 cerró con **88,3%** de destete (no 85%) y split **56,6/43,4** (no 50/50).

### Lo que ve el Presupuesto

**`🐄 Venta de hacienda`** es un total, y debajo va **una fila por categoría** (sólo las que
tienen algo). Cada fila mezcla las dos cosas en la misma línea:

| | qué muestra |
|---|---|
| Mes con venta presupuestada | **plata** — total cobrado (neto + IVA, menos comercialización). `*` = algún precio arrastrado de otro mes |
| Mes en que se disponibiliza | **cabezas + kg promedio** en ámbar — hay hacienda sin vender |

Una categoría **sin ninguna venta** igual aparece, marcada *"sin venta presupuestada"*: es el
aviso de que hay stock parado. Pasar el mouse por la celda ámbar explica la resta
(*"98 cab. existentes − 55 con venta presupuestada · stock de hoy"*).

**No hace falta crear el lote para que te avise.** Las cabezas salen de la **fuente** — la
pesada para el stock de hoy, el ciclo para los destetes que vienen — y se descuenta lo que ya
tiene venta. Si tuvieras que armar el lote primero, el aviso llegaría tarde. Es el mismo
criterio que las toneladas de soja disponibles a fijar.

**El promedio del saldo baja si vendés los pesados**, y eso es correcto: de 98 machos a 245 kg,
si te llevás los 55 más pesados (275 kg) los 43 que quedan promedian 207 kg, no 245.

Y una fila **IIBB ganadería** en EGRESOS, en el **mes siguiente** al cobro.

### Alícuotas
**Viven en la proyección, no en el código**: IVA 10,5% e IIBB 1% son editables por fila.
Es a propósito — arrendamiento es exento con IIBB 5%, y meterlas como constantes globales fue
un error que esta solapa destapó.

---

## 🏷️ Productivo → Terneros → exportar caravanas (para declarar) ✅

Botón **Descargar Excel**. El modal pregunta primero qué querés bajar:

- **Pesadas** — la planilla de siempre, con trazabilidad y las pesadas que elijas.
- **Caravanas** — el listado para declarar.

Con *Caravanas* elegís **qué categorías** entran y sale **una solapa por cada una**: Ternero
Recría, Torito, Ternera Recría, Ternera Reposición. Cada solapa lleva la caravana oficial y la
interna, ordenadas por caravana.

**La caravana sale sin el espacio y empezando con el cero.** En la app se guarda
`032 010012326481`; en el archivo va `032010012326481`. La celda se escribe como **texto** a
propósito: si fuera número, Excel se comería el cero y quedaría `32010012326481`, que es otra
caravana. Puede aparecer el triangulito verde de "número guardado como texto" — está bien, es lo
que hace falta.

**Qué no entra:** las bajas (no se declaran) y los activos a los que les falta la caravana
oficial. Esos últimos el modal te los avisa con su caravana interna, para que los completes antes
de declarar.

---

## 🐄 Productivo → Hacienda → Planilla de Hacienda 🟡 *(reescrita 2026-08-21, sin testear)*

Botón **Planilla** en el encabezado de *Stock de Hacienda*. Emite el reporte de existencias del
período en el formato de la planilla de papel del establecimiento, en **Excel y PDF a la vez**.

### Elegir el período
- **Por Mes** — mes y año.
- **Rango Personalizado** — dos fechas libres. Acá aparece la pregunta de abajo.

### 🆕 Una sola planilla, o una por mes
Con **Rango Personalizado** el modal pregunta *"¿Cómo querés el resultado?"*:

| Opción | Qué hace |
|---|---|
| **Una sola, punta a punta** | una planilla de todo el rango (es el default) |
| **Una por mes** | **una planilla por cada mes** del rango, en una sola pasada |

Con *Una por mes* te dice **antes de exportar** cuántas van a salir y con qué títulos, y la
**carpeta se elige una sola vez** para toda la tanda. Los meses de las puntas se **recortan al
rango**: si pedís del 15/02 al 21/08, el primer archivo va del *15/02 al 28/02* y lo dice en el
título, en vez de llamarse "Febrero 2026" y contener medio mes.

> Con *Una por mes* **no hay preview** y el botón pasa a ser **Exportar N planillas**: el preview
> muestra una sola planilla y no tendría sentido para una tanda.

### Ver antes de bajar
**Ver Planilla** abre el preview en pantalla, con la grilla y el detalle del CUT. Desde ahí,
**Descargar Excel + PDF**.

### Qué trae el archivo
1. **Planilla** — categorías en columnas (CRÍA · RECRÍA/ENGORDE · Terneros al Pie, con subtotales) y
   los conceptos en filas: *Stock Anterior · Compras · Nacimientos · Reclas. + · Ingresos · Ventas ·
   Mortandad · Reclas. − · Egresos · Existencia Final*, más el **Total Vientres** al pie.
2. **Detalle de movimientos** — uno por fila: fecha, tipo, categoría, cantidad, contraparte y
   observaciones. **Sin kilos ni montos**: esta planilla es de movimientos de stock, no de ventas.
3. **Detalle CUT / Descarte** — ver abajo.

### La página del CUT / Descarte, y su control
No es una lista: es la **conciliación** de la categoría.

```
A · VENÍAN DE ANTES            los que ya estaban al empezar el período
B · ENTRARON EN EL PERÍODO     con su motivo de ingreso
C · SIN FECHA DE ALTA          los que no se pueden ubicar en el tiempo (no se omiten)

CIERRE   venían + entraron − salieron = quedan
```

Cada caravana lleva su **Estado al cierre**: *Sigue en CUT*, o *Salió DD/MM — motivo*. Los que
salieron en períodos **anteriores** ya no aparecen.

**El control**: la página 1 cuenta **cabezas** y ésta cuenta **individuos**. Si no coinciden, sale
una **alerta roja** — *"faltan N cabezas sin identificar con caravana"*. Significa que hubo un
movimiento al CUT sin decir **cuáles** animales. No es un error del reporte: es un dato que falta.

### Cuando movés algo al CUT sin caravanas
La app te **avisa pero no te frena** (al mover de categoría y al registrar un tacto). Podés seguir:
el movimiento se registra igual y **la planilla marca el descuadre** hasta que cargues las
caravanas. Es a propósito — si no las tenés a mano, es peor no registrar el movimiento.

### 🧪 Cómo probarlo
1. **Agosto 2026** → `Total General` de *Existencia Final* debe dar **356**, y coincidir con lo que
   muestra la pestaña **Stock** y con la planilla en modo rango del 15/02 al 21/08.
2. **Febrero 2026** → la fila **Mortandad** debe decir **1** (la ternera perdida), no 9.
3. **Marzo 2026** → la página del CUT cierra `8 + 4 − 4 = 8` con **✓ OK**, y las 4 que entraron el
   29/03 figuran *Salió 30/03/2026 — Vendido*.
4. **Agosto 2026** → la página del CUT tiene que dar la **alerta roja de 1 cabeza**, y las 4
   vendidas en marzo **no deben aparecer**.
5. **Rango 15/02 → 21/08 con *Una por mes*** → anuncia **7 planillas / 14 archivos**, pide la
   carpeta una vez, y el primero va del *15/02 al 28/02*.

---

## 🔔 Aviso: extractos bancarios sin cargar 🟡 *(nuevo 2026-08-09, sin testear)*

En **Principal**, arriba de todo, aparece un aviso cuando hace **más de 30 días** que no se carga
el extracto de una cuenta bancaria. En **rojo** a partir de los 60, o si esa cuenta nunca se importó.

**Por qué existe**: un extracto que no se importa no da ningún error. El Cash Flow y la conciliación
siguen andando con lo último cargado, y eso no se nota hasta que los números no cierran.

**Qué mira**: sólo las **cuentas bancarias** — cajas de ahorro y cuentas corrientes. Las cajas de
efectivo y las tarjetas quedan afuera a propósito: no son extractos que el banco publique todos los
meses, así que "hace 40 días que no se carga" no significa lo mismo.

**Qué cuenta como "cargado"**: la fecha del **último movimiento** de esa cuenta, no la fecha en que
importaste. Si subís un extracto que termina hace dos meses, el aviso sigue.

### 🧪 Cómo probarlo
1. Entrá a **Principal**. Al 2026-08-09 debería avisarte por **MA Galicia CA** (último movimiento
   27/03, unos 135 días) y **no** por MSA ni PAM, que están al día.
2. Cargá el extracto de MA en **Extracto Bancario** y volvé a Principal: el aviso tiene que
   desaparecer.
3. Verificá que **no** aparecen las cajas ni las tarjetas, aunque estén más desactualizadas.

---

## 📝 Notas para Claude 🟡 *(nuevo 2026-08-11, sin testear)*

> Diseño y motivos → `PENDIENTES.md` § P-34.

Un botón **📝 fijo abajo a la derecha**, en toda la app, para dejar un bug o una idea **en el momento
y el lugar donde pasa** — en vez de acordarte tres días después.

### Cómo se usa
1. Tocá **📝** — o apretá **`Alt + N`**, que hace lo mismo. Se abre una ventanita: escribís qué pasó
   y **pegás la captura**.
2. Para la captura: **Win + Shift + S** (recorte de Windows) y después **Ctrl + V** ahí adentro.
3. Tocás **Empezar nota**. Aparece abajo una barra: *«Grabando · 1 captura»*.
4. **Seguí usando la app normalmente.** Cuando quieras sumar otro paso, **Capturar** de nuevo.
5. Cuando terminaste, **Finalizar** y le ponés un título.

> ⌨️ **Con un modal abierto, usá `Alt + N`.** El botón 📝 queda **tapado** por el modal y no se
> puede clickear — y el modal es justo donde suele aparecer lo que querés reportar. El atajo anda
> igual, y el contexto guarda **cuál** era el modal.

**Una nota son N capturas, no N notas.** El botón abre el formulario de la captura 1; cada
**Capturar** agrega un paso más a *la misma* nota. Al **Finalizar** se guarda **una sola nota** con
todas sus capturas adentro. Por eso sirve para *«hago esto → pasa esto → acá se ve el número mal»*.

**La nota sigue grabando aunque cambies de pestaña.** Eso es a propósito: si un proceso sale mal,
podés resetearlo, empezar de nuevo y capturar cada paso — así queda un caso reproducible en vez de
un *"no anda"*.

### Qué guarda solo, sin que escribas nada
La pantalla en la que estabas, el modal abierto si había uno, la ruta y la hora. Vos escribís sólo
la idea.

### Por qué se pega la captura en vez de sacarla sola
Porque los carteles que más interrumpen son los del **navegador**, y ninguna captura automática
puede fotografiarlos. Pegando del portapapeles queda **exactamente lo que viste**.

Se evaluó que la sacara sola y **se descartó** (2026-08-29): lo único que el navegador puede hacer
sin pedirte permiso cada vez no es una foto, es **volver a dibujar la pantalla** — mismos textos y
mismos números, pero puede correr una columna de lugar o dejar un gráfico en blanco. *«Que salga fea
no es problema; lo que no debe pasar es que sea tergiversada.»* La tuya siempre es fiel y elegís el
zoom.

**Lo que sí hace la app:** si al **Finalizar** alguna captura quedó **sin imagen**, te avisa antes de
guardar. De las primeras 15 capturas, 11 quedaron sin foto — no porque cueste sacarla, sino porque
nada lo recordaba en el momento.

### Ver las notas
**Click derecho** sobre el botón 📝. Muestra las notas con su estado: *sin leer* o *leída*, y si ya
se convirtió en pendiente, con qué ID quedó.

> 🔒 **Una nota no es un pendiente: es una bandeja de entrada.** Cuando Claude la lee, termina como
> ítem con ID en `PENDIENTES.md` o descartada con motivo. Si no, en dos meses hay 80 notas que nadie
> mira.

### 🧪 Cómo probarlo <a id="a-test-28"></a>
1. Tocá 📝 en cualquier pantalla, escribí algo y **Empezar nota**. Tiene que aparecer la barra
   *«Grabando · 1 captura»*.
2. **Cambiá de pestaña.** La barra tiene que seguir ahí — si desaparece, no sirve para grabar un
   proceso.
3. Sacá un recorte con Win+Shift+S y pegalo con Ctrl+V: tiene que verse la miniatura.
4. **Capturar** una segunda vez desde otra pantalla y **Finalizar**.
5. **Click derecho** en 📝: la nota tiene que estar, como *sin leer* y con **2 capturas**.

### 🧪 PRIMERO — que siga guardando <a id="a-test-77"></a> 🟡 *(A-SEC-04, 2026-08-31)*

> ⚠️ **Empezar por acá.** El 31/08 se cerró la seguridad de las notas y eso **tocó cómo se guardan**.
> Si esto falla, lo de abajo no importa: se arregla esto primero.

1. **Dejá una nota cualquiera** (texto + una captura) y tocá **Finalizar**.
   → Tiene que decir *«Nota guardada con 1 captura(s)»*. **Si dice "No se pudo guardar", pará y
   avisá**: el permiso quedó mal.
2. **Click derecho** en 📝 → la lista tiene que aparecer, **con la nota recién hecha arriba**.
   Esa lista ahora viene por otro camino (`/api/notas`, del lado del servidor), así que es lo que
   más chance tiene de haberse roto.
3. Si la lista sale vacía o con un cartel de error, **la nota igual se guardó** — el problema sería
   sólo de lectura. Avisá qué dice el cartel.

*Por qué este test existe: al poner los permisos, el guardado se rompió y `type-check` no lo vio —
el código era idéntico, lo que cambió estaba en la base. Se detectó y arregló probando contra la
base, pero **el camino del navegador no se probó corriendo la app**.*

### 🧪 Cómo probar lo nuevo del 2026-08-29 <a id="a-test-74"></a>
1. **El atajo con un modal abierto** — es lo que más importa. Abrí cualquier modal de la app (por
   ejemplo *vincular anticipo*) y apretá **`Alt + N`**. Tiene que abrirse la ventanita de la nota
   **encima** del modal.
   → Y en el renglón gris *«Se guarda solo:»* tiene que decir **el nombre del modal que tenías
   abierto**, no el de la nota. Si dice el de la nota, el contexto se perdió y hay que avisar.
2. **El atajo suelto**: `Alt + N` sin ningún modal abierto tiene que abrir la nota igual.
3. **El aviso de la foto faltante**: hacé una nota escribiendo texto **sin pegar imagen** y tocá
   **Finalizar**. Tiene que preguntarte *«Ninguna de las 1 captura(s) tiene imagen. ¿Guardar igual?»*.
   Cancelá, pegá una captura y finalizá: **ya no tiene que preguntar nada**.
4. **La pantalla limpia** — el que motivó todo. Parado en la solapa **Sueldos** (que muestra el
   contador de pendientes al lado del nombre), dejá una nota. En *«Se guarda solo:»* tiene que decir
   **`pantalla «Sueldos»`**, no `«Sueldos11»`.
6. ⚠️ Abrí un modal cualquiera y capturá desde ahí: en el recuadro gris tiene que decir el nombre
   **de ese** modal, no *«Nueva nota para Claude»*. Si dice eso último, el contexto se está
   capturando tarde.

### 🔎 La cinta de diagnóstico ✅ *(nuevo 2026-09-02, testeado en navegador)*

> Diseño y motivos → `PENDIENTES.md` § A-FEAT-72.

**Qué hace.** Cuando algo falla, el renglón que **resuelve** el bug no se ve en la captura: es algo
como `23503 · violates foreign key constraint "anticipos_proveedores_factura_id_fkey"`. Ahora la app
se acuerda de los **últimos 50 eventos técnicos** y los adjunta a la nota sola.

**Cómo se usa: no se usa.** No hay que prender nada ni acordarse de nada. Se usa la app, algo se
rompe, `Alt + N`. Si hubo eventos, la ventanita de la nota muestra un renglón amarillo:

> 🔎 **Se adjuntan 3 evento(s) técnico(s) — tocá para verlos**

Tocalo y vas a ver exactamente qué se manda. Está a la vista a propósito: es la única forma de que
puedas controlar que no viaja nada que no querés.

⚠️ **No refresques la página antes de dejar la nota.** El refresh borra la cinta — que es justo lo
que querés que Claude lea. Si ya refrescaste, la nota sirve igual, pero sin los eventos.

#### ¿Hay que "guardar" la cinta? No: es automática

**La cinta graba sola desde que abrís la página**, hayas empezado una nota o no. No se prende, no se
apaga y no se guarda a mano. Por eso funciona el caso real: algo se rompe *antes* de que se te ocurra
reportarlo, y cuando apretás `Alt + N` el error ya estaba anotado. Guarda los **últimos 50 eventos**;
del 51 en adelante tira el más viejo.

Lo que es "por captura" no es la grabación sino **el reparto**: cada captura se lleva los eventos que
pasaron *desde la captura anterior*. No se repiten ni se pierden entre una y otra.

```
abrís la página
   │  ← la cinta arranca sola
   ├── error A
   ├── error B
   ├─ Alt+N → CAPTURA 1 ......... se lleva A y B
   ├── error C
   ├─ Capturar → CAPTURA 2 ...... se lleva sólo C
   ├── error D
   └─ Finalizar ................. D se engancha a la CAPTURA 2
```

**Las dos formas de trabajar sirven y no perdés nada:**
- **Capturando en cada paso** → cada error queda pegado *al paso donde ocurrió*. Es lo que convierte
  *«no anda»* en *«en el paso 3 saltó esto»*. Para un bug con varios pasos, es lo que conviene.
- **Sólo al principio y al final** → los eventos igual se guardan, todos juntos en la última captura.
  Los tenés, pero mezclados: no se sabe cuál pasó en qué momento.

*(El error D del diagrama antes se perdía: el reparto ocurría al abrir una captura, no al Finalizar,
así que lo que explotaba justo antes de finalizar quedaba afuera — el caso más natural de todos.
Corregido el 2026-09-03; el modal de Finalizar ahora avisa cuántos eventos sueltos se suman.)*

**Qué NO va a resolver** (para que no te frustre): sirve para lo que **tira error**. Un número mal
calculado que no falla —como el Cash Flow que proyectaba $181 M— no deja rastro en la cinta; ése sale
de los datos. Y para las mejoras (*"quiero decimales acá"*) no aporta nada.

#### 🧪 Cómo probarlo <a id="a-test-81"></a>
> ✅ **Ya se probó automáticamente el 2026-09-02**, manejando un navegador real contra la app: la
> cinta engancha, el renglón aparece, los eventos llegan a la base y el secreto no se filtra por
> ninguna de las tres vías (query, header, cuerpo). Estos pasos quedan por si querés verlo con tus
> propios ojos, o para volver a probarlo si algo cambia.

1. **Que capture algo.** Provocá un error de la app sin cortarte internet: **F12** → solapa
   **Network** → cambiá `No throttling` por **`Offline`**, tocá cualquier cosa que traiga datos, y
   volvelo a `No throttling`. Después `Alt + N`. (Sólo esa pestaña queda aislada.)
   → Tiene que aparecer el renglón amarillo con al menos 1 evento. Si no aparece, la cinta no se
   enganchó y hay que avisar.
2. **Que se entienda.** Desplegalo. Cada renglón tiene **hora**, **tipo** (`ERROR` / `WARN` / `RED` /
   `DB`), a veces un **código** (`23503`, `409`) y **dónde** (`app/egresos/page.js:120` o
   `POST /anticipos_proveedores`).
3. 🔒 **El control que más importa — que NO se filtre nada.** Escribí algo reconocible en cualquier
   campo de la app (por ejemplo `PRUEBA-SECRETA-123` en un buscador o en un monto), provocá el error,
   y mirá la lista de eventos.
   → **Esa palabra no puede aparecer por ningún lado.** Si aparece, pará y avisá: se rompió la lista
   blanca, que es lo único que hace que esto sea seguro.
4. **Que llegue.** Finalizá la nota. Después avisame y verifico en la base que
   `notas_capturas.diagnostico` tenga los eventos.
5. **Que no se repita.** Con una nota grabando, hacé **2 capturas** con un error en el medio.
   → El error tiene que aparecer en **una sola** de las dos, no en las dos.

---

## 💸 Cash Flow → PAGOS: pagar un lote 🟡 *(nuevo 2026-08-10, sin testear)*

> Diseño y motivos → `PENDIENTES.md` § Cash Flow → PAGOS.

Seleccionás las filas, elegís el estado y tocás **Aplicar**. A partir de ahí son **dos preguntas**,
en este orden, y **hasta contestarlas no se guarda nada**.

### 1 · ¿Con qué fecha se pagaron?
Aparece sólo cuando el estado elegido significa que la plata sale (*pagar, preparado, programado,
pagado, débito*). Viene propuesta la fecha de **hoy**, editable.

| Botón | Qué hace |
|---|---|
| **Registrar con esta fecha** | guarda esa fecha como fecha de pago en todas las seleccionadas |
| **Dejar las fechas que ya tienen** | usa la fecha estimada de cada una como fecha de pago |
| **Cancelar — no tocar nada** | no modifica nada |

**Por qué se pregunta**: el pago se registra el día que se paga, no el día que se había estimado. Y
la **quincena de SICORE sale de esta fecha**, así que si está mal, la retención puede caer en la
quincena equivocada — y eso se presenta a ARCA.

### 2 · ¿Qué hacemos con las que retienen SICORE?
Si alguna califica, aparece la lista **con la fecha de pago de cada una**, para poder verla antes de
decidir. Dice *"Todavía no se guardó nada"* porque es literal.

| Botón | Qué hace |
|---|---|
| **Retener SICORE — una factura por vez** | abre la cola de siempre |
| **Pagar sin retener** | guarda el estado, sin retención |
| **Cancelar — no tocar nada** | 🔑 **aborta todo**, incluidas las que no llevan SICORE |

### 🔑 Sin fecha de pago no hay SICORE
Es una regla, no un detalle: **la quincena se calcula siempre desde la fecha de pago**. Si una
factura califica por monto pero no tiene fecha de pago, se guarda **sin retención** y te avisa
cuántas fueron. No se inventa la fecha con la de vencimiento ni con la estimada.

### 📥 Al cerrar la quincena: volcar lo retenido a la cuota del template 🟡 *(arreglado 2026-08-27, sin testear — [A-TEST-52](PENDIENTES.md#a-test-52))*
Al cerrar una quincena SICORE se ofrece cargar **el total efectivamente retenido** en una cuota de
los templates *SICORE 1er / 2da Quincena*. Cada opción dice **de qué campaña es**:

```
1er Quincena · 26/27 | 20/08/2026 — $0
```

Viene **preseleccionada la primera cuota que vence después del cierre** de esa quincena, que
normalmente es la que corresponde. Podés elegir otra de la lista, o cerrar sin asignar y cargarla a
mano.

> ⚠️ **Hasta el 2026-08-27 la lista sólo traía las cuotas de la campaña 25/26** — o sea las 2 que
> quedaban, ambas vencidas— aunque las 24 de la campaña nueva ya estuvieran generadas. Si cerraste
> una quincena antes de esa fecha y la cargaste a mano, revisá que no te quede **duplicada** cuando
> uses la cuota de la campaña nueva.

### 🎛️ Chips de Estado y Origen: ctrl+click aísla
- **Click** en un chip: lo prende o lo apaga.
- **Ctrl+click** (⌘+click en Mac): deja **sólo ése** prendido.

Antes, para pasar de "todos" a "ver sólo uno" había que apretar *ninguno* y después el que se
quería. Ahora es un solo click. Sirve en las dos filas de chips, y el cartelito
*«ctrl+click = sólo ése»* está al lado para no tener que acordarse.

### ✍️ Escribir fechas: el año se completa solo
Al tipear una fecha en la grilla podés poner sólo día y mes: `10/8` queda **10/08/2026**. Sirven
`/`, `-` y `.`, y el año de dos dígitos (`5/3/26`). *Por ahora sólo en Cash Flow.*

### 👷 Pagar un SUELDO desde acá 🟡 *(arreglado 2026-08-25, sin testear — [A-TEST-40](PENDIENTES.md#a-test-40))*
Los pagos de sueldo se marcan como cualquier otra fila: seleccionar, estado **Pagado**, fecha, Aplicar.

**Un pago de sueldo tiene UNA sola fecha.** El Cash Flow maneja tres (estimada, vencimiento, pago),
pero abajo hay una sola columna: **la fecha que ponés es la fecha del pago**, y las tres apuntan ahí.
No es un límite a arreglar, es cómo está pensado — un sueldo no tiene vencimiento propio.

Por eso, la columna **Fecha de Pago** de un sueldo se llena **cuando el pago pasa a `pagado` o
`conciliado`**. Antes de eso está vacía a propósito: la fecha existe, pero todavía es una previsión.
En un **grupo de pago** aparece sólo si **todos** sus miembros están pagados — si uno quedó
pendiente, mostrar la fecha diría que el pago está hecho y no lo está.

**Los grupos se pagan igual que un pago suelto** ✅ *(arreglado y testeado 2026-08-31 —
[A-TEST-79](PENDIENTES.md#a-test-79))*. Seleccionás la fila del grupo y le ponés estado y fecha: se
escribe sobre **todos sus miembros** de una. Hasta el 31/08 esto **no funcionaba** —el grupo se
rechazaba entero y el aviso te mandaba a *Sueldos*, donde no había nada que hacer—, y no se notaba
porque los grupos viejos llegaban a `conciliado` por el motor de conciliación, no por este botón.

> ⛔ **Lo que sí sigue sin poder tocarse acá es el PERÍODO de sueldo** (el sueldo del mes). Ése se
> gestiona en la solapa **Sueldos**, y el aviso ahora aparece sólo en ese caso, que es cuando es cierto.

> ⚠️ **Si algo no se guarda, ahora te lo dice con nombre y motivo** (un cartelito abajo), y **la
> grilla se queda donde está**. Hasta el 2026-08-25 la pantalla entera se reemplazaba por *«Error al
> cargar Cash Flow»* con un botón **Reintentar** que en realidad **sólo recargaba** — parecía que el
> reintento arreglaba algo, pero lo guardado ya estaba guardado desde el primer click.

### 🧪 Cómo probarlo <a id="a-test-27"></a>
1. Seleccioná 2 o 3 filas, estado **Pagar**, Aplicar. Tiene que aparecer **primero** la pregunta de
   la fecha, con la de hoy puesta.
2. **Cancelar** en esa pantalla: nada tiene que cambiar y la selección queda como estaba.
3. Repetí y elegí **Registrar con esta fecha**. Si alguna califica para SICORE, aparece la segunda
   pregunta con la lista y las fechas.
4. ⚠️ **El paso que caza el bug viejo**: en la pregunta de SICORE tocá **Cancelar**. Recargá.
   **Ninguna** de las filas —ni las de SICORE ni el resto del lote— puede haber cambiado de estado.
   Antes quedaban todas en *pagar*.
5. Repetí y elegí **Pagar sin retener**: se guardan con el estado, sin retención.
6. En la grilla, escribí `10/8` en una fecha: tiene que quedar **10/08/2026**.
7. **Chips**: con todos prendidos, hacé **ctrl+click** en uno: tiene que quedar sólo ése. Probalo
   en Estado y en Origen.
8. **Fac C**: poné a pagar la factura de **Micelli** (Factura C). **No** tiene que proponer SICORE —
   ni desde la fila ni desde el lote. A los monotributistas no se les retiene.

---

## 🧩 Reglas de parseo — desglosar el texto del banco 🟡 *(nuevo 2026-08-09, sin testear)*

> Diseño, propuesta automática y los huecos abiertos → `PENDIENTES.md` § Parseo de extractos.

### Qué son y por qué existen
En **Caja de Ahorro** el banco no manda columnas: manda todo apilado dentro de una sola celda.

```
TRANSFERENCIA A TERCEROS      ← el tipo
MARTINEZ PLACIDO ANDRES       ← el nombre
20287492546                   ← el CUIT
VARIOS                        ← el concepto
BANCO DE GALICIA…
```

Las **reglas de parseo** reparten ese bloque en columnas. Sin ellas el movimiento entra igual —el
texto completo **nunca se pierde**, queda entero en `concepto`— pero no se puede buscar por CUIT ni
por beneficiario, y la conciliación no encuentra la contraparte.

⚠️ **No son las reglas de conciliación.** Son otra tabla y otro momento: éstas corren **al importar**
y reparten texto; las de conciliación corren después y asignan cuenta contable.

**Las cuentas corrientes no las usan**: su export ya viene del banco con las columnas separadas.
Si elegís una CC, la pantalla te lo dice.

### Dónde está
**Extracto Bancario → botón Configuración → solapa «Reglas de Parseo (import)»**.
La cuenta se elige en el selector de arriba del modal, el mismo que usan las otras dos solapas.

### Cómo se usa
1. Arriba aparecen los **tipos sin regla**, ordenados por cantidad de movimientos: el primero es el
   que más rinde. Cada uno muestra un movimiento real con las líneas numeradas.
2. Tocá **«Configurar N líneas»**. Se abre una tabla con **una fila por línea**:

   | # | Lo que dice el banco | Cómo se extrae | Va a la columna | Quedaría |
   |---|---|---|---|---|
   | 1 | COMPRA DEBITO `tipo` | Línea N | descripcion | COMPRA DEBITO |
   | 2 | DIA TIENDA 670 `nombre` | Línea N | leyendas_1 | DIA TIENDA 670 |
   | 3 | 4517XXXXXXXXXX11 `tarjeta` | — | — sin asignar — | — |

3. **Lo que el banco escribe siempre igual ya viene propuesto**: el CUIT, el nombre que está antes
   del CUIT, el tipo de la línea 1, el número de operación. Lo que no reconoce lo deja
   **sin asignar** y te dice por qué. Todo es editable.
4. La última columna, **«Quedaría»**, muestra lo que esa regla extrae **de ese movimiento**. Es la
   verificación: si dice *vacío* en rojo, la regla no sirve.
5. Elegí el **grupo de conceptos** (es del tipo entero, no de cada línea) y **Guardar**. El botón
   dice cuántas reglas crea, cambia y borra.

### 🔀 Cada forma se configura por separado
Un mismo tipo puede llegar escrito de maneras distintas. La tarjeta lo avisa con un chip
**«N formas»** y las muestra todas, con cuántos movimientos tiene cada una.

Dentro del editor eso cambia la columna **«Quedaría»**: en vez de un valor, muestra **uno por
forma**, y si la regla trae cosas de distinta naturaleza según la forma, la fila se pinta en ámbar:

```
línea 5 → nro_terminal      6L·12   4517XXXXXXXXXX11
                            6L· 4   VARIOS
                            5L· 7   BANCO DE GALICIA Y BUENOS AIRES SAU
                            ⚠ Trae cosas distintas según la forma.
```

**Cada forma es su propia tarjeta**, con su ejemplo real, cuántos movimientos tiene y sus reglas.
Se configuran por separado y no se pisan entre sí. Las tarjetas de un mismo tipo van agrupadas
debajo de su nombre, y el **grupo de conceptos es del tipo entero** — se edita una vez y vale para
todas sus formas.

Así, `TRANSFERENCIA A TERCEROS` se ve como tres bloques: el de 6 líneas con 12 movimientos, el de
6 líneas con 4, y el de 5 líneas con 7. Cada uno se configura mirando su propio texto.

⚠️ **Terminá el tipo entero de una sentada.** Las reglas viejas —las que ya estaban antes de este
cambio— valen para todas las formas. En cuanto guardás una forma, quedan atadas **sólo a ésa** y las
otras se quedan sin reglas hasta que las configures. El editor te lo avisa antes de guardar.

### 🛑 Una forma sin reglas NO se parsea
Si un tipo tiene reglas atadas a formas y llega un movimiento de **otra** forma, el sistema
**no lo desglosa**: lo deja marcado con el grupo **«Forma nueva»**.

Es a propósito. Vale más un movimiento sin desglosar y señalado que uno desglosado con las reglas de
otra forma — que se vería correcto y estaría mal. Así, cuando el banco empieza a mandar algo nuevo,
**se ve**. El texto original nunca se pierde: se le escriben las reglas de esa forma y se corre
**Re-parsear**.

En la pantalla, esa forma aparece marcada **«sin reglas — no se desglosa»**, y arriba de todo hay
un recuadro celeste con todas las formas que están en esa situación, ordenadas por cantidad.

**No alcanza con contar líneas**: dos movimientos de 6 líneas pueden ser formas distintas si tienen
las líneas cambiadas de lugar. Por eso la forma se calcula con la **clase de dato de cada línea**
(CUIT, CBU, tarjeta, número, texto), no sólo con la cantidad.

### 🗂️ Dónde va cada dato
Las columnas se eligen por **lo que guardan**, no por su nombre técnico:

| En la pantalla | Qué guarda |
|---|---|
| El tipo de movimiento | la primera línea |
| Nombre / comercio | la contraparte |
| **CUIT** | de acá lo lee el motor de conciliación |
| Concepto | `VARIOS`, `HONORARIOS`… |
| Banco de la contraparte | `BANCO DE GALICIA…` |
| Nº de operación / autorización | `OP:…`, `A837` |
| Terminal / identificador | números largos del banco |
| **CBU** | los 22 dígitos |

Es la misma convención que usa MSA. Y hay modos que **buscan** el dato en vez de contar líneas:
*Busca el CUIT*, *Busca el CBU*, *Busca la tarjeta*, *Antes/Después del CUIT*. Ésos sobreviven a que
el banco cambie el orden.

> 🔎 Detalle técnico, por si alguna vez mirás la base: el CBU se guarda en la columna
> `tipo_de_movimiento`. El nombre no corresponde y **es a propósito** — era la única columna libre
> de las 37, y se decidió no crear una nueva. Está documentado en `ARQUITECTURA-BD.md` § 6b.

### 🔑 Dos cosas que conviene saber
- **«Busca el CUIT» le gana a «Línea N».** Los modos que buscan (`Busca el CUIT`, `Antes del CUIT`,
  `Después del CUIT`) siguen funcionando aunque el banco corra las líneas. Contar posiciones no.
  Ya pasó: `TRANSFERENCIA A TERCEROS` llega con 5 o con 6 líneas y el CUIT cambia de lugar
  (→ `PENDIENTES.md` § A-BUG-17).
- **Guardar una regla NO cambia lo ya importado.** Para eso está **Re-parsear**.

### Re-parsear — aplicar las reglas a lo que ya está cargado
Botón **«Re-parsear»** en Extracto Bancario, sólo en cuentas de Caja de Ahorro.

1. Corre **en seco** primero: te dice cuántos movimientos cambiarían y **no toca nada**.
2. Si el resultado convence, **Aplicar**.

**No hace falta volver a importar nunca**: lee el texto original que el importador guardó. Y sólo
escribe las columnas del desglose — la cuenta contable, el detalle y el estado de conciliación
**no se tocan**.

### 🧪 Cómo probarlo <a id="a-test-26"></a>
1. **Extracto Bancario → Configuración → Reglas de Parseo**, con **MSA Galicia CC** elegida: tiene
   que decir *"Esta cuenta no usa reglas de parseo"*.
2. Cambiá a **MA Galicia CA**. Deberías ver los tipos sin regla arriba y los ya configurados abajo,
   cada uno con su movimiento real al lado de lo que extrae cada regla.
3. Abrí un tipo ya configurado (ej. `COMPRA DEBITO`): las filas tienen que venir **pre-cargadas con
   lo que ya guardaste**, no con la propuesta.
4. Abrí `TRANSFERENCIAS CASH PROVEEDORES` (sin regla, 1 mov.). Verificá que **propone solo**:
   línea 3 reconocida como **CUIT** → `leyendas_2` con modo *Busca el CUIT*, y línea 2 como
   **nombre** → `leyendas_1`.
5. ⚠️ **El paso que caza el error caro**: en cualquier fila, cambiá «Va a la columna» a
   **leyendas_2 — CUIT** con un modo que **no** sea *Busca el CUIT*. Tiene que aparecer el aviso
   ámbar. Si no aparece, la protección contra meter el CBU en la columna del CUIT no está activa.
6. Poné una fila en **«— sin asignar —»**: la columna *Quedaría* pasa a `—` y el contador del botón
   Guardar tiene que reflejar una baja.
7. **Re-parsear en seco** sobre MA y leer el resumen antes de aplicar.
8. ⚠️ **El paso de las formas múltiples**: abrí `TRANSFERENCIA A TERCEROS` (23 mov.). Tiene que
   avisar **«3 formas»** — 12 y 4 de seis líneas, 7 de cinco. En la fila de la línea 5, la columna
   *Quedaría* tiene que mostrar los tres valores distintos y pintarse en ámbar. Si muestra uno solo,
   la detección de formas no está corriendo.
9. `DEB. AUTOM. DE SERV.` tiene **2 formas, las dos de 5 líneas** (una con `0226 - 0226` en la línea
   4). Sirve para verificar que la forma no se calcula sólo contando líneas.
10. **Reglas por forma**: abrí una forma de `TRANSFERENCIA A TERCEROS`. Antes de guardar tiene que
    avisarte que las reglas actuales valen para las 3 y que van a quedar atadas sólo a ésta.
    Guardá, y verificá que las **otras dos** formas pasaron a *«sin reglas — no se desglosa»*.
11. ⚠️ **El paso que verifica lo más delicado**: con una forma sin reglas, corré *Re-parsear en
    seco*. Esos movimientos tienen que quedar con grupo **«Forma nueva»** — **no** desglosados con
    las reglas de otra forma. Es la garantía de que una forma nueva del banco se ve en vez de
    entrar mal.
12. **El CBU**: en una forma que lo traiga, la línea de 22 dígitos tiene que venir propuesta como
    **CBU** con el modo *Busca el CBU*. Y la línea que empieza con `BANCO` como
    **Banco de la contraparte**.

---

## 🔁 Renovar campaña por tandas 🟡 *(nuevo 2026-08-22, sin testear)*

> Detalle → `PENDIENTES.md` § A-FEAT-42. Test → § A-TEST-39.

**Para qué**: generar los templates de la campaña nueva **de a poco**, sin miedo a duplicar. Lo que
ya generaste no vuelve a aparecer, así que podés hacer 10 hoy, 20 mañana, y dejar los dudosos para
el final.

### Cómo se usa
1. Templates → botón **Renovar campaña**.
2. Elegir **Periodicidad** (bianual jul–jun / anual calendario) y el **período a generar** (`26/27`
   o `2027`).
2b. Elegir la **empresa**: `MSA` · `PAM` · `MA` · `Compartidos` · `Todas`. Arranca en **MSA**, y cada
   solapa muestra cuántos tiene. **Se genera sólo lo de la empresa elegida** — el filtro no es
   visual, es un límite real.
   *`Compartidos` son los templates con más de un responsable (`MSA/PAM`, `PAM/MA/Duhau`). Tienen
   solapa propia para que no se generen dos veces al recorrer las empresas.*
3. Arriba aparece la barra: **"N pendientes de generar · M ya generados"**, y —si filtraste por
   empresa— **también el total de todas**, para que no parezca terminada una campaña a la que le
   falta el resto.
4. Tildar los que quieras en esta tanda, ajustar montos y días en la matriz, y **Generar**.
   El checkbox del encabezado **"Template"** marca o desmarca **todas** — sólo las de la empresa que
   estás mirando —, y al lado se ve el conteo `(seleccionadas/total)`.
5. **El modal no se cierra**: recarga y los que acabás de hacer pasan al bloque *"Ya generados"*.
   Seguís con la tanda siguiente ahí mismo.

### Los botones de cada fila
| | Qué hace |
|---|---|
| 📄 **Copiar** | Replica el monto de la primera columna con valor **hacia adelante**. No toca los meses anteriores ni corta en julio: llega hasta donde el template realmente tenga meses. |
| 🧽 **Vaciar** | Deja la fila sin cuotas. Útil cuando el pre-cargado trae datos viejos. |
| 📋 **Detalle** | Editar las cuotas una por una (permite **varias en el mismo mes**). |
| ↺ **Regenerar** | Devuelve **esa fila sola** a los valores por default y descarta lo que editaste ahí. No toca las demás filas — a diferencia de *Recargar*, que rehace todo. |
| ↓ **Bajar** | Manda el template a *"No aplican"*. ⚠️ **Persiste**: no se ofrece en las próximas campañas hasta que lo vuelvas a subir. Distinto del tilde de incluir, que es sólo para esta corrida. |

### Qué mirar
- **"Ya generados en 26/27 (M)"** — bloque colapsable con lo hecho. Si alguno dice **"(por nombre)"**
  es porque esa versión de la campaña **no la hizo este generador** (se cargó a mano) y se reconoció
  por nombre + responsable.
- **Nada queda excluido automáticamente.** Un template raro —por ejemplo uno cuyo período salta
  varios años— aparece igual en la lista: vos decidís si entra en la tanda o lo dejás para después.
- **Columnas en ámbar (⚠)**: cuotas que caen antes del inicio del período. Suele ser dato viejo mal
  cargado. No bloquea; revisá o vaciá la celda.

### Cómo se prueba que las tandas funcionan
1. Generar **2 o 3** templates nada más.
2. Verificar que el contador pasa a *"N−3 pendientes · 3 ya generados"*.
3. **Volver a abrir** el generador con el mismo período: los 3 **no** tienen que aparecer entre los
   pendientes.
4. En Templates, verificar que existen las 3 filas nuevas con el año de la campaña y sus cuotas —
   **una sola vez cada una**.

---

## 🏦 Resultado de la corrida + filtro de contraparte ✅ *(testeado OK 2026-08-19)*

> Detalle → `PENDIENTES.md` § A-FEAT-29 / A-FEAT-30. Test → § A-TEST-34.

### Qué cambió
- **Las filas ya no se te escapan.** Después de correr el motor, los movimientos que tocó **se
  quedan a la vista** aunque tu filtro ya no los incluya (el caso de siempre: filtrás por
  `pendiente` y al conciliarse desaparecen). Arriba aparece un panel azul con el **antes → después**
  de cada uno. Cuando terminaste de revisar y tildar, apretás **Actualizar y soltar**.
- **Filtro de contraparte**: un **selector de proveedores** al lado del buscador. Escribís nombre o
  CUIT y **elegís de la lista** — es el mismo `ProveedorCombobox` de los modales de ventas. Al
  elegirlo, el CUIT sale del maestro, así que dos proveedores que se llamen parecido no se mezclan.

### Cómo probarlo
1. Extracto → MSA Galicia → en *Contraparte* escribir **`Andres`** y **seleccionar** a Placido
   Andres Martinez de la lista. Tienen que salir sólo sus movimientos.
2. Probar lo mismo escribiendo el CUIT: **`20287492546`**.
3. Poner además el filtro de estado en **pendiente** y correr **Ejecutar Conciliación**.
4. **Qué tiene que pasar**: los que se concilien **siguen en la grilla**, y arriba aparece el panel
   *Resultado de la corrida* con cada fila y su `pendiente → conciliado`.
5. Tildar los que estén bien como **revisados**, y recién ahí **Actualizar y soltar**. Ahí sí
   desaparecen los que ya no cumplen el filtro.

### Qué mirar en el panel
- **Ámbar en "Se vinculó a"**: cambió de estado pero quedó **sin vínculo**. Es el caso a revisar.
- **"sin cambio"**: el motor lo miró y no encontró nada. No es un error, es información.

### Lo que se corrigió el 2026-08-19 y hay que verificar (A-BUG-34 / A-BUG-35)
En la primera corrida real aparecieron tres cosas mal. Al probar, mirar puntualmente:
1. **Que no aparezcan filas de fuera del filtro.** Poner *hasta 18/06* + contraparte + sólo
   pendientes, conciliar, y verificar que **no** se cuelen movimientos de julio o agosto. Antes se
   colaban porque al recargar se perdían todos los filtros de servidor.
2. **Que el orden se respete.** Las recién conciliadas tienen que quedar **en su lugar por fecha**,
   no todas juntas arriba.
3. **Que el tilde de revisado funcione** sobre esas filas. Antes no respondía: eran copias, no las
   filas de la lista.

---

## 🏦 Conciliar sueldos que el motor no encuentra ✅ *(testeado OK 2026-08-19)*

> Diagnóstico completo → `PENDIENTES.md` § A-BUG-28 / A-BUG-29. Test → § A-TEST-33.

### Qué se arregló
El motor **no encontraba pagos de sueldo que existían**, con el monto y la fecha exactos. Dos causas
que se sumaban:
- el CUIT del empleado se guarda **con guiones** (`20-28749254-6`) y el banco lo manda **sin**
  (`20287492546`), así que el filtro por CUIT nunca coincidía;
- y cuando el banco informaba un CUIT, el motor buscaba **sólo** entre las filas de ese CUIT. Si el
  empleado además tenía una **factura ARCA** cargada, esa factura ocupaba todo el espacio de búsqueda
  y el sueldo quedaba afuera.

Ahora el CUIT **prioriza pero no excluye**: se busca primero entre las filas de ese CUIT y, si ahí no
aparece, se busca en todo el Cash Flow.

### Cómo probarlo
1. Extracto Bancario → cuenta **MSA Galicia**.
2. Filtrar por estado **pendiente** y buscar los movimientos de **"Placido Andres Martinez"**
   (son los pagos de sueldo de AMS).
3. Seleccionar los **4**: `30/04 · 1.790.087,55` · `29/05 · 1.200.000` · `05/06 · 24.863` ·
   `05/06 · 239.648`.
4. Correr **Ejecutar Conciliación** (corre sólo sobre lo seleccionado).
5. **Qué tiene que pasar**:
   - `30/04` y `29/05` → **conciliado** (fecha exacta), con la categ `Sueldos` y el pago vinculado.
   - `05/06 · 24.863` y `05/06 · 239.648` → **siguen sin conciliar**, y es lo esperado: sus pagos ya
     están en estado `conciliado` en Sueldos, así que salieron del Cash Flow y no son candidatos.
     Ésos hay que resolverlos desde Sueldos.
6. **Control**: en Sueldos, los pagos del 30/04 y 29/05 tienen que quedar en `conciliado`.

⚠️ **Antes de correrlo, mirar el anticipo de 1.200.000 del 29/05.** Hoy ese pago está tomado por la
*Extracción en Autoservicio del 01/06*, que quedó en **auditar** por 3 días de diferencia. Si le das
el OK a esa primero, el pago pasa a conciliado y el movimiento del 29/05 —que es el correcto: misma
fecha, mismo monto, mismo beneficiario— se queda sin candidato.

---

## 🏦 Conciliación multiempresa 🟡 *(nuevo 2026-08-08, sin testear)*

> Diseño, reglas y huecos → `PENDIENTES.md` § A-FEAT-13 y § A-BUG-09.

### Qué cambió
- **Los candidatos al reasignar ahora son de las tres empresas.** Cada uno muestra un **chip con su
  empresa** (facturas, templates, sueldos y grupos). Si la empresa no es la de la cuenta aparece
  **⇄**: eso significa que se va a registrar como **retiro por pago a terceros** (`RET 3 PAM` /
  `RET 3 MA`), que es lo correcto cuando MSA paga algo facturado a otra empresa.
- **Las propuestas ya funcionan.** Antes buscaban al proveedor por **la primera palabra** del
  nombre — `LA MERCURE` buscaba `la` y traía de todo, y un proveedor cuya primera palabra el banco
  no escribe no aparecía nunca. Y **los ingresos no recibían ninguna propuesta**.
- **Contable e Interno sugieren los códigos ya usados** en esa cuenta, en el modal y en la edición
  masiva. Para dejar de crear variantes (`RET 3 PAM` vs `RET PAM`).
- **Ya no se pisa el vencimiento de la factura**: la fecha del movimiento se guarda en `fecha_pago`.
- El detalle **no se borra más** al reasignar, y si no hay se deriva.

### 🧪 Cómo probarlo
1. **Correr por tandas** (lo más importante antes de conciliar mucho). Poné un **filtro de fechas**
   y dale conciliar: tiene que preguntarte *"se conciliará sólo lo visible (N pendientes)"*.
   ⚠️ **El límite de 100 registros NO cuenta como filtro** — si sólo limitás la vista, corre sobre
   todo. Hay que filtrar por fecha, categoría, estado o búsqueda.
2. **Reasignar un movimiento de PAM.** Parado en el extracto de PAM, reasignar: tienen que
   aparecer **las facturas de PAM**, con su chip. Antes sólo salían las de MSA.
3. **El cruzado.** Desde el extracto de **MSA**, elegir una factura de **PAM**: el candidato tiene
   que mostrar **PAM ⇄**, y al confirmar el movimiento queda con `contable = RET 3 PAM`.
4. **Un ingreso.** Reasignar un movimiento de **crédito**: antes no ofrecía nada; ahora tiene que
   proponer candidatos. Hay 14 ingresos entre los pendientes.
5. **Los códigos sugeridos.** En Contable, empezá a escribir `RET`: tiene que desplegar los ya
   usados en esa cuenta.
6. **Que no se borre el detalle.** Reasignar un movimiento que ya tenga detalle escrito: **tiene
   que conservarlo**. Si estaba vacío, ahora se completa solo (`FC 1234 — Proveedor`).
7. **El vencimiento.** Conciliar una factura que tenga vencimiento cargado y verificar en Egresos
   que **el vencimiento no cambió** y que la fecha del banco quedó en *Fecha de Pago*.

### ⚠️ Lo que se sabe que todavía no anda
- **Las acreditaciones de haberes no van a conciliar solas**: el banco debita el total y el sistema
  tiene los pagos uno por uno. Hay que **agruparlos** primero.
- **Los echeq con más de 5 días** entre emisión y débito quedan fuera de la ventana del motor.
- **`pam_galicia` no tiene ninguna regla** (ni de imputación ni de texto): se concilia a mano.
- Si no hay regla y las empresas difieren, **el movimiento queda conciliado sin `contable`, sin avisar**.

---

## 🏢 Cash Flow multiempresa 🟡 *(nuevo 2026-08-08, sin testear)*

> Diseño y motivos → `PENDIENTES.md` § A-FEAT-13.

Hasta ahora el Cash Flow mostraba **templates de las tres empresas** pero **facturas sólo de MSA**.
Por eso no había forma de registrar que pagaste una factura de PAM: la fila no existía. Ahora
aparecen las de las tres.

### La barra de empresas
Arriba de la grilla, **siempre visible** (no está dentro de "Filtros"). Son **dos** selecciones
separadas, con defaults distintos a propósito:

| | MSA | PAM | MA | Por qué |
|---|---|---|---|---|
| **Facturas** | ✅ | ✅ | ☐ | Las de MA las paga MA de su cuenta y conciliás cada tanto: por default serían 92 filas de ruido |
| **Templates y demás** | ✅ | ✅ | ✅ | Son impuestos que pagás vos siempre; no verlos es perder trabajo |

Se aplican al toque, sin apretar nada. **Limpiar filtros vuelve a estos defaults**, no a "mostrar
todo" — ver las 92 facturas de MA no es el estado limpio.

### La columna Empresa
Primera de la grilla, con un color por empresa. Una fila puede tener **varias** (ej. `MSA/PAM`) y
entonces **aparece al filtrar cualquiera de ellas**. Si tildás sólo MA, no aparece.

El template de la cochera muestra `PAM/MA/Duhau`: `Duhau` no es una empresa, se muestra para no
perder el dato pero no filtra por él.

### Lo que NO se ofrece en PAM ni MA
- **SICORE** — no corresponde a esas empresas. Una FC de PAM pasa a *pagar* **derecho**, sin
  pantalla de retención y sin exigirte la Fecha de Pago (esa exigencia existía sólo porque de ahí
  salía la quincena SICORE). Si es en dólares, **sí** te sigue preguntando el tipo de cambio.
- **ECHEQ** — avisa que es sólo de MSA y no toca nada (`msa.cheques` no tiene equivalente).
- **Agrupar pagos** sí funciona en las tres desde el 2026-08-08; lo único que no se puede es
  **mezclar empresas en un mismo grupo**.

### 🧪 Cómo probarlo
1. **Abrí Cash Flow.** Tiene que aparecer la barra de empresas arriba y la columna **Empresa**
   como primera columna de la grilla.
2. **Mirá los defaults.** Facturas: MSA y PAM encendidas, **MA apagada**. Templates: las tres.
   Buscá una fila de factura de **PAM** — hay 4. **No** tenés que ver facturas de MA.
3. **Tildá MA en Facturas.** Deberían aparecer ~92 facturas más. Destildala y tienen que irse.
4. ⚠️ **El paso que importa: pagá una factura de PAM.** Cambiala a *pagar*. Esperado: **no**
   aparece la pantalla de SICORE, y avisa *"Factura de PAM marcada para pagar (sin SICORE)"*.
   **Después recargá la pantalla y verificá que siguió en `pagar`.** Si volvió a `pendiente`, la
   escritura fue al schema equivocado — es el error que este cambio vino a arreglar.
5. **Bloqueo de ECHEQ.** Con una FC de PAM seleccionada, intentá **ECHEQ**: tiene que avisar que
   es sólo de MSA y **no cambiar nada**.
6. ⚠️ **El caso real: agrupar las 2 de Allende** (las pagaste juntas en un solo pago).
   **Ctrl+Click en Pagos** para entrar al modo PAGOS, tildá las dos FC de ALLENDE y **🔗 Agrupar**. Esperado: quedan como **una sola fila** con los dos
   comprobantes en el detalle y el total sumado ($150.295 + $832.970 = **$983.265**). Después
   marcala como pagada y verificá que el estado quedó en **las dos** facturas. Después tildá
   **sólo esa fila agrupada**: el botón tiene que cambiar a **✕ Desagrupar (2)**. Deshacela y
   verificá que vuelven a ser dos filas.
7. **No se pueden mezclar empresas.** Seleccioná una FC de PAM y una de MSA e intentá agrupar:
   tiene que avisar que un grupo de pago vive en una sola empresa.
8. **Que MSA no se haya roto.** Pagá una FC de **MSA** como siempre: la pantalla de SICORE tiene
   que aparecer igual que antes, y seguir exigiendo la Fecha de Pago.
9. **Multiempresa.** En Templates dejá tildado sólo **MSA**: el template *Retiro MA mensual*
   (`MSA/PAM`) tiene que seguir apareciendo. Dejá sólo **MA**: tiene que desaparecer.
10. **Sueldos de Alondra** (estaba mal cargada como PAM, ahora es **MA**). Su sueldo tiene que
   mostrar el chip **MA**, y responde al selector de **Templates y demás**, *no* al de Facturas:
   con MA apagada en Facturas se sigue viendo; se esconde sólo si destildás MA en Templates.
11. **Anticipo sin empresa.** Cargá un anticipo sin elegir empresa: tiene que avisar y pedirte
   confirmación. Guardalo así y verificá que en el Cash Flow aparece con `—` y **se ve con
   cualquier filtro de empresa**.

### Agrupar y desagrupar pagos
Ya funciona en las tres empresas. La única restricción es que **un grupo no puede mezclar
empresas**: el grupo y sus facturas viven en la misma, así que juntar una FC de PAM con una de MSA
se rechaza con un aviso.

**Cómo se llega** (no es obvio y conviene tenerlo escrito):
1. **Ctrl+Click** en el botón **Pagos** (arriba a la derecha). Con clic normal no pasa nada: el
   modo PAGOS se activa sólo con Ctrl.
2. Aparecen los **checkboxes** por fila y una barra de acciones.
3. Tildá **2 o más** filas del mismo proveedor → se habilita **🔗 Agrupar**.

**Para deshacer un grupo**, dos caminos:
- Tildá **una sola** fila agrupada: el botón **🔗 Agrupar** se transforma en **✕ Desagrupar (N)**,
  con N = cuántos comprobantes tiene el grupo.
- O la **✕ roja** que aparece dentro de la columna **Detalle** de la fila agrupada, al lado del 🔗.

Los dos piden confirmación y devuelven las facturas a filas individuales.

Los **templates** son la excepción a tener en cuenta: aunque el template sea de PAM, su grupo se
guarda siempre del lado de MSA. Es una cuestión interna y no cambia nada de lo que ves.

### Anticipos: de qué empresa salen
Al cargar un anticipo ahora elegís la **empresa**. Arranca **sin elegir a propósito** — no se
hereda en silencio. Podés guardarlo vacío, pero te pide confirmación, porque **vacío no significa
"es de MSA": significa "todavía no se sabe"**. Esos anticipos se muestran con `—` en la columna
Empresa y **aparecen con cualquier filtro**, para que no se pierdan de vista hasta que se resuelva.

Se resuelve solo cuando vinculás el anticipo con su factura: ahí queda claro de qué empresa era.
Hoy hay **15 anticipos así** (los que nunca se vincularon).

### ⚠️ Lo que todavía no anda
- **La conciliación manual desde el extracto** sigue ofreciendo sólo facturas de MSA: si tenés que
  vincular a mano un movimiento de PAM con su factura, no la vas a encontrar. La conciliación
  **automática** (el motor) sí funciona.
- **Los honorarios de JMS y AMS** (2 de las 4 facturas de PAM, $22,7 M y $25,5 M) van a quedar
  eternamente pendientes en el Cash Flow: son facturas de cuenta corriente que se cancelan contra
  muchos pagos, no algo a pagar de una vez. Sin resolver — ver § A-FEAT-13-C.

---

## 🏢 Ficha de proveedor 🟡 *(nuevo 2026-08-07, sin testear)*

> Diseño completo del maestro de proveedores → **`MODULO_PROVEEDORES.md`**

Es la pantalla para **mirar** un proveedor: quién es, cómo se le paga, qué facturó y qué se le pagó.
Es un modal a propósito — la consulta suele ser en medio de otra cosa y te devuelve donde estabas.

### ➕ Dar de alta un proveedor 🟡 *(nuevo 2026-08-31, sin testear — [A-TEST-78](PENDIENTES.md#a-test-78))*

Dos caminos, y el segundo es el que vas a usar sin pensarlo:
- Botón **“+ Nuevo”**, al lado del buscador.
- Buscás y no aparece → sale **“+ Dar de alta «lo que tipeaste»”**, con el dato ya cargado.

Pedís **CUIT y razón social**, elegís si es *proveedor* o *cliente*, y al confirmar **se abre su
ficha** — que es donde vas a cargarle el **CBU y el mail**, que es para lo que lo estabas creando.

> **El CUIT es obligatorio.** Es por donde lo encuentran la conciliación, el pre-filtro del motor y
> la ficha: una fila sin CUIT no la encuentra nadie y hay que borrarla después. *(Hay 2 anticipos
> viejos con el CUIT trucho `11111111111` que no sirven para ningún match — de ahí la regla.)*

> **Si el CUIT ya existe, no se pisa nada.** Sólo se le marca el tipo que le faltara (alguien puede
> ser cliente y proveedor a la vez). El nombre que tipeaste **no reemplaza** la razón social que vino
> de ARCA.

**Y desde el alta de un anticipo se da de alta solo.** Si cargás un anticipo con un CUIT que no está
en el maestro, el proveedor **se crea automáticamente** y te avisa. Si el anticipo no tiene CUIT, se
guarda igual pero **te avisa que la contraparte quedó sin dar de alta** — ahí la cargás desde acá.

⚠️ **Hasta el 2026-08-31 esto no existía**: un proveedor sólo nacía al importar una factura de ARCA.
El botón *"Cargar nuevo proveedor"* de los formularios escribía el nombre en el formulario **y nada
más**. Por eso puede haber proveedores viejos con anticipos y sin ficha — si te encontrás uno sin CBU
ni mail, es esto.

### Los dos accesos
1. **Principal → botón "Proveedores"**, al lado del de IPC. Abre el buscador con los 154. Es el
   acceso general, el que vas a usar casi siempre.
2. **Presupuesto → "Subas de proveedores" → ícono 🏢 en una fila.** Abre **directo** la ficha de
   *ese* proveedor, sin pasar por el buscador.

   *Por qué ahí*: "Subas de proveedores" es el panel que responde **quién nos está aumentando por
   encima del IPC** (botón arriba a la derecha de la solapa Presupuesto, ver su sección más abajo).
   Cuando uno salta en rojo, la pregunta que sigue es siempre *"¿y quién es este, qué le compramos,
   qué le pagamos?"*. El ícono 🏢 —que está pegadito al nombre del proveedor, entre el nombre y la
   etiqueta de color— contesta eso sin sacarte del análisis.

   Ojo con la diferencia: **clic en la fila** despliega la serie mes a mes de ese proveedor;
   **clic en el 🏢** abre la ficha. Son dos cosas distintas sobre la misma fila.

### Qué muestra
- **Cuatro números arriba**: compras, ventas, pagos y anticipos sin aplicar.
- **Los datos del maestro**, en cuatro bloques: *Identidad* (razón social, nombre conocido, si es
  proveedor y/o cliente), *Datos bancarios* (CBU, alias, banco, mensaje de transferencia),
  *Contacto* (los dos mails, teléfono, tags, notas) y *Búsqueda de PDFs* (lo mismo que Config PDFs).
- **Últimas facturas** — compras de MSA, PAM y MA, y las ventas de MSA con etiqueta verde `venta`.
- **Últimos pagos** — movimientos del extracto, con **cómo se supo que son de este proveedor**.
- **Anticipos**, si tiene.

### Cómo leer la columna "Vínculo" de los pagos
Cada pago dice por dónde se lo relacionó: *por factura*, *por template*, *por anticipo* o
**sólo por nombre**. Los tres primeros son un vínculo real escrito por la conciliación. El cuarto
es un movimiento que tiene el nombre del proveedor cargado pero **ningún comprobante vinculado**:
está para que lo veas, no como certeza.

### Lo que la ficha todavía NO ve
Los pagos salen de los **extractos bancarios** (Galicia MSA y PAM), porque el pago queda registrado
recién al conciliar el movimiento — la fecha de pago de la factura casi nunca está cargada
(12 de 384). Entonces **no** aparecen los pagos por **caja, cheque o tarjeta**, ni los **cobros**
de una venta (de una venta se ve su estado, no cuándo se cobró).

### Editar
Se entra en **lectura**. El botón **Editar** convierte los cuatro bloques en campos; **Guardar**
escribe. Los tags van separados por coma. Se puede editar todo el maestro, incluida la razón social
y el activo/inactivo.

### 🧪 Cómo probarlo
1. **Principal → Proveedores.** Tiene que abrir el buscador con los 154 proveedores. Escribí
   `federacion` sin tilde: **tiene que quedar sólo** «FEDERACIÓN PATRONAL» (el buscador ignora
   tildes). Probá también `337`: filtra por CUIT. *(Acá hubo un bug — el buscador no filtraba
   nada — corregido el 2026-08-07, ver el dossier.)*
2. **Entrá a FEDERACIÓN PATRONAL SEGUROS.** Esperado: **12 facturas** de compra y **9 pagos**, todos
   marcados *por template* — a este proveedor se le paga por template, no contra factura.
3. **Volvé con "Todos" y entrá a SMART FARMING.** Esperado: **8 facturas** y **5 pagos**, marcados
   *por factura*. El primer pago (09/06/2026, $25.161,95) debe decir que paga la **FC 1190**.
4. **Buscá Sanpa Semillas** (es cliente puro). Esperado: badge `cliente`, **una venta** de
   $95.715.830,32 con etiqueta verde, **0 compras** y **0 pagos** — los cobros todavía no se ven,
   y el aviso ámbar debajo de los pagos tiene que estar diciéndolo.
5. **Desde el otro acceso:** *Presupuesto → Subas de proveedores* → ícono 🏢 en una fila. Tiene que
   abrir **esa** ficha directamente, y **no** debe desplegar la serie mes a mes de la fila (el clic
   no se propaga).
6. **Editar (lo único sin probar).** Entrá a un proveedor, **Editar**, escribí algo en **Notas**,
   **Guardar**. Cerrá y volvé a abrir: la nota tiene que seguir ahí. Recién si eso anda, probá un
   campo que importe. ⚠️ Empezá por `notas` a propósito: el guardado nunca se ejecutó, y ahora se
   pueden editar campos que ninguna pantalla tocaba antes — `razon_social` es el nombre del que
   dependen los pagos y los mails aguas abajo.

---

## 📈 Presupuesto → Subas de proveedores 🟡 *(nuevo 2026-07-30, sin testear)*

> Botón **"Subas de proveedores"** arriba a la derecha del Presupuesto. Exporta **Excel** y **PDF**.

Responde una pregunta: **¿quién nos está aumentando por encima de la inflación?** Mira a todos
los que facturan mes a mes, no de a uno, porque el que se pasa no avisa.

Por cada proveedor: cuánto subió de punta a punta, el equivalente mensual, el **IPC acumulado del
mismo período** y la **brecha** en puntos. Verde en línea, ámbar por encima, rojo muy por encima.
Clic en el proveedor y ves la serie mes a mes con la variación contra el IPC de cada mes.

### Por qué no dice simplemente "subió de X a Y"
Porque **el monto de una factura mezcla precio y cantidad**. Autopistas figura +160 % y no
aumentó nada: se viajó más. Alcorta +690 % porque se compró más veterinaria.

Entonces la herramienta mide **primero contra último** (no el mínimo contra el máximo, que agarra
dos meses cualesquiera) y cuenta **cuántas veces bajó**: un abono sube en escalones y casi nunca
baja, un consumo rebota. A los que rebotan los marca *"varía por consumo"* y **no** los compara
con el IPC — el número está, pero no significa un aumento. Los podés esconder con el tilde
*"sólo los de precio"*.

### Hace falta cargar el IPC
Hoy no hay IPC cargado, así que ves cuánto subió cada uno pero no contra qué compararlo. Se carga
en **Precios y TC**, columna IPC: la **variación mensual en %**.

Si a algún mes del período le falta el IPC, esa comparación queda en blanco en vez de mostrar un
número. Es a propósito: un acumulado al que le faltan meses queda corto y haría ver a *todos* por
encima de la inflación.

### El mes en curso no entra
Está a medio facturar, y justo es la punta que define la suba.

---

## 📒 Presupuesto → Cuentas contables 🟡 *(nuevo 2026-07-30, sin testear)*

> Botón **"Cuentas contables"** arriba a la derecha del Presupuesto.

Presupuesta lo que viene **por factura**, cuenta por cuenta. Cada una se calcula con el **modo**
que mejor le va, y el modo se cambia cuando querés.

### De dónde salen los datos: Facturas o Canales
Arriba hay un selector. Son dos maneras legítimas de mirar lo mismo:

- **Facturas** — lo que llegó con comprobante, con la cuenta imputada. Es lo que conviene hoy.
- **Canales de pago** — banco, caja y tarjeta conciliados, cada movimiento con su cuenta.
  Cobertura total (entra el gasto sin factura) y fecha de pago, que es la del flujo de caja.

Al elegir *Canales* la pantalla te dice **qué porcentaje está conciliado**. Si está bajo, esa
vista muestra menos de lo que se gastó y conviene volver a Facturas. Hoy el banco está en 16 %,
la caja en 0 % y la tarjeta en 2 %.

### Los modos

| Modo | Qué hace | Cuándo conviene |
|---|---|---|
| **Propagar última factura** | Repite la última factura conocida | Un proveedor, monto parejo — *Asesor ganadero* sube en escalones y el promedio quedaría siempre atrasado |
| **Promedio últimos N meses** | Promedia una ventana (default 3) | Cuentas variadas — *Repuestos* tiene 21 proveedores |
| **Mismo mes del año anterior** | Toma el año pasado + inflación | Lo estacional. Necesita 12 meses; hoy casi no hay |
| **Por cabeza** | $/cabeza histórico × cabezas proyectadas | Veterinaria y sanidad, que siguen al rodeo |
| **Monto fijo a mano** | Lo que vos pongas | Sin historia |
| **No presupuestar** | Cero, y dice por qué | Lo que ya entra por Actividades y costos |

Si no elegiste nada, la cuenta usa una **sugerencia automática** (badge punteado con *auto*).
Se decide mirando cómo se comportó: cuántos proveedores tiene, cuánto varía y cuántos meses de
historia hay.

### Ver de dónde salió un número
**Clic en la cuenta** y se abre: la explicación del cálculo en castellano, el selector de modo
con sus parámetros, y **los meses reales** que gastó, para comparar. Las notas de crédito
aparecen en rojo. También podés pasar el mouse por cualquier celda y ver la explicación.

El gris de la celda indica la confianza: cuanto más claro, menos datos hay detrás.

### La inflación
Si hay **IPC cargado** (en Precios y TC), la propagación lo usa mes a mes y **arrastra el último
valor**: cargás escalones —seis meses a un ritmo, seis a otro— y no tenés que repetir el mismo
número doce veces. La tasa fija de arriba sólo se usa donde no hay IPC, y cada cuenta puede pisar
las dos con la suya.

### De qué se compone una cuenta
Al abrir una cuenta ves **sus proveedores**: cuánto facturó cada uno, en cuántos meses y con
cuántas facturas. Eso es lo que decide qué modo le conviene — un proveedor con factura mensual
pide *propagar la última*, veinte proveedores piden *promedio*.

Cada proveedor tiene un tilde. **Destildarlo lo saca del presupuesto de esa cuenta**, sin anular
la cuenta. Sirve cuando algo ya entra por otro lado: Federación Patronal factura semestral pero
se paga en cuotas cargadas como template, así que se destilda acá y se presupuesta allá.

Es importante que sea por proveedor y no por cuenta: si mañana entra otra aseguradora a *Seguros
estructura*, se presupuesta sola. Anulando la cuenta entera habría desaparecido sin aviso.

### El control de arriba
Compara lo presupuestado contra los **últimos 6 meses cerrados** y avisa de tres cosas:
el total se despegó de la realidad · una cuenta que siempre gastó quedó en cero · una cuenta se
disparó respecto de su historia. No busca precisión: busca que **no se escape nada grande**.

### Dos detalles del cálculo
- **El mes en curso no se usa nunca.** Está a medio facturar y arrastraría todo para abajo.
- **Un mes sin factura cuenta como cero.** *Luz* no facturó en febrero y facturó doble en marzo:
  la factura se corrió, no desapareció el gasto. Por eso el promedio divide por los meses de la
  ventana y no por los que tienen factura.

### Lo que no entra acá
Agroquímicos, siembra, cosecha, maíz, rollos y el verdeo salen como **No presupuestar**: ya se
presupuestan en *Actividades y costos*. Si entraran por los dos lados se contarían dos veces.
Veterinaria **sí** entra, porque no hay módulo de insumos para cría.

---

## 🏷️ Al crear un template: la categoría

La `categ` del template es lo que lo conecta con el plan de cuentas, y de ahí salen dos cosas:
**si se presupuesta** (lo `financiero` no) y **dónde aparece** en el reporte.

Por eso, al crear un template, usá una categoría **que ya exista en Cuentas contables**. Si
inventás una nueva, el template queda "sin clasificar": se asume gasto y no tiene ubicación.
El panel *Cuentas contables → Cómo se completan los templates* te marca cuáles están así.

⚠️ **No renombres una categoría existente por tu cuenta.** El nombre está copiado en el extracto
bancario, en las reglas de conciliación y en el plan de cuentas: renombrar en un solo lado
desconecta las otras tres. Si hace falta cambiar un nombre, avisame y se hace de una vez en
todos lados.

---

## 🧾 Templates → activar y desactivar

En la grilla de templates, con el **Modo Edición** prendido, la columna **Activo** se cambia con
un clic. Pregunta antes, porque **afecta al template entero**, no a una cuota.

Desactivar **no borra nada**: el template deja de aparecer en el Presupuesto y en el Cash Flow,
y sus cuotas quedan tal cual. Si lo reactivás, vuelve con todo lo que tenía.

Sirve para el caso típico: un template que se reemplazó por otro (el retiro semestral que pasó a
mensual) y conviene guardar sin que ensucie las proyecciones.

---

## 📊 Presupuesto → leer la grilla

### Cómo está ordenada *(cambió 2026-07-31, sin testear)*

La grilla usa **las mismas secciones que el Dashboard**, en el mismo orden y con los mismos
colores, para poder comparar las dos pantallas mes a mes sin traducir nada:

```
INGRESOS          arrendamientos · ganadería · hacienda
EGRESOS (rojo)    templates ▶ · Sueldos · Cuentas contables · Costos de producción · IIBB
                  Subtotal egresos
DISTRIBUCIONES    Retiros / Distribución Socios ▶
  (violeta)       Subtotal distribuciones
──────────────────────────────────────────────
TOTAL EGRESOS MSA (incluye distribuciones)
RESULTADO
SALDO ACUMULADO
```

**Por qué los retiros van aparte pero igual suman.** El presupuesto es **de caja**: cuando
retirás plata, sale. Por eso el retiro entra en el TOTAL igual que un gasto. Pero **no es gasto
operativo**, y mezclarlo te impide contestar la pregunta que importa: *¿cuánto me cuesta la
empresa y cuánto estamos repartiendo?* Con las dos secciones separadas lo leés directo.

En qué sección cae cada template lo decide su campo **Tipo** (ver *Renovar Campaña → El campo
Tipo*). Si cambiás el Tipo de un template, cambia de sección.

### Qué bloques suman
Dentro de EGRESOS: **templates** (sus cuotas), **sueldos**, **cuentas contables** (lo que llega
por factura), **costos de producción** (derivados de las actividades del lote) e **IIBB**.
Ninguno se pisa con otro: las cuentas de producción salen excluidas porque ya entran por
Actividades, y Federación Patronal se descuenta de su cuenta porque va por template.

Cada bloque se abre con el ▶ y se puede ver su detalle.

### Pagar anual o en cuotas: el interruptor es **activo**

Varios impuestos tienen **dos templates**: uno "Anual" y uno "Cuota" (inmobiliario, red vial,
automotores, ABL). No son un duplicado — son las dos formas de pagar lo mismo, y **el que manda
es el que está activo**.

**Prendé uno y apagá el otro.** El presupuesto sólo lee los activos, así que nunca cuenta las dos
versiones. Ejemplo real de Lote Puerto, donde cada impuesto va distinto:

| | Anual | Cuota |
|---|---|---|
| Inmobiliario Lote Puerto | ✅ activo | ❌ inactivo |
| Red Vial Lote Puerto | ❌ inactivo | ✅ activo |

Las cuotas viejas del template apagado **quedan guardadas** (son historia), simplemente no
suman. Si el año que viene cambiás de forma de pago, das vuelta el interruptor y listo.

⚠️ Lo único que hay que cuidar: **que no queden los dos prendidos**. Ahí sí duplicaría.

### Templates: cuota cargada vs proyectada
Donde hay **cuota cargada** el presupuesto la usa tal cual. Donde no la hay, **proyecta** desde
el mismo mes del año pasado (o la última cuota) más IPC, y lo muestra **en cursiva** para que no
se confunda con un dato firme.

La proyección respeta **en qué meses paga cada template**: un inmobiliario que paga cinco cuotas
al año sigue pagando cinco, no doce.

**De dónde sale eso**: del campo `cuotas` que ya tiene cargado el template (cuántos pagos al año).
12 → todos los meses · 1 a 11 → esas cuotas, en los meses que muestra la historia · 0 o "abierto"
→ promedio mensual, porque no tiene calendario fijo.

Al lado del nombre de cada template ves el método usado, en gris si se heredó y en azul si lo
elegiste vos. **Se cambia** en el panel *Cuentas contables*, sección "Cómo se completan los
templates": ahí ves cuántas cuotas declara, cuántas tiene cargadas, cuánto proyecta y por cuánta
plata, ordenado de mayor a menor. El ✨ vuelve al automático.

### Lo que no es gasto no se presupuesta
Queda en cero todo lo que el **plan de cuentas** marca como `financiero`: el FCI (es una
colocación que rescatás cuando querés), la caja y las interbancarias (plata que cambia de
bolsillo) y el **pago de la tarjeta** (los gastos ya entran por su cuenta contable, sumar el
resumen los contaría dos veces).

Los **retiros de socios sí se presupuestan**: esa plata sale de verdad.

El criterio sale de la columna *Tipo* del panel, no de cómo se llame la agrupadora. Si un
template dice **"sin clasificar"** es que su categoría no existe en el plan de cuentas: se asume
gasto, y conviene darla de alta. Si igual querés presupuestar algo financiero, ponele el método
a mano.

### Los gastos bancarios
Las comisiones e impuestos bancarios nunca se cargan por adelantado, se llenan durante el mes.
Por eso van por **promedio de lo histórico**, que es lo correcto para ellos. No hace falta tocar
nada.

Si un template **declara más cuotas de las que tiene cargadas** (Cargas Sociales declara 12 y
hay 6), aparece un ⚠: el presupuesto proyecta las conocidas, así que puede estar corto.

Si el template es de los que **cargás a mano** porque te recuerda un compromiso de pago (Cargas
Sociales, SICORE, UATRE, Ganancias…), además aparece un **aviso ámbar arriba** diciendo cuántos
faltan generar, en cuántos meses y cuánta plata. La celda lleva un `◦`. El resto se proyecta en
silencio: no hace falta cargarlos.

### Saldo acumulado
Abajo de todo, después de RESULTADO, está el **SALDO ACUMULADO**: arrastra el resultado de cada
mes desde un saldo de arranque. El resultado mensual solo no dice si la caja alcanza — un mes malo
después de varios buenos no es lo mismo que ese mes con la caja en cero.

El **saldo de arranque se carga a mano** (link *"arranca en $X — editar"* en la misma fila). Por
ahora es así a propósito; más adelante saldrá de los saldos bancarios reales.

Los meses **anteriores** al mes del saldo muestran `—`: no se puede acumular hacia atrás desde un
saldo que corresponde a otro momento. Si ves guiones al principio de la grilla, el saldo quedó
viejo y hay que recargarlo.

### Presupuestar una venta de hacienda sin salir
Las celdas ámbar de **cabezas disponibles** (subrayadas de punteado) se clickean: se abre un
formulario chico con cuántas, cuándo, a cuánto y el plazo, y al guardar **la celda se convierte
en plata**. El desbaste, la comisión y el precio salen de la tabla según el peso, y se ve el
desglose hasta lo que ingresa.

Es a propósito el formulario mínimo. Para retener los animales y que engorden —o para ajustar
desbaste, ganancia diaria o tramos de actividad— vas a Productivo → Evolución Rodeo y editás el
mismo lote.

Las **vacas de refugo** aparecen acá igual que el destete: son cabezas que salen del rodeo y se
venden.

### IIBB
Un solo renglón **IIBB total**, que se abre en sus orígenes: venta de hacienda, arrendamiento
(5 % de la venta) y ganadería. Todos caen el **mes siguiente al cobro**.

Ninguno se registra en un template: son **derivados de la venta**. Si cambia la venta, cambia el
IIBB solo.

### Sub-agrupación de templates
Los agrupadores que mezclan cosas distintas se abren en un nivel más. *Impuestos Rurales* ahora
separa los 11 inmobiliarios de los 10 de red vial en vez de tirar 22 renglones juntos.

Se usa la **categoría que el template ya tiene** — no hay nada nuevo que cargar. Y sólo se
sub-agrupa donde ordena algo: si cada template tiene su propia categoría (como *Gastos
Bancarios*), queda plano, porque anidar ahí sería un clic de más para ver lo mismo.

---

## 🌾 Presupuesto → Actividades y costos 🟡 *(nuevo 2026-07-30, sin testear)*

> Botón **"Actividades y costos"** arriba a la derecha del Presupuesto, al lado de "Precios y TC".

Acá se dejan asentados **los parámetros de cada actividad** (recría, engorde, y las que vengan).
La idea es no volver a tipear kilos nunca: cargás la actividad una vez y después alcanza con
decir *"este lote hace recría del 1/4 al 30/9"* para que salgan solos el consumo, el costo y la
curva de peso.

**El costo directo no se registra en ningún lado.** No es un template ni una factura esperada:
es una **consecuencia** de la actividad que decidís hacer. Cambiás la actividad y cambia el costo
solo. Por eso no lo vas a encontrar en Egresos.

### Cada actividad tiene dos cosas

**Los rindes** — ganancia diaria (kg/día), ración como % del peso vivo, mortandad.
La ganancia diaria es la misma que usa la venta para calcular el peso, así que el animal que
facturás y el que alimentás son el mismo.

**Los costos directos** — una lista de conceptos que armás vos. Recría son dos renglones (maíz y
concentrado); otra actividad tendrá los suyos. Cada concepto dice **cómo escala**:

| Cómo escala | Cuándo usarlo |
|---|---|
| **% de la ración** | maíz 85 %, concentrado 15 % — lo normal |
| **kg / cabeza / día** | un suplemento aparte de la ración |
| **unid. / cabeza / mes** | sal, minerales |
| **unid. / cabeza (evento)** | una vacuna, una vez |
| **dosis cada N kg** | antiparasitario que se dosifica por peso |
| **por cabeza · por hectárea · por mes** | flete · **verdeo** · alquiler de campo |
| **% de lo producido** | cosecha, aparcería — sale del valor de la producción, no de una cantidad |

El verdeo es el único que **no** escala con cabezas sino con hectáreas: es un costo por
superficie que después aprovecha la hacienda que la pastorea.

**Cuándo** ubica el gasto dentro del período: *todos los días* · *todos los meses* · *al empezar*
· *al terminar* · **en el ciclo**. Cada modo trae el suyo por defecto y lo podés cambiar.

*En el ciclo* es para lo que se piensa como un total del cultivo — *"tantos dólares por hectárea
en el ciclo de la soja"*. Hoy se reparte parejo por días: **el total del ciclo queda bien, el mes
a mes es aproximado**, porque un cultivo gasta en picos (siembra, cosecha). Si necesitás el mes
exacto, partilo en varios conceptos con *al empezar* / *al terminar*.

### Pesos o dólares
Cada concepto tiene su **moneda**. En US$ el monto se pasa a pesos con el **TC presupuestado del
mes de ese gasto** (el de Precios y TC, que arrastra el último cargado). Un ciclo largo puede usar
varios TC distintos — pasá el mouse por la celda para ver cuál se aplicó. Si a un mes le falta el
TC, ese monto da $0 y la pantalla te avisa.

### Actividades agrícolas
Poné el tipo en **agricola** y desaparecen ración y ganancia diaria, que no aplican. Los conceptos
nuevos arrancan por hectárea, en el ciclo y en US$.

### Asignarle la actividad a un lote
En **Productivo → Evolución Rodeo → editar un lote** hay un bloque violeta *"Actividades del
lote"*. Ahí decís *"recría del 1/4 al 1/10, engorde del 1/10 al 1/1"* y de eso salen **dos cosas
a la vez**: el peso a la venta y el costo de alimentación.

**El peso deja de crecer en línea recta.** Si la recría gana 0,5 kg/día y el engorde 0,7, el
animal no engorda parejo — y el bloque te muestra la curva por tramo:

```
Recría    183 días × 0,5 kg     220,0 → 311,5 kg
Engorde    92 días × 0,7 kg     311,5 → 375,9 kg
```

Con la ganancia suelta del lote (0,3 kg/día) ese mismo animal daba 302 kg. Son 73 kg de
diferencia por cabeza, y como **el peso define la banda de precio**, cambia también el $/kg.

- Los días **sin actividad asignada** aparecen en ámbar y usan la ganancia diaria del lote.
- Si dos tramos **se pisan**, te avisa: el peso sale igual pero el costo contaría los dos.
- El checkbox **"usar la ganancia diaria de arriba"** ignora las actividades y vuelve a la recta.
  Es la salida de emergencia cuando sabés algo que el sistema no.

El costo de alimentación del lote aparece abajo de la curva, total y por cabeza.

### El simulador
Abajo de cada actividad, **"Simular cómo cae el gasto en el tiempo"**. Ponés cabezas, peso
inicial y fechas y ves el reparto mes a mes.

**Sólo muestra: no guarda nada y no crea ningún tramo.** Es un tablero de prueba para chequear
que los parámetros estén bien cargados. Lo que se plasma en el presupuesto son los tramos que le
asignás al lote (Productivo → Evolución Rodeo).

Las fechas arrancan **vacías** a propósito: podés estar presupuestando la campaña que viene, así
que no se asume que el período empieza hoy.

Vas a ver que **el consumo sube mes a mes**, y está bien: la ración es un % del peso vivo y el
animal engorda. 200 cabezas de 220 kg pasan de ~580 kg de maíz por día en abril a ~775 en
septiembre.

### Ojo
- Los **"% de la ración" deberían sumar 100 %**; si no, la pantalla te lo avisa abajo de la tabla.
- Los valores que vienen cargados son los **defaults del análisis de engorde** (0,5 y 0,7 kg/día ·
  1,5 % PV · maíz 70 · concentrado 45). Son un punto de partida: ajustalos con datos reales.

---

## 🐮 Módulo: Evolución del rodeo (Productivo → Evolución Rodeo) 🟡 (nuevo, sin testear)

> El presupuesto de ganadería necesita saber **cuántas cabezas va a haber**. Esta pantalla
> proyecta el rodeo de cría año a año, y de ahí salen las ventas.
> Modelo: solapa "ciclo ganadero" del Excel. Detalle → `PENDIENTES.md` § CICLO GANADERO.

### El calendario — leerlo bien es la mitad del asunto

La campaña es la **comercial julio–junio**, igual que en el resto de la app. Con ese calendario
cada campaña contiene **un servicio y un destete**:

```
campaña 25/26 (jul-25 → jun-26):  servicio oct-2025  ·  destete mar-2026
campaña 26/27 (jul-26 → jun-27):  servicio oct-2026  ·  destete mar-2027
```

⚠️ **El destete que ocurre en una campaña es el producto del servicio de la campaña anterior**
(pasan 16 meses entre uno y otro). Por eso el `% Destete` se mide contra el rodeo del período
previo. Es el único corrimiento del modelo; el stock encadena limpio.

### Las fórmulas
```
rodeo            = vacas + vaquillonas de reposición        ← la "base entorada"
destete          = rodeo del período ANTERIOR × %destete    → se parte por %machos
no destetaron    = rodeo anterior − destetados              ← la merma
refugo+mortandad = falladas × %descarte  (default 80)       → parte va a venta, parte muere
retenidas        = rodeo × %reposición   (default 20)       ← sobre la BASE ENTORADA
─────────────────────────────────────────────────────────
vacas(N+1)       = vacas + vaquillonas − refugo             ← las vaquillonas paren y pasan a vaca
vaquillonas(N+1) = retenidas
```
**El cierre de un período es la apertura del siguiente.** Si no coinciden, falta un dato.

### Cómo arrancar (una sola vez)
1. **Proponer desde Productivo** — trae los ciclos reales de `ciclos_cria`. Cada registro se
   reparte entre **dos campañas**: el servicio abre una, y su destete ocurre en la siguiente.
2. El **primer período va a quedar cojo**: su destete viene de un ciclo anterior al más viejo
   cargado. Cargale el refugo y la reposición a mano (salen por diferencia contra el rodeo
   siguiente).
3. **Agregar período** para los futuros: escribí sólo la campaña y **dejá la apertura vacía**.
   Hereda del cierre anterior — los campos te muestran cuánto va a heredar.

### Cómo se opera después
- **Todo es editable.** Lo que cargues como **real** pisa el cálculo y recalcula hacia adelante.
- **% o cabezas, lo que te salga**: en refugo y en reposición podés escribir cualquiera de los
  dos y el otro se completa. La diferencia importa: el **%** escala si cambia el rodeo, las
  **cabezas** son un número firme. Un link *"volver al %"* suelta el número fijo.
- Los porcentajes se muestran **sobre el rodeo**, que es el dato que se lee
  (`refugo 12% · reposición 20% → el rodeo crece`). El % sobre las falladas es sólo la mecánica.
- Las fechas salen de la campaña: `serv. oct 2025`, `dest. feb 2026 ✓` (el tilde = fecha real).

### Los avisos
| Aviso | Qué significa |
|---|---|
| **hoy marcadas 45** | la reposición presupuestada no coincide con las hembras marcadas en Productivo |
| **⚠** en retenidas | se quieren retener más terneras de las que se destetaron |
| **↺** en el encabezado | la apertura está cargada a mano y **corta la cadena** (no hereda) |

### ⚠️ Para presupuestar N campañas de ventas hacen falta N+1 períodos
El destete de un período viene del servicio del anterior, así que **el servicio del último
período nunca desteta** y sus ventas no aparecen. Si querés 2 campañas presupuestadas, cargá
3 o 4 períodos.

---

## 🗺️ Presupuesto → Campos y hectáreas 🟡 *(nuevo 2026-08-02, sin testear)*

**Para qué es.** Decir cuántas hectáreas de cada campo hace cada actividad **en cada campaña**.
No es un dato del campo: las has se reasignan de un año al otro (las que un año son de recría al
siguiente vuelven a cría), y por eso cuelgan de la campaña.

**Dónde está.** Presupuesto → botón **Campos y hectáreas**.

### Cómo se usa
1. Arriba, elegir la **campaña** (`26/27`). Todo lo de abajo depende de eso.
2. Abrir un campo (click en la fila).
3. Cargar **has totales** y **has productivas**. ⚠️ **No son lo mismo**: Rojas tiene 242
   productivas sobre 245 totales. **El prorrateo de estructura usa las productivas.**
4. En *Hectáreas por actividad*, poner cuántas hace cada una. **Vacío o cero borra la asignación**,
   no guarda un cero.
5. Las **partidas** se muestran abajo con su titular. El titular de la partida es el dueño de esas
   hectáreas — por eso Nazarenas aparece repartido entre MSA y PAM.

### El control: que no quede ninguna hectárea afuera
Arriba de todo. Verde si está todo asignado; ámbar listando campo por campo si falta o sobra.
Estados posibles: `ok` · `quedan has sin asignar` · `SOBREASIGNADO` · `campo sin has cargadas`.

### Datos provisorios
Los que están a confirmar (hoy: **recría 60** y **Lima**) se avisan aparte aunque los números
cuadren. Es la diferencia entre *"está bien"* y *"todavía no lo confirmé"*. Se confirman con un
click desde la misma fila.

### 🧪 Cómo probarlo
1. Abrir **Nazarenas**: las 3 actividades tienen que sumar **385**.
2. Cargarle has a **Lima** → el cartel de arriba pasa de ámbar a verde.
3. **Sobreasignar** a propósito (ej. 300 a cría en Rojas) → tiene que avisar `SOBREASIGNADO`.
4. Confirmar el provisorio de recría → desaparece de la lista de provisorios.

---

## 🧮 Presupuesto → Variables de costo 🟡 *(nuevo 2026-08-03, sin testear)*

**Para qué es.** Armar un costo **sin pedirle código a nadie**. Todo costo se calcula igual:

> **monto = cantidad × precio × (ajuste₁ × ajuste₂ × …)**

Lo que cambia no es la fórmula: es **de dónde sale cada pieza**.

**Dónde está.** Presupuesto → botón **Variables de costo**.

### Cómo se usa
1. **Nueva variable** → se crea y se abre.
2. **Concepto**, **unidad** (cabeza, ha, ton, litro, jornal, kg novillo) y **actividad**.
3. **Cantidad — de dónde sale:** a mano · cabezas del rodeo · hectáreas de la actividad · días ·
   *derivada de otra cantidad* (× factor).
4. **Precio — de dónde sale:** a mano · cotización de grano · precio de hacienda ($/kg) · insumo ·
   historia de la cuenta.
5. **Ajustes encadenados** — *Agregar paso*, y se aplican en orden: IPC · % a mano (admite signo:
   +30 o −15) · variación de una magnitud · desvío contra lo realmente gastado.
6. **Cuándo cae**: todos los meses · un solo mes · meses fijos · cupo anual.
7. **Fundamento**: por qué se estima así. No es opcional en la práctica — dentro de seis meses un
   `×30 %` sin el porqué es un número que nadie se anima a tocar ni a defender.

**Ejemplo — IATF (9 kg de novillo por cabeza):** cantidad = *cabezas* con **factor 9**, unidad
*kg novillo*, precio = *hacienda* con referencia *Novillo*.

### "Alimenta la cuenta" — lo importante
Si se elige una cuenta contable, **esa cuenta deja de proyectarse por su historia**: pasa a salir
sólo de la variable. Es lo que evita contar el mismo peso dos veces.
⚠️ Sólo pasa si la variable está **completa**. Una a medias no tapa la cuenta, a propósito.

### Si falta un dato, dice "sin terminar" — no muestra cero
Un cero calculado es indistinguible de un cero real. Por eso una variable incompleta no reparte
cero en los meses: queda vacía y el faltante sube al control de cobertura.

### El cupo anual: lo presupuestado no se pierde si no se gasta en el mes

Es el modo para lo que se compra **1 o 2 veces al año** — el gas oil es el caso testigo. El
invariante lo puso el usuario:

> *"¿Qué pasa si lo pongo en marzo y finalmente lo compro más adelante? **Lo que no puede pasar es
> que por no hacerlo en el mes se pierda el presupuesto**."*

Entonces el mes elegido es una **estimación de cuándo**, no un vencimiento:
- Lo que se muestra es **el saldo**: cupo − lo ya gastado en la campaña.
- Mientras no se ejecute, ese saldo **se corre solo** al primer mes disponible. No hay que hacer nada.
- Si ya se gastó todo el cupo, **deja de figurar** — aunque el mes elegido esté por venir. Se
  cierra contra la realidad, no contra el calendario.

Lo ejecutado sale de las **facturas reales de la cuenta** que la variable alimenta, dentro de la
campaña en curso (1/7 → 30/6). Por eso el cupo anual **necesita** tener una cuenta asignada.

**Dos avisos automáticos** aparecen en el control de cobertura:
- *"se presupuestan $X al año y en el período no se gastó nada. ¿Sigue vigente?"*
- *"ya se gastó $X contra un cupo de $Y (130 %). El cupo quedó corto."*

### 🧪 Cómo probarlo
1. Crear una variable **completa a mano** (cantidad y precio) → el monto aparece arriba a la derecha.
2. **Agregar un paso** de `+30 %` → el monto sube y el paso aparece en *Cómo se arma*.
3. Poner **cantidad = cabezas** sin cabezas cargadas → tiene que decir *"faltan las cabezas
   proyectadas"* y quedar **sin terminar**. ⚠️ Si muestra $0 en vez de avisar, es un bug.
4. Asignarle una **cuenta** → esa cuenta tiene que **desaparecer** del bloque 📒 Cuentas contables
   de la grilla. Si aparece en los dos lados, se está contando dos veces.
5. Dejarla incompleta → aviso **rojo** arriba de la grilla y la cuenta **vuelve** a proyectarse.
6. Tildar *"la dejo sin terminar a propósito"* → deja de contarse como aviso.
7. **Cupo anual:** poner distribución *Cupo anual* y asignarle una cuenta que **ya tenga facturas**
   en la campaña. El monto que muestra tiene que ser **el saldo** (cupo − gastado), no el cupo
   entero. Si lo gastado supera el cupo, la variable **desaparece** de la grilla y sale el aviso
   *"el cupo quedó corto"*.
8. Poner un cupo en un **mes que ya pasó** → el saldo tiene que aparecer igual, en el primer mes
   disponible. Eso es el arrastre: el presupuesto no se pierde por no haberlo gastado a tiempo.

---

## 🏗️ Presupuesto → Inversiones 🟡 *(nuevo 2026-08-03, sin testear)*

**Para qué es.** Las inversiones del período, **una por una y a mano**. No se proyectan desde la
historia: no existe *"la última factura de silos"*.

**Dónde está.** Presupuesto → botón **Inversiones**.

### Cómo se usa
1. **Nueva inversión**.
2. **Nombre específico**, no una categoría: *"2 silos de autoconsumo 7 Ton c/u"*.
3. Centro de costo, **monto**, **mes de arranque** y **plazo en meses** (vacío o 1 = un solo mes).
4. **Justificación — por qué se invierte en esa área.** Es lo que se le explica a los socios cuando
   preguntan por qué se puso plata ahí. Si falta, la pantalla lo avisa.
5. **Estado**: prevista · aprobada · en curso · hecha · descartada.

### Dos criterios
- El **total excluye las descartadas**: una inversión que se decidió no hacer no es presupuesto.
- Las descartadas **quedan visibles pero atenuadas**, para que se vea que se evaluó y se dijo que no.

### En la grilla del presupuesto
Aparecen en su propio bloque naranja **fuera del TOTAL EGRESOS**, a propósito: no son gasto
operativo. Mezclarlas infla el egreso del año.

### 🧪 Cómo probarlo
1. Cargar una inversión con monto y mes → aparece en el bloque naranja de la grilla.
2. Verificar que **NO** cambie el TOTAL EGRESOS.
3. Dejarla sin justificar → aviso ámbar en la pantalla y en el control de cobertura.
4. Marcarla **descartada** → sale del total pero sigue visible, atenuada.
5. Ponerle **plazo 3** → el monto se reparte en 3 meses desde el de arranque.

---

## 🔍 Presupuesto → Control de cobertura 🟡 *(nuevo 2026-08-03, sin testear)*

**Para qué es.** *Todo tiene que estar presupuestado en algún lugar. Lo que no está, avisa.*

Aparece **arriba de la grilla** del presupuesto, sin que haya que buscarlo.

### Qué avisa, y en las dos direcciones
| | Qué significa |
|---|---|
| 🔴 | Una variable **sin terminar que es la única fuente de una cuenta** — esa cuenta quedó en cero |
| 🔴 | **Dos variables apuntando a la misma cuenta** — se está contando dos veces |
| 🟡 | Variables sin terminar sin cuenta asignada · inversiones sin justificar |

Abajo, en gris, informa cuántas están marcadas **pendientes a propósito**: ésas no cuentan como
aviso, pero se dicen igual.

**Por qué existe.** Los tres agujeros que aparecieron al auditar el presupuesto eran el mismo caso
—algo que se excluía *"porque va por otro lado"* y el otro lado nunca se llenó—: los honorarios de
AMS, las Cargas Sociales agotadas y las cuentas apagadas. Ninguno era difícil de ver: eran
invisibles **porque nadie preguntaba por los que faltaban**.

### 🧪 Cómo probarlo
1. Crear dos variables completas apuntando a **la misma cuenta** → aviso rojo de doble conteo.
2. Dejar una variable con cuenta **sin precio** → aviso rojo diciendo qué cuenta quedó en cero.
3. Marcarla *pendiente a propósito* → el aviso desaparece y baja al conteo gris.

---

## 👷 Presupuesto → Sueldos del presupuesto 🟡 *(nuevo 2026-08-03, sin testear)*

**Para qué es.** Poner el sueldo mensual de cada empleado y que el resto salga solo: francos,
premio anual, aguinaldo y cargas sociales.

**Por qué existe.** El presupuesto tomaba los sueldos de los **períodos de liquidación**. Los
períodos futuros estaban generados con el monto congelado y **tres empleados en $0**, así que el
bloque mostraba **la mitad** de lo que cuesta la plantilla. La solución es la que pidió el usuario:
*"yo pongo cuánto de SUSS y de sueldos presupuestar y listo, doy el punto de arranque"*.

⚠️ **No se liquida con estos números.** Son sólo proyección; la liquidación real sigue igual.

**Dónde está.** Presupuesto → botón **Sueldos del presupuesto**.

### Cómo se usa
**Arriba, dos parámetros generales:**
- **Actualizar cada (meses)** — cada cuántos meses suben los sueldos por IPC. Aplica a **toda la
  plantilla**. Los sueldos no suben todos los meses: suben en **escalones**, como las paritarias.
- **Cargas sociales — 1er mes** — el monto de arranque, a mano. De ahí sube igual que los sueldos.

**Abajo, la plantilla.** Por empleado:
| Campo | Qué es |
|---|---|
| **Sueldo mensual (A+B)** | el total. Es lo único obligatorio |
| **Francos (días)** | días por mes. El valor del día = **sueldo ÷ 25** |
| **Premio: mes** | en qué mes se paga (o ninguno) |
| **× sueldos** | el múltiplo. Se aplica sobre el sueldo **de ese mes**, así que si hubo aumento, lo toma |

### Lo que sale solo
- **Aguinaldo** = 50 % del sueldo, en **junio y diciembre**. Sobre el total (A+B).
- **Cargas sociales** = la base, con el mismo aumento que los sueldos, **+50 % en enero y julio**
  — un mes *después* del aguinaldo, porque las contribuciones del SAC se pagan al mes siguiente.
  *(Verificado contra los datos reales: el template Cargas Sociales pasó de $1.763.175 en jun-26 a
  $2.495.548 en jul-26, +41,5 %.)*

### La cascada
> **sueldo de presupuesto → período liquidado → nada**

El que tiene sueldo cargado acá **pisa** al período. El que no, sigue saliendo del período
liquidado como antes: no se pierde nada de lo que ya andaba.

### 🧪 Cómo probarlo
1. Cargarle sueldo a **AMS, Fabián Vulcano y Elvio Paz** (los tres que estaban en $0) y verificar
   que el bloque de sueldos de la grilla **suba fuerte** — deberían faltar entre $38 M y $60 M.
2. Mirar la tabla *Cómo evoluciona*: **junio y diciembre** en negrita (aguinaldo) y **enero y
   julio** en negrita (cargas +50 %).
3. Poner **Actualizar cada = 3** y verificar que el sueldo salte cada 3 meses, no todos los meses.
4. Ponerle a alguien **premio: mes = Ene, × sueldos = 1** → ese mes tiene que sumar un sueldo más.
5. Cargar la **base de cargas sociales** y ver aparecer la fila *Cargas sociales (SUSS)* en el
   bloque de sueldos de la grilla.
6. Borrar el sueldo de uno → tiene que **volver** a salir del período liquidado, no quedar en cero.

---

## 💰 Presupuesto → De dónde arranca el saldo 🟡 *(nuevo 2026-08-03, sin testear)*

**Dónde está.** En la fila **SALDO ACUMULADO**, abajo de todo en la grilla del presupuesto.

Hay **dos modos**, y se **eligen** con los botoncitos. No se adivina a propósito: un saldo viejo
presentado como actual es más peligroso que uno declarado a mano, porque **parece confiable**.

### Saldo a mano
El usuario declara el saldo y desde qué mes corre. Es la **válvula para cuando la conciliación
está atrasada**. Click en el monto para editarlo.

### Último conciliado
Toma el saldo del **último movimiento conciliado del extracto**. Es un número **verificable contra
el banco**, y es el que contesta *"¿me alcanza la plata?"*.

Muestra la **fecha** de ese movimiento. Y si el extracto tiene **más de 40 días de atraso**, lo
avisa en ámbar: el saldo es real, pero de hace rato, y todo lo posterior es proyección pura.

Si no hay ningún movimiento conciliado, lo dice y se cae al saldo a mano — **no inventa un número**.

> 📌 **Al 2026-08-03** el extracto llegaba al **18/06**, mes y medio atrás. Con esa foto, el modo
> correcto es **a mano**. El modo *último conciliado* gana sentido cuando la conciliación esté al día.

### 🧪 Cómo probarlo
1. En **Saldo a mano**: click en el monto, cambiarlo, OK → el SALDO ACUMULADO se recalcula.
2. Pasar a **Último conciliado** → tiene que mostrar el saldo del 18/06 y el aviso ámbar de atraso.
3. Volver a **Saldo a mano** → recupera el número declarado, sin pisarlo.

---

## ⚠️ Cupo anual — forma de presupuestar SIN VALIDAR

**No es un bug: es un recordatorio a propósito.** Aparece en naranja en la pantalla de Variables y
arriba de la grilla del presupuesto, cada vez que hay alguna variable con distribución *Cupo anual*.

Lo pidió el usuario (2026-08-03): *"quiero que dejemos una alerta a esta manera de presupuestar…
me parece bueno tenerlo y testearlo, pero no olvidar"*.

**Lo que está sin resolver:**
- El monto anual queda **fijo** y no se puede corregir a mitad de camino sin rehacer la variable.
- No está probado que el **arrastre** sea el comportamiento correcto para **todos** los conceptos:
  puede haber cupos que sí deban vencer al terminar el mes.
- Ante un **sobregasto** la variable desaparece de la grilla, y todavía no se decidió si eso es lo
  deseable.

El aviso se saca cuando el usuario dé el OK a la forma de presupuestar, no antes.

---

## 📊 Presupuesto → Descargar para los socios 🟡 *(nuevo 2026-08-03, sin testear)*

**Dónde está.** Arriba a la derecha de la grilla del presupuesto: botones **Excel** y **PDF**.

**Para qué es.** Presentar el presupuesto a alguien que **no tiene la app al lado**. No es un
volcado de la grilla.

### Los dos niveles
| | Qué trae | Para quién |
|---|---|---|
| **Resumen** | ingresos, egresos por bloque, inversiones, resultado del mes y saldo acumulado | el que quiere el número |
| **Detalle** | una hoja por bloque con las filas que forman cada subtotal | el que pregunta *"¿y esto de dónde sale?"* |

- **Excel** trae los dos: hoja *Resumen* + una hoja por bloque. Es el que usan los socios para
  **controlar**.
- **PDF** trae los dos también: **el resumen es la página 1** y después va **una página por
  bloque** con el detalle. Es el documento de la **reunión**: se imprime y se muestra, así que si
  ahí preguntan de dónde sale un número, la respuesta está en el mismo archivo.
- Botón **sólo resumen** (gris, al lado) para cuando alcanza con la primera página.

El orden resuelve las dos audiencias sin partir el documento: el que no quiere el detalle no pasa
de la página 1; el que sí, sigue leyendo. Todas las páginas van numeradas **x / total**, para que
no circule un documento incompleto sin que nadie lo note.

### Lo que siempre viaja con el documento
- **De dónde salió el saldo de arranque** — *declarado a mano* o *último conciliado al 18/06*. Sin
  eso, el lector no sabe qué está mirando.
- **Las advertencias del control de cobertura**, dentro del documento. Esconderlas sería maquillar
  el número que se presenta.
- La fecha de generación.

### Un criterio que importa
El export se arma desde **los mismos datos que pinta la pantalla**, no desde una consulta aparte.
Si el documento que ven los socios pudiera diferir de lo que ve el usuario en la app, dejaría de
ser confiable.

⚠️ **Regla al agregar cosas al presupuesto:** si se suma un bloque o un campo nuevo a la grilla,
**hay que sumarlo también acá**. Lo que se ve en pantalla y lo que se descarga no se desfasan.

### 🧪 Cómo probarlo
1. **Excel** → abrir y verificar que la hoja *Resumen* tenga TOTAL INGRESOS, TOTAL EGRESOS,
   INVERSIONES aparte, RESULTADO DEL MES y SALDO ACUMULADO.
2. Verificar que el **SALDO ACUMULADO del Excel coincida con el de la pantalla**. Si no coincide,
   es un bug y es el más importante de todos.
3. Comprobar que hay **una hoja por bloque** (templates, sueldos, cuentas, variables, inversiones)
   y que cada TOTAL de hoja coincida con la fila del resumen.
4. **PDF** → página 1 el resumen con las filas fuertes resaltadas y las advertencias abajo;
   después **una página por bloque** con su detalle y su TOTAL. Numeración x/total al pie.
5. **sólo resumen** → un PDF de una sola página.
6. Confirmar que arriba diga **de dónde salió el saldo de arranque**.

---

## ⚖️ Presupuesto → Margen por actividad 🟡 *(nuevo 2026-08-03, sin testear)*

**Para qué es.** El margen de cada actividad —cría, recría, engorde, arrendamiento— siguiendo la
lógica del Excel `MARGENES`, **en pesos** y con el doble formato: **por hectárea, por cabeza y
total**.

**Dónde está.** Presupuesto → botón **Margen por actividad**.

### Lo que hay que entender: es una VISTA, no un módulo
No tiene tablas propias. Lee de donde el dato ya vive:

| Qué | De dónde |
|---|---|
| Hectáreas | `campo_campana_actividad` (Campos y hectáreas) |
| **Cabezas** | **se CALCULAN** con `calcularLineaTiempo()` — la misma que usa *Productivo → Evolución del rodeo* |
| Ventas | `stock_lotes` (Productivo) |
| Precios | `precios_hacienda` |
| Costos directos | `actividad_insumos` (Actividades y costos) |
| Tipo de cambio | `tipos_cambio` |

**Consecuencia:** el margen no duplica ningún dato. Si un número está mal, el margen dice de dónde
salió.

### Los costos directos SÍ se editan acá *(2026-08-03)*
Cada costo directo es una fila **desplegable**:
- **Colapsada** → el número final, por unidad y total.
- **Desplegada** → *cómo se arma* paso a paso, y los campos para editarlo **sin salir del margen**.

Esto es lo que hace que *Variables de costo* sobre: los costos de producción se trabajan **en un
solo lugar**. Lo que **no** se edita acá es el **planteo productivo** —ganancia diaria, % de
ración, tramos—, que es de la actividad y el margen consume igual que consume las hectáreas.

**Un costo puede ser un número o una cuenta.** Abajo de cada fila hay una cadena de **ajustes**:

> `30 U$S por vaca × 260 cabezas` **× IPC × +30 %**

Con eso se puede decir *"lo de los últimos 12 meses × IPC × el aumento de cabezas"* en vez de tipear
un número fijo. Cada paso lleva su **nota**, y la fila lleva un **fundamento** —*"en qué fundamento
mi estimación"*— que se ve en el margen debajo del concepto.

⚠️ El ajuste **por IPC** usa el acumulado de los **últimos 12 meses cargados**, el mismo criterio
que las variables y el panel de cuentas. Si no hay IPC cargado, el margen avisa arriba.

### La amortización es del MARGEN, no del presupuesto
No dan lo mismo **a propósito**:

| Pastura: 50 has, dura 5 años | Presupuesto *(caja)* | Margen *(resultado)* |
|---|---|---|
| El año que se siembra | **las 50 has, 100 %** | 10 has |
| Los 4 años siguientes | **cero** | 10 has por año |

El presupuesto pregunta *"¿cuánta plata sale este año?"*; el margen, *"¿cuánto costó producir
esto?"*. Por eso `amortiza_anios` **sólo lo aplica el margen**. Con el silo de sorgo es igual: se
paga la siembra y el silaje de las 20 has el año que se hace, y se consume a lo largo de 3.

### Las cabezas se calculan, no se leen
El rodeo **rueda**: cada campaña abre con el cierre de la anterior (vacas + vaquillonas − descarte,
y las retenidas pasan a ser las vaquillonas del año siguiente). Por eso `vacas_apertura` está vacía
de la segunda campaña en adelante — **no falta el dato: se deriva**.
Lo cargado a mano gana; si está vacío, se calcula.

### Cada costo lleva su propia base — hectáreas Y cabezas
Ningún costo aplica sobre "todo". Cada línea, en *Actividades y costos*, declara **sobre qué**:

**Por hectárea** — `has_aplicacion` + `amortiza_anios`
- Mantenimiento de pasturas → las **15 has de pastura**, no las 175 del campo.
- Promoción de rye grass → las **113,16 has de verdeo**, y **÷ 4 años** (25 % por año).
- Sin eso, la implantación de pasturas daba **47 veces** lo que corresponde.

**Por cabeza** — `base_cabezas`
| Base | Qué toma | Ejemplo |
|---|---|---|
| `rodeo` *(default)* | vacas + vaquillonas | sanidad de vacas, IATF, rollos |
| `destetados` | los terneros destetados | sanidad de terneros |
| `vacas` · `vaquillonas` · `terneros` · `terneras` · `retenidas` · `toritos` | lo que dice | |
| `manual` | una cantidad fija | **sanidad de toros** (12) |

Las bases se **derivan del ciclo** (`calcularLineaTiempo`), así que son las mismas categorías que
muestra *Evolución del rodeo* y **cambian solas con la campaña**.

⚠️ **Los toros van a mano.** El Excel los calcula como 5 % de las vacas en servicio, pero el
modelo del rodeo **no tiene toros**: no hay de dónde derivarlos. Si algún día se agrega un
`pct_toros` a `stock_ciclos`, esa línea pasa de manual a derivada sola.

### (detalle) Los costos por hectárea llevan su propia superficie
Un costo por hectárea **no aplica sobre todo el campo**:
- Mantenimiento de pasturas → las **15 has de pastura**, no las 175 del campo.
- Promoción de rye grass → las **113,16 has de verdeo**, y sólo el **25 % por año**.

Eso se configura en *Actividades y costos*, en cada línea: **sobre cuántas hectáreas** aplica y
**en cuántos años se amortiza** (4 años → 25 % por año; una pastura dura 4 años).

Sin eso la implantación de pasturas daba **47 veces** lo que corresponde.

### Los precios se cargan DESDE el margen
Donde dice que falta un precio hay un botón **"Cargar precio de Ternero 180/200 →"** que abre
*Precios y TC*. **No hay que ir a buscar nada.**

⚠️ El precio va por **banda de peso**, no por categoría del rodeo: un ternero al pie de 191 kg
cotiza en `Ternero 180/200`; si se vende más tarde y pesa 210, pasa a `Ternero 200/220`.
**Las hembras no cotizan por peso**: van por categoría plana.

### Por unidad y total, en dos columnas
Cada bloque es una tabla de tres columnas: **Concepto · Por unidad · Total**. El por-unidad existe
para **comparar de un vistazo**, y apilado debajo del total obliga a leer dos veces cada línea.

### Cuando falta un dato, lo dice — no calcula cero
Cada actividad lista **qué le falta** para ser confiable, y las líneas incompletas quedan
atenuadas y marcadas *"sin calcular"*. Un margen redondo sobre datos incompletos es peor que uno
que dice qué le falta — sobre todo si se le presenta a los socios.

### 🧪 Cómo probarlo
1. Abrir **Cría** en la campaña 26/27 → tiene que mostrar **175 ha** y **260 cabezas**.
   *(260 = 200 vacas + 60 vaquillonas, calculado desde el cierre de 25/26.)*
2. Verificar los costos por hectárea contra el Excel:
   `Implantación pasturas ≈ 2.812 U$S` · `Mantenimiento pasturas 300` ·
   `Promoción rye grass 3.960` · `Mantenimiento verdeos 2.398` (× TC).
3. Los costos por cabeza tienen que usar **cada uno su base**, no los 260 para todos:
   `Sanidad Vacas`, `IATF` y `Rollos` → **260** (rodeo) · `Sanidad Terneros` → **los destetados** ·
   `Sanidad Toros` → **12** (a mano). ⚠️ Si los tres dan lo mismo, la base no se está aplicando.
4. Las ventas de **Ternero al Pie** deben tomar precio de `Ternero 180/200`; las de **Ternera**
   van a decir que falta el precio → probar el botón que lleva a cargarlo.
5. Cambiar una hectárea en *Campos y hectáreas* → el margen tiene que reflejarlo.

### 🧪 Cómo probar la edición desde el margen *(2026-08-03)*
6. **Clic en una fila de costo** (ej. `Sanidad Vacas`) → se abre debajo.
   Arriba tiene que aparecer **Cómo se arma**: `Base — 30 U$S/vaca × 260 rodeo × TC …`
7. Cambiar el **valor** a `35` y **Guardar** → el total sube ~17 % y **el margen bruto baja**.
   *(Volver a 30 después.)*
8. **Agregar un paso** de ajuste: `% a mano` = `30`, nota *"suba del combustible"* →
   el número tiene que subir **exactamente un 30 %**, y en *Cómo se arma* aparece una línea nueva
   con el acumulado. Quitarlo con el tacho y verificar que vuelve al original.
9. Poner un **fundamento** y confirmar que se ve **en la fila colapsada**, en cursiva.
10. En `Sanidad Toros`, cambiar *Sobre qué cabezas* de **cantidad fija** a **rodeo** → tiene que
    pasar de 12 a 260 cabezas. ⚠️ **Dejarlo de nuevo en cantidad fija = 12**, que es lo correcto.
11. **Amortización**: poner `4` años en un costo por hectárea → el **margen** lo divide por 4;
    el **presupuesto NO** (sigue mostrando el 100 %). Que difieran es lo correcto.

### ⚠️ Lo que se sabe que está mal (2026-08-03)
- **El silo de maíz** se calcula por **tonelada** (136,41 ton/año) y sigue cargado como `monto_ha`.
  Ya existe el modo **cantidad × precio**: hay que abrir la fila en el margen, cambiarle el modo y
  poner `136,41` en *Cantidad al año*. **Es un cambio de dato — lo hace el usuario.**
- **Siembra de verdeos** y **Gas Oil** están en **0**: la primera la pidió el usuario y no está en
  el Excel como línea propia; la segunda está vacía en el propio Excel. El gasoil son ~7.000 lts
  al año → también **cantidad × precio**.
- Los **modos de ración** (`pct_racion`, `kg_cabeza_dia`) —los que usan recría y engorde— todavía
  **no se resuelven** acá: necesitan la curva de peso y los tramos. Se informan como pendientes, y
  su fila se despliega pero el modo no se puede cambiar desde el margen.

---

## 🐄 Productivo → Evolución Rodeo → Lotes → **Actividades del lote (tramos)** 🟡 (sin testear)

**Qué es**: dentro de cada lote de venta, el bloque violeta donde se dice *"este lote hizo recría
entre estas dos fechas"*. De ahí salen **dos** cosas a la vez: la **curva de peso** (y con ella el
peso a la venta, la banda de precio y la factura) y el **costo de alimentación**.

### Cómo se opera

1. `Productivo → Evolución Rodeo`, bajar hasta los **lotes de venta**, abrir uno.
2. En el bloque violeta, botón **`+ tramo`**.
3. Elegir la **actividad** (Recría, Engorde…) y ajustar **Desde** y **Hasta**.
   - El **Hasta** viene propuesto con la **fecha de venta del lote** si está cargada.
4. **Guardar** el lote. ⚠️ **Los tramos se guardan con ese botón**: *Cancelar* los descarta.

Mientras editás, abajo se ve **en vivo** la curva de peso resultante y el costo de alimentación
total y por cabeza — antes de guardar nada.

### Lo que la pantalla avisa

| Aviso | Qué significa |
|---|---|
| *"termina después de la venta"* | el tramo se pasa de la fecha de venta: se está cobrando comida de animales que ya no están |
| *"hay tramos que se pisan"* | dos tramos solapados — el peso sale igual pero el costo se cuenta dos veces |

**El checkbox «Usar la ganancia diaria de arriba»** hace que el peso crezca con la ganancia escrita
en el lote en vez de la de la actividad. Se guarda con el lote, como todo lo demás.

**No hay campo de hectáreas.** Las hectáreas de una actividad se cargan en
`Presupuesto → Campos` y son de la actividad, no de cada lote.

### Cómo se prueba
→ los 8 pasos están en `PENDIENTES.md` § [A-TEST-41](PENDIENTES.md#a-test-41).

---

## 🌽 Productivo → Insumos → Stock → **Mediciones** 🟡 (sin testear)

**Qué es**: anotar **cuánto había** de un insumo el día que fuiste a mirarlo. No es un movimiento
(no entró ni salió nada): es el **saldo**.

**Para qué sirve**: es lo que convierte el costo de alimentación de **estimado** en **medido**.
Cada medición corta un tramo, y de cada tramo sale el consumo real.

### Cómo se opera

1. `Productivo → Insumos → Stock & Movimientos`.
2. En la fila del producto, botón **Mediciones**.
3. En la última fila de la tabla: **fecha**, **cuánto había** y **cómo se midió**. `+` para agregar.
4. Debajo aparecen solos los **tramos**, el **consumo de cada uno** y los **controles**.

**No hace falta medir en cada venta.** Alcanza con medir cuando se puede: con dos mediciones
(apertura y cierre) hay un tramo; con cuatro, tres. La cuenta es la misma.

💡 **Conviene poner una medición el día que arranca la ración.** Si no, el primer tramo incluye
días en que no se comió y el control del % del peso vivo sale diluido.

### ⚠️ Medir el día que llega un camión — la regla que hay que tener presente

**Es la medición más barata que hay**: cuando llega un camión mirás cuánto quedaba, y eso ya es un
corte de tramo. Pero tiene una condición:

> **Se mide ANTES de descargar, y se anota lo que había SIN contar el camión.**

El sistema siempre interpreta la medición de un día como *"lo que había antes de descargar lo de
ese día"*, y **el orden en que cargues las dos cosas no importa**.

| Lo que hacés | Lo que entiende el sistema |
|---|---|
| Recibís 25 t · anotás **1 t** | había 1, llegaron 25 → **26** ✅ |
| Recibís 25 t · anotás **26 t** *(contando el camión)* | había 26, llegaron 25 → **51** ❌ |

Y son independientes: podés **recibir sin medir**, **medir sin recibir**, y **medir cualquier día**.
Lo que corta un tramo es **la medición**, nunca el recibo.

### Lo que la pantalla te dice

| | Qué significa |
|---|---|
| **Consumo** de un tramo | `lo que había + lo que entró − lo que quedó` |
| **$/kg** de un tramo | el promedio de las entregas **de ese tramo**, no del período entero |
| **`—`** en el costo | falta el precio de alguna entrega. **Nunca pone cero**: "no sé" no es "gratis" |
| Los **3 controles** | se muestran cierren o no. En rojo con la diferencia si no cierran |

⚠️ **Una entrega que llega el mismo día de una medición cuenta en el tramo siguiente** — el stock se
mide al recibirla, antes de descargar.

### Cómo se prueba
→ los pasos están en `PENDIENTES.md` § [A-TEST-42](PENDIENTES.md#a-test-42).

---

## 🔁 Productivo → Recría → **Recría ➜ Cría (reposición)** 🟡 (sin testear)

**Qué es**: las vaquillonas retenidas **no se venden afuera**, pasan a cría. Es la misma operación
que la transferencia de arriba (Cría ➜ Recría) pero al revés.

**Un solo número para los dos lados**: es **ingreso de recría** y **costo de entrada de cría**.

### Cómo se opera
1. `Productivo → Recría / Engorde`, bloque **celeste** debajo del verde.
2. Cargar **cabezas**, **kg brutos por cabeza**, **$/kg** y **cuándo pasan**.
3. El **neto lo calcula la app** con el desbaste del ciclo — no se carga.

⚠️ **La fecha define a qué campaña contable cae** la transferencia (jul → jun), no la campaña que
diga el ciclo.

**Dónde se ve el efecto**: `Presupuesto → Margen por actividad`. **Recría** muestra
*«Reposición: vaquillonas a cría»* como ingreso y **Cría** el mismo monto como costo. Si falta el
precio, la fila queda *sin calcular* y sube a faltantes — **nunca se pone en cero**.

### Cómo se prueba
→ `PENDIENTES.md` § [A-TEST-44](PENDIENTES.md#a-test-44).

---

## 🔀 Un lote que NO se vende: pasa a otra actividad 🟡 (sin testear)

**Dónde**: `Productivo → Evolución Rodeo →` los lotes → abrir uno → el selector de arriba de todo.

```
Este lote  [ se vende afuera (mercado)  ▼ ]
           [ pasa a Cria — no se vende    ]
           [ pasa a Recria — no se vende  ]
```

**Para qué**: al destete una parte va a **venta** y otra a **reposición**, y la reposición vuelve a
cría. Los cuatro caminos se cargan igual, cambiando sólo el destino:

```
destete ─┬─► venta externa           destino vacío
         └─► recría                  destino = Recria
recría  ─┬─► venta externa           destino vacío
         └─► cría (reposición)       destino = Cria
```

### Qué cambia cuando ponés un destino

| | Venta externa | Traspaso interno |
|---|---|---|
| Margen de la actividad que entrega | ingreso | ingreso |
| Margen de la que recibe | — | **costo de entrada, el mismo número** |
| IVA y comisión | sí | **no** |
| Cash Flow | entra con su plazo de cobro | **no aparece — no mueve plata** |

El **$/kg** del lote es el precio del traspaso, y la **fecha** define a qué campaña contable cae.
Sin $/kg la fila queda *sin calcular* — **nunca en cero**.

💡 **Y los tramos siguen funcionando igual**: por eso conviene cargar la reposición como lote y no
en otro lado — así su ración se cuenta.

### Cómo se prueba
→ `PENDIENTES.md` § [A-TEST-46](PENDIENTES.md#a-test-46).

---

## 🥣 Mediciones → **Lo que se le dio a cada actividad** 🟡 (sin testear)

**Dónde**: dentro de *Mediciones* de un insumo, el bloque **celeste** debajo de las mediciones.

**Para qué**: cuando del mismo silo comen dos actividades. La medición te da el consumo **total**;
acá decís cuánto fue a cada una.

### Cómo se opera
1. Elegir la **actividad**, la **fecha**, la **cantidad** y una nota (*"se cargó el comedero"*).
2. `+` para agregar.

**Lo que declarás manda y no se reparte**: se le imputa entero a esa actividad, y el resto del
consumo del tramo es lo único que se reparte entre los demás. **El total no se mueve** — declarar
cambia *a quién* se le carga, no *cuánto* se consumió.

💡 **Si son dos silos separados**, no hace falta declarar nada: se cargan como **dos productos**
distintos y cada uno tiene su propia medición.

### Cómo se prueba
→ `PENDIENTES.md` § [A-TEST-47](PENDIENTES.md#a-test-47).

---

## 🐮 Mediciones → **Quién se lo comió** 🟡 (sin testear)

Debajo de los tramos, en la pantalla de *Mediciones*, aparece el reparto del consumo entre los
animales que comieron.

**De dónde sale**: de los **lotes del ciclo**. Cada lote aporta sus cabezas, su curva de peso y su
fecha de salida — **el que se vendió deja de comer ese día**. Las mortandades se descuentan.

**Cómo reparte**: por **kilo-día** = cabezas × peso vivo × días presentes. El más pesado y el que
estuvo más tiempo comen más, que es lo que pasa en el campo.

### ⚠️ La fila «Resto sin lote»

Es lo que el ciclo declara y **no está cargado en ningún lote**. Aparece marcada en ámbar.

> **No la ignores**: esos animales igual comen. Si no están declarados como lote, su comida se la
> reparten los demás y les infla el costo. **A medida que cargues los lotes que faltan, esa fila se
> achica hasta desaparecer.**

Y si los lotes suman **más** cabezas de las que declara el ciclo, sale una alerta: hay algo mal
cargado en un lado o en el otro.

### Cómo se prueba
→ `PENDIENTES.md` § [A-TEST-48](PENDIENTES.md#a-test-48).

---

## ⚖️ Margen → **Existencias y apertura por grupo** 🟡 (sin testear)

### Los dos renglones de existencias

En cada actividad aparecen ahora:

| Renglón | Dónde | Qué es |
|---|---|---|
| **Existencia inicial (a costo)** | en Costos | lo que los animales ya valían al abrir la campaña |
| **Existencia final (a costo)** | en Ingresos | lo que valen los que quedan al cerrarla |

**Para qué**: la recría abrió en febrero (campaña 25/26) y vendió en agosto (26/27). Sin esto,
la campaña que pagó la comida daba **pérdida pura** y la siguiente ganancia inflada.

**Se valúan a COSTO** — valor de entrada más lo que se les imputó — **no a precio de mercado**.
Valuar a mercado sería reconocer una ganancia antes de venderla.

💡 Los costos **no se reclasifican**: el maíz sigue mostrándose entero donde se pagó. Estos dos
renglones son los que absorben la diferencia de timing.

### La apertura por grupo

Dentro de cada actividad hay un desplegable **«Por grupo»**: una fila por cada grupo del rodeo,
con **ingreso · entrada · alimentación · margen**, y el estado *vendido* o *en stock*.

⚠️ **Es el mismo número, abierto** — no otro. Al pie está el control:

- **✓ la suma de los grupos da el margen bruto** → está bien.
- **✗ difiere en $X** → hay algo mal.
- *«no se puede controlar contra el total: N grupo(s) sin calcular»* → falta cargar algo, y por
  eso no se muestra una diferencia que no significaría nada.

### Cómo se prueba
→ `PENDIENTES.md` § [A-TEST-50](PENDIENTES.md#a-test-50).

---

## 🔗 Productivo → Insumos → Stock → **Facturas** 🟡 (sin testear)

**Qué une**: la **entrega** (que movió el stock) con la **factura** (que trae el precio).

```
"compré tanto"  →  "recibí este día"  →  llegó la factura
                    MUEVE EL STOCK        TRAE EL PRECIO
```

### Cómo se opera
1. `Productivo → Insumos → Stock`, botón **Facturas** del producto.
2. En la entrega que quieras, **vincular**.
3. Buscar la factura por proveedor o número, poner **cuánto de esa entrega cubre** y el **$/kg**.

⚠️ **Una factura puede cubrir varias entregas y viceversa** — no es un error, es lo normal.
Longo facturó el 13/07 las 25 t de las que había entregado 20,1 el 24/06, y el 14/08 facturó
20,1 de las 25 entregadas el 24/07.

### Lo que cambia

El **precio de la entrega** pasa a ser el promedio ponderado de las facturas que la cubren, y la
pantalla dice de dónde salió: **de las facturas** (verde) o **a mano** (ámbar). Ese precio es el
que después usa el costo del consumo — así el número es rastreable hasta el comprobante.

### Los dos controles

| Control | Qué te dice |
|---|---|
| **Lo entregado tiene factura** | cuánto recibiste y todavía no te facturaron |
| **Lo facturado está aplicado** | **anticipos**: lo que pagaste y todavía no recibiste |

Las dos situaciones son normales. **Lo que no es normal es no verlas.**

### Cómo se prueba
→ `PENDIENTES.md` § [A-TEST-51](PENDIENTES.md#a-test-51).

---

## 🌽 PUESTA A PUNTO de un ciclo de recría — el orden de carga 🟡 (sin testear)

**Cada paso depende del anterior**: los tramos necesitan los lotes, el reparto necesita los
tramos, y el control final necesita todo. Saltear uno hace que el número salga mal **sin avisar**.

| # | Qué | Dónde |
|---|---|---|
| **1** | **La apertura del ciclo**: cabezas y pesos **con los que ABRIÓ**, no la foto de hoy | Productivo → Recría → el panel de arriba |
| **2** | **El precio de entrada** de cría a recría | ídem |
| **3** | **Los lotes** de todo el rodeo: lo vendido, lo que queda, y lo de reposición con destino `Cria` | Productivo → Evolución Rodeo → lotes |
| **4** | **Los tramos** de cada lote (qué actividad, entre qué fechas) | adentro de cada lote |
| **5** | **Los insumos** como producto (categoría *Alimento balanceado*, en kg) | Insumos → Stock → Nuevo Insumo |
| **6** | **Las entregas**, con la fecha de **RECEPCIÓN** | Insumos → Stock → movimiento de compra |
| **7** | **Las facturas**, vinculadas a las entregas | Insumos → Stock → botón *Facturas* |
| **8** | **Las mediciones** de stock | Insumos → Stock → botón *Mediciones* |
| **9** | **Lo declarado** para otra actividad, si comparten silo | Mediciones → el bloque celeste |

### ⚠️ Los cuatro errores que arruinan la carga

1. **Cargar la apertura del ciclo con la foto de hoy.** Un ciclo abre con lo que entró; las
   mortandades se descuentan solas después. Con la foto de hoy **se descuentan dos veces**, y
   además el valor de entrada sale corto.
2. **Poner la fecha de la factura en la entrega.** La fecha de la entrega es **el día que el
   insumo entró al silo** — es la que corta los tramos, y de los tramos sale el costo.
3. **Medir contando el camión recién descargado.** La medición del día es *lo que había antes de
   descargar*. Ver la sección de Mediciones.
4. **Dejar animales sin lote.** Igual comen, y su comida se la reparten los demás. La fila
   *«Resto sin lote»* es el aviso — **si está, falta cargar algo**.

### Los cuatro controles al terminar

| | Dónde | Qué tiene que dar |
|---|---|---|
| 1 | Mediciones del insumo | los **3 controles en ✓** |
| 2 | Mediciones → *Quién se lo comió* | **ninguna fila** *Resto sin lote* |
| 3 | Presupuesto → Margen → la actividad | la fila del insumo con **un monto**, no *«sin calcular»*; y al desplegar *Por grupo*, **la suma da el margen bruto** |
| 4 | contra el Excel de la maqueta, si existe | **el mismo número** — y si no, la diferencia dice qué falta |

📌 **El orden de los controles no es casual**: el 1 dice si el consumo está bien medido, el 2 si
está bien repartido, el 3 si llegó al resultado, y el 4 si todo junto da lo que ya sabíamos que
tenía que dar. Si falla uno, los de abajo no significan nada.

---

## 📥 Productivo → Insumos → **Cargar una compra con su respaldo** 🟡 (sin testear)

**Dónde**: `Productivo → Insumos → Stock & Movimientos` → filtro en **Ganadero** → botón **`+ Compra`**.

### La pantalla

```
Fecha *          Proveedor (buscador)              Observaciones
────────────────────────────────────────────────────────────────────
Insumo *  │ Cantidad │ Costo Unit. │ Factura      │ Observaciones
(buscador)│          │ (se deriva) │ (buscador)   │
```

**Una compra = una fecha y un proveedor.** Si las entregas son de días distintos, va **una compra
por entrega** — aunque sea el mismo proveedor.

### Los cuatro campos, en orden

| Campo | Qué poner |
|---|---|
| **Fecha** | ⚠️ **la de RECEPCIÓN**, no la de la factura. Es la que corta los tramos de consumo |
| **Proveedor** | se busca por nombre o CUIT; trae el CUIT solo |
| **Insumo** | se escribe para buscar. Si no aparece, revisá el filtro **Ganadero/Agrícola** |
| **Cantidad** | coma decimal y punto de miles: `5.960` · `1,74` |
| **Factura** | opcional — busca en **comprobantes de ARCA y en cuotas de template** |
| **Costo** | **dejalo vacío si vinculás el respaldo**: se deriva del neto |

### ⚠️ Cuando el costo se deriva, mirá la división

Debajo del costo aparece la cuenta:

> `$6.687.500 ÷ 20.100 = 332,71` — **¿la factura cubre sólo esta entrega?**

**Si la factura facturó más de lo que llegó ese día, la división da mal.** En ese caso el precio se
escribe a mano —el de la factura— y el reparto se arma en el panel de *Facturas*.

### Lo que NO se puede hacer desde acá

Un **respaldo parcial**: una factura que cubre parte de dos entregas, o una entrega cubierta por
dos facturas. Eso va por el panel de *Facturas*, que es el único que sabe expresarlo. Dejá el campo
**vacío** y vinculalo después.

---

## 🧾 Productivo → Insumos → **Facturas** — el respaldo parcial y sus controles 🟡 (sin testear)

**Cuándo hace falta**: cuando lo facturado y lo entregado **no coinciden**, que es lo normal.

### 🔑 Un respaldo parcial NO es una compra nueva

Es la confusión natural y equivocarse **inventa stock sin que nada avise**:

| | Efecto |
|---|---|
| Cargar una **compra** de 4.900 kg | el stock sube 4.900 kg **que nunca llegaron** |
| Cargar un **vínculo** de 4.900 kg | el stock **no se mueve** — sólo se declara quién respalda esa parte |

> **Como pagar una compra con dos cheques: dos comprobantes, una sola compra.**

### El caso completo, que es el que conviene tener a mano

Longo facturó 25 t el 13/07 pero ese día bajaron 20,1. Las otras 4,9 llegaron el 24/07:

| Entrega | Respaldada por | Kg | Precio |
|---|---|---|---|
| 24/06 · 20.100 kg | FC 13/07 | 20.100 | $267,50 |
| **24/07 · 25.000 kg** | FC 13/07 *(el anticipo)* | **4.900** | $267,50 |
| | FC 14/08 | **20.100** | $267,05 |

**El precio es siempre el de su factura. Lo que se reparte es la cantidad.** Nunca se inventa un
precio promedio: el ponderado de la entrega ($267,14) sale **calculado** de los dos pedazos.

### Editar sin rehacer

Cantidad y precio de cada vínculo se editan **en el lugar**. A la derecha está el **subtotal**, que
es lo que deja ver si los pedazos suman el neto de la factura.

### Los controles, y qué significa cada uno

| Control | Qué mira |
|---|---|
| **Lo entregado tiene respaldo** | kilos recibidos sin factura ni template |
| **Lo facturado está aplicado** | ⚠️ exige que **cada respaldo cierre uno por uno**, no sólo la suma |
| **Respaldos vinculados** (la lista) | por factura: *«$5.376.750 de $6.687.500 · quedan $1.310.750»* |
| **Precio fuera de la mediana** | avisa si una entrega quedó a un precio muy distinto de las otras |

📌 **Por qué el control mira uno por uno**: dos errores opuestos se compensan. Con una factura
imputada de menos por $1.310.750 y otra de más por $1.310.795, la diferencia global da **$45** y
un control agregado diría que todo cierra.

**«Quedan $X» y «imputado de MÁS por $X» son problemas opuestos** y la pantalla los distingue: el
primero es un anticipo o una entrega que falta cargar; el segundo, mercadería cargada a una factura
que no la respalda.

---

## 💰 Presupuesto → Margen → **El costo de alimentación medido** 🟡 (sin testear)

> Es el **final de la cadena**: el punto donde las mediciones de silo se convierten en plata dentro
> del margen de cada actividad. Si algo de lo anterior está mal cargado, se nota acá.
> Diseño: `MODULO_HACIENDA.md` § 17. Bug que lo destrabó: `PENDIENTES.md` § A-BUG-90.

### Cómo se llega

**Presupuesto → Margen** → elegir la **campaña** arriba → buscar la actividad **Recría** →
desplegar la fila del costo (la flechita a la izquierda del concepto).

### Qué tiene que decir

En campaña **25/26**:

| Actividad | Concepto | Cantidad | Monto |
|---|---|---|---|
| Recría | Maíz Granel | 39.660 kg | **$10.211.404** |
| Cría | Maíz Granel | 2.000 kg | $516.215 |

En campaña **26/27**:

| Actividad | Concepto | Cantidad | Monto |
|---|---|---|---|
| Recría | Maíz Granel | 17.926 kg | **$4.788.721** |
| Recría | Concentrado Novillo 35 10 | 1.729 kg | $1.260.487 |
| Cría | Maíz Granel | 1.274 kg | $340.332 |
| Cría | Concentrado Novillo 35 10 | 121 kg | $88.163 |

Las cuatro filas de las dos campañas suman **$17.205.323**.

La fila dice al costado *«consumo MEDIDO y repartido por kilo-día»*. **Eso es lo que hay que ver**:
si en cambio dice *«sin calcular»* o muestra un número redondo estimado, el costo se está
proyectando en vez de medirse — y hay que volver a Mediciones.

### Cómo se lee el despliegue

Al abrir la fila aparece **un renglón por grupo y por tramo**, acumulando. En Recría 25/26 son
**10 renglones** (5 grupos × 2 tramos), arrancando por:

```
Consumo medido   16/03/2026→24/06/2026 · Ternero Recria (55 cab): 6.521 kg = $1.618.356
                 16/03/2026→24/06/2026 · Ternero Recria (40 cab): 4.380 kg = $1.087.107
                 ...
```

⚠️ **El renglón del 16/03 es el que hay que mirar primero.** Ese tramo se respalda con una *cuota de
template*, no con una factura de ARCA, y hasta el 2026-08-29 **no aparecía**: el costo salía un 31 %
más barato sin que nada lo dijera. Si esa línea falta, el problema volvió.

### Los tres avisos posibles

| Lo que dice | Qué significa | Dónde se arregla |
|---|---|---|
| *«falta el precio de alguna entrega»* | una entrega del tramo no tiene respaldo vinculado | Insumos → Stock → **Facturas** |
| *«sin fila de receta que lo proyecte»* | el consumo entró igual, pero ninguna receta lo va a proyectar hacia adelante | Productivo → Actividades → insumos |
| *«sin calcular»* | no hay dos mediciones para ese insumo | Insumos → Stock → **Mediciones** |

El segundo **no es un error**: el consumo medido entra al margen aunque ninguna receta lo reclame.
Se avisa porque la proyección a futuro sí va a necesitar la receta.

### El control, y qué hacer si no cierra

El total del margen tiene que dar **exactamente** lo mismo que la suma de los tramos en
*Mediciones → Quién se lo comió*: **$15.856.673** de maíz + **$1.348.650** de concentrado.

Si no coincide, **el problema no está en el margen** — está aguas arriba, y el orden para buscarlo
es: ¿los cinco controles de Facturas están en ✓? → ¿las mediciones son las seis? → ¿el rodeo
concilia 189 = 189?
