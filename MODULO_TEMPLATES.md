# MODULO_TEMPLATES.md — Arquitectura Completa de Templates

> Referencia definitiva para entender los tipos de templates, flags de BD, flujo Pago Manual,
> comportamiento del motor de conciliación, y guards de conciliación manual.

---

## 1. Tres Tipos de Templates

| Tipo | Flag en BD | Descripción |
|------|-----------|-------------|
| **Fijo** | `tipo_template = 'fijo'` | Cuotas con montos y fechas predefinidas. Ej: ARBA, alquiler. |
| **Abierto** | `tipo_template = 'abierto'` | Sin cuotas predefinidas. Cada pago se crea desde "Pago Manual". Tiene una categ fija. |
| **Multi-cuenta** | `tipo_template = 'abierto'` + `es_multi_cuenta = true` | Sin categ en el template. Cada cuota lleva su propia categ al momento de crearse. |

---

## 2. Flags relevantes en `egresos_sin_factura`

| Campo | Tipo | Default | Uso |
|-------|------|---------|-----|
| `tipo_template` | varchar | `'fijo'` | `'fijo'` o `'abierto'` |
| `tipo_recurrencia` | varchar | `'mensual'` | Periodicidad de cuotas |
| `es_bidireccional` | boolean | `false` | FCI, Caja — acepta ingresos y egresos |
| `solo_conciliacion` | boolean | `false` | Solo usa el motor; NO aparece en Pago Manual |
| `es_multi_cuenta` | boolean | `false` | Cada cuota tiene su propia categ |

---

## 3. Campo categ — prioridad cuota sobre template

### Regla global
```
categ efectivo = cuota.categ ?? template.categ
```

Aplica en:
- `useMultiCashFlowData.ts` — construcción de filas Cash Flow
- `useMotorConciliacion.ts` — qué categ se escribe en el extracto
- `vista-templates-egresos.tsx` — columna categ en la tabla

### Campo en BD
```sql
-- En cuotas_egresos_sin_factura
categ VARCHAR(100) NULL
```

- Para templates **fijo** y **abierto** normal: `categ` en cuota siempre NULL. La categ viene del template.
- Para templates **multi-cuenta**: `categ` en cuota es OBLIGATORIA al crear el pago.

---

## 4. Template Multi-cuenta — comportamiento específico

### Wizard — creación
- Solo disponible cuando `tipo_template = 'abierto'`
- Checkbox "📂 Template Multi-cuenta"
- Al activar: limpia y oculta los campos `categ` y `cuenta_agrupadora`
- Se guarda con: `categ = null`, `cuenta_agrupadora = null`, `tipo_recurrencia = 'abierto'`, `es_multi_cuenta = true`

### Pago Manual — paso 2
- Cuando el template seleccionado tiene `es_multi_cuenta = true` → aparece selector de categ
- Categ se selecciona de `cuentas_contables` (datalist)
- Al guardar INSERT en `cuotas_egresos_sin_factura` incluye `categ: categSeleccionada`

### Cash Flow — edición de categ
- Fila con `es_multi_cuenta = false` (cualquier template normal):
  → `toast.error("La categoría de un template solo puede modificarse desde la vista Templates")`
- Fila con `es_multi_cuenta = true`:
  → Escribe en `cuotas_egresos_sin_factura.categ` (no en el template maestro)

### Vista Templates — columna categ
- categ en cuota propia (multi-cuenta): badge **naranja** `bg-orange-100 text-orange-700`
- categ heredada del template: badge **azul** `bg-blue-100 text-blue-700`
- Sin categ: texto naranja italic `"sin categ"`

### Motor de conciliación
- Si `es_multi_cuenta = true` y la cuota no tiene categ:
  → estado = `'auditar'`
  → `motivo_revision = 'Sin categ: requiere asignación de cuenta contable'`

---

## 5. `solo_conciliacion` — templates bancarios/motor

### ¿Qué son?
Templates que **nunca** se pagan manualmente. Su cuota la crea el motor automáticamente
cuando detecta un movimiento bancario con la regla correspondiente (flag `llena_template = true`).

