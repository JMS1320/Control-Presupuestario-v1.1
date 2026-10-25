# 🧩 MÓDULO — Parseo de extractos (Caja de Ahorro)

> **Qué documenta**: cómo está pensado por dentro el desglose del texto del banco en columnas.
> **Cómo se opera** → `MANUAL-USO.md` § Reglas de parseo · **dónde vive el dato** →
> `ARQUITECTURA-BD.md` · **qué falta** → `PENDIENTES.md`.
>
> **Última actualización**: 2026-09-25.
> **Alcance**: **sólo MA Galicia CA y PAM Galicia CA.** Las cuentas corrientes (MSA, PAM CC) vienen
> del banco ya separadas en columnas y **no se tocan** — palabras del usuario: *«para MSA eso
> funciona así porque así lo da el banco, no podemos o no debemos modificarlo»*.

---

## 🎯 El problema

En Caja de Ahorro el banco no manda columnas: manda **un bloque de texto por movimiento**, con un
renglón por dato, sin rótulos y sin orden garantizado.

```
TRANSFERENCIA A TERCEROS
NO  27300503905
0140363103650054482399
LINK
4517XXXXXXXXXX11
VARIOS
```

El parseo reparte eso en columnas para poder **buscar por CUIT**, **conciliar por CBU** y saber a
quién se le pagó sin abrir el texto.

🔑 **El texto crudo del banco queda guardado entero en `concepto` y no se toca nunca.** Todo lo
demás —reglas, subtipos, re-parseo— se rehace cuantas veces haga falta. **Nunca hay que volver a
importar el Excel.**

### 📄 Cuando entra por el resumen PDF *(2026-10-24, A-FEAT-1352)*

El resumen PDF trae los mismos datos **escritos de otra manera**, y si se guardara tal cual cada
movimiento caería en un subtipo nuevo. Por eso el importador (`lib/extractos/pdf-caja-ahorro-galicia.ts`)
lo **reescribe como lo escribe el Excel** antes del parseo: tarjeta enmascarada (`4517XXXXXXXXXX29`),
`CU  ` con dos espacios, tarjeta al final, y el «origen» como última línea con su letra (`0279` →
`A279`; la letra sale de cómo vino ese tipo en la cuenta, `C` en las extracciones por sucursal).

En `concepto` queda entonces **ese texto reescrito**, no el del PDF — es la excepción a la regla de
arriba, y por eso esas filas llevan `origen = 'CA_GALICIA_PDF'`. Dos datos el PDF los **corta** y no
se pueden reconstruir del todo: nombres a 20 letras y **CBU a 20 dígitos**. Se completan sólo con un
candidato único de lo ya conocido; el CBU que no se completa **se toma igual como CBU** (`esCbu`
acepta 20 dígitos, decisión del usuario), así la transferencia conserva su subtipo.

#### Por qué un adaptador y no un parseo aparte *(decisión del usuario 2026-10-24)*
*«Hay veces que si no se descargan los movimientos a tiempo la única manera es ir vía PDF… un
adaptador dentro del importador me suena lo mejor.»* El Galicia sólo deja bajar el Excel de los
últimos meses; lo anterior existe nada más que como resumen PDF. Con el adaptador **hay un solo
juego de reglas por cuenta**: lo que entra por PDF cae en los mismos tipos y subtipos que lo que
entra por Excel, y si un día se importa el Excel de un mes ya cargado por PDF, la clave de duplicado
(sobre el texto) **coincide**, porque el texto es el mismo.

#### Cómo se lee
1. **Por posición, no por texto plano** (KNOWLEDGE § *Leer un PDF: la posición es dato*): cada
   renglón se arma por su altura en la página y sus piezas por su posición horizontal
   (`agruparRenglones` en `lib/polizas/renglones-pdf.ts`, el mismo que usan las pólizas).
2. **Las columnas se ubican en cada página**, buscando el renglón «Fecha · Descripción · Origen ·
   Crédito · Débito · Saldo». Entre abril y mayo **se corrieron**: fijarlas a mano habría leído mal
   el segundo mes sin avisar.
3. **Saldo vs. importe**: el número a la derecha de la mitad entre «Débito» y «Saldo» es el saldo;
   el otro es el importe, y **su signo decide** si es débito (con `-`) o crédito. Si la columna en la
   que cayó no coincide con el signo, se avisa.
