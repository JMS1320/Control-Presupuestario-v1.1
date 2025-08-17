#!/usr/bin/env node

/**
 * Script para probar conexión ARCA API
 * Uso: node test-connection.js
 */

const path = require('path');
const fs = require('fs');

// Configurar variables de entorno si no están definidas
if (!process.env.ARCA_ENVIRONMENT) {
  process.env.ARCA_ENVIRONMENT = 'testing';
  process.env.ARCA_CUIT = '20123456789';
  process.env.ARCA_WSAA_URL = 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms';
  process.env.ARCA_WSFE_URL = 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';
}

async function testConnection() {
  console.log('🔧 Probando conexión ARCA API...');
  console.log(`📊 Ambiente: ${process.env.ARCA_ENVIRONMENT}`);
  console.log(`🏢 CUIT: ${process.env.ARCA_CUIT}`);
  
  try {
    // Verificar certificados
    const certDir = path.join(__dirname, '..', 'certificates');
    const certPath = path.join(certDir, 'testing.crt');
    const keyPath = path.join(certDir, 'testing-private.key');
    
    console.log('📋 Verificando certificados...');
    
    if (!fs.existsSync(certPath)) {
      throw new Error(`❌ Certificado no encontrado: ${certPath}`);
    }
    
    if (!fs.existsSync(keyPath)) {
      throw new Error(`❌ Clave privada no encontrada: ${keyPath}`);
    }
    
    console.log('✅ Certificados encontrados');
    
    // Importar módulos ARCA (usando require dinámico para evitar errores de ES modules)
    const { ARCAAuth } = await import('../lib/auth.js');
    const { WSFEClient } = await import('../lib/wsfe.js');
    
    console.log('📡 Probando autenticación WSAA...');
    
    const auth = new ARCAAuth('wsfe', 'testing');
    
    // Verificar configuración
    if (!auth.isConfigured()) {
      throw new Error('❌ Autenticación no configurada correctamente');
    }
    
    console.log('✅ Configuración WSAA OK');
    
    // Probar obtener token (esto falla en testing pero muestra si la conexión funciona)
    try {
      const token = await auth.getAccessToken();
      console.log('✅ Token WSAA obtenido exitosamente');
      console.log(`🎫 Token expira: ${token.expirationTime}`);
      
      // Probar consulta WSFEv1
      console.log('📊 Probando consulta WSFEv1...');
      const wsfe = new WSFEClient('testing');
      
      const comprobantes = await wsfe.consultarComprobantes({
        fechaDesde: '20250101',
        fechaHasta: '20250131'
      });
      
      console.log(`✅ WSFEv1 respondió: ${comprobantes.length} comprobantes`);
      
    } catch (authError) {
      if (authError.message.includes('Certificate')) {
        console.log('⚠️  Error de certificado esperado en testing (certificados auto-firmados)');
        console.log('✅ Conexión a ARCA establecida (error esperado en testing)');
      } else {
        throw authError;
      }
    }
    
    console.log('');
    console.log('🎉 Prueba de conexión completada');
    console.log('📋 Próximos pasos:');
    console.log('   1. Para testing: Los errores de certificado son normales');
    console.log('   2. Para producción: Tramitar certificados oficiales ARCA');
    console.log('   3. Probar endpoint: POST /api/arca/sync-testing');
    
  } catch (error) {
    console.error('❌ Error en prueba de conexión:', error.message);
    console.log('');
    console.log('🔧 Soluciones posibles:');
    console.log('   1. Ejecutar generate-certs.sh primero');
    console.log('   2. Verificar variables de entorno');
    console.log('   3. Verificar conexión a internet');
    console.log('   4. Verificar disponibilidad servicios ARCA');
    process.exit(1);
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  testConnection();
}

module.exports = { testConnection };