# 🤝 ENTRE DESARROLLADORES — JMS ↔ Javier

> **Qué es esto:** el único canal que **viaja por git** entre los dos clones. El tablero
> `.claude/SESION-PARALELA.md` sirve entre terminales de una misma máquina y **está fuera de git**:
> lo que se escribe ahí **no le llega al otro**.
>
> 🔑 **Es un BUZÓN, no una bitácora.** Una entrada se escribe para que el otro haga algo o sepa
> algo; **cuando la leyó y actuó, se borra**. Lo que tenga valor permanente **se absorbe a su
> dimensión** (`PENDIENTES.md`, `CLAUDE.md`, el módulo que corresponda) y acá no queda.
>
> ⚠️ **Motivo de que se borre:** un archivo que sólo crece no se lee, y un canal que no se lee es
> peor que no tener canal — genera la ilusión de haber avisado.

---

## ✅ QUÉ VA ACÁ

| | Ejemplo |
|---|---|
| **Toqué algo tuyo** | renumeré IDs que usás · edité un archivo de tu módulo |
| **Cambié estructura, RLS, rol o permiso** | la BD es **una sola**: esto se avisa **ANTES** de aplicarlo |
| **Encontré un problema en lo tuyo** | con el dato medido, no la sospecha |
| **Acuerdos** | el reparto del espacio de IDs, quién toma qué módulo |
| **Voy a trabajar sobre tu territorio** | así te enterás antes y no después del merge |

## 🚫 QUÉ NO VA

- **El reporte de todo lo que uno hace.** Para eso están los commits y `PENDIENTES.md`. Si esto se
  vuelve un diario, deja de leerse.
- **Pendientes.** Van a `PENDIENTES.md` con su ID. Acá se los **apunta**, no se los copia.
- **Reglas permanentes.** Van a `CLAUDE.md`.

---

## 📌 ACUERDOS VIGENTES — esto NO se borra

*(vacío por ahora — el reparto de IDs entra cuando Javier lo confirme, ver abajo)*

---

## 📨 PARA JAVIER

### 🗃️ Columnas nuevas en la BD (2026-09-30) — aviso, no hay nada que hacer

**La BD es una sola, así que te aviso aunque no te toque nada.** Se agregaron columnas **nullable**, sin
tocar un solo dato existente y sin RLS nueva:

| Tabla | Columna | Para qué |
|---|---|---|
| `sueldos.periodos` | `cuota_alimentaria` | la parte de `monto_a` que va a un tercero (A-FEAT-1213) |

✅ **Por qué no te afecta**: es `add column if not exists`, nullable, sin default y sin constraint. Lo
que ya existía sigue igual y ninguna consulta tuya cambia de resultado. **Reversible** con
`alter table sueldos.periodos drop column cuota_alimentaria`.

📌 Borrá esta entrada cuando la leas.


### 🚨 Un hueco en el modelo de permisos — el default está al revés (2026-09-28)

**Es tuyo, por eso no lo tocamos.** Lo encontramos auditando para un informe de seguridad.

**Qué pasa**: `public.nivel_tabla(schema, tabla)` busca la tabla en `recurso_tablas` y, **cuando no
la encuentra**, devuelve `'escritura'` con sólo tener un rol. Como `puede_escribir` es
`nivel = 'escritura'`, **toda tabla no registrada queda escribible por cualquier usuario con
sesión y rol**.

**Medido el 28/09**: **125 tablas, 57 registradas → 68 sin registrar.** Entre ellas `msa.cheques`.
Y `puede_ver` tampoco distingue rol salvo en las marcadas `restringe_lectura`, que hoy **son cero**.

**Lo que proponemos, en este orden** (el orden importa):
1. registrar las 68 — es clasificación, no cambia comportamiento;
2. **recién entonces** dar vuelta el `coalesce` a `'ninguno'`;
3. marcar `restringe_lectura` en sueldos, cheques y proveedores.

Si se hace (2) antes que (1), **se cae media app**.

**No cambiamos nada.** Queda como `A-SEC-14` (antes `A-SEC-09`, que chocaba con el tuyo) en `PENDIENTES.md`, con el detalle y los números.
Decinos si lo tomás vos o si querés que lo hagamos nosotros con tu revisión.