Ejemplos: Comisiones bancarias, IVA bancario, IIBB bancario, Gastos de cuenta, Créditos bancarios.

### Comportamiento en Pago Manual
- **Sección principal**: solo muestra templates con `solo_conciliacion = false`
- **Sección colapsable** "Bancarios / motor": muestra los `solo_conciliacion = true`
  - Botón "↓ Ver bancarios" / "↑ Ocultar" para expandir
  - Cada template muestra badge `SOLO CONCILIACIÓN` en rojo
  - Botón "Habilitar" por cada template → cambia a `solo_conciliacion = false` y lo mueve a la sección principal
- La función `toggleSoloConciliacion` actualiza BD + estado local inmediatamente

---

## 6. Guards de conciliación manual

Se aplican cuando el usuario intenta cambiar estado a `'conciliado'` manualmente
(sin pasar por el motor de conciliación bancaria).

### Vista Templates (`guardarCambio`)
```
Si columna = 'estado' y valor = 'conciliado':
  monto > 0  → alert() bloqueante + cancelar
  monto = 0  → window.confirm() + cancelar si rechaza
```

Mensaje bloqueo (monto > 0):
> "⛔ Esta cuota tiene monto $X.XXX. Para conciliar debe existir un movimiento en el extracto bancario que respalde el pago. Use el motor de conciliación automático."

### Vista Cash Flow (`cambiarEstado`)
```
Si nuevoEstado = 'conciliado' y origen = 'TEMPLATE':
  monto > 0  → toast.error() bloqueante + cancelar
  monto = 0  → window.confirm() + cancelar si rechaza
```

### Razón de ser de los guards
Una cuota con monto > 0 conciliada sin extracto bancario genera un descuadre contable:
el gasto aparece como pagado pero no hay movimiento bancario que lo respalde.
Las cuotas de $0 (placeholder) sí pueden marcarse manualmente ya que no mueven dinero.

---

## 7. Flujo Pago Manual — paso a paso

### Paso 1 — Seleccionar template
1. `abrirModalPagoManual()` carga `cuentas_contables` para el datalist del paso 2
2. Query: templates con `tipo_template='abierto'` (incluye multi-cuenta)
3. Sección principal: `solo_conciliacion = false`
4. Sección colapsable: `solo_conciliacion = true`

### Paso 2 — Ingresar datos del pago
- Campos siempre visibles: fecha, monto, descripción
- Campo categ: **solo aparece** cuando `template.es_multi_cuenta = true`
- Monto: formato es-AR (coma decimal, punto miles)

### Guardar (`guardarPagoManual`)
```sql
INSERT INTO cuotas_egresos_sin_factura (
  egreso_id,           -- template seleccionado
  fecha_vencimiento,
  monto,
  descripcion,
  estado,              -- 'pendiente'
  categ                -- solo si es_multi_cuenta=true
)
```

---

## 8. BD — resumen de campos clave

### `egresos_sin_factura`
```sql
tipo_template        VARCHAR DEFAULT 'fijo'
es_bidireccional     BOOLEAN DEFAULT FALSE
solo_conciliacion    BOOLEAN DEFAULT FALSE
es_multi_cuenta      BOOLEAN DEFAULT FALSE
categ                VARCHAR(100)         -- NULL para multi-cuenta
cuenta_agrupadora    VARCHAR(100)         -- NULL para multi-cuenta
```

### `cuotas_egresos_sin_factura`
```sql
categ                VARCHAR(100)         -- override por cuota (multi-cuenta)
tipo_movimiento      VARCHAR(20) DEFAULT 'egreso'  -- 'egreso' | 'ingreso' (bidireccional)
```

---

## 9. Migración BD requerida

Las siguientes migraciones deben estar aplicadas:

