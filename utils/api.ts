import axios from 'axios'

// TODO: Substituir pela URL base real da API
const API_BASE_URL = 'https://api.example.com'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Adiciono interceptor de requisição para autenticação se necessário
api.interceptors.request.use(
  (config) => {
    // Adiciono token de autenticação se disponível
    // const token = await GetDataFromSecureStore('token')
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`
    // }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Adiciono interceptor de resposta para tratamento de erros
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Trato erros comuns
    if (error.response?.status === 401) {
      // Trato não autorizado
    }
    return Promise.reject(error)
  }
)

export default api
