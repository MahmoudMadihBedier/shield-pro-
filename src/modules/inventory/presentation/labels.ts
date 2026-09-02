/**
 * Arabic-first (English gloss) display labels for the inventory workflow enums.
 * Presentation-only metadata — kept out of `domain/`.
 */
import type { BadgeTone } from '@/shared/ui'

import type {
  CountSessionStatus,
  TransferStatus,
  WriteOffKind,
} from '../domain/schemas'

export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  pending: 'بانتظار الاعتماد / Pending',
  approved: 'معتمد / Approved',
  rejected: 'مرفوض / Rejected',
  executed: 'تم الإرسال / Sent',
  received: 'تم الاستلام / Received',
}

export const TRANSFER_STATUS_TONE: Record<TransferStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'danger',
  executed: 'info',
  received: 'success',
}

export const COUNT_STATUS_LABEL: Record<CountSessionStatus, string> = {
  open: 'مفتوح / Open',
  submitted: 'مُقدّم / Submitted',
  signed_off: 'معتمد نهائيًا / Signed off',
}

export const COUNT_STATUS_TONE: Record<CountSessionStatus, BadgeTone> = {
  open: 'warning',
  submitted: 'info',
  signed_off: 'success',
}

export const WRITE_OFF_KIND_LABEL: Record<WriteOffKind, string> = {
  damage: 'تلف / Damage',
  loss: 'فقد / Loss',
  scrap: 'خردة / Scrap',
}

export const WRITE_OFF_KIND_OPTIONS = (
  Object.keys(WRITE_OFF_KIND_LABEL) as WriteOffKind[]
).map((value) => ({ value, label: WRITE_OFF_KIND_LABEL[value] }))
