/**
 * Arabic-first display labels + badge tones for the manufacturing enums.
 * Dependency-light (no react) so pages and nav can share it.
 */
import type { BadgeTone } from '@/shared/ui'

import type { ProductionRequestStatus, QcStatus } from '../domain/schemas'

export const REQUEST_STATUS_LABEL: Record<ProductionRequestStatus, string> = {
  pending: 'قيد الانتظار',
  approved: 'معتمد',
  rejected: 'مرفوض',
  issued: 'مُصدر',
}

export const REQUEST_STATUS_TONE: Record<ProductionRequestStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'danger',
  issued: 'success',
}

export const QC_STATUS_LABEL: Record<QcStatus, string> = {
  pending_qc: 'بانتظار الفحص',
  released: 'معتمد',
  rejected: 'مرفوض',
}

export const QC_STATUS_TONE: Record<QcStatus, BadgeTone> = {
  pending_qc: 'warning',
  released: 'success',
  rejected: 'danger',
}
