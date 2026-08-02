# 🏛️ ARQUITECTURA BASE DE DATOS — Referencia técnica

> ⭐ **DOC CANÓNICO DE ARQUITECTURA.** Toda la doc de estructura/arquitectura de la BD vive **solo acá** (`ARQUITECTURA-BD.md`, maestro legible) + **`ESTRUCTURA_BD_COLUMNAS.md`** (apéndice de columnas). **REGLA ABSOLUTA: NO crear otros archivos de arquitectura.** Mejora o sección nueva de estructura → se agrega/actualiza acá. ALTERs que no estén en el backup → además a `RECONSTRUCCION_SUPABASE_2026-01-07.md` (§ CAMBIOS POST-RECONSTRUCCIÓN). Pendientes → `PENDIENTES.md`.
>
> **Estado:** al día con la BD viva al **2026-06-23** (regenerado desde `information_schema` + `pg_class`).
> **Fuente de verdad = la BD en Supabase.** Este doc es la lectura humana.

---

## 1. Resumen

App de control presupuestario/contable + sector productivo agropecuario. Multi-empresa: **MSA**, **PAM**, **MA**. Backend Supabase (Postgres + PostgREST). Frontend Next.js (cliente supabase-js).

- **66 tablas base** en **6 schemas de usuario** + **6 vistas** en `public` que exponen el schema `sueldos`.
- Cada empresa tiene su propio schema para lo contable/fiscal; lo **compartido** vive en `public`; lo **agropecuario** en `productivo`; los **sueldos** en `sueldos` (no expuesto en API → se accede por vistas en `public`).

---

## 2. Schemas

| Schema | Tablas | Propósito |
|--------|:---:|-----------|
| `public` | 22 (+6 vistas sueldos) | **Compartido**: extractos de banco MSA/PAM, templates de egresos, proveedores, cuentas contables, reglas, anticipos, centros de costo, IPC, config, logs, lotes, sueldos (vistas). |
| `msa` | 12 | Contable/fiscal **MSA**: facturas ARCA, históricos, ventas, cajas, cheques, SICORE, grupos de pago, tarjeta. |
| `pam` | 3 | Contable/fiscal **PAM**: facturas ARCA, históricos, tarjeta. |
| `ma` | 4 | Contable/fiscal **MA**: facturas ARCA, ventas, banco (ma_galicia), tarjeta. |
| `productivo` | 19 | **Sector agropecuario**: hacienda, cría/ciclos, terneros, sanidad/aplicaciones, agrícola, insumos. |
| `sueldos` | 6 | **Sueldos** (storage real): empleados, campañas, períodos, pagos, componentes, cuentas. **No expuesto en API** → se lee/escribe vía las 6 vistas `public.sueldos_*` (passthrough auto-actualizables). |

### Exposición en API (PostgREST) y acceso desde código
- Los schemas alcanzables por la API deben estar en `pgrst.db_schemas` (aparte de GRANTs/RLS). Expuestos (verificado 2026-06-27 en `pg_roles` rol `authenticator`): **`public, msa, productivo, sueldos, pam, ma`** — todos se acceden directo. Las vistas `public.sueldos_*` quedaron como acceso alternativo/legacy (`sueldos` ya está expuesto directo). Ver memoria `reference_schemas_expuestos_api` (el fix de `ma` no está en el backup).
- Cliente: `lib/supabase.ts` crea el client simple. Para schema ≠ public:
  ```ts
  supabase.schema('msa').from('comprobantes_arca')   // ⚠️ .schema() ANTES de .from()
  supabase.from('msa_galicia')                        // public, directo
  ```
  Si `.schema()` va después de `.from()` se ignora (apunta a public) → bug silencioso. Ver memoria `reference_supabase_schema_orden`.
- El motor de conciliación arma el client por `cuenta.schema_bd` (genérico, ya no hardcodeado a msa).

---

## 3. Inventario de tablas

> RLS: ✅ habilitada · ❌ deshabilitada. ⚠️ **OJO**: aun con RLS ✅, casi todas tienen una sola policy *permisiva* "allow all" → no protege. Ver §5.
> Filas = estimado `reltuples` (puede estar desactualizado).

