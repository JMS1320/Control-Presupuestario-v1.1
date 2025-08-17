#!/bin/bash

# Script para generar certificados de testing ARCA
# Uso: ./generate-certs.sh

set -e

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/certificates"
echo "📁 Directorio certificados: $CERT_DIR"

# Crear directorio si no existe
mkdir -p "$CERT_DIR"
cd "$CERT_DIR"

echo "🔑 Generando certificados ARCA Testing..."

# 1. Generar clave privada
echo "1/3 Generando clave privada..."
openssl genrsa -out testing-private.key 2048

# 2. Generar Certificate Signing Request
echo "2/3 Generando CSR..."
openssl req -new -key testing-private.key -out testing.csr \
  -subj "//C=AR\ST=Buenos Aires\L=CABA\O=Testing\OU=Testing\CN=testing"

# 3. Generar certificado auto-firmado
echo "3/3 Generando certificado auto-firmado..."
openssl x509 -req -in testing.csr -signkey testing-private.key \
  -out testing.crt -days 365

# Limpiar archivos temporales
rm testing.csr

echo "✅ Certificados generados exitosamente:"
echo "   - testing.crt (certificado)"
echo "   - testing-private.key (clave privada)"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Configurar variables de entorno"
echo "   2. Probar conexión con test-connection.js"
echo "   3. Ejecutar sincronización testing"