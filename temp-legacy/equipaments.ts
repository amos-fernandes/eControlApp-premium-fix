import api from "./connection"
import reconnect from "./reconnect"
import { retrieveDomain } from "./retrieveUserSession"
import { getCredentials } from "../databases/database"

export const getEquipamentsLeft = async (customer_id: string, stock: boolean) => {
  const URL = await retrieveDomain()
  try {
    const credentials: any = getCredentials()
    if (!credentials || !credentials.accessToken) {
      throw new Error("NO_CREDENTIALS")
    }
    
    const params = {
      "access-token": credentials.accessToken,
      "client": credentials.client,
      "uid": credentials.uid,
      customer_id,
      "in_stock": stock,
    }

    const response = await api.get(`${URL?.data}/operations/equipment`, {
      params,
    })
    return response.data

  } catch (error: any) {
    console.log(error)
    reconnect()
  }
}

export const getEquipamentsCollected = async (customer_id: string, stock: boolean) => {
  const URL = await retrieveDomain()
  try {
    const credentials: any = getCredentials()
    if (!credentials || !credentials.accessToken) {
      throw new Error("NO_CREDENTIALS")
    }
    
    const params = {
      "access-token": credentials.accessToken,
      "client": credentials.client,
      "uid": credentials.uid,
      customer_id,
      "in_stock": stock,
    }

    const response = await api.get(`${URL?.data}/operations/equipment`, {
      params,
    })

    return response.data
  } catch (error: any) {
    console.log(error)
    // reconnect()
  }
}
