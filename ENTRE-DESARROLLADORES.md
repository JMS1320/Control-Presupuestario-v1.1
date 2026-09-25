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

### 🗄️ Cambio de ESTRUCTURA en `config_parseo_extracto` — 2026-09-25

**Qué**: ampliar el `CHECK` de la columna `tipo_regla` con dos valores más: **`cbu`** y
**`tarjeta`**. El SQL está en `scripts/61-tipo-regla-permitir-cbu-y-tarjeta.sql`.

**Por qué**: el motor de parseo implementa siete modos y la pantalla los ofrece los siete, pero el
`CHECK` sólo acepta cinco — se escribió antes de que existieran esos dos y nunca se amplió. Hoy,
elegir «Busca el CBU» y guardar devuelve `violates check constraint`.

**Impacto para vos**: ninguno que se vea. Es **aditivo** — no toca filas, no invalida reglas
existentes, y se revierte volviendo a la lista de cinco. La tabla es del módulo de extractos, no
del de seguridad.

**Estado**: ⏳ **sin aplicar**. Lo corre JMS desde el SQL Editor. Se avisa acá **antes**, como pide
`CLAUDE.md` § 👥 — la base es una sola para local, previews y producción.

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
