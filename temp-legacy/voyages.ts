import api from "./connection"
import reconnect from "./reconnect"
import { retrieveDomain } from "./retrieveUserSession"
import { getCredentials } from "../databases/database"

const getVoyages = async () => {
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

    const response = await api.get(`${URL.data}/operations/voyages`, { params })
    // Os dados podem ser armazenados localmente no SQLite se eu precisar

    return response.data
  } catch (error: any) {
    console.log(error)
    // reconnect()
  }
}

export default getVoyages
