/**
 * Thin bindings of the shared submittable-document hooks (`@/shared/documents`)
 * to the `payroll_runs` repo. Presentation code calls these instead of passing
 * the repo around directly.
 */
import {
  useDocument,
  useDocumentActions,
  useDocumentList,
  type DocumentListParams,
} from '@/shared/documents'

import { payrollRunsRepo } from '../../data/payroll-repo'

export const usePayrollRunList = (params: DocumentListParams = {}) =>
  useDocumentList(payrollRunsRepo, params)

export const usePayrollRun = (id: string | undefined) => useDocument(payrollRunsRepo, id)

export const usePayrollRunActions = () => useDocumentActions(payrollRunsRepo)
