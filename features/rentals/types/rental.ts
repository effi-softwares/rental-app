export type RentalStatus =
	| "draft"
	| "awaiting_payment"
	| "scheduled"
	| "cancelling"
	| "active"
	| "completed"
	| "cancelled"

export type RentalCancellationReason =
	| "customer_request"
	| "payment_issue"
	| "vehicle_unavailable"
	| "pricing_error"
	| "duplicate_booking"
	| "staff_error"
	| "other"

export type RentalPricingBucket = "day" | "week" | "month"
export type RentalInstallmentInterval = "week" | "month"
export type RentalPaymentPlanKind = "single" | "installment"
export type RentalCollectionTiming = "setup" | "handover"
export type RentalAlternativeMatchMode =
	| "same_class"
	| "same_class_transmission"
	| "same_class_price_band"
	| "same_class_brand_family"
export type RentalRecurringBillingState =
	| "none"
	| "pending_setup"
	| "ready_to_schedule"
	| "scheduled_in_stripe"
	| "active_in_stripe"
	| "past_due"
	| "failed"
	| "cancelled"
export type RentalPaymentMethodType = "cash" | "card" | "au_becs_debit"
export type RentalPaymentCollectionSurface =
	| "cash_register"
	| "terminal_reader"
	| "direct_debit"
export type RentalInspectionStage = "pickup" | "return"
export type RentalInspectionCleanliness = "clean" | "needs_attention" | "dirty"
export type RentalConditionRating = "excellent" | "good" | "fair" | "poor"
export type RentalDamageCategory =
	| "exterior"
	| "interior"
	| "mechanical"
	| "other"
export type RentalDamageSeverity = "minor" | "moderate" | "severe"
export type RentalDamageRepairStatus =
	| "reported"
	| "approved"
	| "repaired"
	| "waived"
export type RentalChargeKind =
	| "extension"
	| "damage"
	| "fine"
	| "toll"
	| "fuel"
	| "cleaning"
	| "late_return"
	| "other"
export type RentalChargeStatus =
	| "open"
	| "partially_paid"
	| "paid"
	| "cancelled"
export type RentalDepositEventType =
	| "hold_collected"
	| "released"
	| "retained"
	| "applied_to_charge"
	| "refunded"
export type RentalAmendmentType =
	| "schedule_change"
	| "extension"
	| "early_return"

export type RentalPaymentRefundStatus =
	| "pending"
	| "processing"
	| "succeeded"
	| "failed"
	| "cancelled"

export type RentalVehicleSummary = {
	id: string
	label: string
	licensePlate: string
	status: string
	branchId: string | null
	vehicleClassId: string | null
	vehicleClassName: string | null
	vehicleClassCode: string | null
	transmission: "Automatic" | "Manual" | "Semi-Automatic"
	seats: number
	frontImage: {
		assetId: string
		deliveryUrl: string
		blurDataUrl: string
	} | null
	latestConditionSnapshot: {
		rating: RentalConditionRating
		inspectionStage: RentalInspectionStage
		rentalId: string
		inspectionId: string
		recordedAt: string
		odometerKm: number | null
		fuelPercent: number | null
		cleanliness: RentalInspectionCleanliness | null
		notes: string | null
		media: Array<{
			assetId: string
			deliveryUrl: string
			blurDataUrl: string
			label: string | null
		}>
	} | null
	rates: Array<{
		pricingModel: "Daily" | "Weekly" | "Monthly" | "Distance-Based"
		rate: number
		requiresDeposit: boolean
		depositAmount: number | null
	}>
}

export type RentalAvailabilityConflict = {
	id: string
	sourceType:
		| "rental"
		| "draft_hold"
		| "maintenance"
		| "prep_before"
		| "prep_after"
		| "manual_hold"
		| "blackout"
	startsAt: string
	endsAt: string
	note: string | null
	status: "active" | "released" | "cancelled"
	rentalId: string | null
}

