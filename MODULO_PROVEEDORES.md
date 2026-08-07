# Proveedores — el maestro de contrapartes

> Cómo está pensado `public.proveedores`: qué guarda, **quién lo escribe**, **quién lo lee** y
> qué se rompe aguas abajo cuando le falta un dato.
>
> **Última actualización**: 2026-08-07 (creación del archivo + ficha de proveedor, commit `6cc357f`)
>
> Fronteras con las otras dimensiones: la **estructura** de la tabla está en
> `ESTRUCTURA_BD_COLUMNAS.md`; **cómo se opera** la ficha está en `MANUAL-USO.md` § Ficha de
> proveedor; **qué falta** está en `PENDIENTES.md`. Acá va el diseño y el porqué.

---

## 1. Qué es y por qué importa

`public.proveedores` es el **maestro de contrapartes**: una fila por CUIT, sirva de **proveedor**
(le compramos), de **cliente** (le vendemos) o de las dos cosas. Al 2026-08-07 hay **154 filas**,
152 marcadas `es_proveedor` y sólo 3 `es_cliente` — ese desbalance no es real, es el síntoma del
bug de la § 4.3.

No es una agenda de contactos. Es **de dónde salen los datos que otros módulos necesitan para
actuar**: el CBU con el que se arma la transferencia, el mail al que se avisa el pago, el nombre
con el que se muestra un movimiento del banco, el CUIT con el que el motor pre-filtra candidatos.
Un comprobante cuya contraparte no está acá **no falla**: sigue de largo y rompe algo tres pasos
después. Por eso la regla de contrapartes es una regla de `CLAUDE.md` y no una recomendación.

### La regla que lo gobierna
> **Si entra un comprobante, su contraparte tiene que quedar en `public.proveedores`.**
> Vale para compras y ventas, y para todas las vías: importadores masivos y altas manuales.
> Siempre **upsert**, nunca sólo `UPDATE` — un `UPDATE` sobre un CUIT que no existe matchea
> 0 filas, **no falla**, y el hueco queda invisible.

---

## 2. Qué guarda — las 29 columnas por para qué sirven

| Grupo | Columnas | Quién las consume |
|---|---|---|
| **Identidad** | `cuit`, `razon_social`, `nombre_fantasia`, `activo`, `empresa_principal` | todo el sistema; `razon_social` es el nombre que se muestra aguas abajo |
| **Rol** | `es_proveedor`, `es_cliente` | separa compras de ventas |
| **Bancarios** | `cbu`, `alias_cbu`, `banco`, `tipo_cuenta`, `moneda_cuenta`, `mensaje_transferencia`, `ultimo_uso_bancario` | **Lotes Galicia** (export de transferencias) |
| **Contacto** | `email_pagos`, `email_facturacion`, `telefono`, `contacto_nombre` | mails de pago · buscador de PDFs |
| **Búsqueda de PDFs** | `fc_modo`, `patron_asunto`, `dias_busqueda`, `carpeta_drive_id`, `gas_habilitado`, `pdf_ultimo_intento` | **GAS** (descarga automática de facturas) |
| **Libres** | `notas`, `tags` | `tags` **no es decorativo**: el tag `recolector` marca a quien reenvía facturas (Jose, Andrés) y la app se lo pasa al GAS |

### ⚠️ Los dos mails son dos cosas distintas
- **`email_facturacion`** — de dónde **llega** la factura. Lo usa el buscador de PDFs.
- **`email_pagos`** — adónde se **envía** el aviso de pago. Lo usa Lotes Galicia y el mail de detalle.

Están cargados de forma muy despareja (3 vs 26 al momento de auditarlo), y eso hizo pensar que
"faltaban mails" cuando en realidad se estaba mirando la columna equivocada. Unificarlos o
aclararlos es **B-FEAT-UNIFICAR-PORTAL** en `PENDIENTES.md`.

---

## 3. Quién LEE el maestro

