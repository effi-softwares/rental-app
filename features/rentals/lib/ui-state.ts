import type {
	RentalDetailResponse,
	RentalPaymentPlanKind,
	RentalStatus,
} from "@/features/rentals/types/rental"

export type RentalNextAction = "none" | "handover" | "return"

type RentalPrimaryAction =
	| {
			type: "none"
			label: null
			description: string
			disabled: boolean
	  }
	| {
			type: "finalize" | "handover" | "start_return"
			label: string
			description: string
			disabled: boolean
	  }

export function getRentalPriorityRank(status: RentalStatus) {
	switch (status) {
		case "scheduled":
			return 0
		case "active":
			return 1
		case "awaiting_payment":
			return 2
		case "cancelling":
			return 3
		case "draft":
			return 4
		case "completed":
			return 5
		case "cancelled":
			return 6
	}
}

export function getRentalPlanLabel(paymentPlanKind: RentalPaymentPlanKind) {
	return paymentPlanKind === "installment" ? "Installment" : "Single"
}

export function getRentalStatusLabel(status: RentalStatus) {
	return status.replaceAll("_", " ")
}

export function getRentalNextAction(input: {
	status: RentalStatus
	canHandover?: boolean
	canInitiateReturn?: boolean
}): RentalNextAction {
	if (input.status === "scheduled" && (input.canHandover ?? true)) {
		return "handover"
	}

	if (input.status === "active" && (input.canInitiateReturn ?? true)) {
		return "return"
	}

	return "none"
}

export function getRentalNextActionLabel(action: RentalNextAction) {
	if (action === "handover") {
		return "Handover"
	}

	if (action === "return") {
		return "Return"
	}

	return null
}

export function getRentalNextStepCopy(action: RentalNextAction) {
	if (action === "handover") {
		return "Ready for handover."
	}

	if (action === "return") {
		return "Vehicle is out. Return is the next step."
	}

	return "No action needed right now."
}

export function getRentalPrimaryAction(
	detail: Pick<RentalDetailResponse, "rental" | "actionState">,
): RentalPrimaryAction {
	if (
		detail.rental.status === "draft" ||
		detail.rental.status === "awaiting_payment"
	) {
		return {
			type: "finalize",
			label: "Finalize rental",
			description:
				"Finish the agreement details so this booking can move into its next stage.",
			disabled: !detail.actionState.canFinalize,
		}
	}

	if (detail.rental.status === "scheduled") {
		return {
			type: "handover",
			label: "Handover vehicle",
			description:
				"Open the guided handover flow to record start-of-rental checks and release the vehicle.",
			disabled: !detail.actionState.canHandover,
		}
	}

	if (detail.rental.status === "active") {
		return {
			type: "start_return",
			label: "Start return",
			description:
				"Guide staff into the return flow so they can inspect the vehicle and close the rental clearly.",
			disabled: !detail.actionState.canInitiateReturn,
		}
	}

	return {
		type: "none",
		label: null,
		description:
			detail.rental.status === "completed"
				? "This rental is complete. Review details, charges, and history here."
				: detail.rental.status === "cancelling"
					? "Cancellation is in progress while refunds and payment reversals are being completed."
					: "This rental does not need another workflow step right now.",
		disabled: true,
	}
}

export function getRentalAttentionMessages(
	detail: Pick<
		RentalDetailResponse,
		"rental" | "actionState" | "extraCharges" | "inspections" | "damages"
	>,
) {
	const messages: string[] = []

	if (
		(detail.rental.status === "draft" ||
			detail.rental.status === "awaiting_payment") &&
		detail.actionState.canFinalize
	) {
		messages.push("Agreement details can be finalized now.")
	}

	if (detail.actionState.missingPickupInspection) {
		messages.push(
			"Start the handover flow to record the required start-of-rental inspection.",
		)
	}

	if (detail.rental.status === "scheduled" && detail.actionState.canHandover) {
		messages.push("Vehicle is scheduled and ready for handover.")
	}

	if (
		detail.rental.status === "active" &&
		detail.actionState.canInitiateReturn
	) {
		messages.push(
			"Rental is active. Start the return workflow when the vehicle comes back.",
		)
	}

	if (detail.actionState.isCancelling) {
		messages.push(
			detail.actionState.canConfirmCashRefund
				? "Cancellation is waiting on manual cash refund confirmation."
				: "Cancellation is in progress while payment reversals finish.",
		)
	}

	if (detail.actionState.hasOpenExtraCharges) {
		messages.push("There are open extra charges that still need attention.")
	}

	if (
		detail.rental.status === "completed" &&
		detail.actionState.canResolveDeposit
	) {
		messages.push(
			"Review the deposit if it still needs to be released, retained, or refunded.",
		)
	}

	if (detail.inspections.length === 0) {
		messages.push("No inspections have been saved yet.")
	}

	if (detail.damages.length > 0) {
		messages.push(
			`${detail.damages.length} damage item${detail.damages.length === 1 ? "" : "s"} recorded for follow-up.`,
		)
	}

	if (messages.length === 0) {
		messages.push("Everything important looks up to date right now.")
	}

	return messages
}