export type RentalAvailabilityDayCell = {
	date: string
	status: "available" | "partial" | "blocked"
	notes: string[]
}

export type RentalAvailabilityAlternative = {
	vehicle: RentalVehicleSummary
	available: boolean
	matchReasons: string[]
	bucketRate: number | null
}

export type RentalAvailabilityResponse = {
	selectedVehicle: RentalVehicleSummary | null
	matchMode: RentalAlternativeMatchMode
	range: {
		startsAt: string
		endsAt: string
	}
	durationDays: number
	isAvailable: boolean
	blockingReason: string | null
	conflicts: RentalAvailabilityConflict[]
	dayCells: RentalAvailabilityDayCell[]
	nextAvailableRange: {
		startsAt: string
		endsAt: string
	} | null
	alternatives: RentalAvailabilityAlternative[]
}

export type RentalCustomerSummary = {
	id: string
	fullName: string
	email: string | null
	phone: string | null
	verificationStatus: string
	verificationMetadata: Record<string, unknown>
}

export type RentalPricingSnapshot = {
	id: string
	pricingBucket: RentalPricingBucket
	unitCount: number
	baseRate: number
	subtotal: number
	discountTotal: number
	taxTotal: number
	depositAmount: number
	grandTotal: number
	lineItems: Array<{
		code: string
		label: string
		amount: number
		quantity?: number
		type: "charge" | "tax" | "discount" | "deposit"
	}>
	calcVersion: string
	calcHash: string
	createdAt: string
}

export type RentalPaymentScheduleSummary = {
	id: string
	sequence: number
	label: string
	dueAt: string
	amount: number
	currency: string
	status: "pending" | "processing" | "succeeded" | "failed" | "cancelled"
	paymentMethodType: RentalPaymentMethodType | null
	isFirstCharge: boolean
	stripeInvoiceId: string | null
	stripeSubscriptionId: string | null
	failureReason: string | null
}

export type RentalInvoiceLineItem = {
	id: string
	code: string
	label: string
	quantity: number
	amount: number
	type: string
	sortOrder: number
}

export type RentalInvoiceSummary = {
	id: string
	status: "draft" | "open" | "paid" | "void" | "uncollectible" | "cancelled"
	collectionMethod: "charge_automatically" | "send_invoice" | "out_of_band"
	currency: string
	stripeInvoiceId: string | null
	hostedInvoiceUrl: string | null
	invoicePdfUrl: string | null
	subtotal: number
	discountTotal: number
	taxTotal: number
	depositTotal: number
	total: number
	issuedAt: string | null
	dueAt: string | null
	lineItems: RentalInvoiceLineItem[]
}

export type RentalAgreementSummary = {
	id: string
	templateVersion: string
	documentHash: string | null
	signedAt: string | null
}

export type RentalInspectionSummary = {
	id: string
	stage: RentalInspectionStage
	odometerKm: number | null
	fuelPercent: number | null
	cleanliness: RentalInspectionCleanliness | null
	conditionRating: RentalConditionRating | null
	checklist: Record<string, boolean>
	notes: string | null
	signature: {
		signerName: string | null
		signature: string | null
	} | null
	media: Array<{
		assetId: string
		deliveryUrl: string
		blurDataUrl: string
		label: string | null
	}>
	completedAt: string
	completedByMemberId: string | null
}

export type RentalDamageSummary = {
	id: string
	inspectionId: string | null
	category: RentalDamageCategory
	title: string
	description: string | null
	severity: RentalDamageSeverity
	customerLiabilityAmount: number
	estimatedCost: number | null
	actualCost: number | null
	repairStatus: RentalDamageRepairStatus
	occurredAt: string | null
	repairedAt: string | null
	media: Array<{
		assetId: string
		deliveryUrl: string
		blurDataUrl: string
		label: string | null
	}>
}

