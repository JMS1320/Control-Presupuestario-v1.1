# 🎯 CLAUDE.md — Reglas y referencia del proyecto

> **Archivo magro a propósito**: solo reglas vinculantes + referencia crítica (se carga en cada sesión).
> Todo lo demás vive en **las 8 dimensiones** (ver § Documentación) — el historial de sesiones
> (ago-2025 → 2026) en `CLAUDE_HISTORICO.md`, que es archivo y no se carga como regla.

---

## 📌 Qué es este proyecto
**Sistema de gestión contable y productiva** (MSA / PAM / MA): importa comprobantes (ARCA),
extractos bancarios y sueldos; concilia contra templates y facturas; gestiona pagos y cobros;
y proyecta Cash Flow y Presupuesto sobre el plan de cuentas. Incluye el sector **productivo**
(hacienda, agricultura, insumos).

### 🧭 Norte del proyecto
Que el **presupuesto se autoalimente del sistema contable**: cada comprobante, pago y movimiento
se carga **una sola vez** y alimenta solo la proyección. Al usuario le queda **afinarla**, no
rehacerla — y la herramienta tiene que ser lo bastante versátil para que ese afinado sea suyo.

**TODO alimenta al presupuesto.** Cada faceta del sistema incide —o **debería** incidir— en la
proyección. ⚠️ **Que el vínculo todavía no esté creado no significa que no deba existir.**

Al tocar **cualquier** módulo, preguntarse: *¿cómo incide esto en el presupuesto?*
- Si el vínculo existe → no romperlo.
- Si **no** existe → es un **hueco**, no un no-problema: registrarlo en `PENDIENTES.md` aunque no
  se resuelva ahora.

Corolario: corregir pagos, conciliación o el plan de cuentas **es** trabajo del norte, no una
desviación — si alimentan mal, el presupuesto se autoalimenta con basura. El norte no dice en qué
módulo trabajar; dice cómo decidir cuando hay que elegir.

#### 🏁 El resultado final — qué tiene que poder dar el sistema
1. **Resultado del período contable** (ganancia) **y del período en curso**: lo registrado a la
   fecha **+ el presupuesto** para lo que falta del período.
2. **Presupuesto a 2 años, constante** (siempre 2 años por delante, no un ejercicio que se arma
   una vez).
3. **Resultado por actividad**, período por período, **más su proyección**.
4. Y sin dejar de ser un **sistema contable y productivo completo**.

#### ⏱️ Cómo se avanza — lo marcan los eventos, no un roadmap
Esto lleva tiempo y **se trabaja a medida que se dan los eventos** (vencimientos, cierres,
presentaciones). Cuando se acerca un evento, lo que ese evento necesita **pasa a ser el foco**.

