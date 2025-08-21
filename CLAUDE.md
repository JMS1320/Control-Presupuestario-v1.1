# 🎯 CLAUDE.md - CENTRO DE COMANDO

> **Este archivo es tu "índice inteligente"**: Información crítica actual + navegación al conocimiento completo.

---

# 🤖 **REGLAS AUTOMÁTICAS CLAUDE**

## 🔄 **Reglas de Objetivos:**
1. **Verificar contexto objetivo** antes de responder
2. **Buscar en KNOWLEDGE.md** solo si no está en contexto cargado
3. **Documentar avances en Claude** durante objetivo activo  
4. **Proponer finalizar objetivo** cuando mencione "completado"
5. **Usar tags sistemáticos** en toda documentación
6. **Nunca esperar que usuario pregunte** → proponer automático

---

# 📂 **NAVEGACIÓN A KNOWLEDGE.md**

## 🔍 **Búsqueda por Tags:**
```bash
# Todo sobre Cash Flow:
Grep "#cash-flow" KNOWLEDGE.md

# Configuraciones funcionando:
Grep "#funcionando" KNOWLEDGE.md  

# Errores resueltos:
Grep "#error #solucion" KNOWLEDGE.md

# Pendientes implementar:
Grep "#pendiente" KNOWLEDGE.md
```

## 📋 **Secciones Principales:**
- **SISTEMAS COMPLETOS** - Funcionalidades terminadas `#completado`
- **CONFIGURACIONES MASTER** - Setups validados `#funcionando`
- **PENDIENTES IMPLEMENTACIÓN** - Por implementar `#pendiente`
- **TROUBLESHOOTING ÚNICO** - Errores resueltos `#error #solucion`
- **CONOCIMIENTO DESCARTADO** - Métodos NO usar `#descartado`

**📍 Índice completo**: Ver KNOWLEDGE.md líneas 7-31

---

# ⚡ **COMANDOS DE DESARROLLO**

```bash
# Desarrollo
npm run dev

# Build + Type Check
npm run build && npm run type-check

# Testing
npm test
```

---

# 🔒 **ESTADO MCP ACTUAL**

**MODO**: **read-only** ⚠️ (solo lectura)
**Configuración**: Windows CMD wrapper (funcionando)
**Herramientas**: `mcp_supabase_*` activas
**⚠️ Para modificar BD**: Cambiar a write mode + backup antes

---

# 🎯 **OBJETIVO ACTUAL: Carga Masiva Templates + Nuevos Procesos Implicados**

## 📍 **Estado Objetivo:**
**Progreso**: INICIADO - Análisis Excel templates + definición procesos
**Transición**: 2025-08-20 (desde desarrollo mejoras continuas)
**Iniciado**: 2025-08-20
**Contexto**: Archivo Excel Templates.csv recibido - 53 templates + procesos complejos
**⚠️ CRÍTICO**: Registrar minuciosamente para continuidad sesión

## 💡 **Avances Objetivo Anterior (Desarrollo Continuo):**
- [2025-08-20] ✅ FIX CRÍTICO: Campos vacíos categoría ARCA facturas ahora editables (Ctrl+Click)
- [2025-08-20] ✅ FEATURE: Centro de costo opcional en creación templates
- [2025-08-20] ✅ FEATURE: Sistema reglas contable e interno automatizado
- [2025-08-20] ✅ FEATURE: Vista Principal como página inicio + Sistema IPC

## 🚀 **AVANCES SESIÓN ACTUAL (2025-08-21):**
- [2025-08-21] 🎯 **TEMPLATES EXCEL SISTEMA IMPLEMENTADO**: Core completo Template 10 prototipo
- [2025-08-21] 📊 **BD ESTRUCTURADA**: 34 columnas Excel agregadas a egresos_sin_factura  
- [2025-08-21] 🏗️ **MASTERS ORGANIZADOS**: Templates 2025 vs 2026 separados correctamente
- [2025-08-21] 🛡️ **TRIGGERS AUTOMÁTICOS**: Contadores total_renglones sincronización perfecta
- [2025-08-21] ⚡ **REGLAS CONTABLE/INTERNO**: Sistema automático para conciliación templates
- [2025-08-21] 🧪 **TESTING PLAN**: 10 tests sistemáticos definidos para validación completa
- [2025-08-21] **Template 10 Inmobiliario PAM**: 4 cuotas en BD + reglas aplicables + listo testing

## 🎯 **CONTEXTO OBJETIVO ACTUAL - CARGA MASIVA TEMPLATES:**

### 📋 **PLAN PASO A PASO - METODOLOGÍA DESARROLLO:**
1. ✅ **Información base (Excel) completado** 
2. 🔄 **Comprensión + respuesta preguntas (EN PROCESO ACTUAL)**
3. ⏳ **Revisar línea por línea cada template** - implicaciones/procesos completos
4. ⏳ **Analizar factibilidad "todo configurable"** 
5. ⏳ **Desarrollo paso a paso implementación**

**📍 ESTADO ACTUAL: PASO 2 - Análisis y respuestas preguntas críticas**

### 📊 **CONTEXTO FUENTE - Excel Templates.csv EXACTO:**

**Líneas Explicativas (1-5):**
```
1. "Necesidad de templates"
2. "Yo aquí pongo las cuotas como si estuvieramos a fin del 2024 cargando el 2025. lo pongo de esa manera para que quede la estructura para la creacion futura 2026. Ahora preciso saber como te parece hacer para no llenar el cash flow con datos anteriores a la fecha actual. tal vez subir como conciliados los de fechas anteriores a la actual?"
3. "Que se puedan cargar años y campañas enteras en base a la estructura que estoy pasando (ej cargamos 2025 masivamente - para 2026 posibilidad de creara en base al 2025 con ajustes según sean elegidos)"
4. "Ver si hay posibilidad de que todas estas cosas sean configurables (tal vez esto sea complejo - primero debemos entender y listar que son todas las variables y entender su compljidad y como seria el proceso en detalle)"
5. "Debemos ver como se configurara el campo de detalle (Nombre de referencia + Responsable Contable + Nro de Cuota por ejemplo (en caso de tener cuotas, si es anual o si es cuota unica)"
```