export type RentalChargeSummary = {
	id: string
	kind: RentalChargeKind
	status: RentalChargeStatus
	amount: number
	taxAmount: number
	total: number
	currency: string
	dueAt: string | null
	description: string | null
	linkedDamageId: string | null
	linkedPaymentId: string | null
	metadata: Record<string, unknown>
	createdAt: string
	updatedAt: string
}

export type RentalDepositEventSummary = {
	id: string
	type: RentalDepositEventType
	amount: number
	currency: string
	linkedChargeId: string | null
	linkedPaymentId: string | null
	note: string | null
	createdAt: string
}

export type RentalAmendmentSummary = {
	id: string
	type: RentalAmendmentType
	previousPlannedStartAt: string | null
	previousPlannedEndAt: string | null
	nextPlannedStartAt: string | null
	nextPlannedEndAt: string | null
	deltaAmount: number
	currency: string
	pricingSnapshotId: string | null
	reason: string | null
	createdAt: string
}

export type RentalTimelineEntry = {
	id: string
	type: string
	payload: Record<string, unknown>
	createdAt: string
	actorMemberId: string | null
}

export type RentalPaymentSummary = {
	id: string
	scheduleId: string | null
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
	paymentMethodType: RentalPaymentMethodType | null
	collectionSurface: RentalPaymentCollectionSurface | null
	manualReference: string | null
	externalReference: string | null
	stripePaymentIntentId: string | null
	stripeSetupIntentId: string | null
	stripeInvoiceId: string | null
	stripeSubscriptionId: string | null
	stripeSubscriptionScheduleId: string | null
	stripePaymentMethodId: string | null
	capturedAt: string | null
	createdAt: string
	updatedAt: string
}

export type RentalPaymentRefundSummary = {
	id: string
	paymentId: string
	provider: string
	status: RentalPaymentRefundStatus
	amount: number
	currency: string
	stripeRefundId: string | null
	reference: string | null
	failureReason: string | null
	metadata: Record<string, unknown>
	confirmedAt: string | null
	confirmedByMemberId: string | null
	createdAt: string
	updatedAt: string
}

export type RentalPaymentSession = {
	mode: "payment" | "setup"
	clientSecret: string
	intentId: string
	paymentMethodType: "card" | "au_becs_debit"
	collectionSurface: "terminal_reader" | "direct_debit"
}

export type RentalRecord = {
	id: string
	status: RentalStatus
	cancellationReason: RentalCancellationReason | null
	cancellationNote: string | null
	cancellationRequestedAt: string | null
	cancellationCompletedAt: string | null
	cancellationRequestedByMemberId: string | null
	cancellationCompletedByMemberId: string | null
	currency: string
	plannedStartAt: string | null
	plannedEndAt: string | null
	actualStartAt: string | null
	actualEndAt: string | null
	branchId: string | null
	vehicleId: string | null
	customerId: string | null
	latestPricingSnapshotId: string | null
	pricingBucket: RentalPricingBucket | null
	paymentPlanKind: RentalPaymentPlanKind
	firstCollectionTiming: RentalCollectionTiming
	installmentInterval: RentalInstallmentInterval | null
	installmentCount: number | null
	selectedPaymentMethodType: RentalPaymentMethodType | null
	storedPaymentMethodStatus: "none" | "pending" | "ready" | "failed"
	recurringBillingState: RentalRecurringBillingState
	depositRequired: boolean
	depositAmount: number | null
	notes: string | null
	version: number
	createdAt: string
	updatedAt: string
}