| Quién | Para qué | Qué pasa si el dato falta |
|---|---|---|
| **Motor de conciliación** | pre-filtro por CUIT: saca el CUIT de las leyendas del banco y filtra candidatos antes de comparar montos | sin fila, no hay pre-filtro: compara contra todo y acierta menos |
| **Extracto bancario** | `proveedor_nombre` sale de `proveedores.razon_social` por CUIT, **nunca** de las leyendas del banco | el movimiento queda sin proveedor |
| **Lotes Galicia** | CBU/alias, `email_pagos`, `mensaje_transferencia` | el lote **frena** y abre el bucle de completar datos |
| **Mail de detalle de pago** | destinatario = `email_pagos` | no se puede encolar el mail |
| **GAS — buscador de PDFs** | `email_facturacion`, `patron_asunto`, `dias_busqueda`, `gas_habilitado`, `fc_modo` | el proveedor no se busca |
| **`SelectorCuentaContable`** | historial de cuentas usadas con ese CUIT → sugerencias al imputar | se imputa sin sugerencias |
| **Control de subas vs IPC** | agrupa la facturación por CUIT | — |
| **Ficha de proveedor** | todo | — |

---

## 4. Quién ESCRIBE el maestro

### 4.1 Alta automática al importar (la vía sana)
`app/api/import-facturas-arca/route.ts` junta los CUITs importados, consulta `proveedores` e
**inserta los faltantes** (`cuit` + `razon_social` = `denominacion_emisor` + `fc_modo='sin_config'`).
Va al final, en bloque y en `try/catch`: si falla, **no rompe el import**.

### 4.2 Alta manual inline
`components/ui/proveedor-combobox.tsx` tiene un modo "nuevo" que crea con `cuit` + `razon_social`.
Es el alta mínima: el resto de los campos quedan vacíos y se completan después.

### 4.3 🔴 Las ventas NO dan de alta el cliente — bug abierto
Compras cumple la regla; **ventas no**:
- `app/api/import-ventas/route.ts` → **no toca `proveedores` en absoluto**. Es el peor caso: es la vía masiva.
- `modal-venta-msa.tsx`, `modal-comprobante-venta-msa.tsx`, `modal-liquidacion-msa.tsx` → hacen
  sólo `UPDATE … es_cliente = true`, que sobre un CUIT inexistente **matchea 0 filas y no falla**.

Por eso hay 152 proveedores y 3 clientes. Se detectó porque Sanpa Semillas y PROVINVEST tenían
factura de venta y no estaban en el maestro. **Fix pendiente**: upsert en los 4 puntos, en una
función compartida de `lib/`. Dossier `B-BUG-CLIENTE-NO-SE-CREA`.

### 4.4 La escritura de campos — un solo endpoint, con nombre engañoso
> **`PATCH /api/gas/config-proveedor` es la única vía de escritura del maestro.**

El nombre quedó de cuando servía sólo al buscador de PDFs, pero hoy escriben por ahí **Config
PDFs**, el **bucle de Lotes Galicia** y la **ficha de proveedor**. Tiene whitelist
(`CAMPOS_PERMITIDOS`, hoy 23 campos): **un campo que no esté en la lista se ignora en silencio**.
Si un guardado "no guarda", mirar esa lista antes que nada.

Se amplió en vez de abrir un cuarto camino a propósito: la config de proveedores ya venía
fragmentada y sumar otro escritor era empeorar el problema que hay que resolver.

---

## 5. Las tres pantallas que lo tocan

| Pantalla | Dónde | Edita | Lista |
|---|---|---|---|
| **Config PDFs** (`gas-pdf/modal-config-proveedor.tsx`) | botón dentro de Facturas ARCA | los 5 campos del GAS | sólo proveedores **con ≥1 factura** |
| **Completar datos** (`lotes-galicia/modal-completar-datos-proveedor.tsx`) | dentro del bucle de exportar lote | `email_pagos` **o** `cbu`/`alias` | sólo el que frena el lote |
| **Ficha de proveedor** (`proveedores/modal-ficha-proveedor.tsx`) | Principal → Proveedores · ícono 🏢 en Subas | **todo** | los 154 |

Las dos primeras son **parciales por diseño**: resuelven un dato puntual en el momento en que
hace falta. La ficha es la vista completa. No se fusionaron todavía — Config PDFs sigue siendo
útil como **grilla masiva** para habilitar la búsqueda de muchos a la vez, cosa que una ficha
de a uno no reemplaza.

---

## 6. La ficha de proveedor (2026-08-07)

### Por qué es un modal y no una solapa
La consulta es **puntual y en medio de otra cosa** — mirás un proveedor mientras estás en una
factura o un pago — así que tiene que devolverte a donde estabas. Además: ningún otro maestro
(cuentas contables, actividades, campos) tiene solapa propia, todos son botón + panel; y el
`TabsList` del dashboard es un `grid-cols-12` exacto, una 13ª solapa obligaba a rehacerlo.