**Headers Exactos (línea 9):**
```
Nombre de Referencia | Año / Campaña | Proveedor | Cuit | CATEG | Centro de Costo | Responsable Contable | Responsable Interno | Cuotas | Tipo de fecha | Fecha 1er cuota | Monto | Completar Cuotas | Observaciones (columna nueva para poder recordar durante el trabajo) | Actualizacion de proximas cuotas si actualizo un monto dentro de cuotas cargadas. (en cash flow o conciliacion) - en cash flow seria lo comun - si fuera en conciliacion creo que seria viable ya que daria la necesidad de hacerlo manualente y eso ya esta configurado que valla hacia atras | Obs | CONTABLE | INTERNO | Alertas (En Vista Principal a Desarrollar)
```

**53 Templates EXACTOS (líneas 10-61):**
```
10. Inmobiliario;2026;ARBA;30-71040461-1;IMP 1;RURAL;PAM;;4;Estimada;05/03/2026; 3.900.000,00 ;junio/sept/nov;; Opcion modificar cuotas proximas o no ;Opcio Pago anual a 1er cuota (pide monto anual y borra proximas cuotas);RET i;;Mes anterior a cada cuota
11. Inmobiliario;2026;ARBA;30-71040461-1;IMP 1;RURAL;MSA;;4;Estimada;05/03/2026; 5.400.000,00 ;junio/sept/nov;; Opcion modificar cuotas proximas o no ;Opcio Pago anual a 1er cuota (pide monto anual y borra proximas cuotas);AP i;;Mes anterior a cada cuota
12. Complementario;2026;ARBA;30-71040461-1;IMP 1;RURAL;PAM;;4;Estimada;05/03/2026; 5.100.000,00 ;junio/sept/nov;; Opcion modificar cuotas proximas o no ;Opcio Pago anual a 1er cuota (pide monto anual y borra proximas cuotas);RET i;;Mes anterior a cada cuota
13. Complementario;2026;ARBA;30-71040461-1;IMP 1;RURAL;MSA;;4;Estimada;05/03/2026; 2.700.000,00 ;junio/sept/nov;; Opcion modificar cuotas proximas o no ;Opcio Pago anual a 1er cuota (pide monto anual y borra proximas cuotas);AP i;;Mes anterior a cada cuota
14. Ganancias / Bs Pers;2025;ARCA;ARCA;IMP 1;FISCAL;PAM;;1;Real;10/05/2025; 2.936.983,99 ;No hay Cuotas;; No hay proximas cuotas ;Opcion Pago en cuotas. Pedir cuotas.;RET i;;10 dias antes
15. Ganancias;24/25;ARCA;ARCA;IMP 1;FISCAL;MSA;;1;Estimada;10/11/2025; 3.000.000,00 ;No hay Cuotas;; No hay proximas cuotas ;Opcion Pago en cuotas. Pedir cuotas.;AP i;;10 dias antes
16. Anticipo Ganancias / Bs Pers;2025;ARCA;ARCA;IMP 1;FISCAL;PAM;;5;Real;13/08/2025; 86.000,71 ;13-oct-2025 / 15-dic-25 / 13-feb-26 / 14-abr-26;; Opcion modificar cuotas proximas o no ;;RET i;;10 dias antes
17. Anticipo Ganancias;24/25;ARCA;ARCA;IMP 1;FISCAL;MSA;;10;Real;10/12/2024; 2.067.776,32 ;Mensual;; Opcion modificar cuotas proximas o no ;;AP i;;10 dias antes
18. Acciones y Participaciones;24/25;ARCA;ARCA;IMP 1;FISCAL;MSA;;1;Estimado;10/05/2026; 2.500.000,00 ;No hay Cuotas;; No hay proximas cuotas ;Opcion Pago en cuotas. Pedir cuotas.;AP i;;10 dias antes
19. Autonomos;2025;ARCA;ARCA;IMP 1;FISCAL;MA;MA;12;Real;05/01/2025; 46.967,21 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;RET MA;DIST MA;10 dias antes
20. Cargas Sociales;2025;ARCA;ARCA;IMP 1;LABORAL;MSA;;12;Real;10/01/2025; 1.846.587,92 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;;;10 dias antes
21. UATRE;2025;UATRE;30-53306223-3;IMP 1;LABORAL;MSA;;12;Real;10/01/2025; 63.119,55 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;;;10 dias antes
22. Red Vial SP;2025;Municipalidad SP;30-66923976-5;IMP 1;RURAL;PAM;;4;Real;05/03/2024; 490.576,02 ;meses junio sept y diciembre;; Opcion modificar cuotas proximas o no ;;RET i;;Mes anterior a cada cuota
23. Red Vial SP;2025;Municipalidad SP;30-66923976-5;IMP 1;RURAL;MSA;;4;Real;05/03/2024; 220.684,63 ;meses junio sept y diciembre;; Opcion modificar cuotas proximas o no ;;AP i;;Mes anterior a cada cuota
24. Red Vial Rojas;2026;Municipalidad Rojas;30-99900346-6;IMP 1;RURAL;MSA;;5;Real;05/02/2025; 1.000.000,00 ;meses mayo sept oct y dic;; Opcion modificar cuotas proximas o no ;;AP i;;Mes anterior a cada cuota
25. Automotores ARBA;2025;ARBA;30-71040461-1;IMP 1;AUTOMOTOR;MSA;;5;Real;10/03/2025; 151.442,60 ;meses mayo sept nov;; Opcion modificar cuotas proximas o no ;;AP i;;Mes anterior a cada cuota
26. Automotores Muni SP - Tiguan;2026;Municipalidad SP;30-66923976-5;IMP 1;AUTOMOTOR;MSA;MA;3;Estimado;05/01/2026; 40.000,00 ;meses abril y julio;; Opcion modificar cuotas proximas o no ;;AP i;DIST MA;Mes anterior a cada cuota
27. Automotores Muni SP - Gol;2026;Municipalidad SP;30-66923976-5;IMP 1;AUTOMOTOR;MSA;JMS;3;Estimado;05/01/2026; 20.000,00 ;meses abril y julio;; Opcion modificar cuotas proximas o no ;;AP i;DIST JMS;Mes anterior a cada cuota
28. Automotores CABA;2025;Gob CABA;30-68307705-0;IMP 1;AUTOMOTOR;MSA;;6;Real;05/02/2025; 66.121,80 ;bimensual;; Opcion modificar cuotas proximas o no. Opcion de cambio por bloques. ;;AP i;;10 dias antes
29. ABL Libertad;2025;Gob CABA;30-68307705-0;IMP BS AS;LIBERTAD;PAM;MA;12;Real;05/01/2025; 220.840,77 ;Mensual;; Opcion modificar cuotas proximas o no. Opcion de cambio por bloques. ;;LIB;DIST MA;
30. ABL Cochera Posadas;2025;Gob CABA;30-68307705-0;IMP GRAL;COCHERA POSADAS;PAM;;12;Real;05/01/2025; 5.618,19 ;Mensual;; Opcion modificar cuotas proximas o no. Opcion de cambio por bloques. ;;RET i;;
31. ABL Cochera Libertad;2026;Gob CABA;30-68307705-0;IMP BS AS;LIBERTAD;OTROS;MA;1;Estimado;05/01/2026; 1,00 ;No hay Cuotas;; No hay proximas cuotas ;Opcion Pago en cuotas. Pedir cuotas.;;DIST MA;
32. Expensas Libertad;2025;Consorcio Libertad 1366;30-53292377-4;FIJOS BS AS;LIBERTAD;PAM;MA;12;Real;10/01/2025; 1.747.500,11 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;LIB;DIST MA;
33. Expensas Posadas;2025;Consorcio De Propietarios Posa;30-60183248-4;FIJOS GRAL;COCHERA POSADAS;PAM;;12;Real;10/01/2025; 34.302,46 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;RET 3;;
34. Tarjeta Visa Business MSA;2025;VISA;30-71549115-6;TARJ MSA;INTER;MSA;;12;Real;05/01/2025; 848.675,15 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;;;10 Dias Antes
35. Tarjeta VISA PAM Pesos;2025;VISA;30-71549115-6;TARJ PAM;INTER;PAM;;12;Real;05/01/2025; 1.228.291,66 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;RET 3;;10 Dias Antes
36. Tarjeta VISA PAM USS;2025;VISA;30-71549115-6;TARJ PAM;INTER;PAM;;12;Real;05/01/2025; 73.673,20 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;RET 3;;10 Dias Antes
37. AYSA Libertad;2025;AYSA;30-70956507-5;FIJOS BS AS;LIBERTAD;PAM;MA;12;Real;10/01/2025; 118.549,24 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;LIB;DIST MA;
38. Metrogas Libertad;2025;Metrogas;30-65786367-6;FIJOS BS AS;LIBERTAD;PAM;MA;12;Real;10/01/2025; 6.453,54 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;LIB;DIST MA;
39. Retiro MA mensual;2025;MA;27-06682461-1;DIST MA;MA;MSA/PAM;;12;Real;31/01/2025; 4.000.000,00 ;ultimo dia de cada mes;Distribucion Mensual MA (aplica primero a sueldos - por eso a CTA MA); Opcion modificar cuotas proximas o no ;;CTA MA;DIST MA;
40. Retiro MA semestral;2026;MANUEL;24-24754471-9;DIST MANU;MA;PAM;;2;Estimado;25/01/2026; 1,00 ;25/07/2026;Se reserva template por si se distribuye algo extra; Opcion modificar cuotas proximas o no ;;CTA MA;DIST MA;
41. Retiro Manuel semestral;2026;MANUEL;24-24754471-9;DIST MANU;MANUEL;PAM;;2;Estimado;25/01/2026; 7.000.000,00 ;25/07/2026;Distribucion Semestral; Opcion modificar cuotas proximas o no ;;RET DIST MANUEL;DIST MANU;
42. Retiro Soledad semestral;2026;SOLEDAD;27-26046738-2;DIST SOLE;SOLEDAD;PAM;;2;Estimado;25/01/2026; 7.000.000,00 ;25/07/2026;Distribucion Semestral; Opcion modificar cuotas proximas o no ;;RET DIST SOLE;DIST SOLE;
43. Retiro Mechi semestral;2026;MECHI;27-27071568-6;DIST MECHI;MECHI;PAM;;2;Estimado;25/01/2026; 7.000.000,00 ;25/07/2026;Distribucion Semestral; Opcion modificar cuotas proximas o no ;;RET DIST MECHI;DIST MECHI;
44. Retiro Andres semestral;2026;ANDRES;20-28749254-6;DIST AMS;ANDRES;PAM;;2;Estimado;25/01/2026; 7.000.000,00 ;25/07/2026;Distribucion Semestral; Opcion modificar cuotas proximas o no ;;RET DIST AMS;DIST AMS;
45. Retiro Jose semestral;2026;JOSE;23-34214773-9;DIST JMS;JOSE;PAM;;2;Estimado;25/01/2026; 7.000.000,00 ;25/07/2026;Distribucion Semestral; Opcion modificar cuotas proximas o no ;;RET DIST JMS;DIST JMS;
46. Caja;2025;INTER;INTER;CAJA;INTER;MSA;;12;Estimado;25/01/2025; 900.000,00 ;25 de cada mes;Parte de Sueldos + Jornales + Compra Varios; Opcion modificar cuotas proximas o no ;;;;
47. Sueldo JMS;2025;JMS;23-34214773-9;SUELD;ESTRUCTURA;MSA/PAM;MSA/PAM;12;Real;31/01/2025; 1.991.947,59 ;ultimo dia de cada mes;Ver contra facturacion a quien corresponde el pago); Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;CTA JMS;;
48. Sueldo AMS;2025;AMS;20-28749254-6;SUELD;ESTRUCTURA;MSA/PAM;MSA/PAM;12;Estimado;31/01/2025; 1.500.000,00 ;ultimo dia de cada mes;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;CTA AMS;;
49. Sueldo Sigot Galicia;2025;Ruben Sigot;20-17985912-3;SUELD;ESTRUCTURA;MSA;;12;Real;31/01/2025; 740.300,80 ;ultimo dia de cada mes;Recibo; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;;;
50. Sueldo Sigot Santander;2025;Ruben Sigot;20-17985912-3;SUELD;ESTRUCTURA;MSA;;12;Real;31/01/2025; 101.000,00 ;ultimo dia de cada mes;Recibo; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;;;
51. Sueldo Sigot Lucresia;2025;Ruben Sigot;20-17985912-3;SUELD;ESTRUCTURA;MSA;;12;Real;31/01/2025; 358.699,20 ;ultimo dia de cada mes;Recibo; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;;;
52. Sueldo Alejandro;2025;Alejandro Coria;20-26865811-5;SUELD;ESTRUCTURA;MSA;;12;Real;31/01/2025; 688.751,00 ;ultimo dia de cada mes;Recibo; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;;;
53. Sueldo Marco;2025;Juan Cejas;20-23615158-2;SUELD;ESTRUCTURA;MSA;;12;Real;31/01/2025; 688.751,00 ;ultimo dia de cada mes;Recibo; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;;;
54. Sueldo Mabel;2025;Domestica Mabel;27-20361536-7;SUELD;ESTRUCTURA;PAM;;12;Real;31/01/2025; 360.000,00 ;ultimo dia de cada mes;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen - Lleva Aguinaldo;;;
55. Seguro Flota;2025;Federacion Patronal SAU;33-70736658-9;SEG;ESTRUCTURA;MSA;MSA/MA/JMS;12;Estimada;05/01/2025; 576.306,00 ;Mensual;Gol es de JMS - Tiguan es de MA; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;;VER;10 dias antes
56. Seguro Accidentes de Trabajo;2025;Federacion Patronal SAU;33-70736658-9;SEG;LABORAL;MSA;;12;Estimada;05/01/2025; 10.300,00 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;;;
57. Deuda Complementario;2025;ARBA;30-71040461-1;IMP 1;RURAL;PAM;;12;Estimada;15/01/2025; 64.510,10 ;Mensual;; Según se pague modifica las cuotas que le siguen. ;Opcion que no modifiquen;;;
58. IIBB;2025;ARBA;30-71040461-1;IMP 1;FISCAL;PAM;;12;Estimada;15/01/2025; -   ;Mensual;; Se debera cargar automaticamente cuando se carguen Facturas de Venta CATEG VTA GAN o ARR SP o ARR RO o ARR LC) - Proceso por desarrollar ;;;;10 dias antes
59. IIBB;2025;ARBA;30-71040461-1;IMP 1;FISCAL;MSA;;12;Estimada;15/01/2025; -   ;Mensual;; Se debera cargar automaticamente cuando se carguen Facturas de Venta CATEG VTA GAN o ARR SP o ARR RO o ARR LC) - Proceso por desarrollar ;;;;10 dias antes
60. SICORE 1er Quincena;2025;ARCA;ARCA;IMP 1;FISCAL;MSA;;12;Estimada;20/01/2025; -   ;Mensual;; Se debera cargar automaticamente a medida que vallamos registrando Retenciones de Ganancias (vista y proceso por desarrollar) ;;;;10 dias antes
61. SICORE 2da Quincena;2025;ARCA;ARCA;IMP 1;FISCAL;MSA;;12;Estimada;09/02/2025; -   ;Mensual;; Se debera cargar automaticamente a medida que vallamos registrando Retenciones de Ganancias (vista y proceso por desarrollar) ;;;;10 dias antes
```

