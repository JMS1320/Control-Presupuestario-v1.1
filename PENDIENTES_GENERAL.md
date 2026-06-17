# Pendientes generales del sistema

Documento consolidado de todo lo pendiente. Agrupado por área.
Actualizado: 2026-06-16.

---

## 📎 GAS PDF — descarga automática (2026-06-16)

App-side completo en `desarrollo` (commits 5a2a3f9, 74805b1, d9bd749).
Detalle completo en `memory/project_gas_pdf_busqueda.md`.

**Pendiente del usuario para activar**:
1. Deploy GAS Web App (`clasp create + push` en `gas-buscar-pdf/`)
2. Configurar `GAS_AUTH_TOKEN` en Script Properties del GAS
3. Habilitar Drive API en Services del GAS
4. Deploy → Web App, copiar URL
5. Configurar env vars Vercel: `GAS_BUSCAR_PDF_URL`, `GAS_AUTH_TOKEN`,
   `GAS_FOLDER_ID_MSA`, `GAS_FOLDER_ID_PAM`, `GAS_FOLDER_ID_MA`
6. Cargar emails de proveedores desde modal "Config PDFs"

Instrucciones detalladas en `gas-buscar-pdf/README.md`.

**Pendiente de Claude (Fase 2)**:
- Auto-disparo post-import (hook después del import ARCA)
- Auto-crear proveedor cuando se importa FC de CUIT inexistente
- Botón "Buscar PDF de esta FC" en menú 3 puntos
- Módulo propaganda (mover/etiquetar mails) — postergado
- Reportes periódicos GAS trigger semanal — postergado

---

## 🧾 SICORE — bugs caso Alcorta (2026-06-16)

Ver detalle completo en `memory/project_grupos_pago_bugs.md` y `memory/project_sicore_estado_quincena.md`.

**Bugs a revisar (no urgentes)**:
1. Cancel del modal SICORE no siempre revierte estado a 'pendiente' — anotar próxima vez que pase
2. Inline editing de `pagar→pendiente` no persiste en FC con `grupo_pago_id` — probablemente relacionado con grupo
3. Dropdown 3 puntos vacío para FC en `pagar` sin SICORE — agregar item "↩ Volver a Pendiente"
4. `resetearFactura` NO limpia `grupo_pago_id` — decisión 2026-06-16: dejar así (empíricamente útil)

**Feature futura**:
5. Vista "Grupos de Pago" desde Cash Flow — listar, agregar/quitar items, recalcular monto_total

**En análisis**:
6. `grupos_pago.monto_total` no se recalcula automáticamente al cambiar FC vinculadas — definir si trigger / on-demand / warning UI

---

## 🔌 Módulo ARCA (descarga automática)

**Estado**: implementado en `desarrollo`, no en `main` todavía.

### Pasos para activarlo
1. Configurar 3 variables de entorno en Vercel (Production + Preview):
   - `ARCA_CUIT_PERSONAL = 23342147739`
   - `ARCA_CUIT_EMPRESA_MSA = 30617786016`
   - `ARCA_CUIT_PERSONAL_MA = 27066824611`
2. Probar end-to-end en preview de `desarrollo`.
3. Mergear a `main` (ver `PENDIENTES_PUSH_A_MAIN.md`).

### Posibles desarrollos futuros (cuando esté funcionando)
- Atajos extra de fecha (ej. "Año actual", "Año anterior").
- Soporte de comprobantes Emitidos (hoy solo recibidos).
- Cron automático ("descargar el día anterior, todos los días") — pero requiere que la clave esté en env vars (no compatible con el modo "pedir por modal").
- Vista de histórico de descargas (consulta de `arca_descargas_log`).
- Reintentos automáticos si ARCA da error transitorio.
- Si ARCA cambia su formato, el módulo `lib/arca/` necesitará ajuste de selectores.

---

## 🔧 Modo Admin de facturas — bug de edición pendiente

**Estado**: implementado parcialmente (commit `5a24fa6`, en main).

- ✅ Eliminación funciona (con confirmación "aceptar").
- ❌ La edición libre de campos no funciona en modo admin (reportado 2026-06-09).

**Causa probable** (no investigada todavía):
- `renderizarCelda` se sobreescribe en otra rama del render.
- O el click handler queda bloqueado por otro modo.
- O el `window.prompt` cancela el flujo silenciosamente.

**Documentado en**: `memory/project_modo_admin_facturas_pendiente.md`.

---

## 💳 Tarjetas Fase 2 — testing con PDF real pendiente

**Estado**: implementado en main (commits `6906f49` y `8690bc0`).

- Parser PDF Galicia + Excel auditoría implementados.
- Sin probar con un PDF real:
  - Parser de movimientos
  - Control de saldo
  - Deduplicación
  - Tarjetas adicionales

