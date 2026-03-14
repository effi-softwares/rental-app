import { useMutation, useQueryClient } from "@tanstack/react-query"

import { rentalsQueryKeys } from "@/features/rentals/queries/keys"
import type {
	CollectCashPaymentPayload,
	CollectCashPaymentResponse,
	CollectRentalChargePayload,
	CollectRentalChargeResponse,
	ConfirmRentalPaymentPayload,
	ConfirmRentalPaymentResponse,
	CreateRentalChargePayload,
	ExtendRentalPayload,
	ExtendRentalResponse,
	FinalizeRentalPayload,
	FinalizeRentalResponse,
	HandoverRentalPayload,
	HandoverRentalResponse,
	PrepareRentalPaymentPayload,
	PrepareRentalPaymentResponse,
	RentalChargeMutationResponse,
	RentalCommitPayload,
	RentalCommitResponse,
	ResolveRentalDepositPayload,
	ResolveRentalDepositResponse,
	ReturnRentalPayload,
	ReturnRentalResponse,
	SaveRentalInspectionPayload,
	SaveRentalInspectionResponse,
	UpdateRentalChargePayload,
} from "@/features/rentals/types/rental"

function toJsonHeaders() {
	return { "Content-Type": "application/json" }
}

async function assertOk(response: Response, fallbackMessage: string) {
	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as {
			error?: string
		} | null
		throw new Error(payload?.error ?? fallbackMessage)
	}
}

function hydrateRentalDetailCache(input: {
	queryClient: ReturnType<typeof useQueryClient>
	organizationId?: string
	detail: RentalCommitResponse
}) {
	input.queryClient.setQueryData(
		rentalsQueryKeys.detail(input.organizationId, input.detail.rental.id),
		input.detail,
	)
}

export function useCommitRentalMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (payload: RentalCommitPayload) => {
			const response = await fetch("/api/rentals", {
				method: "POST",
				headers: toJsonHeaders(),
				body: JSON.stringify(payload),
			})

			await assertOk(response, "Failed to save rental.")
			return (await response.json()) as RentalCommitResponse
		},
		onSuccess: async (detail) => {
			hydrateRentalDetailCache({
				queryClient,
				organizationId,
				detail,
			})
			await queryClient.invalidateQueries({ queryKey: rentalsQueryKeys.all })
		},
	})
}

export function useRecommitRentalMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			rentalId,
			payload,
		}: {
			rentalId: string
			payload: RentalCommitPayload
		}) => {
			const response = await fetch(`/api/rentals/${rentalId}`, {
				method: "PATCH",
				headers: toJsonHeaders(),
				body: JSON.stringify(payload),
			})

			await assertOk(response, "Failed to update rental.")
			return (await response.json()) as RentalCommitResponse
		},
		onSuccess: async (detail) => {
			hydrateRentalDetailCache({
				queryClient,
				organizationId,
				detail,
			})
			await queryClient.invalidateQueries({ queryKey: rentalsQueryKeys.all })
		},
	})
}

export function useFinalizeRentalMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			rentalId,
			payload,
		}: {
			rentalId: string
			payload: FinalizeRentalPayload
		}) => {
			const response = await fetch(`/api/rentals/${rentalId}/finalize`, {
				method: "POST",
				headers: toJsonHeaders(),
				body: JSON.stringify(payload),
			})

			await assertOk(response, "Failed to finalize rental.")
			return (await response.json()) as FinalizeRentalResponse
		},
		onSuccess: async (_, variables) => {
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.all,
			})
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.detail(organizationId, variables.rentalId),
			})
		},
	})
}

export function usePrepareRentalPaymentMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			rentalId,
			payload,
		}: {
			rentalId: string
			payload?: PrepareRentalPaymentPayload
		}) => {
			const response = await fetch(`/api/rentals/${rentalId}/payment/prepare`, {
				method: "POST",
				headers: toJsonHeaders(),
				body: JSON.stringify(payload ?? {}),
			})

			await assertOk(response, "Failed to prepare rental payment.")
			return (await response.json()) as PrepareRentalPaymentResponse
		},
		onSuccess: async (_, variables) => {
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.detail(organizationId, variables.rentalId),
			})
		},
	})
}

export function useCollectCashPaymentMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			rentalId,
			payload,
		}: {
			rentalId: string
			payload: CollectCashPaymentPayload
		}) => {
			const response = await fetch(
				`/api/rentals/${rentalId}/payment/collect-cash`,
				{
					method: "POST",
					headers: toJsonHeaders(),
					body: JSON.stringify(payload),
				},
			)

			await assertOk(response, "Failed to collect cash payment.")
			return (await response.json()) as CollectCashPaymentResponse
		},
		onSuccess: async (_, variables) => {
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.detail(organizationId, variables.rentalId),
			})
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.all,
			})
		},
	})
}

export function useConfirmRentalPaymentMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			rentalId,
			payload,
		}: {
			rentalId: string
			payload: ConfirmRentalPaymentPayload
		}) => {
			const response = await fetch(`/api/rentals/${rentalId}/payment/confirm`, {
				method: "POST",
				headers: toJsonHeaders(),
				body: JSON.stringify(payload),
			})

			await assertOk(response, "Failed to confirm rental payment.")
			return (await response.json()) as ConfirmRentalPaymentResponse
		},
		onSuccess: async (_, variables) => {
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.detail(organizationId, variables.rentalId),
			})
		},
	})
}

