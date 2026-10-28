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

### 🔓 Tabla nueva `public.propuestas_cambio` con RLS propia (2026-10-28) — aviso ANTES de aplicarla, con OK de JMS
- `scripts/123-propuestas-cambio.sql` (+ `-deshacer`). A-FEAT-1400 / A-DEC-1023-1024: JMS habilita a una persona (Ulises) sobre UNA factura; ella propone, JMS acepta. Nada se aplica a la factura antes del OK.
- **RLS**: `admin_todo` (app_metadata.role = admin) · `persona_ve_las_suyas` (select, `persona = jwt email`) · `persona_propone` (update sólo si es suya, abierta y no vencida; no puede pasarla a aceptada). `anon` nada. Una sola abierta por registro (índice único parcial).
- **Qué te puede tocar**: lee `auth.jwt() ->> 'email'` y `app_metadata.role`; si cambiás cómo viaja el rol o el mail en el JWT, avisá.

### 📓 Tabla nueva `public.cuadernos` + página `/cuaderno` (2026-10-28) — ✅ APLICADA el 28/10 con OK de JMS (aviso previo): tabla con RLS por usuario, `anon` sin acceso
- `scripts/124-cuadernos.sql` (+ `-deshacer`). A-FEAT-1410: cuaderno de trabajo PERSONAL (texto + tablas). RLS propia: cada usuario ve y escribe sólo los suyos (`usuario_id = auth.uid()`, default `auth.uid()`); `anon` nada. No pasa por `recurso_tablas` (no es un dato de la empresa).
- **Ruta nueva** `/cuaderno` (protegida por el middleware como las demás) y un ítem «Cuaderno» en el menú de usuario (`barra-sesion.tsx`).

### 🔒 Lotes «a confirmar»: 4 columnas en `productivo.lotes_agricolas` + 2 claves del rol `pruebas` (2026-10-28) — ✅ APLICADA el 28/10 con OK de JMS (aviso previo): 4 columnas, los 15 lotes quedaron confirmados, rol `pruebas` con las 2 claves cambiadas
- `scripts/122-lotes-a-confirmar.sql` (+ `-deshacer`). A-FEAT-1408 / A-DEC-1024 (regla de JMS: todo lo que carga alguien que no es él queda pendiente de su OK): `a_confirmar` (default false), `creado_por`, `confirmado_por`, `confirmado_at`. Confirma sólo el admin (como las órdenes).
- **Permisos**: en el rol `pruebas` se saca `productivo.lotes.nuevo` y se agrega `productivo.ordenes.nuevo-lote` (recurso nuevo: crear lote desde la orden). No se toca nada más del rol.

### 🌾 Sub-lotes y los lotes de cada orden agrícola: 1 columna en `productivo.lotes_agricolas` + tabla nueva `productivo.ordenes_agricolas_lotes` (2026-10-28) — ✅ APLICADA el 28/10 con OK de JMS (aviso previo): 1 columna, 1 tabla con RLS, 1 en recurso_tablas, 31 filas (17 órdenes, todas cierran)
- `scripts/121-sublotes-y-lotes-de-orden.sql` (+ `-deshacer`). A-FEAT-1397: `lotes_agricolas.lote_padre_id` (un lote dentro de otro: ER1
  dentro de «Entre Rios 1, 2, 3») y `ordenes_agricolas_lotes` (cada lote de la orden con sus hectáreas; antes la orden guardaba sólo el
  texto «A / B» y el total). Carga las 16 órdenes existentes partiendo el texto; no modifica ninguna orden ni lote.
- **Permisos**: RLS con `puede_ver` / `puede_escribir('productivo','ordenes_agricolas_lotes')`, recurso `productivo` en `recurso_tablas`
  (igual que `ordenes_agricolas`); `authenticated` select/insert/update/delete, `anon` nada.
- **Qué te puede tocar**: nada fuera de Productivo → Órdenes Agrícolas y Lotes Agrícolas.

### 🔁 Tabla nueva `public.subdiario_cambios` + un TRIGGER en compras y ventas de msa/pam/ma (2026-10-27) — ✅ APLICADA el 27/10 con OK de JMS (aviso previo): tabla, 6 triggers, 2 policies, 1 en recurso_tablas, 2 filas
- `scripts/119-subdiario-cambios.sql` (+ `-deshacer`). A-FEAT-1394: cuando cambia un dato **fiscal** (tipo, punto de venta, número,
  CUIT, fecha, importes, tipo de cambio, mes del subdiario) de un comprobante de un mes **«Enviado» o «DDJJ OK»** —o entra a ese mes,
  sale o se borra—, el trigger `registrar_cambio_subdiario` (AFTER INSERT/UPDATE/DELETE, `security definer`) anota un renglón en
  `subdiario_cambios` con el antes y el después y si cambia el IVA. La pantalla de Subdiarios muestra el mes «🔁 a rectificar».
- **Qué te puede tocar**: el trigger corre en cada escritura de `msa|pam|ma.comprobantes_arca` y `…comprobantes_venta`. Sólo inserta si
  cambió un dato fiscal de un mes protegido; un cambio de estado de pago, cuenta o marca DDJJ no hace nada. No cambia ninguna fila de
  esas tablas ni bloquea escrituras.
- **Permisos**: RLS con `puede_ver` / `puede_escribir('public','subdiario_cambios')`, recurso `egresos` en `recurso_tablas`;
  `authenticated` puede leer y actualizar (para marcar «rectificado»); el insert lo hace sólo el trigger.