export type RentalDetailResponse = {
	rental: RentalRecord
	branch: {
		id: string
		name: string
	} | null
	vehicle: RentalVehicleSummary | null
	customer: RentalCustomerSummary | null
	pricingSnapshot: RentalPricingSnapshot | null
	paymentSchedule: RentalPaymentScheduleSummary[]
	invoice: RentalInvoiceSummary | null
	agreement: RentalAgreementSummary | null
	payments: RentalPaymentSummary[]
	refunds: RentalPaymentRefundSummary[]
	financials: {
		invoiceTotal: number
		scheduledOutstanding: number
		extraChargesOutstanding: number
		totalPaid: number
		totalRefunded: number
		netCollected: number
		depositHeld: number
		depositReleased: number
		depositApplied: number
		depositRetained: number
		balanceDue: number
	}
	actionState: {
		canEditBooking: boolean
		canFinalize: boolean
		canPreparePayment: boolean
		canHandover: boolean
		canExtend: boolean
		canInitiateReturn: boolean
		canResolveDeposit: boolean
		canCloseRental: boolean
		canCompleteReturn: boolean
		canCancel: boolean
		canConfirmCashRefund: boolean
		isCancelling: boolean
		missingPickupInspection: boolean
		hasReturnInspection: boolean
		hasRequiredReturnConditionEvidence: boolean
		hasOutstandingScheduledBalance: boolean
		hasOutstandingExtraCharges: boolean
		requiresDepositResolution: boolean
		hasOpenExtraCharges: boolean
	}
	cancellation: {
		reason: RentalCancellationReason | null
		note: string | null
		requestedAt: string | null
		completedAt: string | null
		requestedByMemberId: string | null
		completedByMemberId: string | null
	} | null
	inspections: RentalInspectionSummary[]
	damages: RentalDamageSummary[]
	extraCharges: RentalChargeSummary[]
	deposit: {
		required: boolean
		amount: number
		currency: string
		events: RentalDepositEventSummary[]
	}
	amendments: RentalAmendmentSummary[]
	timeline: RentalTimelineEntry[]
	canManagePayments: boolean
}

export type RentalListItem = {
	id: string
	status: RentalStatus
	paymentPlanKind: RentalPaymentPlanKind
	firstCollectionTiming: RentalCollectionTiming
	installmentInterval: RentalInstallmentInterval | null
	selectedPaymentMethodType: RentalPaymentMethodType | null
	recurringBillingState: RentalRecurringBillingState
	storedPaymentMethodStatus: "none" | "pending" | "ready" | "failed"
	plannedStartAt: string | null
	plannedEndAt: string | null
	actualStartAt: string | null
	actualEndAt: string | null
	createdAt: string
	updatedAt: string
	vehicle: {
		id: string
		label: string
		licensePlate: string | null
	} | null
	customer: {
		id: string
		fullName: string
		email: string | null
		phone: string | null
	} | null
}

export type RentalListResponse = {
	rentals: RentalListItem[]
}

export type RentalCommitPayload = {
	vehicleId: string
	customer?: {
		fullName: string
		email?: string
		phone?: string
		matchedCustomerId?: string | null
	}
	schedule: {
		plannedStartAt: string
		plannedEndAt: string
	}
	pricing?: {
		pricingBucket: RentalPricingBucket
		unitCount: number
		baseRate: number
		subtotal: number
		discountAmount: number
		taxRatePercent: number
		taxTotal: number
		depositRequired: boolean
		depositAmount: number
		grandTotal: number
		lineItems: Array<{
			code: string
			label: string
			amount: number
			quantity?: number
			type: "charge" | "tax" | "discount" | "deposit"
		}>
	}
	paymentPlan?: {
		paymentPlanKind: RentalPaymentPlanKind
		firstCollectionTiming: RentalCollectionTiming
		installmentInterval: RentalInstallmentInterval | null
		installmentCount: number | null
		schedule: Array<{
			sequence: number
			label: string
			dueAt: string
			amount: number
			isFirstCharge: boolean
		}>
	}
	notes?: string
}

export type RentalCommitResponse = RentalDetailResponse

export type CancelRentalPayload = {
	reason: RentalCancellationReason
	note?: string
}

export type CancelRentalResponse = {
	rentalId: string
	status: RentalStatus
	cancellation: RentalDetailResponse["cancellation"]
	refunds: RentalPaymentRefundSummary[]
}

export type ConfirmCashRefundResponse = {
	rentalId: string
	status: RentalStatus
	refund: RentalPaymentRefundSummary
}