### `public` — compartido
| Tabla | RLS | Filas~ | Propósito |
|-------|:--:|:--:|-----------|
| `msa_galicia` | ✅ | 661 | Extracto cta cte MSA (banco Galicia). Tabla de movimiento bancario. |
| `pam_galicia` | ✅ | 9 | Extracto Caja de Ahorro PAM. |
| `pam_galicia_cc` | ❌ | 20 | Extracto cta cte PAM. |
| `egresos_sin_factura` | ✅ | 156 | **Templates** de egresos (cabecera). 3 tipos: fijo/abierto/bidireccional. |
| `cuotas_egresos_sin_factura` | ✅ | 890 | Cuotas de cada template (detalle). |
| `templates_master` | ✅ | 1 | Agrupador de templates por año. |
| `cuentas_contables` | ✅ | 122 | Plan de cuentas (categ, totalizadora, jerarquía, imputable). |
| `proveedores` | ✅ | 138 | Maestro de proveedores/clientes (CBU, email, mensaje transferencia, flags GAS). |
| `centros_costo` | ✅ | — | Maestro de centros de costo. |
| `reglas_conciliacion` | ✅ | 75 | Reglas del motor (texto→categ/template, por cuenta bancaria). |
| `reglas_contable_interno` | ✅ | — | Reglas contable/interno (por template/responsable). |
| `reglas_ctas_import_arca` | ❌ | — | Reglas CUIT→cuenta contable al importar ARCA. |
| `config_parseo_extracto` | ✅ | — | Config de parseo de extractos por cuenta bancaria. |
| `anticipos_proveedores` | ❌ | 27 | Anticipos a proveedores (pueden vincularse a FC). |
| `anticipos_facturas` | ❌ | — | N:N anticipo↔factura aplicada. |
| `distribucion_socios` | ✅ | — | Config distribución por socio (dashboard). |
| `indices_ipc` | ✅ | — | IPC mensual (ajustes). **VACÍA** — hay que cargarla para los métodos IPC del presupuesto. |
| `tipos_cambio` | ✅ | — | TC mensual presupuestado/real. Dato **macro multiempresa**. Carga manual. (2026-07-26) |
| `precios_granos` | ✅ | — | Precio por posición (grano, año, mes) en USD/ton. Macro multiempresa. Si falta un mes, la app arrastra el siguiente cargado. (2026-07-26) |
| `contratos_arrendamiento` | ✅ | 4 | Contratos de arrendamiento agrícola cobrados en qq/ha. Columna `empresa` (MSA/PAM/MA) — **no se separa por schema**. `centro_costo` = FK lógica a `centros_costo.nombre`. (2026-07-26) |
| `cuotas_arrendamiento` | ✅ | 14 | Cuotas de cobro del contrato (fecha + posición de fijación). Estado **se DERIVA** (fijaciones + fecha), la columna es sólo un hint. `precio_usd_override` / `precio_pesos_override` pisan el precio de la posición (pesos gana y no aplica TC). `cuota_padre_id` = split al fijar parcial. `dias_cobro_disponible` en el contrato (Sanpa 15, resto 20). (2026-07-26) |
| `ventas_arrendamiento` | ✅ | — | **VENTAS de arrendamiento — la fijación ES la venta.** Total o parcial. Precio y TC se fijan en **momentos distintos** (`fecha_fijacion_precio` / `fecha_fijacion_tc`); hasta que están los dos el monto ARS es estimado. Modo `pizarra` cierra en un acto, en ARS, sin TC. `comprobante_id` = FK lógica a `{schema}.comprobantes_venta`. (2026-07-26) |
| `ventas_facturas` | ✅ | — | Decisión "¿esta factura es de esta venta?". Polimórfica (`venta_tipo` + `venta_id`) porque `msa.ventas_comprobantes` tiene FK a `msa.ventas`. `vinculado=false` = el usuario dijo que NO (se guarda igual para no repreguntar). `monto_asignado` habilita **facturación parcial**. (2026-07-26) |
| **vista** `ventas_unificadas` | — | — | Los tres tipos de venta en el formato común que consumen Cash Flow y el motor (fecha, cliente, monto, cuenta contable, centro de costo) + `facturado` + `falta_tc`. Hoy sólo arrendamiento; granos y ganadería con UNION ALL cuando existan. (2026-07-26) |
| `precios_hacienda` | ✅ | — | Precio **ARS/kg** por categoría y mes. Separada de `precios_granos` a propósito (esa es USD/ton por posición). Carga manual: no hay Matba de hacienda. (2026-07-26) |
| `presupuesto_ganaderia` | ✅ | — | Proyección de venta de destete por campaña (vientres, %destete, %machos, %reposición, pesos, fecha de cobro). **Las alícuotas viven en la fila** (`alicuota_iva` 10,5% · `alicuota_iibb` 1%) — NO son constantes globales: arrendamiento es exento con IIBB 5%. (2026-07-26) |
| `tipos_comprobante_afip` | ✅ | 68 | Catálogo tipos comprobante AFIP (NC flag). |
| `tipos_sicore_config` | ✅ | — | Config tipos SICORE (alícuota, mínimo, régimen). |
| `lotes_transferencias` | ❌ | — | Histórico de lotes de pago Galicia (Excel). |
| `arca_descargas_log` | ✅ | — | Log descargas automáticas portal ARCA. |
| `arca_pdf_busqueda_log` | ❌ | — | Log búsqueda automática de PDFs (GAS). |
| **vistas** `sueldos_*` (×6) | — | — | Módulo sueldos expuesto como **vistas**: campanas, empleados, componentes_salario, cuentas_empleado, periodos, pagos. |