4. **Un movimiento empieza con una fecha**; los renglones sin fecha se suman al anterior, incluso
   si el movimiento se parte entre dos páginas. El pie de página («Página…», «Resumen de Caja…») se
   saltea y el renglón **«Total»** cierra la tabla.
5. **La cabecera** de la página 1 da el CUIT del titular, el número de cuenta, el CBU, el período y
   los saldos inicial y final.

#### Los controles — cuál frena y cuál avisa (CLAUDE.md § 🚦)
| Control | Contra qué | Si no cierra |
|---|---|---|
| suma de créditos y de débitos | la fila «Total» del propio resumen | 🛑 frena (forzable) |
| saldo de cada movimiento = anterior ± importe | el propio resumen | 🛑 frena (forzable) |
| saldo final leído | el «saldo final» de la cabecera | 🛑 frena (forzable) |
| CUIT del titular | el de la cuenta elegida (`DATOS_FISCALES`) | 🛑 frena (forzable): es el PDF de otra empresa |
| saldo inicial | el último saldo que ya tiene la app | ⚠️ el control de cadena de siempre, igual que el Excel |

Los cuatro primeros son **integridad**: el papel se contradice o se leyó mal, y no hay explicación de
negocio. El último es **discrepancia**: puede faltar un mes en el medio.

#### Qué se completa y con qué
| Dato | El PDF trae | Queda | De dónde sale |
|---|---|---|---|
| tarjeta | `4517699027757829` | `4517XXXXXXXXXX29` | se enmascara como el Excel (4 + 10 X + 2) |
| origen | columna `0279` | última línea `A279` | la letra, de cómo vino ese tipo en la cuenta; si nunca vino, `C` para EXTRACCION EN AUTOSERVICIO y `A` para el resto, **marcada como supuesta** |
| nombre | 20 letras | completo | sólo si en la misma cuenta hay **un** nombre conocido más largo que empieza igual y el cortado no existe ya tal cual |
| CBU | 20 dígitos | 22 | sólo si hay **un** CBU conocido (extractos de la cuenta o ficha del proveedor) que empieza igual; con dos, gana el del mismo CUIT; si no, queda de 20 |

Todo lo completado o supuesto se **lista antes de importar** («👁 Ver cómo queda», que no guarda) y
en el resultado de la importación. Medido con MA abril y mayo 2026: 99 movimientos, 98 desglosados,
de 10 CBU cortados se completaron 2.

#### Lo que falta y por qué
- **Cuenta corriente MSA y PAM**: su resumen es otro diseño; hace falta un PDF real de cada una.
- **El texto original del PDF** no se guarda: `concepto` lleva el texto ya reescrito. La pantalla lo
  muestra antes de importar («Decía el PDF»); guardarlo después pediría una columna nueva.
- **PAM caja de ahorro** se armó con el resumen de MA (el banco usa el mismo diseño); el control de
  CUIT del titular es el que avisa si el de PAM viniera distinto.

---

## 🧬 El TIPO es la unidad. El SUBTIPO aparece sólo cuando hace falta

> 🗣️ **Cómo se habla de esto** *(corrección del usuario, 2026-09-26: «no hablamos de subtipo si no
> lo hay»)*: **la unidad de trabajo es el TIPO de movimiento.** Un tipo se parte en **subtipos**
> sólo cuando el banco lo manda escrito de **más de una manera**.
>
> 📊 **En números**: **PAM tiene 9 tipos y ninguno con más de una forma** — ahí la palabra
> «subtipo» no significa nada y no se usa. **MA tiene 12 tipos y 16 subtipos**, porque **3 de esos
> 12** llegan de varias maneras. *(La pantalla hace lo mismo: dice «5 líneas» cuando hay una sola
> forma, y «Subtipo de 5 líneas» sólo cuando hay más.)*
>
> ⚠️ Un contador que diga *«9 tipos · 9 subtipos»* **no informa nada**: los dos números iguales
> significan que ningún tipo se parte. Por eso la pantalla muestra sólo los tipos.

Un mismo tipo de movimiento llega escrito de maneras distintas. Cada una es un **subtipo**, y su
huella es **cuántos renglones trae y de qué clase es cada uno**:

```
6:tipo,cuit,cbu,texto,tarjeta,texto
```

*(En la BD la columna se llama `firma_forma` por historia. El concepto se llama **subtipo** desde el
2026-09-25 — [A-DEC-29]: «es más preciso», y la app lo muestra así.)*

