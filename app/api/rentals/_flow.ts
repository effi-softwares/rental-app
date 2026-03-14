import { createHash } from "node:crypto"
import { and, desc, eq, inArray } from "drizzle-orm"

import {
	normalizeCustomerEmail,
	normalizeCustomerPhone,
} from "@/features/customers/lib/normalize"
import {
	buildRentalPaymentSchedulePreview,
	computeRentalQuote,
} from "@/features/rentals/lib/quote"
import { jsonError } from "@/lib/api/errors"
import {
	getScopedBranchIdsForViewer,
	getViewerMembershipId,
	viewerHasPermission,
} from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { branch } from "@/lib/db/schema/branches"
import { customer } from "@/lib/db/schema/customers"
import {
	rental,
	rentalAgreement,
	rentalAmendment,
	rentalCharge,
	rentalDamage,
	rentalDepositEvent,
	rentalEvent,
	rentalInspection,
	rentalInvoice,
	rentalInvoiceLineItem,
	rentalPayment,
	rentalPaymentSchedule,
	rentalPricingSnapshot,
} from "@/lib/db/schema/rentals"
import { vehicle, vehicleRate } from "@/lib/db/schema/vehicles"
import {
	checkRentalAvailability,
	upsertRentalDraftHold,
} from "@/lib/rentals/availability"
import { cancelPreActivationRecurringBilling } from "@/lib/stripe/rental-billing"
import type { Context } from "@/types"
import {
	getRentalVehicleSummary,
	hasBranchAccess,
	mapRentalAmendmentRecord,
	mapRentalChargeRecord,
	mapRentalDamageRecord,
	mapRentalDepositEventRecord,
	mapRentalInspectionRecord,
	mapRentalPaymentRecord,
	mapRentalPaymentScheduleRecord,
	mapRentalTimelineRecord,
	numericToNumber,
	parseIsoDateOrNull,
} from "./_lib"

type ViewerWithOrg = Context & { activeOrganizationId: string }

export type RentalCommitPayload = {
	vehicleId?: string
	customer?: {
		fullName?: string
		email?: string
		phone?: string
		matchedCustomerId?: string | null
	}
	schedule?: {
		plannedStartAt?: string
		plannedEndAt?: string
	}
	pricing?: {
		pricingBucket?: "day" | "week" | "month"
		unitCount?: number
		baseRate?: number
		subtotal?: number
		discountAmount?: number
		taxRatePercent?: number
		taxTotal?: number
		depositRequired?: boolean
		depositAmount?: number
		grandTotal?: number
		lineItems?: Array<{
			code: string
			label: string
			amount: number
			quantity?: number
			type: "charge" | "tax" | "discount" | "deposit"
		}>
	}
	paymentPlan?: {
		paymentPlanKind?: "single" | "installment"
		firstCollectionTiming?: "setup" | "handover"
		installmentInterval?: "week" | "month" | null
		installmentCount?: number | null
		schedule?: Array<{
			sequence: number
			label: string
			dueAt: string
			amount: number
			isFirstCharge: boolean
		}>
	}
	notes?: string
}

function parseCommitPayload(payload: RentalCommitPayload | null) {
	const vehicleId = payload?.vehicleId?.trim()
	const fullName = payload?.customer?.fullName?.trim() ?? ""
	const email = payload?.customer?.email?.trim() ?? ""
	const phone = payload?.customer?.phone?.trim() ?? ""
	const matchedCustomerId = payload?.customer?.matchedCustomerId?.trim() ?? null
	const plannedStartAt = parseIsoDateOrNull(payload?.schedule?.plannedStartAt)
	const plannedEndAt = parseIsoDateOrNull(payload?.schedule?.plannedEndAt)
	const pricingBucket = payload?.pricing?.pricingBucket ?? null
	const discountAmount = Math.max(0, payload?.pricing?.discountAmount ?? 0)
	const taxRatePercent = Math.max(0, payload?.pricing?.taxRatePercent ?? 0)
	const depositRequired = Boolean(payload?.pricing?.depositRequired)
	const depositAmount = Math.max(0, payload?.pricing?.depositAmount ?? 0)
	const paymentPlanKind = payload?.paymentPlan?.paymentPlanKind ?? "single"
	const firstCollectionTiming =
		payload?.paymentPlan?.firstCollectionTiming ?? "setup"
	const installmentInterval = payload?.paymentPlan?.installmentInterval ?? null
	const installmentCount = payload?.paymentPlan?.installmentCount ?? null
	const schedule = payload?.paymentPlan?.schedule ?? []
	const notes = payload?.notes?.trim() || null
	const hasCustomerPayload = Boolean(
		payload?.customer && (fullName || email || phone || matchedCustomerId),
	)
	const hasPricingPayload = Boolean(payload?.pricing || payload?.paymentPlan)

	if (!vehicleId) {
		return { error: jsonError("Select a vehicle to continue.", 400) }
	}

	if (!plannedStartAt || !plannedEndAt || plannedEndAt <= plannedStartAt) {
		return {
			error: jsonError(
				"Valid planned pickup and return timestamps are required.",
				400,
			),
		}
	}

	if ((plannedStartAt.getTime() / (15 * 60 * 1000)) % 1 !== 0) {
		return {
			error: jsonError(
				"Pickup time must be aligned to a 15-minute boundary.",
				400,
			),
		}
	}

	if ((plannedEndAt.getTime() / (15 * 60 * 1000)) % 1 !== 0) {
		return {
			error: jsonError(
				"Return time must be aligned to a 15-minute boundary.",
				400,
			),
		}
	}

	if (hasCustomerPayload || hasPricingPayload) {
		if (!fullName) {
			return { error: jsonError("Customer full name is required.", 400) }
		}

		if (!email && !phone) {
			return { error: jsonError("Customer email or phone is required.", 400) }
		}
	}

	if (hasPricingPayload) {
		if (!pricingBucket) {
			return { error: jsonError("Pricing bucket is required.", 400) }
		}

		if (paymentPlanKind !== "single" && paymentPlanKind !== "installment") {
			return { error: jsonError("Invalid payment plan kind.", 400) }
		}

		if (
			firstCollectionTiming !== "setup" &&
			firstCollectionTiming !== "handover"
		) {
			return { error: jsonError("Invalid first collection timing.", 400) }
		}

		if (
			installmentInterval !== null &&
			installmentInterval !== "week" &&
			installmentInterval !== "month"
		) {
			return { error: jsonError("Invalid installment interval.", 400) }
		}

		if (schedule.length === 0) {
			return { error: jsonError("Payment schedule preview is required.", 400) }
		}
	}

	return {
		hasCustomerPayload,
		hasPricingPayload,
		vehicleId,
		fullName,
		email,
		phone,
		matchedCustomerId,
		plannedStartAt,
		plannedEndAt,
		pricingBucket,
		discountAmount,
		taxRatePercent,
		depositRequired,
		depositAmount,
		paymentPlanKind,
		firstCollectionTiming,
		installmentInterval,
		installmentCount,
		schedule,
		notes,
	}
}