**Documentado en**: `memory/project_tarjetas_testing_pendiente.md`.

---

## 📊 Dashboard rediseño — decisión arquitectural pendiente

**Estado**: Paso 0 hecho (reclasificación cuentas + 21 cuentas nuevas), decisión arquitectural pendiente (2026-06-01).

Hay 5 opciones de modelo, la recomendada es **B**: templates con FK a cuenta contable.

**Plan completo en**: `PLAN_DASHBOARD_REDISEÑO.md` (en raíz).
**Documentado en**: `memory/project_dashboard_redise_o.md`.

---

## 📥 Subdiario Ventas — igualar flujo a Compras

**Estado**: implementado y funcionando (en main), pero el **flujo de trabajo difiere** del Subdiario de Compras.

El usuario reportó (2026-06-10):
> "Funciona ok. Funciona de otra manera que compras. Pero eso te puedo explicar la diferencia luego así lo igualamos."

**Pendiente**: el usuario va a explicar cuáles son las diferencias específicas para igualar el comportamiento (cuándo se ven los comprobantes, cómo se imputan, etc.).

---

## 🏦 Plan reglas + templates bancarios PAM/MA — Paso 4

**Estado**: pasos 1-3 implementados y testeados (motor, copia+wizard, validación al activar).

**Pendiente**: paso 4 (CAJA / CRED P).

**Documentado en**: `memory/project_plan_reglas_templates_bancarios.md`.

---

## 🏢 Proveedores — carga orgánica

**Estado**: BBDD creada, columnas extracto OK, pre-filtro CUIT OK.

**Pendiente**: carga orgánica de proveedores existentes (no se hace de a uno, sino aprovechando facturas/extractos existentes).

**Documentado en**: `memory/project_proveedores_pendientes.md`.

---

## 🧪 Testing pendiente (general)

**24 funcionalidades sin testear** según `memory/feedback_testing_pendiente.md` (última actualización 2026-05-15).

Probablemente algunas ya se testearon entremedio, pero está pendiente repasar la lista y marcar las hechas vs las que faltan.

---

## 🔧 Pendientes operacionales / housekeeping

### MCP
- Estaba en `write` mode durante el desarrollo de la sesión actual.
- ⚠️ **Revertir a `--read-only`** en `.mcp.json` cuando se cierre el ciclo.

### Archivo `nul` en repo
- Hay un archivo llamado `nul` en la raíz del proyecto (artefacto de Windows).
- Rompe `git add -A` y similares.
- Hay que borrarlo manualmente: `Remove-Item -Path "nul" -Force` desde PowerShell.

### Carpeta vacía `arca-poc/`
- Quedó vacía en disco local (Windows mantiene un handle).
- Se puede borrar a mano desde el explorador cuando libere.
- Está en `.gitignore`, no afecta a git.

### Archivos sueltos en raíz
La raíz del proyecto tiene **~40 archivos .xlsx / .csv / .pdf / .md sueltos** (excels de trabajo, reportes, documentos). No están en git (untracked). Decidir si:
- Se mueven a una carpeta `documentos/` o `temp/`.
- Se borran si no se usan.
- Se ignoran como están.

### Stocks negativos
- Hay productos con stock negativo en sector productivo (pendiente auditoría).
- Ver `memory/project_proxima_sesion.md`.

---

## 📚 Memorias relevantes (índice rápido)

| Archivo | Tema |
|---|---|
| `memory/MEMORY.md` | Índice general de memorias |
| `memory/project_modo_admin_facturas_pendiente.md` | Bug edición Modo Admin |
| `memory/project_tarjetas_testing_pendiente.md` | Testing Fase 2 tarjetas |
| `memory/project_dashboard_redise_o.md` | Dashboard rediseño |
| `memory/project_plan_reglas_templates_bancarios.md` | Reglas PAM/MA |
| `memory/project_proveedores_pendientes.md` | Proveedores |
| `memory/project_proxima_sesion.md` | Operacionales |
| `memory/feedback_testing_pendiente.md` | 24 funcionalidades sin testear |

---

## 📋 Documentos de referencia en raíz

| Archivo | Tema |
|---|---|
| `PENDIENTES_PUSH_A_MAIN.md` | Commits sin mergear |
| `PENDIENTES_GENERAL.md` | Este documento |
| `PLAN_DASHBOARD_REDISEÑO.md` | Plan completo Dashboard |
| `RECONSTRUCCION_SUPABASE_2026-01-07.md` | Cambios BD post-reconstrucción |
| `CLAUDE.md` | Centro de comando del proyecto |
| `KNOWLEDGE.md` | Base de conocimiento completa |
