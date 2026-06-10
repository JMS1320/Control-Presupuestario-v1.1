# Pendientes de push a `main`

Estado: **25 commits** en `desarrollo` que aún no están en `main`.
Generado: 2026-06-10.

Para ver el estado actualizado:
```bash
git fetch origin main
git log --oneline origin/main..desarrollo
```

---

## Bloques temáticos a mergear

### 🚀 Módulo IVA Ventas (Subdiarios + Ventas + Liquidaciones)
**9 commits** — Sistema nuevo completo:
- `6257fa5` — Cuenta contable + centro costo en comprobantes_venta
- `bf5662e` — Excel + PDF Libro IVA Ventas (MSA + MA)
- `87954db` — Subdiarios IVA Ventas (MSA + MA) + modal FC/NC
- `9ce5891` — Refactor: rename liquidaciones_venta → comprobantes_venta + cols subdiario
- `37b7339` — Bloque Monotributo con 3 filas (FC C / NC C / Total Neto)
- `9337808` — Subtotales Período estilo ARCA — tabla FC / NC / Total
- `bc0961b` — Fix alícuotas IVA que daban x10
- `865719b` — Refactor: separación inputs vs cálculos en Ventas/Liquidaciones
- `8d9733c` — Módulo IVA Ventas MSA — Ingresos > Ventas + Liquidaciones

⚠️ **Antes de mergear**: ejecutar las 4 migraciones SQL post-reconstrucción en main si se reconstruye la BD. Ver `RECONSTRUCCION_SUPABASE_2026-01-07.md` secciones 2026-06-09 (mañana/tarde/noche) y 2026-06-10.

### 🔐 Modo Admin facturas
- `5a24fa6` — Modo Admin para facturas — edición libre + eliminación
  - ⚠️ **Conocido**: edición no funciona, solo eliminar. Documentado en `memory/project_modo_admin_facturas_pendiente.md`. Mergear igual porque la eliminación sí funciona.

### 💰 Anticipos
- `0f9aa0a` — Anticipos con cuenta contable + estado 'externo'
  - ⚠️ **BD**: requiere ALTER post-reconstrucción.

### 👁 Vista Pagos — visible_contable (Ulises)
- `a47bc94` — visible_contable bulk + atajo a 'Pagado' (Fase 3+4)
- `befca75` — Filtro 'visible_contable' en Vista Pagos (Fase 1+2)
- `af4437d` — Editar fecha de vencimiento en filas agrupadas
  - ⚠️ **BD**: columna `visible_contable` en 5 tablas. Post-reconstrucción.

### 🌾 Sector Productivo
- `c8f5f29` — Filtros en vista Movimientos de Insumos
- `10e1fb7` — Fix ancho columnas Dosis y Cabezas
- `0b69fa8` — Orden agrícola: total (L) editable que recalcula dosis
- `c037074` — Distinción agrícola/ganadero por ambito de categoría

### 📊 Dashboard
- `330f1cb` — Docs: plan rediseño Dashboard (paso 0 hecho, decisión arquitectural pendiente)
  - 📝 Solo documentación. Mergeable sin riesgo.

### 💳 Tarjetas (Fase 2)
- `8690bc0` — Fase 2b: parser PDF Galicia + Excel auditoría
- `6906f49` — Fase 2a: BD, motor, endpoint Excel y UI
  - ⚠️ **Conocido**: testing pendiente con PDF real. Documentado en `memory/project_tarjetas_testing_pendiente.md`.

### 💵 Cajas (Fase 1)
- `c04e71d` — Cajas: ignorar columna Comp
- `7451789` — Importador de cajas (General / AMS / Sigot)

### 🔌 POC ARCA (standalone)
- `fa67252` — POC scraping ARCA Mis Comprobantes
  - 📝 **No toca app principal**. Mergeable sin riesgo. Pendiente probar localmente.

---

## Recomendación de mergeo

**Opción A — Todo de una**: merge fast-forward de `desarrollo` a `main`.
- Pro: rápido, deja todo igual.
- Con: si algo rompe, hay que revertir varios commits.

**Opción B — Por bloques**: cherry-pick por bloques temáticos.
- Pro: más control, fácil de revertir un bloque sin tocar los demás.
- Con: más trabajo manual.

**Mi recomendación**: dado que ya estás probando en `desarrollo` (Vercel preview) y los commits son acumulativos, **Opción A**. Si encontrás un bug en main, revertir un commit puntual sigue siendo fácil.

### Antes de mergear a main, verificar

1. **Migraciones BD aplicadas en producción**: las del bloque IVA Ventas + anticipos + visible_contable. Ver `RECONSTRUCCION_SUPABASE_2026-01-07.md`.
2. **Variables de entorno**: las nuevas (`ARCA_*`) no son requeridas todavía porque el POC está aparte. Las del flujo normal de la app no cambian.
3. **Smoke test en preview**: que las 4 tabs nuevas de Ingresos cargan sin errores.
4. **Deploy Vercel**: que la build pase sin errores.

---

## Cómo mergear (cuando estés listo)

```bash
# Asegurar que desarrollo esté actualizado
git checkout desarrollo
git pull origin desarrollo

# Cambiar a main y actualizar
git checkout main
git pull origin main

# Merge fast-forward (sin commit de merge)
git merge desarrollo --ff-only

# Si no es fast-forward (hubo commits en main que no están en desarrollo):
# git merge desarrollo --no-ff -m "Merge desarrollo: bloque IVA Ventas + POC ARCA + ..."

# Push a main
git push origin main

# Volver a desarrollo para seguir trabajando
git checkout desarrollo
```

---

## Pendientes que se quedan en `desarrollo` sin mergear (decisión consciente)

Por ahora ninguno. Si algún feature se considera "en testing prolongado" antes de production, se documenta acá.
