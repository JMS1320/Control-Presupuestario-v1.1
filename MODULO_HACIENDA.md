# MÓDULO HACIENDA — Stock, movimientos y Planilla de Hacienda

> **Estado**: 🟢 **VIGENTE** — redactado 2026-08-20, actualizado 2026-08-21 con las correcciones
> aplicadas. Los §§ 1-11 describen **cómo está el módulo hoy**; los §§ 12-13 son la auditoría que
> las originó y se conservan porque tienen los motivos.
> **Origen**: el módulo se construyó entre febrero y abril de 2026 **sin documentación de dimensión**.
> Lo que había estaba desparramado en notas de sesión y en el propio código. Este archivo lo
> consolida y **verifica cada afirmación contra el código y contra la BD**.
>
> ⚠️ **Lo hecho el 20 y 21 de agosto está aplicado y pusheado, pero el usuario todavía no lo testeó
> en la app** — ver `PENDIENTES.md` § A-TEST-36, A-TEST-37 y A-TEST-38.

---

## 📖 Cómo leer este archivo

| Marca | Qué significa |
|---|---|
| 🟩 | **Objetivo** — leído en el código (con `archivo:línea`) o medido en la BD el 2026-08-20 |
| 🟨 | **Interpretado** — deducción mía sobre el *por qué* o el *para qué*. Es lo que puede estar mal |
| ❓ | **Pregunta abierta** — necesita respuesta del usuario, no la puedo sacar del repo |

Todo lo que sigue está en **un solo archivo**: `components/vista-sector-productivo.tsx`,
componente `TabHacienda()` (arranca en `:992`). No hay `lib/` propio: la lógica vive en el
componente. 🟨 *Eso explica por qué nunca se documentó: no hay un módulo que abrir, hay un tab.*

---

## 1 · Qué es el módulo

🟩 Lleva el **stock de hacienda por categoría** de Ea. Nazarenas, alimentado por un registro de
**movimientos**, y emite la **Planilla de Hacienda**: el reporte de existencias de un período, en
el formato de la planilla de papel del establecimiento.

🟩 Convive con `MODULO_TERNEROS.md`, que es el registro **individual** (caravana por caravana,
pesadas). Este módulo trabaja en **bulk**: "7 vacas al CUT", sin decir cuáles.

🟨 La frontera entre los dos es la unidad de conteo: **cabeza identificada** (terneros) vs
**cabezas por categoría** (hacienda). Los dos lados se tocan en dos puntos, y ambos son de una
sola dirección: un movimiento de hacienda puede dar de baja caravanas, pero una caravana nunca
genera un movimiento.

---

## 2 · Dónde vive el dato

🟩 Schema `productivo`. Estructura completa en `ESTRUCTURA_BD_COLUMNAS.md:129-131`.

| Tabla | Para qué | Estado al 2026-08-20 |
|---|---|---|
| `categorias_hacienda` | maestro de categorías (`nombre`, `activo`) | **15 filas**, 3 inactivas |
| `movimientos_hacienda` | el libro de entradas y salidas | **33 filas**, del 2026-02-15 al 2026-08-09 |
| `stock_hacienda` | *(existe)* | **VACÍA — y nadie la lee** |

### ⚠️ `stock_hacienda` es una tabla muerta

🟩 Tiene 0 filas y **ningún código la consulta**. El stock se calcula **en memoria** sumando los
movimientos, cada vez que se abre la pestaña (`:1139-1157`).

🟨 Es un resto del diseño original: la tabla se creó pensando en un stock materializado y después
se resolvió por recálculo. Mientras el volumen sea de decenas de movimientos no molesta; el día
que haya miles, recalcular todo en el browser en cada carga va a doler.

*(Ya está señalado en `PENDIENTES.md` como "vacía y sin dimensión" — líneas 5821, 5838 y 8045.)*

---

## 3 · Las categorías: 15 en la BD, 12 en la planilla

🟩 Las 15 de `categorias_hacienda`, con su saldo de movimientos al 2026-08-20:

| Categoría | Activa | ¿Columna en la planilla? |
|---|:--:|---|
| Vaca · Vaquillona Preñada · Vaca CUT/Descarte · Toro | ✅ | ✅ grupo **CRÍA** |
| Ternero Recria · Ternera Recria · Torito · Vaquillona de Reposicion · Novillo · Vaquillona Engorde | ✅ | ✅ grupo **RECRÍA / ENGORDE** |
| Ternero al Pie · Ternera al Pie | ✅ | ✅ bloque **Terneros** (subtotal aparte) |
| **Novillito · Ternera · Ternero** | ❌ inactivas | ❌ **no tienen columna** |

🟩 La planilla no lee las categorías de la BD: tiene la lista **escrita a mano** en el código
(`CATS_PLANILLA` en `:1344` y `CATS_TERNEROS` en `:1356`), y las cruza contra la BD **por nombre
en minúsculas** (`:1402`).

🟩 Un movimiento de una categoría que no está en esa lista **se descarta sin avisar**
(`:1418` — `if (col === undefined) return`). Hoy no se pierde nada: las 3 que quedan afuera están
inactivas y tienen **0 movimientos**.

🟨 Las 3 sueltas parecen categorías viejas reemplazadas por las de "Recria" (`Ternero` → `Ternero
Recria`). Se desactivaron en vez de borrarse, que es lo correcto. ❓ **Confirmar**: ¿`Novillito`
se dejó de usar a propósito, o falta darle columna?

---

## 4 · Los movimientos — el corazón del módulo

### 4.1 · Los seis tipos

🟩 El selector ofrece seis (`:983-990`). Al 2026-08-20 **sólo se usaron cuatro**:

| Tipo | Qué es | Filas hoy |
|---|---|---:|
| `ajuste_stock` | corrección manual, en ambos sentidos. **Es como entró el stock inicial** | 11 |
| `cambio_categoria` | reclasificación (un animal pasa de una categoría a otra) | 14 |
| `mortandad` | muerte | 6 |
| `venta` | venta | 2 |
| `compra` | compra | **0** |
| `nacimiento` | nacimiento | **0** |

❓ Los nacimientos **todavía no se cargaron nunca** porque la app es nueva y se van a empezar a
cargar pronto — decisión abierta de si entran por acá o desde el ciclo de cría.
🟨 Mientras tanto, las filas *Compras* y *Nacimientos* de la planilla salen siempre en cero, y eso
**no es un error**: es que el dato todavía no existe.

### 4.2 · 🔴 La convención de signos — lo más importante de este archivo

🟩 Medido sobre las 33 filas: **`cantidad` se guarda SIEMPRE POSITIVA**, salvo en dos casos.

| Tipo | Signo guardado | Verificado |
|---|---|---|
| `venta` | **positivo** | 2 de 2 positivas (4 y 55 cabezas) |
| `mortandad` | **positivo** | 6 de 6 positivas |
| `ajuste_stock` | **con signo** (+ suma, − resta) | 8 positivos, 3 negativos |
| `cambio_categoria` | **con signo** (− en el origen, + en el destino) | 7 y 7, **suma exacta 0** |

🟩 O sea: **el signo NO alcanza para saber si un movimiento suma o resta.** Hay que mirar el
`tipo`. Una venta de 55 cabezas está guardada como `+55` y **resta** 55 del stock.

🟨 Ésta es la regla que hay que tener presente antes de tocar cualquier cálculo del módulo, y la
que ya produjo una diferencia real — ver § 8.

### 4.3 · El cambio de categoría escribe DOS filas espejo

🟩 `guardarMovimiento()` (`:1210-1273`) inserta **dos** movimientos: `−N` en la categoría origen y
`+N` en la destino, ambos con `tipo = 'cambio_categoria'` y la misma fecha (`:1219-1231`).

🟨 De ahí sale un control que hoy no existe pero es gratis: **la suma de todos los
`cambio_categoria` tiene que dar exactamente 0**, porque ningún animal se crea ni desaparece al
reclasificarse. 🟩 Medido: **da 0** ✓. Si algún día no diera, hay una fila espejo perdida.

### 4.4 · Los efectos laterales sobre las caravanas

🟩 Tres, todos en una sola dirección (hacienda → terneros):

| Cuándo | Qué hace | Línea |
|---|---|---|
| `cambio_categoria` con individuos seleccionados | les cambia `categoria_id` | `:1235-1243` |
| `cambio_categoria` **hacia CUT/Descarte** con caravanas tipeadas | **da de alta** filas en `terneros`, parseando `"caravana - pelo - motivo"` | `:1245-1267` |
| `venta` o `mortandad` con caravanas elegidas | `activo=false` + `fecha_baja` + `motivo_baja` | `:1300-1316` |

🟨 El alta automática al CUT es la razón de que el detalle CUT de la planilla exista: son las únicas
caravanas que este módulo crea por su cuenta.

### 4.5 · Lo que NO tiene la tabla

🟩 `movimientos_hacienda` **no tiene columna de empresa ni de establecimiento**. Todo el módulo
asume Ea. Nazarenas, y la razón social está **escrita a mano** en el export (`:1543`, `:1691` y
`:1860`).

