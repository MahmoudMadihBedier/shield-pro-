/**
 * Public surface of the `approvals` module (Phase 2 Story 2.2 — the tiered
 * approval engine's admin-facing side: rule management + the exceptions
 * dashboard).
 */

// --- pages ------------------------------------------------------------------
export { ApprovalRulesListPage, ExceptionsDashboardPage } from './presentation/pages'

// --- routing + nav ------------------------------------------------------
export { approvalsRoutes } from './presentation/routes'
export { APPROVALS_NAV_ROLES, approvalsNavItems } from './presentation/nav'

// --- data (repositories + Function wrappers) --------------------------------
export { approvalRequestsRepo, approvalRuleLogRepo, approvalRulesRepo } from './data/repos'
export type { ListPage, ListSort } from './data/repos'
export {
  decideApprovalRequest,
  evaluateApproval,
  type DecideApprovalPayload,
  type DecideApprovalResult,
  type EvaluateApprovalPayload,
  type EvaluateApprovalResult,
} from './data/decisions'

// --- domain (schemas + the approval engine) ----------------------------------
export {
  APPROVAL_ACTIONS,
  APPROVAL_REQUEST_STATES,
  approvalActionSchema,
  approvalPredicateSchema,
  approvalRequestRowSchema,
  approvalRequestStateSchema,
  approvalRuleInputSchema,
  approvalRuleLogRowSchema,
  approvalRuleRowSchema,
  approvalRuleWireInputSchema,
  decideApproval,
  decodeApprovalPredicate,
  encodeApprovalPredicate,
  type ApprovalContext,
  type ApprovalPredicate,
  type ApprovalRequestRow,
  type ApprovalRequestState,
  type ApprovalRuleAction,
  type ApprovalRuleInput,
  type ApprovalRuleLogRow,
  type ApprovalRuleRow,
  type ApprovalRuleWireInput,
} from './domain/schemas'
export {
  APPROVAL_ACTION_LABELS,
  APPROVAL_ACTION_OPTIONS,
  APPROVAL_STATE_LABELS,
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_TYPE_OPTIONS,
  approvalStateLabel,
  bilingual,
  movementTypeLabel,
  type Label,
} from './domain/labels'