### `msa` — contable/fiscal MSA
| Tabla | RLS | Filas~ | Propósito |
|-------|:--:|:--:|-----------|
| `comprobantes_arca` | ✅ | 318 | Facturas de compra ARCA (IVA compras, SICORE, pagos, PDF). |
| `comprobantes_historico` | ❌ | 273 | Facturas históricas pre-sistema. |
| `comprobantes_venta` | ✅ | — | Liquidaciones de venta (granos). |
| `ventas` | ✅ | — | Operaciones de venta (IVA Ventas). |
| `ventas_comprobantes` | ✅ | — | N:N venta↔liquidación. |
| `caja_general` / `caja_ams` / `caja_sigot` | ❌ | 79 | Cajas efectivo (tablas de movimiento). |
| `cheques` | ❌ | — | Cheques/ECHEQs (emisión, endoso, estado). |
| `grupos_pago` | ❌ | — | Grupos de pago (agrupan facturas en una OP). |
| `sicore_retenciones` | ✅ | 39 | Retenciones SICORE (certificados, quincenas, anulación). |
| `tarjeta_visa_business` | ❌ | 320 | Tarjeta VISA Business MSA (resúmenes). |

### `pam` — contable/fiscal PAM
| Tabla | RLS | Propósito |
|-------|:--:|-----------|
| `comprobantes_arca` | ❌ | Facturas ARCA PAM. |
| `comprobantes_historico` | ❌ | Históricos PAM. |
| `tarjeta_visa` | ❌ | Tarjeta VISA PAM. |

### `ma` — contable/fiscal MA
| Tabla | RLS | Filas~ | Propósito |
|-------|:--:|:--:|-----------|
| `comprobantes_arca` | ✅ | 75 | Facturas ARCA MA. |
| `comprobantes_venta` | ✅ | — | Liquidaciones de venta MA. |
| `ma_galicia` | ✅ | 0 | Extracto Caja de Ahorro MA. |
| `tarjeta_visa` | ❌ | 53 | Tarjeta VISA MA. |

### `productivo` — agropecuario
| Grupo | Tablas |
|-------|--------|
| **Hacienda** | `categorias_hacienda`, `movimientos_hacienda`, `stock_hacienda` |
| **Cría / ciclos** | `ciclos_cria`, `detalle_descarte`, `terneros` (209), `pesadas_terneros` (371) |
| **Sanidad/aplicaciones** | `ordenes_aplicacion`, `ordenes_aplicacion_rodeos`, `lineas_orden_aplicacion`, `lineas_orden_labores` |
| **Agrícola** | `lotes_agricolas`, `ordenes_agricolas`, `lineas_orden_agricola`, `lineas_orden_agricola_labores` |
| **Insumos / maestros** | `categorias_insumo` (ambito agrícola/ganadero), `stock_insumos`, `movimientos_insumos`, `labores` |
| **Evolución del rodeo** (2026-07-29) | `stock_ciclos`, `stock_lotes`, `stock_ventas` |
| **Actividades y costos** (2026-07-30) | `actividades`, `actividad_insumos`, `lote_tramos` |

