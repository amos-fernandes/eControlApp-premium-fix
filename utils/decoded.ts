import { DomainInterface } from "../interfaces/Domain"

/**
 * Decodificador Base64 robusto que não depende do Buffer do Node.js ou atob do navegador.
 * Seguro para ambientes Hermes/React Native.
 */
const base64Decode = (input: string): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
  let str = input.replace(/=+$/, "")
  let output = ""

  if (str.length % 4 === 1) return input // Não é base64 válido

  for (let bc = 0, bs = 0, buffer, i = 0; (buffer = str.charAt(i++));) {
    buffer = chars.indexOf(buffer)
    if (buffer === -1) return input // Contém caracteres inválidos

    bs = bc % 4 ? bs * 64 + buffer : buffer
    if (bc++ % 4) {
      output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)))
    }
  }

  return output
}

const decoded = (tenant: DomainInterface) => {
  if (!tenant.domain) return ""

  try {
    // Tento decodificar usando meu helper local
    const decodedValue = base64Decode(tenant.domain)

    // Verifico se é ASCII imprimível (para evitar retornar lixo binário se não era base64)
    if (/^[\x20-\x7E]*$/.test(decodedValue) && decodedValue.length > 0) {
      return decodedValue
    }
  } catch (e) {
    // Ignoro o erro e retorno o original
  }

  return tenant.domain
}

export default decoded
