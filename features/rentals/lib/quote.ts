import type {
	RentalCollectionTiming,
	RentalInstallmentInterval,
	RentalPaymentPlanKind,
	RentalPricingBucket,
} from "@/features/rentals/types/rental"

export type RentalQuoteRate = {
	pricingModel: "Daily" | "Weekly" | "Monthly" | "Distance-Based"
	rate: number
	requiresDeposit: boolean
	depositAmount: number | null
}

export type RentalQuoteLineItem = {
	code: string
	label: string
	amount: number
	type: "charge" | "tax" | "discount" | "deposit"
}

export type RentalQuoteInput = {
	plannedStartAt: string | Date
	plannedEndAt: string | Date
	taxRatePercent?: number
	discountAmount?: number
	depositRequired?: boolean
	depositAmount?: number | null
	rates: RentalQuoteRate[]
}

export type RentalInstallmentPreview = {
	sequence: number
	label: string
	dueAt: string
	amount: number
	isFirstCharge: boolean
}

export type RentalPaymentPlanPreviewInput = {
	plannedStartAt: string | Date
	plannedEndAt: string | Date
	grandTotal: number
	depositAmount: number
	paymentPlanKind: RentalPaymentPlanKind
	firstCollectionTiming: RentalCollectionTiming
	installmentInterval: RentalInstallmentInterval | null
	installmentCount?: number | null
}

export type RentalQuoteSummary = {
	durationDays: number
	pricingBucket: RentalPricingBucket
	unitCount: number
	baseRate: number
	subtotal: number
	discountTotal: number
	taxTotal: number
	depositAmount: number
	grandTotal: number
	lineItems: RentalQuoteLineItem[]
}

function toDate(value: string | Date) {
	return value instanceof Date ? value : new Date(value)
}

function normalizeDurationDays(startAt: Date, endAt: Date) {
	const durationMs = endAt.getTime() - startAt.getTime()
	const days = Math.ceil(durationMs / (1000 * 60 * 60 * 24))
	return Math.max(1, days)
}

export function resolvePricingBucket(
	durationDays: number,
): RentalPricingBucket {
	if (durationDays < 7) {
		return "day"
	}

	if (durationDays < 30) {
		return "week"
	}

	return "month"
}

export function defaultInstallmentIntervalForDuration(
	durationDays: number,
): RentalInstallmentInterval {
	return durationDays < 30 ? "week" : "month"
}

function requiredPricingModelForBucket(bucket: RentalPricingBucket) {
	switch (bucket) {
		case "day":
			return "Daily" as const
		case "week":
			return "Weekly" as const
		case "month":
			return "Monthly" as const
	}
}

function unitSizeForBucket(bucket: RentalPricingBucket) {
	switch (bucket) {
		case "day":
			return 1
		case "week":
			return 7
		case "month":
			return 30
	}
}

function intervalDaysForInstallment(interval: RentalInstallmentInterval) {
	return interval === "week" ? 7 : 30
}

function roundAmount(amount: number) {
	return Number(amount.toFixed(2))
}

function addUtcDays(date: Date, days: number) {
	const next = new Date(date)
	next.setUTCDate(next.getUTCDate() + days)
	return next
}

function addUtcMonths(date: Date, count: number) {
	const next = new Date(date)
	next.setUTCMonth(next.getUTCMonth() + count)
	return next
}

function advanceForInstallment(
	date: Date,
	interval: RentalInstallmentInterval,
) {
	if (interval === "month") {
		return addUtcMonths(date, 1)
	}

	return addUtcDays(date, intervalDaysForInstallment(interval))
}

function equalInstallments(total: number, count: number) {
	const normalizedCount = Math.max(1, count)
	const baseCents = Math.floor((Math.round(total * 100) || 0) / normalizedCount)
	const totalCents = Math.round(total * 100)
	let remainder = totalCents - baseCents * normalizedCount

	return Array.from({ length: normalizedCount }, () => {
		const cents = baseCents + (remainder > 0 ? 1 : 0)
		remainder = Math.max(0, remainder - 1)
		return cents / 100
	})
}