**Evolución del rodeo** — línea de tiempo proyectada del stock de cría (modelo de la solapa
"ciclo ganadero" del Excel). **No están en el backup.**

| Tabla | Propósito |
|-------|-----------|
| `stock_ciclos` | Un **ciclo anual** por fila (servicio oct → destete mar). Cada período **abre con el cierre del anterior**; `vacas_apertura`/`vaquillonas_apertura` en NULL = hereda, cargadas = foto manual. Parámetros **por período**, no constantes globales (la reposición es decisión de estrategia y cambia año a año). Los `real_*` **pisan el cálculo** y recalculan todo lo posterior. |
| `stock_lotes` | Cabezas disponibles para vender: destete no retenido, vaca de descarte, y la recría heredada del stock inicial. `ganancia_diaria_kg` hace crecer el peso si se vende después del destete. |
| `stock_ventas` | Venta **total o PARCIAL** de un lote. Peso y precio quedan **congelados** al vender (mismo criterio que `ventas_arrendamiento`). |

#### 🧭 Las capas que ordenan un egreso — cuál es cuál

Hay siete campos que "ordenan" y es fácil confundirlos. De la macro al detalle:

| Capa | Dónde vive | Qué es | Se usa para |
|---|---|---|---|
| **1a · `tipo`** | **`egresos_sin_factura`** | La macro **del template**: `ingreso` · `egreso` · `financiero` · `distribucion` · `NO`. Cargada en los **176** (2026-07-31) | Decide **si se presupuesta** y en qué sección del dashboard suma |
| **1b · `tipo`** | `cuentas_contables` | La misma macro, pero **de la cuenta** | Clasifica las **facturas**. Para templates es sólo **fallback** si 1a está NULL |
| **2 · `nombre_totalizadora`** | `cuentas_contables` | La **jerarquía contable**: EGRESOS → EGRESOS POR GANADERIA → … | Ordena el **dashboard**. El presupuesto todavía no la usa (C-22) |
| **3 · `categ`** | en las **dos** tablas | El **puente**: `egresos_sin_factura.categ` ↔ `cuentas_contables.categ` | Llegar de un template a su totalizadora. **Ya no al tipo** — eso lo trae 1a |
| **4 · `cuenta_agrupadora`** | `egresos_sin_factura` | Agrupación **propia de los templates** (Impuestos Rurales, Gastos Bancarios…) | Es la que agrupa hoy el presupuesto |
| **5 · `codigo_contable`** | `egresos_sin_factura` | Casi siempre `"No lleva"`, que **es un valor con significado** | El motor de conciliación lo estampa desde la regla |
| **6 · `grupo_cuenta`** | `cuentas_contables` | Vacía en toda la tabla | No se usa |

⚠️ **1a y 1b no son el mismo dato duplicado**: el plan clasifica **facturas** (que apuntan por
`cuenta_contable`), el template clasifica **templates**. Cada uno con su población.

La cascada, en `resolverTipo()` (`lib/presupuesto/templates.ts`) — **un solo lugar**:

```
egresos_sin_factura.tipo   →  cuentas_contables.tipo (por categ)  →  signo del monto
```

**El punto de confusión frecuente**: cuando se dice que un template *"no tiene categoría"*, en
realidad **sí la tiene** (capa 3) — lo que falta es que esa categoría **exista en
`cuentas_contables`**, y por eso se queda sin la capa 2. Pasa con 23 categorías que usan 132
templates: impuestos rurales, automotores, ARCA, IIBB y los retiros de socios.

*Hasta 2026-07-31 eso también los dejaba sin la capa 1, y entonces caían al **signo del monto**:
un débito era "egreso". Por eso los retiros de socios sumaban $43,65 M a egresos operativos en
vez de a distribuciones. La capa 1a existe justamente para cortar esa dependencia.*

##### Qué se vincula por ID y qué por texto (medido 2026-07-31)

