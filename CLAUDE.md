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

## 🤖 REGLAS — LAS DOS SECCIONES OBLIGAN IGUAL

> **La división es por DESTINO, no por jerarquía.** Dice a qué archivo maestro pertenece cada
> regla — nada más. **Ninguna de las dos secciones es opcional ni secundaria.**
>
> **Casi todo es común**: el usuario mantiene un `CLAUDE_BASE.md` fuera de este repo con las
> reglas que usa en todos sus proyectos. Acá hay **una sola regla exclusiva**, y va primero.
>
> ⚠️ **Que una regla sea portable no la hace genérica.** Varias de las comunes se instancian acá
> con nombres propios — el maestro se lleva el principio, este archivo conserva el **anclaje**
> (`📍 Acá:`). Leer el principio y saltear el anclaje es el modo de falla de este archivo: el
> principio se intuye a medias, pero que las contrapartes van a `public.proveedores` **no lo
> deduce nadie**.

---

### 📍 ESPECÍFICA DE ESTE PROYECTO — **una sola**
*Todo el resto es común a todos los proyectos del usuario. Ésta es la única que NO se promueve.*

### 🎚️ Default del dato real, siempre editable (REGLA)
*Enunciada por el usuario 2026-08-18, **"para todo por lo general"** — no es de una feature.*

> **Todo campo toma por default el dato real si existe, y se puede escribir a mano si no existe o
> no se quiere usar.** Campo vacío = "usá el real". Campo lleno = "acá mando yo".

- El valor puesto a mano es un **override (delta)**, **nunca una copia** de la fila. Copiar congela
  el vínculo con el dato real: lo que no pisaste tiene que **mejorar solo** cuando mejora el origen.
- Dejar el campo previsto **desde el día 1** aunque arranque vacío (ej.: la cuenta contable de un
  costo que hoy se escribe a mano). Agregarlo después cuesta el doble.
- Mostrar de dónde viene el valor cuando es automático, para que se note al pisarlo.

