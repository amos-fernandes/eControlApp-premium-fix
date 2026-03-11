import api from "./connection"
import reconnect from "./reconnect"
import { retrieveDomain } from "./retrieveUserSession"
import { getCredentials } from "../databases/database"
import { ResponseInterface } from "../interfaces/Response"

const sendServiceOrder = async (id: string, data: any): Promise<ResponseInterface | undefined> => {
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
    }

    if (id) {
      const response: any = await api.post(`${URL?.data}/service_orders/${id}/finish`, data, {
        params,
      })
      return { status: response.status, data: response.data }
    } else {
      return { status: 404, data: "Id undefined" }
    }
  } catch (error: any) {
    console.log(error)

    if (error.message === "Request failed with status code 403") {
      return { status: 403, data: "" }
    }
    reconnect()
  }
}

export default sendServiceOrder
