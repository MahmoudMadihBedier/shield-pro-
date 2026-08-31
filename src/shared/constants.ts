/** App-wide constants. Locale/currency defaults per the Arabic-first product. */

export const APP_NAME = 'Shield Pro'
export const APP_NAME_AR = 'شيلد برو'

export const DEFAULT_LOCALE = 'ar-EG'
export const DEFAULT_CURRENCY = 'EGP'
export const DEFAULT_DIRECTION = 'rtl' as const

/** How often the app re-checks Appwrite connectivity, in ms. */
export const HEALTH_POLL_INTERVAL_MS = 30_000

/** Payment methods the system must distinguish (Business Process doc §5.1). */
export const PaymentMethod = {
  Cash: 'cash',
  Credit: 'credit',
  BankTransfer: 'bank_transfer',
  Partial: 'partial',
  PostDatedCheque: 'post_dated_cheque',
} as const

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]