### 💵 Una columna nueva: `public.cuotas_arrendamiento.en_dolares` (2026-10-27) — ✅ APLICADA el 27/10 con OK de JMS (aviso previo, 1770fc7)
- `scripts/117-cuota-en-dolares.sql` (+ `-deshacer`): `boolean not null default false`. Marca las cuotas de arrendamiento que se cobran en dólares y no se pesifican (A-FEAT-1393): el Cash Flow no las espera en pesos en el banco. Datos: 2 cuotas de Sanpa (26/27 y 27/28, las de 2 qq/ha). Sin cambios de RLS ni de permisos.

### 🧾 Cobro agrupado: tabla nueva `grupos_cobro` en msa/pam/ma + columna `grupo_cobro_id` en `comprobantes_venta` (2026-10-27) — ✅ APLICADA el 27/10 con OK de JMS (aviso previo): 3 tablas con RLS, 3 columnas; y el 115 armó el grupo de Sáenz (datos)
- `scripts/114-grupos-cobro.sql` (+ `-deshacer`): espejo de `grupos_pago` (id, cuit, cliente, monto_total, estado, observaciones, created_at) en los 3 schemas, y en `{msa,pam,ma}.comprobantes_venta` una columna `grupo_cobro_id` (FK a su schema, `on delete set null`). Verificado antes: ninguna de las dos existe. **No cambia ninguna columna existente.**
- RLS igual que `grupos_pago`: `puede_ver`/`puede_escribir` con (schema, `'grupos_cobro'`), nada a `anon`, `authenticated` y `service_role` con select/insert/update/delete. Sin fila en `recurso_tablas` (como `grupos_pago` y `comprobantes_venta`, que tampoco la tienen).
- Para qué: varias ventas de un cliente cobradas en varios movimientos (A-FEAT-167; primer caso Sáenz Valiente, script 115).

### ✍️ Órdenes: estado `a_confirmar` + 5 columnas en `ordenes_aplicacion` y `ordenes_agricolas` (2026-10-27) — ✅ APLICADA el 27/10 con JMS presente (aviso previo): 10 columnas, 2 checks, `explain update` OK

