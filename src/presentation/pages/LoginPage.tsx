import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { useAuth } from '@/application/auth/context'
import { APP_NAME, APP_NAME_AR } from '@/shared/constants'
import { Logo } from '@/shared/ui'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const { status, login, error } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  if (status === 'authenticated') return <Navigate to={from} replace />

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values.email, values.password)
      navigate(from, { replace: true })
    } catch {
      setError('root', {
        message: error?.message ?? 'Sign in failed. Check your details and try again.',
      })
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo className="h-14" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">{APP_NAME_AR}</h1>
            <p className="text-sm text-[var(--text-muted)]">{APP_NAME} · تسجيل الدخول للمتابعة</p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
        >
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
              البريد الإلكتروني / Email
            </span>
            <input
              type="email"
              dir="ltr"
              autoComplete="username"
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-start text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
              {...register('email')}
            />
            {errors.email ? (
              <span className="mt-1 block text-xs font-medium text-red-600">
                {errors.email.message}
              </span>
            ) : null}
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
              كلمة المرور / Password
            </span>
            <input
              type="password"
              dir="ltr"
              autoComplete="current-password"
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-start text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
              {...register('password')}
            />
            {errors.password ? (
              <span className="mt-1 block text-xs font-medium text-red-600">
                {errors.password.message}
              </span>
            ) : null}
          </label>

          {errors.root ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {errors.root.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-600 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-400"
          >
            {isSubmitting ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  )
}
