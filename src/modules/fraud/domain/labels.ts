/**
 * Arabic-first (with English gloss) display labels for `fraud_flags.kind` and
 * `.status`. Presentation reads these so no component hard-codes a label.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import type { FraudFlagKind, FraudFlagStatus } from './schemas'

export interface Label {
  ar: string
  en: string
}

export const FRAUD_KIND_LABELS: Record<FraudFlagKind, Label> = {
  round_tripping: { ar: 'حركة دائرية', en: 'Round-tripping' },
  repeated_movement: { ar: 'حركة متكررة', en: 'Repeated movement' },
  high_reversal_ratio: { ar: 'نسبة إلغاء مرتفعة', en: 'High reversal ratio' },
}

export const FRAUD_STATUS_LABELS: Record<FraudFlagStatus, Label> = {
  open: { ar: 'مفتوح', en: 'Open' },
  reviewed: { ar: 'تمت المراجعة', en: 'Reviewed' },
  dismissed: { ar: 'مرفوض', en: 'Dismissed' },
}

/** Convenience: `"عربي / English"`. */
export function bilingual(label: Label): string {
  return `${label.ar} / ${label.en}`
}
