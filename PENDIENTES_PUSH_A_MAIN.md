# Pendientes de push a `main`

Estado: **3 commits** en `desarrollo` que aún no están en `main`.
Actualizado: 2026-06-14.

Para ver el estado actual:
```bash
git fetch origin main
git log --oneline origin/main..desarrollo
```

---

## Commits pendientes de mergear

### 🔌 Módulo ARCA — Descarga automática de Mis Comprobantes
**3 commits**:
- `74dc665` — Refactor: pedir clave ARCA por modal + limpiar arca-poc del repo
- `2c96f72` — Feature: módulo ARCA — descarga automática Mis Comprobantes
- `f399a5d` — UI: reorganizar barra botones Facturas en 2 filas + dropdown 'Importar FC'

**Qué incluye**:
- `lib/arca/` (módulo importable: http, login, descargar, index)
- `app/api/arca/descargar-comprobantes/route.ts` (endpoint, solo admin, recibe password en body)
- Modal "Importar desde ARCA" en `vista-facturas-arca.tsx` con input password obligatorio
- Tabla `arca_descargas_log` (ya aplicada a BD)
- Botón unificado "Importar FC ▼" con dropdown (ARCA solo admin, Excel manual para todos)
- Barra de botones reorganizada en 2 filas + búsqueda en fila propia
- Limpieza: `arca-poc/` removido del repo (datos sensibles + código del POC standalone)

**Antes de mergear a main, verificar en Vercel**:
1. ✅ Variables de entorno en Production + Preview:
   - `ARCA_CUIT_PERSONAL = 23342147739`
   - `ARCA_CUIT_EMPRESA_MSA = 30617786016`
   - `ARCA_CUIT_PERSONAL_MA = 27066824611`
   - ⚠️ NO van más `ARCA_PASSWORD_*` (la clave se pide por modal)
2. Probar en preview (rama desarrollo) que el botón funciona end-to-end.
3. Si pasa, mergear a main.

---

## Cómo mergear (cuando estés listo)

```bash
git checkout main
git pull origin main
git merge desarrollo --no-ff -m "Merge: módulo ARCA + UI 2 filas + clave por modal"
git push origin main
git checkout desarrollo
```

---

## Última actualización
- 2026-06-10: Merge previo (commit `4180968`) — todo lo anterior pasó a main.
- 2026-06-14: 3 commits nuevos arriba listados.
