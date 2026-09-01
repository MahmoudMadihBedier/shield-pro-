import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200',
  secondary:
    'border border-black/15 bg-transparent hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10',
  ghost: 'bg-transparent hover:bg-black/5 dark:hover:bg-white/10',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-base',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

/** Shared button primitive. RTL-correct (logical spacing) and dark-mode aware. */
export function Button({
  variant = 'primary',
  size = 'md',
  type,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      // callers rarely mean "submit"; default to a safe button
      type={type ?? 'button'}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className ?? ''}`}
      {...rest}
    />
  )
}
