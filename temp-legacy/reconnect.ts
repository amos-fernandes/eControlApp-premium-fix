import login from "./login"
import { retrieveUserSession } from "./retrieveUserSession"

const reconnect = async () => {
  const user: any = await retrieveUserSession()
  console.log("reconnect chamado")
  if (user) {
    await login(user.email, user.password)
  }
}

export default reconnect