🟨 Choca con `CLAUDE.md` § Datos críticos (*"nunca hardcodear: sale de `DATOS_FISCALES` en
`lib/empresas.ts`"*), que existe porque el Libro IVA de PAM y MA salía con el CUIT de MSA impreso.
Hoy no molesta —hay un solo establecimiento— pero es el mismo patrón. ❓ Decisión del usuario.

---

## 5 · Cómo se calcula el stock (pestaña *Stock*)

🟩 `cargarDatos()` (`:1128-1157`) trae **todos** los movimientos y los acumula por categoría:

```
compra, nacimiento          →  suma cantidad
venta, mortandad            →  RESTA cantidad      (:1148-1149)
ajuste_stock, cambio_categ. →  suma cantidad con su signo
```

🟩 Sólo se muestran las categorías con cantidad **distinta de cero** (`:1155`).

🟨 Esta es la implementación **correcta** de la convención de § 4.2, y es el patrón contra el que
hay que comparar cualquier otro cálculo del módulo.

---

## 6 · La Planilla de Hacienda

### 6.1 · Qué es

🟩 Botón **Planilla** en el encabezado de Stock de Hacienda (`:1898-1901`). Abre un modal que pide
el período, muestra un **preview** en pantalla y permite descargar **Excel + PDF**.

🟨 Reproduce la planilla de papel del establecimiento: **categorías en columnas, conceptos en
filas**, y la existencia final como resultado.

### 6.2 · El período

🟩 Dos modos (`:1362-1378`):
- **Mes**: se elige mes y año → del día 1 al último día del mes.
- **Rango**: dos fechas libres.

### 6.3 · La grilla — 10 filas y 15 columnas

🟩 Las filas, en orden (`:1470-1481`), con las 4 resaltadas en negrita:

| # | Fila | Cómo sale |
|---|---|---|
| 1 | **Stock Anterior** | suma de todos los movimientos **anteriores** a la fecha de inicio |
| 2 | Compras | `compra` + los `ajuste_stock` **positivos** |
| 3 | Nacimientos | `nacimiento` |
| 4 | Reclas. + | `cambio_categoria` positivos |
| 5 | **Ingresos** | 2 + 3 + 4 |
| 6 | Ventas | `venta` |
| 7 | Mortandad | `mortandad` + los `ajuste_stock` **negativos** |
| 8 | Reclas. − | `cambio_categoria` negativos |
| 9 | **Egresos** | 6 + 7 + 8 |
| 10 | **Existencia Final** | 1 + 5 − 9 |

🟩 **Los ajustes de stock no tienen fila propia**: los positivos se muestran dentro de *Compras* y
los negativos dentro de *Mortandad* (`:1424-1427`). En la hoja *Detalle* sí se distinguen, con la
etiqueta `Ajuste + (en Compras)` / `Ajuste - (en Mortandad)` (`:1604`).

🟨 Que el ajuste inicial de 188 cabezas aparezca como "Compras" es engañoso a la vista, pero el
detalle lo aclara. ❓ ¿Preferís que los ajustes tengan su propia fila?

🟩 Las columnas: 10 categorías adultas (**CRÍA** 4 + **RECRÍA/ENGORDE** 6) · **Subtotal Adultos** ·
2 de terneros al pie · **Subtotal Terneros** · **Total General** (`:1445-1449`).

🟩 Al pie, **Total Vientres** = `Vaca` + `Vaquillona Preñada` de la Existencia Final (`:1492-1493`).

🟨 Se toma por **posición fija** (índices 0 y 1), no por nombre: si alguien reordena `CATS_PLANILLA`,
el Total Vientres cambia de significado en silencio.

### 6.4 · El detalle CUT / Descarte — la conciliación de la categoría

🟩 **No es una lista: es una conciliación** (rediseñado 2026-08-21, § 12.6). Tres bloques y un
cierre:

| Bloque | Qué entra |
|---|---|
| **A · Venían de antes** | `fecha_alta < desde` y vivos al arrancar (sin baja, o baja dentro del período) |
| **B · Entraron en el período** | `fecha_alta` entre `desde` y `hasta` |
| **C · Sin fecha de alta** | `fecha_alta` nula — **nunca se omiten**, decisión del usuario |

🟩 Cada fila lleva **Estado al cierre**: `Sigue en CUT`, o `Salió DD/MM — <motivo_baja>`.
🟨 **El motivo de salida no se clasifica**: se muestra el texto que cargó el usuario. Adivinar si
*"Vendido"* significa venta es peor que mostrarlo tal cual.

🟩 Los que salieron en períodos **anteriores** ya no aparecen (antes la lista crecía para siempre:
en agosto seguía mostrando 4 vacas vendidas en marzo).

🟩 **El cierre, y el mejor control del módulo:**

```
venían + entraron − salieron = quedan   (individuos, de `terneros`)
                    contra              Existencia Final CUT (cabezas, de `movimientos_hacienda`)
```

🟨 Las dos fuentes miden lo mismo en unidades distintas: **la grilla cuenta cabezas en bulk y esta
página cuenta individuos con nombre**. Si no coinciden, hay animales que entraron o salieron sin
identificar. Sale ✓ verde si cierra, y una **alerta roja** si no. Al 2026-08-21 agosto da **9
cabezas contra 8 individuos** — la vaquillona del 08/08 que entró sin caravana.

⚠️ **La página del CUT no siempre es la 3**: si el mes no tiene movimientos, la de detalle no se
genera y el CUT queda en la 2.

### 6.5 · Por qué el CUT filtra por `fecha_alta`

🟩 **Por qué `fecha_alta` y no `created_at`**: todos los registros de CUT se insertaron en la BD el
27/04/2026, sin relación con cuándo entraron realmente al CUT. `created_at` habría puesto a todos
en abril. Y no se puede sacar del movimiento porque **no hay FK entre `movimientos_hacienda` y
`terneros`**: el movimiento es bulk ("7 vacas al CUT") y no dice cuáles.

🟨 Es la decisión más fina del módulo y la más fácil de romper sin darse cuenta: **cualquier alta
nueva en `terneros` tiene que traer `fecha_alta` con la fecha del movimiento real**, no la del día
en que se cargó.

🟩 **Los dos caminos que alimentan el CUT ya la setean** (arreglado 2026-08-21, A-BUG-47). Los otros
tres que dan de alta terneros —el alta manual de la pantalla de Terneros y los dos importadores—
**todavía no**: `PENDIENTES.md` § A-BUG-51.

🟩 **Qué es un animal sin `fecha_alta`**: al 2026-08-21 son los **8 toros** cargados el 26/04/2026,
con caravana interna y sin oficial. Son **carga inicial de inventario** — ya estaban en el campo
cuando arrancó el sistema, así que la pregunta *"¿cuándo entró?"* no tiene respuesta. **No es un
error de carga**, y por eso van al bloque C en vez de omitirse.

---

## 7 · El export

🟩 `exportarPlanillaHacienda()` (`:1528-1879`). Genera **los dos archivos de una sola vez**.

**Excel** — 2 hojas:
- **Planilla**: encabezado de 4 líneas (`Ea. Nazarenas` / `de Martinez Sobrado` /
  `PLANILLA DE HACIENDA` / período), fila de grupos con merges, fila de categorías, las 10 filas,
  y el Total Vientres al pie.
- **Detalle**: un renglón por movimiento del período — **fecha, tipo, categoría, cantidad,
  contraparte y observaciones** — y debajo el bloque **DETALLE CUT/DESCARTE** con su cierre.

🟩 **Sin kilos ni montos** (2026-08-21, A-FEAT-35). Decisión del usuario: *"en esta planilla no debe
figurar montos de venta ni kilos de venta, sólo movimientos de stock"*. 🟨 Además, las tres columnas
de plata **no multiplicaban**: mostraban un precio bruto al lado de un monto neto (ver A-DAT-06).

**PDF** — apaisado A4, hasta 3 páginas: la planilla, el detalle de movimientos (sólo si hay) y el
detalle CUT (siempre en página propia). Paleta sepia, pie con período y paginación en todas.

🟩 Dos detalles del PDF que parecen arbitrarios y no lo son:
- **No hay doble encabezado de grupo**: el `colSpan` rompía `autoTable`, así que CRÍA y RECRÍA van
  como prefijo en la primera columna de cada grupo (`:1706-1719`).
- **`sanitizarPDF()`** (`:1775`) reemplaza flechas y bullets por guiones: helvetica no los tiene y
  salían como basura.

🟩 **Dónde se guarda**: si el browser soporta `showDirectoryPicker`, pregunta la carpeta y escribe
los dos archivos ahí; si se cancela o no lo soporta, caen en Descargas (`:1648-1676`).

🟩 **Nombre**: `Planilla_Hacienda_2026-08.xlsx` (mes entero) o
`Planilla_Hacienda_2026-02-15_2026-08-21.xlsx` (rango).

### 7.1 · Una planilla, o una por mes (2026-08-21, A-FEAT-39)

🟩 Con **Rango Personalizado** el modal pregunta *"¿Cómo querés el resultado?"*: **una sola punta a
punta** (default) o **una por cada mes del rango**, en una sola pasada.

🟩 Los meses de las **puntas se recortan al rango**, y el título lo dice
(*"15/02/2026 al 28/02/2026"*). El nombre del mes sólo se usa si el mes está **entero**.
🟨 Rotular *"Febrero 2026"* un archivo que tiene medio febrero sería mentir sobre su contenido.

🟩 La carpeta se elige **una sola vez** para toda la tanda, con progreso *"Generando N de M…"*. Si
el navegador no soporta `showDirectoryPicker`, **avisa antes**: sin carpeta cada archivo cae como
descarga suelta y el browser bloquea la descarga múltiple, dejando la tanda a medias sin avisar.

🟩 Con *una por mes* **no hay preview** (muestra una sola planilla) y el botón pasa a ser
*Exportar N planillas*.

🟩 **La estructura que lo hace posible**: `construirPlanilla(desde, hasta, label)` arma el Excel y el
PDF y **no guarda nada**; el orquestador `exportarPlanillaHacienda()` resuelve los períodos con
`resolverPeriodosExport()`, pide la carpeta una vez y guarda. 🟨 Sin esa separación no se podía
emitir una tanda.

---

## 8 · Qué controla la planilla, y contra qué

🟩 **La `Existencia Final` es una cuenta teórica**: dice lo que **debería** haber si todos los
movimientos se cargaron bien.

🟨 Por eso el control no es interno —la identidad `1 + 5 − 9` cierra siempre por construcción—
sino **externo**: se contrasta contra el **recuento físico** del campo. Si no coinciden, hay
movimientos sin cargar, mal cargados, o de más. *(Criterio del usuario, 2026-08-20.)*

### ✅ El arrastre de 16 cabezas — CORREGIDO el 2026-08-20

> Lo que sigue es **el diagnóstico original**, que se conserva porque explica el mecanismo y porque
> los números son la referencia del test ([A-TEST-35](PENDIENTES.md#a-test-35), ✅ testeado OK).
> **Ya está arreglado**: `Stock Anterior` mira el `tipo` en vez de sumar en crudo, la cadena
> engancha en los 6 eslabones y agosto cierra en **356**, igual que la planilla punta a punta y que
> la pestaña Stock.

### 🔴 El control que la planilla no hacía, y falla (diagnóstico del 2026-08-20)

🟩 **El `Stock Anterior` de un mes tiene que ser la `Existencia Final` del mes anterior.** Medido
sobre las 7 planillas mensuales generadas el 2026-08-20:

| Mes | Existencia Final | Stock Anterior del siguiente | Diferencia |
|---|---:|---:|---:|
| Febrero | 421 | 421 | ✅ 0 |
| Marzo | 417 | 425 | ❌ **+8** |
| Abril | 423 | 427 | ❌ **+4** |
| Mayo | 427 | 427 | ✅ 0 |
| Junio | 426 | 428 | ❌ **+2** |
| Julio | 427 | 429 | ❌ **+2** |
| Agosto | **372** | — | arrastre total **+16** |

🟩 La planilla **punta a punta** (que arranca en cero y no puede arrastrar) termina en **356**. La
mensual de agosto termina en **372**. La diferencia son exactamente las **16** cabezas del arrastre.

🟩 **La causa**: `Stock Anterior` suma los movimientos anteriores **en crudo** (`:1410` —
`stockAnterior[col] += m.cantidad`), sin mirar el `tipo`. Como las ventas y mortandades se guardan
positivas (§ 4.2), las **suma** en lugar de restarlas. Las filas del período no tienen el problema
porque usan `Math.abs` y después restan (`:1422-1423`, `:1440`).

✅ **Corregido el 2026-08-20 y testeado OK por el usuario.** Se arregló **el reporte, no el signo**
guardado en la BD — la decisión y su motivo están en § 12.8. Fue **una línea**, ningún dato tocado.

---

## 9 · Cómo incide en el presupuesto

🟩 **Hoy: no incide.** La planilla es un reporte de salida; nada la lee.

🟩 Y el presupuesto **no cuenta las cabezas desde acá**: `lib/ganaderia/disponibilidad.ts:12-13`
dice que la existencia sale de *"la pesada para el stock de hoy, el ciclo para los destetes
futuros"*.

🟨 O sea que hay **dos maneras distintas de responder "cuántas cabezas hay"** y nada las cruza.
Por § Norte de `CLAUDE.md` eso es un hueco, no un no-problema. Queda anotado acá; fuera del alcance
de la sesión del 2026-08-20 por decisión del usuario (*"nos vamos a concentrar en la planilla"*).

---

## 10 · Archivos

| Qué | Dónde |
|---|---|
| Todo el módulo | `components/vista-sector-productivo.tsx` → `TabHacienda()` (`:992`) |
| Cálculo de la planilla | `calcularDatosPlanilla(desde, hasta)` — compartido por preview y export |
| Armado de **una** planilla | `construirPlanilla(desde, hasta, label)` → devuelve `{ wb, doc }`, **no guarda** |
| Qué períodos emitir | `resolverPeriodosExport()` — una sola o una por mes, con recorte de puntas |
| Orquestador del export | `exportarPlanillaHacienda()` — carpeta una vez, loop, progreso |
| Export en lote (backup) | `scripts/export-planilla-hacienda.mts` |
| Registro individual | `MODULO_TERNEROS.md` |
| Estructura de tablas | `ESTRUCTURA_BD_COLUMNAS.md:129-131` · `ARQUITECTURA-BD.md:115` |
| Errores de tipos preexistentes | `ERRORES_CONOCIDOS.md` — 6 en este archivo, 2 son `categorias` no definido (`:379`, `:4506`) |

### El script de export en lote

🟩 `npx tsx scripts/export-planilla-hacienda.mts [carpeta]` genera **una planilla por mes** desde el
primer movimiento hasta hoy, **más una punta a punta**, cada una en **Excel y PDF** (los mismos dos
archivos que emite el botón de la app), e imprime la cadena de Stock Anterior / Existencia Final
para ver si engancha.

🟩 Única diferencia con el código de la app: `jsPDF` se importa como **named export**, porque el
default no es constructor fuera del browser. Todo lo demás —colores, merges, saltos de página,
`sanitizarPDF()`, el pie con paginación— es idéntico.

⚠️ **Replica la lógica de la app tal cual está, bugs incluidos** — es a propósito: sirve de foto del
estado actual, y una foto retocada no sirve para comparar. **Si se corrige la app, hay que corregir
el script igual, o el backup empieza a mentir.**

---

## 11 · ❓ Lo que sigue abierto

**Resueltos** desde la primera redacción: el arrastre de 16 cabezas (era **356**, corregido y
testeado) · los ajustes de stock **siguen** dentro de Compras/Mortandad, pero ya está decidido
darles fila propia ([A-FEAT-36](PENDIENTES.md#a-feat-36)) · las categorías descartadas en silencio
quedaron registradas ([A-BUG-50](PENDIENTES.md#a-bug-50)).

**Abiertas, todas en [A-DEC-03](PENDIENTES.md#a-dec-03):**

1. **`Novillito`** — ¿fuera de uso a propósito, o le falta columna en la planilla?
2. **Nacimientos** — nunca se cargó ninguno; cuando empiecen, ¿movimiento o ciclo de cría?
3. **Las 3 columnas siempre vacías** — ¿se dejan por fidelidad al formulario de papel?
4. **Adultos sin registro nominal** — ¿se formaliza, o se acepta la caravana como texto libre?
5. **La razón social hardcodeada** — ¿se deja, o sale de `lib/empresas.ts`? ([A-BUG-49](PENDIENTES.md#a-bug-49))
6. **`stock_hacienda`** — tabla vacía que nadie lee: ¿se materializa o se borra?

**Y una que no es del módulo pero salió de acá**: el **3 % sin explicación** de la venta del 04/08
([A-DAT-06](PENDIENTES.md#a-dat-06)). Ya no ensucia la planilla, pero el número sigue vivo en
ventas y presupuesto.

---

## 12 · 🔍 Auditoría planilla por planilla (EN CURSO — 2026-08-20)

> **Método acordado con el usuario**: se audita **una planilla por vez**, se anotan acá los errores
> y mejoras, y **recién con el panorama completo se encara la corrección en conjunto**. Nada se
> arregla mientras la auditoría está abierta.
>
> **Estado**: Febrero ✅ auditada · Marzo → en curso · Abril a Agosto → pendientes.
> Los archivos auditados están en `backup_planillas_hacienda_2026-08-20/` (Excel + PDF, 8 períodos).

### 12.1 · 🔴 EL HALLAZGO DE FONDO — el tacto genera `ajuste_stock`, no `cambio_categoria`

🟩 **No es un error de carga: lo hace el código.** Al registrar un tacto, `vista-sector-productivo.tsx:4513-4522`
inserta **dos movimientos de tipo `ajuste_stock`** para pasar las vacías a CUT:

```ts
{ fecha, categoria_id: catOrigen.id, tipo: 'ajuste_stock',
  cantidad: -vacias, observaciones: 'Vacias tacto - pasan a CUT' },
{ fecha, categoria_id: catCUT,       tipo: 'ajuste_stock',
  cantidad:  vacias, observaciones: 'Vacias tacto - ingreso CUT' }
```

🟩 Esas dos observaciones son **exactamente** las que aparecen en la planilla de febrero. O sea que
corregir los datos viejos **no alcanza**: el próximo tacto vuelve a generar lo mismo.

🟩 **Qué produce en el reporte** (§ 6.3): `ajuste_stock` negativo cae en **Mortandad** y positivo en
**Compras**. Entonces un pase a CUT sale como *"se murieron N vacas"* + *"se compraron N vacas de
descarte"*. En febrero: **8 animales vivos declarados muertos**.

🟨 **Propuesta — cambiar el `tipo`, no los signos.** El movimiento ya se escribe con la forma
correcta (`−N` en origen, `+N` en destino: el mismo par espejo de § 4.3). Lo único mal es la
etiqueta. Cambiando `'ajuste_stock'` por `'cambio_categoria'` en esas dos líneas, el pase a CUT cae
en *Reclas. −* / *Reclas. +*, que es donde corresponde, y la Mortandad deja de mentir. **No hay que
tocar la planilla.**

⚠️ **Dos partes, y las dos hacen falta**: (a) el código, para lo que viene; (b) los movimientos ya
cargados, para lo que está. La (b) es un `UPDATE` sobre datos reales → **requiere autorización
explícita del usuario** (`CLAUDE.md` § Datos).

### 12.2 · Tres cosas más que aparecieron al leer ese código

🟩 **a · El UUID del CUT está hardcodeado.** `:4510` → `const catCUT = 'ce627450-...'`. Verificado:
hoy apunta bien a *Vaca CUT/Descarte*. Pero **20 líneas más abajo** (`:4529`) la misma categoría se
busca **por nombre** (`nombre.toLowerCase().includes('cut')`). Dos maneras distintas de encontrar lo
mismo en el mismo bloque. 🟨 Un UUID literal en un proyecto que **ya reconstruyó la base una vez** es
una bomba de tiempo: si cambia, el insert apunta a otra categoría o a ninguna, y no avisa.

🟩 **b · El rodeo se cruza con la categoría por nombre exacto** (`:4509` →
`categoriasHacienda.find(c => c.nombre === ciclo?.rodeo)`). Hoy funciona porque los ciclos se llaman
`Vaca` y `Vaquillona Preñada`, que son nombres de categoría. 🟨 Si mañana un rodeo se llama
*"Rodeo General"*, `catOrigen` queda `undefined`, el `if (catOrigen)` **no tiene `else`** y **no se
registra ningún movimiento, sin un solo aviso**. El tacto se guarda, el stock no se mueve.

🟩 **c · Las caravanas del CUT se dan de alta SIN `fecha_alta`.** El insert en `terneros` de
`:4532-4546` (y el equivalente manual de `:1250-1265`) no setea `fecha_alta`. 🟨 Y el detalle CUT de
la planilla filtra por `fecha_alta <= hasta` (§ 6.4), que en Postgres **excluye los `NULL`**: una
caravana cargada por el próximo tacto **no aparecería en la planilla**. Hoy no se nota porque las 12
del CUT tienen `fecha_alta` cargada a mano en abril de 2026 — verificado: 0 nulos en CUT, pero **8
terneros con `fecha_alta` nula** en otras categorías.

🟩 **d · El tacto retrospectivo no mueve el stock.** Si se tilda *carga retrospectiva*, el bloque
entero de movimientos se saltea (`:4507`). El ciclo queda con sus `cabezas_vacias` y la hacienda no.
🟨 Es deliberado, pero deja ciclo y stock diciendo cosas distintas sin que nada lo señale.

### 12.3 · Planilla de FEBRERO 2026 — auditada

**Aritmética**: ✅ cierra en las 15 columnas. **Reclasificaciones**: ✅ `Reclas. − = Reclas. + = 194`.
**Terneros al pie terminan en 0**: ✅ correcto, se destetaron todos.
🟩 **El stock inicial cargado en febrero es correcto** (confirmado por el usuario).

| # | Qué dice mal el reporte | Causa | Dónde se arregla |
|---|---|---|---|
| **F-1** 🔴 | **Mortandad 8** (7 Vaca + 1 Vaq. Preñada) — animales vivos | § 12.1 | código + datos |
| **F-2** 🔴 | **Compras CUT/Descarte 8** — animales propios contados como comprados | § 12.1 | ídem |
| **F-3** 🔴 | La ternera perdida en Onetto sale como **Mortandad**. No murió: se perdió (*"no se señaló y no la reconoció como nuestra"*) | `ajuste_stock` negativo se rotula *Mortandad* | la planilla necesita **fila propia de Ajustes**, o un tipo `perdida` |
| **F-4** 🟡 | El **recuento inicial de 430 cabezas** figura en **Compras** | ídem | fila **Existencia Inicial / Recuento** |
| **F-5** 🟡 | El recuento es **al 29/01** pero está cargado el **15/02**: no existe en la planilla de enero y entra como movimiento de febrero | dato | decidir con el usuario |
| **F-6** 🟢 | 5 cabezas de *"cambio de sexo por control"* van dentro de Reclasificaciones: son **corrección de carga**, no movimiento del rodeo | diseño | sólo saberlo |

**La contradicción que resume todo**: la misma planilla de febrero declara **muertas** a 8 vacas
arriba y las lista como **Activa** en el detalle CUT abajo.

### 12.4 · Mejoras del reporte como documento (transversales, no de un mes)

| # | Qué | Por qué |
|---|---|---|
| **R-1** | El detalle **no tiene orden dentro del mismo día** (`.order('fecha')` sin criterio secundario). Las 6 filas del recuento salen Torito, Ternera, Vaq. Preñada, Ternero, Vaca, Toro | un reporte que se archiva tiene que salir siempre igual; y los dos lados de una reclasificación deberían quedar juntos (en febrero pasó de casualidad) |
| **R-2** | **No hay fecha de emisión** en el encabezado | un movimiento retroactivo cambia una planilla ya emitida y no hay forma de saber qué versión es cuál. Para papeles de trabajo importa |
| **R-3** | El cero se ve **`-` en el PDF y `0` en el Excel** (`fmtNum` sólo se aplica al PDF) | el mismo reporte con dos caras |
| **R-4** | Tres columnas **siempre vacías** (Vaq. Reposición, Novillo, Vaq. Engorde) en un PDF de 15 columnas a 6,5 pt | ❓ si el formulario de papel las lleva, se dejan |

### 12.5 · Planilla de MARZO 2026 — auditada

3 movimientos. **Aritmética**: ✅ cierra. **Cadena**: ✅ Stock Anterior 421 = Existencia Final de
febrero 421 — **es el último mes que engancha**.

| # | Qué | Veredicto del usuario |
|---|---|---|
| **M-1** 🟢 | El pase a CUT de marzo **está bien hecho** (`cambio_categoria`, *"Cambio categ → Vaca CUT/Descarte"*). Misma operación que febrero, resultado opuesto, porque se cargó desde el **modal de movimientos** y no desde el tacto | ✅ **correcto** — confirma que lo que hay que arreglar es el tacto (§ 12.1), no el camino manual |
| **M-2** | La venta del 30/03 (4 CUT) no tiene kilos, precio, monto ni cliente; el comprador está en observaciones (*"Via Pino Torillo"*) | ❌ **NO es bug** — *"yo no lo puse así, es otra cosa"*. Carga incompleta a propósito, no defecto del sistema. **Descartado** |
| **M-3** | *(mi lectura era incorrecta)* El motivo que muestra la pág. 3 es el de **ingreso** al CUT, y está bien que sea así | ❌ **no es bug** — pero **sí hay que mejorar la página 3**: ver § 12.6 |
| **M-4** 🟡 | De la grilla no surge que los 4 que entraron al CUT sean los 4 que salieron | 🔁 se resuelve con § 12.6, *"aunque no queda tan claro tampoco"* |
| **M-5** | El `+8` de abril es exactamente **2 × las 4 ventas de marzo** — la causa del arrastre es esta venta | ⏸️ **se ve después** |

🟩 **M-6 — lo encontré al revisar la página 3: la lista crece para siempre.** La consulta filtra
sólo por `categoria_id = CUT` y `fecha_alta <= hasta` (`:1455-1458`), **sin mirar `fecha_baja`**. Un
animal que pasó por el CUT queda en esa lista **para siempre**, aunque se haya vendido dos años
antes. En marzo ya se ve: 12 filas para una categoría que tiene 8 cabezas.

### 12.6 · 📄 Rediseño de la página 3 (Detalle CUT/Descarte) — propuesta

> **Criterio del usuario (2026-08-20)**: *"la pág. 3 está hecha justamente para entender la
> categoría descarte, que siempre tiene detalles y se precisa tener bien bien"*. Las páginas 1
> (tabla) y 2 (detalle de movimientos) **quedan como están** — en la 2 no se pueden poner motivos
> porque son distintos para cada individuo.

**Estructura propuesta: dos bloques, más una línea de cierre.**

```
┌─ A · VENÍAN DE ANTES ──────────────────  (= Stock Anterior de la columna CUT)
│  caravana · fecha alta · tipo · pelo · motivo de ingreso · ESTADO AL CIERRE
├─ B · ENTRARON EN EL PERÍODO ───────────  (= Reclas. + de la columna CUT)
│  mismas columnas
└─ CIERRE
     Venían de antes      8
   + Entraron             4
   − Salieron             4     (4 vendidas)
   = Quedan al cierre     8     ✓ coincide con Existencia Final CUT de la página 1
```

**Las salidas no llevan bloque propio**: van como **columna "Estado al cierre"** dentro del bloque
donde nació cada animal — `Sigue en CUT` · `Vendida 30/03` · `Muerta 12/05`. Así se ve de un vistazo
que de las 4 que entraron, 3 se vendieron y 1 sigue.

🟨 **Y esto responde la pregunta del usuario** (*"¿y si se agregan 4 pero se vendieron 3?"*): el
bloque B lista las 4 con su motivo de ingreso, la columna de estado marca 3 como *Vendida* y 1 como
*Sigue*, y la línea de cierre hace `8 + 4 − 3 = 9`.

**🎯 Y ahí aparece el mejor control del módulo, gratis.** La página 1 cuenta **cabezas** (sale de
`movimientos_hacienda`, que es bulk); la página 3 cuenta **individuos** (sale de `terneros`, que es
nominal). **Tienen que dar lo mismo.** Si no dan, es que una venta o una baja no se atribuyó a las
caravanas — que es justamente el error que hoy no se ve. El descuadre **es** el control:

> `Existencia Final CUT (pág. 1)` ≠ `Quedan al cierre (pág. 3)` → **falta atribuir N cabezas a
> caravanas concretas**

Es el criterio de `CLAUDE.md` § *Todo desarrollo termina con su control* aplicado acá: el camino
inverso, y visible. Y de paso **resuelve M-6**, porque el bloque A sólo incluye a los que estaban
vivos en el CUT al inicio del período, no a todos los que pasaron alguna vez.

❓ **Falta decidir**: qué pasa con un animal que entra y sale **dentro del mismo período** (aparece
en B con estado *Vendida*, y en el cierre suma en Entraron y en Salieron).
✅ **Resuelto por el usuario al auditar abril**: **sí debe aparecer**. Es el caso de marzo — las 4
entraron y se vendieron el mismo mes, y ahí el detalle **es correcto**. Lo que no debe aparecer es
un animal vendido en un período **anterior** (ver A-5).

### 12.7 · Planilla de ABRIL 2026 — auditada

4 movimientos. **Es el mes donde el arrastre se hace visible sin salir del documento.**

| # | Qué | Veredicto del usuario |
|---|---|---|
| **A-1** 🔴 | `Stock Anterior` de CUT = **16**; las cabezas reales son **8**. Medido: 8 (feb) + 4 (entran 29/03) + 4 (**la venta del 30/03 sumada en vez de restada**) = 16. Las demás columnas están bien porque ninguna otra había tenido ventas ni mortandades: **todo el `+8` del mes vive en una sola celda**, y la `Existencia Final` queda en 16 | ✅ de acuerdo — con **decisión de diseño**, ver abajo |
| **A-2** 🔴 | El mismo archivo dice **16 cabezas** en la pág. 1 y lista **8 activas** en la pág. 3 | ✅ **añadir el control** (§ 12.6) |
| **A-3** 🟡 | Las 2 mortandades salen **mudas** (observaciones vacías), pero el dato existe completo en `terneros`: caravanas **299** (*"aguachado, debajo de 100 kg, medio rengo"*) y **291** (*"empaste, inspección Gregorio"*). El reporte lee `movimientos_hacienda.observaciones` y el motivo vive en `terneros.motivo_baja` | ✅ ya lo había visto. **Dos cosas**: (a) que la mortandad muestre su motivo; (b) el detalle hoy **lista todo corrido** — la idea es **segmentarlo** (por motivo o similar). Propuesta a elaborar |
| **A-4** 🟢 | `Torito → Toro` (8 cab.) con `cambio_categoria`, correcto. Torito 15→7, Toro 8→16, Ternero Recría 100→98 | ✅ ok |
| **A-5** 🟡 | La pág. 3 vuelve a listar las 4 vendidas en marzo | ✅ **exacto: acá ya no deberían aparecer.** En **marzo sí** corresponde, porque ingresaron y salieron en el mismo mes |

### 12.8 · 🔑 DECISIÓN — se corrige el REPORTE, no el signo del movimiento

> **Decidido por el usuario, 2026-08-20.** Ante el arrastre de § 8, había dos caminos: cambiar cómo
> el reporte interpreta el signo, o cambiar el signo con que se guardan ventas y mortandades.
>
> **Se corrige el reporte.** Palabras del usuario: *"la app es muy extensa y tiene muchos lugares
> que afectan a otros… cambiar el signo podría corregir el reporte y descompaginar muchas otras
> cosas que hoy funcionan bien"*.

🟩 **La evidencia le da la razón, y conviene dejarla escrita para que nadie reabra la discusión**:
la pestaña Stock hace `cantidad -= m.cantidad` para venta y mortandad (`:1148-1149`), que **depende
de que estén guardadas en positivo**. Invertir el signo en la BD rompería el stock —que hoy anda
bien— para arreglar el reporte. Y `confirmar-venta.ts` también escribe en positivo.

**Alcance del fix**: una sola línea, `:1410`. `stockAnterior` tiene que mirar el `tipo` igual que lo
hace `cargarDatos()`, en vez de sumar en crudo. **Ningún dato se toca.**

⏸️ **No se ejecuta todavía**: la auditoría sigue abierta y se corrige todo junto al final.

### 12.9 · Planilla de MAYO 2026 — auditada

**Cero movimientos en el mes** — y aun así es la planilla más elocuente de la auditoría.

| # | Qué | Veredicto del usuario |
|---|---|---|
| **Y-1** 🔴 | El arrastre suma una **segunda columna**, ahora por mortandad: Ternero Recría arranca en **102** cuando abril cerró en **98** (100 + 2 muertes sumadas en vez de restadas). Ya no es un problema del CUT: pasa en cualquier columna que haya tenido una venta o una muerte | ✅ **correcto** |
| **Y-2** 🟡 | La página del CUT lista 12 caravanas: las 8 reales **más las 4 vendidas en marzo**, dos meses y dos cierres después | ✅ **sólo sobran las vendidas.** ⚠️ *Corrección del usuario a mi lectura*: **el detalle de las existentes tiene que estar SIEMPRE**, aunque se repita idéntico de un mes al otro. No es redundancia: es el inventario nominal de la categoría |
| **Y-3** 🟡 | Un mes vacío emite una hoja *Detalle* con encabezados y ninguna fila | ✅ **que diga "Sin movimientos en el período"** |

🟩 **El estado de mayo, medido** — la planilla de un mes en el que no pasó nada:

| Columna | Dice | Es | Error |
|---|---:|---:|---:|
| CUT/Descarte | 16 | 8 | **+8** |
| Ternero Recría | 102 | 98 | **+4** |
| **Total General** | **427** | **415** | **+12** |

🟨 Lo que hace a mayo el caso más fuerte: **no hay ningún movimiento en el detalle que permita
darse cuenta**. Las dos hojas se ven impecables y el total está mal en 12 cabezas.

⚠️ **Dato de formato que hay que tener presente al rediseñar**: la página del CUT **no siempre es la
3**. Cuando el mes no tiene movimientos, la página de detalle no se genera y el CUT queda en la
**página 2** (`:1793` — `if (detalleBody.length > 0)`). Referirse a ella por número es frágil.

### 12.10 · Planilla de JUNIO 2026 — auditada

1 movimiento: una mortandad de Ternera Recría el 26/06. Ternera Recría 82 → 81 ✓.

| # | Qué | Veredicto del usuario |
|---|---|---|
| **J-1** 🟡 | La misma muerte está **partida en dos lugares** y el reporte muestra una mitad. El movimiento trae *"Se la detectó pero no llegaron a salvar. Piquete Tapera Alfalfa"*; la caravana **222** (`032 010012326587`) trae `motivo_baja = "Empaste"` | ✅ **hipótesis confirmada**: la app registra **dos cosas distintas** —un **motivo** y una **observación**— y la planilla trae sólo una. **Hay que encadenarlas.** Y **la caravana siempre debe indicarse** |
| **J-2** 🔴 | La cadena engancha (427 = 427) **y el número igual está mal**: arrastra +12 desde mayo, porque mayo no tuvo ventas ni muertes y se limitó a pasar el error intacto | ✅ **hay que mejorar los controles** |
| **J-3** 🟡 | La página del CUT, idéntica: las mismas 12 filas con las 4 vendidas en marzo, ya tres meses atrás | ✅ ok (mismo caso que Y-2 / A-5) |

🟨 **Consecuencia de J-2 para el diseño del control** — vale la pena que quede escrito: verificar que
un mes **engancha** con el anterior detecta **el mes en que el error se produce**, no el error
**acumulado**. Un mes tranquilo lo camufla entero. El control que sirve es el otro: **cabezas
(página 1) contra individuos (página del CUT)**, y contra el **recuento físico**.

🟨 **Cómo implementar J-1** — no hay FK entre `movimientos_hacienda` y `terneros` (§ 6.4), así que la
mortandad se cruza por **fecha + categoría**: los `terneros` con `fecha_baja = fecha del movimiento`
y la misma `categoria_id`. Verificado que funciona en los 3 casos reales (15/04, 25/04, 26/06).
Y el cruce trae su propio control gratis: **si la cantidad del movimiento no coincide con la cantidad
de caravanas encontradas, hay muertes sin atribuir** — que es justamente la alerta que
`MODULO_TERNEROS.md` § 9 ya describe para la pantalla de terneros.

### 12.11 · Planilla de JULIO 2026 — auditada

1 movimiento: mortandad de Ternero Recría el 02/07. **Tercera columna contaminada.**

| # | Qué | Veredicto |
|---|---|---|
| **Jl-1** 🔴 | Ternera Recría arranca julio en **83**; junio cerró en **81**. Son 2 × la muerte de junio | ✅ ok |
| **Jl-2** 🟡 | Segundo caso de J-1, y más filoso: el movimiento dice *"Revisado por whatsapp, no mancha, sin causa comprobable"* y la caravana **184** dice `motivo_baja = "Muerte Súbita"`. **La planilla muestra la mitad que menos informa** | ✅ ok |
| **Jl-3** 🟡 | Página del CUT sin novedad: cuarto mes consecutivo mostrando las 4 vendidas en marzo | ✅ ok |

🟩 **El arrastre al cierre de julio, medido columna por columna:**

| Columna | Dice | Es | Error | Origen |
|---|---:|---:|---:|---|
| CUT/Descarte | 16 | 8 | **+8** | venta de 4 en marzo |
| Ternero Recría | 101 | 97 | **+4** | 2 muertes en abril |
| Ternera Recría | 83 | 81 | **+2** | 1 muerte en junio |
| **Total General** | **427** | **413** | **+14** | |

🟨 **El patrón, ya completo**: cada venta y cada muerte agrega al error **el doble de su tamaño**, y
el error **no se corrige nunca solo — sólo crece**. Cinco meses después del arranque, la planilla
exagera el rodeo en 14 cabezas.

### 12.12 · Planilla de AGOSTO 2026 — auditada (última)

5 movimientos, el mes más cargado: la venta de 55 terneros, un pase a CUT y 2 mortandades de adultos.

| # | Qué | Veredicto del usuario |
|---|---|---|
| **Ag-1** 🔴 | Las 3 columnas de plata no multiplican: 16.180 kg × $5.670 = **$91.740.600**, y el monto dice **$88.988.382** — exactamente el **97,0000 %** | ✅ **decisión: sacar plata y kilos de esta planilla.** *"En esta planilla no debe figurar montos de venta ni kilos de venta, sólo movimientos de stock"*. ⚠️ Y el 3 % **no son gastos de venta**: *"no tuvo gastos de venta, por eso lo cargué sin gastos"* → **queda sin explicación**, ver § 12.13-D |
| **Ag-2** 🔴 | Entra 1 vaquillona al CUT el 08/08 (grilla 16 → **17**) y **no existe ninguna caravana con `fecha_alta` en agosto**: la página nominal sigue listando las 8 de febrero | ✅ **debería figurar** — *"no sé por qué no figurará si el resto sí"*. **Causa encontrada**, ver abajo |
| **Ag-3** 🟡 | Las 2 mortandades traen la caravana **como texto libre** (*"Caravana C607 Negra"*, *"B708 Negra madre de ternero 127"*). Verificado: **C607 y B708 no existen en `terneros`** — la tabla nominal es de terneros, los adultos no están | ✅ **no es tan problema**: *"si no está el dato puede no ponerse nada, y si lo pongo en obs termina estando porque eso se concatena"* |
| **Ag-4** 🟡 | Cierre **372** contra **356** reales (+16). El 356 coincide exacto con la planilla punta a punta | ✅ ok. **Total Vientres 201 está correcto** |
| **❓** | ¿La vaquillona que pasó a CUT y la C607 que murió son el mismo animal? | ✅ **son DOS distintas**: una murió, la otra mal parió y se reclasifica. **La carga está bien** |

🟩 **Ag-2 — la causa, encontrada en el código.** El alta de caravanas al pasar algo a CUT está
condicionada a que el usuario **haya tipeado algo en el textarea**: `:1247` →
`if (esDestinosCUT && nuevoMov.caravanas.trim())`. Si el campo queda vacío, el movimiento se
registra igual y **no se crea ninguna caravana, sin un solo aviso**. Por eso la de febrero (cargada
por el tacto, con caravanas tipeadas) sí figura y la de agosto no.

🟨 Es el mismo modo de falla de siempre: **el silencio miente**. Y es exactamente lo que el control
de § 12.6 detecta — si la grilla dice 17 y la página nominal lista 8, falta ponerle nombre a 9.

---

## 13 · 🗺️ PANORAMA COMPLETO — auditoría cerrada (2026-08-20)

> **Las 7 planillas mensuales + la punta a punta, auditadas una por una con el usuario.** Cada ítem
> lleva su veredicto.
>
> ⚠️ **Este panorama es del 2026-08-20 y ya se ejecutó buena parte.** El estado vivo de cada ítem
> está en `PENDIENTES.md`; acá se conserva el diagnóstico con sus motivos, que es lo que no
> conviene perder.
>
> **Hecho al 2026-08-21 (8 de 21)**: `A-BUG-44` (el arrastre, ✅ testeado) · `A-BUG-45` + `A-DAT-05`
> (el tacto y los 4 movimientos de febrero) · `A-BUG-46` (aviso sin bloquear) · `A-BUG-47`
> (`fecha_alta`) · `A-FEAT-34` (página del CUT + control) · `A-FEAT-35` (fuera plata y kilos) ·
> `A-FEAT-39` (export de varias planillas, no estaba en la lista original: lo pidió el usuario
> después).
>
> **Pendiente**: `A-FEAT-36/37/38` (fila de Ajustes, mortandad completa, formato) ·
> `A-BUG-48/49/50/51` (deuda del código) · `A-DEC-03` y `A-DAT-06` (decisiones).

### A · El número, que es lo primero

| | Cabezas |
|---|---:|
| Lo que dice la planilla de agosto | **372** |
| Lo que hay | **356** |
| Error acumulado | **+16** |

🟩 Confirmado por dos caminos independientes: la planilla **punta a punta** (que arranca de cero y
no puede arrastrar) da **356**, y la suma columna por columna también. El error se reparte en
CUT **+8**, Ternero Recría **+6**, Ternera Recría **+2**.

🟨 **La regla del arrastre**: cada venta y cada muerte suma al error **el doble de su tamaño**, para
siempre. Nunca se corrige solo. Un mes sin movimientos no lo genera pero tampoco lo limpia — lo
pasa intacto (junio).

### B · Lo que hay que corregir — ordenado por lo que más duele

| # | Qué | Dónde | Origen |
|---|---|---|---|
| **1** 🔴 | **`Stock Anterior` tiene que mirar el `tipo`**, no sumar en crudo. Una línea. **Ningún dato se toca** | `:1410` | § 8, A-1 |
| **2** 🔴 | **El tacto debe generar `cambio_categoria`, no `ajuste_stock`.** Cambiar el `tipo` en 2 líneas; los signos ya están bien. **+ corregir los 4 movimientos de febrero** (requiere OK explícito: son datos) | `:4515`, `:4519` | § 12.1, F-1/F-2 |
| **3** 🔴 | **Sacar plata y kilos del detalle**: la planilla es de **movimientos de stock**, no de ventas | hoja *Detalle* y pág. de movimientos | Ag-1 |
| **4** 🔴 | **Rediseñar la página del CUT**: bloque *venían de antes* + bloque *entraron en el período*, columna **Estado al cierre**, y línea de cierre. **No listar los vendidos en períodos anteriores**; sí los que entran y salen dentro del mismo período | § 12.6 | M-3, A-5, Y-2 |
| **5** 🔴 | **Control cabezas (grilla) vs individuos (nominal)** — el mejor control del módulo, y sale gratis del punto 4 | § 12.6 | A-2, Ag-2 |
| **6** 🔴 | **Al pasar algo a CUT sin tipear caravanas, avisar.** Hoy se registra en silencio y el animal queda sin nombre | `:1247` | Ag-2 |
| **7** 🟡 | **Fila propia para los Ajustes.** Hoy `ajuste +` se rotula *Compras* y `ajuste −` se rotula *Mortandad*: las dos mienten | § 6.3 | F-3, F-4 |
| **8** 🟡 | **Fila / concepto de Existencia Inicial** para el recuento de arranque, hoy dentro de *Compras* (430 cabezas) | § 6.3 | F-4 |
| **9** 🟡 | **La mortandad tiene que mostrar su motivo, su observación y su caravana**, encadenados. El cruce es por **fecha + categoría** (no hay FK) | § 12.10 | A-3, J-1, Jl-2 |
| **10** 🟡 | **Segmentar el detalle de movimientos** (hoy lista todo corrido) — por motivo o similar, **a definir** | hoja *Detalle* | A-3 |
| **11** 🟡 | **"Sin movimientos en el período"** en vez de una tabla vacía | pág. de movimientos | Y-3 |
| **12** 🟡 | **Orden estable del detalle** (hoy `.order('fecha')` sin criterio secundario) y los dos lados de una reclasificación juntos | `:1600` | R-1 |
| **13** 🟡 | **Fecha de emisión** en el encabezado | encabezado | R-2 |
| **14** 🟡 | El cero se ve **`-` en PDF y `0` en Excel** | `fmtNum` | R-3 |

### C · Deuda del módulo que apareció leyendo el código (no salió de las planillas)

| # | Qué | Dónde |
|---|---|---|
| **15** 🔴 | **`fecha_alta` no se setea** al crear caravanas (ni en el tacto ni en el alta manual). La página del CUT filtra por `fecha_alta <= hasta`, que **excluye los NULL**: una caravana nueva no aparecería | `:1250`, `:4532` |
| **16** 🟡 | **UUID del CUT hardcodeado** (`:4510`) y, 20 líneas después, la misma categoría buscada **por nombre** (`:4529`) | § 12.2-a |
| **17** 🟡 | **Rodeo ↔ categoría por nombre exacto**, y el `if` **no tiene `else`**: si no matchea, no se registra el movimiento y no avisa | `:4509` |
| **18** 🟡 | **Tacto retrospectivo no mueve el stock**: el ciclo queda con sus vacías y la hacienda no | `:4507` |
| **19** 🟡 | **La razón social está hardcodeada** contra `CLAUDE.md` § Datos críticos | `:1543`, `:1691`, `:1860` |
| **20** 🟡 | **Movimientos de categorías fuera de la planilla se descartan en silencio** (hoy inofensivo: las 3 que faltan están inactivas y con 0 movimientos) | `:1418` |
| **21** 🟢 | **`stock_hacienda` es una tabla muerta** (0 filas, nadie la lee) | § 2 |

### D · Decisiones tomadas — no se re-discuten

1. **Se corrige el REPORTE, no el signo de los movimientos** (§ 12.8). Motivo: la pestaña Stock y
   `confirmar-venta.ts` ya dependen de la convención positiva; invertirla rompería lo que anda.
2. **La planilla es de movimientos de stock**: sin kilos ni montos de venta (Ag-1).
3. **El detalle de las existentes en CUT va siempre**, aunque se repita idéntico mes a mes (Y-2).
4. **Un animal que entra y sale en el mismo período sí aparece** (marzo es el caso correcto).
5. **Las 4 vacas de marzo y las 2 vaquillonas de agosto están bien cargadas** — confirmado por el usuario.

### E · Descartado como bug

- **M-2** — la venta de marzo sin kilos, precio, monto ni cliente: *"yo no lo puse así, no es bug"*.
- **M-3** — el motivo que muestra la página del CUT es el de **ingreso**, y está bien que sea así.
- **Ag-3** — la caravana de un adulto como texto libre en observaciones: aceptable, *"eso se concatena"*.

### F · Preguntas abiertas

1. 🔴 **El 3 % de la venta de agosto no tiene explicación.** El usuario dice que no hubo gastos de
   venta, pero `monto_total` es exactamente el 97 % de `peso × precio`. Sale de esta planilla (punto
   3), pero **el número sigue vivo donde se use** — ventas, presupuesto.
2. **`Novillito`** — ¿fuera de uso a propósito, o le falta columna?
3. **Nacimientos** — cuando se empiecen a cargar, ¿movimiento o ciclo de cría?
4. **Razón social** — ¿se deja hardcodeada (un solo establecimiento) o sale de `lib/empresas.ts`?
5. **Tres columnas siempre vacías** (Vaq. Reposición, Novillo, Vaq. Engorde) — ¿el formulario de
   papel las lleva?
6. **Adultos sin registro nominal** — ¿se formaliza alguna vez o se acepta el texto libre?

### G · Lo que sigue

⏸️ **Nada ejecutado.** Al pasar a la etapa de corrección, estos ítems tienen que bajar a
`PENDIENTES.md` con su ID y su marca `@productivo`, porque son trabajo pendiente y esa es su
dimensión. Este archivo queda como el **diseño y el diagnóstico**; la lista de trabajo vive allá.

---

## 14 · 🌽 Costeo de recría — el modelo acordado (2026-08-25/26)

> **Estado: diseñado y validado con datos reales, NO implementado.** El trabajo con su ID vive en
> `PENDIENTES.md` § [A-FEAT-43](PENDIENTES.md#a-feat-43) y § [A-FEAT-44](PENDIENTES.md#a-feat-44).
> Acá va el **diseño**, que es lo que corresponde a esta dimensión.

### 14.1 · El problema

Los terneros de recría comen de una ración común. El 04/08/2026 se vendieron 55 y quedó el resto.
¿Cuánto maíz y cuánto concentrado le corresponde a lo vendido? Tomar inventario en cada venta no es
realista — y el usuario lo dijo así: *"sería raro lograr tomar stock a cada venta"*.

### 14.2 · Las cuatro reglas

1. **Comprar no es consumir.** La compra entra a un stock (activo). El costo es el **consumo**. Con
   eso, el sobrante se queda en el stock y no se le carga a nadie — y desaparece la necesidad de
   inventariar en cada venta.
2. **El consumo del período no se estima, se mide**: `stock inicial + entregas − stock final`.
3. **Un corte existe cuando hay una MEDICIÓN, no cuando llega un camión.** El sistema tiene que
   soportar el modo grueso (sólo inicio y fin) y el fino (mediciones intermedias) con la misma
   lógica — sólo cambia cuántos tramos hay.
4. **La clave sólo reparte.** Como el total ya es real, las participaciones suman 1: cambiar el
   criterio de reparto **no puede mover el total**.

### 14.3 · La clave: kilo-día, siempre

`kilo-día de un grupo = Σ (cabezas × peso × días presentes)`

El peso sale de las **pesadas reales** (`fecha_peso` / la curva quebrada por tramos), nunca de una
ganancia estimada. Motivo del usuario: *"cuando se da la ración diaria se sabe que los más pesados
comen más que los livianos — no es invento mío"*.

⚠️ **Una sola regla, tanto si la ración es por día como a discreción.** El usuario fue explícito:
*"en la app yo no puedo variar formas de cálculo en vivo"*. Lo que cambia entre un modo y otro es el
**dato que se carga**, no la fórmula.

**Y el % de peso vivo deja de ser un supuesto**: sale de dividir el consumo medido por el kilo-día
del rodeo. Con los datos reales dio 1,07 / 1,46 / 1,54 % — creciente y coherente. Si diera 0,4 %,
falta una entrega: **el parámetro se vuelve un control**.

### 14.4 · Pesos: cuál se usa para qué

| Para | Qué peso | Por qué |
|---|---|---|
| El **consumo** (kilo-día) | **vivo / bruto** | el animal come según lo que pesa parado |
| La **plata** (valor de entrada, venta) | **neto**, con el 3 % de desbaste | es lo que se cobra y se paga |

El 3 % es el **desbaste** — quedó resuelto en `A-DAT-06`.

### 14.5 · La mortandad

Es un costo y se adjudica. **Los muertos se valúan a su propio peso al destete**, no al promedio del
grupo: usar el promedio × la cantidad de sobrevivientes dejaba una diferencia de $802.396 que el
control de rodeo destapó.

⚠️ **Qué es exacto y qué es convención:** el **total** (entradas vs. salidas) es exacto. Los
**parciales** llevan convención — a qué grupo se le carga el animal que murió antes de que la venta
existiera. Pero **la convención mueve plata entre grupos y nunca cambia el total**, y por eso el
total es el control de los parciales.

### 14.6 · La cadena de compra, que hoy está cortada

Son **tres** momentos, no dos, y cada uno trae conocimiento distinto:

| Momento | Qué se sabe | Qué mueve |
|---|---|---|
| **Compra / pedido** | cantidad acordada | nada |
| **Entrega** | cantidad recibida y **la fecha real** | **el stock** |
| **Factura** | **el precio** | el costo y la contabilidad |

⚠️ **No coinciden.** Longo facturó el 13/07 lo entregado el 24/06, y facturó 20,1 t de 25 entregadas.
**Si el stock dependiera de la fecha de factura, los tramos de consumo salen mal.** Hoy
`movimientos_insumos` no tiene `factura_id` y el maíz cae como gasto del mes sin llegar nunca al
lote → `A-FEAT-44`.

### 14.7 · Lo que el modelo dejó a la vista

🔴 **La alimentación es el 5,5 % del valor del animal; el precio de entrada de cría a recría es el
93 %.** Afinar el reparto del maíz mueve mucho menos que acertar ese precio. Hoy se usa $7.000/kg
uniforme — pero `precios_hacienda` **ya tiene bandas de peso** y `resolverPrecioHacienda()` ya las
resuelve: la misma función que valúa la venta puede valuar la entrada, y los 55 caen en una banda
distinta a la del resto.

### 14.8 · Los Excel tienen fecha de vencimiento

`scripts/maqueta-costo-recria.mts` genera `Maqueta_Costo_Recria.xlsx` (11 hojas, 429 fórmulas de
Excel — no valores, para que sea auditable) y `Resumen_Costo_Recria.xlsx` (una carilla + una solapa
por rodeo). **Cuando la app calcule esto, los dos pasan a ser el CASO DE PRUEBA, no la herramienta.**
Si sobreviven como herramienta, se convierten en una segunda fuente de verdad. Está escrito adentro
de los propios archivos.

---

## 15 · 🗺️ EL MAPA DEL CIRCUITO — qué pregunta contesta cada pantalla

> **Leer esto antes de tocar recría, margen o costos de producción.** Nació el 2026-08-26 de un
> pedido del usuario: no se podía discutir el plan sin saber para qué sirve cada lugar, porque
> **varias pantallas parecían hacer lo mismo**. Ítem: [A-FEAT-45](PENDIENTES.md#a-feat-45).

Siete pantallas intervienen. Agrupadas por **la pregunta que contesta cada una**, no por el orden en
que se recorren.

### 15.1 · Las tres decisiones de diseño

| Dónde | Qué vive ahí | Qué NO vive ahí |
|---|---|---|
| **Presupuesto → Margen por actividad** | **la plata**: ingresos, costos, resultado | lo productivo |
| **Productivo → Recría → el ciclo** | **la eficiencia**: kg, mortandad, conversión, kg/ha/año | ⚠️ **la plata** |
| **El tramo del lote** | **el puente**: lo único que conecta el plan con el dinero | — |

*El usuario lo fijó así: el cuadro del ciclo "siempre fue la síntesis del ciclo productivo… no está
pensado tanto para costos o ganancia sino la eficiencia productiva; kg producidos por ha por año
sería la última conclusión". Por eso el costeo de recría **no va ahí**: el cuadro no tiene que crecer.*

### 15.2 · Grupo A — Lo que pienso hacer *(el plan)*

**`Presupuesto → Actividades y costos`** · *¿qué actividad voy a hacer y qué necesita?*

La **receta, en abstracto**: la recría engorda tanto por día, come tanto, y su comida es maíz y
concentrado. No habla de animales concretos ni de fechas.

⚠️ **La receta no produce ningún número por sí sola.** Es una definición esperando que alguien le
diga a qué animales aplicarla. Son **índices productivos** que después se aplican a cantidades de
stock según la campaña.

### 15.3 · Grupo B — A quién y cuándo *(el puente)*

**`Productivo → Evolución Rodeo →` los lotes, y adentro los tramos**

El **LOTE** es un paquete de animales que se va a vender:

| Campo | Qué significa | A dónde va |
|---|---|---|
| `fecha_disponible` | desde cuándo **se podría** vender | el presupuesto ubica el ingreso en el tiempo |
| `fecha_venta_estimada` | cuándo se vende (o se vendió) | el mes en que entra la plata |
| cantidad · peso · precio | el tamaño de la venta | el **ingreso** del Margen y del Presupuesto |

El **TRAMO** —adentro del lote— es la pieza central:

```
     TRAMO = "este lote hizo esta actividad entre estas dos fechas"
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
     CURVA DE PESO              COSTO DE ALIMENTACIÓN
  (cuánto pesa al vender)      (cuánta comida consumió)
            │                           │
            ▼                           ▼
     el INGRESO del margen        el COSTO del margen
                                  y la fila mensual de la grilla
```

**Los lotes de cría con fecha 2027/2028 son PROYECCIONES y está bien que lo sean** — la realidad los
corrige después. El lote de los 55 es distinto: esa venta ya ocurrió y sus números ya son reales.

### 15.4 · Grupo C — Cuánto gané y cuándo entra la plata

**`Presupuesto → Margen por actividad`** · *¿este negocio deja plata?*

| | Hoy |
|---|---|
| ¿Muestra lo ocurrido o lo teórico? | 🔴 **sólo lo teórico** — no lee ni una factura |
| ¿Qué campaña? | **contable** (jul → jun) |
| Ingresos | de los lotes |
| Costos | de las recetas |
| Precios | de `precios_hacienda`, cargada a mano |

Que sea 100 % teórico **no es un defecto de diseño**: la intención siempre fue *presupuestar hacia
adelante y cerrar con datos reales*. **Lo que falta es la segunda mitad.**

**`Presupuesto → la grilla → Costos de producción`** · *¿cuándo sale la plata?*

⚠️ **NO es el mismo cálculo que el Margen.** Son **dos motores distintos** leyendo la misma receta, y
cada uno sabe la mitad → [A-BUG-56](PENDIENTES.md#a-bug-56).

### 15.5 · Grupo D — Qué pasó de verdad

- **`Presupuesto → Cuentas → 42305`** · *¿cuánto gasté realmente?* — hoy excluida en las dos
  direcciones; la regla correcta es **apagada hacia adelante, llena hacia atrás** →
  [A-DEC-04](PENDIENTES.md#a-dec-04). Debajo cuelgan **4230501 MAÍZ** y **4230504 CONCENTRADO**.
- **`Productivo → Insumos → Stock`** · *¿qué tengo en el campo?* — 🔴 el maíz y el concentrado **no
  existen** como productos.

### 15.6 · Grupo E — Qué tan bien lo hice

**`Productivo → Recría / Engorde →` el ciclo** · *¿fui eficiente?*, **no** *¿gané plata?*

Dos correcciones pedidas por el usuario el 2026-08-26:
1. **Tiene que decir la cantidad con que ARRANCÓ, no la cantidad menos mortandad.** Hoy dice 185
   (103 + 82), que es la foto de hoy; debe decir **189**.
2. **El número tiene que salir de la salida de cría** —los destetados con sus kilos, con el promedio
   para los que no se pesaron— **y no de la pesada**, que dejó 4 animales afuera.

✅ Y quedó confirmado: **el precio de transición es UN solo número que vale para los dos lados** —
venta de cría = entrada de recría. Es lo que hace que un resultado cierre y el otro abra.

### 15.7 · Dónde va la maqueta del costeo de recría

**No es una pantalla.** Es un cálculo que se derrama en tres lugares que ya existen:

| Lo que hace | A dónde va | Por qué ahí |
|---|---|---|
| **Mide** el consumo real | Insumos → Stock | es un hecho físico |
| **Reparte** entre grupos | el motor (§ 15.4) — no es pantalla | es cálculo, no información |
| **Muestra** el resultado por grupo | Margen, desplegando Recría | ahí ya vive la plata |

**Y al ciclo (§ 15.6) no va nada de plata.**

### 15.8 · Campaña contable vs productiva — conviven sin pantalla nueva

**El tramo no sabe qué es una campaña**: sabe entre qué fechas pasó.

- **Sumado por meses** → el año contable (Margen, grilla).
- **Entero** → la camada (ciclo productivo).

Una carga, dos lecturas. Lo único nuevo es **una apertura adentro del Margen** para ver el resultado
por grupo — y que la suma dé exacto **es el control**.

---

## 16 · 📥 El circuito del INSUMO — dónde está cada cosa

> Se cerró el 2026-08-28 cargando la recría 2026 punta a punta. Complementa el § 15 (el mapa de
> pantallas) del lado de los insumos. Trabajo y bugs: `PENDIENTES.md` § A-FEAT-44 y A-FEAT-47.

### 16.1 · Las cuatro piezas, y qué aporta cada una

```
   COMPRA          ENTREGA            RESPALDO            MEDICIÓN
   (no existe)  →  mueve stock    →   trae el precio  →   dice el consumo
                   movimientos_       entrega_factura      mediciones_
                   insumos                                 insumo
```

| Pieza | Tabla | Sin ella |
|---|---|---|
| **Entrega** | `movimientos_insumos` (tipo `compra`) | no hay stock ni tramos |
| **Respaldo** | `productivo.entrega_factura` | el precio se tipea y no se puede auditar |
| **Medición** | `productivo.mediciones_insumo` | el consumo se estima, no se mide |
| **Pedido** | — | 🔴 no existe → [A-FEAT-55](PENDIENTES.md#a-feat-55) |

### 16.2 · El respaldo es MUCHOS A MUCHOS, y tiene que serlo

Lo facturado y lo entregado **no coinciden ni en fecha ni en cantidad**. El caso testigo, real:

| | |
|---|---|
| FC 13/07 facturó **25 t** | se entregaron **20,1 t** el 24/06 |
| FC 14/08 facturó **20,1 t** | se entregaron **25 t** el 24/07 |

Las 4,9 t de diferencia son un **anticipo** que viaja con su propio precio. Un `factura_id` en el
movimiento obligaría a inventar una correspondencia que no existe.

⚠️ **El stock lo mueve la ENTREGA.** Si dependiera de la fecha de factura, los tramos de consumo
saldrían mal — y de los tramos sale el costo de cada grupo.

### 16.3 · El respaldo no siempre es una factura de ARCA

`entrega_factura.origen` distingue:

| origen | apunta a | el neto es |
|---|---|---|
| `arca` | `comprobantes_arca` | `imp_neto_gravado` |
| `template` | **la cuota** de `cuotas_egresos_sin_factura` | ⚠️ **el `monto`** — no hay IVA discriminado |

Se vincula **la cuota, no el template**: la cuota tiene fecha y monto concretos. El caso real es el
maíz del 16/03, que entró como *Otros Gastos · MAIZ*.

📌 `factura_id` **nunca tuvo FK**, y eso es lo que permitió sumar el segundo origen sin migrar nada.

### 16.4 · La foto del maíz 2026, como quedó

| Entrega | Kg | Respaldo | Precio |
|---|---|---|---|
| 16/03 | 1.740 | **template** maíz Castillo | $192,99 |
| 06/05 | 7.300 | FC 0001-00000024 | $262,00 |
| 02/06 | 7.560 | FC 0001-00000025 | $254,00 |
| 17/06 | 4.960 | FC 0003-00000017 | $238,35 |
| 24/06 | 20.100 | FC 0002-00000516 | $267,50 |
| 24/07 | 25.000 | FC 0002-00000516 (4.900) + FC 0002-00000525 (20.100) | $267,14 *calculado* |
| **Total** | **66.660** | **los 7 respaldos cierran** ✅ | |

Concentrado: 22/07 · 3.000 kg de **Novillo 35 10** · $729 · cierra contra Biofarma.

⚠️ **El 16/03 no está en ARCA** y el **06/05** tiene la factura fechada el **11/05**: dos casos
donde la fecha del papel no es la del camión.

### 16.5 · Lo que todavía no sabe el sistema

**Cuántos kilos declara una factura.** Sin ese dato no se puede distinguir *«el precio está raro»*
de *«esta factura cubre más de lo que llegó»* — y por eso hace falta mostrar la división y comparar
contra la mediana de las otras entregas. Ver `KNOWLEDGE.md` § *Derivar un precio dividiendo*.
