import { Platform } from "react-native"
let SecureStore: any = null
if (Platform.OS !== "web") {
  SecureStore = require("expo-secure-store")
}

const isWeb = Platform.OS === "web"

function _safeStringify(value: any) {
  return typeof value === "string" ? value : JSON.stringify(value)
}

export async function SaveDataToSecureStore(key: string, value: any): Promise<void> {
  if (isWeb) {
    try {
      localStorage.setItem(key, _safeStringify(value))
    } catch (e) {
      console.warn("SecureStore(web) setItem failed", e)
    }
    return
  }

  return SecureStore.setItemAsync(key, typeof value === "string" ? value : JSON.stringify(value))
}

export async function GetDataFromSecureStore(key: string): Promise<any> {
  if (isWeb) {
    try {
      const v = localStorage.getItem(key)
      if (v === null) return null
      try {
        return JSON.parse(v)
      } catch (_e) {
        return v
      }
    } catch (e) {
      console.warn("SecureStore(web) getItem failed", e)
      return null
    }
  }

  return SecureStore.getItemAsync(key)
}

export async function DeleteDataFromSecureStore(key: string): Promise<void> {
  if (isWeb) {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.warn("SecureStore(web) removeItem failed", e)
    }
    return
  }

  return SecureStore.deleteItemAsync(key)
}