async function getVehicleRatesForCommit(
	organizationId: string,
	vehicleId: string,
) {
	const vehicleRows = await db
		.select({
			id: vehicle.id,
			branchId: vehicle.branchId,
			status: vehicle.status,
		})
		.from(vehicle)
		.where(
			and(
				eq(vehicle.organizationId, organizationId),
				eq(vehicle.id, vehicleId),
			),
		)
		.limit(1)

	const vehicleRecord = vehicleRows[0]
	if (!vehicleRecord) {
		return null
	}

	const rateRows = await db
		.select({
			pricingModel: vehicleRate.pricingModel,
			rate: vehicleRate.rate,
			requiresDeposit: vehicleRate.requiresDeposit,
			depositAmount: vehicleRate.depositAmount,
		})
		.from(vehicleRate)
		.where(
			and(
				eq(vehicleRate.organizationId, organizationId),
				eq(vehicleRate.vehicleId, vehicleId),
			),
		)

	return {
		...vehicleRecord,
		rates: rateRows.map((rate) => ({
			pricingModel: rate.pricingModel,
			rate: numericToNumber(rate.rate),
			requiresDeposit: rate.requiresDeposit,
			depositAmount:
				rate.depositAmount === null
					? null
					: numericToNumber(rate.depositAmount),
		})),
	}
}

async function upsertInvoiceSnapshotTx(input: {
	tx: Pick<typeof db, "select" | "insert" | "update" | "delete">
	organizationId: string
	branchId: string | null
	rentalId: string
	currency: string
	selectedPaymentMethodType: typeof rental.$inferSelect.selectedPaymentMethodType
	paymentPlanKind: typeof rental.$inferSelect.paymentPlanKind
	snapshot: {
		id: string
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
	}
}) {
	const existingRows = await input.tx
		.select({ id: rentalInvoice.id })
		.from(rentalInvoice)
		.where(
			and(
				eq(rentalInvoice.organizationId, input.organizationId),
				eq(rentalInvoice.rentalId, input.rentalId),
			),
		)
		.orderBy(desc(rentalInvoice.updatedAt))
		.limit(1)

	const collectionMethod: typeof rentalInvoice.$inferInsert.collectionMethod =
		input.paymentPlanKind === "installment" &&
		input.selectedPaymentMethodType &&
		input.selectedPaymentMethodType !== "cash"
			? ("charge_automatically" as const)
			: ("out_of_band" as const)

	const invoiceValues = {
		organizationId: input.organizationId,
		branchId: input.branchId,
		rentalId: input.rentalId,
		status: "draft" as const,
		collectionMethod,
		currency: input.currency,
		subtotal: input.snapshot.subtotal.toFixed(2),
		discountTotal: input.snapshot.discountTotal.toFixed(2),
		taxTotal: input.snapshot.taxTotal.toFixed(2),
		depositTotal: input.snapshot.depositAmount.toFixed(2),
		total: input.snapshot.grandTotal.toFixed(2),
		metadata: {
			source: "pricing_snapshot",
			pricingSnapshotId: input.snapshot.id,
		},
		updatedAt: new Date(),
	}

	const invoiceId = existingRows[0]
		? (
				await input.tx
					.update(rentalInvoice)
					.set(invoiceValues)
					.where(eq(rentalInvoice.id, existingRows[0].id))
					.returning({ id: rentalInvoice.id })
			)[0].id
		: (
				await input.tx
					.insert(rentalInvoice)
					.values(invoiceValues)
					.returning({ id: rentalInvoice.id })
			)[0].id

	await input.tx
		.delete(rentalInvoiceLineItem)
		.where(eq(rentalInvoiceLineItem.invoiceId, invoiceId))

	if (input.snapshot.lineItems.length > 0) {
		await input.tx.insert(rentalInvoiceLineItem).values(
			input.snapshot.lineItems.map((item, index) => ({
				organizationId: input.organizationId,
				invoiceId,
				code: item.code,
				label: item.label,
				quantity: item.quantity ?? 1,
				amount: item.amount.toFixed(2),
				type: item.type,
				sortOrder: index,
			})),
		)
	}
}

