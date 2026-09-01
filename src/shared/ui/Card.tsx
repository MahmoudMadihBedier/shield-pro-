import type { HTMLAttributes } from 'react'

export type CardProps = HTMLAttributes<HTMLDivElement>

/** Shared surface container matching the app's panel styling. */
export function Card({ className, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900 ${className ?? ''}`}
      {...rest}
    />
  )
}
