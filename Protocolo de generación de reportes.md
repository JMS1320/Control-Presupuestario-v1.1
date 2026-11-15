# Protocolo de generación de reportes

Nov 15, 2026 · @Jose

Este protocolo fija cómo se arma un reporte en Excel para socios, contadores u otros terceros. Es un protocolo, no un programa: cada reporte se construye para su caso específico respetando estas reglas.

## Principio rector: el final del reporte es el PDF

*(JMS 15/11/2026)* El reporte se entrega en PDF y en Excel, y los dos importan igual — **pero el producto final es el PDF**. El PDF
no deja ver las fórmulas: un socio que es dueño, que no está metido en el tema, tiene que poder seguirlo solo y **hacer contacto
visual entre el número del detalle y el número del total**. Si el reporte está mal o no se entiende, el socio se lleva un disgusto,
y eso es un problema enorme. Por eso todo se diseña pensando primero en cómo se lee impreso.

*Caso de referencia:* un PDF de 20 hojas, presentado a los socios en una reunión de 2 horas, se siguió completo y los dejó
satisfechos.

**El reporte NO es una tabla maestra.** Las tablas grandes con filtros (el libro diario, el maestro de templates, los papeles
actuales) siguen existiendo y son necesarias: son la base de datos. El reporte es **otro producto**, con otro formato: en él, ningún
número se encuentra filtrando — está a la vista, al lado de las partes que lo forman.

## Principio central: números encadenados

**Todo número del reporte se conforma de otros números que están a la vista en el nivel siguiente, hasta llegar al registro de origen.** El lector parte del número final, baja nivel por nivel y puede tildar cada paso.

Ejemplo: el resultado del año de una empresa.

1. **Número final:** resultado del año.
2. **Se conforma de:** ventas menos compras.
3. **Cada uno se conforma de:** sus rubros o conceptos.
4. **Hasta llegar a:** cada factura o cada pago.

De ahí salen las tres ideas que sostienen todo el protocolo:

- **Índice:** una hoja lista los ítems que conforman el número final, numerados.
- **Detalle:** cada ítem tiene su hoja de detalle, donde se ve cómo se llega a su importe.
- **Orden:** las pestañas siguen el orden en que se presenta el reporte, para recorrerlo de corrido en una reunión sin saltar.

Los nombres de hojas e ítems salen de cada caso. Lo que no cambia es el encadenamiento.

## Reglas generales

Aplican a todo reporte, sin importar el tema ni la empresa.

| N° | Regla |
| --- | --- |
| G1 | **Encadenamiento completo.** Todo número que resume otros tiene su detalle. Se usan tantos niveles como haga falta para llegar al registro de origen (factura, pago, movimiento). |
| G2 | **Índice único.** La primera hoja lista los ítems numerados (1, 2, 3…) con su importe. Esa numeración se repite idéntica en todas las hojas, y las sub-partes la heredan (1a, 1b…). No hay índices paralelos. |
| G3 | **Referencia y link al detalle.** Cada ítem indica en qué hoja está su detalle y tiene un link para ir directo ahí. |
| G4 | **Total que coincide a la vista.** Cada detalle cierra con un renglón "Total ítem N" igual al importe del nivel superior, para poder tildarlo. |
| G5 | **El orden de las pestañas es el orden de presentación.** Primero el índice, después los detalles en el mismo orden que los ítems, después el resultado, y al final las bases de datos. |
| G6 | **Cálculo completo a la vista.** Cada detalle muestra todos los pasos hasta llegar al número: cantidades, precios, tipo de cambio, porcentajes. |
| G7 | **Fórmulas rastreables.** Las fórmulas apuntan directo a las celdas que las conforman (por ejemplo, la suma marca las celdas que suma), para que al pararse en un número se vea de dónde sale. Las fórmulas de matriz o contra una tabla entera se usan solo cuando no hay otra forma. |
| G8 | **Archivo autocontenido.** Sin hojas ocultas ni vínculos a archivos externos. Un dato que viene de otro archivo se carga como valor, con la fuente indicada y un control contra el original. |
| G9 | **Controles visibles.** Cada hoja tiene sus chequeos con estado OK / REVISAR: total del detalle contra el ítem, suma de partes contra el total, resultado contra la data original. |
| G10 | **Dos versiones de entrega, siempre.** La versión de presentación lleva índice, detalles y resultado. La versión "con controles" suma una hoja con todos los chequeos y el estado general, una de modificaciones y una de pendientes. |
| G11 | **Trazabilidad de cambios.** Cada cambio respecto de la data original se registra con hoja, valor original, valor actual y variación. Se controla que resultado original + cambios aprobados = resultado final. |
| G12 | **Pendientes a la vista.** Los temas abiertos o a revisar van en la hoja de pendientes. |
| G13 | **Formato.** Arial, colores sobrios y suaves, títulos en negrita, secciones con subrayado. Formato contabilidad: punto para miles, coma para decimales, negativos entre paréntesis. |
| G14 | **Impresión A4 legible.** Todas las hojas con márgenes, encabezado y pie (nombre de hoja, página X de N). Se prioriza letra grande: si no entra, la hoja pasa a 2 páginas, con título "hoja 1/2" y "hoja 2/2", cortes entre secciones y encabezados repetidos. Con saltos de página manuales se usa escala fija, porque Excel ignora los saltos con "ajustar a". |
| G15 | **PDF de entrega, siempre.** Además del Excel se entrega un PDF con índice, detalles y resultado. |
| G16 | **Nombres según el caso.** Los nombres de hojas, ítems y columnas salen de cada reporte. Lo obligatorio es el encadenamiento, la numeración y el orden. |
| G17 | **Aplicación caso por caso.** Para cada reporte se define primero su estructura concreta (número final, ítems, niveles, hojas) y después se construye. Los cambios grandes se hacen por pasos, verificando el resultado después de cada uno. |
| G18 | **El detalle va debajo de su total, en la misma hoja.** Se evita mandar el detalle a otra pestaña; sólo cuando no queda otra (por tamaño), y entonces con la referencia y el link de G3. En el PDF pueden quedar en páginas distintas, pero seguidas. *(JMS 15/11)* |
| G19 | **Ningún número se encuentra filtrando.** Si para llegar a un importe del total hay que filtrar una tabla, el reporte no está terminado: ese importe necesita su propio renglón de subtotal a la vista. Los filtros son para las tablas maestras, no para el reporte. *(JMS 15/11)* |
| G20 | **El control siempre, no a veces.** Toda hoja que resume o unifica otras lleva su control a la vista (G9), sin excepciones. *(JMS 15/11)* |