*(Borrar esta entrada cuando la leas.)*

---

### ✅ Lo que el login cerró, verificado contra la base (2026-09-26)

Para que lo tengas: medimos el resultado de tu trabajo y **cerró tres cosas que estaban abiertas** —
`anon` sin ningún permiso, RLS en las 125 tablas, y las policies leyendo el rol de `app_metadata`
(que el usuario no puede escribir). Las fichas de `PENDIENTES.md` decían que la base *«no se había
tocado»*: **estaban desactualizadas** y ya las corregimos.

*(Informativo, borrala cuando quieras.)*


### 🗄️ Cambio de ESTRUCTURA en `config_parseo_extracto` — 2026-09-25

**Qué**: ampliar el `CHECK` de la columna `tipo_regla` con dos valores más: **`cbu`** y
**`tarjeta`**. El SQL está en `scripts/61-tipo-regla-permitir-cbu-y-tarjeta.sql`.

**Por qué**: el motor de parseo implementa siete modos y la pantalla los ofrece los siete, pero el
`CHECK` sólo acepta cinco — se escribió antes de que existieran esos dos y nunca se amplió. Hoy,
elegir «Busca el CBU» y guardar devuelve `violates check constraint`.

**Impacto para vos**: ninguno que se vea. Es **aditivo** — no toca filas, no invalida reglas
existentes, y se revierte volviendo a la lista de cinco. La tabla es del módulo de extractos, no
del de seguridad.

**Estado**: ✅ **aplicado el 2026-09-25**, autorizado por JMS. Verificado leyendo el `CHECK` de
vuelta: acepta los 7 modos. Se avisó acá **antes** de aplicarlo, como pide `CLAUDE.md` § 👥 — la
base es una sola para local, previews y producción.

*(Borrar esta entrada cuando la leas.)*


### 2026-09-24 · Tu regla de A-SEC-10 merece estar en `CLAUDE.md` — ¿la subís?

Leí el commit de la **rotura en vivo** de `puede_ver`. **Verifiqué en la base y ya está**:
la función tiene `SECURITY DEFINER`, así que el arreglo está aplicado.

Lo que te propongo subir no es el fix: es **la regla que dejaste escrita en el mensaje**.

> *«Una policy de RLS sólo se prueba con una sesión de usuario. `anon` y `service_role` dan una
> falsa sensación de cobertura.»*

Y sobre todo el diagnóstico que la acompaña, que es lo que la hace obligar:

> *«`scripts/63` se verificó con `anon` (401 ✅) y con `service_role` (200 ✅), y **ninguno de los
> dos pasa por esa policy**. Se probaron los dos caminos que no podían fallar y no el único que
> importaba.»*

**Por qué creo que va a `CLAUDE.md` y no sólo a tu módulo**: hoy vive en un mensaje de commit, y ahí
**no obliga a nadie**. Es exactamente lo que nos pasó con *«una rama por tema»*, que estuvo decidida
cinco días en un lugar que no era su dimensión y por eso no se cumplió — *«una decisión que no está
en su dimensión no es una regla, es un recuerdo»* (§ 🌿).

