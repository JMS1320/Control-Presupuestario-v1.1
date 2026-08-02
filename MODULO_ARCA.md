# 🏛️ MODULO_ARCA — Integración con ARCA / AFIP

> **Dimensión MÓDULOS** (`CLAUDE.md` § Documentación).
> Consolida `INTEGRACION_SICORE_ARCA.md` e `INVESTIGACION_INTEGRACION_ARCA_AFIP.md` (sep-2025),
> movidos como historia cruda a `arca-api/`.
> **Creado 2026-08-02** · verificado contra el disco ese día.
>
> ⚠️ **Incompleto**: falta la parte de la app (importador + vistas). Ver
> `PENDIENTES.md` § [A-DOC-09](PENDIENTES.md#a-doc-09).

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
| 3 | Carga de comprobantes **Portal IVA** | ❌ Nunca se llegó |

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
