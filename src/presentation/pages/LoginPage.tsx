import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { useAuth } from '@/application/auth/context'
import { APP_NAME, APP_NAME_AR } from '@/shared/constants'

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
    <div className="flex min-h-screen items-center justify-center px-5">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900"
      >
        <div>
          <h1 className="text-lg font-bold">
            {APP_NAME_AR} <span className="text-zinc-400">/ {APP_NAME}</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Sign in to continue</p>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">Email</span>
          <input
            type="email"
            autoComplete="username"
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-zinc-500 dark:border-white/15"
            {...register('email')}
          />
          {errors.email ? (
            <span className="mt-1 block text-xs text-red-600">{errors.email.message}</span>
          ) : null}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-zinc-500 dark:border-white/15"
            {...register('password')}
          />
          {errors.password ? (
            <span className="mt-1 block text-xs text-red-600">{errors.password.message}</span>
          ) : null}
        </label>

        {errors.root ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {errors.root.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
