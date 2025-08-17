import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import { arcaAuth } from './auth'

/**
 * Cliente para Web Service de Facturación Electrónica v1 (WSFEv1)
 * Permite consultar comprobantes emitidos y recibidos
 */
export class WSFEClient {
  private readonly environment: 'testing' | 'production'
  private readonly wsfeUrl: string

  constructor(environment: 'testing' | 'production' = 'testing') {
    this.environment = environment
    this.wsfeUrl = environment === 'testing'
      ? 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx'
      : 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
  }

  /**
   * Consulta comprobantes en un período de fechas
   * @param fechaDesde Fecha desde en formato YYYYMMDD
   * @param fechaHasta Fecha hasta en formato YYYYMMDD
   * @param cuit CUIT del contribuyente (opcional, por defecto usa el configurado)
   */
  async consultarComprobantes(params: {
    fechaDesde: string
    fechaHasta: string
    cuit?: string
    tipoComprobante?: number
    puntoVenta?: number
  }): Promise<ComprobanteARCA[]> {
    try {
      console.log(`🔍 Consultando comprobantes ARCA desde ${params.fechaDesde} hasta ${params.fechaHasta}`)
      
      // 1. Obtener token de autenticación
      const auth = await arcaAuth.getAccessToken()
      
      // 2. Crear SOAP request para consulta
      const soapRequest = this.createConsultaComprobantesSoap({
        ...params,
        token: auth.token,
        sign: auth.sign,
        cuit: params.cuit || process.env.ARCA_CUIT || '20123456789' // CUIT testing
      })
      
      // 3. Enviar request
      const response = await this.sendWSFERequest(soapRequest, 'FECompConsultar')
      
      // 4. Parsear respuesta
      const comprobantes = this.parseConsultaComprobantesResponse(response)
      
      console.log(`✅ Encontrados ${comprobantes.length} comprobantes`)
      return comprobantes
      
    } catch (error) {
      console.error('❌ Error consultando comprobantes:', error)
      throw new Error(`Error en consulta WSFEv1: ${error}`)
    }
  }

  /**
   * Consulta el último comprobante autorizado para un punto de venta
   */
  async consultarUltimoComprobante(params: {
    tipoComprobante: number
    puntoVenta: number
  }): Promise<number> {
    try {
      const auth = await arcaAuth.getAccessToken()
      
      const soapRequest = this.createUltimoComprobanteSOAP({
        ...params,
        token: auth.token,
        sign: auth.sign,
        cuit: process.env.ARCA_CUIT || '20123456789'
      })
      
      const response = await this.sendWSFERequest(soapRequest, 'FECompUltimoAutorizado')
      const ultimoNumero = this.parseUltimoComprobanteResponse(response)
      
      return ultimoNumero
      
    } catch (error) {
      console.error('❌ Error consultando último comprobante:', error)
      throw new Error(`Error consultando último comprobante: ${error}`)
    }
  }

