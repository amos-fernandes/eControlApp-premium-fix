import { SaveDataToSecureStore } from "@/utils/SecureStore"

import api from "./connection"
import { retrieveDomain } from "./retrieveUserSession"
import { insertCredentials } from "../databases/database"

const login = async (email: string, password: string) => {
  try {
    const URL = await retrieveDomain()
    if (!URL || URL.status !== 200 || (URL.data !== '' && !URL.data)) {
      throw new Error("INVALID_DOMAIN")
    }
    if (email && password) {
      const endpoint = URL.data === '' ? '/api/auth/sign_in' : `${URL.data}/auth/sign_in`
      const response: any = await api
        .post(endpoint, {
          email,
          password,
        })
        .then(async (response) => {
          await SaveDataToSecureStore(
            "user_session",
            JSON.stringify({
              email,
              password,
            }),
          )
          // Salvo credenciais no banco de dados
          try {
            await insertCredentials({
              accessToken: response.headers['access-token'],
              uid: response.headers['uid'],
              client: response.headers['client'],
            })
            console.log("Credentials saved to database")
          } catch (dbError) {
            console.log("Error saving credentials to database:", dbError)
          }
          return response
        })

      return response
    } else {
      throw new Error("Email ou senha vazios ou invalidos.")
    }
  } catch (error) {
    console.log("login: ", error)
    console.log("login error response data:", (error as any).response?.data)
    throw error
  }
}
export default login
