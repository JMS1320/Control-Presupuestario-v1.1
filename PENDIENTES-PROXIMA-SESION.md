# 🎯 PENDIENTES PRÓXIMA SESIÓN - SISTEMA DDJJ IVA

## ✅ **LOGROS CONFIRMADOS 2025-09-11:**
- **Excel**: Total IVA ✅ + Otros Tributos ✅ funcionando correctamente
- **PDF**: Total IVA ✅ + Otros Tributos ✅ funcionando correctamente  
- **Sistema DDJJ**: Generación archivos profesionales funcionando

---

## 🚨 **PENDIENTES INMEDIATOS:**

### 1. **FIX INTERFAZ - Total IVA sigue en cero**
- **Estado**: Excel/PDF ✅ corregidos, Interfaz ❌ aún muestra 0
- **Problema**: Mapeo diferente en consulta interfaz vs generación archivos
- **Acción**: Buscar consulta específica interfaz y corregir mismo mapeo

### 2. **AGREGAR COLUMNA IVA 21% - Excel + PDF**
- **Ubicación**: Después de columnas Neto, antes de IVA Diferencial
- **Orden objetivo**:
  ```
  Fecha | Tipo | Razón Social | CUIT | Neto Gravado | Neto No Gravado | 
  Op. Exentas | Otros Tributos | IVA 21% | IVA Diferencial | Total IVA | Imp. Total
  ```
- **Cambio**: Mover "IVA Diferencial" de posición final → después de "IVA 21%"
- **Campo BD**: `iva_21` (ya existe en interface FacturaArca)

### 3. **MEJORAS DESGLOSE (después de fixes anteriores)**
- **Monotributo**: Mover a tabla desglose alícuotas
- **Totales**: Agregar fila TOTALES resaltada
- **Totalización**: Vertical + horizontal

---

## 🎯 **PRIORIDADES PRÓXIMA SESIÓN:**

### **PRIORIDAD 1 - Fix interfaz IVA Total (2 min)**
- Encontrar consulta interfaz facturas
- Aplicar mismo fix: `f.imp_total_iva` → `f.iva`

### **PRIORIDAD 2 - Agregar IVA 21% + reordenar (5 min)**
- Excel: Agregar columna `f.iva_21` en posición correcta
- PDF: Agregar columna `f.iva_21` en posición correcta  
- Mover "IVA Diferencial" después de "IVA 21%"

### **PRIORIDAD 3 - Mejoras desglose (10 min)**
- Reestructurar tabla alícuotas con monotributo + totales
- Resaltado visual fila TOTALES

---

## 📊 **ESTADO ACTUAL:**
- **Excel + PDF**: ✅ Funcionando correctamente
- **Interfaz**: ⚠️ Total IVA aún en cero  
- **Estructura columnas**: ⚠️ Falta IVA 21% + reordenar
- **Desglose**: ⚠️ Pendiente reestructuración

---

## 🔧 **METODOLOGÍA EFICIENTE:**
1. **Quick fix interfaz** → mismo patrón Excel/PDF aplicado
2. **Agregar IVA 21%** → usar campo `iva_21` existente  
3. **Reordenar columnas** → mover IVA Diferencial
4. **Testing rápido** → generar archivos verificar orden

**Tiempo estimado total**: 15-20 minutos máximo

**Branch**: `desarrollo` listo para continuar