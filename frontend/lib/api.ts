import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Injecte le token JWT automatiquement
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('kipar_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Redirige vers login si 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('kipar_token')
      document.cookie = 'kipar_token=; path=/; max-age=0'
      window.location.replace('/login')
    }
    return Promise.reject(error)
  }
)

export default api
