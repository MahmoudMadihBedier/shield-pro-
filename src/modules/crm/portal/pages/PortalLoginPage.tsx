import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { isValidPin, PIN_LENGTH } from '@/core/portal'
import { err, type Result } from '@/core/result'
import { Form, FormError, TextField } from '@/shared/forms'
import { Card } from '@/shared/ui'

import { usePortalAuth } from '../auth/portal-context'

const loginSchema = z.object({
  clientId: z.string().trim().min(1, 'كود العميل مطلوب'),
  pin: z
    .string()
    .trim()
    .refine(isValidPin, { message: `الرقم السري يجب أن يتكوّن من ${PIN_LENGTH} أرقام` }),
})

type LoginValues = z.infer<typeof loginSchema>

/** CRM client-portal sign-in. Deliberately has no link back to staff /login. */
export function PortalLoginPage() {
  const { status, login, error } = usePortalAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/portal'

  if (status === 'authenticated') return <Navigate to={from} replace />

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <Card className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-lg font-bold">بوابة العملاء / Client portal</h1>
          <p className="mt-1 text-sm text-zinc-500">
            سجّل الدخول بكود العميل والرقم السري الخاص بك
          </p>
        </div>

        <Form<LoginValues>
          schema={loginSchema}
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
                className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition disabled:opacity-50 dark:bg-white dark:text-zinc-900"
              >
                {isSubmitting ? 'جارٍ الدخول…' : 'دخول'}
              </button>
            </>
          )}
        </Form>
      </Card>
    </div>
  )
}
