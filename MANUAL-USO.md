# 📖 MANUAL DE USO — flujo de trabajo del sistema

> **Qué es:** cómo el USUARIO opera cada módulo (el flujo real de trabajo), no la arquitectura de datos (eso → `ARQUITECTURA-BD.md`).
> **Para qué:** entendimiento compartido usuario↔Claude del "cómo se usa", que hoy estaba desparramado.
> **Cómo se mantiene:** cuando el usuario diga *"registra"*, actualizar la sección del módulo tocado (además de las otras dimensiones — ver `CLAUDE.md` § Dimensiones de registro).
> **Estados:** ✅ definido y en uso · 🟡 en uso pero con propuesta de cambio · ⏸️ decisión pendiente (a evaluar juntos).

---

## 💸 Módulo: Pagos / Egresos

### Base de operación del usuario (cómo trabaja hoy) 🟡
- El usuario gestiona los pagos desde el **Modal de Pagos** = botón **"Pagos"** dentro de la vista **Facturas/Egresos** (abre un modal/diálogo). Es su **~90%**.
- Históricamente usaba el **Cash Flow** (panel consolidado). Lo dejó porque el Modal de Pagos le muestra **más rápido lo pendiente de pago**, sin el "ruido" de lo pendiente de conciliar.
- **Ventaja del Cash Flow:** pantalla más grande, se ven y editan **más datos** a la vez.
- **Definición del usuario:** la gestión es desde el **panel central consolidado** (incluye TODAS las categorías: ARCA, templates, anticipos, sueldos, ventas), **no** desde las grillas por módulo (grilla FC / grilla templates). Ir a esas grillas para gestionar **no** es el flujo deseado.
- Regla del Cash Flow: **`conciliado` NUNCA se muestra** en Cash Flow (sale al conciliar).

### Modelo de fechas (4) ✅
- `fecha_emision` — solo FC, viene de AFIP.
- `fecha_estimada` — interna; **ordena el Cash Flow**.
- `fecha_vencimiento` — firme.
- `fecha_pago` — pago real.
- **Propagación:** `venc → estimada` y `pago → estimada`. **venc y pago NO se tocan entre sí** (ambos alimentan estimada).
- **Templates:** venc **solo** editable desde "Egresos sin Factura" (guardián de BD). **FC:** venc editable.
- Detalle técnico del refactor: `PENDIENTES.md` A-TEST-06.

### ⏸️ DECISIÓN PENDIENTE — dónde se gestionan los pagos (evaluar juntos)
Dos propuestas sobre la mesa. **Conservar ambas hasta decidir.**

**Propuesta A — Claude (mejorar columnas del Modal de Pagos):**
Vista Pagos con roles fijos + color para el estado (sin columnas "mágicas" que muten):
- *Templates:* **Vence** (read-only; muestra venc firme, o estimada en color suave si no hay venc) + **Fecha Pago** (editable).
- *ARCA:* **Emisión** (RO) + **Vence** (editable = fecha objetivo de pago) + **Fecha Pago** (editable).
- Re-estimar / editar venc de templates: desde grilla/cash flow.
- *Contra:* obliga a ir a otras vistas para algunas ediciones (el usuario NO quiere eso).

**Propuesta B — Usuario (Cash Flow como base única, reemplazar el Modal):**
Mejorar el Cash Flow para que **reemplace** al Modal de Pagos y usarlo como panel único (como hacía siempre):
- **Vista default "operativo":** desde **hoy en adelante** + **todo lo impago** (vencido impago pasado + futuro), **nunca `conciliado`**. Así entra y ve lo mismo que el Modal, sin ruido.
- Agregar **filtros/chips/botones** para acotar (estado, origen, fecha) sin ir a grillas.
- Objetivo: **un solo flanco** de gestión; luego **deprecar/borrar** el Modal de Pagos.
- *A favor del usuario:* pantalla grande, todo editable, panel central por definición.

**A resolver:** qué le falta al Cash Flow (filtros/botones) para cubrir el 100% de lo que hoy hace el Modal, y si conviene converger todo ahí. NO tocar pagos hasta decidir.

### Nomenclatura
- **"Modal de Pagos"** = botón "Pagos" en la vista Facturas → abre un modal (diálogo). En código: `mostrarModalPagos` / "Vista Pagos". Sí, es técnicamente un **modal**.
- **"Cash Flow"** = panel consolidado (`vista-cash-flow`).
