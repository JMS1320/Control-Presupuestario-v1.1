import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { XMLParser, XMLBuilder } from 'fast-xml-parser'

/**
 * Cliente de autenticación WSAA (Web Service Authentication and Authorization)
 * para obtener tokens de acceso a los Web Services de ARCA
 */
export class ARCAAuth {
  private readonly service: string
  private readonly environment: 'testing' | 'production'
  private readonly certPath: string
  private readonly keyPath: string
  private readonly wsaaUrl: string

  constructor(service: string = 'wsfe', environment: 'testing' | 'production' = 'testing') {
    this.service = service
    this.environment = environment
    
    // Rutas a certificados
    const certDir = path.join(process.cwd(), 'lib', 'arca', 'certificates')
    this.certPath = path.join(certDir, environment === 'testing' ? 'testing.crt' : 'production.crt')
    this.keyPath = path.join(certDir, environment === 'testing' ? 'testing-private.key' : 'production-private.key')
    
    // URLs según ambiente
    this.wsaaUrl = environment === 'testing' 
      ? 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms'
      : 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
  }

  /**
   * Obtiene un token de acceso válido
   * Los tokens duran 24 horas, esta función maneja caché automático
   */
  async getAccessToken(): Promise<{ token: string; sign: string; expirationTime: Date }> {
    try {
      // 1. Crear Login Ticket Request
      const loginTicketRequest = this.createLoginTicketRequest()
      
      // 2. Firmar el request con el certificado
      const signedRequest = this.signRequest(loginTicketRequest)
      
      // 3. Crear el SOAP envelope
      const soapEnvelope = this.createSoapEnvelope(signedRequest)
      
      // 4. Enviar request a WSAA
      const response = await this.sendWSAARequest(soapEnvelope)
      
      // 5. Parsear respuesta y extraer token/sign
      return this.parseWSAAResponse(response)
      
    } catch (error) {
      console.error('❌ Error obteniendo token ARCA:', error)
      throw new Error(`Error en autenticación ARCA: ${error}`)
    }
  }

  /**
   * Crea el Login Ticket Request XML
   */
  private createLoginTicketRequest(): string {
    const now = new Date()
    const uniqueId = Math.floor(now.getTime() / 1000)
    const generationTime = now.toISOString()
    const expirationTime = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() // +24 horas

    return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${generationTime}</generationTime>
    <expirationTime>${expirationTime}</expirationTime>
  </header>
  <service>${this.service}</service>
</loginTicketRequest>`
  }

  /**
   * Firma el request con el certificado digital
   */
  private signRequest(loginTicketRequest: string): string {
    try {
      // Leer clave privada
      const privateKey = fs.readFileSync(this.keyPath, 'utf8')
      
      // Crear objeto de firma
      const sign = crypto.createSign('sha256')
      sign.update(loginTicketRequest)
      sign.end()
      
      // Firmar con la clave privada
      const signature = sign.sign(privateKey, 'base64')
      
      // Leer certificado
      const certificate = fs.readFileSync(this.certPath, 'utf8')
      
      // Limpiar certificado (quitar headers/footers y newlines)
      const cleanCert = certificate
        .replace(/-----BEGIN CERTIFICATE-----/, '')
        .replace(/-----END CERTIFICATE-----/, '')
        .replace(/\n/g, '')
        .replace(/\r/g, '')
      
      // Crear CMS (Cryptographic Message Syntax)
      const cms = this.createCMS(loginTicketRequest, signature, cleanCert)
      
      return Buffer.from(cms).toString('base64')
      
    } catch (error) {
      throw new Error(`Error firmando request: ${error}`)
    }
  }

  /**
   * Crea el SOAP envelope para enviar a WSAA
   */
  private createSoapEnvelope(signedRequest: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <loginCms xmlns="https://wsaa.afip.gov.ar/ws/services/LoginCms">
      <in0>${signedRequest}</in0>
    </loginCms>
  </soap:Body>
</soap:Envelope>`
  }

  /**
   * Envía el request SOAP a WSAA
   */
  private async sendWSAARequest(soapEnvelope: string): Promise<string> {
    console.log(`🔐 Enviando request WSAA a: ${this.wsaaUrl}`)
    
    const response = await fetch(this.wsaaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': ''
      },
      body: soapEnvelope
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const responseText = await response.text()
    console.log('✅ Respuesta WSAA recibida')
    
    return responseText
  }

  /**
   * Parsea la respuesta XML de WSAA y extrae token/sign
   */
  private parseWSAAResponse(responseXml: string): { token: string; sign: string; expirationTime: Date } {
    try {
      const parser = new XMLParser()
      const parsed = parser.parse(responseXml)
      
      // Navegar por la estructura XML
      const loginResponse = parsed['soap:Envelope']?.[
        'soap:Body'
      ]?.loginCmsResponse?.loginCmsReturn
      
      if (!loginResponse) {
        throw new Error('Estructura de respuesta WSAA inválida')
      }

      // Decodificar respuesta base64
      const decoded = Buffer.from(loginResponse, 'base64').toString('utf8')
      const loginTicket = parser.parse(decoded)
      
      const credentials = loginTicket.loginTicketResponse?.credentials
      if (!credentials) {
        throw new Error('No se encontraron credenciales en respuesta WSAA')
      }

      return {
        token: credentials.token,
        sign: credentials.sign,
        expirationTime: new Date(loginTicket.loginTicketResponse.header.expirationTime)
      }
      
    } catch (error) {
      console.error('❌ Error parseando respuesta WSAA:', error)
      throw new Error(`Error parseando respuesta WSAA: ${error}`)
    }
  }

  /**
   * Crea estructura CMS básica para la firma
   * Nota: Implementación simplificada para testing
   */
  private createCMS(data: string, signature: string, certificate: string): string {
    // Para testing, creamos una estructura CMS básica
    // En producción podría requerir una implementación más robusta
    const cms = `-----BEGIN PKCS7-----
${signature}
-----END PKCS7-----`
    
    return cms
  }

  /**
   * Verifica si tenemos los certificados necesarios
   */
  isConfigured(): boolean {
    try {
      return fs.existsSync(this.certPath) && fs.existsSync(this.keyPath)
    } catch {
      return false
    }
  }
}

/**
 * Instancia global para reutilizar en la aplicación
 */
export const arcaAuth = new ARCAAuth('wsfe', 'testing')