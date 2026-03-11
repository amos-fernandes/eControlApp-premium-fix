import { useNetInfo } from "@react-native-community/netinfo"

import { resendService } from "../services/resendServices"

const checkConnection = () => {
  const netInfo = useNetInfo({
    reachabilityUrl: "https://www.google.com",
    reachabilityTest: async (response) => response.status === 200,
    reachabilityLongTimeout: 60 * 1000,
    reachabilityShortTimeout: 5 * 1000,
  })

  if (netInfo.isConnected && netInfo.isInternetReachable) {
    resendService()
    console.log("NetWork Connected")
    return true
  } else {
    console.log("NetWork Not connected")
    return false
  }
}

export default checkConnection
