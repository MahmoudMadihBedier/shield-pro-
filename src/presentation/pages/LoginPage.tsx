import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { useAuth } from '@/application/auth/context'
import { isValidPin, PIN_LENGTH } from '@/core/portal'
import type { Result } from '@/core/result'
import { err } from '@/core/result'
// Leaf import, not the `@/modules/crm` barrel — that barrel is pulled in
// eagerly by `AppProviders` (`PortalAuthProvider`) and must stay light; this
// context module is a tiny `createContext`/`use` file with no heavy imports,
// so pulling it into this already-lazy page costs nothing extra.
import { usePortalAuth } from '@/modules/crm/portal/auth/portal-context'
import { Form, FormError, TextField } from '@/shared/forms'
import { APP_NAME, APP_NAME_AR } from '@/shared/constants'
import { Logo } from '@/shared/ui'

import { resolveFrom, type LoginMode } from './login-routing'

const staffLoginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type StaffLoginValues = z.infer<typeof staffLoginSchema>

const portalLoginSchema = z.object({
  clientId: z.string().trim().min(1, 'كود العميل مطلوب'),
  pin: z
    .string()
    .trim()
    .refine(isValidPin, { message: `الرقم السري يجب أن يتكوّن من ${PIN_LENGTH} أرقام` }),
})
type PortalLoginValues = z.infer<typeof portalLoginSchema>

const MODE_LABEL: Record<LoginMode, { ar: string; en: string }> = {
  staff: { ar: 'دخول الموظفين', en: 'Staff' },
  portal: { ar: 'بوابة العملاء', en: 'Client portal' },
}

function ModeToggle({ mode, onChange }: { mode: LoginMode; onChange: (m: LoginMode) => void }) {
  return (
    <div
      role="tablist"
      aria-label="نوع الدخول / Login type"
      className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1"
    >
      {(Object.keys(MODE_LABEL) as LoginMode[]).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          onClick={() => onChange(m)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === m
              ? 'bg-brand-600 text-white dark:bg-brand-500'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          {MODE_LABEL[m].ar} / {MODE_LABEL[m].en}
        </button>
      ))}
    </div>
  )
}

function StaffLoginForm({ from }: { from: string }) {
  const { login, error } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StaffLoginValues>({ resolver: zodResolver(staffLoginSchema) })

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
    <form onSubmit={onSubmit} className="space-y-4">
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
  )
}

function PortalLoginForm({ from }: { from: string }) {
  const { login, error } = usePortalAuth()
  const navigate = useNavigate()

  return (
    <Form<PortalLoginValues>
      schema={portalLoginSchema}
      onSubmit={async (values): Promise<Result<unknown> | void> => {
        try {
          await login(values.clientId, values.pin)
          navigate(from, { replace: true })
        } catch {
          return err(
            error ?? {
              code: 'unknown',
              message: 'تعذّر تسجيل الدخول. تحقّق من كود العميل والرقم السري وحاول مرة أخرى.',
            },
          )
        }
      }}
      className="space-y-4"
    >
      {({ formError, isSubmitting }) => (
        <>
          <TextField
            name="clientId"
            label="كود العميل"
            labelEn="Client ID"
            autoComplete="username"
            required
          />
          <TextField
            name="pin"
            label="الرقم السري"
            labelEn="PIN"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            required
          />
          <FormError message={formError} />
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-600 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-400"
          >
            {isSubmitting ? 'جارٍ الدخول…' : 'دخول'}
          </button>
        </>
      )}
    </Form>
  )
}

export interface LoginPageProps {
  /** Which form the toggle starts on — `/login` passes 'staff', `/portal/login` passes 'portal'. */
  initialMode?: LoginMode
}

/**
 * The one login screen for both audiences — a staff member and a CRM/portal
 * customer are still fully separate identities and sessions
 * (`AuthProvider` vs `PortalAuthProvider`, always both mounted — see
 * `AppProviders`), this only unifies which *form* the visitor sees. Reachable
 * at both `/login` and `/portal/login` (see `router.tsx` / `crm/portal/routes.tsx`)
 * so either bookmark still lands on a sensible default tab.
 */
export function LoginPage({ initialMode = 'staff' }: LoginPageProps) {
  const [mode, setMode] = useState<LoginMode>(initialMode)
  const { status: staffStatus } = useAuth()
  const { status: portalStatus } = usePortalAuth()
  const location = useLocation()
  const stateFrom = (location.state as { from?: string } | null)?.from

  // Whichever session is already live wins — a visitor who is already signed
  // in one way and lands here (e.g. a stale bookmark) is bounced straight to
  // their own home, regardless of which tab is currently selected.
  if (staffStatus === 'authenticated')
    return <Navigate to={resolveFrom('staff', stateFrom)} replace />
  if (portalStatus === 'authenticated') {
    return <Navigate to={resolveFrom('portal', stateFrom)} replace />
  }

  const from = resolveFrom(mode, stateFrom)

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

        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <ModeToggle mode={mode} onChange={setMode} />
          {mode === 'staff' ? <StaffLoginForm from={from} /> : <PortalLoginForm from={from} />}
        </div>
      </div>
    </div>
  )
}