### Por qué no alcanza con contar renglones

**`DEB. AUTOM. DE SERV.` tiene dos subtipos de 5 renglones**, distinguidos sólo por la **clase** de
la línea 4: `num` (el nº de cliente de AySA) vs `texto` (los códigos del ACA). Por eso la firma mira
la clase de cada renglón y no sólo cuántos hay.

### Por qué esto es lo que más rinde

`TRANSFERENCIA A TERCEROS` llega de **tres** maneras, y entre dos de ellas **los renglones 5 y 6
están dados vuelta**: en una la tarjeta es el quinto, en la otra el sexto.

> Una regla que dice *«el renglón 5 es la tarjeta»* acierta en 12 movimientos y **guarda `VARIOS` en
> la columna de la tarjeta** en otros 4. No da error: deja un dato creíble en la columna equivocada,
> que es el peor desenlace posible.

### ⚠️ La clase de línea NO se afina más — criterio fijado

[A-DEC-28]: se evaluó agregar clases (`banco`, `red`, `rotulada`, `periodo`) y **no conviene**.
Medido sobre 121 movimientos: **ninguna forma esconde datos que irían a columnas distintas**, y
afinar llevaría `TRANSFERENCIA A TERCEROS` de 3 subtipos a 6 — el doble de reglas, y las 3 nuevas
nacidas de un hueco del reconocedor, no de una diferencia real.

> 🔑 **El criterio**: una clase entra a la firma **sólo si cambia A DÓNDE VA el dato**.
> `num` vs `texto` en Déb. Autom. lo cambia → entra. `LINK` vs `FNCS` van los dos a *banco o red* →
> no entra.

---

## 📐 La convención de columnas — cerrada, no editable

*Acordada 2026-09-24. Se **muestra** (botón ℹ️ *Ver dónde se guarda cada dato*) pero **no se
edita**: en palabras del usuario, «editar uno sería editar todos, si no no hay coherencia».*

| Qué es el dato | Columna | Ejemplo real de MA |
|---|---|---|
| Tipo de movimiento | `descripcion` | `TRANSFERENCIA A TERCEROS` |
| Nombre / comercio | `leyendas_adicionales_1` | `MARTINEZ PLACIDO ANDRES` |
| **CUIT de la contraparte** 🔑 | `leyendas_adicionales_2` | `20287492546` |
| Concepto | `leyendas_adicionales_3` | `VARIOS` · `CUOTA ACA` |
| Entidad destino o red | `leyendas_adicionales_4` | `RIOP` · `PERSONAL PAY` · `LINK` |
| **CBU destino** | `tipo_de_movimiento` | `0140363103650054482399` |
| Nº de operación **o** autorización | `numero_de_comprobante` | `A837` |
| Terminal, sucursal o tarjeta | `numero_de_terminal` | `4517XXXXXXXXXX11` |
| 🛑 Texto crudo del banco | `concepto` | — no se toca |
| 🛑 Comentarios del usuario | `observaciones_cliente` | — no se toca |

**Motivo de que no se edite**: el CUIT es el que lee el motor de conciliación. Si fuera a un lugar
en las transferencias y a otro en los débitos, **el motor encuentra la mitad**.

### La entidad destino llega de tres maneras

Confirmado por el usuario mirando los 12 movimientos ([A-FEAT-1175]):

| Cómo llega | Ejemplos |
|---|---|
| nombre completo | `BANCO DE GALICIA Y BUENOS AIRES SAU` |
| **código de 4 letras** del Galicia | `FNCS` = BBVA · `RIOP` = Santander Río |
| **billetera virtual** | `PERSONAL PAY` · `MERCADO LIBRE SRL` |

🔑 **El código sigue al BANCO, no a la contraparte**: dos personas distintas con CBU distintos, los
dos empezados en `072`, dicen los dos `RIOP`.

📌 **`LINK` es la RED, no la entidad** — decisión del usuario: *«si LINK está en el lugar de los
bancos lo podemos dejar así salvo que además diga el banco»*. **Se verificó que no lo dice**: en las
8 transferencias con LINK ninguna otra línea nombra un banco. Va a la misma columna.

⏳ **El arreglo de fondo pendiente** → [A-FEAT-1176]: sacar la entidad del **prefijo del CBU** (`014`
Provincia, `017` BBVA, `072` Santander, `007` Galicia). Resuelve solo cualquier banco y deja **el
mismo dato llegando por dos caminos**, que es un control gratis.

