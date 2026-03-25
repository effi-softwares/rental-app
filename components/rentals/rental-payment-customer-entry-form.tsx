"use client"

import {
	Elements,
	PaymentElement,
	useElements,
	useStripe,
} from "@stripe/react-stripe-js"
import { useTheme } from "next-themes"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { feedbackMessageClassName } from "@/lib/theme-styles"

type RentalPaymentCustomerEntryFormProps = {
	rentalId: string
	paymentSession: RentalPaymentSession
	onConfirmed?: () => void
}

type RentalPaymentCustomerEntryInnerProps =
	RentalPaymentCustomerEntryFormProps & {
		activeOrganizationId?: string
	}

function RentalPaymentCustomerEntryInner({
	rentalId,
	paymentSession,
	activeOrganizationId,
	onConfirmed,
}: RentalPaymentCustomerEntryInnerProps) {
	const stripe = useStripe()
	const elements = useElements()
	const confirmRentalPaymentMutation =
		useConfirmRentalPaymentMutation(activeOrganizationId)
	const [formError, setFormError] = useState<string | null>(null)

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()

		if (!stripe || !elements) {
			setFormError("Stripe has not finished loading yet.")
			return
		}

		try {
			setFormError(null)

			if (paymentSession.mode === "payment") {
				const result = await stripe.confirmPayment({
					elements,
					redirect: "if_required",
					confirmParams: {
						return_url: window.location.href,
					},
				})

				if (result.error) {
					setFormError(
						result.error.message ?? "Card payment confirmation failed.",
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

				if (confirmation.status === "succeeded") {
					toast.success("Payment confirmed.")
					onConfirmed?.()
					return
				}

				toast.message(`Payment is ${confirmation.status.replaceAll("_", " ")}.`)
				return
			}

			const result = await stripe.confirmSetup({
				elements,
				redirect: "if_required",
				confirmParams: {
					return_url: window.location.href,
				},
			})

			if (result.error) {
				setFormError(
					result.error.message ?? "Payment method setup confirmation failed.",
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

			if (confirmation.status === "succeeded") {
				toast.success("Payment method saved.")
				onConfirmed?.()
				return
			}

			toast.message(
				`Payment setup is ${confirmation.status.replaceAll("_", " ")}.`,
			)
		} catch (error) {
			setFormError(
				resolveErrorMessage(error, "Failed to confirm Stripe payment."),
			)
		}
	}

	return (
		<form className="space-y-4" onSubmit={onSubmit}>
			<PaymentElement />
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
						? "Confirming payment..."
						: "Saving payment method..."
					: paymentSession.mode === "payment"
						? "Confirm payment"
						: "Save payment method"}
			</Button>
		</form>
	)
}

export function RentalPaymentCustomerEntryForm({
	rentalId,
	paymentSession,
	onConfirmed,
}: RentalPaymentCustomerEntryFormProps) {
	const authContextQuery = useAuthContextQuery()
	const activeOrganizationId =
		authContextQuery.data?.viewer.activeOrganizationId ?? undefined
	const { resolvedTheme } = useTheme()
	const stripeAppearanceTheme = resolvedTheme === "dark" ? "night" : "stripe"

	if (!isStripeBrowserConfigured()) {
		return (
			<p className={feedbackMessageClassName("warning")}>
				Stripe publishable key is not configured for customer-entry payments.
			</p>
		)
	}

	return (
		<Elements
			key={`${paymentSession.clientSecret}-${stripeAppearanceTheme}`}
			stripe={getStripeBrowserPromise()}
			options={{
				clientSecret: paymentSession.clientSecret,
				appearance: {
					theme: stripeAppearanceTheme,
				},
			}}
		>
			<RentalPaymentCustomerEntryInner
				rentalId={rentalId}
				paymentSession={paymentSession}
				activeOrganizationId={activeOrganizationId}
				onConfirmed={onConfirmed}
			/>
		</Elements>
	)
}
