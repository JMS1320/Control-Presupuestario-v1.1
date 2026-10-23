# 🏛️ MODULO_ARCA — Integración con ARCA / AFIP

> **Dimensión MÓDULOS** (`CLAUDE.md` § Documentación).
> Consolida `INTEGRACION_SICORE_ARCA.md` e `INVESTIGACION_INTEGRACION_ARCA_AFIP.md` (sep-2025),
> movidos como historia cruda a `arca-api/`.
> **Creado 2026-08-02** · verificado contra el disco ese día.
>
> ⚠️ **Incompleto**: falta la parte de la app (importador + vistas). Ver
> `PENDIENTES.md` § [A-DOC-09](PENDIENTES.md#a-doc-09).
> ↻ **2026-10-19**: se sumó la **salida hacia ARCA** (Libro IVA Compras en texto para IVA Simple), el
> **estado de los subdiarios** (Imputado → Enviado → DDJJ OK) y el **anti-duplicados del importador** —
> ver las tres §§ nuevas antes de «Lo que falta documentar».

---

## 🎯 Por qué importa

Es el eslabón por donde entra la **información oficial** al sistema: los comprobantes emitidos y
recibidos que ARCA tiene registrados. Todo lo que sigue —conciliación, pagos, contabilidad,
presupuesto— se apoya en que esa entrada sea completa y confiable.

Conecta directo con el norte (`CLAUDE.md` § 🧭): *todo alimenta al presupuesto*. Si ARCA entra
incompleto, el resultado del período en curso ([A-FEAT-10](PENDIENTES.md#a-feat-10)) sale mal.

---

## ✅ LO QUE FUNCIONA — descarga de comprobantes desde ARCA

**Lo logrado (sep-2025):** entrar a ARCA con las credenciales del usuario y **descargar los
comprobantes emitidos y recibidos** — la información oficial, en Excel/CSV.

**Evidencia en disco (verificada 2026-08-02):**
- `arca-api/downloads-arca/Mis Comprobantes Recibidos - CUIT 30617786016.xlsx` (49 KB, 16/09/2025)
- `arca-api/downloads-arca/comprobantes_consulta_csv_recibidos_128600580_30617786016_20250916-1029.zip`

**Dónde vive el código:** `arca-api/` — proyecto **Node aparte**, no parte del build de Next.js.
```
arca-api/
├── modules/afip-login.js                      ← el login a ARCA (la pieza clave)
├── modules/download-comprobantes.js
├── modules/download-comprobantes-complete.js
├── scripts/test-login.js · test-connection.js · test-download-comprobantes.js
├── tools/live-observer.js                     ← observar la sesión en vivo (debug)
├── config/credentials.json                    ← 🔒 NO commitear (en .gitignore)
├── downloads-arca/                            ← salida de las descargas
└── logs/
```

**Método:** automatización del navegador con **Selenium WebDriver**. Se eligió por ser gratuito y
no depender de que AFIP habilite APIs (ver § Investigación).

> ⚠️ **Sin correr desde el 19/09/2025.** Que el sitio de ARCA no haya cambiado desde entonces es
> una suposición, no un hecho: **antes de confiar en esto, correr `scripts/test-login.js`**.
> Los selectores de un sitio ajeno se rompen sin aviso.

---

## ❌ LO QUE NO SE LOGRÓ

El plan original tenía tres fases. **Sólo se completó la primera.**

| Fase | Qué era | Estado |
|------|---------|--------|
| 1 | Descarga de comprobantes recibidos | ✅ **Logrado** |
| 2 | Upload de retenciones **SICORE → SIRE** | ❌ Nunca se llegó |
| 3 | Carga de comprobantes **Portal IVA** | ❌ Nunca se llegó **por Selenium** · ✅ **resuelto por otra vía 2026-10-19**: la app arma los **archivos de texto** y el usuario los importa a mano en IVA Simple — ver § 📤 |

**Motivo (usuario, 2026-08-02):** *"con Selenium no llegamos a buen puerto"* — más allá de la
descarga, la automatización no prosperó. Existen `modules/sicore.js` y `modules/portal-iva.js`
en el README del subproyecto, pero **no en el disco**: quedaron como estructura planificada.

**Por qué se documenta el fracaso:** para no volver a gastar semanas reintentando la misma vía
sin saber que ya se intentó. Si en el futuro se retoma la Fase 2 o 3, arrancar leyendo la historia
cruda en `arca-api/INTEGRACION_SICORE_ARCA.md` (issues, selectores, lecciones).

---

## 🔜 DESDE ACÁ SE PUEDE AVANZAR

Criterio del usuario (2026-08-02):

> *"Logramos entrar a ARCA para descargar info oficial."*

El activo no es la descarga en sí: es el **acceso automatizado a ARCA**. Teniendo login resuelto,
cualquier información oficial que ARCA exponga es alcanzable. Candidatos naturales:
- Comprobantes emitidos y recibidos **al día**, sin bajarlos a mano.
- Constancias, padrones, situación fiscal de proveedores y clientes.
- Las Fases 2 y 3, si alguna vez valen el esfuerzo.

Se irá avanzando **a medida que los eventos lo pidan** (`CLAUDE.md` § ⏱️ Cómo se avanza).

---

## 🔍 La investigación previa (sep-2025) — qué se comparó

Antes de elegir Selenium se evaluaron alternativas. Resumen, para no reinvestigar:

| Opción | Veredicto de entonces |
|---|---|
| **Selenium** (automatización web) | ✅ **Elegida** — inmediata, sin esperar a AFIP, usa las credenciales existentes. Contra: depende de la UI de ARCA y se rompe si cambia |
| **APIs oficiales de AFIP** | Descartada por tiempos de habilitación |
| **AFIPSDK** (open source + servicio comercial) | Investigada, no adoptada |

Detalle completo en `arca-api/INVESTIGACION_INTEGRACION_ARCA_AFIP.md`.

> 💡 Esa evaluación es de **septiembre de 2025**. Si se retoma el tema, revisarla antes de darla
> por válida — el panorama de APIs de ARCA puede haber cambiado.

---

## 📤 SALIDA HACIA ARCA — el Libro IVA Compras en archivos de texto (IVA Simple)
*[A-FEAT-1286](PENDIENTES.md#a-feat-1286) · 2026-10-16 · probado en ARCA el 2026-10-19 → [A-TEST-1216](PENDIENTES.md#a-test-1216)*

**Para qué.** Que lo que ARCA **no precarga** en el Libro IVA Compras de IVA Simple (tickets, lo cargado a
mano, lo imputado a otro mes que el de su fecha) entre **de una vez**, con un archivo, y no una factura por
vez. Es la Fase 3 de arriba, resuelta sin automatizar el portal: **la app arma el archivo, el usuario lo sube**.

**Qué arma** (`lib/subdiarios/libro-iva-arca.ts`, botón 📤 en Subdiarios, **sólo MSA** — PAM y MA no son
inscriptas): el par de archivos de **ancho fijo** del diseño RG 4597 — **COMPROBANTES** (un renglón por
factura) y **ALÍCUOTAS** (uno por alícuota de cada factura, 84 caracteres) — con **lo imputado al mes en el
subdiario**, igual que el PDF y el Excel. En dos versiones: **A** = el registro de 2023, **325** caracteres
(el que ARCA aceptaba al sistema viejo) · **B** = con el campo nuevo de TurIVA, **340**.

**Decisiones del usuario (16/10), y por qué:**
- **Se plasman los datos, no se tratan**: cada columna de la app a su campo. Si el dato está mal, el
  archivo lo repite — y el control lo avisa, pero no lo corrige.
- **Tipo de documento siempre CUIT (80)**; **sólo Compras y sólo MSA**.
- Las únicas transformaciones son **de formato de ARCA**: importes en positivo (la NC ya resta por su tipo),
  B y C con 0 alícuotas, moneda original con su cotización, CUIT propia como «corredor» en los tipos que lo piden.

**El control (§ 🚦 de `CLAUDE.md`)**: lo que dice el archivo contra lo que dice el subdiario — si no cierra,
**frena** (sería la app contradiciéndose); los comprobantes raros **se avisan** y salen igual.

**✅ Lo que contestó ARCA (2026-10-19, primera carga real, octubre, 5 comprobantes):**
- **El formato A lo toma.** Aceptó 3; los importes del Excel que devuelve ARCA coinciden con la app.
- **ARCA controla contra lo YA DECLARADO**: rechazó 2 con *«El comprobante ya fue declarado en otro período.
  Se incluyó en la presentación del período 09/2026»*. **No era un error del archivo**: eran comprobantes que
  la app tenía duplicados ([A-BUG-1299](PENDIENTES.md#a-bug-1299), ver § 🔁 abajo). Es un control gratis de
  la pieza 4 del norte administrativo — *el mismo número por dos caminos* — que no hay que construir.
- Los rechazos vienen en un **CSV** (`registros_con_errores_tarea_NNN.csv`, separado por `;`, en Latin-1):
  número de línea del archivo de comprobantes + del de alícuotas + el texto del error.
- **Todavía no se sabe**: si lo importado **se suma o reemplaza** a lo que ARCA precarga, si la **B** también
  entra, ni cómo trata las B y las sin CAE.

---

## 📨 LOS SUBDIARIOS Y SU ESTADO — Imputado → Enviado al contador → DDJJ OK
*[A-FEAT-1295](PENDIENTES.md#a-feat-1295) · 2026-10-19 → [A-TEST-1220](PENDIENTES.md#a-test-1220)*

**El problema que resolvió** (usuario): *«yo envío al contador y eso no es cerrarlo. Luego él me avisa más
adelante que lo hizo y yo ya no vuelvo al proceso»*. Entre «imputado» y «presentado» faltaba un estado: el
mes **ya está en manos del contador** y moverlo en silencio hace que lo suyo deje de coincidir con la app.

**Cuatro estados en `ddjj_iva`**, iguales en Compras (`comprobantes_arca`) y Ventas (`comprobantes_venta`):
`No` → `Imputado` → **`Enviado`** → `DDJJ OK`.

**Las reglas, todas en `lib/subdiarios/estado-ddjj.ts`** (una sola función, `evaluarCambioDDJJ`, que
devuelve *libre / advertir / bloquear* y usan **todos** los caminos: imputar, desimputar, cambiar de mes,
editar, borrar en Ventas, el alta de una venta, marcar Enviado, confirmar DDJJ):
- **Sobre lo Enviado o DDJJ OK** —un comprobante o un mes destino—: **sólo el admin, siempre con
  advertencia**. El rol `contable` (Ulises) **no lo toca nunca**: decisión del usuario, *«Ulises ya no podría
  actuar sobre lo enviado o presentado nunca, sólo yo y con warning»*.
- **Marcar Enviado o confirmar DDJJ**: sólo el admin.
- **El estado de un MES = el más avanzado de sus comprobantes.** Uno imputado tarde a un mes ya enviado queda
  «Imputado» y el mes sigue «Enviado»: así salta el aviso **y** se ve cuál le falta mandar al contador (el
  **+N** naranja del tablero).
- **Si no se puede leer el estado del mes, se lo supone presentado**: una advertencia de más es barata; un mes
  presentado movido sin aviso, no.

**El tablero 🗓️ Estado de los meses** (`components/estado-meses-ddjj.tsx`, arriba de los dos subdiarios):
todos los meses con su color, y cuántos enviados faltan confirmar. Es la mitad **«control después»** del
checklist de obligaciones (`CLAUDE.md` § 🔔): sin él, un mes enviado que el contador presentó queda «Enviado»
para siempre. *Primero fue un recuadro sólo con los enviados; el usuario pidió ver también los presentados.*

**Lo que NO pasa por la regla** (huecos registrados):
- El **importador de ventas** desde ARCA imputa al mes de emisión sin mirar si ese mes ya se envió.
- El **borrado** de facturas de compra desde 🔧 Modo Admin: lo lista como vinculado («DDJJ IVA ya cerrada»)
  pero no llama a `evaluarCambioDDJJ`. Es sólo del admin, así que no le abre la puerta al rol contable.

---

## 🔁 EL ANTI-DUPLICADOS DEL IMPORTADOR — y el caso que se le escapa
*Medido 2026-10-19 → [A-BUG-1299](PENDIENTES.md#a-bug-1299)*

`app/api/import-facturas-arca/route.ts` no carga un comprobante si ya existe uno con la **misma clave:
CUIT + tipo + punto de venta + número**. Lo controla dos veces: en la **vista previa** (contra todos los
existentes) y **al guardar** (uno por uno).

🕳️ **Lo que se le escapa: el mismo papel con OTRO TIPO.** Las cooperativas de servicios emiten
**Liquidación de Servicios Públicos A (tipo 17)**, pero en el papel dice «Factura». Si se carga a mano como
Factura A (tipo 1) y después llega en la importación de ARCA como tipo 17, **la clave no coincide y queda dos
veces** — y el crédito fiscal, contado dos veces. Caso real: Coop. Eléctrica de San Pedro, 23-200453 y
23-200987, ≈ $189.569 de IVA. Lo destapó **ARCA** al rechazarlas (§ 📤), no la app.
- **Arreglo propuesto**: avisar cuando coinciden **CUIT + punto de venta + número aunque cambie el tipo**.
- **Al corregir a mano, quedarse con la de ARCA**: si se borra la de ARCA, la próxima importación la vuelve a
  traer (el anti-duplicados sigue sin ver la manual).
- ⚠️ La vista previa lee los existentes **sin paginar**: pasados los 1000 podría mostrar como «nuevo» uno que
  ya está. La carga no duplica igual, porque al guardar vuelve a controlar uno por uno.

---

## 🚧 LO QUE FALTA DOCUMENTAR ACÁ → [A-DOC-09](PENDIENTES.md#a-doc-09)

Este archivo cubre **la puerta de entrada** (`arca-api/`). Falta todo el lado de la app, que hoy
no está documentado en ninguna dimensión:

- `app/api/arca` · `app/api/arca-asignar` · `app/api/import-facturas-arca`
- `lib/arca`
- `components/vista-facturas-arca.tsx` · `components/vista-asignacion-arca.tsx`
- Reglas de importación por CUIT (`modal-reglas-import.tsx`)
- Cómo se relaciona con `app/api/gas` (búsqueda de PDFs de facturas)

Sin eso, el módulo está documentado por la mitad.

---

## 🔒 Seguridad
- `arca-api/config/credentials.json` tiene credenciales de AFIP y **está en `.gitignore`**. No
  commitear, no pegar en documentación, no incluir en exports.
- Ver `PENDIENTES.md` § [A-SEC-02](PENDIENTES.md#a-sec-02) — hay antecedentes de secretos filtrados
  en este repo.