---

## 🏷️ El GRUPO DE CONCEPTOS — el vocabulario es del banco

> **No se inventa: se copia.** En **cuenta corriente el Galicia ya manda el grupo** en su Excel, con
> su código propio (`000907 - Transferencias`). En Caja de Ahorro no lo manda —viene todo en una
> celda— y hay que ponerlo a mano. **Usando la misma lista, el mismo hecho tiene el mismo grupo en
> las dos clases de cuenta.**

🧨 **El problema que resolvió**: era texto libre y terminó con **20 valores para 10 conceptos**
(`Servicios` y `Servicios Pago`, `Tarjetas` y `Tarjeta Debito`). Una compra con débito era
«Tarjeta Debito» en MA y `000905 - Extracciones` en MSA: **el mismo movimiento con dos nombres**.

**La lista cerrada** (`GRUPOS_GALICIA`, en el motor):

```
000083 - Pagos          000905 - Extracciones      000912 - Debitos Cheques
000808 - Comisiones     000907 - Transferencias    000916 - Inversiones
000814 - Intereses      000908 - Haberes
000901 - Impuestos      000909 - Pago Proveedores
000903 - Créditos Varios
```

📌 **El mapeo tipo → grupo sale de lo que el banco hace en MSA**, con el mismo nombre de tipo. Por
eso `COMPRA DEBITO` va a **Extracciones** y no a Pagos, y `TRANSFERENCIAS CASH PROVEEDORES` a
**Transferencias** y no a Pago Proveedores — aunque las dos suenen al revés.

**Tres reglas:**
1. **Desplegable cerrado**, no texto libre.
2. **Obligatorio**: sin grupo no se guarda. *(Hubo un default `Otros` durante unas horas; el usuario
   lo rechazó: «si está vacío debe pedir ser llenado».)*
3. La app **propone** el grupo mirando el tipo, y **si no lo conoce lo deja vacío**. Un grupo mal
   puesto es peor que uno vacío, porque el vacío se ve.

🧨 **Y lo que hay que saber: hoy no lo lee nadie.** El parseo lo escribe en el movimiento y ninguna
pantalla ni el motor de conciliación lo consultan. Es la pieza que espera [A-FEAT-17] — *«si ya se
sabe qué es cada movimiento, sabemos mucho de cómo conciliar»*.

🔓 **Queda abierto**: el usuario lo aprobó como punto de partida —*«de última, cuando tenga tiempo
de pensarlo, lo cambiamos»*—, y por eso la lista vive en un solo lugar.

---

## ⚖️ LO GUARDADO MANDA — el modelo, y costó tres vueltas llegar

> **Una regla guardada ES el valor. La app opina al lado; su opinión no pisa nada.**

Es `CLAUDE.md` § 🎚️ *Default del dato real, siempre editable* aplicado acá: **campo lleno = acá
mando yo**. Las tres vueltas del 2026-09-25, todas encontradas por el usuario, valen como registro
porque el patrón se repite:

| | Qué se hizo | Por qué falló |
|---|---|---|
| [A-BUG-1202] | se copiaba la columna vieja | el desplegable decía «CBU destino» y abajo otra columna |
| [A-BUG-1205] | ganó la propuesta de la app | **una corazonada pisó una decisión** |
| [A-BUG-1207] | ganó sólo la propuesta **segura** | la app está *segura* de que `0000055193` es un concepto, y él había decidido otra cosa |

🧨 **Cada arreglo achicó el agujero en vez de taparlo.** El modelo correcto era el más simple y ya
estaba escrito en las reglas del proyecto.

📌 **Corolario**: una regla **ya atada a su subtipo** no se vuelve a discutir. Sólo se señala la
discrepancia cuando la regla es **vieja y genérica** — si no, la app marca en ámbar para siempre
algo que el usuario acaba de decidir, y eso entrena a ignorar los avisos.

---

## 🚦 Los cuatro estados de un subtipo

| Estado | Qué significa | Quién lo arregla |
|---|---|---|
| ✅ **Cierra** | cada línea guardada donde va | nadie |
| 🟠 **La app propone otra columna** | discrepancia con una regla **vieja y genérica**. Puede tener razón cualquiera de los dos | el usuario decide; se aplica con un click |
| 🔴 **Choque de columnas** | dos líneas guardadas en la misma columna | **hay que arreglarlo sí o sí** |
| ⚪ **Sin reglas** | nunca se configuró | el usuario, o el botón de preseteo |

