'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

import { Button, Input } from '@/components/ui/kipar'
import { useTranslation } from '@/hooks/useTranslation'
import api from '@/lib/api'

const schema = z.object({
  first_name: z.string().min(2, 'Prénom requis'),
  last_name: z.string().min(2, 'Nom requis'),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, '8 caractères minimum'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirm_password'],
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      await api.post('/auth/register', {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        password: data.password,
      })
      toast.success('Compte créé avec succès !')
      router.push('/login')
    } catch (err: any) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map((e: any) => e.message).join(' — ')
        : detail || t.errors.generic
      toast.error(msg)
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto px-6 pt-10 pb-8 flex flex-col">

      {/* Logo */}
      <div className="text-center mb-6 animate-fade-up">
        <span className="font-syne text-3xl font-extrabold text-kipar-green tracking-tight">
          KIPAR<span className="text-kipar-green-mid">.</span>
        </span>
      </div>

      {/* Titre */}
      <div className="mb-6 animate-fade-up delay-1">
        <h1 className="font-syne text-2xl font-bold text-kipar-text">
          {t.auth.register_title}
        </h1>
        <p className="text-sm text-kipar-muted mt-1">{t.auth.register_subtitle}</p>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

        <div className="grid grid-cols-2 gap-3 animate-fade-up delay-1">
          <Input
            label={t.auth.first_name}
            placeholder="Aminata"
            leftIcon={<User className="w-4 h-4" />}
            error={errors.first_name?.message}
            {...register('first_name')}
          />
          <Input
            label={t.auth.last_name}
            placeholder="Diallo"
            error={errors.last_name?.message}
            {...register('last_name')}
          />
        </div>

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
            placeholder="8 caractères minimum"
            leftIcon={<Lock className="w-4 h-4" />}
            rightIcon={
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="text-kipar-muted hover:text-kipar-text transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            error={errors.password?.message}
            {...register('password')}
          />
        </div>

        <div className="animate-fade-up delay-4">
          <Input
            label="Confirmer le mot de passe"
            type={showConfirm ? 'text' : 'password'}
            placeholder="••••••••"
            leftIcon={<Lock className="w-4 h-4" />}
            rightIcon={
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="text-kipar-muted hover:text-kipar-text transition-colors">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            error={errors.confirm_password?.message}
            {...register('confirm_password')}
          />
        </div>

        <div className="animate-fade-up delay-5">
          <Button
            type="submit"
            fullWidth
            loading={isSubmitting}
            size="lg"
            className="tracking-widest text-sm font-semibold mt-2"
          >
            {t.auth.register_btn}
          </Button>
        </div>
      </form>

      {/* Lien login */}
      <p className="text-center text-sm text-kipar-muted mt-6 animate-fade-up delay-5">
        {t.auth.already_account}{' '}
        <Link href="/login" className="text-kipar-green font-medium hover:underline">
          {t.auth.sign_in}
        </Link>
      </p>
    </div>
  )
}