```sql
-- Templates multi-cuenta y solo_conciliacion
ALTER TABLE egresos_sin_factura
  ADD COLUMN IF NOT EXISTS solo_conciliacion BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS es_multi_cuenta BOOLEAN DEFAULT FALSE;

-- Categ por cuota
ALTER TABLE cuotas_egresos_sin_factura
  ADD COLUMN IF NOT EXISTS categ VARCHAR(100);

-- Tipo movimiento (bidireccional — FCI, Caja)
ALTER TABLE cuotas_egresos_sin_factura
  ADD COLUMN IF NOT EXISTS tipo_movimiento VARCHAR(20) DEFAULT 'egreso';

-- Bidireccional en templates
ALTER TABLE egresos_sin_factura
  ADD COLUMN IF NOT EXISTS es_bidireccional BOOLEAN DEFAULT FALSE;
```

---

## 10. Archivos principales involucrados

| Archivo | Rol |
|---------|-----|
| `components/wizard-templates-egresos.tsx` | Creación de templates — 3 tipos + flags |
| `components/vista-templates-egresos.tsx` | Vista tabla, inline editing, guards conciliación manual |
| `components/vista-cash-flow.tsx` | Pago Manual modal, guard conciliación manual, toggle solo_conciliacion |
| `hooks/useMultiCashFlowData.ts` | Construcción filas, categ override, categ edit multi-cuenta |
| `hooks/useMotorConciliacion.ts` | Motor, auditar cuando es_multi_cuenta sin categ |

---

## 11. Comportamientos NO permitidos

| Acción | Bloqueada por |
|--------|--------------|
| Conciliar cuota con monto > 0 desde Templates | Guard en `guardarCambio` |
| Conciliar cuota con monto > 0 desde Cash Flow | Guard en `cambiarEstado` |
| Editar categ de template normal desde Cash Flow | Toast.error en `actualizarRegistro` |
| Crear template multi-cuenta con categ en el wizard | Checkbox oculta el campo |
| Template abierto normal sin categ | Validación en `validarPaso` |
| Templates solo_conciliacion en sección principal Pago Manual | Filtro en query UI |

---

## 12. Caja como presupuesto — estado `programado` (2026-05-26)

El template **Caja** (categ `CAJA`, abierto, bidireccional) se usa para **presupuestar** extracciones (~$900k/mes) y tenerlas presentes. Pero la extracción real suele ser otro monto, y por regla/motor se crean **cuotas reales** (conciliadas, descripción "Extraccion a Caja"). La cuota presupuesto queda colgada en estado `pendiente` → **molesta en Vista Pagos**.

**Solución — usar estado `programado` para las cuotas presupuesto:**

| Estado | Vista Pagos (Egresos→Pagos) | Cash Flow |
|--------|------------------------------|-----------|
| `pendiente` | ❌ aparece (molesta) | ✅ aparece |
| `programado` | ✅ **ni se carga** (la query de Pagos es whitelist `pendiente/pagar/preparado/echeq`) | ✅ aparece (violeta, débito proyectado) |

Así el presupuesto queda **visible en Cash Flow para planificar** pero **fuera del laburo de Pagos**. Las extracciones reales se concilian aparte, como hoy.

**Cuotas presupuesto NO usadas** (la extracción real fue otro monto y se creó cuota nueva; la presupuesto nunca se concilió): **se BORRAN** (decisión del usuario, no desactivar). 2026-05-25: borradas las cuotas Caja del 25/02 y 25/04 ($900k c/u).

> Pendiente (a futuro, lo maneja el usuario): crear los presupuestos mensuales directamente en `programado`; automatizar que al conciliar la extracción real del mes se marque el presupuesto como consumido.

---

## 13. Para qué se carga una cuota estimada — **el vencimiento, no el monto** (2026-08-22)

*Intención de diseño enunciada por el usuario. Es la que decide hasta dónde conviene generar campañas.*

> **La cuota estimada se carga para no olvidarse de que hay que pagarlo.** Palabras del usuario:
> *"si se cargan estimados para ver el vencimiento aun cuando no se sepa el monto — sino se puede
> olvidar que hay que pagarlo. Entonces veo que a esta fecha estimada suelo tener que pagar este
> impuesto de este monto estimado."*