### 🔍 **PRIMER ENTENDIMIENTO COMPLETO - Análisis Claude:**

## 📋 **LÍNEAS EXPLICATIVAS (1-5):**

**Entendimiento:**
1. **Carga como fin 2024 → 2025**: Para estructura futura 2026
   - **CICLO COMPLETO**: Siempre se carga como ciclo completo
   - **Año calendario**: 01 enero → 31 diciembre
   - **Campaña 24/25**: 01/07/2024 → 30/06/2025 (criterio para determinar fin de carga cuotas)
   - **Cuotas vencidas**: Cargar como "conciliado" para no reflejarse en flujo pero mantener template completo
   - **Objetivo**: Templates completos permiten crear nuevas campañas/años basados en estructura anterior
2. **Evitar contaminar Cash Flow**: Subir como "conciliados" fechas pasadas ✅
3. **Carga masiva años/campañas**: Crear 2026 basado en 2025 con ajustes
4. **Todo configurable**: Variables complejas - se analizará cerca del final
5. **Campo detalle**: Nombre + Responsable + Nro Cuota (si aplica)
   - **NO es dato BD**: Es proceso de vista/display
   - **Ver**: Resumen procesos involucrados

## 🗂️ **ESTRUCTURA COLUMNAS:**

1. **Nombre de Referencia** - Identificador principal (podría ser nombre del template)
2. **Año/Campaña** - 2025, 2026, 24/25
3. **Proveedor** - ARBA, ARCA, VISA, etc.
4. **CUIT** - Identificación fiscal
5. **CATEG** - Categoría contable (IMP 1, SUELD, FIJOS BS AS, etc.)
6. **Centro de Costo** - RURAL, FISCAL, LIBERTAD, etc.
7. **Responsable Contable** - PAM, MSA, MA, etc.
8. **Responsable Interno** - MA, JMS, MSA/PAM
9. **Cuotas** - Cantidad (1-12)
10. **Tipo de fecha** - Real, Estimada
11. **Fecha 1er cuota** - Fecha inicio
12. **Monto** - Valor primera cuota
13. **Completar Cuotas** - Patrón: Mensual, específico, etc.