## Reglas condicionales

Aplican solo cuando el reporte presenta la situación descripta. Si no se da, la regla se ignora.

| N° | Cuando… | Se resuelve así |
| --- | --- | --- |
| C1 | El reporte termina en una distribución o liquidación entre partes | Lleva una hoja de resultado con un renglón por ítem, la misma numeración del índice, una columna por parte, suma y control. Muestra solo el efecto neto de cada ítem. |
| C2 | Un ítem tiene movimientos entre partes (una paga, otra recibe, o variantes) | El detalle muestra las caras del movimiento y el saldo neto por parte, y solo ese neto pasa al resultado. La forma de mostrarlo se define en cada caso, porque admite muchas variantes. |
| C3 | Hay porcentajes o bases de reparto | Van visibles en la hoja de resultado y las fórmulas los usan. Siempre exactos (por ejemplo 1/3), nunca redondeados, porque el redondeo genera diferencias. |
| C4 | El resultado implica movimientos de fondos | La hoja de resultado cierra con una conciliación de totales y una liquidación: quién aporta y quién retira. |
| C5 | Hay dos monedas | Los subtotales en la segunda moneda van debajo de cada sección (total en moneda 1 / tipo de cambio / total en moneda 2), no en un cuadro aparte. Los tipos de cambio van en una hoja de base de datos al final. |
| C6 | Un ítem es informativo y no interviene en el resultado | Va último en el índice, marcado "No interviene", y su detalle es el último detalle. |
| C7 | Hay hojas de cálculo de soporte que no son ítems | Aclaran arriba que sus importes ya están contenidos en otro detalle, y cada resultado indica a dónde se imputa. |
| C8 | Los ítems son de naturaleza distinta | Se agrupan por tema en el índice y se clasifican por tipo en el resultado. |

## Ejemplo de referencia

Un reporte de capitalización y honorarios entre socios, presentado en reunión, se recorrió completo en el orden previsto sin necesidad de saltar. Su estructura de pestañas fue:

1. **Items**: lista de ítems con importe en pesos y dólares, y la hoja de su detalle.
2. **D1, D2, …**: una pestaña de detalle por tema, en el orden de los ítems.
3. **Resumen**: distribución entre las partes, conciliación y liquidación.
4. **TC**: base de tipos de cambio.
5. Solo en la versión con controles: **Controles**, **Modificaciones** y **Pendientes**.

Los criterios de negocio de cada reporte (partes, porcentajes, tratamiento impositivo) no forman parte del protocolo. Cada proyecto define los suyos.

## A confirmar

Dos notas tuyas admitían más de una lectura. Las dejé fuera de las reglas obligatorias hasta que las confirmes.

| Tema | Tu nota | Cómo lo dejé |
| --- | --- | --- |
| Paneles inmovilizados | "A veces puede servir pero hay que tener cuidado" | Entendí que la nota era por los paneles. Saqué la prohibición de la regla de formato. Propuesta: se usan solo en tablas largas donde ayudan a leer, y nunca en hojas pensadas para imprimir.  **JMS 15/11: se prueban.** || Código de colores por origen del dato | "Esto no estoy seguro" | Lo saqué de las reglas generales. Propuesta: queda como recomendación opcional (azul = dato ingresado, verde = vínculo a otra hoja, negro = cálculo, amarillo suave = importe clave, celeste = modificación).  **JMS 15/11: sólo en el Excel de auditoría interna (versión con controles), nunca en el PDF; él lo mira y decide si queda.** |
| Dos monedas (C5) vs. «pesos y dólares nunca mezclados en una tabla» (JMS 12/11) | Pregunta de Claude, no del protocolo | **En suspenso, con la propuesta ACTIVA (JMS 15/11):** C5 se lee como la conversión del subtotal debajo de cada sección (total en $ / TC / total en US$); nunca renglones de pesos y de dólares mezclados en la misma tabla. |