El valor de la cuota `…123` **no está en el número**: está en que el Cash Flow muestre la fecha.
El monto es una referencia de orden de magnitud; el vencimiento es el dato que evita el olvido.

**De ahí sale el horizonte, y por qué son dos horizontes distintos:**

| Horizonte | Quién lo cubre | Por qué |
|---|---|---|
| **Campaña en curso** (~1 año) | **cuotas generadas** | el Cash Flow **sólo muestra lo que tiene template**. Sin cuota no hay fila, y un impuesto sin fila es un impuesto que se pasa |
| **Más allá de ~6 meses** | **el Presupuesto, solo** | ahí no hay nada que olvidarse de pagar: es planeamiento. `lib/presupuesto/templates.ts` proyecta sin escribir del otro lado |

**Corolario — no generar campañas futuras "para alimentar el presupuesto".** El presupuesto
**no las necesita**: proyecta solo los meses sin cuota. Y generarlas tiene un costo real, porque
la jerarquía de `lib/presupuesto/templates.ts` dice **cuota cargada → manda siempre**: una cuota
`…123` de un año lejano **pisa la proyección** con un estimado peor, y además el resto del sistema
(Cash Flow, Pagos, conciliación) la lee como **compromiso firme** — el `…123` sólo lo entiende el
Presupuesto. Decisión 2026-08-22: **se genera la campaña en curso; 2027 cuando llegue.**

### ↻ Confirmada el 2026-09-10 — y el padrón del presupuesto la estaba violando

*Esta § tenía 18 días cuando el padrón de huecos del Presupuesto salió pidiendo exactamente lo que
acá se decidió no hacer. La confirmó el usuario frenándolo:* **«creo que te fuiste en la dirección
contraria… vos te fuiste a gritar más»**.

El padrón preguntaba *«¿están todas las cuotas?»* y contaba las que faltaban hasta el fin del
período. Con eso, un template mensual con la campaña en curso cargada mostraba **22 meses en falta**
— y hacerle caso habría significado generar 2027 entero, que es lo que este § prohíbe **y que además
degrada el presupuesto**, porque cada cuota estimada lejana pisa la proyección con un número peor.