### 🛑 El choque NO SE PARSEA — decisión del usuario

*2026-09-24: «que directamente no se parsee, así sigue dando alerta y yo veo qué hacer».*

Cuando dos reglas reclaman la misma columna, **el movimiento entero queda sin parsear**
(`GRUPO_CHOQUE`) — **no** es que gane una. Es § `CLAUDE.md` 🚦 *integridad*: no hay explicación de
negocio posible para que dos datos distintos vayan al mismo lugar, así que **frena**.

*Y no se pierde nada: el texto crudo sigue entero, así que arreglada la regla un re-parseo lo
recupera.*

### 🆕 El subtipo nuevo tampoco se parsea

Si un tipo tiene reglas por subtipo y llega uno que ninguna cubre, **no se parsea**
(`GRUPO_SUBTIPO_NUEVO`). La alternativa —aplicar la regla del subtipo más parecido— deja el
movimiento **lleno y mal**, que se ve igual que uno bueno y nadie revisa.

---

## 🤖 Lo que la app hace sola, y lo que no

> *«Si la app ya reconoce bien, ¿por qué no lo dejás preseteado así? Lo que yo debo hacer a mano es
> lo que no se puede reconocer de entrada»* — usuario, 2026-09-25 → [A-FEAT-1178].

**Botón «Dejar listo lo que la app reconoce»**:

- **escribe** las líneas que reconoce **con certeza** (tipo, CUIT, CBU, tarjeta, entidad) y las que
  el usuario **ya había configurado**, atándolas a su subtipo;
- **no toca** las que nadie sabe qué son y no tienen regla;
- **borra las reglas viejas sin subtipo** de los tipos que tocó — si quedaran, seguirían aplicándose
  a todos los subtipos, que es la causa de [A-BUG-1200];
- **nunca corre solo**: escribe en la BD, así que pide confirmación con el detalle.

⚠️ **Una regla vieja sin subtipo no se recicla para más de uno.** Se intentó y el resultado fue que
**un subtipo se quedó sin ninguna** ([A-BUG-1206]): las genéricas aparecen en la lista de todos los
subtipos del tipo, el bucle las actualizaba una vez por cada uno y ganaba el último.

⚠️ **Si dos líneas del mismo subtipo reclaman la misma columna, la segunda se deja para el usuario**
en vez de escribirla: escribir las dos daría choque y el movimiento no se parsearía.

⏳ **Pendiente de diseño** → [A-OP-20]: el preseteo escribe **fila por fila sin transacción**, así
que un error a mitad deja el trabajo por la mitad. Pasó con [A-BUG-1204].

---

## 🧮 Los controles, y dónde se ven

*§ `CLAUDE.md` 🧮: un control que nadie ve no es un control.*

| Control | Dónde se ve |
|---|---|
| **Movimientos sin parsear**, con las 4 causas separadas | cartel en **Principal** |
| **Estado de la cuenta**: choques · discrepancias · sin reglas · líneas que decide el usuario | cartel arriba de **Reglas de parseo** |
| **Qué línea no termina donde va**, una por una | dentro de cada subtipo |
| **Choque de columnas**, con las dos líneas nombradas | en rojo, dentro del subtipo |
| **`N de M subtipos revisados`** | cabecera de la pantalla |

🔑 **El cálculo vive en el motor** (`auditarSubtipo`), no en la pantalla: así la pantalla, la API y
cualquier script dan **el mismo número**. Si cada uno tuviera su cuenta, el día que cambie una regla
empiezan a diferir y no hay forma de saber cuál miente.

### ✅ La marca «ya lo revisé»

[A-FEAT-1180]. Un subtipo se da por bueno con un check, se pliega y suma al contador.

🔑 **La marca se cae sola si después cambian las reglas de ese subtipo.** Un *«ya lo vi»* que
sobrevive a un cambio **tapa justo lo que había que mirar**.

📌 **El choque se sigue viendo aunque esté marcado**: eso es integridad, no opinión, y no se tapa
con un tilde.