export function useHandoverRentalMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			rentalId,
			payload,
		}: {
			rentalId: string
			payload?: HandoverRentalPayload
		}) => {
			const response = await fetch(`/api/rentals/${rentalId}/handover`, {
				method: "POST",
				headers: toJsonHeaders(),
				body: JSON.stringify(payload ?? {}),
			})

			await assertOk(response, "Failed to hand over rental.")
			return (await response.json()) as HandoverRentalResponse
		},
		onSuccess: async (_, variables) => {
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.all,
			})
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.detail(organizationId, variables.rentalId),
			})
		},
	})
}

export function useReturnRentalMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			rentalId,
			payload,
		}: {
			rentalId: string
			payload?: ReturnRentalPayload
		}) => {
			const response = await fetch(`/api/rentals/${rentalId}/return`, {
				method: "POST",
				headers: toJsonHeaders(),
				body: JSON.stringify(payload ?? {}),
			})

			await assertOk(response, "Failed to complete rental return.")
			return (await response.json()) as ReturnRentalResponse
		},
		onSuccess: async (_, variables) => {
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.all,
			})
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.detail(organizationId, variables.rentalId),
			})
		},
	})
}

export function useSaveRentalInspectionMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			rentalId,
			stage,
			payload,
		}: {
			rentalId: string
			stage: "pickup" | "return"
			payload: SaveRentalInspectionPayload
		}) => {
			const response = await fetch(
				`/api/rentals/${rentalId}/inspection/${stage}`,
				{
					method: "POST",
					headers: toJsonHeaders(),
					body: JSON.stringify(payload),
				},
			)

			await assertOk(response, "Failed to save rental inspection.")
			return (await response.json()) as SaveRentalInspectionResponse
		},
		onSuccess: async (_, variables) => {
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.detail(organizationId, variables.rentalId),
			})
		},
	})
}

export function useExtendRentalMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			rentalId,
			payload,
		}: {
			rentalId: string
			payload: ExtendRentalPayload
		}) => {
			const response = await fetch(`/api/rentals/${rentalId}/extend`, {
				method: "POST",
				headers: toJsonHeaders(),
				body: JSON.stringify(payload),
			})

			await assertOk(response, "Failed to extend rental.")
			return (await response.json()) as ExtendRentalResponse
		},
		onSuccess: async (_, variables) => {
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.all,
			})
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.detail(organizationId, variables.rentalId),
			})
		},
	})
}

export function useCreateRentalChargeMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			rentalId,
			payload,
		}: {
			rentalId: string
			payload: CreateRentalChargePayload
		}) => {
			const response = await fetch(`/api/rentals/${rentalId}/charges`, {
				method: "POST",
				headers: toJsonHeaders(),
				body: JSON.stringify(payload),
			})

			await assertOk(response, "Failed to create rental charge.")
			return (await response.json()) as RentalChargeMutationResponse
		},
		onSuccess: async (_, variables) => {
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.detail(organizationId, variables.rentalId),
			})
		},
	})
}

export function useUpdateRentalChargeMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			rentalId,
			chargeId,
			payload,
		}: {
			rentalId: string
			chargeId: string
			payload: UpdateRentalChargePayload
		}) => {
			const response = await fetch(
				`/api/rentals/${rentalId}/charges/${chargeId}`,
				{
					method: "PATCH",
					headers: toJsonHeaders(),
					body: JSON.stringify(payload),
				},
			)

			await assertOk(response, "Failed to update rental charge.")
			return (await response.json()) as RentalChargeMutationResponse
		},
		onSuccess: async (_, variables) => {
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.detail(organizationId, variables.rentalId),
			})
		},
	})
}

export function useCollectRentalChargeMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			rentalId,
			chargeId,
			payload,
		}: {
			rentalId: string
			chargeId: string
			payload: CollectRentalChargePayload
		}) => {
			const response = await fetch(
				`/api/rentals/${rentalId}/charges/${chargeId}/collect`,
				{
					method: "POST",
					headers: toJsonHeaders(),
					body: JSON.stringify(payload),
				},
			)

			await assertOk(response, "Failed to collect rental charge.")
			return (await response.json()) as CollectRentalChargeResponse
		},
		onSuccess: async (_, variables) => {
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.detail(organizationId, variables.rentalId),
			})
		},
	})
}

export function useResolveRentalDepositMutation(organizationId?: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({
			rentalId,
			payload,
		}: {
			rentalId: string
			payload: ResolveRentalDepositPayload
		}) => {
			const response = await fetch(`/api/rentals/${rentalId}/deposit/resolve`, {
				method: "POST",
				headers: toJsonHeaders(),
				body: JSON.stringify(payload),
			})

			await assertOk(response, "Failed to resolve rental deposit.")
			return (await response.json()) as ResolveRentalDepositResponse
		},
		onSuccess: async (_, variables) => {
			await queryClient.invalidateQueries({
				queryKey: rentalsQueryKeys.detail(organizationId, variables.rentalId),
			})
		},
	})
}