> Evento en curso — **balance 25/26**: corte **30/06/2026** · al contador **01/10/2026** · a ARCA
> **01/11/2026**. Objetivo: que los **papeles de trabajo sean un export del sistema**.
> → [A-FEAT-09](PENDIENTES.md#a-feat-09)

> 🚧 **En construcción**: el usuario lo va completando. Última ampliación 2026-08-02 (resultado
> final + cómo se avanza) → [A-DOC-07](PENDIENTES.md#a-doc-07).
> El **foco en curso** (el gran objetivo del momento, que rota) NO va acá: va a `PENDIENTES.md`.

---

## 🤖 REGLAS AUTOMÁTICAS

### 💰 Convención Inputs Monetarios (es-AR) — OBLIGATORIO
Todo campo de texto donde el usuario ingrese un monto debe seguir este patrón:

```tsx
// Input
<Input type="text" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} />

// Al guardar — parsear aceptando coma como decimal y punto como miles
parseFloat(String(valor).replace(/\./g, '').replace(',', '.')) || 0

// Al pre-cargar un valor numérico existente en el input
numero.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// 1234567.89 → "1.234.567,89"
```
- `type="text"` siempre (nunca `type="number"` para montos).
- Display en tabla: `numero.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.
- Filtros de monto: también `.replace(/\./g, '').replace(',', '.')` antes del `parseFloat`.

### 📚 Documentación — las 8 dimensiones (REGLA ABSOLUTA)
*Decidido con el usuario 2026-08-02 → dossier [A-DOC-01](PENDIENTES.md#a-doc-01).*

**La lista es CERRADA y EXHAUSTIVA.** Cada dimensión tiene archivo exacto y criterio de qué entra.
**Nada de "etc."** — ese "etc." fue justamente lo que dejó 8 archivos huérfanos en la raíz.

| # | Dimensión | Archivo | Entra | **NO** entra (va a…) |
|---|---|---|---|---|
| 1 | **PENDIENTES** | `PENDIENTES.md` | todo lo por hacer: bugs, features, testing, decisiones abiertas. Índice con ID + dossier | lo ya resuelto → 8 · el análisis de un módulo → 7 |
| 2 | **ARQUITECTURA BD** | `ARQUITECTURA-BD.md` + `ESTRUCTURA_BD_COLUMNAS.md` | tablas, columnas, tipos, permisos, RLS, RPC, triggers, schemas | cómo se **usa** eso → 4 · la lógica de un módulo → 7 |
| 3 | **RECONSTRUCCIÓN** | `RECONSTRUCCION_SUPABASE_2026-01-07.md` | cómo rehacer la BD de cero + ALTERs que el backup no captura (§ CAMBIOS POST-RECONSTRUCCIÓN) | la estructura vigente → 2 |
| 4 | **MANUAL** | `MANUAL-USO.md` | cómo **opera** el usuario cada pantalla: pasos, orden, qué botón | por qué está construido así → 2 o 7 |
| 5 | **CONOCIMIENTO** | `KNOWLEDGE.md` | qué funciona, **qué se descartó y por qué**, troubleshooting, configs | diseño de un módulo → 7 · secretos → **fuera del repo** |
| 6 | **ERRORES** | `ERRORES_CONOCIDOS.md` | baseline de errores preexistentes (captura barata, triage diferido) | errores del cambio en curso → se arreglan |
| 7 | **MÓDULOS** | `MODULO_<NOMBRE>.md` | diseño, lógica de negocio y decisiones **de un módulo** | lo transversal → 5 · cómo se opera → 4 |
| 8 | **HISTORIAL** | `CLAUDE_HISTORICO.md` | sesiones cerradas, bitácoras, "qué se hizo el día X". Referencia, no se carga | lo que sigue vigente → su dimensión |

**Las tres fronteras que se confunden:**
- **2 vs 7** — Arquitectura BD es *dónde vive el dato*; Módulo es *qué hace el sistema con ese dato*.
- **4 vs 7** — Manual es *cómo lo opera el usuario*; Módulo es *cómo está pensado por dentro*.
- **5 vs 7** — Knowledge es *transversal*; Módulo es *de un módulo solo*.

**Fuera de las 8, sólo dos archivos declarados:** `CLAUDE.md` (las reglas) y **`README.md`**
(cara pública del repo). La **memoria** (`memory/`) **no es dimensión**: es continuidad de Claude.

#### ➡️ Dirección única: la doc no cita a la memoria (REGLA)
> **La memoria puede citar a la documentación. La documentación NO puede citar a la memoria.**

Un `.md` de dimensión que remita a `memory/` para saber **qué falta, qué se hizo o cómo funciona
algo** es un **error a corregir**, no un atajo: la fuente única de verdad quedaría dependiendo del
recuerdo de Claude, que envejece y no está en git.

- La memoria guarda **continuidad y punteros**. Nunca **listas de trabajo** (pendientes, tests,
  bugs) ni **reglas permanentes** (esas van acá).
- **Cómo se detecta**, sin ceremonia: `grep -l "memory/" *.md` sobre las dimensiones. Si aparece
  algo, es una fuga — se absorbe el contenido y se borra el puntero.
- Al registrar/cerrar sesión, verificar que ninguna dimensión quedó apoyada en memoria.

*Motivo: pasó de verdad. `B-TEST-10` decía "resto de ítems, ver `memory/feedback_testing_pendiente.md`"
— `PENDIENTES.md` delegando en la memoria. Corregido 2026-08-02 → [A-DOC-08](PENDIENTES.md#a-doc-08).*

#### 🔒 Regla de cierre + autorización
Cualquier `.md` en la raíz que no sea una de las 8 dimensiones ni `CLAUDE.md` / `README.md`
**está mal ubicado**. Al documentar algo que no parece caer en ninguna:
1. Primero **revisar que sí cae** (casi siempre cae).
2. Si realmente no cae → **Claude propone la dimensión nueva y el usuario la autoriza**.
   ⚠️ **Claude NO crea dimensiones por su cuenta.** Sin autorización explícita, no se crea el
   archivo. Una vez autorizada, se agrega a esta tabla en el momento.

### 🗂️ Dimensiones de registro — cuando el usuario dice "registra" / "documenta"
No es un solo archivo: evaluar **TODAS** las dimensiones que apliquen (varias suelen tocarse a la
vez), usando la tabla de arriba. Además de las 8:
- **Continuidad entre sesiones** → memoria (`MEMORY.md` index). Recordar que **la documentación
  manda sobre la memoria**: la memoria no guarda reglas permanentes (van acá) ni pendientes
  (van a `PENDIENTES.md`).

Al terminar de registrar, decir explícitamente **qué dimensiones se tocaron** (para que el usuario
controle que no quedó nada desparramado).

### 👥 Contrapartes — toda importación debe registrarlas (REGLA)
**Si entra un comprobante, su contraparte tiene que quedar en `public.proveedores`.** Vale para
**compras (proveedor) y ventas (cliente)**, y para **todas** las vías: importadores masivos y
altas manuales.
- Al importar/registrar: **upsert** — crear si no existe (`es_cliente` / `es_proveedor` según
  corresponda), y si ya existe marcar el flag que falte.
- ⚠️ **Nunca sólo `UPDATE`**: si la contraparte no existe, matchea 0 filas, **no falla**, y el
  hueco queda invisible. Ese es exactamente el bug B-BUG-CLIENTE-NO-SE-CREA.
- `es_proveedor = true` sólo si tiene factura de compra a su nombre; los clientes puros van
  en `false`.
- Motivo: `proveedores` es el maestro del que salen CBU, mails, mensajes de transferencia y el
  pre-filtro por CUIT del motor. Un comprobante cuya contraparte no está ahí rompe pagos,
  cobros y conciliación aguas abajo.

### 🏷️ Templates — siempre con su macro categoría (REGLA)
Al crear un template, su `categ` **tiene que existir en `public.cuentas_contables`** con el
`tipo` cargado (`ingreso` / `egreso` / `financiero` / `distribucion` / `NO`).

De ese `tipo` dependen dos cosas del Presupuesto:
- **si se presupuesta**: lo `financiero` (colocaciones, transferencias entre cuentas propias,
  pago de tarjeta) no se proyecta, porque la plata no sale de la empresa;
- **dónde aparece** cuando la grilla se ordena por la estructura del dashboard.

Un template cuya categoría no está en el plan de cuentas se asume gasto y queda sin ubicación;
el panel de métodos lo marca *"sin clasificar"*. Motivo: presupuestar una colocación como si
fuera gasto infla el egreso con plata que sigue siendo de la empresa (el FCI daba ~$135 M).

⚠️ **Hoy las pantallas de alta NO lo validan** y por eso hay 23 categorías fuera del plan: el
wizard ofrece las categorías de los templates existentes, no las del plan (ver `PENDIENTES.md`
§ C-26). Al crear o clonar un template, chequear a mano que su `categ` exista en
`cuentas_contables`.

### 🛑 Datos — NUNCA modificar sin preguntar (REGLA ABSOLUTA)
- **Prohibido** hacer `UPDATE` / `INSERT` / `DELETE` sobre **datos reales** (valores de filas) sin **preguntar al usuario primero**. Incluye "valores de prueba", diagnósticos, revertir, etc.
- Aplica a la BD viva (MCP Supabase, SQL) y a cualquier dato del usuario. Para diagnosticar, **preguntar antes** y acordar qué tocar (o pedirle a él que lo haga desde la UI).
- Esto es distinto de los cambios de **estructura** (columnas/RPC/trigger acordados) — ver [[feedback_no_modificar_bd_sin_acuerdo]]: los de estructura también se avisan; los de **datos** se preguntan SÍ o SÍ.
- **Nada destructivo, nunca** (vale para BD, Drive/GAS y archivos): find-or-create en vez de
  reemplazar, **migrar** en vez de descartar cuando cambia un formato, confirmación explícita
  antes de borrar. En GAS/Drive están **prohibidos** `setTrashed`, `removeFolder`, `emptyTrash`
  y todo patrón "replace/overwrite" de carpeta. Motivo: un "sobrescribir carpeta" ya le borró un
  backup entero al usuario (2026-06-26).
- Motivo: el usuario perdió confianza cuando se le tocó un dato sin avisar; los datos son su fuente de verdad para testear.

### ♻️ Centralizar, no duplicar (REGLA)
Si algo lo van a usar varias pantallas o modales, va en **un solo lugar**, de modo que tocar
ese lugar afecte a todo lo que lo usa.
- Antes de crear un componente/función, buscar el equivalente y **extenderlo**.
  Caso testigo: para **asignar** cuenta contable va siempre `SelectorCuentaContable`
  (jerarquía completa + buscador); `CategCombobox` sólo para filtros rápidos.
- Si la vista tiene **export (Excel/PDF)**, al sumarle un campo se actualiza también el export.
  Motivo: el usuario usa las descargas como registro fuera de la app; si el export queda viejo,
  pierde datos que sí ve en pantalla.

### 📝 Motivos, errores y testing (REGLA)
- **Toda regla, decisión o pendiente lleva su motivo** (dónde duele, con el caso concreto que la
  originó). Motivo del motivo: el usuario prioriza con eso — *"las normas que tengan muchos
  motivos me ayudan a decidir luego"*. En dossiers: distinguir **fix de fondo** (mueve la aguja)
  de **mitigación** (ayuda pero no sustituye).
- **Errores preexistentes** (no del cambio en curso) → `ERRORES_CONOCIDOS.md`. **Capturar
  siempre** (`archivo:línea` + mensaje + fecha; cuesta ~0 porque la salida ya está delante);
  **investigar NUNCA en el momento** (se difiere a [A-OP-07](PENDIENTES.md#a-op-07)). Sólo
  errores reales, no warnings de formato. Dedup por firma. Motivo: vuelve verificable el "no
  rompí nada" — si aparece un error que no está en el log, lo causó el cambio actual.
- **Testing**: no dar por terminado lo que no se probó. Decir siempre qué quedó sin testear y
  recordar los pendientes de test en las pausas naturales.

### 🔧 Git
- **Pushear SIEMPRE a `desarrollo`** (nunca commitear directo a `main`). `main` = auto-deploy Vercel.
- Merge `desarrollo → main` solo cuando el usuario confirme testing OK.

---

## ⚡ Comandos de desarrollo
```bash
npm run dev                          # desarrollo
npm run build && npm run type-check  # build + tipos
npm test                             # tests
```

---

## 🔐 Accesos y roles
- Rutas-como-password (`config/access-routes.ts`): **`adminjms1320`** (admin, ve todo) · **`ulises`** (contable, solo Egresos: ARCA + Templates).
- Sin login real: es UX + validación de URL. **No protege la API** (ver A-SEC-01 en PENDIENTES — `anon` puede borrar todo).

---

## 📊 Datos críticos
- **Empresas / CUITs:** MSA `30617786016` · PAM `20044390222` · MA (schema `ma`).
- **Schemas BD:** `public`, `msa`, `pam`, `ma`, `productivo`, `sueldos`. Detalle → `ARQUITECTURA-BD.md`.
- **Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Branches:** `main` (prod, auto-deploy Vercel) · `desarrollo` (trabajo). Testing por preview de Vercel.
- **MCP Supabase:** mantener en `--read-only`; pasar a write solo para cambios de BD acordados + revertir después (ver A-OP-01).

---

## 🧭 Navegación rápida
| Necesito… | Voy a… |
|-----------|--------|
| Qué falta / bugs / TODOs | `PENDIENTES.md` |
| Estructura de datos (tablas, columnas, permisos) | `ARQUITECTURA-BD.md` + `ESTRUCTURA_BD_COLUMNAS.md` |
| Cómo reconstruir la BD | `RECONSTRUCCION_SUPABASE_2026-01-07.md` |
| Conocimiento / configs / descartado | `KNOWLEDGE.md` |
| Cómo se USA la app / flujo de trabajo | `MANUAL-USO.md` |
| Diseño y decisiones de UN módulo | `MODULO_<NOMBRE>.md` (ver [A-DOC-02](PENDIENTES.md#a-doc-02) — renombrado pendiente) |
| Errores preexistentes (baseline) | `ERRORES_CONOCIDOS.md` |
| Historial de sesiones (referencia) | `CLAUDE_HISTORICO.md` |
| Contexto entre sesiones | memoria (`MEMORY.md` index) |