export type PrepareRentalPaymentPayload = {
	paymentMethodType: RentalPaymentMethodType
	scheduleId?: string
}

export type PrepareRentalPaymentResponse = {
	preparedPayment: RentalPaymentSummary | null
	paymentSession: RentalPaymentSession | null
}

export type CollectCashPaymentPayload = {
	scheduleId: string
	amountTendered: number
}

export type CollectCashPaymentResponse = {
	payment: RentalPaymentSummary
	changeDue: number
}

export type ConfirmRentalPaymentPayload =
	| {
			paymentIntentId: string
	  }
	| {
			setupIntentId: string
	  }

export type ConfirmRentalPaymentResponse = {
	status: RentalPaymentSummary["status"]
	reconciledPayments: RentalPaymentSummary[]
}

export type FinalizeRentalPayload = {
	signature: string
	signerName?: string
	agreementAccepted: boolean
}

export type FinalizeRentalResponse = {
	rentalId: string
	status: RentalStatus
}

export type HandoverRentalPayload = {
	amountTendered?: number
}

export type HandoverRentalResponse = {
	rentalId: string
	status: RentalStatus
	capturedPayments: RentalPaymentSummary[]
}

export type ReturnRentalPayload = {
	actualEndAt?: string
	notes?: string
}

export type ReturnRentalResponse = {
	rentalId: string
	status: RentalStatus
	actualEndAt: string
}

export type SaveRentalInspectionPayload = {
	stage: RentalInspectionStage
	odometerKm?: number | null
	fuelPercent?: number | null
	cleanliness?: RentalInspectionCleanliness | null
	conditionRating?: RentalConditionRating | null
	updateVehicleCondition?: boolean
	checklist?: Record<string, boolean>
	notes?: string
	signature?: string
	signerName?: string
	media?: Array<{
		assetId: string
		deliveryUrl: string
		blurDataUrl: string
		label?: string | null
	}>
	damages?: Array<{
		category: RentalDamageCategory
		title: string
		description?: string
		severity: RentalDamageSeverity
		customerLiabilityAmount?: number
		estimatedCost?: number | null
		actualCost?: number | null
		repairStatus?: RentalDamageRepairStatus
		occurredAt?: string | null
		media?: Array<{
			assetId: string
			deliveryUrl: string
			blurDataUrl: string
			label?: string | null
		}>
	}>
}

export type SaveRentalInspectionResponse = {
	inspection: RentalInspectionSummary
	damages: RentalDamageSummary[]
}

export type ExtendRentalPayload = {
	nextPlannedEndAt: string
	reason?: string
}

export type ExtendRentalResponse = {
	rentalId: string
	nextPlannedEndAt: string
	amendment: RentalAmendmentSummary
	extensionCharge: RentalChargeSummary | null
}

export type CreateRentalChargePayload = {
	kind: RentalChargeKind
	amount: number
	taxAmount?: number
	description?: string
	dueAt?: string | null
	linkedDamageId?: string | null
	metadata?: Record<string, unknown>
}

export type UpdateRentalChargePayload = Partial<CreateRentalChargePayload> & {
	status?: RentalChargeStatus
}

export type RentalChargeMutationResponse = {
	charge: RentalChargeSummary
}

export type CollectRentalChargePayload = {
	paymentMethodType: "cash" | "card"
	amountTendered?: number
	manualReference?: string
}

export type CollectRentalChargeResponse = {
	charge: RentalChargeSummary
	payment: RentalPaymentSummary
	changeDue: number
}

export type ResolveRentalDepositPayload =
	| {
			action: "release" | "refund" | "retain"
			amount: number
			note?: string
	  }
	| {
			action: "apply_to_charge"
			amount: number
			chargeId: string
			note?: string
	  }

export type ResolveRentalDepositResponse = {
	depositEvent: RentalDepositEventSummary
	charge: RentalChargeSummary | null
}