| Vínculo | Cómo | Cobertura |
|---|---|---|
| extracto → **template** | **UUID** (`template_id`, `template_cuota_id`) | 469 de 661 |
| extracto → factura / sueldo / anticipo | **UUID** | 151 más — **612 de 661 (93 %)** tienen algún ID |
| template → **cuenta contable** | **TEXTO** (`categ` ↔ `categ`) | siempre |
| extracto → **cuenta contable** | **TEXTO**, o `nro_cuenta` | sólo 106 de 661 con número |
| **regla de conciliación** → destino | **TEXTO** (`categ`) | las 77 |

Las únicas FK del sistema apuntan a `egresos_sin_factura.id`. **Nadie referencia
`cuentas_contables.id`**: la clasificación contable es texto de punta a punta.

⚠️ **Renombrar una categoría es un UPDATE coordinado de cuatro lugares** — `cuentas_contables`,
`egresos_sin_factura`, `reglas_conciliacion` y las copias denormalizadas del extracto. Lo más
delicado son las **77 reglas**, porque clasifican hacia adelante: si escriben un nombre que ya
no existe, cada movimiento nuevo nace huérfano y no se nota. Plan para salir de esto en
`PENDIENTES.md` § C-24.

`categ` y `cuenta_contable` son **idénticas en 135 de 143 filas** del plan. Las 8 que difieren
son abreviaturas (`FCI` → Fondos Comunes de Inversión). No es un error: `categ` es la etiqueta
**operativa** (la que se tipea y queda grabada en 776 filas) y `cuenta_contable` la de
**presentación**.

**Presupuesto de cuentas contables** (2026-07-30) — **No están en el backup.**

| Objeto | Propósito |
|---|---|
| `public.presupuesto_cuenta_config` | Cómo se presupuesta cada cuenta: `modo` (`ultima_fc`/`promedio_n`/`estacional`/`por_cabeza`/`manual`/`excluida`) + sus parámetros. Sin fila, la cuenta usa la sugerencia automática. |
| `public.presupuesto_historia_cuentas` (vista) | Historia mensual unificada por cuenta: monto, facturas y proveedores. |

La vista resuelve tres cosas que impedían comparar contra el pasado: (1) la misma cuenta estaba
**partida por las mayúsculas** entre `msa.comprobantes_historico` (Title Case) y
`msa.comprobantes_arca` (UPPER) — la identidad es **`nro_cuenta`, no el nombre**; (2) 85 filas de
ARCA sin `nro_cuenta` se resuelven por nombre contra `cuentas_contables`; (3) las dos fuentes se
**solapan en dic-2025** con las mismas facturas, así que manda el histórico (cierre contable) y
ARCA aporta desde ene-2026.

Motor en `lib/presupuesto/modos.ts`. Dos reglas que no son obvias: el **mes en curso nunca se
usa** (está a medio facturar) y el promedio **divide por los meses de la ventana**, no por los
que tienen factura — un mes sin factura es un mes de cero, y la ventana cierra en el último mes
**cerrado**, no en el último con dato.

La jerarquía de `nro_cuenta` clasifica sola: `421*` agricultura · `422*` administración y
estructura · `423*` ganadería (`42305*` alimentación) · `425*` maquinarias. De ahí sale qué
cuentas se excluyen por estar ya en Actividades y costos.

**Presupuesto — saldo de arranque** (2026-07-30) — `public.presupuesto_config`
(`empresa` único, `saldo_inicial`, `mes_inicial`, `notas`). **No está en el backup.**
Es el punto de partida del **saldo acumulado** del presupuesto: sin él la grilla sólo dice el
resultado de cada mes, que no alcanza para saber si la caja da. Se carga a mano — provisorio,
lo natural sería derivarlo de los saldos bancarios (FASE C · C-10). `mes_inicial` indica a qué
mes corresponde el saldo; los meses anteriores no se acumulan.

**Actividades productivas y costos directos** (2026-07-30) — **No están en el backup.**

| Tabla | Propósito |
|-------|-----------|
| `actividades` | Parámetros de una actividad (recría, engorde, …): **el rinde** (`ganancia_diaria_kg`), la ración como % del peso vivo y la mortandad. Asignar la actividad define el ingreso **y** el costo de una sola vez, porque la curva de peso con que se factura la venta sale del mismo número que los kilos de maíz que se compran. |
| `actividad_insumos` | Los costos directos de esa actividad, **uno por fila**. Es tabla hija y no columnas fijas a propósito: cada actividad tiene sus propios insumos, y una nueva no debe exigir migrar la tabla. |
| `lote_tramos` | La actividad aplicada a un lote entre dos fechas, encadenables (recría y después engorde). `actividad_id` con `ON DELETE RESTRICT`: borrar una actividad en uso tiene que fallar fuerte. |

