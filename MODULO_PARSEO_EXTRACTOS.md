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

---

## 🧬 El SUBTIPO — la unidad de trabajo

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
