'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

import { Button, Input } from '@/components/ui/kipar'
import { useAuthStore } from '@/stores/auth.store'
import { useTranslation } from '@/hooks/useTranslation'
import api from '@/lib/api'

const schema = z.object({
  email: z.string().min(1, 'Email requis'),
  password: z.string().min(6, 'Mot de passe trop court'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { setToken, setUser } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post('/auth/login', data)
      setToken(res.data.access_token)
      const me = await api.get('/users/me')
      setUser(me.data)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t.errors.invalid_credentials)
    }
  }

  const handleOAuth = async (provider: 'google' | 'apple') => {
    try {
      const res = await api.post(`/auth/${provider}`, { id_token: 'simulated_token' })
      setToken(res.data.access_token)
      const me = await api.get('/users/me')
      setUser(me.data)
      router.push('/dashboard')
    } catch {
      toast.error(t.errors.generic)
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto px-6 pt-12 pb-8 flex flex-col">

      {/* Logo */}
      <div className="text-center mb-2 animate-fade-up">
        <span className="font-syne text-4xl font-extrabold text-kipar-green tracking-tight">
          KIPAR<span className="text-kipar-green-mid">.</span>
        </span>
        <p className="text-sm text-kipar-muted mt-1">{t.auth.login_subtitle}</p>
      </div>

      {/* Illustration */}
      <div className="flex justify-center my-6 animate-fade-up delay-1">
        <img src="/images/hero-login.webp" alt="Kipar illustration" className="w-64 h-auto object-contain" />
      </div>

      {/* Titre */}
      <h1 className="font-syne text-2xl font-bold text-kipar-text mb-6 text-center animate-fade-up delay-2">
        {t.auth.login_title}
      </h1>

      {/* Formulaire */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="animate-fade-up delay-2">
          <Input
            label={t.auth.email_label}
            type="email"
            placeholder={t.auth.email_placeholder}
            leftIcon={<Mail className="w-4 h-4" />}
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <div className="animate-fade-up delay-3">
          <Input
            label={t.auth.password_label}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            leftIcon={<Lock className="w-4 h-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-kipar-muted hover:text-kipar-text transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="text-right mt-1.5">
            <Link href="/forgot-password" className="text-xs text-kipar-green hover:underline">
              {t.auth.forgot_password}
            </Link>
          </div>
        </div>

        <div className="animate-fade-up delay-4">
          <Button
            type="submit"
            fullWidth
            loading={isSubmitting}
            size="lg"
            className="tracking-widest text-sm font-semibold"
          >
            {t.auth.login_btn}
          </Button>
        </div>
      </form>

      {/* Séparateur OAuth */}
      <div className="animate-fade-up delay-5">
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-kipar-border" />
          <span className="text-xs text-kipar-muted whitespace-nowrap">
            {t.auth.or_connect_with}
          </span>
          <div className="flex-1 h-px bg-kipar-border" />
        </div>

        <div className="flex justify-center gap-4">
          {/* Google */}
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            className="w-12 h-12 rounded-full border border-kipar-border bg-white flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.87v2.07A8 8 0 008.98 17z"/>
              <path fill="#FBBC05" d="M4.51 10.52A4.8 4.8 0 014.26 9c0-.53.09-1.04.25-1.52V5.41H1.87A8 8 0 001 9c0 1.3.31 2.53.87 3.59l2.64-2.07z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.87 5.4L4.5 7.48C5.14 5.6 6.9 4.18 8.98 4.18z"/>
            </svg>
          </button>

          {/* Facebook */}
          <button
            type="button"
            className="w-12 h-12 rounded-full border border-kipar-border bg-white flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </button>

          {/* Apple */}
          <button
            type="button"
            onClick={() => handleOAuth('apple')}
            className="w-12 h-12 rounded-full border border-kipar-border bg-white flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#000">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Lien inscription */}
      <p className="text-center text-sm text-kipar-muted mt-6 animate-fade-up delay-5">
        {t.auth.no_account}{' '}
        <Link href="/register" className="text-kipar-green font-medium hover:underline">
          {t.auth.sign_up}
        </Link>
      </p>
    </div>
  )
}