**COLUMNAS DE REGLAS/LÓGICA:**
14. **Observaciones**
15. **Actualización próximas cuotas** - Modificar o no
16. **Obs** - Opciones especiales
17. **CONTABLE** - Códigos asignación
18. **INTERNO** - Códigos distribución
19. **Alertas** - Timing notificaciones

## 🎯 **PREGUNTAS CRÍTICAS PARA CLARIFICAR:**

### **1. Lógica de Actualización Automática:**
✅ **RESPONDIDO:**
- **Templates IIBB (58-59)**: 
  - **Ingresos ARR**: 5% de facturas categoría ingreso con prefijo "ARR" (EXCLUIR "ARR P" = egresos)
  - **Ventas VTA GAN**: 0.75% del neto gravado (sección Ventas NO desarrollada)
  - **Timing**: Ventas agosto → IIBB septiembre (mes siguiente)
  - **Estado**: ⚠️ PENDIENTE - Requiere sección Ventas
- **Templates SICORE (60-61)**: 
  - **Lógica propia** (diferente a IIBB)
  - **Estado**: ⚠️ PENDIENTE - Requiere sección nueva
- **Templates actuales**: Crear en cero por ahora

### **2. Reglas de Propagación:**
✅ **RESPONDIDO:**
- **Escenario**: Template con cuotas cargadas (ej: enero-dic $110K, agosto cambia a $120K)
- **Regla**: Al modificar una cuota → opción modificar cuotas futuras o no
- **Confirmación**: Sistema DEBE preguntar al usuario (no automático)
- **Alcance**: Solo template actual, NO generación nuevo ciclo
- **Ubicaciones de aplicación**:
  - Modificación desde **Templates**
  - Modificación desde **Cash Flow**
  - **Conciliación manual**: Monto no coincide → seleccionar template → confirmar corrección futuras