El costo directo **no se registra en ningún lado** — no es template ni factura esperada. Es una
**consecuencia calculada** de la actividad que se decide hacer, igual que el IIBB de la venta de
arrendamiento. Decisión del usuario, 2026-07-30.

`actividad_insumos.modo` decide el **cuánto y el cuándo**, y con eso las familias de costo
(por cabeza-día · por cabeza-evento · por hectárea · por valor producido) entran en un solo
mecanismo: `pct_racion` · `kg_cabeza_dia` · `unid_cabeza_mes` · `unid_cabeza_evento` ·
`dosis_cada_kg` · `monto_cabeza` · `monto_ha` · `monto_mes` · `pct_produccion`.
`momento` (`diario`/`mensual`/`inicio`/`fin`/`ciclo`) ubica el gasto en el tramo; `ciclo` es
"tantos USD por hectárea en el cultivo entero" y hoy se prorratea por días (provisorio, ver
FASE C · C-9).

`moneda` (`ARS`/`USD`) — un costo agrícola se piensa en USD/ha. En USD el monto se pasa a pesos
al **TC presupuestado del mes de cada gasto**, con `resolverSerie` sobre `public.tipos_cambio`:
un ciclo largo puede usar varios TC. `tipo = 'agricola'` no usa `racion_pct_pv` ni
`ganancia_diaria_kg`.

**La curva de peso sale de los tramos y es QUEBRADA** (`lib/productivo/tramos.ts`). Con recría a
0,5 kg/día y engorde a 0,7 el peso deja de ser `base + días × ganancia`: hay que integrar tramo
por tramo. Precedencia: `stock_lotes.ganancia_override` (override manual) → la ganancia de la
actividad del tramo → la del lote para los días sin tramo. Motivo: si el lote y la actividad
llevan cada uno su ganancia y divergen, el peso con que se factura la venta y los kilos de maíz
que se compran describen dos animales distintos.

`pesoEstimado()`, `valuarLote()` y `valuarLoteConPrecios()` de `lib/ganaderia/ciclo.ts` reciben
un `curva?: CurvaPeso` **opcional** — una función `(fecha) => peso`. Se pasa como callback y no
importando `lib/productivo/tramos.ts` para evitar un import circular entre ganadería y
productivo; sin ella se comportan como antes.

Motor en `lib/productivo/racion.ts` (ración y margen, compartido con el análisis de engorde) y
`lib/productivo/actividades.ts` (`consumoMensual()` reparte el tramo mes a mes; el consumo
diario **sube** porque la ración es un % del peso vivo y el animal engorda).

Motor del ciclo (en `lib/ganaderia/ciclo.ts`):
`rodeo = vacas + vaquillonas` · `destete = rodeo × %destete` (se parte por `%machos`) ·
`falladas = rodeo − destetados` · `descarte = falladas × %descarte` (sale de vaca **y**
vaquillona) · al cierre **las vaquillonas paren y pasan a vaca**, y las terneras retenidas
son las vaquillonas del año siguiente.

### `sueldos` — módulo sueldos (storage real, no expuesto en API)
| Tabla | RLS | Filas~ | Propósito |
|-------|:--:|:--:|-----------|
| `empleados` | ❌ | — | Maestro de empleados (tipo, empresa, CUIT, fechas alta/baja). |
| `campanas` | ❌ | — | Campañas/períodos de liquidación. |
| `periodos` | ❌ | 44 | Liquidación por empleado/mes (bruto, IPC, días, francos, premios, saldo). |
| `pagos` | ❌ | 71 | Pagos (anticipos + finales), vinculables a grupo de pago + `visible_contable`. |
| `componentes_salario` | ❌ | — | Componentes del salario por empleado/campaña (vigencias). |
| `cuentas_empleado` | ❌ | — | Cuentas bancarias del empleado. |
> Se accede vía vistas `public.sueldos_*` (mismo nombre con prefijo). FKs lógicas: periodos/pagos/componentes/cuentas → empleados; periodos/componentes → campanas; pagos → periodos.