**Motivo** (palabras del usuario): *"nos deja el diseño futuro desde hoy usando la data existente
esté como esté"*. Sólo-manual duplica un dato que ya existe y los números dejan de coincidir;
sólo-automático te traba cuando el dato falta o cuando querés probar otra cosa. Caso testigo:
los escenarios de margen → [A-FEAT-25](PENDIENTES.md#a-feat-25).

---

### 🌐 PROTOCOLARES — comunes a TODOS los proyectos
*Viven también en el `CLAUDE_BASE.md` del usuario, fuera de este repo. Obligan igual que la de
arriba.*

> 🔗 **Algunas llevan un ANCLAJE de este proyecto** — el principio es portable, pero acá se
> instancia con nombres propios (`public.proveedores`, `cuentas_contables`, es-AR, Vercel).
> Está marcado con **`📍 Acá:`** dentro de cada regla. **Al pasar la regla al maestro se lleva el
> principio y se deja el anclaje**; al leerla acá, el anclaje es tan obligatorio como el principio.

### 👥 Contrapartes — toda importación debe registrarlas (REGLA)
> **Principio (portable):** si entra un comprobante, su contraparte tiene que quedar en el maestro
> de contrapartes. **Upsert, nunca sólo `UPDATE`.**
> **📍 Acá:** el maestro es **`public.proveedores`**, con los flags `es_cliente` / `es_proveedor`.

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
> **Principio (portable):** una categoría no se usa si no existe antes en su maestro, con su
> clasificación cargada. Si falta, el sistema asume un default y el número queda mal **sin avisar**.
> **📍 Acá:** el maestro es **`public.cuentas_contables`** y la clasificación es la columna `tipo`.
> Ésta es la regla con **más contenido propio de este dominio**: al pasarla al maestro queda casi
> sólo el principio.

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

### 💰 Convención Inputs Monetarios (es-AR) — OBLIGATORIO
> **Principio (portable):** los montos se ingresan **como texto** en el formato local, nunca con
> `type="number"`, y se parsean al guardar.
> **📍 Acá:** el formato local es **es-AR** (coma decimal, punto de miles).

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

### 🔧 Git
> **Principio (portable):** nunca commitear a la rama de producción. Se trabaja en una rama y el
> merge lo autoriza el usuario **después** de confirmar el testing.
> **📍 Acá:** la rama de trabajo es **`desarrollo`** y la de producción **`main`**, con auto-deploy
> de Vercel (por eso mergear = publicar).

- **Pushear SIEMPRE a `desarrollo`** (nunca commitear directo a `main`). `main` = auto-deploy Vercel.
- Merge `desarrollo → main` solo cuando el usuario confirme testing OK.

### 🔀 Trabajo en paralelo — 2 terminales sobre el mismo directorio (REGLA)
*Agregada 2026-08-18, al abrir una segunda terminal (conciliación + panel de pendientes a la vez).
Acordada **entre las dos terminales**, y escrita acá —y no en el tablero— porque `.claude/` no va al
repo: reglas permanentes en un archivo descartable es exactamente lo que no hay que hacer.*

> ⏭️ **Con UNA sola terminal abierta, saltear esta sección entera.** Aplica sólo cuando hay 2 o más
> sobre el mismo directorio.

> **Principio (portable):** cuando hay más de una terminal abierta sobre el mismo working tree **no
> hay aislamiento de ningún tipo** — mismo árbol de archivos, mismo índice de git, misma BD. Git no
> protege nada: protege entre *commits*, y las dos terminales viven en el **mismo commit**. El único
> mecanismo de protección es un **tablero declarado** que las dos leen y escriben.
> **📍 Acá:** el tablero es **`.claude/SESION-PARALELA.md`** (gitignoreado; no es dimensión, es
> operativo — mismo estatus que `memory/`). Ahí va **sólo el estado vivo**: quién tiene qué, qué va a
> necesitar y qué quedó a medias. **Las reglas son éstas y no se duplican allá.**

**Las 12 reglas.** Cada una con su motivo, porque el motivo es lo que hace que se respete a las 3 de
la tarde del tercer día.

**1 · Tomar antes de escribir.** Antes de editar un archivo, anotarlo en el tablero. Si ya está
tomado por la otra terminal, **no se toca**: se avisa al usuario y se espera, o se hace otra cosa.
*Motivo: dos ediciones al mismo archivo no dan conflicto —no hay merge—, dan **pérdida silenciosa**.
La última escritura gana y la anterior desaparece sin que nadie se entere.*

**2 · `git add` explícito, archivo por archivo.** Prohibidos `git add -A` / `git add .` /
`commit -a`, y **todo** `checkout` / `stash` / `reset`.
*Motivo: `git add -A` se lleva los archivos a medio hacer de la otra terminal a un commit que no es
suyo; `checkout`/`stash`/`reset` directamente los borra. El working tree es uno: lo que una descarta,
lo pierde la otra.*

**3 · Recursos exclusivos — de a uno y avisando**: `npm run dev` (un solo puerto), `build` /
`type-check` (escriben `.next/` y `tsconfig.tsbuildinfo`), `git commit` (el índice es uno solo),
y **MCP en write / cambios de BD** (además, con el usuario presente — § Datos).
*Motivo: dos builds simultáneos se corrompen entre sí y el error no dice por qué.*

**4 · Archivos compartidos de alto tráfico** (`PENDIENTES.md`, éste, `MEMORY.md`, `MANUAL-USO.md`,
`KNOWLEDGE.md`): los toca cualquier trabajo, así que no se pueden tomar para toda la sesión.
**`Edit` puntual, nunca `Write` del archivo entero**; una terminal por vez; agregar **sin reordenar
ni reformatear** lo que ya está, aunque quede mejor.
**Y el que edita commitea enseguida**, en un commit propio y chico: no se acumulan cambios en el
working tree "para después". Si al hacer `git diff` aparece trabajo ajeno, **no se intenta
separarlo** — se commitea junto y el mensaje lo dice (*"incluye N marcas de la otra terminal"*).
*Motivo: un `Write` completo se lleva puesto lo que la otra agregó hace dos minutos. Y lo otro pasó
dos veces en una hora: 75 marcas `@pantalla` viajaron dentro de un commit sobre sueldos. Nada se
perdió, pero el historial miente sobre la autoría. Se intentó separar los cambios con un patch
selectivo y **no funcionó**: entre mirar el diff y commitear hay una ventana en la que la otra
escribe. Un historial honesto vale más que uno prolijo pero inexacto.*

**5 · No cambiar el formato de un archivo que la otra terminal está parseando.** Se puede agregar
contenido; no cambiar la estructura (encabezados, columnas, formato de IDs, anclas). Al agregar, se
copia el formato exacto de una entrada existente.
*Motivo: el parser no falla, **parsea mal** — y eso se descubre tarde y mal. El silencio miente.*

**6 · Nada destructivo sobre lo ajeno.** Ningún borrado, renombre, movimiento ni `--force` sobre
archivos que no estén declarados como propios. Ante la duda, preguntar (§ Datos).

**7 · Al cerrar (o al quedarse sin contexto): liberar y dejar escrito** qué quedó a medias — que es
lo único que git no puede contar. Un archivo tomado y no liberado bloquea a la otra por nada.

**8 · El tablero dice DE QUIÉN es; `git status` dice CÓMO está.** El tablero **no guarda ningún dato
que git ya sepa** (nada de "commiteado"/"sin commitear"). Si aparece un archivo modificado que no
tomé: **parar y avisar** — no revertirlo, no arreglarlo, no commitearlo.
*Motivo: el dato duplicado se pudre en horas. Pasó el primer día: el tablero afirmaba un estado de
git que ya era falso, y una regla apoyada en eso dispara falsas alarmas y tapa las verdaderas.*

**9 · Entre terminales sólo se negocia la CONVIVENCIA.** Se conversa cómo no pisarse y los
compromisos operativos que la otra debe cumplir. **El diseño de lo que cada una construye no se
cruza**: eso va por separado, cada terminal con el usuario.
*Motivo: si cada una opina del desarrollo de la otra, el usuario queda de intermediario entre dos
diseños y no vuelve nunca a su trabajo.*

**10 · Declarar también lo que se VA a tocar, no sólo lo tomado.** Además de la lista de tomados,
cada terminal mantiene un *"voy a necesitar"* con los archivos de la **próxima etapa**, declarado
**antes** de escribir la primera línea.
*Motivo: el resto de las reglas protege el presente; ésta es la única que evita el choque en vez de
administrarlo. Y el choque se ve cuando todavía es barato cambiar el diseño — pasó el primer día: el
contador de pendientes iba a tocar `vista-extracto-bancario.tsx` (ajeno) y se movió a `dashboard.tsx`
(sin dueño) antes de escribir nada. Un choque detectado por revisión es suerte; detectado por
protocolo es diseño.*

**11 · Arrancar y cerrar: el protocolo NO se negocia cada vez.**

**Al ABRIR** una segunda terminal — decirle en el primer mensaje: *"hay otra terminal trabajando;
leé `CLAUDE.md` § Trabajo en paralelo y `.claude/SESION-PARALELA.md`"*. Y después, sólo tres cosas:
1. **Declarar** en el tablero lo tomado y el *"voy a necesitar"* (reglas 1 y 10).
2. **Leer** lo que declaró la otra.
3. **Empezar.**

⚠️ **No se re-discuten las 12 reglas.** Ya están acordadas y con sus motivos: discutirlas de nuevo
cuesta media hora y termina en lo mismo. Lo único que se conversa es **lo específico de esta
sesión** — qué toma cada una y dónde se cruzan. Si aparece un hueco real del protocolo, se propone
al final, no al principio.

**Al CERRAR la doble sesión — lo aprendido SUBE, el tablero se VACÍA:**

| Qué | A dónde | Por qué |
|---|---|---|
| Lo aprendido sobre **convivencia** (huecos, reglas nuevas, correcciones) | **acá**, a esta § | `.claude/` está gitignoreado: lo que quede ahí **se pierde en el primer clone** |
| Lo que quedó **a medias del trabajo** | `PENDIENTES.md`, con su ID | es trabajo, no protocolo |
| El **estado vivo** (quién tenía qué) | se borra | ya no le sirve a nadie |
| Las conversaciones **T1 ↔ T2** | se borran | eran para acordar, no para archivar |

*Motivo: el tablero es descartable **por diseño** — y ahí está el riesgo. Esta § existe porque las
reglas nacieron en el tablero y casi se pierden: hubo que mudarlas. Si el aprendizaje de cada sesión
se queda en `.claude/`, la próxima empieza de cero y se vuelve a negociar todo. **Que la próxima sea
corta depende de que ésta suba lo que aprendió.***

**12 · El espacio de IDs de `PENDIENTES.md` es un recurso compartido: se mira ANTES, no después.**
*(Regla nacida de un choque real, 2026-08-27.)* Antes de escribir un ID nuevo se busca el máximo **en
el archivo**, que es la única fuente:

```bash
for f in P A-FEAT A-BUG A-TEST A-DAT A-DEC; do
  echo -n "$f → último: "
  grep -oE "\b$f-[0-9]+\b" PENDIENTES.md | grep -oE "[0-9]+$" | sort -n | tail -1
done
```

⚠️ **`sort -n` sobre el número pelado, no `sort` a secas.** Ordenado como texto, `A-BUG-51` "gana" a
`A-BUG-62` y devuelve un máximo falso — pasó, y por eso el choque llegó a estar en 4 archivos y un
commit pusheado antes de saltar.

⚠️⚠️ **Pero mirar antes NO alcanza — hay que RECLAMAR el ID escribiéndolo.**
*(Corrección aportada por T3 el mismo día, después de que el choque se repitiera **en el otro
sentido** con las dos terminales mirando bien.)*

> **Pedir el número → escribir la fila y commitear → recién entonces hacer el trabajo.**

Lo que falla no es la calidad de la consulta: es **la distancia entre tener el número y publicarlo**.
Las dos terminales consultaron correctamente y chocaron igual, porque las dos pidieron el número,
trabajaron una hora, y escribieron la fila cuando el número ya era de otra. Un comando que devuelva
el próximo libre **tampoco cierra la ventana**: dos terminales que lo corren con diez segundos de
diferencia reciben el mismo número, porque ninguna escribió todavía.

Es la **regla 4 aplicada al espacio de IDs** —*el que edita commitea enseguida*—, y cuesta verlo
porque un ID no parece un archivo compartido. Mismo mecanismo: **lo que no está publicado, no está
tomado.**

**Y si el choque igual ocurre: renumera el que llegó ÚLTIMO**, nunca el que ya estaba. Se cambian
también sus referencias cruzadas (el dossier, el manual, los comentarios del código), y se deja
intacto todo lo del otro.

*Motivo: es el único recurso compartido que **no es un archivo** — dos terminales pueden inventar el
mismo ID sin tocar la misma línea, así que ninguna de las 11 reglas anteriores lo cubre. El control
`verificar-parser-pendientes.mts` lo detecta, pero **detecta después**: para cuando avisa, el ID ya se
propagó. Pasó **dos veces en un día, en los dos sentidos**, y la segunda con las dos terminales
haciendo bien la consulta — por eso la regla no puede terminar en "fijate antes".*

### 🧭 REGLA DE CONTEXTO — nunca se parte de cero (OBLIGATORIO)
El contexto varía: a veces venimos hace rato, a veces se cerró la terminal, a veces hay que
enganchar algo nuevo con algo hecho hace meses. **Cuanto menos contexto haya, más se aplica.**

1. **Asumir que el tema YA existe.** Ante cualquier pedido, dar por sentado que hay código hecho,
   una decisión tomada o al menos una intención registrada. **Buscarla.** Recién si no aparece
   nada, es nuevo de verdad.
   - ⚠️ **Antes de preguntarle algo al usuario, buscarlo primero.** Si la respuesta está en el
     repo, la pregunta es pereza. *(Regla agregada 2026-08-02 a pedido del usuario, después de
     que Claude preguntara qué eran los "períodos de templates" teniendo el generador de campañas
     y la columna `año` en el repo.)*
   - Y al buscar, **buscar bien**: buscar `campana` no encuentra `campaña`, y grepear un solo
     archivo no es haber buscado. Si la evidencia es floja, decirlo — no afirmar que algo no existe.
2. **Primero las dimensiones, después el código**: `MODULO_<X>.md` (cómo está pensado) →
   `PENDIENTES.md` (qué se pensó hacer y por qué) → `MANUAL-USO.md` (cómo se usa hoy) →
   `ARQUITECTURA-BD.md` (dónde vive el dato) → `KNOWLEDGE.md` (qué ya se descartó).
3. **La documentación manda sobre la memoria** (ver § Documentación, dirección única).
4. **Todo cuelga del norte** (§ 🧭): lo nuevo se diseña para servir al presupuesto autoalimentado
   y para encajar con lo que existe, nunca como isla.
5. **Si lo pedido choca con lo documentado, avisar ANTES de romperlo.** Puede ser un cambio de
   rumbo (se decide y se documenta con fecha y motivo) o un olvido (se respeta lo viejo). Lo que
   no se hace es **pisarlo en silencio**.

*Motivo: con 8 dimensiones, 14 módulos y 60+ memorias, el modo de falla real es rehacer algo ya
resuelto o contradecir una decisión vieja sin enterarse.*

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

### 🔎 Buscar ANTES de escribir, no sólo antes de preguntar (REGLA)
*Agregada 2026-08-03, después de que Claude duplicara **tres veces en una sola sesión** algo que
ya existía. Las tres las detectó el usuario, no Claude.*

La regla de contexto decía *"antes de preguntarle algo al usuario, buscarlo"*. **Faltaba la otra
mitad, que es la que más cuesta:** antes de **escribir** una tabla, un componente o una función,
buscar si ya existe.

**Antes de crear cualquier pieza, buscar con el mismo empeño que antes de preguntar:**
1. `Grep` por el **concepto**, no por el nombre que uno le pondría. Buscar `campana` no encuentra
   `campaña`; buscar `precio` no encuentra `valuarLote`.
2. Mirar `lib/` **por dominio** (`ganaderia`, `productivo`, `presupuesto`, `pagos`): la lógica de
   negocio vive ahí, no en los componentes.
3. Revisar `ARQUITECTURA-BD.md` y `ESTRUCTURA_BD_COLUMNAS.md` antes de proponer una tabla.
4. Y si aparece algo parecido: **leerlo entero antes de decidir que no sirve.**

**Los tres casos, para que se entienda el costo:**
| Lo que escribí | Lo que ya existía | Qué tenía de más lo existente |
|---|---|---|
| `presupuesto_variables` | `productivo.actividad_insumos` | 9 modos de escalado, ración, stock, y ya en uso |
| un `<select>` con 120 cuentas | `SelectorCuentaContable` | buscador, jerarquía, historial por proveedor |
| `buscarPrecio()` por rango | `categoriaPrecio()` + `resolverPrecioHacienda()` | hembras sin banda, salto a invernada >320 kg, arrastre de precio, peso desde `fecha_peso` |

**El costo real no es el trabajo duplicado: son los números que no coinciden.** La función de
precios existente dice en su comentario *"es la que usan tanto Productivo como Presupuesto, para
que den lo mismo"*. Mi versión paralela habría hecho que la misma venta valiera distinto en dos
pantallas — y eso se descubre tarde y mal.

**Señal de alarma:** si al escribir algo aparece el pensamiento *"esto seguro ya está resuelto en
algún lado"* — **ese es el momento de buscar**, no de seguir escribiendo.

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

### 🧮 Todo desarrollo termina con su CONTROL, y el control se ve (REGLA)
*Enunciada por el usuario 2026-08-18. Universal.*

> **Nada se da por terminado sin un control que verifique el resultado — y ese control se muestra
> al usuario, no vive sólo en el código.**

- **En una app de datos el control es objetivo**: existe una identidad que tiene que cerrar. No es
  opinión ni "me parece que está bien". *(En otro dominio —una app de música— el control será otro,
  pero alguno hay.)*
- **Cuanto más condensado es el número, más control necesita.** Un total, un margen, un saldo: el
  número de conclusión es el que **nadie puede verificar a ojo** y el que más caro sale si está mal.
- **El mejor control es el camino inverso.** Recalcular al revés y comparar. Ej.: el presupuesto se
  arma del pasado ± costos variables → **de atrás para adelante tiene que dar lo mismo**.
- **Visible y proporcional**: si cierra, un ✓ discreto; si no, una alerta grande. Un control que
  nadie ve no es un control.
- **Tolerancia explícita** cuando el dominio la tiene (los emisores redondean), y **listando los
  casos que la causan**: el número global avisa que algo pasa, **la lista es la que deja arreglarlo**.
- ⚠️ **Nada se descarta en silencio.** Si algo no se pudo verificar, se muestra que no se pudo.

**Motivo — los tres casos que la originaron, todos del mismo día:**
`Total − Neto − Exento − IVA − Otros Trib. − sin crédito = 0` destapó $0,01 de redondeo repartido en
4 facturas de ARCA (§ A-TEST-27). Un cartel que mostraba `78.262.800 − 31.305.120 = 40.306.014`
—donde la resta **no cierra** porque faltaba el renglón de retenciones— hizo que el usuario
desconfiara con razón (§ A-TEST-32). Y el Cash Flow proyectaba **$181 M por un cobro de $78 M** sin
que nada lo señalara (§ A-BUG-27).

### 🧪 Una feature nueva se registra en DOS lados (REGLA)
*Propuesta del usuario 2026-08-03: "cuando yo quiera probar la función, primero está en pendientes
como sin test; segundo, como test está en manual de uso".*

Al terminar de implementar algo, **antes de decir que está hecho**:

1. **`PENDIENTES.md`** → fila `TEST` con su ID y estado **sin testear**. Es el *qué falta probar*.
2. **`MANUAL-USO.md`** → sección con **cómo se usa y cómo se prueba**, con el título marcado
   **🟡 (sin testear)**. Es el *cómo se prueba*.

Cuando el usuario confirma el test: ✅ en `PENDIENTES` y se saca el 🟡 del manual.

**Motivo:** hasta ahora la lista de test vivía en el chat. Un ítem que dice *"probar la muestra del
cálculo"* no sirve tres días después, porque el usuario ya no se acuerda de dónde estaba ni qué
tenía que ver. El manual convierte el pendiente en algo ejecutable **sin volver a preguntar**.

Y tiene un efecto lateral que vale por sí solo: **obliga a escribir cómo se usa lo que se acaba de
hacer**, que es cuando todavía está fresco. Si no se puede explicar en el manual, probablemente la
pantalla no esté clara.

---

### 📦 Para CLAUDE_BASE — la cola de candidatas a promover
`CLAUDE_BASE.md` es la plantilla portable del usuario y **vive fuera de este repo**. Cuando
aparece algo que no es propio de este proyecto sino que serviría para arrancar cualquiera, **se
anota acá** y el usuario lo pasa a su plantilla. Si no, se pierde.

**Cómo se decide, ante la duda** *(criterio fijado 2026-08-18)*: **una regla dudosa se queda en
ESPECÍFICA** y se anota acá como candidata. El riesgo es asimétrico — una regla que queda local
se promueve después gratis; una promovida por error **se mete en todos los proyectos y nadie se
entera**. Promover es decisión del usuario, siempre.

**Al promover una regla con anclaje**: se lleva el **principio** y se deja acá el `📍 Acá:`. El
maestro no debe tener nombres de tabla de este proyecto.

**Pendientes de pasar** *(las que no tienen anclaje van tal cual; éstas hay que separarlas primero)*:
- **🧮 Todo desarrollo termina con su control** (2026-08-18) — universal y sin anclaje: va tal cual.
  Es la que más rinde en cualquier proyecto con números.
- **👥 Contrapartes** → principio: *toda importación registra su contraparte en el maestro; upsert,
  nunca sólo `UPDATE`, porque un UPDATE que no matchea **no falla** y el hueco queda invisible*.
- **🏷️ Categoría en su maestro** → principio: *una categoría no se usa si no existe antes, con su
  clasificación cargada; si falta, el sistema asume un default y el número queda mal sin avisar*.
- **💰 Inputs monetarios** → principio: *montos como texto en el formato local, nunca `type="number"`*.
- **🔧 Git** → principio: *nunca commitear a producción; el merge lo autoriza el usuario después
  del testing*.
- **🔀 Trabajo en paralelo con 2 terminales** (2026-08-18) — la **§ de arriba va tal cual**: las 12
  reglas con sus motivos son portables y no tienen un solo nombre propio de este proyecto (el único
  anclaje es la ruta del tablero, y va en el `📍 Acá:`). Principio: *con 2 terminales sobre el mismo
  working tree no hay aislamiento y git no protege nada — la única protección es un tablero declarado
  que ambas leen y escriben*. Evita el modo de falla peor: la **pérdida silenciosa** (dos ediciones
  al mismo archivo no dan conflicto, gana la última).
  ⚠️ Al promover: **las reglas viajan con sus motivos**. Se probó tenerlas resumidas en un lado y
  completas en otro y duró horas — el lado resumido no alcanza para decidir nada.
- **📝 Notas del usuario desde la app** (2026-08-02) — un botón fijo para dejar notas *en el
  contexto donde se le ocurren*. Lo valioso no es la nota: es el contexto que se captura solo
  (pantalla, componente, registro abierto, filtros). Una nota es una **grabación de N capturas**
  con Finalizar, no un evento — eso convierte *"no anda"* en un caso reproducible.
  **Regla:** la nota **no es un pendiente**, es bandeja de entrada; al leerla termina como ítem con
  ID en `PENDIENTES.md` o descartada con motivo. Y al abrir sesión, si hay notas sin leer, las
  menciona Claude. *Conviene desde el día 1: cuanto antes existe, menos contexto se pierde.*
  → dossier en `PENDIENTES.md` § P-34.
- **🧪 Una feature nueva se registra en dos lados** (2026-08-03) — pendiente `TEST` + sección de
  manual con cómo probarla. Ver la § de arriba. Portable a cualquier proyecto: convierte una lista
  de test inservible a los tres días en algo ejecutable sin volver a preguntar.
- **🔎 Buscar antes de escribir, no sólo antes de preguntar** (2026-08-03) — la mitad que falta de
  la regla de contexto, y la que más cuesta. Ver la § de arriba. Portable: en cualquier proyecto
  con algo de historia, el costo de duplicar no es el trabajo repetido sino **los números que no
  coinciden entre dos pantallas**.

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
- **Empresas / CUITs:** MSA `30617786016` (MARTINEZ SOBRADO AGRO SRL) · PAM `20044390222`
  (SUCESION DE PLACIDO ALBERTO MARTINEZ) · MA `27066824611` (MERCEDES ARECO).
  Para encabezados de reportes salen de `DATOS_FISCALES` en `lib/empresas.ts` — **nunca
  hardcodear**: el Libro IVA de PAM y MA salía con la razón social y el CUIT de MSA impresos.
- **MA y PAM NO están inscriptas en IVA** y facturan sólo arrendamiento (Fac C): su "Libro IVA
  Ventas" es en realidad un registro de ventas. Ver `PENDIENTES.md` § A-DEC-02.
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