  /**
   * Crea el SOAP request para consultar comprobantes
   */
  private createConsultaComprobantesSoap(params: {
    fechaDesde: string
    fechaHasta: string
    token: string
    sign: string
    cuit: string
    tipoComprobante?: number
    puntoVenta?: number
  }): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soap:Header/>
  <soap:Body>
    <ar:FECompConsultar>
      <ar:Auth>
        <ar:Token>${params.token}</ar:Token>
        <ar:Sign>${params.sign}</ar:Sign>
        <ar:Cuit>${params.cuit}</ar:Cuit>
      </ar:Auth>
      <ar:FeCompConsReq>
        <ar:FechaDesde>${params.fechaDesde}</ar:FechaDesde>
        <ar:FechaHasta>${params.fechaHasta}</ar:FechaHasta>
        ${params.tipoComprobante ? `<ar:CbteTipo>${params.tipoComprobante}</ar:CbteTipo>` : ''}
        ${params.puntoVenta ? `<ar:PtoVta>${params.puntoVenta}</ar:PtoVta>` : ''}
      </ar:FeCompConsReq>
    </ar:FECompConsultar>
  </soap:Body>
</soap:Envelope>`
  }

  /**
   * Crea SOAP request para consultar último comprobante
   */
  private createUltimoComprobanteSOAP(params: {
    tipoComprobante: number
    puntoVenta: number
    token: string
    sign: string
    cuit: string
  }): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soap:Header/>
  <soap:Body>
    <ar:FECompUltimoAutorizado>
      <ar:Auth>
        <ar:Token>${params.token}</ar:Token>
        <ar:Sign>${params.sign}</ar:Sign>
        <ar:Cuit>${params.cuit}</ar:Cuit>
      </ar:Auth>
      <ar:PtoVta>${params.puntoVenta}</ar:PtoVta>
      <ar:CbteTipo>${params.tipoComprobante}</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>
  </soap:Body>
</soap:Envelope>`
  }

  /**
   * Envía request SOAP a WSFEv1
   */
  private async sendWSFERequest(soapEnvelope: string, action: string): Promise<string> {
    console.log(`📡 Enviando ${action} a WSFEv1: ${this.wsfeUrl}`)
    
    const response = await fetch(this.wsfeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `http://ar.gov.afip.dif.FEV1/${action}`
      },
      body: soapEnvelope
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const responseText = await response.text()
    console.log(`✅ Respuesta ${action} recibida`)
    
    return responseText
  }

  /**
   * Parsea la respuesta XML de consulta de comprobantes
   */
  private parseConsultaComprobantesResponse(responseXml: string): ComprobanteARCA[] {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
      })
      
      const parsed = parser.parse(responseXml)
      
      // Navegar por la estructura SOAP
      const consultaResponse = parsed['soap:Envelope']?.[
        'soap:Body'
      ]?.FECompConsultarResponse?.FECompConsultarResult
      
      if (!consultaResponse) {
        throw new Error('Estructura de respuesta WSFEv1 inválida')
      }

      // Verificar errores
      if (consultaResponse.Errors) {
        const error = Array.isArray(consultaResponse.Errors.Err) 
          ? consultaResponse.Errors.Err[0] 
          : consultaResponse.Errors.Err
        throw new Error(`Error WSFEv1: ${error.Msg} (Código: ${error.Code})`)
      }

      // Extraer comprobantes
      const comprobantes = consultaResponse.ResultGet?.FECompConsulta || []
      const comprobanteArray = Array.isArray(comprobantes) ? comprobantes : [comprobantes]
      
      return comprobanteArray.map(this.mapComprobanteFromWSFE)
      
    } catch (error) {
      console.error('❌ Error parseando respuesta WSFEv1:', error)
      throw new Error(`Error parseando respuesta WSFEv1: ${error}`)
    }
  }

  /**
   * Parsea respuesta de último comprobante
   */
  private parseUltimoComprobanteResponse(responseXml: string): number {
    try {
      const parser = new XMLParser()
      const parsed = parser.parse(responseXml)
      
      const result = parsed['soap:Envelope']?.[
        'soap:Body'
      ]?.FECompUltimoAutorizadoResponse?.FECompUltimoAutorizadoResult
      
      if (!result) {
        throw new Error('Respuesta de último comprobante inválida')
      }

      if (result.Errors) {
        const error = Array.isArray(result.Errors.Err) 
          ? result.Errors.Err[0] 
          : result.Errors.Err
        throw new Error(`Error WSFEv1: ${error.Msg}`)
      }

      return parseInt(result.CbteNro) || 0
      
    } catch (error) {
      throw new Error(`Error parseando último comprobante: ${error}`)
    }
  }

  /**
   * Mapea un comprobante de la respuesta WSFEv1 a nuestra estructura
   */
  private mapComprobanteFromWSFE(comp: any): ComprobanteARCA {
    return {
      // Datos principales
      fecha_emision: this.formatearFecha(comp.CbteFch),
      tipo_comprobante: parseInt(comp.CbteTipo) || 0,
      punto_venta: parseInt(comp.PtoVta) || 0,
      numero_desde: parseInt(comp.CbteDesde) || 0,
      numero_hasta: parseInt(comp.CbteHasta) || 0,
      codigo_autorizacion: comp.CAE?.toString() || null,
      
      // Datos del emisor/receptor
      tipo_doc_emisor: parseInt(comp.DocTipo) || null,
      cuit: comp.DocNro?.toString() || '',
      denominacion_emisor: '', // WSFEv1 no incluye denominación, se puede obtener de padrón
      
      // Importes
      tipo_cambio: parseFloat(comp.MonCotiz) || 1.0,
      moneda: comp.MonId || 'PES',
      imp_neto_gravado: this.parseImporte(comp.ImpNeto),
      imp_neto_no_gravado: this.parseImporte(comp.ImpNetNoGrav),
      imp_op_exentas: this.parseImporte(comp.ImpOpEx),
      otros_tributos: this.parseImporte(comp.ImpTotConc),
      iva: this.parseImporte(comp.ImpIVA),
      imp_total: this.parseImporte(comp.ImpTotal),
      
      // Campos adicionales para gestión
      campana: null,
      fc: null,
      cuenta_contable: null,
      centro_costo: null,
      estado: 'pendiente',
      observaciones_pago: null,
      detalle: null,
      archivo_origen: 'WSFE_API'
    }
  }

  /**
   * Formatea fecha de ARCA (YYYYMMDD) a formato ISO
   */
  private formatearFecha(fechaArca: string): string | null {
    if (!fechaArca || fechaArca.length !== 8) return null
    
    const year = fechaArca.substring(0, 4)
    const month = fechaArca.substring(4, 6)
    const day = fechaArca.substring(6, 8)
    
    return `${year}-${month}-${day}`
  }

  /**
   * Parsea importes de ARCA
   */
  private parseImporte(valor: string | number): number {
    if (typeof valor === 'number') return valor
    if (!valor) return 0
    return parseFloat(valor.toString()) || 0
  }
}

/**
 * Interfaz para comprobantes ARCA que coincide con tu estructura de BD
 */
export interface ComprobanteARCA {
  fecha_emision: string | null
  tipo_comprobante: number
  punto_venta: number
  numero_desde: number
  numero_hasta: number
  codigo_autorizacion: string | null
  tipo_doc_emisor: number | null
  cuit: string
  denominacion_emisor: string
  tipo_cambio: number
  moneda: string
  imp_neto_gravado: number
  imp_neto_no_gravado: number
  imp_op_exentas: number
  otros_tributos: number
  iva: number
  imp_total: number
  campana: string | null
  fc: string | null
  cuenta_contable: string | null
  centro_costo: string | null
  estado: string
  observaciones_pago: string | null
  detalle: string | null
  archivo_origen: string
}

/**
 * Instancia global del cliente WSFEv1
 */
export const wsfeClient = new WSFEClient('testing')