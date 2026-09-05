/**
 * `incentive_rules` — pure config, System-Admin-writable, everyone reads
 * (`scripts/appwrite/schema.ts` — a `master(...)` table). Same generic CRUD
 * factory the `admin` module uses for its own master data
 * (`@/modules/admin/data/master-repo`); `remove` is exposed because incentive
 * rules have no downstream ledger/document references.
 */
import { makeMasterRepo, makeRemove, type MasterRepo } from '@/modules/admin/data/master-repo'
import { Tables } from '@/infrastructure/appwrite/collections'

import {
  incentiveRuleInputSchema,
  incentiveRuleRowSchema,
  type IncentiveRule,
  type IncentiveRuleInput,
} from '../domain/schemas'

export const incentiveRulesRepo: MasterRepo<IncentiveRule, IncentiveRuleInput> & {
  remove: ReturnType<typeof makeRemove>
} = {
  ...makeMasterRepo({
    tableId: Tables.incentiveRules,
    rowSchema: incentiveRuleRowSchema,
    inputSchema: incentiveRuleInputSchema,
    searchField: 'name',
  }),
  remove: makeRemove(Tables.incentiveRules),
}