async function buildRentalDetailResponse(
	viewer: ViewerWithOrg,
	rentalRecord: typeof rental.$inferSelect,
) {
	const [
		branchSummary,
		vehicleSummary,
		customerSummary,
		agreementSummary,
		paymentRows,
		scheduleRows,
		invoiceSummary,
		inspectionRows,
		damageRows,
		chargeRows,
		depositEventRows,
		amendmentRows,
		timelineRows,
		canManagePayments,
	] = await Promise.all([
		rentalRecord.branchId
			? db
					.select({
						id: branch.id,
						name: branch.name,
					})
					.from(branch)
					.where(
						and(
							eq(branch.organizationId, viewer.activeOrganizationId),
							eq(branch.id, rentalRecord.branchId),
						),
					)
					.limit(1)
					.then((rows) => rows[0] ?? null)
			: Promise.resolve(null),
		rentalRecord.vehicleId
			? getRentalVehicleSummary(
					viewer.activeOrganizationId,
					rentalRecord.vehicleId,
				)
			: Promise.resolve(null),
		rentalRecord.customerId
			? db
					.select({
						id: customer.id,
						fullName: customer.fullName,
						email: customer.email,
						phone: customer.phone,
						verificationStatus: customer.verificationStatus,
						verificationMetadata: customer.verificationMetadata,
					})
					.from(customer)
					.where(
						and(
							eq(customer.organizationId, viewer.activeOrganizationId),
							eq(customer.id, rentalRecord.customerId),
						),
					)
					.limit(1)
					.then((rows) => rows[0] ?? null)
			: Promise.resolve(null),
		db
			.select({
				id: rentalAgreement.id,
				templateVersion: rentalAgreement.templateVersion,
				documentHash: rentalAgreement.documentHash,
				signedAt: rentalAgreement.signedAt,
			})
			.from(rentalAgreement)
			.where(
				and(
					eq(rentalAgreement.organizationId, viewer.activeOrganizationId),
					eq(rentalAgreement.rentalId, rentalRecord.id),
				),
			)
			.limit(1)
			.then((rows) => rows[0] ?? null),
		db
			.select()
			.from(rentalPayment)
			.where(
				and(
					eq(rentalPayment.organizationId, viewer.activeOrganizationId),
					eq(rentalPayment.rentalId, rentalRecord.id),
				),
			),
		db
			.select()
			.from(rentalPaymentSchedule)
			.where(
				and(
					eq(rentalPaymentSchedule.organizationId, viewer.activeOrganizationId),
					eq(rentalPaymentSchedule.rentalId, rentalRecord.id),
				),
			)
			.orderBy(rentalPaymentSchedule.sequence),
		db
			.select({
				id: rentalInvoice.id,
				status: rentalInvoice.status,
				collectionMethod: rentalInvoice.collectionMethod,
				currency: rentalInvoice.currency,
				stripeInvoiceId: rentalInvoice.stripeInvoiceId,
				hostedInvoiceUrl: rentalInvoice.hostedInvoiceUrl,
				invoicePdfUrl: rentalInvoice.invoicePdfUrl,
				subtotal: rentalInvoice.subtotal,
				discountTotal: rentalInvoice.discountTotal,
				taxTotal: rentalInvoice.taxTotal,
				depositTotal: rentalInvoice.depositTotal,
				total: rentalInvoice.total,
				issuedAt: rentalInvoice.issuedAt,
				dueAt: rentalInvoice.dueAt,
			})
			.from(rentalInvoice)
			.where(
				and(
					eq(rentalInvoice.organizationId, viewer.activeOrganizationId),
					eq(rentalInvoice.rentalId, rentalRecord.id),
				),
			)
			.orderBy(desc(rentalInvoice.updatedAt))
			.limit(1)
			.then(async (rows) => {
				const invoice = rows[0]
				if (!invoice) {
					return null
				}

				const lineItems = await db
					.select({
						id: rentalInvoiceLineItem.id,
						code: rentalInvoiceLineItem.code,
						label: rentalInvoiceLineItem.label,
						quantity: rentalInvoiceLineItem.quantity,
						amount: rentalInvoiceLineItem.amount,
						type: rentalInvoiceLineItem.type,
						sortOrder: rentalInvoiceLineItem.sortOrder,
					})
					.from(rentalInvoiceLineItem)
					.where(
						and(
							eq(
								rentalInvoiceLineItem.organizationId,
								viewer.activeOrganizationId,
							),
							eq(rentalInvoiceLineItem.invoiceId, invoice.id),
						),
					)

				return {
					id: invoice.id,
					status: invoice.status,
					collectionMethod: invoice.collectionMethod,
					currency: invoice.currency,
					stripeInvoiceId: invoice.stripeInvoiceId,
					hostedInvoiceUrl: invoice.hostedInvoiceUrl,
					invoicePdfUrl: invoice.invoicePdfUrl,
					subtotal: numericToNumber(invoice.subtotal),
					discountTotal: numericToNumber(invoice.discountTotal),
					taxTotal: numericToNumber(invoice.taxTotal),
					depositTotal: numericToNumber(invoice.depositTotal),
					total: numericToNumber(invoice.total),
					issuedAt: invoice.issuedAt?.toISOString() ?? null,
					dueAt: invoice.dueAt?.toISOString() ?? null,
					lineItems: lineItems.map((item) => ({
						id: item.id,
						code: item.code,
						label: item.label,
						quantity: item.quantity,
						amount: numericToNumber(item.amount),
						type: item.type,
						sortOrder: item.sortOrder,
					})),
				}
			}),
		db
			.select()
			.from(rentalInspection)
			.where(
				and(
					eq(rentalInspection.organizationId, viewer.activeOrganizationId),
					eq(rentalInspection.rentalId, rentalRecord.id),
				),
			)
			.orderBy(desc(rentalInspection.completedAt)),
		db
			.select()
			.from(rentalDamage)
			.where(
				and(
					eq(rentalDamage.organizationId, viewer.activeOrganizationId),
					eq(rentalDamage.rentalId, rentalRecord.id),
				),
			)
			.orderBy(desc(rentalDamage.createdAt)),
		db
			.select()
			.from(rentalCharge)
			.where(
				and(
					eq(rentalCharge.organizationId, viewer.activeOrganizationId),
					eq(rentalCharge.rentalId, rentalRecord.id),
				),
			)
			.orderBy(desc(rentalCharge.createdAt)),
		db
			.select()
			.from(rentalDepositEvent)
			.where(
				and(
					eq(rentalDepositEvent.organizationId, viewer.activeOrganizationId),
					eq(rentalDepositEvent.rentalId, rentalRecord.id),
				),
			)
			.orderBy(desc(rentalDepositEvent.createdAt)),
		db
			.select()
			.from(rentalAmendment)
			.where(
				and(
					eq(rentalAmendment.organizationId, viewer.activeOrganizationId),
					eq(rentalAmendment.rentalId, rentalRecord.id),
				),
			)
			.orderBy(desc(rentalAmendment.createdAt)),
		db
			.select({
				id: rentalEvent.id,
				type: rentalEvent.type,
				payloadJson: rentalEvent.payloadJson,
				createdAt: rentalEvent.createdAt,
				actorMemberId: rentalEvent.actorMemberId,
			})
			.from(rentalEvent)
			.where(
				and(
					eq(rentalEvent.organizationId, viewer.activeOrganizationId),
					eq(rentalEvent.rentalId, rentalRecord.id),
				),
			)
			.orderBy(desc(rentalEvent.createdAt))
			.limit(100),
		viewerHasPermission(viewer, "managePaymentsModule"),
	])

	let snapshotSummary = null as {
		id: string
		pricingBucket: "day" | "week" | "month"
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
	} | null

	if (rentalRecord.latestPricingSnapshotId) {
		const snapshotRows = await db
			.select({
				id: rentalPricingSnapshot.id,
				pricingBucket: rentalPricingSnapshot.pricingBucket,
				unitCount: rentalPricingSnapshot.unitCount,
				baseRate: rentalPricingSnapshot.baseRate,
				subtotal: rentalPricingSnapshot.subtotal,
				discountTotal: rentalPricingSnapshot.discountTotal,
				taxTotal: rentalPricingSnapshot.taxTotal,
				depositAmount: rentalPricingSnapshot.depositAmount,
				grandTotal: rentalPricingSnapshot.grandTotal,
				lineItemsJson: rentalPricingSnapshot.lineItemsJson,
				calcVersion: rentalPricingSnapshot.calcVersion,
				calcHash: rentalPricingSnapshot.calcHash,
				createdAt: rentalPricingSnapshot.createdAt,
			})
			.from(rentalPricingSnapshot)
			.where(
				and(
					eq(rentalPricingSnapshot.organizationId, viewer.activeOrganizationId),
					eq(rentalPricingSnapshot.id, rentalRecord.latestPricingSnapshotId),
				),
			)
			.limit(1)

		const snapshot = snapshotRows[0]
		if (snapshot) {
			snapshotSummary = {
				id: snapshot.id,
				pricingBucket: snapshot.pricingBucket,
				unitCount: snapshot.unitCount,
				baseRate: numericToNumber(snapshot.baseRate),
				subtotal: numericToNumber(snapshot.subtotal),
				discountTotal: numericToNumber(snapshot.discountTotal),
				taxTotal: numericToNumber(snapshot.taxTotal),
				depositAmount: numericToNumber(snapshot.depositAmount),
				grandTotal: numericToNumber(snapshot.grandTotal),
				lineItems: snapshot.lineItemsJson,
				calcVersion: snapshot.calcVersion,
				calcHash: snapshot.calcHash,
				createdAt: snapshot.createdAt.toISOString(),
			}
		}
	}

	const payments = paymentRows.map(mapRentalPaymentRecord)
	const paymentSchedule = scheduleRows.map(mapRentalPaymentScheduleRecord)
	const inspections = inspectionRows.map(mapRentalInspectionRecord)
	const damages = damageRows.map(mapRentalDamageRecord)
	const extraCharges = chargeRows.map(mapRentalChargeRecord)
	const depositEvents = depositEventRows.map(mapRentalDepositEventRecord)
	const amendments = amendmentRows.map(mapRentalAmendmentRecord)
	const timeline = timelineRows.map(mapRentalTimelineRecord)
	const depositAmount =
		rentalRecord.depositAmount === null
			? 0
			: numericToNumber(rentalRecord.depositAmount)
	const scheduledOutstanding = paymentSchedule
		.filter(
			(row) =>
				row.status === "pending" ||
				row.status === "processing" ||
				row.status === "failed",
		)
		.reduce((total, row) => total + row.amount, 0)
	const extraChargesOutstanding = extraCharges
		.filter((row) => row.status === "open" || row.status === "partially_paid")
		.reduce((total, row) => total + row.total, 0)
	const totalPaid = payments
		.filter((row) => row.status === "succeeded")
		.reduce((total, row) => total + row.amount, 0)
	const depositReleased = depositEvents
		.filter((row) => row.type === "released" || row.type === "refunded")
		.reduce((total, row) => total + row.amount, 0)
	const depositApplied = depositEvents
		.filter((row) => row.type === "applied_to_charge")
		.reduce((total, row) => total + row.amount, 0)
	const depositRetained = depositEvents
		.filter((row) => row.type === "retained")
		.reduce((total, row) => total + row.amount, 0)
	const depositHeld = Math.max(
		depositAmount - depositReleased - depositApplied - depositRetained,
		0,
	)
	const hasPickupInspection = inspections.some((row) => row.stage === "pickup")
	const hasOpenExtraCharges = extraCharges.some(
		(row) => row.status === "open" || row.status === "partially_paid",
	)
	const balanceDue = Math.max(
		scheduledOutstanding + extraChargesOutstanding - depositApplied,
		0,
	)
	const actionState = {
		canEditBooking:
			rentalRecord.status === "draft" ||
			rentalRecord.status === "awaiting_payment" ||
			rentalRecord.status === "scheduled",
		canFinalize:
			canManagePayments &&
			(rentalRecord.status === "draft" ||
				rentalRecord.status === "awaiting_payment"),
		canPreparePayment:
			canManagePayments &&
			rentalRecord.status !== "completed" &&
			rentalRecord.status !== "cancelled",
		canHandover:
			canManagePayments &&
			(rentalRecord.status === "scheduled" ||
				rentalRecord.status === "awaiting_payment") &&
			hasPickupInspection,
		canExtend: rentalRecord.status === "active",
		canInitiateReturn:
			rentalRecord.status === "active" || rentalRecord.status === "scheduled",
		canResolveDeposit:
			canManagePayments &&
			depositAmount > 0 &&
			rentalRecord.status !== "cancelled",
		canCloseRental:
			rentalRecord.status === "active" || rentalRecord.status === "scheduled",
		canCancel:
			rentalRecord.status === "draft" ||
			rentalRecord.status === "awaiting_payment" ||
			rentalRecord.status === "scheduled",
		missingPickupInspection:
			(rentalRecord.status === "scheduled" ||
				rentalRecord.status === "awaiting_payment" ||
				rentalRecord.status === "active" ||
				rentalRecord.status === "completed") &&
			!hasPickupInspection,
		hasOpenExtraCharges,
	}

	return {
		rental: {
			id: rentalRecord.id,
			status: rentalRecord.status,
			currency: rentalRecord.currency,
			plannedStartAt: rentalRecord.plannedStartAt?.toISOString() ?? null,
			plannedEndAt: rentalRecord.plannedEndAt?.toISOString() ?? null,
			actualStartAt: rentalRecord.actualStartAt?.toISOString() ?? null,
			actualEndAt: rentalRecord.actualEndAt?.toISOString() ?? null,
			branchId: rentalRecord.branchId,
			vehicleId: rentalRecord.vehicleId,
			customerId: rentalRecord.customerId,
			latestPricingSnapshotId: rentalRecord.latestPricingSnapshotId,
			pricingBucket: rentalRecord.pricingBucket,
			paymentPlanKind: rentalRecord.paymentPlanKind,
			firstCollectionTiming: rentalRecord.firstCollectionTiming,
			installmentInterval: rentalRecord.installmentInterval,
			installmentCount: rentalRecord.installmentCount,
			selectedPaymentMethodType: rentalRecord.selectedPaymentMethodType,
			storedPaymentMethodStatus: rentalRecord.storedPaymentMethodStatus,
			recurringBillingState: rentalRecord.recurringBillingState,
			depositRequired: rentalRecord.depositRequired,
			depositAmount: rentalRecord.depositAmount === null ? null : depositAmount,
			notes: rentalRecord.notes,
			version: rentalRecord.version,
			createdAt: rentalRecord.createdAt.toISOString(),
			updatedAt: rentalRecord.updatedAt.toISOString(),
		},
		branch: branchSummary,
		vehicle: vehicleSummary,
		customer: customerSummary,
		pricingSnapshot: snapshotSummary,
		paymentSchedule,
		invoice: invoiceSummary,
		agreement: agreementSummary
			? {
					id: agreementSummary.id,
					templateVersion: agreementSummary.templateVersion,
					documentHash: agreementSummary.documentHash,
					signedAt: agreementSummary.signedAt?.toISOString() ?? null,
				}
			: null,
		payments,
		financials: {
			invoiceTotal: invoiceSummary?.total ?? snapshotSummary?.grandTotal ?? 0,
			scheduledOutstanding,
			extraChargesOutstanding,
			totalPaid,
			depositHeld,
			depositReleased,
			depositApplied,
			depositRetained,
			balanceDue,
		},
		actionState,
		inspections,
		damages,
		extraCharges,
		deposit: {
			required: rentalRecord.depositRequired,
			amount: depositAmount,
			currency: rentalRecord.currency,
			events: depositEvents,
		},
		amendments,
		timeline,
		canManagePayments,
	}
}