export function computeRentalQuote(input: RentalQuoteInput) {
	const plannedStartAt = toDate(input.plannedStartAt)
	const plannedEndAt = toDate(input.plannedEndAt)

	if (
		Number.isNaN(plannedStartAt.getTime()) ||
		Number.isNaN(plannedEndAt.getTime())
	) {
		throw new Error("Valid rental dates are required for quote calculation.")
	}

	if (plannedEndAt <= plannedStartAt) {
		throw new Error("Rental end time must be after the start time.")
	}

	const durationDays = normalizeDurationDays(plannedStartAt, plannedEndAt)
	const pricingBucket = resolvePricingBucket(durationDays)
	const requiredPricingModel = requiredPricingModelForBucket(pricingBucket)
	const bucketRate = input.rates.find(
		(rate) => rate.pricingModel === requiredPricingModel,
	)

	if (!bucketRate) {
		throw new Error(
			`A ${requiredPricingModel.toLowerCase()} rate is required for this rental duration.`,
		)
	}

	const unitCount = Math.max(
		1,
		Math.ceil(durationDays / unitSizeForBucket(pricingBucket)),
	)
	const subtotal = roundAmount(bucketRate.rate * unitCount)
	const discountTotal = roundAmount(Math.max(0, input.discountAmount ?? 0))
	const taxableBase = Math.max(0, subtotal - discountTotal)
	const taxTotal = roundAmount(
		Math.max(0, taxableBase * Math.max(0, (input.taxRatePercent ?? 0) / 100)),
	)
	const defaultDepositAmount = bucketRate.requiresDeposit
		? (bucketRate.depositAmount ?? 0)
		: 0
	const depositRequired =
		Boolean(input.depositRequired) || bucketRate.requiresDeposit
	const depositAmount = roundAmount(
		depositRequired
			? Math.max(
					0,
					input.depositAmount === null || input.depositAmount === undefined
						? defaultDepositAmount
						: input.depositAmount,
				)
			: 0,
	)
	const grandTotal = roundAmount(taxableBase + taxTotal + depositAmount)

	const lineItems: RentalQuoteLineItem[] = [
		{
			code: "base_rental",
			label: `Base rental (${unitCount} ${pricingBucket}${unitCount === 1 ? "" : "s"})`,
			amount: subtotal,
			type: "charge",
		},
	]

	if (discountTotal > 0) {
		lineItems.push({
			code: "discount",
			label: "Discount",
			amount: discountTotal,
			type: "discount",
		})
	}

	if (taxTotal > 0) {
		lineItems.push({
			code: "tax",
			label: "Tax",
			amount: taxTotal,
			type: "tax",
		})
	}

	if (depositAmount > 0) {
		lineItems.push({
			code: "deposit",
			label: "Deposit",
			amount: depositAmount,
			type: "deposit",
		})
	}

	return {
		durationDays,
		pricingBucket,
		unitCount,
		baseRate: roundAmount(bucketRate.rate),
		subtotal,
		discountTotal,
		taxTotal,
		depositAmount,
		grandTotal,
		lineItems,
	} satisfies RentalQuoteSummary
}

export function buildRentalPaymentSchedulePreview(
	input: RentalPaymentPlanPreviewInput,
): RentalInstallmentPreview[] {
	const plannedStartAt = toDate(input.plannedStartAt)
	const plannedEndAt = toDate(input.plannedEndAt)

	if (
		Number.isNaN(plannedStartAt.getTime()) ||
		Number.isNaN(plannedEndAt.getTime())
	) {
		throw new Error("Valid rental dates are required for payment scheduling.")
	}

	if (plannedEndAt <= plannedStartAt) {
		throw new Error("Rental end time must be after the start time.")
	}

	if (input.paymentPlanKind === "single") {
		return [
			{
				sequence: 1,
				label: "Single payment",
				dueAt: plannedStartAt.toISOString(),
				amount: roundAmount(input.grandTotal),
				isFirstCharge: true,
			},
		]
	}

	const durationDays = normalizeDurationDays(plannedStartAt, plannedEndAt)
	const interval = input.installmentInterval
	if (!interval) {
		throw new Error("Installment interval is required for installment plans.")
	}

	const intervalDays = intervalDaysForInstallment(interval)
	const count =
		input.installmentCount ??
		Math.max(1, Math.ceil(durationDays / intervalDays))
	const dueDates: Date[] = []

	let nextDueAt = new Date(plannedStartAt)
	while (dueDates.length < count) {
		dueDates.push(new Date(nextDueAt))
		nextDueAt = advanceForInstallment(nextDueAt, interval)
	}

	const installmentBaseTotal = Math.max(
		0,
		input.grandTotal - input.depositAmount,
	)
	const installments = equalInstallments(installmentBaseTotal, count)

	return dueDates.map((dueAt, index) => ({
		sequence: index + 1,
		label: `Installment ${index + 1}`,
		dueAt: dueAt.toISOString(),
		amount: roundAmount(
			installments[index] + (index === 0 ? input.depositAmount : 0),
		),
		isFirstCharge: index === 0,
	}))
}