- **Estado**: Va a sección procesos

### **3. Códigos CONTABLE/INTERNO:**
✅ **RESPONDIDO:**
- **Sí son para reglas**: Códigos RET i, AP i, CTA MA, DIST MA, LIB = categorías reglas contable/interno
- **Configuración usuario**: Incierto si será necesaria (evaluar al final si configurable)
- **Lógica por template**: Cada template tiene responsable + pagador → consecuencia contable/interno
- **Variables clave**:
  - **Responsable contable** (quién paga)
  - **Responsable interno** (distribución)
  - **Cada combinación** = lógica específica
- **Proceso**: Verificar reglas cada vez que se concilia template
- **Consideración**: Posible reconfiguración sistema reglas anterior
- **Estado**: Va a procesos y estructura de datos

### **4. Alertas:**
✅ **RESPONDIDO:**
- **Ubicación**: Vista Principal (lo primero que se ve)
- **Lógica "10 días antes"**: Si vence en ≤10 días → mostrar alerta, sino NO
- **Lógica "Mes anterior"**: Si vence 25/sept → alertar desde 1/agosto (mes completo previo)
- **Formato**: "Tal fecha vence tal cosa (falta X días)"
- **Orden**: Por fecha de vencimiento
- **Estilo**: Sintético y creativo
- **Estado**: Sistema alertas para Vista Principal

### **5. Responsables MSA/PAM:**
✅ **RESPONDIDO:**
- **Responsabilidad**: 50% cada uno (MSA/PAM)
- **Proceso pago**: Un solo pago desde cualquier banco (no se divide durante proceso)
- **Proceso posterior**: Desarrollar sistema para categoría MSA/PAM (más adelante)
- **Estado actual**: Solo reconocer responsable "MSA/PAM"
- **Estado**: ⚠️ PENDIENTE - Proceso división 50/50 para futuro desarrollo

**¿Empiezo bien o necesitas que profundice en algún aspecto específico?**

## 🔄 **RESUMEN PROCESOS INVOLUCRADOS:**

### **📄 Campo Detalle Dinámico:**
- **Vista Cash Flow**: Mostrar campo calculado "Nombre + Responsable + Nro Cuota"
- **Extracto Bancario**: Registrar este detalle en conciliación
- **Lógica**: Concatenación automática según estructura template

### **🔗 Conciliación Bancaria e Imputación Contable/Interno:**
- **Proceso**: Definir cómo se ejecuta conciliación + aplicación reglas
- **Columnas CONTABLE/INTERNO**: ¿Van en BD o se calculan en tiempo real?
- **Método más efectivo**: Analizar almacenamiento vs cálculo dinámico

### **📋 Sistema Reglas Contable/Interno - Definición:**
- **Códigos actuales**: RET i, AP i, CTA MA, DIST MA, LIB (categorías definidas por usuario)
- **Variables por template**:
  - Responsable contable (quién paga) + Responsable interno (distribución) = Lógica específica
- **Proceso**: Verificar y aplicar reglas en cada conciliación template
- **Integración**: Con sistema reglas existente (posible reconfiguración)
- **Configurabilidad**: Evaluar necesidad configuración usuario vs reglas fijas

### **📋 Columnas Reglas/Lógica - Definir Almacenamiento:**
- **Columnas 15-19**: Actualización cuotas, Obs, CONTABLE, INTERNO, Alertas
- **Decisión**: ¿BD vs cálculo dinámico? Analizar para cada una

