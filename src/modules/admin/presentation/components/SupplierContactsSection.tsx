/**
 * Multiple contact people for one supplier (purchasing lead, accounts
 * payable, delivery coordinator, …) — a real child table (`supplier_contacts`),
 * so each one is independently addable / removable, not a size-limited blob.
 * Only rendered inside the supplier edit dialog (`MasterFormPanel`), once the
 * supplier row exists.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { CheckboxField, Form, FormError, TextField } from '@/shared/forms'
import { Badge, Button } from '@/shared/ui'

import {
  createSupplierContact,
  listSupplierContacts,
  removeSupplierContact,
} from '../../data/supplier-contacts-repo'
import { SUPPLIER_CONTACT_FIELD_LABELS } from '../../domain/labels'
import { supplierContactInputSchema, type SupplierContactInput } from '../../domain/schemas'

const EMPTY_CONTACT: SupplierContactInput = {
  contact_name: '',
  role_title: '',
  phone: '',
  email: '',
  is_primary: false,
}

const LABEL = (field: keyof typeof SUPPLIER_CONTACT_FIELD_LABELS) =>
  SUPPLIER_CONTACT_FIELD_LABELS[field]!

export interface SupplierContactsSectionProps {
  supplierId: string
}

export function SupplierContactsSection({ supplierId }: SupplierContactsSectionProps) {
  const queryClient = useQueryClient()
  const queryKey = ['admin', 'supplierContacts', supplierId] as const
  const [formKey, setFormKey] = useState(0)

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await listSupplierContacts(supplierId)
      if (!result.ok) throw result.error
      return result.value
    },
  })

  const createMutation = useMutation({
    mutationFn: async (input: SupplierContactInput) => {
      const result = await createSupplierContact(supplierId, input)
      if (!result.ok) throw result.error
      return result.value
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await removeSupplierContact(id)
      if (!result.ok) throw result.error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  })

  async function handleSubmit(values: SupplierContactInput): Promise<Result<unknown>> {
    try {
      await createMutation.mutateAsync(values)
      setFormKey((k) => k + 1) // remount the form to clear it after a successful add
      return ok(undefined)
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && 'message' in e) {
        return err(e as ReturnType<typeof appError>)
      }
      return err(appError('unknown', 'تعذّر حفظ جهة الاتصال. حاول مرة أخرى.'))
    }
  }

  return (
    <div className="space-y-3 border-t border-black/10 pt-3 dark:border-white/10">
      <div className="text-xs font-medium text-[var(--text-muted)]">جهات الاتصال / Contacts</div>

      {query.isLoading ? <p className="text-xs text-zinc-500">جارٍ التحميل…</p> : null}
      {query.isError ? (
        <p className="text-xs text-red-600 dark:text-red-400">{query.error.message}</p>
      ) : null}

      {query.data && query.data.length > 0 ? (
        <ul className="space-y-2">
          {query.data.map((contact) => (
            <li
              key={contact.$id}
              className="flex items-center justify-between gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10"
            >
              <div>
                <div className="font-medium">
                  {contact.contact_name}
                  {contact.is_primary ? (
                    <Badge tone="info" className="ms-2">
                      أساسي
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-zinc-500">
                  {[contact.role_title, contact.phone, contact.email].filter(Boolean).join(' · ') ||
                    '—'}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={removeMutation.isPending}
                onClick={() => void removeMutation.mutateAsync(contact.$id)}
              >
                حذف
              </Button>
            </li>
          ))}
        </ul>
      ) : !query.isLoading ? (
        <p className="text-xs text-zinc-500">لا توجد جهات اتصال بعد.</p>
      ) : null}

      <Form
        key={formKey}
        schema={supplierContactInputSchema}
        defaultValues={EMPTY_CONTACT}
        onSubmit={handleSubmit}
        className="space-y-2"
      >
        {({ formError, isSubmitting }) => (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <TextField
                name="contact_name"
                label={LABEL('contact_name').ar}
                labelEn={LABEL('contact_name').en}
                required
              />
              <TextField
                name="role_title"
                label={LABEL('role_title').ar}
                labelEn={LABEL('role_title').en}
              />
              <TextField
                name="phone"
                label={LABEL('phone').ar}
                labelEn={LABEL('phone').en}
                placeholder="01012345678"
              />
              <TextField
                name="email"
                label={LABEL('email').ar}
                labelEn={LABEL('email').en}
                type="email"
              />
            </div>
            <CheckboxField
              name="is_primary"
              label={LABEL('is_primary').ar}
              labelEn={LABEL('is_primary').en}
            />
            <FormError message={formError} />
            <Button type="submit" size="sm" variant="secondary" disabled={isSubmitting}>
              {isSubmitting ? 'جارٍ الإضافة…' : '+ إضافة جهة اتصال'}
            </Button>
          </>
        )}
      </Form>
    </div>
  )
}
