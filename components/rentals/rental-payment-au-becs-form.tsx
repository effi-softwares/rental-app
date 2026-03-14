"use client"

import {
	AuBankAccountElement,
	Elements,
	useElements,
	useStripe,
} from "@stripe/react-stripe-js"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuthContextQuery } from "@/features/main/queries/use-auth-context-query"
import {
	type RentalPaymentSession,
	useConfirmRentalPaymentMutation,
} from "@/features/rentals"
import { resolveErrorMessage } from "@/lib/errors"
import {
	getStripeBrowserPromise,
	isStripeBrowserConfigured,
} from "@/lib/stripe/client"

type RentalPaymentAuBecsFormProps = {
	rentalId: string
	paymentSession: RentalPaymentSession
	customerName: string
	customerEmail: string
	onConfirmed?: () => void
}

type RentalPaymentAuBecsInnerProps = RentalPaymentAuBecsFormProps & {
	activeOrganizationId?: string
}

function RentalPaymentAuBecsInner({
	rentalId,
	paymentSession,
	customerName,
	customerEmail,
	activeOrganizationId,
	onConfirmed,
}: RentalPaymentAuBecsInnerProps) {
	const stripe = useStripe()
	const elements = useElements()
	const confirmRentalPaymentMutation =
		useConfirmRentalPaymentMutation(activeOrganizationId)
	const [formError, setFormError] = useState<string | null>(null)
	const [accountNameOverride, setAccountNameOverride] = useState<string | null>(
		null,
	)
	const [emailOverride, setEmailOverride] = useState<string | null>(null)
	const accountName = accountNameOverride ?? customerName
	const email = emailOverride ?? customerEmail

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()

		if (!stripe || !elements) {
			setFormError("Stripe has not finished loading yet.")
			return
		}

		if (!accountName.trim() || !email.trim()) {
			setFormError("Customer name and email are required for AU BECS.")
			return
		}

		const auBankAccountElement = elements.getElement(AuBankAccountElement)
		if (!auBankAccountElement) {
			setFormError("Direct debit form is not ready yet.")
			return
		}

		try {
			setFormError(null)

			if (paymentSession.mode === "payment") {
				const result = await stripe.confirmAuBecsDebitPayment(
					paymentSession.clientSecret,
					{
						payment_method: {
							au_becs_debit: auBankAccountElement,
							billing_details: {
								name: accountName.trim(),
								email: email.trim(),
							},
						},
					},
				)

				if (result.error) {
					setFormError(
						result.error.message ?? "Direct debit payment confirmation failed.",
					)
					return
				}

				if (!result.paymentIntent?.id) {
					setFormError("Stripe did not return a payment intent.")
					return
				}

				const confirmation = await confirmRentalPaymentMutation.mutateAsync({
					rentalId,
					payload: {
						paymentIntentId: result.paymentIntent.id,
					},
				})

				toast.message(
					confirmation.status === "succeeded"
						? "Direct debit payment confirmed."
						: `Direct debit payment is ${confirmation.status.replaceAll("_", " ")}.`,
				)
				if (
					confirmation.status !== "failed" &&
					confirmation.status !== "cancelled"
				) {
					onConfirmed?.()
				}
				return
			}

			const result = await stripe.confirmAuBecsDebitSetup(
				paymentSession.clientSecret,
				{
					payment_method: {
						au_becs_debit: auBankAccountElement,
						billing_details: {
							name: accountName.trim(),
							email: email.trim(),
						},
					},
				},
			)

			if (result.error) {
				setFormError(
					result.error.message ??
						"Direct debit payment method setup confirmation failed.",
				)
				return
			}

			if (!result.setupIntent?.id) {
				setFormError("Stripe did not return a setup intent.")
				return
			}

			const confirmation = await confirmRentalPaymentMutation.mutateAsync({
				rentalId,
				payload: {
					setupIntentId: result.setupIntent.id,
				},
			})

			toast.message(
				confirmation.status === "succeeded"
					? "Direct debit mandate saved."
					: `Direct debit setup is ${confirmation.status.replaceAll("_", " ")}.`,
			)
			if (
				confirmation.status !== "failed" &&
				confirmation.status !== "cancelled"
			) {
				onConfirmed?.()
			}
		} catch (error) {
			setFormError(
				resolveErrorMessage(error, "Failed to confirm AU BECS direct debit."),
			)
		}
	}

	return (
		<form className="space-y-4" onSubmit={onSubmit}>
			<div className="grid gap-3 md:grid-cols-2">
				<Input
					value={accountName}
					onChange={(event) => {
						setAccountNameOverride(event.target.value)
					}}
					placeholder="Account holder name"
					className="h-11"
				/>
				<Input
					type="email"
					value={email}
					onChange={(event) => {
						setEmailOverride(event.target.value)
					}}
					placeholder="Billing email"
					className="h-11"
				/>
			</div>
			<div className="rounded-md border p-3">
				<AuBankAccountElement />
			</div>
			{formError ? (
				<p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{formError}
				</p>
			) : null}
			<Button
				type="submit"
				className="h-11"
				disabled={
					!stripe || !elements || confirmRentalPaymentMutation.isPending
				}
			>
				{confirmRentalPaymentMutation.isPending
					? paymentSession.mode === "payment"
						? "Confirming direct debit..."
						: "Saving mandate..."
					: paymentSession.mode === "payment"
						? "Confirm direct debit"
						: "Save direct debit mandate"}
			</Button>
		</form>
	)
}

export function RentalPaymentAuBecsForm({
	rentalId,
	paymentSession,
	customerName,
	customerEmail,
	onConfirmed,
}: RentalPaymentAuBecsFormProps) {
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined

	if (!isStripeBrowserConfigured()) {
		return (
			<p className="rounded-md border border-amber-300/60 bg-amber-100/60 px-3 py-2 text-sm text-amber-900">
				Stripe publishable key is not configured for direct debit entry.
			</p>
		)
	}

	return (
		<Elements
			key={paymentSession.clientSecret}
			stripe={getStripeBrowserPromise()}
			options={{
				clientSecret: paymentSession.clientSecret,
				appearance: {
					theme: "stripe",
				},
			}}
		>
			<RentalPaymentAuBecsInner
				rentalId={rentalId}
				paymentSession={paymentSession}
				customerName={customerName}
				customerEmail={customerEmail}
				activeOrganizationId={activeOrganizationId}
				onConfirmed={onConfirmed}
			/>
		</Elements>
	)
}