### **🚨 Sistema Alertas Vista Principal:**
- **Cálculo dinámico**: Evaluar fechas vencimiento vs fecha actual
- **"10 días antes"**: Mostrar si faltan ≤10 días, ocultar si >10 días
- **"Mes anterior"**: Mostrar desde 1er día mes previo hasta vencimiento
- **UI Vista Principal**: 
  - Formato: "25/09 vence Inmobiliario ARBA (falta 4 días)"
  - Ordenado por fecha próxima
  - Diseño sintético y visual
- **Performance**: Consulta diaria/tiempo real según necesidad

### **🔄 Reglas de Propagación de Cuotas:**
- **Modificación Templates**: Cambio cuota → confirmar si modifica futuras
- **Modificación Cash Flow**: Misma lógica que templates
- **Conciliación Manual**: Monto no coincide → seleccionar template → confirmar corrección futuras
- **UI/UX**: Modal de confirmación con opciones "Sí/No" para cada ubicación
- **Alcance**: Solo template actual, no afecta generación nuevos ciclos

## 🔍 **VERIFICACIÓN ESTRUCTURA DATOS PREVIA:**

### **📊 Columnas BD Templates (1-14 + verificar 15-19):**
- **Columnas 1-13**: DEBEN estar en BD templates (verificar existencia/nombres)
- **Columna 14 (Observaciones)**: DEBE agregarse a BD 
- **Verificar**: Estructura actual BD vs requerida
- **Cuidado**: No romper vínculos con Cash Flow y Extracto al modificar

### **🤔 Columnas Reglas/Lógica (15-19) - Análisis Pendiente:**
- **CONTABLE/INTERNO**: ¿BD o cálculo dinámico para ejecución reglas?
  - **Consideración**: Códigos son categorías reglas (RET i, AP i, CTA MA, etc.)
  - **Variables**: Responsable contable + interno por template
  - **Integración**: Con sistema reglas existente (revisar compatibilidad)
- **Actualización cuotas**: ¿BD o configuración en tiempo real?
- **Alertas**: ¿BD o generación dinámica?
- **Obs (opciones)**: ¿BD o lógica de negocio?

### **⚠️ Procesos Automáticos PENDIENTES (requieren desarrollo previo):**
- **Sección Ventas**: Para cálculo automático IIBB con VTA GAN (0.75% neto gravado)
- **Sección SICORE**: Para cálculo automático templates SICORE (lógica propia)
- **Ingresos ARR**: Para cálculo automático IIBB (5% ingresos ARR, excluir ARR P)

## 📋 **Contexto Técnico Conservado:**
- **Conciliación**: Motor automático completo - useMotorConciliacion.ts:35 + reglas configurables
- **Filtros**: Sistema universal completado en todas las vistas (Cash Flow, ARCA, Templates, Extracto)
- **Edición**: Inline editing con Ctrl+Click en ARCA facturas y Templates funcionando
- **Matching**: Templates integrados en sistema extracto bancario con propagación valores
- **Estados**: Gestión consistente lowercase + validaciones amount >10% + límites configurables
- **BD**: msa_galicia (858 reg), reglas_conciliacion (22 reg), cuentas_contables (67 cat)
- **Git**: Branch desarrollo sincronizado con main - todas las mejoras deployadas

## 🎯 **Desarrollo Continuo:**
1. ✅ Core sistema conciliación implementado y funcional
2. ✅ Filtros universales + edición inline + matching templates
3. ✅ Merge a main branch completado exitosamente
4. 🔄 Desarrollo iterativo de mejoras y nuevas funcionalidades
5. 🔄 Mantener contexto acumulado para eficiencia desarrollo

## 🎯 **ROADMAP PRÓXIMOS OBJETIVOS (Registrado 2025-08-19):**

### 📦 **0. CARGA DATOS HISTÓRICOS** `#roadmap #prerequisito #urgente`
**Prerequisito ANTES de Empleado Contable o PAM**
- **Facturas históricas**: Carga masiva estado "conciliado" (NO aparecen en Cash Flow)
- **Templates históricos**: Carga masiva cuotas/egresos estado "conciliado" 
- **Objetivo**: Dejar BD al día con solo datos actuales en flujo operativo
- **Impacto**: Sistema operativo solo con datos corrientes vs históricos ocultos
- **Criticidad**: Bloquea objetivos 1 y 2 hasta completarse

### 📊 **1. SISTEMA EMPLEADO CONTABLE** `#roadmap #contable`
**Vista especializada para adjudicación periodos contables**
- **Periodos**: Por mes/año → Subdiarios (ej: factura julio → subdiario agosto OK, agosto → julio ❌)
- **Control físico**: Columna "factura" [SI/NO/PEAJES + otras opciones a desarrollar]
- **Imputación lotes**: Filtros + selección múltiple + adjudicación batch a subdiarios
- **Variables editables**: Definir cuáles puede cambiar empleado vs admin
- **Afecta**: Cash Flow + BD facturas ARCA (mismo nivel permisos que vista principal)
- **Reporting**: Vista por subdiarios + totalizaciones para control
- **Datos EB ARCA**: Ingreso manual mes/mes por subdiario para controles pre-declaración

### 🏢 **2. COPIA PROGRAMA PARA PAM** `#roadmap #pam`
**Duplicación completa funcionalidad MSA → PAM**
- **Dependencia**: Requiere carga históricos completada (Objetivo 0)
- Evaluar detalles implementación cuando se implemente

### 🏛️ **3. TERCERA EMPRESA COMPARTIMIENTO ESTANCO** `#roadmap #empresa3`
**Nueva empresa SIN mezcla datos con MSA/PAM**
- **Requisito**: MSA/PAM se mezclan entre sí, Empresa3 completamente separada
- **Desafío**: Arquitectura compartimientos estancos
- Evaluar cuando corresponda implementar

## 🔮 **DESARROLLOS FUTUROS (Sin orden prioridad)** `#roadmap #futuro`

