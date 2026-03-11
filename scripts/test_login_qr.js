const axios = require('axios')

const URL = 'https://qrco.de/bgXkgO/api'
const email = 'motoristaaplicativo@econtrole.com'
const password = 'motoapp123'

;(async () => {
  try {
    console.log('POST', `${URL}/auth/sign_in`)
    const res = await axios.post(`${URL}/auth/sign_in`, { email, password }, { timeout: 10000 })
    console.log('Status:', res.status)
    console.log('Headers:', res.headers)
    console.log('Data:', res.data)
  } catch (err) {
    if (err.response) {
      console.log('Status:', err.response.status)
      console.log('Data:', err.response.data)
      console.log('Headers:', err.response.headers)
    } else {
      console.log('Error:', err.message)
    }
  }
})()
