# 🔗 ARCA API Integration

Integración con Web Services oficiales de ARCA para automatizar la descarga de comprobantes recibidos.

## 🎯 Objetivo

Reemplazar el proceso manual de descarga CSV semanal con sincronización automática via API oficial de ARCA.

## 📁 Estructura

```
arca-integration/
├── lib/
│   ├── auth.ts              # Autenticación WSAA + certificados
│   ├── wsfe.ts              # Cliente WSFEv1 + consultas 
│   └── adapter.ts           # Mapeo API → BD + validaciones
├── certificates/
│   ├── testing.crt          # Certificado auto-firmado testing
│   ├── testing-private.key  # Clave privada testing
│   └── production/          # Certificados producción (futuro)
├── scripts/
│   ├── generate-certs.sh    # Script generación certificados
│   └── test-connection.js   # Script prueba conexión
└── README.md               # Esta documentación
```

## 🚀 Quick Start

### 1. Generar certificados testing

```bash
cd arca-integration/scripts
./generate-certs.sh
```

### 2. Configurar variables de entorno

```bash
# Copiar ejemplo
cp .env.local.example .env.local

# Editar con tus valores Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_publica
SUPABASE_SERVICE_ROLE_KEY=tu_clave_servicio

# Variables ARCA (ya configuradas para testing)
ARCA_ENVIRONMENT=testing
ARCA_CUIT=20123456789
```

### 3. Probar conexión

```bash
cd arca-integration/scripts  
node test-connection.js
```

### 4. Probar sincronización

```bash
# Iniciar servidor
npm run dev

# Probar endpoint
curl -X POST http://localhost:3000/api/arca/sync-testing \
  -H "Content-Type: application/json" \
  -d '{"empresa": "MSA", "diasAtras": 30}'
```

## 📊 Comparativa: CSV vs API

| Aspecto | CSV Manual | ARCA API |
|---------|------------|----------|
| **Proceso** | Manual semanal | Automático diario |
| **Datos** | Hasta descarga | Tiempo real |
| **Errores** | Humanos frecuentes | Validaciones automáticas |
| **Multi-empresa** | 2 procesos separados | 1 proceso integrado |
| **Trazabilidad** | Archivo origen | API + timestamp |

## 🔧 Configuración Técnica

### Variables de Entorno

```env
# Testing (actual)
ARCA_ENVIRONMENT=testing
ARCA_CUIT=20123456789
ARCA_WSAA_URL=https://wsaahomo.afip.gov.ar/ws/services/LoginCms
ARCA_WSFE_URL=https://wswhomo.afip.gov.ar/wsfev1/service.asmx

# Producción (futuro)
ARCA_ENVIRONMENT=production  
ARCA_CUIT=30617786016  # MSA real
ARCA_WSAA_URL=https://wsaa.afip.gov.ar/ws/services/LoginCms
ARCA_WSFE_URL=https://servicios1.afip.gov.ar/wsfev1/service.asmx
```

### Endpoints API

- `POST /api/arca/sync-testing` - Sincronización testing
- `GET /api/arca/status` - Estado del servicio
- `POST /api/arca/sync-production` - Sincronización producción (futuro)

## 🔍 Debugging

### Logs Importantes

```
🔐 Enviando request WSAA a: [URL]
✅ Respuesta WSAA recibida  
📡 Consultando comprobantes ARCA desde [fecha] hasta [fecha]
📊 Comprobantes obtenidos de ARCA API: [cantidad]
💾 Insertando comprobante [N]...
✅ Sincronización completada: [nuevos] nuevos, [duplicados] duplicados
```

### Errores Comunes

```
❌ Error en ARCA API: Certificate expired
→ Renovar certificados producción

❌ Error WSFEv1: Token expired
→ Regenerar token WSAA (automático cada 24h)  

❌ No se puede conectar a msa.comprobantes_arca
→ Verificar permisos Supabase esquema
```

## 🎯 Roadmap

### ✅ Fase 1: MVP Testing (Completado)
- [x] Certificados auto-firmados
- [x] Autenticación WSAA
- [x] Consulta WSFEv1
- [x] Integración BD existente
- [x] Validaciones completas

### 🔄 Fase 2: Producción (Próximo)
- [ ] Tramitar certificados oficiales ARCA
- [ ] Testing con datos reales MSA
- [ ] UI botón sincronización
- [ ] Cron job automático

### 📈 Fase 3: Multi-Empresa
- [ ] Certificados PAM
- [ ] Sincronización dual MSA+PAM
- [ ] Dashboard consolidado

## 🔒 Seguridad

### Certificados
- **Testing**: Auto-firmados (temporal)
- **Producción**: Firmados por ARCA (oficial)
- **Renovación**: Manual anual
- **Almacenamiento**: Fuera del repositorio

### Tokens WSAA
- **Duración**: 24 horas
- **Renovación**: Automática
- **Almacenamiento**: Memoria (no persistir)

## 📞 Soporte

### ARCA Oficial
- **Consultas técnicas**: webservices-desa@arca.gob.ar
- **Documentación**: https://www.afip.gob.ar/ws/
- **Status servicios**: https://www.afip.gob.ar/ws/monitoreo/

### Troubleshooting
1. Verificar certificados: `node scripts/test-connection.js`
2. Verificar logs en endpoint testing
3. Consultar documentación oficial ARCA
4. Contactar soporte técnico si problemas persisten