export async function getRentalDetailResponse(
	viewer: ViewerWithOrg,
	rentalId: string,
) {
	const rows = await db
		.select()
		.from(rental)
		.where(
			and(
				eq(rental.organizationId, viewer.activeOrganizationId),
				eq(rental.id, rentalId),
			),
		)
		.limit(1)

	const rentalRecord = rows[0]
	if (!rentalRecord) {
		return { error: jsonError("Rental draft not found.", 404) }
	}

	return buildRentalDetailResponse(viewer, rentalRecord)
}

export async function commitRentalFlow(input: {
	viewer: ViewerWithOrg
	payload: RentalCommitPayload | null
	rentalId?: string
}) {
	const parsed = parseCommitPayload(input.payload)
	if ("error" in parsed) {
		return parsed
	}

	const existingRental = input.rentalId
		? await db
				.select()
				.from(rental)
				.where(
					and(
						eq(rental.organizationId, input.viewer.activeOrganizationId),
						eq(rental.id, input.rentalId),
					),
				)
				.limit(1)
				.then((rows) => rows[0] ?? null)
		: null
	const existingPaymentRows = existingRental
		? await db
				.select()
				.from(rentalPayment)
				.where(
					and(
						eq(rentalPayment.organizationId, input.viewer.activeOrganizationId),
						eq(rentalPayment.rentalId, existingRental.id),
					),
				)
		: []

	if (input.rentalId && !existingRental) {
		return { error: jsonError("Rental draft not found.", 404) }
	}

	if (existingPaymentRows.some((payment) => payment.status === "succeeded")) {
		return {
			error: jsonError(
				"Pricing inputs are locked after payment succeeds. Continue the current checkout instead of editing earlier steps.",
				400,
			),
		}
	}

	if (
		existingRental &&
		existingRental.status !== "active" &&
		existingRental.status !== "completed" &&
		existingRental.status !== "cancelled" &&
		(existingPaymentRows.length > 0 ||
			existingRental.selectedPaymentMethodType !== null ||
			existingRental.storedPaymentMethodStatus !== "none" ||
			existingRental.recurringBillingState !== "none")
	) {
		await cancelPreActivationRecurringBilling({
			organizationId: input.viewer.activeOrganizationId,
			rentalId: existingRental.id,
			nextRecurringBillingState: "none",
		})
	}

	const vehicleSummary = await getVehicleRatesForCommit(
		input.viewer.activeOrganizationId,
		parsed.vehicleId,
	)

	if (!vehicleSummary) {
		return { error: jsonError("Selected vehicle was not found.", 404) }
	}

	const scopedBranchIds = await getScopedBranchIdsForViewer(input.viewer)
	if (!hasBranchAccess(vehicleSummary.branchId, scopedBranchIds)) {
		return {
			error: jsonError("Selected vehicle branch is outside your scope.", 403),
		}
	}

	const availability = await checkRentalAvailability({
		organizationId: input.viewer.activeOrganizationId,
		vehicleId: parsed.vehicleId,
		startsAt: parsed.plannedStartAt,
		endsAt: parsed.plannedEndAt,
		rentalId: input.rentalId,
		scopedBranchIds,
	})

	if (!availability.isAvailable) {
		return {
			error: jsonError(
				availability.blockingReason ??
					"Vehicle is unavailable for the selected rental period.",
				409,
			),
		}
	}

	let committedRentalId: string | null = null
	const memberId = await getViewerMembershipId(input.viewer)

	try {
		committedRentalId = await db.transaction(async (tx) => {
			const transactionalExistingRental = input.rentalId
				? await tx
						.select()
						.from(rental)
						.where(
							and(
								eq(rental.organizationId, input.viewer.activeOrganizationId),
								eq(rental.id, input.rentalId),
							),
						)
						.limit(1)
						.then((rows) => rows[0] ?? null)
				: null

			if (transactionalExistingRental) {
				await tx
					.delete(rentalAgreement)
					.where(
						and(
							eq(
								rentalAgreement.organizationId,
								input.viewer.activeOrganizationId,
							),
							eq(rentalAgreement.rentalId, transactionalExistingRental.id),
						),
					)

				await tx
					.delete(rentalPayment)
					.where(
						and(
							eq(
								rentalPayment.organizationId,
								input.viewer.activeOrganizationId,
							),
							eq(rentalPayment.rentalId, transactionalExistingRental.id),
						),
					)

				await tx
					.delete(rentalPaymentSchedule)
					.where(
						and(
							eq(
								rentalPaymentSchedule.organizationId,
								input.viewer.activeOrganizationId,
							),
							eq(
								rentalPaymentSchedule.rentalId,
								transactionalExistingRental.id,
							),
						),
					)

				const invoiceIds = await tx
					.select({ id: rentalInvoice.id })
					.from(rentalInvoice)
					.where(
						and(
							eq(
								rentalInvoice.organizationId,
								input.viewer.activeOrganizationId,
							),
							eq(rentalInvoice.rentalId, transactionalExistingRental.id),
						),
					)

				if (invoiceIds.length > 0) {
					await tx.delete(rentalInvoiceLineItem).where(
						inArray(
							rentalInvoiceLineItem.invoiceId,
							invoiceIds.map((invoice) => invoice.id),
						),
					)

					await tx
						.delete(rentalInvoice)
						.where(
							and(
								eq(
									rentalInvoice.organizationId,
									input.viewer.activeOrganizationId,
								),
								eq(rentalInvoice.rentalId, transactionalExistingRental.id),
							),
						)
				}
			}

			const baseRentalValues = {
				organizationId: input.viewer.activeOrganizationId,
				branchId: vehicleSummary.branchId,
				vehicleId: parsed.vehicleId,
				status: "draft" as const,
				currency: "AUD",
				plannedStartAt: parsed.plannedStartAt,
				plannedEndAt: parsed.plannedEndAt,
				selectedPaymentMethodType: null,
				storedPaymentMethodStatus: "none" as const,
				recurringBillingState: "none" as const,
				updatedByMemberId: memberId,
				updatedAt: new Date(),
			}

			if (!parsed.hasPricingPayload) {
				const rentalRecord = transactionalExistingRental
					? (
							await tx
								.update(rental)
								.set({
									...baseRentalValues,
									customerId: transactionalExistingRental.customerId,
									latestPricingSnapshotId: null,
									pricingBucket: null,
									paymentPlanKind: "single",
									firstCollectionTiming: "setup",
									installmentInterval: null,
									installmentCount: null,
									depositRequired: false,
									depositAmount: null,
									notes: transactionalExistingRental.notes,
									version: transactionalExistingRental.version + 1,
								})
								.where(
									and(
										eq(
											rental.organizationId,
											input.viewer.activeOrganizationId,
										),
										eq(rental.id, transactionalExistingRental.id),
									),
								)
								.returning()
						)[0]
					: (
							await tx
								.insert(rental)
								.values({
									...baseRentalValues,
									customerId: null,
									latestPricingSnapshotId: null,
									pricingBucket: null,
									paymentPlanKind: "single",
									firstCollectionTiming: "setup",
									installmentInterval: null,
									installmentCount: null,
									depositRequired: false,
									depositAmount: null,
									notes: null,
									createdByMemberId: memberId,
								})
								.returning()
						)[0]

				return rentalRecord.id
			}

			let resolvedCustomerId: string
			if (parsed.matchedCustomerId) {
				const selectedCustomer = await tx
					.select({ id: customer.id })
					.from(customer)
					.where(
						and(
							eq(customer.organizationId, input.viewer.activeOrganizationId),
							eq(customer.id, parsed.matchedCustomerId),
						),
					)
					.limit(1)
					.then((rows) => rows[0] ?? null)

				if (!selectedCustomer) {
					throw new Error("Selected customer was not found.")
				}

				resolvedCustomerId = selectedCustomer.id
			} else {
				const [createdCustomer] = await tx
					.insert(customer)
					.values({
						organizationId: input.viewer.activeOrganizationId,
						branchId: vehicleSummary.branchId,
						fullName: parsed.fullName,
						email: parsed.email || null,
						emailNormalized: normalizeCustomerEmail(parsed.email),
						phone: parsed.phone || null,
						phoneNormalized: normalizeCustomerPhone(parsed.phone),
						verificationStatus: "pending",
						verificationMetadata: { source: "rental-flow-v2" },
					})
					.returning({ id: customer.id })

				resolvedCustomerId = createdCustomer.id
			}

			const serverQuote = computeRentalQuote({
				plannedStartAt: parsed.plannedStartAt.toISOString(),
				plannedEndAt: parsed.plannedEndAt.toISOString(),
				taxRatePercent: parsed.taxRatePercent,
				discountAmount: parsed.discountAmount,
				depositRequired: parsed.depositRequired,
				depositAmount: parsed.depositAmount,
				rates: vehicleSummary.rates,
			})

			if (serverQuote.pricingBucket !== parsed.pricingBucket) {
				throw new Error("Pricing bucket no longer matches the rental duration.")
			}

			const serverSchedule = buildRentalPaymentSchedulePreview({
				plannedStartAt: parsed.plannedStartAt.toISOString(),
				plannedEndAt: parsed.plannedEndAt.toISOString(),
				grandTotal: serverQuote.grandTotal,
				depositAmount: serverQuote.depositAmount,
				paymentPlanKind: parsed.paymentPlanKind,
				firstCollectionTiming: parsed.firstCollectionTiming,
				installmentInterval: parsed.installmentInterval,
				installmentCount: parsed.installmentCount,
			})

			const scheduleHash = JSON.stringify(
				serverSchedule.map((item) => ({
					sequence: item.sequence,
					dueAt: item.dueAt,
					amount: item.amount,
					isFirstCharge: item.isFirstCharge,
				})),
			)
			const payloadScheduleHash = JSON.stringify(
				parsed.schedule.map((item) => ({
					sequence: item.sequence,
					dueAt: item.dueAt,
					amount: item.amount,
					isFirstCharge: item.isFirstCharge,
				})),
			)

			if (scheduleHash !== payloadScheduleHash) {
				throw new Error("Payment schedule preview is stale. Refresh step 4.")
			}

			const rentalRecord = transactionalExistingRental
				? (
						await tx
							.update(rental)
							.set({
								...baseRentalValues,
								customerId: resolvedCustomerId,
								pricingBucket: serverQuote.pricingBucket,
								paymentPlanKind: parsed.paymentPlanKind,
								firstCollectionTiming: parsed.firstCollectionTiming,
								installmentInterval: parsed.installmentInterval,
								installmentCount: serverSchedule.length,
								depositRequired: serverQuote.depositAmount > 0,
								depositAmount:
									serverQuote.depositAmount > 0
										? serverQuote.depositAmount.toFixed(2)
										: null,
								notes: parsed.notes,
								version: transactionalExistingRental.version + 1,
							})
							.where(
								and(
									eq(rental.organizationId, input.viewer.activeOrganizationId),
									eq(rental.id, transactionalExistingRental.id),
								),
							)
							.returning()
					)[0]
				: (
						await tx
							.insert(rental)
							.values({
								...baseRentalValues,
								customerId: resolvedCustomerId,
								pricingBucket: serverQuote.pricingBucket,
								paymentPlanKind: parsed.paymentPlanKind,
								firstCollectionTiming: parsed.firstCollectionTiming,
								installmentInterval: parsed.installmentInterval,
								installmentCount: serverSchedule.length,
								depositRequired: serverQuote.depositAmount > 0,
								depositAmount:
									serverQuote.depositAmount > 0
										? serverQuote.depositAmount.toFixed(2)
										: null,
								notes: parsed.notes,
								createdByMemberId: memberId,
							})
							.returning()
					)[0]

			const calcHash = createHash("sha256")
				.update(
					JSON.stringify({
						rentalId: rentalRecord.id,
						vehicleId: parsed.vehicleId,
						customerId: resolvedCustomerId,
						quote: serverQuote,
						schedule: serverSchedule,
					}),
				)
				.digest("hex")

			const [snapshot] = await tx
				.insert(rentalPricingSnapshot)
				.values({
					organizationId: input.viewer.activeOrganizationId,
					branchId: vehicleSummary.branchId,
					rentalId: rentalRecord.id,
					pricingBucket: serverQuote.pricingBucket,
					unitCount: serverQuote.unitCount,
					baseRate: serverQuote.baseRate.toFixed(2),
					subtotal: serverQuote.subtotal.toFixed(2),
					discountTotal: serverQuote.discountTotal.toFixed(2),
					taxTotal: serverQuote.taxTotal.toFixed(2),
					depositAmount: serverQuote.depositAmount.toFixed(2),
					grandTotal: serverQuote.grandTotal.toFixed(2),
					lineItemsJson: serverQuote.lineItems,
					calcVersion: "v2",
					calcHash,
				})
				.returning({
					id: rentalPricingSnapshot.id,
				})

			await tx
				.update(rental)
				.set({
					latestPricingSnapshotId: snapshot.id,
					version: rentalRecord.version + 1,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(rental.organizationId, input.viewer.activeOrganizationId),
						eq(rental.id, rentalRecord.id),
					),
				)

			if (serverSchedule.length > 0) {
				await tx.insert(rentalPaymentSchedule).values(
					serverSchedule.map((item) => ({
						organizationId: input.viewer.activeOrganizationId,
						branchId: vehicleSummary.branchId,
						rentalId: rentalRecord.id,
						sequence: item.sequence,
						label: item.label,
						dueAt: new Date(item.dueAt),
						amount: item.amount.toFixed(2),
						currency: "AUD",
						status: "pending" as const,
						isFirstCharge: item.isFirstCharge,
						metadata: {},
					})),
				)
			}

			await upsertInvoiceSnapshotTx({
				tx,
				organizationId: input.viewer.activeOrganizationId,
				branchId: vehicleSummary.branchId,
				rentalId: rentalRecord.id,
				currency: "AUD",
				selectedPaymentMethodType: null,
				paymentPlanKind: parsed.paymentPlanKind,
				snapshot: {
					id: snapshot.id,
					subtotal: serverQuote.subtotal,
					discountTotal: serverQuote.discountTotal,
					taxTotal: serverQuote.taxTotal,
					depositAmount: serverQuote.depositAmount,
					grandTotal: serverQuote.grandTotal,
					lineItems: serverQuote.lineItems,
				},
			})

			return rentalRecord.id
		})
	} catch (error) {
		return {
			error: jsonError(
				error instanceof Error ? error.message : "Unable to save rental.",
				400,
			),
		}
	}

	if (!committedRentalId) {
		return { error: jsonError("Unable to save rental.", 500) }
	}

	await upsertRentalDraftHold({
		organizationId: input.viewer.activeOrganizationId,
		branchId: vehicleSummary.branchId,
		vehicleId: parsed.vehicleId,
		rentalId: committedRentalId,
		startsAt: parsed.plannedStartAt,
		endsAt: parsed.plannedEndAt,
		memberId,
		note: parsed.hasPricingPayload
			? "Rental intake draft hold"
			: "Schedule confirmation hold",
	})

	return getRentalDetailResponse(input.viewer, committedRentalId)
}