---

## 4. Patrones transversales

### 4.1 Tablas de movimiento (bancos, cajas, tarjetas) — estructura común
`msa_galicia`, `pam_galicia`, `pam_galicia_cc`, `ma_galicia`, `caja_*`, `tarjeta_*` comparten el núcleo:
`id, fecha, descripcion, debitos, creditos, saldo, control, categ, detalle, contable, interno, centro_de_costo, cuenta, orden, estado, motivo_revision` + la **familia de conciliación** (§4.2).
- **Bancos** agregan: `origen, concepto, grupo_de_conceptos, numero_de_terminal, leyendas_adicionales_1..4, tipo_de_movimiento, numero_de_comprobante, observaciones_cliente`.
- **Tarjetas** agregan: `referencia, cuota, comprobante, debitos_usd, creditos_usd, nro_resumen, fecha_cierre, fecha_vencimiento, tarjeta_adicional, titular_adicional, tipo_fila`.
- **Cajas** son las más simples (no tienen la familia completa: solo `comprobante_arca_id, template_id, template_cuota_id, nro_cuenta`).

### 4.2 Familia de conciliación (columnas de linkeo)
En las tablas de movimiento, al conciliar se llenan (según contra qué se concilie):
`comprobante_arca_id` (factura ARCA) · `template_id` + `template_cuota_id` (template) · `sueldo_pago_id` (sueldo) · `anticipo_id` (anticipo) · `nro_cuenta` (cuenta contable) · `categ`, `detalle`, `contable`, `interno`, `proveedor_nombre`, `comprobantes_pagados`, `estado`.
- ⚠️ Estas columnas **no son FKs** (son UUIDs sueltos, muchos cross-schema). El motor las llena lógicamente.
- ⚠️ Las tablas de **tarjeta** recibieron estas columnas recién en 2026-06 (no estaban; ver `RECONSTRUCCION_SUPABASE`). Las **cajas** aún no tienen `sueldo_pago_id/anticipo_id/proveedor_nombre/etc.`

### 4.3 Estados típicos
- Facturas ARCA `estado`: `pendiente`, `pagar`, `credito` (pagada con tarjeta), `conciliado`, `anterior`, `cuotas`, `debito`, `externo`.
- Movimiento bancario `estado`: `pendiente`, `conciliado`, `auditar`, `total` (fila resumen de tarjeta).
- `ddjj_iva`: `No`, `Imputado`, `DDJJ OK` (DEFAULT `No`, cambiado desde `Pendiente` post-reconstrucción).

---

## 5. Permisos y RLS  🔒  (auditado 2026-06-23)

**No hay protección a nivel de datos.** Relevamiento concreto:

1. **Grants idénticos para los 3 roles**: `anon`, `authenticated` y `service_role` tienen **`SELECT, INSERT, UPDATE, DELETE, TRUNCATE`** sobre **los 72 objetos** (66 tablas + 6 vistas). La `anon_key` está en el bundle JS (por diseño de Supabase).
2. **Las 41 policies RLS son TODAS "allow all"** (permisivas, `cmd=ALL`, `qual=true`) → **la RLS no filtra nada**. Da igual RLS on u off.
3. **Tablas sin RLS** (sin siquiera policy): `pam_galicia_cc`, `anticipos_facturas`, `anticipos_proveedores`, `lotes_transferencias`, `arca_pdf_busqueda_log`, `reglas_ctas_import_arca`, todas las `caja_*`, `cheques`, `grupos_pago`, `comprobantes_historico` (msa/pam), `pam.comprobantes_arca`, todas las `tarjeta_*`, `productivo.terneros`, `productivo.pesadas_terneros`, **todo el schema `sueldos`**.

**Consecuencia:** cualquiera con la `anon_key` (extraíble del frontend) + `curl` puede **leer, modificar, borrar o truncar cualquier tabla**. El único "control" actual es la ofuscación de rutas URL en el frontend (`adminjms1320`/`ulises`), que **no protege la API**. → Hallazgo crítico **A-SEC-01** en `PENDIENTES.md` (hardening pendiente).

---

## 6. Relaciones y jerarquías

