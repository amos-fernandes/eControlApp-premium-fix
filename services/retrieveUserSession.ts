import { GetDataFromSecureStore } from "@/utils/SecureStore"
import { Platform } from 'react-native'
import * as Network from 'expo-network'
import AsyncStorage from "@react-native-async-storage/async-storage"

import { ResponseInterface } from "../interfaces/Response"
import decoded from "../utils/decoded"

export const retrieveUserSession = async (): Promise<ResponseInterface> => {
  console.log("retrieveUserSession: Starting...")
  try {
    const session = await GetDataFromSecureStore("user_session")
    console.log("retrieveUserSession: Raw session:", session)

    if (session) {
      const parsed = JSON.parse(session)
      console.log("retrieveUserSession: Parsed session:", parsed)
      return { status: 200, data: parsed }
    }
    console.log("retrieveUserSession: No session found")
    return { status: 404, data: "retrieveUserSession" }
  } catch (error) {
    console.log("retrieveUserSession: Error:", error)
    return { status: 401 }
  }
}

/**
 * Obtém o IP local da rede LAN
 */
export const getLocalIpAddress = async (): Promise<string | null> => {
  try {
    const ipAddress = await Network.getIpAddressAsync()
    console.log("Local IP address:", ipAddress)

    if (ipAddress && ipAddress !== '') {
      return ipAddress
    }
    return null
  } catch (error) {
    console.log("getLocalIpAddress error:", error)
    return null
  }
}

/**
 * Verifica se o domínio é um endereço local (localhost, 127.0.0.1, etc.)
 */
const isLocalhostDomain = (domain: string): boolean => {
  const localhostPatterns = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
  ]
  return localhostPatterns.some(pattern => domain.includes(pattern))
}

/**
 * Corrige o domínio localhost para o IP da rede local
 */
const fixLocalhostDomain = async (domain: string): Promise<string> => {
  if (!isLocalhostDomain(domain)) {
    return domain
  }

  console.log("LOCALHOST DETECTED: Attempting to fix domain from", domain)

  const localIp = await getLocalIpAddress()
  if (localIp) {
    // Extrai a porta do domínio original (se houver)
    const portMatch = domain.match(/:(\d+)/)
    const port = portMatch ? portMatch[0] : ':19000'

    const fixedDomain = `http://${localIp}${port}`
    console.log("DOMAIN FIXED: Using local IP", fixedDomain)
    return fixedDomain
  }

  console.log("Could not fix domain - no local IP found")
  return domain
}

export const retrieveDomain = async (): Promise<ResponseInterface> => {
  console.log("retrieveDomain: Starting...")

  // Para desenvolvimento web, uso proxy para evitar problemas de CORS
  if (Platform.OS === 'web') {
    console.log("retrieveDomain: Web platform, returning empty string")
    return { status: 200, data: '' }
  }

  try {
    // Tenta primeiro no SecureStore (padrão QRScanner)
    const session: any = await GetDataFromSecureStore("domain")
    console.log("retrieveDomain: Raw session from SecureStore:", session)

    // Fallback para AsyncStorage (usado pelo AuthContext)
    let domainData = session;
    let asyncStorageUrl: string | null = null;
    if (!domainData) {
      asyncStorageUrl = await AsyncStorage.getItem("econtrole_base_url")
      console.log("retrieveDomain: Fallback to AsyncStorage:", asyncStorageUrl)
      if (asyncStorageUrl) {
        domainData = { domain: asyncStorageUrl }
      }
    }

    if (!domainData) {
      console.log("retrieveDomain: No session found, returning 404")
      return { status: 404 }
    }

    // `GetDataFromSecureStore` pode retornar um objeto parseado na web ou uma string JSON no native.
    const parsedSession = typeof domainData === 'string' ? JSON.parse(domainData) : domainData
    let domain = parsedSession.domain || domainData.domain || asyncStorageUrl
    console.log("retrieveDomain: Extracted domain:", domain)

    if (!domain) {
      console.log("retrieveDomain: Domain is empty, returning 404")
      return { status: 404 }
    }

    // Corrige automaticamente domínios localhost/127.0.0.1
    if (isLocalhostDomain(domain)) {
      console.log("retrieveDomain: Localhost detected, attempting fix...")
      domain = await fixLocalhostDomain(domain)
      console.log("retrieveDomain: Domain after fix:", domain)
    }

    // Rejeito APENAS links do Metro/Expo dev client (não IPs locais válidos)
    if (domain.includes("expo-development-client")) {
      console.log("retrieveDomain: DETECTED METRO QR CODE. REJECTING.")
      return { status: 400, data: "INVALID_URL_METRO" }
    }

    // Se for uma URL completa
    if (domain.startsWith("http://") || domain.startsWith("https://")) {
      try {
        // Tento seguir redirecionamentos (por exemplo short URLs como qrco.de)
        // usando fetch para obter a URL final, quando possível.
        const resp = await fetch(domain, { method: 'GET' })
        const finalUrl = resp.url || domain

        // Uso parsing de URL para remover query strings e normalizar o caminho
        try {
          const parsed = new URL(finalUrl)
          // Se o caminho termina com /login, removo; caso contrário removo qualquer caminho /login no final
          let pathname = parsed.pathname.replace(/\/login\/?$/, "")
          if (!pathname) pathname = ''
          let normalized = `${parsed.protocol}//${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}${pathname}`
          normalized = normalized.replace(/\/$/, "")
          if (!normalized.endsWith("/api")) {
            normalized = normalized + "/api"
          }
          return { status: 200, data: normalized }
        } catch (e) {
          // fallback: removo querystring e /login de forma simples
          let simple = finalUrl.split('?')[0]
          simple = simple.replace(/\/login\/?$/, "")
          simple = simple.replace(/\/$/, "")
          if (!simple.endsWith("/api")) simple = simple + "/api"
          return { status: 200, data: simple }
        }
      } catch (err) {
        // Se seguir redirects falhar (ex: cloudflare challenge), caio para a
        // normalização simples da URL lida do QR.
        domain = domain.replace(/\/login\/?$/, "")
        domain = domain.replace(/\/$/, "")
        if (!domain.endsWith("/api")) {
          domain = domain + "/api"
        }
        return { status: 200, data: domain }
      }
    }

    // Caso seja apenas o subdomínio
    const decodedValue: any = decoded(parsedSession)
    const isPrintable = /^[\x20-\x7E]*$/.test(decodedValue)
    const finalSubdomain = isPrintable && decodedValue ? decodedValue : domain

    const finalUrl = "https://" + finalSubdomain + ".econtrole.com/api"
    return { status: 200, data: finalUrl }
  } catch (error) {
    console.log("retrieveDomain Error:", error)
    return { status: 401 }
  }
}
