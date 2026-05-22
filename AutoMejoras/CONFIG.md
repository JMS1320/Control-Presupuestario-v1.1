# CONFIG — Configuracion de AutoMejoras

## Modelo
- **Modelo**: Sonnet (claude-sonnet-4-6)
- **Razon**: Balance costo/capacidad para tareas de documentacion y analisis

## Frecuencia
- **Cada**: 5 horas via Task Scheduler
- **El usuario puede**: Pausar/detener cuando quiera trabajar el mismo
- **Timeout**: 45 minutos maximo por sesion (anti-loop safety)

## Limites
- **Creditos**: Usa creditos normales del plan, NO el limite extra comprado aparte
- **Base de datos**: Solo SELECT, NUNCA INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE
- **Codigo**: Solo lectura, NUNCA modificar archivos del proyecto
- **Escritura permitida**: Solo dentro de `AutoMejoras/` (archivos .md)

## Archivos de comunicacion
| Archivo | Quien escribe | Quien lee | Proposito |
|---------|--------------|-----------|-----------|
| JMS.md | Usuario | Programa | Pedidos, tareas, objetivos |
| NOVEDADES.md | Programa | Usuario | Hallazgos, preguntas, respuestas |
| PROGRESO.md | Programa | Programa | Estado entre sesiones |
| CONFIG.md | Ambos | Ambos | Configuracion del sistema |

## Reglas de seguridad
1. NUNCA ejecutar queries que modifiquen datos (solo SELECT)
2. NUNCA editar archivos fuera de AutoMejoras/
3. NUNCA hacer git commit/push
4. NUNCA instalar paquetes
5. Si detecta algo critico: documentar en NOVEDADES.md, NUNCA corregir
