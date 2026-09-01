import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { appError } from '@/core/errors'
import { err } from '@/core/result'

import { Form, FormError, type FormSubmitOutcome } from '../Form'
import { NumberField, TextField } from '../fields'

const schema = z.object({
  name: z.string().min(2, 'الاسم قصير جدًا'),
  qty: z.number().positive('الكمية يجب أن تكون أكبر من صفر'),
})

type Values = z.infer<typeof schema>

function Harness({
  onSubmit,
}: {
  onSubmit: (values: Values) => Promise<FormSubmitOutcome> | FormSubmitOutcome
}) {
  return (
    <Form schema={schema} defaultValues={{ name: '', qty: 0 }} onSubmit={onSubmit}>
      {({ formError, isSubmitting }) => (
        <>
          <TextField name="name" label="الاسم" />
          <NumberField name="qty" label="الكمية" />
          <FormError message={formError} />
          <button type="submit" disabled={isSubmitting}>
            حفظ
          </button>
        </>
      )}
    </Form>
  )
}

describe('Form', () => {
  it('blocks submit and shows every field error when the input is invalid', async () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)

    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))

    expect(await screen.findByText('الاسم قصير جدًا')).toBeInTheDocument()
    expect(screen.getByText('الكمية يجب أن تكون أكبر من صفر')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with Zod-parsed, coerced values on a valid submit', async () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText(/الاسم/), 'أحمد')
    const qty = screen.getByLabelText(/الكمية/)
    await userEvent.clear(qty)
    await userEvent.type(qty, '5')
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ name: 'أحمد', qty: 5 })
    expect(typeof onSubmit.mock.calls[0]?.[0].qty).toBe('number')
  })

  it('surfaces an err(...) submit result as a form-level message', async () => {
    const onSubmit = vi.fn().mockResolvedValue(err(appError('conflict', 'هذا السجل موجود بالفعل')))
    render(<Harness onSubmit={onSubmit} />)

    await userEvent.type(screen.getByLabelText(/الاسم/), 'أحمد')
    const qty = screen.getByLabelText(/الكمية/)
    await userEvent.clear(qty)
    await userEvent.type(qty, '5')
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))

    expect(await screen.findByText('هذا السجل موجود بالفعل')).toBeInTheDocument()
  })
})
