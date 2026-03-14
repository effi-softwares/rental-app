"use client"

import { useQueryClient } from "@tanstack/react-query"
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { toast } from "sonner"

import {
	billingAttentionQueryKeys,
	useBillingAttentionSummaryQuery,
} from "@/features/billing-attention"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import { paymentsQueryKeys } from "@/features/payments"
import { rentalsQueryKeys } from "@/features/rentals"
import type { WorkspaceLiveEvent } from "@/features/workspace-live/types"

type WorkspaceLiveContextValue = {
	billingAttentionCount: number
	rentalAttentionCount: number
	latestAlert: WorkspaceLiveEvent | null
}

const WorkspaceLiveContext = createContext<WorkspaceLiveContextValue>({
	billingAttentionCount: 0,
	rentalAttentionCount: 0,
	latestAlert: null,
})

function parseWorkspaceLiveEvent(data: string) {
	try {
		return JSON.parse(data) as WorkspaceLiveEvent
	} catch {
		return null
	}
}

type WorkspaceLiveProviderProps = {
	children: ReactNode
}

export function WorkspaceLiveProvider({
	children,
}: WorkspaceLiveProviderProps) {
	const queryClient = useQueryClient()
	const authContextQuery = useAuthContextQuery()
	const organizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined
	const canManageBillingAttention = Boolean(
		authContextQuery.data?.permissions.manageBillingAttentionModule,
	)
	const canViewBookings = Boolean(
		authContextQuery.data?.permissions.viewBookingsModule,
	)
	const attentionSummaryQuery = useBillingAttentionSummaryQuery(
		canManageBillingAttention || canViewBookings ? organizationId : undefined,
	)
	const [latestAlert, setLatestAlert] = useState<WorkspaceLiveEvent | null>(
		null,
	)
	const shownToastIdsRef = useRef<Set<string>>(new Set())
	const alertTimeoutRef = useRef<number | null>(null)

	useEffect(() => {
		if (!organizationId) {
			return
		}

		const topics = []
		if (canViewBookings) {
			topics.push("rentals")
		}
		if (canManageBillingAttention) {
			topics.push("billing_attention")
		}

		if (topics.length === 0) {
			return
		}

		const stream = new EventSource(
			`/api/workspace/live/stream?topics=${encodeURIComponent(
				topics.join(","),
			)}`,
		)

		const handleMessage = (rawEvent: MessageEvent<string>) => {
			const event = parseWorkspaceLiveEvent(rawEvent.data)
			if (!event || event.organizationId !== organizationId) {
				return
			}

			if (event.topic === "billing_attention") {
				void queryClient.invalidateQueries({
					queryKey: billingAttentionQueryKeys.all,
				})
				void queryClient.invalidateQueries({ queryKey: paymentsQueryKeys.all })
			}

			if (event.topic === "billing_attention" || event.topic === "rentals") {
				void queryClient.invalidateQueries({ queryKey: rentalsQueryKeys.all })
			}

			if (event.attention !== "warning" && event.attention !== "critical") {
				return
			}

			setLatestAlert(event)
			if (alertTimeoutRef.current) {
				window.clearTimeout(alertTimeoutRef.current)
			}
			alertTimeoutRef.current = window.setTimeout(() => {
				setLatestAlert((current) => (current?.id === event.id ? null : current))
			}, 12_000)

			if (
				typeof document === "undefined" ||
				document.visibilityState !== "visible" ||
				!document.hasFocus() ||
				shownToastIdsRef.current.has(event.id)
			) {
				return
			}

			shownToastIdsRef.current.add(event.id)
			const message = event.summary ?? event.type.replaceAll(".", " ")
			if (event.attention === "critical") {
				toast.error(message)
				return
			}

			toast.warning(message)
		}

		stream.onmessage = handleMessage

		return () => {
			stream.close()
			if (alertTimeoutRef.current) {
				window.clearTimeout(alertTimeoutRef.current)
			}
		}
	}, [canManageBillingAttention, canViewBookings, organizationId, queryClient])

	const value = useMemo(
		() => ({
			billingAttentionCount:
				attentionSummaryQuery.data?.openAttentionCount ?? 0,
			rentalAttentionCount:
				attentionSummaryQuery.data?.rentalsAwaitingPaymentCount ?? 0,
			latestAlert,
		}),
		[
			attentionSummaryQuery.data?.openAttentionCount,
			attentionSummaryQuery.data?.rentalsAwaitingPaymentCount,
			latestAlert,
		],
	)

	return (
		<WorkspaceLiveContext.Provider value={value}>
			{children}
		</WorkspaceLiveContext.Provider>
	)
}

export function useWorkspaceLiveStatus() {
	return useContext(WorkspaceLiveContext)
}
