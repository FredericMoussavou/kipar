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

// Refresh token partage : evite N refreshs paralleles sur des 401 simultanes
let refreshPromise: Promise<string | null> | null = null

async function tryRefreshToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const refreshToken = localStorage.getItem('kipar_refresh_token')
  if (!refreshToken) return null
  try {
    const res = await fetch(
      (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1') + '/auth/refresh',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data.access_token) return null
    localStorage.setItem('kipar_token', data.access_token)
    document.cookie = `kipar_token=${data.access_token}; path=/; max-age=1800`
    if (data.refresh_token) localStorage.setItem('kipar_refresh_token', data.refresh_token)
    return data.access_token
  } catch {
    return null
  }
}

function forceLogout() {
  if (typeof window === 'undefined') return
  const publicPaths = ['/', '/login', '/register', '/faq', '/cgu', '/privacy', '/cookies', '/mentions-legales']
  const isPublic = publicPaths.some(p => window.location.pathname === p || window.location.pathname.startsWith('/receiver/') || window.location.pathname.startsWith('/trips/'))
  localStorage.removeItem('kipar_token')
  document.cookie = 'kipar_token=; path=/; max-age=0'
  if (!isPublic) window.location.replace('/login')
}

// 401 -> tente un refresh silencieux + rejoue la requete ; sinon logout
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const status = error.response?.status
    const url: string = original?.url ?? ''
    if (
      status === 401 &&
      typeof window !== 'undefined' &&
      original &&
      !original._retry &&
      !url.includes('/auth/refresh') &&
      !url.includes('/auth/login')
    ) {
      original._retry = true
      if (!refreshPromise) refreshPromise = tryRefreshToken()
      const newToken = await refreshPromise
      refreshPromise = null
      if (newToken) {
        original.headers = original.headers ?? {}
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }
      forceLogout()
    }
    return Promise.reject(error)
  }
)


// Appels publics : sans token, sans intercepteur (vitrine accessible aux visiteurs).
export async function publicApi<T = any>(path: string): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL || ''
  const res = await fetch(`${base}/public${path}`, {
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`public_api_${res.status}`)
  return res.json()
}

export default api
