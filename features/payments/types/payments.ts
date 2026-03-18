export type PaymentSummaryResponse = {
	summary: {
		collectedAmount: number
		collectedCount: number
		pendingCount: number
		requiresActionCount: number
		failedCount: number
		pendingDirectDebitCount: number
		recurringPastDueCount: number
		failedWebhookCount: number
	}
}

export type PaymentLedgerPreset =
	| "all"
	| "cash"
	| "terminal_card"
	| "direct_debit"
	| "installments"
	| "failures"
	| "awaiting_settlement"

export type PaymentLedgerFilters = {
	preset?: PaymentLedgerPreset
	search?: string
	page?: number
	pageSize?: number
}

export type PaymentLedgerRow = {
	id: string
	rentalId: string
	rentalStatus:
		| "draft"
		| "awaiting_payment"
		| "scheduled"
		| "cancelling"
		| "active"
		| "completed"
		| "cancelled"
	rentalRecurringBillingState:
		| "none"
		| "pending_setup"
		| "ready_to_schedule"
		| "scheduled_in_stripe"
		| "active_in_stripe"
		| "past_due"
		| "failed"
		| "cancelled"
	paymentPlanKind: "single" | "installment"
	branchId: string | null
	branchName: string | null
	customerId: string | null
	customerName: string | null
	customerEmail: string | null
	scheduleId: string | null
	scheduleLabel: string | null
	scheduleDueAt: string | null
	scheduleStatus:
		| "pending"
		| "processing"
		| "succeeded"
		| "failed"
		| "cancelled"
		| null
	scheduleFailureReason: string | null
	kind: "payment_method_setup" | "schedule_collection"
	status:
		| "pending"
		| "requires_action"
		| "processing"
		| "succeeded"
		| "failed"
		| "refunded"
		| "cancelled"
	amount: number
	currency: string
	paymentMethodType: "cash" | "card" | "au_becs_debit" | null
	collectionSurface: "cash_register" | "terminal_reader" | "direct_debit" | null
	manualReference: string | null
	externalReference: string | null
	localInvoiceRecordId: string | null
	hostedInvoiceUrl: string | null
	invoicePdfUrl: string | null
	paymentIntentId: string | null
	setupIntentId: string | null
	invoiceId: string | null
	subscriptionId: string | null
	subscriptionScheduleId: string | null
	paymentMethodId: string | null
	capturedAt: string | null
	createdAt: string
	updatedAt: string
}

export type PaymentLedgerResponse = {
	filters: {
		preset: PaymentLedgerPreset
		search: string
		page: number
		pageSize: number
	}
	page: {
		page: number
		pageSize: number
		total: number
		pageCount: number
	}
	rows: PaymentLedgerRow[]
}

export type PaymentWebhookRow = {
	id: string
	stripeEventId: string
	type: string
	status: "received" | "processed" | "ignored" | "failed"
	mode: string
	objectType: string | null
	objectId: string | null
	errorMessage: string | null
	receivedAt: string
	processedAt: string | null
	organizationId: string | null
	branchId: string | null
	branchName: string | null
	relatedRentalId: string | null
	relatedPaymentId: string | null
	relatedInvoiceRecordId: string | null
	payload: Record<string, unknown>
}

export type PaymentWebhooksResponse = {
	filter: {
		status: "all" | "failed"
	}
	rows: PaymentWebhookRow[]
}

export type PaymentDetailResponse = {
	selectedPayment: PaymentLedgerRow
	rental: {
		id: string
		status:
			| "draft"
			| "awaiting_payment"
			| "scheduled"
			| "cancelling"
			| "active"
			| "completed"
			| "cancelled"
		paymentPlanKind: "single" | "installment"
		selectedPaymentMethodType: "cash" | "card" | "au_becs_debit" | null
		recurringBillingState:
			| "none"
			| "pending_setup"
			| "ready_to_schedule"
			| "scheduled_in_stripe"
			| "active_in_stripe"
			| "past_due"
			| "failed"
			| "cancelled"
		plannedStartAt: string | null
		plannedEndAt: string | null
		actualStartAt: string | null
		actualEndAt: string | null
		branchId: string | null
		customerId: string | null
		customerName: string | null
		customerEmail: string | null
	}
	relatedSchedule: {
		id: string
		sequence: number
		label: string
		dueAt: string
		amount: number
		currency: string
		status: "pending" | "processing" | "succeeded" | "failed" | "cancelled"
		paymentMethodType: "cash" | "card" | "au_becs_debit" | null
		isFirstCharge: boolean
		stripeInvoiceId: string | null
		stripeSubscriptionId: string | null
		failureReason: string | null
	} | null
	fullSchedule: Array<{
		id: string
		sequence: number
		label: string
		dueAt: string
		amount: number
		currency: string
		status: "pending" | "processing" | "succeeded" | "failed" | "cancelled"
		paymentMethodType: "cash" | "card" | "au_becs_debit" | null
		isFirstCharge: boolean
		stripeInvoiceId: string | null
		stripeSubscriptionId: string | null
		failureReason: string | null
	}>
	relatedInvoice: {
		id: string
		status: "draft" | "open" | "paid" | "void" | "uncollectible" | "cancelled"
		collectionMethod: "charge_automatically" | "send_invoice" | "out_of_band"
		currency: string
		stripeInvoiceId: string | null
		hostedInvoiceUrl: string | null
		invoicePdfUrl: string | null
		total: number
		issuedAt: string | null
		dueAt: string | null
	} | null
	correlatedWebhooks: PaymentWebhookRow[]
	relatedRentalEvents: Array<{
		id: string
		type: string
		createdAt: string
		payload: Record<string, unknown>
	}>
	relatedPayments: PaymentLedgerRow[]
}
