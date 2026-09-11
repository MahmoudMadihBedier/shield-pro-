/**
 * Staff-side hooks for the leads pipeline. Read + create + stage change +
 * link-converted-customer + delete, against `leads` (branch-scoped RLS).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'

import {
  createLead,
  deleteLead,
  getLead,
  linkConvertedCustomer,
  listLeads,
  listLeadStageEvents,
  setLeadStage,
  updateLead,
  type CreateLeadInput,
  type UpdateLeadInput,
} from '../data/leads-repo'
import {
  sortLeads,
  sortStageEvents,
  type LeadRow,
  type LeadStage,
  type LeadStageEvent,
} from '../domain/lead'
import { crmLeadsKeys } from '../query-keys'

export function useLeads() {
  return useQuery<LeadRow[], AppError>({
    queryKey: crmLeadsKeys.list(),
    queryFn: async () => {
      const res = await listLeads()
      if (!res.ok) throw res.error
      return sortLeads(res.value)
    },
  })
}

export function useLead(id: string | undefined) {
  return useQuery<LeadRow, AppError>({
    queryKey: crmLeadsKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await getLead(id as string)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

export function useLeadStageEvents(id: string | undefined) {
  return useQuery<LeadStageEvent[], AppError>({
    queryKey: crmLeadsKeys.events(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await listLeadStageEvents(id as string)
      if (!res.ok) throw res.error
      return sortStageEvents(res.value)
    },
  })
}

export function useUpdateLead(id: string) {
  const queryClient = useQueryClient()
  return useMutation<LeadRow, AppError, UpdateLeadInput>({
    mutationFn: async (input) => {
      const res = await updateLead(id, input)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmLeadsKeys.root() })
    },
  })
}

export function useCreateLead() {
  const queryClient = useQueryClient()
  return useMutation<LeadRow, AppError, CreateLeadInput>({
    mutationFn: async (input) => {
      const res = await createLead(input)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmLeadsKeys.root() })
    },
  })
}

export function useSetLeadStage() {
  const queryClient = useQueryClient()
  return useMutation<
    LeadRow,
    AppError,
    { id: string; stage: LeadStage; lostReason?: string | null }
  >({
    mutationFn: async ({ id, stage, lostReason }) => {
      const res = await setLeadStage(id, stage, lostReason)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmLeadsKeys.root() })
    },
  })
}

export function useLinkConvertedCustomer() {
  const queryClient = useQueryClient()
  return useMutation<LeadRow, AppError, { id: string; customerId: string }>({
    mutationFn: async ({ id, customerId }) => {
      const res = await linkConvertedCustomer(id, customerId)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmLeadsKeys.root() })
    },
  })
}

export function useDeleteLead() {
  const queryClient = useQueryClient()
  return useMutation<null, AppError, string>({
    mutationFn: async (id) => {
      const res = await deleteLead(id)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmLeadsKeys.root() })
    },
  })
}
