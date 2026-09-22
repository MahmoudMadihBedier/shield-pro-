/**
 * Chart-of-accounts option list for the account-picker `SelectField`s that
 * used to be free-text (`asset_account`, `source_account`, `treasury_account`)
 * — the account comes from the `admin` master-data repo (single source of
 * truth — never re-declared here), optionally filtered to the account types
 * relevant to the field asking (e.g. only asset accounts for "where did the
 * cash come from").
 */
import { useQuery } from '@tanstack/react-query'

import type { AccountType } from '@/core/accounts'
import type { AppError } from '@/core/errors'
import { chartOfAccountsRepo } from '@/modules/admin'
import type { SelectOption } from '@/shared/forms'

import { accountingKeys } from '../query-keys'

const MAX_ROWS = 300

export function useAccountOptions(types?: readonly AccountType[]) {
  const typeKey = types ? [...types].sort().join(',') : 'all'
  return useQuery<SelectOption[], AppError>({
    queryKey: accountingKeys.options.accounts(typeKey),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await chartOfAccountsRepo.list({
        page: 0,
        pageSize: MAX_ROWS,
        sort: { field: 'account_number', dir: 'asc' },
        filters: [{ field: 'is_active', value: 'true' }],
      })
      if (!res.ok) throw res.error
      const wanted = types ? new Set(types) : null
      return res.value.rows
        .filter((row) => !wanted || wanted.has(row.account_type))
        .map((row) => ({
          value: row.code,
          label: `${row.account_number} ${row.name_ar ?? row.name}`,
        }))
    },
  })
}