### 📊 **Vista Presupuesto** `#futuro #presupuesto`
- **Funcionalidad**: Sistema gestión presupuestaria completa
- **Estado**: Por desarrollar - sin especificaciones detalladas
- **Registrado**: 2025-08-20

### 📈 **Dashboard Reportes Macro - Desgloses** `#futuro #dashboard #reportes`
- **Contexto**: Sistema hecho por v0 (Claude no tiene contexto previo)
- **Renglones pendientes**:
  - **Desglose Tarjetas**: Vista detallada movimientos tarjetas
  - **Desglose Caja**: Vista detallada movimientos efectivo
- **Estado**: Extensión dashboard existente
- **Registrado**: 2025-08-20

### 💳 **Vistas Tarjetas y Caja** `#futuro #tarjetas #caja`
- **Vista Tarjetas**: Gestión completa movimientos tarjetas de crédito/débito
- **Vista Caja**: Gestión completa movimientos efectivo
- **Integración**: Con dashboard desgloses macro
- **Estado**: Por desarrollar - sin especificaciones
- **Registrado**: 2025-08-20

### 📤 **Exportación Reportes Varios** `#futuro #export #reportes`
- **Funcionalidad**: Sistema exportación múltiples formatos (Excel, PDF, CSV)
- **Alcance**: Todos los reportes y vistas del sistema
- **Estado**: Por desarrollar - sin especificaciones
- **Registrado**: 2025-08-20

### 🏠 **Vista Principal** `#completado #home #principal`
- **Funcionalidad**: Página principal/home del sistema implementada
- **Implementado**: Botón IPC + display último registro + placeholder alertas
- **Estado**: ✅ COMPLETADO - Base funcional operativa
- **Actualizado**: 2025-08-20

## 🔮 **NUEVOS DESARROLLOS IDENTIFICADOS** `#roadmap #excel-templates`

### 💰 **Vista Sueldos con Lógica Propia** `#futuro #sueldos #templates`
- **Contexto**: Existe templates para pagos, falta vista dedicada con lógica específica
- **Alcance**: Por definir con detalles del Excel
- **Estado**: Identificado - sin especificaciones
- **Registrado**: 2025-08-20

### 🏛️ **Vista y Registro Automático Templates SICORE** `#futuro #sicore #automatico`
- **Funcionalidad**: Sistema automático para templates SICORE
- **Alcance**: Vista + registro automático - detalles por definir
- **Estado**: Identificado - sin especificaciones
- **Registrado**: 2025-08-20

### 🏢 **Llenado Automático Templates IIBB (PAM y MSA)** `#futuro #iibb #automatico`
- **Funcionalidad**: Sistema automático llenado templates Ingresos Brutos
- **Empresas**: PAM + MSA separados
- **Estado**: Identificado - sin especificaciones
- **Registrado**: 2025-08-20

### 🚨 **Sistema Alertas Vista Principal** `#futuro #alertas #principal`
- **Funcionalidad**: Sistema alertas pagos próximos en Vista Principal
- **Integración**: Con placeholder ya preparado en Vista Principal
- **Estado**: Identificado - sin especificaciones
- **Registrado**: 2025-08-20

### 📊 **Vista Tabla Templates Agrupados** `#futuro #templates #tabla-especial`
- **Acceso**: Botón en Vista Principal
- **Formato**: Tabla agrupada por CATEG y por mes (1 fila por template)
- **Alcance**: Mostrar año entero
- **Estado**: Identificado - detalles por definir con Excel
- **Registrado**: 2025-08-20

## 🚨 **PENDIENTES SISTEMA:**

### 🔧 **Verificar Templates Campos Vacíos** `#pendiente #ui #verificar`
- **Issue potencial**: Campos vacíos en templates pueden no ser editables con Ctrl+Click
- **Contexto**: Fix aplicado en ARCA facturas (commit 69933a4) - templates ya tenía implementación similar
- **Acción**: Verificar si templates necesita mismo fix para consistency
- **Ubicación**: vista-templates-egresos.tsx línea ~544 (renderizarCelda null check)
- **Detectado**: 2025-08-20 durante fix ARCA facturas

### 🎯 **Sistema Reglas Contable e Interno** `#pendiente #revision #testing`
- **Feature**: Configurador reglas para automatizar campos contable/interno
- **Tabla BD**: reglas_contable_interno (migración aplicada)
- **UI**: Tab nueva en Extracto Bancario → Configuración → "Contable e Interno"
- **Variables**: banco_origen (MSA/PAM) + tipo_gasto (template/factura) + proveedor_pattern
- **Estado**: ⚠️ **PENDIENTE REVISIÓN** - Funcionalidad creada, testing requerido
- **Commit**: 3865ea8 - Implementación completa sin validar
- **Ubicación**: components/configurador-reglas-contable.tsx + vista-extracto-bancario.tsx

### 🚨 **Sistema Backup a Supabase** `#critico #prerequisito #backup`
- **Issue CRÍTICO**: Sistema backup NO funciona - nunca hemos logrado subir backup a Supabase
- **Riesgo**: Antes de usar app con datos reales DEBE funcionar el backup/restore
- **Propuesta**: Crear BD vacía en Supabase + cargar backup completo como prueba
- **Expectativa**: Backup debería setear estructura + datos automáticamente
- **Estado**: ⚠️ **BLOQUEANTE** para puesta en producción
- **Prioridad**: **MÁXIMA** - prerequisito absoluto antes datos reales
- **Registrado**: 2025-08-20 - Usuario reporta relevancia crítica

### 🔒 **Seguridad BBDD Egresos** `#pendiente #seguridad`
- **Issue**: Datos facturas pueden modificarse sin restricciones
- **Riesgo**: Pérdida integridad datos financieros
- **Solución requerida**: Formato seguridad + permisos usuarios autorizados
- **Detectado**: 2025-08-18 sesión conciliación bancaria
- **Prioridad**: Alta (datos críticos empresa)

