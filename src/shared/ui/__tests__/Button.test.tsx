import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from '../Button'

describe('Button', () => {
  it('renders its children and defaults to type="button"', () => {
    render(<Button>حفظ</Button>)
    const button = screen.getByRole('button', { name: 'حفظ' })
    expect(button).toHaveAttribute('type', 'button')
  })

  it('fires onClick when enabled and not when disabled', async () => {
    const onClick = vi.fn()
    const { rerender } = render(<Button onClick={onClick}>تم</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'تم' }))
    expect(onClick).toHaveBeenCalledOnce()

    rerender(
      <Button onClick={onClick} disabled>
        تم
      </Button>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'تم' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies variant styling', () => {
    render(<Button variant="danger">حذف</Button>)
    expect(screen.getByRole('button', { name: 'حذف' }).className).toContain('bg-red-600')
  })
})