Editar existe pero es la excepción, así que se entra en **lectura** y editar está detrás de un botón.

### Los dos accesos
1. **Principal → botón "Proveedores"** — abre el buscador con los 154.
2. **Presupuesto → "Subas de proveedores" → ícono 🏢 de una fila** — abre **directo** esa ficha.

El segundo existe porque ese panel es *"quién nos está aumentando por encima del IPC"*: cuando uno
salta en rojo, la pregunta que sigue es siempre **"¿y quién es este, qué le compramos y qué le
pagamos?"**. El ícono responde eso sin salir del análisis. El clic en el ícono **no** despliega la
serie mes a mes de la fila (`stopPropagation`), son dos acciones distintas sobre la misma fila.

### Qué arma
Datos del maestro en 4 bloques · últimas facturas (compras de MSA/PAM/MA + ventas de MSA) · últimos
pagos · anticipos · cuatro totales arriba. Lee de `GET /api/proveedores/ficha?cuit=`, escribe por
el PATCH de la § 4.4.

---

## 7. 🔑 Dónde vive el pago — `fecha_pago` no sirve

Medido el 2026-08-07 sobre la BD viva:

| Tabla | Filas | Con `fecha_pago` |
|---|---|---|
| `msa.comprobantes_arca` | 384 | **12** |
| `cuotas_egresos_sin_factura` | 935 | **8** |

**El pago no se registra al pagar: se registra al conciliar.** El dato real está en el extracto,
que es donde el motor escribe los vínculos:

| Columna del extracto | Apunta a | Filas en `msa_galicia` |
|---|---|---|
| `template_cuota_id` | cuota de template | **469** |
| `comprobante_arca_id` | factura de compra | **108** |
| `anticipo_id` | anticipo | 7 |
| `proveedor_nombre` | (texto, sin FK) | 441 |

Por eso la ficha arma los pagos recorriendo esos vínculos —de la factura a la cuota al anticipo— y
después repasa por `proveedor_nombre`. **Cada pago dice por qué vínculo entró**, y los que sólo
coinciden por nombre se marcan como tales: un movimiento con el nombre cargado y sin comprobante
vinculado no es lo mismo que uno conciliado, y presentarlos igual sería mentir por omisión.

Cualquier pantalla futura que quiera mostrar pagos por proveedor tiene que hacer lo mismo. Esto
queda así hasta que se haga la **Fase ARCA** del refactor de fechas (`A-TEST-06`).

---

## 8. Huecos abiertos

| # | Hueco | Dónde está anotado |
|---|---|---|
| 1 | **Las ventas no dan de alta el cliente** — 4 puntos sin upsert | `B-BUG-CLIENTE-NO-SE-CREA` |
| 2 | **Los cobros de una venta no se pueden rastrear** — el extracto no tiene columna hacia `msa.comprobantes_venta`, así que de una venta se sabe su `estado`, no cuándo entró la plata | `A-TEST-24` |
| 3 | **Pagos por caja, cheque y tarjeta no se ven** en la ficha (sólo los 3 extractos Galicia) | `A-TEST-24` |
| 4 | **Carga orgánica** — completar el padrón a medida que se opera, en vez de cargarlo de antemano | `B-FEAT-07` |
| 5 | **Dos columnas de mail** sin criterio claro | `B-FEAT-UNIFICAR-PORTAL` |
| 6 | **`razon_social` truncadas a 30 caracteres** en varios proveedores — se truncó en el origen; el nombre completo está en `denominacion_emisor` de ARCA | `PENDIENTES.md` |
| 7 | **Ninguna pantalla de alta valida** que el proveedor exista antes de operar | § 4.3 |

---

## 9. Cómo incide en el presupuesto

Indirecto pero real, por dos caminos:

1. **Control de subas vs IPC** (`lib/proveedores/control-subas.ts`) agrupa la facturación por CUIT
   y marca a quién está aumentando por encima de la inflación. Ese es el insumo para decidir qué
   costo se proyecta con qué ajuste — sin el maestro, el análisis se hace sobre nombres del banco,
   que no agrupan.
2. **Todo lo que el maestro rompe aguas abajo termina en el presupuesto**: si un pago no concilia
   porque el CUIT no estaba, ese egreso no queda registrado, y el presupuesto se autoalimenta con
   un dato menos. Corregir el maestro **es** trabajo del norte, no una desviación.
