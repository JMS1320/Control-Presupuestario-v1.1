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

### ⚠️ SICORE — v1 vs v2 (CRÍTICO, verificado 2026-07-06)
Hay **dos "SICORE" en el código, NO son lo mismo**:
- **v2 (correcta, en uso):** sistema completo → tabla `msa.sicore_retenciones` + `estado_quincena` (abierta/cerrada/declarada) + certificados perpetuos + anulación (no DELETE) + Export v2 + `TablaRegistrosV2` + DDJJ. **Vive TODO en `vista-facturas-arca`** (el Modal / vista ARCA). Es la que usa el usuario y funciona.
- **v1 (vieja/deprecada):** solo estampa `sicore`/`monto_sicore`/`tipo_sicore` en la FC. **Es lo único que hace el Cash Flow** (`evaluarRetencionSicoreCF` → `.update({sicore})`; NO escribe `sicore_retenciones`). Por eso pagar SICORE desde Cash Flow queda **incompleto/con bugs**.
- Lo único común: el helper `generarQuincenaSicore` (Modal) = `generarQuincenaSicoreLocal` (Cash Flow) = **misma fórmula duplicada** (centralizar).
- **Implicancia:** para que Cash Flow sea la base, su pago debe llamar a la **registración v2** (no al estampado v1). Es la pieza más pesada de la migración.

### Inventario de funciones del Modal (qué debe existir en el "centro de mandos")
| Función | Hoy dónde | ¿En Cash Flow? |
|---|---|---|
| Subtotales por estado (preparado/pagar/pendiente) | Modal (l.9271, 10037…) | ❌ portar |
| Agrupar pagos/templates/sueldos | Modal (l.9293/9381/9445) | 🟡 parcial |
| PDF detalle de pago | `generarPDFDetallePago` (l.5505) | ❌ extraer a util |
| Export Excel de pagos | Modal | ❌ extraer a util |
| Cambiar estado (pagar/preparado/pagado) | ambos | ✅ ya |
| Editar fechas/campos | hook | ✅ ya (fecha_pago incl.) |
| **SICORE v2 (registración)** | Modal, embebido | ❌ **compartir el registro** |
| SICORE v2 GESTIÓN (TablaRegistrosV2, cierre/declaración, certificados, export, DDJJ) | Modal / vista SICORE | ⏸️ **NO mover** → queda en vista SICORE dedicada; Cash Flow solo dispara el registro |

**Complejidad honesta:** la mayoría son funciones que **ya existen** → se **extraen a un módulo/util compartido** y ambas pantallas las usan (mover, no reescribir; mecánico, riesgo bajo-medio). La excepción es **SICORE v2**: ahí la clave es **separar registración (compartir/disparar desde Cash Flow) de gestión (dejarla en su vista)** — así no hay que mudar todo el subsistema.

### 🪜 Plan de migración por etapas (Cash Flow como base)
- **E0 — refactor `fecha_pago`**: templates ✅ completo. ARCA = **solo la columna creada**; el pago-write FC + SICORE→fecha_pago **se pliegan a E2/E3** (capa compartida / Cash Flow), **NO se construyen en el Modal** (se deprecará). Para FC no es bug urgente (venc≈fecha a pagar hoy). Guardián templates + merge = al final.
- **E1 — Vista operativa del Cash Flow** (bajo riesgo, alto valor): default "impagos: vencidos + hoy en adelante, nunca conciliado" (usa `aplicarFiltros` que ya existe) + **chips estado/origen con Todos/Ninguno** + arreglar el filtro avanzado. Con esto ya ves lo mismo que el Modal.
- **E2 — Paridad de funciones de pago:** subtotales + agrupar + PDF detalle + export Excel pagos → **extraer a utils compartidas**.
- **E3 — SICORE v2 en Cash Flow** (pesada, fiscal): reemplazar el estampado v1 por la **registración v2 compartida**; la gestión SICORE queda en su vista. Testear a fondo.
- **E4 — Centralizar `generarQuincenaSicore`** (un solo helper, borrar duplicado).
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
- **Panel de sección (▶ desplegar una fila de la tabla):** clickeás un rango y se abre debajo: **(1) Sub-segmentar** — "cada X kg" divide ese rango en sub-rangos (cant/prom/%) para informar al comprador cómo viene el lote; **(2) Individuos** — lista de caravanas + peso de los animales de ese rango. Usa el **mismo peso estimado** que la segmentación. Solo lectura (no re-hace el proceso). *(Fase 2 pendiente: índices históricos — ganancia diaria punta a punta / últimas pesadas.)*

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
