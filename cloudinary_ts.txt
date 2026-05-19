import api from './api'

// ─── Constantes ─────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

// ─── Erreurs typées ─────────────────────────────────────────────────────────

export const CloudinaryErrorCode = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_WRONG_TYPE: 'FILE_WRONG_TYPE',
  SIGNATURE_FAILED: 'SIGNATURE_FAILED',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  PERSIST_FAILED: 'PERSIST_FAILED',
} as const

export type CloudinaryErrorCode =
  (typeof CloudinaryErrorCode)[keyof typeof CloudinaryErrorCode]

export class CloudinaryError extends Error {
  code: CloudinaryErrorCode
  constructor(code: CloudinaryErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
    this.name = 'CloudinaryError'
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface SignatureResponse {
  signature: string
  timestamp: number
  api_key: string
  cloud_name: string
  folder: string
  public_id: string
  upload_preset: string
}

interface CloudinaryUploadResponse {
  secure_url: string
  public_id: string
  width: number
  height: number
  format: string
  bytes: number
}

// ─── Validation locale ──────────────────────────────────────────────────────

export function validateAvatarFile(file: File): void {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new CloudinaryError(CloudinaryErrorCode.FILE_TOO_LARGE)
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new CloudinaryError(CloudinaryErrorCode.FILE_WRONG_TYPE)
  }
}

// ─── Helper principal ───────────────────────────────────────────────────────

/**
 * Upload un avatar de bout en bout :
 *  1. Validation locale
 *  2. Récupère la signature depuis le backend
 *  3. Upload direct vers Cloudinary
 *  4. Persiste l'URL en BDD via le backend
 *
 * @returns L'URL HTTPS de l'avatar sur le CDN Cloudinary
 * @throws CloudinaryError avec un code typé (mappable vers i18n)
 */
export async function uploadAvatar(file: File): Promise<string> {
  // 1. Validation locale (lève une erreur typée si KO)
  validateAvatarFile(file)

  // 2. Demande de signature au backend
  let sig: SignatureResponse
  try {
    const res = await api.post<SignatureResponse>('/users/me/avatar/sign')
    sig = res.data
  } catch (err) {
    throw new CloudinaryError(
      CloudinaryErrorCode.SIGNATURE_FAILED,
      err instanceof Error ? err.message : undefined
    )
  }

  // 3. Upload direct vers Cloudinary
  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', sig.api_key)
  formData.append('timestamp', String(sig.timestamp))
  formData.append('signature', sig.signature)
  formData.append('folder', sig.folder)
  formData.append('public_id', sig.public_id)
  formData.append('overwrite', 'true')
  formData.append('upload_preset', sig.upload_preset)

  const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`

  let cloudinaryResponse: CloudinaryUploadResponse
  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(`HTTP ${response.status}: ${errorBody}`)
    }
    cloudinaryResponse = await response.json()
  } catch (err) {
    throw new CloudinaryError(
      CloudinaryErrorCode.UPLOAD_FAILED,
      err instanceof Error ? err.message : undefined
    )
  }

  // 4. Persiste l'URL en BDD via le backend (anti-spoofing côté serveur)
  try {
    await api.patch('/users/me/avatar', {
      avatar_url: cloudinaryResponse.secure_url,
    })
  } catch (err) {
    throw new CloudinaryError(
      CloudinaryErrorCode.PERSIST_FAILED,
      err instanceof Error ? err.message : undefined
    )
  }

  return cloudinaryResponse.secure_url
}

/**
 * Retire la photo de profil de l utilisateur (avatar_url devient null en BDD).
 * Le fichier reste dans Cloudinary mais n est plus reference.
 */
export async function removeAvatar(): Promise<void> {
  try {
    await api.patch("/users/me/avatar", { avatar_url: null })
  } catch (err) {
    throw new CloudinaryError(
      CloudinaryErrorCode.PERSIST_FAILED,
      err instanceof Error ? err.message : undefined
    )
  }
}

// ─── Helper pour transformer une URL avec dimensions ────────────────────────

/**
 * Transforme une URL Cloudinary pour servir une version optimisée et redimensionnée.
 * Si l'URL n'est pas une URL Cloudinary, la retourne telle quelle.
 *
 * Exemples :
 *   getAvatarUrl(url, 80)  → version 80x80 optimisée
 *   getAvatarUrl(url, 200) → version 200x200 optimisée
 *
 * @param url URL Cloudinary brute (depuis user.avatar_url)
 * @param size Taille en pixels (carré)
 */
export function getAvatarUrl(url: string | null | undefined, size = 200): string | null {
  if (!url) return null
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
    return url
  }
  const transform = `c_fill,w_${size},h_${size},g_face,q_auto,f_auto`
  return url.replace('/image/upload/', `/image/upload/${transform}/`)
}