**Cambiado el 2026-09-10** → `PENDIENTES.md` § [A-FEAT-127](PENDIENTES.md#a-feat-127). La pregunta
pasó a ser **«¿el presupuesto puede proyectar esto?»**, y la señal son los meses en cero **por falta
de historia** — no los meses sin cuota.

> 🔑 **Para el que venga a construir el próximo padrón (arrendamientos, sueldos, cuentas):** antes de
> escribir la primera línea, **buscar en el `MODULO_<X>.md` del dominio si ya está decidido qué es
> normal que falte.** Un detector de ausencias construido sin esa respuesta no detecta ausencias:
> detecta la diferencia entre la realidad y una expectativa inventada.

Y la tabla de los dos horizontes de arriba pasó a ser una decisión con ID propio, porque se usa
fuera de este módulo → [A-DEC-21](PENDIENTES.md#a-dec-21).

### `aplica_generacion` — sembrado completo (2026-08-22)

Los anuales estaban en `NULL` a propósito (*"a decidir en el generador, caso por caso"*, ver
`PENDIENTES.md` § B-FEAT-RENOVAR-CAMPAÑA), lo que los mostraba **todos** en "No aplican".
Sembrados los 154 pendientes con el criterio que es **la definición misma del campo**:

- **`tipo_template = 'abierto'` → `false`** (53): las cuotas se generan **en vivo contra la
  conciliación** — Gastos/Impuestos Bancarios, Tarjetas, Créditos, Retiros. Se llenan solos: generar
  campaña no aporta nada.
- **`tipo_template = 'fijo'` → `true`** (101): tienen **boleta con vencimiento** — Impuestos
  Automotores, Urbanos, Rurales, Buenos Aires. Son exactamente los del punto de arriba: hay que
  verlos venir.

Los 6 ya decididos no se tocaron. Quedan **0 en `NULL`**. Es un punto de partida, no una sentencia:
el usuario corrige desde el generador con el opt-in ↑ y el opt-out ↓, y la corrección persiste.

---

## 15. Editar una campaña — la identidad de una cuota es su `id` (2026-09-12)

*Diseño de [A-FEAT-131](PENDIENTES.md#a-feat-131). Lo que sigue son decisiones tomadas, no opciones.*

### El problema que resolvía
Un template **`fijo`** de 4 cuotas al que hay que llevarlo a 6. Hasta el 2026-09-12 **no había
pantalla que lo permitiera**, y las tres puertas estaban cerradas por motivos distintos:

| Puerta | Por qué no servía |
|---|---|
| La grilla de Templates | es una tabla de **cuotas sueltas** (`cuotas_egresos_sin_factura` con el egreso por join). Se edita celda por celda; no hay un lugar donde el template exista como unidad |
| El modal «agregar cuota» / Pago Manual | filtra `tipo_template = 'abierto'` (`vista-templates-egresos.tsx` § `cargarTemplatesAbiertos`). Está bien que lo haga: **su caso de uso es registrar un pago suelto en un template que se llena por conciliación**, no planificar |
| Renovar campaña | su editor de detalle (mes/día/monto) opera sobre **la campaña que todavía no existe** — estado en memoria, no toca la base |

📌 **El tercero es el que más enseña**: el modal correcto **ya estaba escrito**, con la forma exacta
que hacía falta. Lo que le faltaba no era interfaz: era apuntar a cuotas reales y hacerse cargo de
los vínculos.

### La decisión que ordena todo lo demás
> **La identidad de una cuota es su `id`. Ni su número, ni su fecha, ni su monto.**

Porque el vínculo con el banco **es** ese `id`, copiado a `template_cuota_id` — y no es foreign key en
ninguna de las 12 tablas que lo tienen ([A-BUG-156](PENDIENTES.md#a-bug-156)). Perderlo no da error.

De ahí, tres reglas que valen para **cualquier** código que toque cuotas, no sólo para el editor:

1. **Editar es `UPDATE` por `id`.** Nunca borrar y recrear. Una cuota con otra fecha sigue siendo la
   misma cuota.
2. **Quitar es desactivar** (`estado = 'desactivado'`). También para las que no tienen vínculo: el
   `id` es la única pista de contra qué se pagó algo, y conservarlo no cuesta nada.
3. **`numero_cuota` es cosmético.** Se recalcula por fecha y se escribe **al final** del guardado,
   después de que las cuotas y sus vínculos ya estén bien: si esa parte falla, lo único que queda mal
   es un número de orden.

⚠️ **La regla 2 es la que ya se violó** — los 9 vínculos rotos tienen la firma de una regeneración
(borrar la tanda y recrearla). No lo hizo la app: hoy no hay un solo `.delete()` sobre
`cuotas_egresos_sin_factura` en el repositorio. Lo hizo alguien con SQL.

### El check, y por qué reusa el criterio del motor
La advertencia se calcula **en cada tecla** y no al guardar (pedido del usuario: *«hace el check al
momento»*). Corre contra los movimientos reales de las 12 tablas, cargados al abrir.

🔑 **Coincidencia = importe exacto + ≤ 5 días**, que es literalmente lo que hace
`useMotorConciliacion.buscarEnPool`. Es una decisión con motivo:

- con un criterio **más laxo**, el editor avisaría de matches que el motor **nunca va a hacer** — y
  una advertencia que no se corresponde con ninguna acción posible es ruido;
- con uno **más estricto**, callaría justo los casos que el motor sí agarra solo.

Si algún día cambia la tolerancia del motor, **cambian las dos o ninguna**: `TOLERANCIA_DIAS` está
declarada en `lib/templates/editar-campana.ts` con ese comentario.

### Y el aviso no bloquea
El rojo pinta el botón y cambia su texto a *«Guardar igual (hay avisos en rojo)»*, pero deja pasar.
**A veces el dato que está mal es el viejo**, y justamente se viene a corregir. Un control que impide
corregir deja de ser control.

### Qué no hace, a propósito
- **No edita varios templates a la vez** — para eso está la edición masiva de la grilla.
- **No pone la FK.** Eso es [A-BUG-156](PENDIENTES.md#a-bug-156) y necesita decidir antes qué se hace
  con los 9 huérfanos (§ 🛑 Datos).
- **`fecha_vencimiento` se iguala a `fecha_estimada`** en una cuota nueva. Un campo más en el editor
  para un caso que se corrige desde la grilla es interfaz que se paga todos los días.

---

## 16. Identificador vs detalle en una cuota — el identificador se GENERA (2026-09-12)

*Decisión del usuario, [A-FEAT-137](PENDIENTES.md#a-feat-137). Sus palabras:*
> **«Detalle es detalle y descripción es lo que es un identificador.»**

### Las dos cosas, y por qué son dos

| | Qué es | Quién lo pone |
|---|---|---|
| **identificador** | *qué cuota es ésta*: `«UATRE MSA - Septiembre 2026»` | el sistema, **al mostrar** |
| **`detalle`** | la especificación: `«1.740 Kg Maíz Castillo a 193.000 la ton»` | **el usuario**, o el Extracto al conciliar |

Es la § 30.1 de `MODULO_CONCILIACION.md` aplicada a las cuotas — la misma que separa *quién*, *qué*
y *la especificación* en el extracto.

### 🔑 El identificador NO se guarda

`lib/templates/identificador-cuota.ts` lo arma de `nombre_referencia` + `responsable` + el período
de `fecha_estimada`. Todo eso ya está en la cuota y su template.

**Es el patrón de las facturas ARCA**, que este proyecto ya usaba y funciona:
`useMultiCashFlowData` hace `detalle: f.detalle ? '<base> · <f.detalle>' : '<base>'`, donde la base
se **construye** (`FC A 0001-000123 - LUMINATUS SA`). Se componen al mostrar.

### ⚠️ Y por eso NO se copia el identificador al detalle cuando está vacío

Fue la duda del usuario —*«detalle se debería llenar con descripción si no hay nada, entonces es
como un bucle»*— y la respuesta es que **no hace falta**: sin detalle, la pantalla muestra el
identificador solo. Copiarlo no agrega nada visible y cuesta dos cosas:

1. **Borra la distinción.** Copiado, nadie puede decir si ese texto lo escribió una persona o lo
   armó el sistema — y esa diferencia es la que decide si se puede pisar.
2. **Congela.** El identificador cambia cuando cambia el nombre del template, el responsable o el
   período. Copiado, queda la versión vieja adentro del detalle para siempre. Es el mismo error que
   un `id` de template hardcodeado, que acá ya rompió dos cosas al renovar una campaña.

> **Un dato derivado no se guarda: se deriva.** Guardarlo cambia *«siempre correcto»* por
> *«correcto el día que se escribió»*.

### Cómo se llegó acá — dos intentos fallidos, y valen

1. La propagación del detalle escribió en `cuotas_egresos_sin_factura.detalle` **porque se llama
   igual** que en el extracto. Esa columna no la mostraba ninguna pantalla: el dato se guardaba
   bien y era invisible ([A-BUG-161](PENDIENTES.md#a-bug-161)).
2. Se corrigió a `descripcion`, que sí se veía. Andaba, pero **pisaba la etiqueta generada**.

El problema nunca fue el destino: era que **una sola columna hacía dos trabajos**. De 548
`descripcion` cargadas, **107 eran etiqueta y 436 texto libre del usuario**.

### Estado y qué falta
- ✅ El código compone y la columna **Detalle** ya está en la grilla de Templates, editable.
- ⏳ Las 543 filas viejas siguen en `descripcion` → [A-DAT-37](PENDIENTES.md#a-dat-37). **El código
  funciona sin tocarlas**: mientras no se muden, se siguen mostrando como detalle, para no hacer
  desaparecer de la pantalla lo que el usuario ya tenía escrito.
- ⏳ El generador de campaña **todavía guarda** la etiqueta en `descripcion`. Cuando se migre,
  puede dejar de hacerlo: la etiqueta se regenera sola.
