"use client"

import { useEffect, useEffectEvent, useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { RentalPaymentSummary } from "@/features/rentals"
import { resolveErrorMessage } from "@/lib/errors"

type TerminalReaderSummary = {
	id: string
	label: string | null
	serialNumber: string | null
	deviceType: string
	status: string
	actionType: string | null
	locationId: string | null
}

type RentalPaymentTerminalPanelProps = {
	rentalId: string
	payments: RentalPaymentSummary[]
}

export function RentalPaymentTerminalPanel({
	rentalId,
	payments,
}: RentalPaymentTerminalPanelProps) {
	const [readers, setReaders] = useState<TerminalReaderSummary[]>([])
	const [selectedReaderId, setSelectedReaderId] = useState<string | null>(null)
	const [loadingReaders, setLoadingReaders] = useState(false)
	const [submitting, setSubmitting] = useState<"payment" | "setup" | null>(null)
	const [formError, setFormError] = useState<string | null>(null)

	const paymentIntentId = useMemo(
		() =>
			payments.find(
				(payment) =>
					Boolean(payment.stripePaymentIntentId) &&
					(payment.status === "requires_action" ||
						payment.status === "pending"),
			)?.stripePaymentIntentId ?? null,
		[payments],
	)

	const setupIntentId = useMemo(
		() =>
			payments.find(
				(payment) =>
					Boolean(payment.stripeSetupIntentId) &&
					(payment.status === "requires_action" ||
						payment.status === "pending"),
			)?.stripeSetupIntentId ?? null,
		[payments],
	)

	const loadReaders = useEffectEvent(async () => {
		try {
			setLoadingReaders(true)
			setFormError(null)
			const response = await fetch(`/api/rentals/${rentalId}/terminal/readers`)
			const payload = (await response.json().catch(() => null)) as {
				error?: string
				readers?: TerminalReaderSummary[]
			} | null

			if (!response.ok) {
				throw new Error(payload?.error ?? "Failed to load terminal readers.")
			}

			const nextReaders = payload?.readers ?? []
			setReaders(nextReaders)
			setSelectedReaderId((previous) =>
				previous && nextReaders.some((reader) => reader.id === previous)
					? previous
					: (nextReaders[0]?.id ?? null),
			)
		} catch (error) {
			setFormError(
				resolveErrorMessage(error, "Failed to load terminal readers."),
			)
		} finally {
			setLoadingReaders(false)
		}
	})

	useEffect(() => {
		void loadReaders()
	}, [])

	async function startTerminalAction(
		kind: "payment" | "setup",
		intentId: string | null,
	) {
		if (!selectedReaderId || !intentId) {
			setFormError(
				"Select a reader and prepare the required Stripe intent first.",
			)
			return
		}

		try {
			setSubmitting(kind)
			setFormError(null)
			const response = await fetch(
				`/api/rentals/${rentalId}/terminal/${
					kind === "payment" ? "process-payment" : "process-setup"
				}`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(
						kind === "payment"
							? {
									readerId: selectedReaderId,
									paymentIntentId: intentId,
								}
							: {
									readerId: selectedReaderId,
									setupIntentId: intentId,
								},
					),
				},
			)

			const payload = (await response.json().catch(() => null)) as {
				error?: string
			} | null

			if (!response.ok) {
				throw new Error(payload?.error ?? "Failed to start reader action.")
			}

			toast.success(
				kind === "payment"
					? "Reader is collecting the payment."
					: "Reader is saving the payment method.",
			)
		} catch (error) {
			setFormError(resolveErrorMessage(error, "Failed to start reader action."))
		} finally {
			setSubmitting(null)
		}
	}

	return (
		<div className="space-y-4 rounded-md border p-4">
			<div className="space-y-1">
				<p className="text-sm font-medium">Reader / POS</p>
				<p className="text-muted-foreground text-sm">
					Choose a branch reader, then send the due-now payment or setup flow to
					the device.
				</p>
			</div>

			<div className="flex justify-end">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => {
						void loadReaders()
					}}
					disabled={loadingReaders}
				>
					{loadingReaders ? "Refreshing readers..." : "Check reader status"}
				</Button>
			</div>

			{formError ? (
				<p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{formError}
				</p>
			) : null}

			{loadingReaders ? (
				<p className="text-muted-foreground text-sm">Loading readers...</p>
			) : readers.length > 0 ? (
				<div className="space-y-2">
					{readers.map((reader) => (
						<button
							key={reader.id}
							type="button"
							onClick={() => {
								setSelectedReaderId(reader.id)
							}}
							className={`w-full rounded-md border px-3 py-2 text-left ${
								selectedReaderId === reader.id
									? "border-primary/50 bg-primary/5"
									: ""
							}`}
						>
							<p className="font-medium">
								{reader.label ?? reader.serialNumber}
							</p>
							<p className="text-muted-foreground text-xs">
								{reader.deviceType} • {reader.status}
								{reader.actionType ? ` • ${reader.actionType}` : ""}
							</p>
						</button>
					))}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">
					No Stripe Terminal readers are available for this branch.
				</p>
			)}

			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					variant="outline"
					className="h-11"
					onClick={() => {
						void startTerminalAction("payment", paymentIntentId)
					}}
					disabled={
						!paymentIntentId || !selectedReaderId || submitting !== null
					}
				>
					{submitting === "payment"
						? "Starting payment..."
						: "Collect due-now payment"}
				</Button>
				<Button
					type="button"
					variant="outline"
					className="h-11"
					onClick={() => {
						void startTerminalAction("setup", setupIntentId)
					}}
					disabled={!setupIntentId || !selectedReaderId || submitting !== null}
				>
					{submitting === "setup"
						? "Starting setup..."
						: "Save card for auto-charge"}
				</Button>
			</div>
		</div>
	)
}