🆕 **Tildar acepta la propuesta** ([A-FEAT-1354], 2026-10-24): si el subtipo no tiene reglas, el tilde inserta
las de la propuesta (`reglasDeLaPropuesta()`) con `revisado_en`; si la propuesta tiene columnas repetidas
(`columnasRepetidas()`), no deja. 🛑 **Y exige grupo** ([A-FEAT-1360]): `tieneGrupoPrevisto()` — vacío u
«Otros» no cuentan; el bloque muestra «falta el grupo de conceptos». *Motivo: el usuario tildó sin abrir
Editar creyendo que guardaba, y MA quedó con tipos sin grupo que el re-parseo marcó como no parseados.*

🔤 **La clave del tipo** ([A-FEAT-1347]): `claveDeTipo()` pasa a mayúsculas, cambia los puntos por espacios y
saca las palabras de 7+ dígitos (nº de echeq). `DEB. AUTOM. DE SERV.` = `DEB AUTOM DE SERV` (el formato 2025 del
banco) y `GDE ECHEQ 12345678` = `GDE ECHEQ`. `resolverReglas` junta las reglas de todas las claves iguales.

---

## 🔁 El re-parseo

Vuelve a desglosar movimientos **ya importados**, leyendo el texto crudo de `concepto`. Usa
exactamente la misma lógica que el importador, así que re-parsear algo bien importado no lo cambia.

- **Pasada en seco por defecto**: informa qué cambiaría y no toca nada.
- **Corre sobre lo FILTRADO** ([A-FEAT-1172]), igual que Conciliar — pedido del usuario: *«si tengo
  filtrados 15 movimientos en pantalla y le doy a parsear, que me parsee esos 15 únicamente»*.
- ⚠️ **Sin filtro corre sobre la cuenta entera, a propósito**: el Extracto carga por páginas, así
  que «todo lo visible» sería sólo lo cargado y el re-parseo tocaría menos de lo que dice.
- **Nunca escribe en `concepto` ni en `observaciones_cliente`**, ni en los campos de la conciliación
  (`categ`, `detalle`, `contable`, `interno`, estado).
- 🆕 **Primero ofrece sólo lo no parseado** ([A-FEAT-1358], 2026-10-24): la pasada en seco cuenta
  `cambiosSinParsear` (`estaSinParsear()`: grupo vacío, «Otros», «Subtipo nuevo» o «Reglas en conflicto») y
  `cambiosConciliados`; la pantalla pregunta *«¿Re-parsear SÓLO esos N?»* (`soloSinParsear`) y recién si no,
  todo, avisando cuántos conciliados cambiarían. *Motivo: el usuario re-parseó PAM entera para arreglar 4 tipos.*

⏳ **El formato 2025 del banco no tiene reglas** *(visto 2026-10-18, histórico PAM)*: en 2025 el Galicia escribía distinto (`DEB AUTOM DE SERV`, `ING BRUTOS S/ CRED`, sin puntos), así que de los 250 movimientos de la CA de PAM cargados como histórico ~200 quedaron **sin desglose** (grupo «Otros»). No se perdió nada: el texto entero está en `concepto`. Cuando haya reglas para esas formas, se re-parsean desde acá filtrando los históricos — el re-parseo no toca la conciliación. → [A-DEC-1010](PENDIENTES.md#a-dec-1010)

---

## 📊 Estado al 2026-09-25

**MA Galicia CA — auditoría terminada por el usuario:**

| | |
|---|---|
| Movimientos | 96 |
| Tipos · subtipos | 12 · 16 |
| **Subtipos revisados** | **16 de 16** |
| Cierran | **96** |
| Choques · discrepancias · sin reglas | **0 · 0 · 0** |
| Quedarían sin parsear al re-parsear | **0** |

⏳ **Falta correr el re-parseo**: las reglas están, el desglose guardado todavía no
([A-BUG-1199]). Hasta que se corra, los 96 movimientos siguen en blanco.

**PAM Galicia CA**: 25 movimientos, **21 sin regla** en 6 tipos. Sin empezar.

---

## 🔗 Referencias

- Explicación larga de los subtipos, con los 18 de MA y ejemplos reales:
  https://claude.ai/artifact/4TYJaTjRKRDGTx9vhHNodV
- Motor: `lib/extractos/parseo-movimiento.ts` — pantalla:
  `components/configurador-reglas-parseo.tsx` — API: `app/api/reparsear-extracto/route.ts`
- Cómo se opera → `MANUAL-USO.md` § Reglas de parseo
- Dónde vive el dato → `ARQUITECTURA-BD.md` § `config_parseo_extracto`