**Y no es sólo tuya, nos pasó lo mismo del otro lado el mismo día**: nuestro baseline de
`type-check` decía **110** y era un número **recortado** — un archivo generado truncado cortaba el
chequeo antes de analizar el resto, y el real es **279** ([A-OP-15](PENDIENTES.md#a-op-15)). Mismo
mecanismo que el tuyo: **un control mirado por encima da confianza sin respaldo**, y eso es peor que
no tenerlo.

📌 **La escribís vos** — es tuya y el caso es tuyo. Si preferís, la redacto y la revisás.
🎯 Y hay un lugar natural: junto a la § 🧮 *Todo desarrollo termina con su control*, como la
precisión de **con qué identidad se prueba un control de permisos**.

---

### 2026-09-24 · Dos apuntes cortos

- **Tus 5 ramas están intactas.** Borré tres mías ya mergeadas (`renumerar-ids`,
  `roles-desde-la-base`, `sicore-minimo-mensual`) y ninguna tuya. Criterio de siempre: las ajenas no
  se tocan.
- **`desarrollo` está al día** con todo lo mío y con tus 4 commits. 220 casos en verde.



### 2026-09-24 · Gracias por renumerar — y volvió a pasar, que es el argumento del reparto

**Vi tu commit** *«Renumero MIS 4 IDs chocados: los míos llegaron últimos»*. 👍

**Pero al mergear, dos de los números que tomaste ya estaban usados de mi lado**: `A-BUG-198` y
`A-TEST-144` (los roles). **No es error tuyo**: mi trabajo estaba en una rama sin mergear, así que
consultaste el archivo que tenías. **Lo mismo me pasó a mí**, con dos ramas mías.

✅ **Ya está resuelto y no te toca nada**: moví **los míos** a `A-BUG-1198` y `A-TEST-1144`. Los
tuyos (el QR del 2FA) quedaron intactos.

🎯 **Y esto es exactamente lo que el reparto de rangos evita** — no es prolijidad, es que **dos
personas no pueden coordinar consultando un archivo que cada uno tiene en una versión distinta**.
La propuesta sigue abajo y ahora tiene una segunda evidencia en un solo día.



### 2026-09-23 · Te renumeré 33 IDs que chocaban, y borré una fila tuya

**Qué pasó:** al mergear `jms/dia-a-dia` → `desarrollo` aparecieron **38 IDs usados por los dos**
para cosas distintas. El control nunca los había visto porque **cada uno los escribía en su clon**:
git no ve un choque de IDs, sólo de líneas.

**Qué hice, y por qué te toca poco:**

- **33 eran choques reales** → **moví los MÍOS**, no los tuyos: `A-FEAT-74..88` → `1074..1088`,
  `A-TEST-81..97` → `1081..1097`, `A-BUG-98` → `1098`. **Tus IDs quedaron intactos.**
  Lo hice al revés de lo que dice la regla 12 (*renumera el último*) a propósito: mover lo mío no
  toca nada tuyo, y mover lo tuyo te cambia documentación, commits y lo que tengas sin pushear.
- **5 no eran choque: era el mismo pendiente escrito dos veces.** En `A-SEC-01`, `A-SEC-03` y
  `A-SEC-04` mi fila era sólo un puntero (*«👤 Javier · …»*) a tu dossier: borré el puntero y quedó
  el tuyo.
- 🔴 **Y una sí te la borré: `A-FEAT-72`** (cinta de diagnóstico en las notas). Estaba en las dos
  ramas: **la tuya figuraba pendiente y la mía HECHA y TESTEADA el 02/09**. Dejé la mía.
  **Si tenías algo en curso sobre eso, avisá y lo revisamos.**

**Qué necesito de vos:** nada, salvo que mires ese último punto.

### 2026-09-23 · Propuesta: repartir el espacio de IDs, para que esto no vuelva

Limpiar los 38 no arregla la causa: **los dos seguimos sacando números del mismo pozo**, y el choque
no se ve hasta el merge — esta vez tardó **tres semanas** en salir.

**Propuesta, elegida para que vos no tengas que renumerar nada:**

| | Rango |
|---|---|
| **Javier** | **500 a 999** *(hoy vas por ~98: te sobra para años)* |
| **JMS** | **1000 en adelante** *(los 33 renumerados ya caen ahí)* |
| Lo viejo de los dos, por debajo de 500 | queda donde está |

Se evaluaron prefijos (`Jav-BUG-12`) y numeración negativa: el prefijo rompe el parser del panel y
las ~800 referencias `[A-TEST-90](#a-test-90)` ya escritas; los negativos ordenan mal.

**Qué necesito de vos:** un sí o un no. Si va, lo escribimos en `CLAUDE.md` § regla 12 — un reparto
que vive en una conversación no obliga a nadie. → [A-OP-17](PENDIENTES.md#a-op-17)

### 2026-09-24 · Voy a tocar `app/api/admin/usuarios/route.ts` (tu módulo)

**El problema, medido:** la tabla `public.roles` ya tiene **4 roles** (`admin`, `contable`,
`productivo`, `socio`), pero el alta de usuarios valida contra una lista fija:

```ts
const ROLES = ["admin", "contable"] as const
```

Entonces **`productivo` y `socio` existen en la base y no se le pueden asignar a nadie**. La pantalla
de Configuración → Roles los muestra y los deja editar, pero el usuario nunca los puede recibir.

**Qué voy a hacer:** que esa validación **lea los roles de la tabla** en vez de la lista fija. Nada
más de tu módulo. Va en la rama `jms/roles-desde-la-base`.

**Qué necesito de vos:** si ya lo estás haciendo, decímelo y lo dejo.

---

## 📨 PARA JMS

*(vacío)*

## 🔐 Para Javier — el hardening dejó afuera un consumidor EXTERNO (2026-09-28)

**No hay que deshacer nada.** Es un aviso: hay un consumidor de la base que no es la app y que
quedó sin acceso, y conviene que lo sepas porque el patrón se puede repetir.

**Qué pasó:** el Apps Script que crea los borradores de *Detalle de pago*
(`gas-mail-detalle/EnviarMailsDetalle.gs`) lee `public.mails_pago` **por REST con la clave anon**.
Desde que `anon` quedó sin permisos, devuelve:

```
Supabase 401 · 42501 · permission denied for table mails_pago
```

**Por qué no lo agarró nada:** el script vive **fuera del repo** (en Apps Script), así que ni el
`type-check` ni los controles lo ven. Y Apps Script responde **HTTP 200 aunque el script reviente**,
con una página de error HTML — así que desde la app parecía que había funcionado. Es literalmente el
caso que `CLAUDE.md` § 👥 describe: *«si él pone RLS a una tabla, la app del otro se rompe al
instante y el type-check sigue en verde»*. Precedente: `A-SEC-04`.

**Qué se hizo de este lado:** la ruta `/api/gas/mails-pago` ahora **verifica contra la cola** y
**extrae el error real** de la página de Apps Script, así que esto ya no pasa desapercibido
(`A-BUG-1217`). La app sigue andando normal: usa `authenticated`, que sí tiene permisos.

**Qué falta, y NO toca la seguridad:** que el Apps Script use la **service role key** en vez de la
anon. Lo hace JMS en el script; **no se re-abre `anon`**.

❓ **Lo único que necesitamos de vos**: si hay **otros consumidores externos** apuntando a la base
con la anon key —otro GAS, un n8n, un script suelto—, decilo, porque están rotos igual y **callados**.
Es el único hueco que el hardening no puede ver solo.
---

## 📨 2026-10-01 · PARA JAVIER — tu `feature/permisos-granulares` se mergeó a `desarrollo` y a `main`

**Por qué, y lo decidió JMS:** Ulises estaba bloqueado. `main` seguía en el 02/08, sin login, y
desde que `anon` se cerró no le andaba nada. JMS probó tu rama con una cuenta de rol `pruebas`
(sólo Egresos) y anduvo como tiene que andar, así que se publicó.

**Lo único que toqué de tu territorio — dos conflictos, y me quedé con TU versión en los dos:**
`app/api/admin/usuarios/route.ts` y `components/panel-usuarios.tsx`. Era **el mismo bug arreglado
dos veces el 24/09**: tu A-BUG-200 y nuestro A-BUG-1198. La nuestra tenía dos cosas que la tuya no;
**no las metí**, te las dejo para que decidas:
1. un **respaldo** si no se pueden leer los roles (el desplegable ofrecía admin/contable en vez de
   quedar vacío);
2. **«(exige 2FA)»** al lado de cada rol en el desplegable del alta.

**Y un ID:** `A-FEAT-169` estaba repetido. El tuyo (permisos finos) **queda como está**; el nuestro
(desactivar la Vista de Pagos) pasó a `A-FEAT-1169`.

📌 **Queda un tema de seguridad para charlar con vos** — lo vamos a dejar escrito acá aparte, con
JMS. Es sobre las tablas sin mapear y las vistas de `public`.

---

## 📨 2026-10-01 · PARA JAVIER — el default de permisos: una propuesta para que la evalúes

**JMS quiere que esto lo veas vos.** El planteo es suyo: *alguien con un rol, a propósito y sabiendo
cómo, puede ir más allá de lo que su rol permite* — y cada tabla, vista o ruta nueva repite el dilema
de **cerrado por defecto** (si se olvida, da errores) contra **abierto por defecto** (si se olvida,
queda el hueco).

**Medido hoy con la identidad de cada rol, no con admin**: son **tres puertas** con el mismo modo de
falla — 66 tablas sin sección, 13 vistas sin `security_invoker` y 24 rutas con `service_role`.

**La propuesta, acordada con JMS: cerrado por defecto salvo para admin, más un control que avise el
mismo día.** Y cerrar la lectura de sueldos, que medimos que no rompe a nadie.

👉 **Todo el detalle, los números y el orden propuesto: [A-SEC-13](PENDIENTES.md#a-sec-13).**

Hay scripts escritos y **sin correr** en la rama `jms/vistas-seguras`, que cuelga de la tuya. Úsalos o
descartalos: la decisión es tuya.


---

## 📨 2026-10-01 · PARA JAVIER — `feature/permisos-granulares` lleva 26 commits sin mergear, y JMS está tapado por eso

**El síntoma, del lado de JMS:** creó el rol **`pruebas`** (sección *Egresos*), se lo asignó a
`sanmanuel.sp@gmail.com`, entra, y la app le dice **«no tenés roles aún adjudicados»**.

**La causa es tu `A-BUG-200`, y ya la arreglaste** — `4708c9d`, 24/09. El problema es que ese
commit vive **sólo en `feature/permisos-granulares`**: no está en `desarrollo` ni en ninguna rama
de JMS, así que la rama que él corre sigue con `getRole()` validando contra la lista cerrada.

⚠️ **Y lo que lo hace urgente lo escribiste vos en ese mismo commit:** la base ya se mudó
(`scripts/60` y `62` corridos) y `tiene_rol()` sólo pregunta *«¿tenés algún rol?»*. Entonces
`sanmanuel.sp` **sí pasa la RLS y puede leer y escribir las 95 tablas**, mientras la app lo manda a
`/no-access`. Puerta de adelante cerrada, puerta de atrás abierta — y hoy hay una cuenta real así.

❓ **Lo que necesitamos de vos, y es una sola decisión:** ¿mergeás `feature/permisos-granulares` a
`desarrollo`, o preferís que esperemos? **No la tocamos de este lado** — es tu rama, lleva scripts
de BD y uno de los commits se titula *«ROTURA EN VIVO»*, así que el orden lo ponés vos.

📌 Mientras tanto JMS **no puede delegar nada**: cualquier rol que cree queda inservible en la app.
Es justo la *quinta pieza* de `CLAUDE.md` — la automatización que no se puede delegar no libera a
nadie.

→ `PENDIENTES.md` [A-OP-24](PENDIENTES.md#a-op-24)
## 📨 2026-10-01 · PARA JAVIER — 6 columnas nuevas en `msa.comprobantes_venta` (ya corrido, sólo MSA)

Para la liquidación de hacienda ([A-FEAT-1225](PENDIENTES.md#a-feat-1225)) se corrió
**`scripts/68-liquidacion-hacienda.sql`** — **ya corrido el 2026-10-01, con OK de JMS**: agrega `cabezas`,
`hacienda_lineas`, `redondeo`, `nro_guia`, `dte` y `plazos` **sólo a `msa.comprobantes_venta`**. PAM y MA no
venden hacienda, así que sus tablas quedan en 53 columnas y la de MSA en 59, a propósito.

**Por qué no te debería tocar nada:** son columnas que aceptan vacío; no cambian permisos, RLS ni
roles; ninguna vista de `public` está armada sobre esa tabla; y no toca filas existentes. Hay un
**deshacer** escrito antes de correrlo, que se niega a correr si ya hay liquidaciones cargadas.

➕ **Y una más el mismo día, `scripts/69`**: `correcciones jsonb` en `msa.comprobantes_venta` (la huella, como en romaneos y
boletas de ARBA). Mismo perfil: acepta vacío, sólo MSA, sin tocar permisos.

📌 La tabla `msa.comprobantes_venta` sigue entre las **sin sección** de [A-SEC-13](PENDIENTES.md#a-sec-13):
esto no la empeora ni la arregla.

➕ **2026-10-02, `scripts/70`**: `historica boolean not null default false` en **`productivo.stock_ventas`**
([A-FEAT-1226](PENDIENTES.md#a-feat-1226)). ⚠️ **Te aviso después de correrlo, no antes** como pide la regla:
se aplicó en la misma tanda en que JMS lo autorizó. Mismo perfil que las anteriores: default `false`, no
toca filas, permisos, RLS ni roles, y la vista `public.ventas_unificadas` **no se tocó**. Deshacer con freno.

➕ **2026-10-02, `scripts/71`**: el CHECK de **`public.anticipos_proveedores.estado_pago`** admite también
**`endosado`** ([A-FEAT-1228](PENDIENTES.md#a-feat-1228)): el echeq de un cliente que se endosa. ⚠️ **También te
aviso después**, por lo mismo: JMS autorizó la tanda entera antes de irse. Sólo agrega un valor permitido;
no toca filas, permisos, RLS ni vistas. Si en tu rama hay algo que enumere los estados de pago de un
anticipo, sumale `endosado`.

## 📨 2026-10-02 · PARA JAVIER — VOY A CORRER `scripts/73`: una tabla NUEVA con RLS (aviso ANTES)

**`msa.echeqs_terceros`** ([A-FEAT-1230](PENDIENTES.md#a-feat-1230)): el «extracto» de los cheques de clientes
(entra el recibido, sale el endoso). Es una cuenta más del Extracto, **con la misma forma que
`msa.caja_general`** (`like ... including all`) más `anticipo_id` (único) y `comprobante_venta_id`.
- **RLS como las cajas**: `ver_segun_permiso` / `escribir_segun_permiso` con `puede_ver` /
  `puede_escribir('msa','echeqs_terceros')`; `revoke` a `anon`; `grant` a `authenticated` y `service_role`.
- **Registrada en `recurso_tablas`** bajo `extracto` en el mismo script (para no sumar una a A-SEC-14).
- Rama `jms/extracto-echeqs`. Deshacer con freno.

## 📨 2026-10-02 · PARA JAVIER — `desarrollo` se actualizó con todo lo de JMS (tu trabajo, intacto)

Se juntaron en `desarrollo` las dos líneas de JMS: **balance** (export de papeles de trabajo, sueldos,
IPC, cuentas corrientes, chips, filtro débitos/créditos) y **hacienda** (liquidación, cuotas, cobros,
cheques de terceros). Fue fast-forward sobre tu `desarrollo`: **nada tuyo se pisó**. Antes de pullear tu
rama, mirá estos dos puntos:

- **Choque de IDs**: había dos `A-SEC-09` y dos `A-SEC-10`. **Los tuyos (24/09) se quedan**; los
  nuestros (26/09) pasaron a **`A-SEC-14`** (tablas no registradas abiertas a escritura) y **`A-SEC-15`**
  (la clave de ARCA en el navegador).
- **`/api/pendientes/comentarios` y `/propuestos`**: chocaban un arreglo nuestro (clave de servidor) con
  el tuyo (cliente de la sesión). **Quedó el tuyo.**

`main` no se tocó. Tus ramas tampoco. `jms/vistas-seguras` (scripts 66/67) sigue aparte, para que la
evalúes.

## 📨 2026-10-02 · PARA JAVIER — `scripts/72` (avisado ANTES; ✅ corrido el mismo día, después de este aviso)

Cheques de terceros en cartera ([A-FEAT-1229](PENDIENTES.md#a-feat-1229)), en **`public.anticipos_proveedores`**:
- el CHECK de `estado_pago` suma **`en_cartera`** (cheque de un cliente recibido y todavía no usado);
- columna nueva **`endosado_en_id uuid`** → FK a la misma tabla (el pago al proveedor que se canceló
  endosando ese cheque), `on delete set null`.

No toca filas, permisos, RLS ni vistas. Tiene deshacer con freno. Si algo tuyo enumera los estados
de pago de un anticipo o hace `select *` y valida columnas, sumale estos dos.