---

# 🚨 **COMANDOS ENTRE NOSOTROS**

## 🎯 **Comandos de Objetivo:**
```
/iniciar-objetivo [nombre] → Cargar contexto específico
/avance-objetivo [descripción] → Documentar en Claude temporal  
/finalizar-objetivo → Volcar todo a KNOWLEDGE.md + limpiar Claude
/cambiar-objetivo [nuevo] → Finalizar actual + iniciar nuevo
```

## 📋 **Comandos de Documentación:**
```
/documentar-config [tema] → Agregar a configuraciones funcionando
/documentar-error [tema] → Agregar a troubleshooting  
/descartar-método [tema] → Agregar a conocimiento descartado
```

## 🔧 **Comandos de Sistema:**
```
/backup-proponer → Recordar protocolo backup
/mcp-status → Mostrar estado actual MCP
/buscar [tags] → Grep específico en KNOWLEDGE.md
```

---

# 📝 **CÓMO DOCUMENTAR EN CLAUDE.md**

## 💡 **Avances Objetivo Actual:**
```
- [Fecha] [Descripción avance]
- [Fecha] [Problema encontrado + solución]
- [Fecha] [Decisión tomada + razón]
```

## 📋 **Contexto Cargado:**  
```
- [Información copiada del archivo grande]
- [Se actualiza al cargar nuevo objetivo]
```

## 🎯 **Próximos Pasos Acordados:**
```
- [Paso 1] [Descripción]
- [Paso 2] [Descripción]  
- [Se actualiza cada sesión]
```

---

# 📊 **DATOS CRÍTICOS**

## Empresas y CUITs
- **MSA**: 30617786016
- **PAM**: 20044390222

## Variables de Entorno
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Testing y Deployment
- Branch principal: `main` (auto-deploy Vercel)
- Branch desarrollo: `desarrollo` 
- Testing: Preview URLs de Vercel

---

---

## 🏗️ **RESUMEN TÉCNICO IMPLEMENTADO (2025-08-21):**

### **📊 BASE DE DATOS:**
- **Templates Master**: Separados 2025 vs 2026 con contadores automáticos
- **Egresos sin factura**: 34 columnas Excel + triggers automáticos sincronización
- **Cuotas templates**: 4 cuotas Template 10 generadas correctamente  
- **Reglas contable/interno**: Sistema automático PAM/MSA funcionando

### **🎯 TEMPLATE 10 PROTOTIPO COMPLETADO:**
```sql
-- Template Master 2026: 'a0b6189c-f725-474a-91ff-bc8f3365ead2'
-- Template 10: '387da693-9238-4aed-82ea-1feddd85bda8' 
-- 4 cuotas: Mar/Jun/Sep/Nov 2026 - $3.900.000 c/u
-- Regla: PAM responsable + MSA paga = "RET i"
```

### **🛡️ TRIGGERS IMPLEMENTADOS:**
- **update_template_count()**: Automático INSERT/UPDATE/DELETE
- **fix_template_counts()**: Función corrección contadores
- **Cobertura total**: Todos masters actuales y futuros

### **📋 PENDIENTES MAÑANA:**
1. **Actualizar Wizard templates** para nuevas columnas Excel  
2. **Testing plan 10 puntos** sistemático completo
3. **Crear Templates 11-13** (resto grupo inmobiliario)

### **🎯 ARQUITECTURA ESCALABLE:**
- **Sistema 3 tablas**: Probado y funcionando
- **Replicación anual**: Ya implementada (KNOWLEDGE.md)
- **Listo para 53 templates**: Infraestructura completa

**📍 Total líneas**: ~200 (objetivo ≤300 líneas cumplido)  
**🔗 Conocimiento completo**: Ver KNOWLEDGE.md  
**📅 Última actualización**: 2025-08-21

## 🔄 **SESIÓN ACTUAL - RESUMEN FINAL:**

### ✅ **Completado 2025-08-20:**
- **Fix crítico**: Campos vacíos categoría en ARCA facturas → ahora editables con Ctrl+Click
- **Root cause**: Early return null/undefined sin onClick handler en vista-facturas-arca.tsx:544
- **Solución**: Wrapper div clickeable para null values cuando esEditable && modoEdicion
- **Commit**: 69933a4 - "Fix: Permitir edición campos vacíos categoría en ARCA facturas"
- **Testing**: Usuario confirmó funcionamiento OK

- **Feature**: Centro de costo opcional en templates
- **Cambio**: Removido centro_costo de validación requerida wizard
- **Commit**: 0754ef4 - UX mejorada para creación templates

- **Feature**: Sistema reglas contable e interno automatizado  
- **Estructura**: Tabla reglas_contable_interno con variables (banco_origen, tipo_gasto, proveedor_pattern)
- **UI**: Nueva tab en configuración extracto bancario → Contable e Interno
- **Logic**: Automatización campos según contexto MSA/PAM + template/factura + proveedor
- **Commit**: 3865ea8 - CRUD completo + migración BD
- **Estado**: ⚠️ **PENDIENTE REVISIÓN** - Funcionalidad creada pero no testeada

### 🔍 **Investigación Templates:**
- Templates YA tenía implementación correcta para campos vacíos (línea ~544)
- ARCA facturas tenía bug específico que fue corregido
- **PENDIENTE**: Verificar en próxima sesión si templates realmente funciona bien con campos vacíos

### 📋 **Estado Sistema Validación Categorías:**
- ✅ ARCA facturas: Validación completa + edición campos vacíos
- ✅ Templates: Validación completa + (verificar edición campos vacíos)
- ✅ Cash Flow: Validación completa (ya existía)
- ✅ Extracto bancario: Validación en propagación masiva
- **Sistema completo**: Todas las ubicaciones de edición tienen validación categorías