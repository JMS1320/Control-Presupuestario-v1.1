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
| PDF detalle de pago | `generarPDFDetallePago` (l.5505) | ❌ extraer a util |
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

### Panel de revisión + envío (Cash Flow → "✉ Mails de detalle")
- Lista la cola por estado (pendiente / borrador / enviado / error). Podés **editar** destinatario, asunto y cuerpo, togglear los adjuntos (detalle / retención) y **borrar**.
- **Guardar** = solo persiste tus ediciones (no envía).
- **Enviar Borrador** (por fila) = guarda + dispara el GAS → crea el **borrador** en Gmail. **Enviar todos los pendientes** = lo hace para todos de una.
- El GAS crea **BORRADORES** (no envía): los revisás en Gmail y los mandás vos. El estado del panel pasa a "borrador" a los pocos segundos.

### Contenido del mail (auto)
- Cuerpo: "Adjuntamos el detalle del pago de: FC…" + desglose (Importe facturas / Retención / Descuento / **Total transferido** / **Fecha de pago**) + aviso de que llegará el comprobante de transferencia del banco.
- **Fecha de pago:** sale de la retención SICORE; si no hay, de la fecha estimada; si no hay ninguna, quedan puntos `..............` para completar a mano.
- **Adjuntos por default:** certificado = SIEMPRE que haya retención; detalle PDF = solo si hubo descuento (editable con los checkboxes del panel).
- Email destino = `proveedores.email_pagos`. Si el proveedor no tiene, se encola igual "SIN email" y lo completás en el panel.

### Setup del GAS (una vez)
- Proyecto de Apps Script **separado** en la cuenta **sanmanuel.sp@gmail.com** (de ahí salen los borradores). Código: `gas-mail-detalle/EnviarMailsDetalle.gs` (con `SUPABASE_URL` + anon key configurados).
- Deploy: **Implementar → Nueva implementación → Web app** (Ejecutar como: San Manuel · Acceso: Cualquiera) → copiar la URL `.../exec`. La primera vez que tocás "Enviar Borrador" la app te la pide y la guarda.
- Si cambiás el código del GAS: **Implementar → Gestionar implementaciones → editar → Nueva versión** (la URL no cambia).

---

## 📒 Módulo: Subdiario IVA Compras (Egresos → Facturas → Subdiarios)

**Dónde:** Egresos → Facturas → botón **Subdiarios** → "Consultar período" → elegís período → sale el **resumen en 2 bloques** (+ el detalle de cada factura debajo).

**Resumen en 2 bloques** (mismo cálculo en pantalla, Excel y PDF — función compartida `calcularSubtotalesSubdiario`):
1. **📒 Libro IVA Compras** = comprobantes que **SÍ generan crédito fiscal** (Fac **A** y **M**). Filas Facturas / Notas de Crédito / Total Neto, con Neto Gravado, Exento/No Gravado, IVA, Otros Tributos, Total.
2. **📋 Comprobantes que no generan crédito fiscal (Fac C y B)** = Fac **B** (6/7/8) + Fac **C** (11/12/13). Filas Comprobantes / Notas de crédito / Total Neto (por importe total).

**Ojo (cambio ARCA):** antes el bloque 2 era solo Fac C; ahora incluye **B y C**, y esas salen del bloque 1 (no se cuentan dos veces).

**Export Excel/PDF** (botón que baja LIBRO IVA COMPRAS): traen los **mismos 2 bloques** que la pantalla + el **Detalle por Alícuotas** (IVA discriminado 0/10,5/21/27%). El detalle por factura no cambió.

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

**⚠️ Estado: v1 SIN TESTEAR end-to-end.** Falta probar en bianual (crear 26/27 real + revisar cuotas/fechas/descripciones/detalle/vencimiento). Pendiente contable: si Acciones necesita la cuota 25/26 intermedia (cae en 2028 saltando 2027).

---

## 🌾 Módulo: Arrendamientos agrícolas (Ingresos → Ventas) 🟡 (nuevo, sin testear)

> **La regla que ordena todo**: *"Venta origina Factura/Liquidación que origina Cobro"*.
> El presupuesto de ingresos **no se carga en Presupuesto**: se carga en **Ventas**, y
> Presupuesto lo lee. **Fijar = vender.**
> Arquitectura y fórmulas → `DISEÑO_PRESUPUESTO.md` § INGRESOS — Arrendamientos agrícolas.

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

## 📊 Presupuesto → leer la grilla

### Saldo acumulado
Abajo de todo, después de RESULTADO, está el **SALDO ACUMULADO**: arrastra el resultado de cada
mes desde un saldo de arranque. El resultado mensual solo no dice si la caja alcanza — un mes malo
después de varios buenos no es lo mismo que ese mes con la caja en cero.

El **saldo de arranque se carga a mano** (link *"arranca en $X — editar"* en la misma fila). Por
ahora es así a propósito; más adelante saldrá de los saldos bancarios reales.

Los meses **anteriores** al mes del saldo muestran `—`: no se puede acumular hacia atrás desde un
saldo que corresponde a otro momento. Si ves guiones al principio de la grilla, el saldo quedó
viejo y hay que recargarlo.

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
