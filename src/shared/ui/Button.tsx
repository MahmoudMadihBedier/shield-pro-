import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors duration-150 select-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 dark:bg-brand-500 dark:hover:bg-brand-400',
  secondary:
    'border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-hover)] active:bg-[var(--surface-hover)]',
  ghost:
    'bg-transparent text-[var(--text)] hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9.5 px-3.5 text-sm',
  lg: 'h-11 px-5 text-base',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Show a spinner and block interaction (also sets `disabled`). */
  loading?: boolean
  /** Full-width. */
  block?: boolean
  /** Icon rendered before the label. */
  leadingIcon?: ReactNode
}

/** Shared button primitive. RTL-correct (logical spacing) and theme-aware. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  leadingIcon,
  type,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // callers rarely mean "submit"; default to a safe button
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className ?? ''}`}
      {...rest}
    >
      {loading ? <Spinner className="size-3.5" /> : leadingIcon}
      {children}
    </button>
  )
}
