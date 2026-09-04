/**
 * Self-service PIN change. This is a standard authenticated Appwrite Auth
 * call (`account.updatePassword`) — no Function route needed, the same way
 * any signed-in user may change their own password.
 */
import { useState } from 'react'
import { z } from 'zod'

import { isValidPin, PIN_LENGTH } from '@/core/portal'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { account } from '@/infrastructure/appwrite/services'
import { err, ok, type Result } from '@/core/result'
import { Form, FormError, TextField } from '@/shared/forms'
import { Card, PageHeader } from '@/shared/ui'

const changePinSchema = z
  .object({
    currentPin: z
      .string()
      .trim()
      .refine(isValidPin, { message: `الرقم السري يجب أن يتكوّن من ${PIN_LENGTH} أرقام` }),
    newPin: z
      .string()
      .trim()
      .refine(isValidPin, { message: `الرقم السري الجديد يجب أن يتكوّن من ${PIN_LENGTH} أرقام` }),
    confirmPin: z.string().trim(),
  })
  .refine((v) => v.newPin === v.confirmPin, {
    message: 'الرقم السري الجديد وتأكيده غير متطابقين',
    path: ['confirmPin'],
  })

type ChangePinValues = z.infer<typeof changePinSchema>

export function PortalChangePinPage() {
  const [success, setSuccess] = useState(false)

  return (
    <div className="space-y-4">
      <PageHeader title="تغيير الرقم السري" description="غيّر الرقم السري الخاص بحسابك في البوابة" />

      <Card className="max-w-md">
        <Form<ChangePinValues>
          schema={changePinSchema}
          onSubmit={async (values): Promise<Result<unknown> | void> => {
            setSuccess(false)
            try {
              await account.updatePassword({ password: values.newPin, oldPassword: values.currentPin })
              setSuccess(true)
              return ok(undefined)
            } catch (e) {
              return err(mapAppwriteError(e))
            }
          }}
          className="space-y-4"
        >
          {({ formError, isSubmitting }) => (
            <>
              <TextField
                name="currentPin"
                label="الرقم السري الحالي"
                type="password"
                dir="ltr"
                autoComplete="current-password"
                required
              />
              <TextField
                name="newPin"
                label="الرقم السري الجديد"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                required
              />
              <TextField
                name="confirmPin"
                label="تأكيد الرقم السري الجديد"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                required
              />
              <FormError message={formError} />
              {success ? (
                <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
                  تم تغيير الرقم السري بنجاح.
                </p>
              ) : null}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition disabled:opacity-50 dark:bg-white dark:text-zinc-900"
              >
                {isSubmitting ? 'جارٍ الحفظ…' : 'حفظ'}
              </button>
            </>
          )}
        </Form>
      </Card>
    </div>
  )
}