### 6.1 FKs reales (constraints en la BD)
```
public.cuotas_egresos_sin_factura.egreso_id      → public.egresos_sin_factura
public.egresos_sin_factura.template_master_id    → public.templates_master
public.egresos_sin_factura.template_origen_id    → public.egresos_sin_factura (self, clonar año)
public.anticipos_facturas.anticipo_id            → public.anticipos_proveedores
public.anticipos_proveedores.factura_id          → msa.comprobantes_arca
public.cuotas_egresos_sin_factura.grupo_pago_id  → msa.grupos_pago
msa.comprobantes_arca.grupo_pago_id              → msa.grupos_pago
msa.sicore_retenciones.factura_id                → msa.comprobantes_arca
msa.sicore_retenciones.anticipo_id               → public.anticipos_proveedores
msa.ventas_comprobantes.{venta_id,comprobante_id}→ msa.ventas / msa.comprobantes_venta
productivo.* → fuertemente normalizado (ciclos→ordenes, lineas→ordenes/stock, stock→categorias, etc.)
```

### 6.2 Links lógicos (SIN FK — los llena el motor/UI)
- Tablas de movimiento → `comprobante_arca_id` (factura, cross-schema), `template_id`+`template_cuota_id` (template), `sueldo_pago_id`, `anticipo_id`. No hay constraint porque cruzan schemas.

### 6.3 Jerarquías por módulo
- **Templates**: `templates_master` → `egresos_sin_factura` (template) → `cuotas_egresos_sin_factura` (cuotas). Cada cuota se concilia contra un movimiento.
- **SICORE**: `sicore_retenciones` cuelga de `comprobantes_arca` (o `anticipos_proveedores`). Quincenas con estado abierta/cerrada/declarada.
- **Anticipos**: `anticipos_proveedores` ↔ `comprobantes_arca` (vía `anticipos_facturas` N:N o `factura_id`).
- **Ventas**: `ventas` ↔ `comprobantes_venta` (N:N vía `ventas_comprobantes`).
- **Grupos de pago**: `grupos_pago` agrupa varias `comprobantes_arca`/`cuotas` en una OP.
- **Productivo (cría)**: `ciclos_cria` referencia 4 órdenes (servicio/tacto/parición/destete); `terneros` → `pesadas_terneros`; `detalle_descarte` → `ciclos_cria`.
- **Productivo (agrícola/sanidad)**: `ordenes_*` → `lineas_orden_*` → `stock_insumos`/`labores`/`categorias`.

---

## 7. Referencias

- **Columnas completas** → `ESTRUCTURA_BD_COLUMNAS.md` (apéndice auto-generado).
- **Cambios no-backup** (ALTERs post-reconstrucción) → `RECONSTRUCCION_SUPABASE_2026-01-07.md` § "CAMBIOS POST-RECONSTRUCCIÓN".
- **Pendientes** → `PENDIENTES.md` (incluye A-SEC-01 seguridad, A-BUG-12 conciliación tarjeta).
- **Diseños por módulo** (dimensión MÓDULOS, renombrados 2026-08-02): `MODULO_TEMPLATES.md`, `MODULO_SUELDOS.md`, `MODULO_SICORE.md`, `MODULO_SICORE_RETENCIONES.md`, `MODULO_TERNEROS.md`, `MODULO_CONCILIACION.md`, `MODULO_ANTICIPOS.md`, `MODULO_ARCA.md`, `MODULO_PRESUPUESTO.md`, `MODULO_ECHEQ.md`, `MODULO_DASHBOARD.md`, `MODULO_REGLAS_BANCARIAS.md`, `MODULO_AGROQUIMICOS.md`, `MODULO_MAIL_PROVEEDORES.md`.
- **Memorias clave**: `reference_schemas_expuestos_api`, `reference_supabase_schema_orden`, `project_tarjetas_modulo`.

---

## 8. Cómo mantener este doc al día

1. Correr las queries de relevamiento (tablas+RLS, columnas, FKs, vistas — ver `ESTRUCTURA_BD_COLUMNAS.md` para la de columnas).
2. Actualizar inventario (§3) y apéndice cuando se agregan/quitan tablas o columnas.
3. Todo ALTER que no esté en el backup → además registrarlo en `RECONSTRUCCION_SUPABASE`.