Para [A-FEAT-1223](PENDIENTES.md#a-feat-1223) (la doble firma, decidida por JMS el 27/10: **dos botones**). `scripts/109-ordenes-a-confirmar.sql`:
el check de `estado` suma `'a_confirmar'` y se agregan `marcada_por`, `marcada_at`, `confirmada_por`, `confirmada_at`, `motivo_rechazo`
(nullable, sin tocar filas). Quien tiene «Se hizo» y no «Confirmar» deja la orden `a_confirmar` (no descuenta stock); quien tiene
«Confirmar» la ejecuta. Lo que mira `'ejecutada'` (balance, sementeras) no cambia.
- **8 recursos nuevos** en `lib/auth/recursos.ts` (acciones bajo `productivo.ordenes`: nueva, editar, se-hizo, confirmar, borrar,
  descargar, ganadero, agrícola). Para un rol **no cerrado** el default sigue siendo «todo habilitado» → nada cambia para admin.
- Deshacer: `109-…-deshacer.sql` se frena si hay órdenes `a_confirmar` o con la huella cargada.

📌 Borrá esta entrada cuando la leas.

### 📨 Mail del subdiario al contador: 2 columnas en `public.mails_pago` y una ruta con token (2026-10-27) — ✅ 110 (ex 109) APLICADO el 27/10 con OK de JMS (aviso previo)
- `scripts/110-mails-adjuntos.sql` (+ `-deshacer`; **renumerado de 109**, que es de plan sanitario): `mails_pago.tipo` (text, default 'pago') y `mails_pago.adjuntos` (jsonb). No toca filas ni RLS.
- **Ruta nueva `POST /api/contador/ddjj`**: con sesión (escritura en `egresos.subdiarios`) **o** con el header `x-token-contador` = env **`CONTADOR_TOKEN`** (lo usa el GAS que lee la respuesta del contador; sin sesión). Usa service role para guardar en `ddjj_presentadas`, marcar «DDJJ OK» y crear revisiones (avisos) a los usuarios admin y contable. Si preferís otro mecanismo para que el GAS se autentique, avisá.

### 🗃️ Una columna nueva: `public.polizas_seguro.template_id` (2026-10-27) — ✅ APLICADA el 27/10 con OK de JMS
- FK a `public.egresos_sin_factura(id)`: el template de cada póliza (A-FEAT-1385, script 108). Con ella se crearon 8 templates de seguros (uno por póliza) y se desactivaron los 3 genéricos. Sin cambios de RLS.

### 🗄️ Una tabla nueva: `public.ddjj_presentadas` (2026-10-27) — ✅ APLICADA el 27/10 con OK de JMS (aviso previo)
- `scripts/107-ddjj-presentadas.sql` (+ `-deshacer`): una fila por DDJJ que devuelve el contador (empresa + impuesto + período + secuencia) con totales, comprobantes declarados y el resultado de compararlos con el subdiario. **No toca ninguna tabla existente** salvo 1 fila en `recurso_tablas` (recurso `egresos`).
- RLS `puede_ver`/`puede_escribir`, nada a `anon`, `authenticated` select/insert/update (sin delete). Marca `[script 107]`; el deshacer verifica la marca antes de borrar.

### 🔒 9 permisos nuevos (botones de Facturas y Subdiarios) y el rol `pruebas` cerrado (2026-10-27) — sin cambios de estructura
- **Código**: `lib/auth/recursos.ts` suma 9 recursos tipo `accion` en `egresos` (Importar FC, Reglas Import, Modo Edición, Edición Masiva, SICORE, Pagos; y en Subdiarios: Imputar, Gestionar, Contar/vincular PDFs), envueltos en `<Permisable>` en `vista-facturas-arca.tsx`. En roles **abiertos** no cambia nada (lo que no figura = ve y edita); en roles **cerrados** nacen apagados. Es **sólo la primera barrera** (la pantalla): ninguna ruta del servidor los chequea todavía.
- **Dato** (con OK de JMS, en su sesión): `public.roles` fila `pruebas` → `cerrado = true`, `secciones = {egresos}`, `permisos` = Facturas MSA/PAM/MA y Subdiarios con escritura, Seguros lectura. ⚠️ Esa escritura **pisó sin querer** lo que la terminal de plan sanitario le había sumado minutos antes (Productivo → Plan sanitario); se repone con OK de JMS. Antes: abierto, `permisos = {}`. Es el ensayo de lo que se le va a dar a Ulises; `contable` no se tocó.

### 💉 5 tablas nuevas en `productivo` + 9 labores (2026-10-27) — ✅ APLICADA el 27/10 con JMS presente (aviso previo): 38 tareas, 6 en cadena, 3 labores IATF, 5 en recurso_tablas · y el rol `pruebas` sumó Productivo → sólo Plan sanitario, sin «Aprobar»

Para [A-FEAT-1380](PENDIENTES.md#a-feat-1380) (plan sanitario, rama `jms/plan-sanitario`): `scripts/106-plan-sanitario.sql` crea
`productivo.plan_sanitario_tareas`, `plan_sanitario_registro`, `plan_sanitario_propuestas`, `iatf` e `iatf_toros` (todas nuevas, marcadas
`[script 106]`), carga el calendario base (38 tareas) y agrega 9 filas a `productivo.labores` (find-or-create por nombre). **No modifica filas
existentes.** 5 filas en `recurso_tablas` (recurso `productivo`).
- RLS `ver_segun_permiso` / `escribir_segun_permiso` como el resto de productivo; `revoke` a `anon`; `authenticated` select/insert/update
  (+ delete sólo en `plan_sanitario_tareas` e `iatf_toros`).
- Dos recursos nuevos en `lib/auth/recursos.ts`: la pestaña `productivo.plan-sanitario` y la acción `productivo.plan-sanitario.aprobar` (quien
  no la tiene propone cambios al plan y espera el OK). Pensado para el rol de Enrique.
- Deshacer: `106-…-deshacer.sql` comprueba la marca y se frena si el usuario ya cargó registros, propuestas o IATF.

📌 Borrá esta entrada cuando la leas.


### 🔎 `public.reglas_conciliacion`: el check de `columna_busqueda` acepta 2 valores más (2026-10-25) — ✅ APLICADA el 25/10 con OK de JMS (aviso previo)
- **`scripts/102-reglas-columna-nombre-texto.sql`**: amplía `reglas_conciliacion_columna_busqueda_check` de 4 valores a 6 —
  suma `'nombre'` (Nombre / comercio = `leyendas_adicionales_1`) y `'texto'` (todo el texto del banco). Los 4 de antes no cambian.
  No toca filas, RLS, GRANTs ni políticas. Se frena si el check no es el esperado; marca `[script 102]`; el deshacer se frena si
  alguna regla ya usa los valores nuevos. Lo corre T1 con OK de JMS. → A-FEAT-1362.

### 🔑 Propuesta de diseño de accesos POR TAREA y POR PERSONA (2026-10-23) — sólo papel, no toca nada

Para [A-FEAT-1322](PENDIENTES.md#a-feat-1322). **No hay código ni cambios en la base**: es una propuesta que JMS todavía
tiene que contestar. Te la aviso **antes** porque, si se aprueba, toca tu terreno: `lib/auth/recursos.ts` (un tipo nuevo
`tarea`), `public.roles` (un rol «cerrado» donde lo no declarado nace apagado, y crear rol desde la app = [A-FEAT-171](PENDIENTES.md#a-feat-171)),
un registro de cambios por trigger en la base, y tus scripts **66/67** de `jms/vistas-seguras` propuestos como paso previo a dar
cuentas en celulares. Página: https://claude.ai/artifact/WFrDNJ7ZGC8N9UnKqxTvPG (privada de JMS; pedile que te la comparta).
De paso: [A-BUG-1327](PENDIENTES.md#a-bug-1327) — las marcas «para revisar» siguen sacando el autor de las rutas viejas
(`getRoleFromRoute`) y lo guardan vacío.

📌 Borrá esta entrada cuando la leas.

### ⏱️ Cierre de sesión por inactividad: toca `middleware.ts` y suma una columna a `public.roles` (2026-10-24) — ✅ APLICADA el 24/10 con OK de JMS (aviso previo)

Para [A-FEAT-1351](PENDIENTES.md#a-feat-1351) (pedido de JMS: 1 hora sin actividad, configurable). Te aviso ANTES porque
es tu territorio (login y roles):
- **`middleware.ts`**: un bloque nuevo, antes del chequeo de 2FA. Si la cookie `cp-actividad` (la escribe la pantalla)
  dice que **esta misma sesión** pasó su tiempo sin actividad, hace `signOut({ scope: "local" })` y redirige a
  `/login?error=inactividad` (401 en `/api`). Sin la cookie no hace nada. Sólo lee el `session_id` del token con
  `getSession()` después del `getUser()` de siempre.
- **Rutas nuevas**: `POST /auth/inactividad` (signOut local, no borra `cp-recordar`), `GET /api/sesion/inactividad`
  (minutos del propio rol + session_id) y `PATCH /api/admin/roles/inactividad` (`exigirAdmin`). Declaradas en
  `verificar:service-role` y `verificar:rutas`.
- **`scripts/101-roles-inactividad.sql`**: `minutos_inactividad integer` **vacía por default** con check 5..1440. No toca
  RLS, GRANTs ni `roles_proteger_sistema` (que no congela esta columna: el admin puede cambiar su tiempo, a propósito).
  Se frena si la columna existe; marca `[script 101]`; el deshacer la verifica. **Sin el script anda igual, con 1 hora
  para todos.** ✅ Corrido el 24/10 por T1 con OK de JMS; verificado: los 5 roles tienen la columna, vacía.
Si algo de esto choca con lo tuyo (por ejemplo, si vas a cambiar el middleware), avisá acá.

📌 Borrá esta entrada cuando la leas.

### 🗄️ Una tabla nueva: `public.balance_datos_usuario` (2026-10-24) — ✅ APLICADA el 24/10 con JMS presente (aviso previo): tabla vacía, marcada, RLS activa, 1 fila en recurso_tablas

Para [A-FEAT-1337](PENDIENTES.md#a-feat-1337): lo que JMS carga a mano en los papeles del balance (precios de hacienda, cuadre de granos,
cuotapartes) se guarda al escribirlo. `scripts/100-balance-datos-usuario.sql` crea **una tabla nueva** y no toca ninguna existente salvo
**1 fila en `recurso_tablas`** (recurso `extracto`, `restringe_lectura = true`, igual que `ajustes_balance` del script 86).
- RLS `ver_segun_permiso` / `escribir_segun_permiso` con `puede_ver` / `puede_escribir`; `revoke` a `anon`; `authenticated` con
  select/insert/update (**sin delete**); el rol `contable` no la ve.
- Se frena si la tabla ya existe y la deja marcada `[script 100]`; el deshacer comprueba la marca y que esté **vacía** antes de borrar.
- Código: `lib/balance/datos-usuario.ts`; si la tabla no está, la pantalla avisa y anda como antes.

📌 Borrá esta entrada cuando la leas.

### 🔒 Una columna nueva en `public.roles`: `cerrado` (2026-10-24) — ✅ APLICADA el 24/10 con JMS presente (aviso previo): 5 roles, los 5 en `false`

Para [A-FEAT-1333](PENDIENTES.md#a-feat-1333) (rol cerrado: lo que se registre después nace apagado para ese rol).
`scripts/99-roles-cerrado.sql` agrega **`cerrado boolean not null default false`**. **Todos los roles quedan en
`false` = como hoy.** No toca RLS, políticas, GRANTs ni el trigger `roles_proteger_sistema`.
- El script **se frena solo si la columna ya existe** y la deja marcada con `[script 99]` en el comentario; el
  `-deshacer` comprueba esa marca (y que no haya roles cerrados) antes de borrarla.
- En código (rama `jms/personas-accesos`): `lib/auth/rol-cerrado.ts` (pura) y `nivelesDe()` de `lib/auth/permisos.ts`
  devuelve el **mapa efectivo** (en un rol cerrado, lo registrado sin tildar viene en `"ninguno"`), así que
  `exigirEscritura` y la pantalla no cambian. `leerRoles()` lee con o sin la columna (`tieneCerrado`).
- Si `jms/vistas-seguras` o la RLS por recurso leen `roles.permisos` desde SQL, ojo: en un rol cerrado esa lista
  es lo que se le **da**, no lo que se le saca. Hoy no hay ningún rol cerrado y no va a haber hasta que JMS tilde uno.
Lo corrió T1 con JMS el 24/10. Todos los roles quedaron abiertos (`cerrado = false`): nada cambió para nadie. Si tenés algo que lea `roles.permisos` desde SQL, avisá acá.

### 🔑 Etapa 1 de accesos: código en `lib/auth/` (2026-10-24) — rama `jms/personas-accesos`, SIN mergear

JMS aprobó arrancar con lo que no cambia nada para Ulises. **No toca la base ni RLS.** Toqué tu terreno en tres lugares:
- **`lib/auth/roles.ts`** → `facturasRestringidas(rol)`: en Facturas el modo completo es sólo para una lista cerrada
  (`admin`, `socio`, `productivo`, los que ya lo veían); antes era `rol === 'contable'` (lo que anotaste en [A-SEC-13](PENDIENTES.md#a-sec-13)). Un rol nuevo entra restringido.
- **`lib/auth/recursos.ts`** → 4 recursos nuevos de Egresos (Subdiarios, Histórico, Asignación Cuentas dentro de Facturas,
  y el botón Archivos para ARCA) y un tipo nuevo **`accion`** (un botón; el control lo verifica buscando `puedeVer("<id>")`
  en su archivo). `scripts/verificar-recursos-permisos.mts` ahora busca cada recurso **en su propio archivo**.
- **`lib/auth/identidad.ts`** → `etiquetaPersona(user)`, y `/api/revisiones` toma el autor de la sesión ([A-BUG-1327](PENDIENTES.md#a-bug-1327)).
- **`app/api/admin/roles`** → `POST`: crear rol vacío o copiando de otro ([A-FEAT-171](PENDIENTES.md#a-feat-171)), regla en
  `lib/auth/crear-rol.ts`. Inserta en `public.roles` con `es_sistema=false` siempre; no toca políticas ni el trigger.
Si algo choca con lo tuyo de `jms/vistas-seguras`, avisá acá antes de que se mergee.

📌 Borrá esta entrada cuando la leas.

### 🗃️ Una columna nueva en `public.proveedores` (2026-10-24) — ✅ APLICADA el 24/10 con JMS presente (aviso previo)

Para [A-FEAT-1332](PENDIENTES.md#a-feat-1332) (control de cantidad de facturas de los proveedores fijos, en Papeles de
balance): `scripts/98` agrega **`facturas_por_mes smallint`**, nullable (null = no es fijo), con un CHECK 1–31.
**No toca RLS, roles, GRANTs ni filas existentes**; la única vista que lee `proveedores` (`presupuesto_historia_cuentas`)
no la lista para escribir. Se aplica con JMS presente; hay `-deshacer`. Si tu modelo de permisos necesita otra cosa, avisá.

### 🗃️ 3 tablas nuevas y columnas del buscador de PDFs (2026-10-21 → 23) — ✅ APLICADAS con JMS presente · ⚠️ aviso POSTERIOR

Para [A-FEAT-1287](PENDIENTES.md#a-feat-1287) / [A-FEAT-1318](PENDIENTES.md#a-feat-1318) (rama `jms/facturas-gmail`, ✅ **mergeada
a `desarrollo` el 23/10** → [A-OP-25](PENDIENTES.md#a-op-25): con esto te llega también el código que las usa). ⚠️ **Este aviso llega DESPUÉS de aplicarlos** — la regla pide antes y se nos
pasó en las cuatro corridas.
- `scripts/90` → **`public.arca_pdf_inventario`** y **`public.arca_pdf_barrido_tramo`** (lo ya leído de los reenvíos de mail).
- `scripts/92` → **`public.arca_pdf_archivo_digital`** (cada PDF de las carpetas de Drive que se leyó, con su texto).
- `scripts/93` y `94` → columnas nuevas en esa misma tabla (veredicto a mano; la factura que se cargó desde el PDF y lo
  corregido). Nullable, sin tocar filas.

**Permisos**: las tres con RLS por `puede_ver` / `puede_escribir`, GRANT sólo a `authenticated`, nada a `anon` (verificado
23/10). **No tienen fila en `recurso_tablas`**, así que hoy las ve y escribe cualquier usuario con rol. Si querés que
cuelguen de un recurso (¿el de facturas de egresos?), es tuyo decidirlo. **No toca ninguna tabla existente.** Cada script
tiene su `-deshacer`.

📌 Borrá esta entrada cuando la leas.

### 🔐 Subdiarios de IVA: un estado nuevo y lo que el rol `contable` ya no puede hacer (2026-10-23)

Entra a `desarrollo` con `jms/iva-archivo-arca` ([A-FEAT-1295](PENDIENTES.md#a-feat-1295)). **No toca la base**: ni
estructura, ni RLS, ni roles, ni GRANTs. Lo que cambia es **lógica de la app según el rol**, y te lo aviso porque es tu terreno:
- `ddjj_iva` (`comprobantes_arca` y `comprobantes_venta`) admite un valor nuevo, **`Enviado`** (no hay CHECK, así que no hizo falta script).
- Sobre lo `Enviado` o `DDJJ OK`, **sólo `admin`** puede imputar, mover, editar o borrar (con advertencia). El rol **`contable`
  queda bloqueado** (decisión de JMS). **Confirmar DDJJ de Compras pasa a ser sólo de `admin`** (antes lo podía cualquiera).
- La regla vive en un solo lugar: `lib/subdiarios/estado-ddjj.ts` → `evaluarCambioDDJJ({ esAdmin })`; el `esAdmin` sale de
  `userRole === 'admin'` como en el resto de la pantalla. Si tu modelo de permisos va a reemplazar ese chequeo, éste es un
  lugar más para enchufarlo.

📌 Borrá esta entrada cuando la leas.

### 🔀 `desarrollo` avanzó 127 commits (2026-10-23) — trae los cambios de base de abajo

Se mergeó `jms/dia-a-dia` → `desarrollo` (fast-forward hasta `b5be470`; `main` sin tocar). Los avisos 🗃️ del 15/10 al
20/10 (scripts **85, 86, 87, 88 y 91**) ya estaban **aplicados en la base** antes del merge: con esto te llega también el
código que los usa. Ninguno toca RLS de tablas existentes; las dos tablas nuevas (`ajustes_balance`,
`detalles_por_proveedor`) tienen su fila en `recurso_tablas`. Si al traer `desarrollo` algo de permisos no te cierra, avisá.

📌 Borrá esta entrada cuando la leas.

### 🌿 Tus ramas ya mergeadas (2026-10-14) — las borrás vos si querés

Hicimos limpieza de ramas: JMS borró las suyas que ya estaban 100 % en `desarrollo`. **Las tuyas no las
tocamos** (regla: cada uno borra las propias). Estas están enteramente contenidas en `desarrollo`:
`feature/inicio-widgets`, `feature/login-google`, `feature/perfil-imagen-preferencias`,
`feature/permisos-granulares`, `home-dashboard`. Si ya no las usás, borralas; si alguna te sirve de base,
dejala.

➕ También se borró `vercel/react-server-components-cve-*` (la creó el bot de Vercel en enero para subir
Next 15.2.4 → 15.2.8; la app ya está en 16.1.1). Y queda **sin mergear a propósito** `jms/vistas-seguras`:
son tus scripts de A-SEC-12 (66/67), esperando tu evaluación.

📌 Borrá esta entrada cuando la leas.

### 🗃️ Dos columnas nuevas en `public.cuotas_egresos_sin_factura` (2026-10-20) — ✅ APLICADAS el 20/10 con JMS presente

Para [A-FEAT-1312](PENDIENTES.md#a-feat-1312) (rama `jms/tarjeta-conciliacion`): los consumos en dólares de la tarjeta
guardan en la cuota el **original en USD y el tipo de cambio** del pago (el extracto queda en dólares, como el papel del
banco). **Qué cambia**: `scripts/91` agrega **`monto_usd numeric(15,2)`** y **`tipo_cambio numeric(15,4)`**, las dos
nullable. **No toca RLS, roles, GRANTs ni filas existentes**; ninguna vista lista la tabla por columnas. Se corre con JMS
presente; hay `-deshacer`. Si tu modelo de permisos necesita otra cosa, avisá.

### 🗃️ 5 tablas nuevas de PÓLIZAS (2026-10-20) — ✅ APLICADAS el 20/10 con JMS presente · ⚠️ aviso POSTERIOR

Para [A-FEAT-1309](PENDIENTES.md#a-feat-1309) (rama `jms/polizas-seguro`): el lector de pólizas de seguro.
`scripts/89-polizas-seguro.sql` crea `public.polizas_seguro`, `polizas_endosos`, `polizas_cuotas`, `polizas_bienes` y
`polizas_responsables`. **No toca ninguna tabla existente** salvo 5 filas en `recurso_tablas` (recurso
`egresos.facturas-msa`, lectura no restringida). RLS con `puede_ver` / `puede_escribir`, nada a `anon` (verificado: 401).
⚠️ **Este aviso llega DESPUÉS de aplicarlo** — la regla pide antes y se nos pasó. Si choca con algo tuyo de permisos,
avisá y se ajusta; el deshacer es `scripts/89-polizas-seguro-deshacer.sql`.
🔀 **23/10: el código ya está en `desarrollo`** (`jms/polizas-seguro` + `jms/alerta-impuestos`). Lo que toca tu territorio: un
recurso nuevo **`egresos.seguros`** en `lib/auth/recursos.ts` (la 5ª pestaña de Egresos; `npm run verificar:recursos` OK)
y el aviso de impuestos de Principal, que **sólo lee** `cuotas_egresos_sin_factura` + `egresos_sin_factura` con la sesión
del usuario (sin service key, sin tablas nuevas).

📌 Borrá esta entrada cuando la leas.

### 🗃️ Tabla nueva `public.detalles_por_proveedor` (2026-10-20) — ✅ APLICADA el 20/10 con JMS presente

Para [A-FEAT-1296](PENDIENTES.md#a-feat-1296) (rama `jms/tarjeta-conciliacion`): el **detalle fijo por proveedor**
que el usuario marca desde la conciliación (cuit, detalle, monto de referencia, activo). **Qué cambia**: `scripts/88`
crea la tabla con RLS por `puede_ver` / `puede_escribir`, `revoke` a `anon`, `grant select, insert, update` a
`authenticated`, y la registra en `recurso_tablas` con recurso **«extracto»** (`restringe_lectura = false`) — mismo
patrón que `ajustes_balance` (script 86). No toca tablas ni filas existentes. Se corre con JMS presente; hay
`-deshacer`. Si tu modelo de permisos necesita otra cosa, avisá antes.

📌 Borrá esta entrada cuando la leas.

### 🗃️ Una columna nueva en `public.reglas_conciliacion` (2026-10-19) — ✅ APLICADA el 19/10 con JMS presente

Para [A-FEAT-1293](PENDIENTES.md#a-feat-1293) (rama `jms/tarjeta-conciliacion`): la regla de conciliación pasa a elegir
**el template**, no la cuenta (pedido de JMS). **Qué cambia**: `scripts/87` agrega **`template_id uuid` nullable** a
`public.reglas_conciliacion`, con FK a `egresos_sin_factura(id) on delete set null`. **No toca RLS, roles, GRANTs ni
filas existentes** (las reglas de hoy quedan con `null` y siguen funcionando por cuenta, como hasta ahora). Se corre
con JMS presente; hay `-deshacer`. Si tu modelo de permisos mapea columnas o necesita algo para esto, avisá antes.

📌 Borrá esta entrada cuando la leas.

### 🗃️ Tabla nueva `public.ajustes_balance` (2026-10-18) — aviso ANTES de aplicarla

`scripts/86-ajustes-balance.sql` (+ `-deshacer`), para [A-FEAT-1207](PENDIENTES.md#a-feat-1207) en versión chica: los
**saldos del ejercicio anterior** que el balance toma como gasto (rama `jms/saldos-ejercicio-anterior`). **Qué cambia**:
una tabla nueva, con **RLS igual a `balance_pendientes`** (políticas `puede_ver` / `puede_escribir`, sin `anon`,
`authenticated` select/insert/update, `service_role` all) y su fila en `recurso_tablas` → recurso **`extracto`**,
**lectura restringida** (el rol `contable` no la ve, como el balance propio). No toca tablas existentes. ✅ **Corrido 2026-10-18** con JMS presente
(RLS activa, 2 políticas, recurso mapeado). Si tu modelo de permisos necesita algo más para una tabla nueva, avisá.

📌 Borrá esta entrada cuando la leas.

### 🗃️ Nuevo estado «historico» en `public.msa_galicia` (2026-10-15) — aviso ANTES de aplicarlo

`scripts/85-extracto-estado-historico.sql` (+ `-deshacer`), para [A-DEC-1009](PENDIENTES.md#a-dec-1009) /
[A-DAT-68](PENDIENTES.md#a-dat-68): el extracto de MSA jul-2025 → ene-2026 se va a cargar entero como histórico.
**Qué cambia**: sólo el check `msa_galicia_estado_check`, que pasa a admitir también `historico`. Aditivo, no toca
filas, sin RLS ni permisos nuevos. ✅ **Corrido 2026-10-15** con JMS presente (1.032 filas intactas). Si algo tuyo filtra por
`estado` del extracto (conciliado/pendiente/auditar), avisá: los históricos no son pendientes ni entran al motor.

📌 Borrá esta entrada cuando la leas.

### 🗃️ Cobros y retenciones para PAM y MA (2026-10-14) — aviso ANTES de aplicarlo

`scripts/84-cobros-pam-ma.sql` (+ `-deshacer`), para [A-FEAT-1219](PENDIENTES.md#a-feat-1219) y
[A-FEAT-24](PENDIENTES.md#a-feat-24). ✅ **Corrido 2026-10-14** con JMS presente. Ojo con algo que encontré: el
schema `pam` tiene privilegios por defecto que le daban a `authenticated` REFERENCES/TRIGGER/**TRUNCATE** sobre
tablas nuevas; en ésta los saqué. Puede valer revisar esos default privileges en tu cierre de A-SEC-14.

| Qué | Permisos |
|---|---|
| tablas nuevas `pam.retenciones_recibidas` y `ma.retenciones_recibidas` (copia de la de MSA) | las mismas policies que puso tu `scripts/62` a la de MSA (`ver_segun_permiso` / `escribir_segun_permiso`), nada a `anon`; si `msa.retenciones_recibidas` está en `recurso_tablas`, se copia el mapeo con su empresa (hoy no figura) |
| columna `comprobante_venta_id` en `public.pam_galicia`, `public.pam_galicia_cc` y `ma.ma_galicia` | heredan grants y RLS de su tabla |

✅ **Por qué no te afecta**: no se toca ninguna policy existente, ni `recurso_tablas` de otras tablas, ni
roles. Si al cerrar A-SEC-14 mapeás `msa.retenciones_recibidas` a un recurso, **sumá las dos nuevas**.

📌 Borrá esta entrada cuando la leas.

### 🗃️ Una columna nueva en `public.notas_para_claude` (2026-10-13) — aviso ANTES de aplicarla

`sin_supervision boolean not null default false` — la marca con la que JMS autoriza a Claude a
desarrollar una nota sin esperarlo ([A-FEAT-1266](PENDIENTES.md#a-feat-1266)). Script
`scripts/83-notas-sin-supervision.sql` (+ `-deshacer`).

✅ **Por qué no te afecta**: no toca RLS, policies ni `recurso_tablas`; los grants de esa tabla son a
nivel tabla, así que la columna los hereda; no hay vistas sobre ella; las filas que existen quedan en
`false`.

🔐 **Y otro aviso el mismo día, éste sí en tu archivo — `middleware.ts`** ([A-BUG-1248](PENDIENTES.md#a-bug-1248)):
voy a sumarle a la CSP **una directiva `frame-src https://drive.google.com`**. Hoy no hay `frame-src`,
así que cae en `default-src 'self'` y la app no puede mostrar el visor de Drive embebido: «👁 ver» en
*Subdiarios → PDFs sin vincular* da «Este contenido está bloqueado» con todos los archivos. No se toca
`frame-ancestors 'none'` ni `X-Frame-Options: DENY` (la app sigue sin poder ser embebida por nadie) ni
ninguna otra directiva. Si preferís otro camino (por ejemplo servir el PDF por una ruta propia),
revertilo sin avisar.

📌 Borrá esta entrada cuando la leas.

### 🗃️ Dos tablas nuevas para la planilla de asistencia de sueldos (2026-10-09) — aviso ANTES de aplicarlas

**La BD es una sola, así que te aviso antes.** Es `scripts/81-planilla-asistencia.sql` (y su `-deshacer`), para
[A-FEAT-1259](PENDIENTES.md#a-feat-1259):

| Tabla | Qué guarda | Permisos |
|---|---|---|
| `sueldos.asistencia` (+ vista `public.sueldos_asistencia`) | una marca por empleado y día (P · F · ½ · V · L) | **igual que las demás de `sueldos`**: RLS `tiene_rol()`, vista con grants a `authenticated`, nada a `anon` |
| `public.feriados` | feriados nacionales 2025–2027 precargados + los que se agreguen a mano | RLS `tiene_rol()`, nada a `anon` |

✅ **Por qué no te afecta**: son tablas **nuevas**; no se toca ninguna existente, ninguna policy tuya ni
`recurso_tablas`. Copian el patrón de permisos que ya tiene `sueldos` — si al cerrar A-SEC-14 le ponés
`restringe_lectura` a sueldos, **sumá estas dos**. Reversible entero con el `-deshacer`.

➕ **Y un cambio de tipo, mismo día** (`scripts/82-dias-trabajados-con-medios.sql`): `sueldos.periodos.dias_trabajados`
pasa de **integer a numeric** (los jornales admiten medio día). Como la vista `public.sueldos_periodos` depende de la
columna, el script la **recrea con la misma definición y los mismos GRANTs** (authenticated y service_role, nada a
anon) dentro de una transacción. Si tenés algo que lea esa vista, no cambia nada: mismas columnas.

📌 Borrá esta entrada cuando la leas.


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
anon. Lo hace JMS en el script; **no se re-abre `anon`**. ✅ **Hecho 2026-10-05** — el script lee la key
de sus propiedades y los borradores volvieron a salir.

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

## 📨 2026-10-03 · PARA JAVIER — VOY A CORRER `scripts/77` (aviso ANTES): una columna en los extractos

`nro_resumen varchar(30)` en `public.msa_galicia`, `public.pam_galicia`, `public.pam_galicia_cc` y
`ma.ma_galicia`: el débito que paga un resumen de tarjeta queda atado a ese resumen (A-DEC-1002). Mismo
nombre que en las tablas de tarjeta. **No toca RLS, roles ni permisos.** Rama `jms/tarjeta-conciliacion`.
🔙 `scripts/77-pago-de-resumen-tarjeta-deshacer.sql`.

## 📨 2026-10-03 · PARA JAVIER — VOY A CORRER `scripts/75` (aviso ANTES): dos tablas NUEVAS con RLS

`public.balance_fotos` y `public.balance_foto_valores` — el **balance propio** de JMS (A-FEAT-1190 /
A-DEC-1001): una foto por empresa y fecha de cierre, con un importe por renglón y versión (contador /
JMS / sistema / SENASA). Mismo patrón que `scripts/73`: RLS con `puede_ver` / `puede_escribir`, revoke a
`anon`, y registradas en `recurso_tablas` con recurso **`extracto`** y **`restringe_lectura = true`**
(es el análisis patrimonial del dueño: el rol `contable` no lo ve). No toca ninguna tabla existente.
Después, `scripts/76` carga las fotos MSA 30/06/24 y 30/06/25 (datos nuevos). 🔙 `scripts/75-balance-propio-deshacer.sql`.

## 📨 2026-10-03 · PARA JAVIER — `main` se actualizó con todo lo de JMS (nada tuyo nuevo)

Con OK de JMS, `main` pasó de `bf3a068` a lo mismo que `desarrollo` (fast-forward, 193 commits, **todos
de JMS**). **De lo tuyo no viajó nada que no estuviera ya en `main`**: tus ramas ya estaban adentro desde
el 01/10. Los scripts SQL que viajan (61–64, 68–74) **ya estaban corridos** en la base; los dejamos con su
`-deshacer`. `jms/vistas-seguras` (scripts 66/67) **sigue afuera**, para que la evalúes vos.
👉 Antes de seguir tu próxima rama, pulleá `desarrollo` (o `main`, que ahora son iguales).

## 📨 2026-10-03 · PARA JAVIER — VOY A CORRER `scripts/74` (aviso ANTES)

Dos columnas de texto en **`msa.echeqs_terceros`**: `proveedor_nombre` y `comprobantes_pagados` (las del
estándar de registro, mismo nombre que en `msa_galicia`). No toca filas, permisos ni RLS.

## 📨 2026-10-02 · PARA JAVIER — `scripts/73`: una tabla NUEVA con RLS (avisado ANTES; ✅ corrido después de este aviso)

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

## 📨 2026-10-05 · PARA JAVIER — voy a sumar 2 tarjetas a tu registro de widgets (`lib/widgets/registro.ts`)

Al pasar Principal a tarjetas (A-FEAT-88, 17/09) quedaron **afuera dos paneles** que estaban en la pantalla
fija: **🚩 las marcas «para revisar» (Alt+R)** —el usuario tiene 13 abiertas y dejó de verlas— y
**los echeq en fecha de cobro** (A-FEAT-1182, que se sumó a la pantalla vieja después de tu cambio). No es
un error tuyo: la pantalla vieja siguió recibiendo cosas que ya no se mostraban.

**Qué hago**: dos filas nuevas en `WIDGETS` (`revisiones`, sección `principal`; `echeqs-en-fecha`, sección
`cashflow`) y las agrego a `WIDGETS_POR_DEFECTO`. No toco nada más del registro ni del configurador.
Si preferís otra sección para el permiso de alguna, cambiala sin avisar. Al leerlo, borrá esta entrada.

## 📨 2026-10-05 · PARA JAVIER — 3 columnas nuevas en `productivo.movimientos_insumos` (aviso, no hay nada que hacer)

`moneda` (text, default `'ARS'`, check ARS/USD), `costo_unitario_moneda` (numeric) y `tipo_cambio`
(numeric). Motivo: las compras en dólares se cargaban en `costo_unitario`, que toda la app lee como
pesos. `costo_unitario` **sigue en pesos**; las columnas nuevas guardan el original. Sin cambios de
RLS, permisos ni vistas (la tabla se expone directa). Script: `scripts/78-moneda-compras-insumos.sql`
(+ `-deshacer`). Rama `jms/compras-factura`. Al leerlo, borrá esta entrada.

## 📨 2026-10-05 · PARA JAVIER — un TRIGGER nuevo en `msa.comprobantes_arca` (aviso, no hay nada que hacer)

`trg_costo_compras_sigue_tc` (AFTER UPDATE OF `tc_pago`, `tipo_cambio`) → `productivo.costo_compras_sigue_tc()`
(`security definer`, `search_path = ''`). Cuando cambia el TC de pago de una factura en dólares, recalcula
en pesos el costo de las compras de insumos vinculadas a ella (movimiento, vínculo y el costo del stock si era
el de esa compra). No cambia RLS ni permisos. Script `scripts/79-costo-compras-sigue-tc-pago.sql` (+ `-deshacer`).
Y una fila más en tu registro de widgets: `nc-diferencia-cambio` (sección `egresos`), también en el default.
Al leerlo, borrá esta entrada.

## 📨 2026-10-07 · PARA JAVIER — tabla nueva `public.balance_pendientes` (aviso, no hay nada que hacer)

Pendientes a revisar de los papeles de trabajo del balance (A-FEAT-1258). **Mismo patrón que el balance
propio (script 75)**: RLS `ver_segun_permiso` / `escribir_segun_permiso` con `puede_ver`/`puede_escribir`,
`revoke` a `anon`, registrada en `recurso_tablas` con recurso `extracto` y `restringe_lectura = true` (el rol
`contable` no la ve). Script `scripts/80-balance-pendientes.sql` (+ `-deshacer`). Al leerlo, borrá esta entrada.

