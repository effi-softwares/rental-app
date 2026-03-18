import { and, eq } from "drizzle-orm"

import { forbiddenError, jsonError } from "@/lib/api/errors"
import {
	getScopedBranchIdsForViewer,
	getViewerMembershipId,
} from "@/lib/authorization/server"
import { db } from "@/lib/db"
import { customer } from "@/lib/db/schema/customers"
import {
	rental,
	type rentalAmendment,
	type rentalCharge,
	type rentalDamage,
	type rentalDepositEvent,
	rentalEvent,
	type rentalInspection,
	type rentalPayment,
	rentalPaymentSchedule,
} from "@/lib/db/schema/rentals"
import {
	vehicle,
	vehicleBrand,
	vehicleClass,
	vehicleModel,
	vehicleRate,
} from "@/lib/db/schema/vehicles"
import type { Context } from "@/types"

export function parseIsoDateOrNull(value: string | null | undefined) {
	if (!value) {
		return null
	}

	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		return null
	}

	return parsed
}

export function hasBranchAccess(
	branchId: string | null,
	scopedBranchIds: string[] | null,
) {
	if (scopedBranchIds === null) {
		return true
	}

	if (!branchId) {
		return false
	}

	return scopedBranchIds.includes(branchId)
}

export async function getScopedRentalForViewer(
	viewer: Context & { activeOrganizationId: string },
	rentalId: string,
) {
	const scopedBranchIds = await getScopedBranchIdsForViewer(viewer)

	const rows = await db
		.select()
		.from(rental)
		.where(
			and(
				eq(rental.id, rentalId),
				eq(rental.organizationId, viewer.activeOrganizationId),
			),
		)
		.limit(1)

	const record = rows[0]
	if (!record) {
		return { error: jsonError("Rental draft not found.", 404) }
	}

	if (!hasBranchAccess(record.branchId, scopedBranchIds)) {
		return { error: forbiddenError() }
	}

	return { record, scopedBranchIds }
}

export function numericToNumber(value: unknown) {
	if (typeof value === "number") {
		return value
	}

	if (typeof value === "string") {
		const parsed = Number(value)
		return Number.isFinite(parsed) ? parsed : 0
	}

	return 0
}

export function mapRentalPaymentRecord(
	record: Pick<
		typeof rentalPayment.$inferSelect,
		| "id"
		| "scheduleId"
		| "kind"
		| "status"
		| "amount"
		| "currency"
		| "paymentMethodType"
		| "collectionSurface"
		| "manualReference"
		| "externalReference"
		| "stripePaymentIntentId"
		| "stripeSetupIntentId"
		| "stripeInvoiceId"
		| "stripeSubscriptionId"
		| "stripeSubscriptionScheduleId"
		| "stripePaymentMethodId"
		| "capturedAt"
		| "createdAt"
		| "updatedAt"
	>,
) {
	return {
		id: record.id,
		scheduleId: record.scheduleId,
		kind: record.kind,
		status: record.status,
		amount: numericToNumber(record.amount),
		currency: record.currency,
		paymentMethodType: record.paymentMethodType,
		collectionSurface: record.collectionSurface,
		manualReference: record.manualReference,
		externalReference: record.externalReference,
		stripePaymentIntentId: record.stripePaymentIntentId,
		stripeSetupIntentId: record.stripeSetupIntentId,
		stripeInvoiceId: record.stripeInvoiceId,
		stripeSubscriptionId: record.stripeSubscriptionId,
		stripeSubscriptionScheduleId: record.stripeSubscriptionScheduleId,
		stripePaymentMethodId: record.stripePaymentMethodId,
		capturedAt: record.capturedAt?.toISOString() ?? null,
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
	}
}

export function mapRentalPaymentScheduleRecord(
	record: Pick<
		typeof rentalPaymentSchedule.$inferSelect,
		| "id"
		| "sequence"
		| "label"
		| "dueAt"
		| "amount"
		| "currency"
		| "status"
		| "paymentMethodType"
		| "isFirstCharge"
		| "stripeInvoiceId"
		| "stripeSubscriptionId"
		| "failureReason"
	>,
) {
	return {
		id: record.id,
		sequence: record.sequence,
		label: record.label,
		dueAt: record.dueAt.toISOString(),
		amount: numericToNumber(record.amount),
		currency: record.currency,
		status: record.status,
		paymentMethodType: record.paymentMethodType,
		isFirstCharge: record.isFirstCharge,
		stripeInvoiceId: record.stripeInvoiceId,
		stripeSubscriptionId: record.stripeSubscriptionId,
		failureReason: record.failureReason,
	}
}

function mapRentalMediaArray(value: unknown) {
	if (!Array.isArray(value)) {
		return []
	}

	return value
		.filter((entry) => entry && typeof entry === "object")
		.map((entry) => {
			const media = entry as {
				assetId?: unknown
				deliveryUrl?: unknown
				blurDataUrl?: unknown
				label?: unknown
			}

			if (
				typeof media.assetId !== "string" ||
				typeof media.deliveryUrl !== "string" ||
				typeof media.blurDataUrl !== "string"
			) {
				return null
			}

			return {
				assetId: media.assetId,
				deliveryUrl: media.deliveryUrl,
				blurDataUrl: media.blurDataUrl,
				label: typeof media.label === "string" ? media.label : null,
			}
		})
		.filter(
			(
				entry,
			): entry is {
				assetId: string
				deliveryUrl: string
				blurDataUrl: string
				label: string | null
			} => Boolean(entry),
		)
}

export function mapRentalInspectionRecord(
	record: Pick<
		typeof rentalInspection.$inferSelect,
		| "id"
		| "stage"
		| "odometerKm"
		| "fuelPercent"
		| "cleanliness"
		| "conditionRating"
		| "checklistJson"
		| "notes"
		| "signaturePayload"
		| "mediaJson"
		| "completedAt"
		| "completedByMemberId"
	>,
) {
	const signaturePayload = record.signaturePayload as
		| {
			signerName?: unknown
			signature?: unknown
		}
		| undefined

	return {
		id: record.id,
		stage: record.stage,
		odometerKm:
			record.odometerKm === null ? null : numericToNumber(record.odometerKm),
		fuelPercent:
			record.fuelPercent === null ? null : numericToNumber(record.fuelPercent),
		cleanliness: record.cleanliness,
		conditionRating: record.conditionRating,
		checklist:
			record.checklistJson && typeof record.checklistJson === "object"
				? (record.checklistJson as Record<string, boolean>)
				: {},
		notes: record.notes,
		signature: signaturePayload
			? {
				signerName:
					typeof signaturePayload.signerName === "string"
						? signaturePayload.signerName
						: null,
				signature:
					typeof signaturePayload.signature === "string"
						? signaturePayload.signature
						: null,
			}
			: null,
		media: mapRentalMediaArray(record.mediaJson),
		completedAt: record.completedAt.toISOString(),
		completedByMemberId: record.completedByMemberId,
	}
}

function mapVehicleConditionSnapshot(
	value: (typeof vehicle.$inferSelect)["latestConditionSnapshot"],
) {
	if (!value || typeof value !== "object") {
		return null
	}

	const snapshot = value as {
		rating?: unknown
		inspectionStage?: unknown
		rentalId?: unknown
		inspectionId?: unknown
		recordedAt?: unknown
		odometerKm?: unknown
		fuelPercent?: unknown
		cleanliness?: unknown
		notes?: unknown
		media?: unknown
	}

	if (
		typeof snapshot.rating !== "string" ||
		typeof snapshot.inspectionStage !== "string" ||
		typeof snapshot.rentalId !== "string" ||
		typeof snapshot.inspectionId !== "string" ||
		typeof snapshot.recordedAt !== "string"
	) {
		return null
	}

	return {
		rating: snapshot.rating,
		inspectionStage: snapshot.inspectionStage,
		rentalId: snapshot.rentalId,
		inspectionId: snapshot.inspectionId,
		recordedAt: snapshot.recordedAt,
		odometerKm:
			typeof snapshot.odometerKm === "number" ? snapshot.odometerKm : null,
		fuelPercent:
			typeof snapshot.fuelPercent === "number" ? snapshot.fuelPercent : null,
		cleanliness:
			typeof snapshot.cleanliness === "string" ? snapshot.cleanliness : null,
		notes: typeof snapshot.notes === "string" ? snapshot.notes : null,
		media: mapRentalMediaArray(snapshot.media),
	}
}

export function mapRentalDamageRecord(
	record: Pick<
		typeof rentalDamage.$inferSelect,
		| "id"
		| "inspectionId"
		| "category"
		| "title"
		| "description"
		| "severity"
		| "customerLiabilityAmount"
		| "estimatedCost"
		| "actualCost"
		| "repairStatus"
		| "occurredAt"
		| "repairedAt"
		| "mediaJson"
	>,
) {
	return {
		id: record.id,
		inspectionId: record.inspectionId,
		category: record.category,
		title: record.title,
		description: record.description,
		severity: record.severity,
		customerLiabilityAmount: numericToNumber(record.customerLiabilityAmount),
		estimatedCost:
			record.estimatedCost === null
				? null
				: numericToNumber(record.estimatedCost),
		actualCost:
			record.actualCost === null ? null : numericToNumber(record.actualCost),
		repairStatus: record.repairStatus,
		occurredAt: record.occurredAt?.toISOString() ?? null,
		repairedAt: record.repairedAt?.toISOString() ?? null,
		media: mapRentalMediaArray(record.mediaJson),
	}
}

export function mapRentalChargeRecord(
	record: Pick<
		typeof rentalCharge.$inferSelect,
		| "id"
		| "kind"
		| "status"
		| "amount"
		| "taxAmount"
		| "total"
		| "currency"
		| "dueAt"
		| "description"
		| "linkedDamageId"
		| "linkedPaymentId"
		| "metadata"
		| "createdAt"
		| "updatedAt"
	>,
) {
	return {
		id: record.id,
		kind: record.kind,
		status: record.status,
		amount: numericToNumber(record.amount),
		taxAmount: numericToNumber(record.taxAmount),
		total: numericToNumber(record.total),
		currency: record.currency,
		dueAt: record.dueAt?.toISOString() ?? null,
		description: record.description,
		linkedDamageId: record.linkedDamageId,
		linkedPaymentId: record.linkedPaymentId,
		metadata:
			record.metadata && typeof record.metadata === "object"
				? (record.metadata as Record<string, unknown>)
				: {},
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
	}
}

export function mapRentalDepositEventRecord(
	record: Pick<
		typeof rentalDepositEvent.$inferSelect,
		| "id"
		| "type"
		| "amount"
		| "currency"
		| "linkedChargeId"
		| "linkedPaymentId"
		| "note"
		| "createdAt"
	>,
) {
	return {
		id: record.id,
		type: record.type,
		amount: numericToNumber(record.amount),
		currency: record.currency,
		linkedChargeId: record.linkedChargeId,
		linkedPaymentId: record.linkedPaymentId,
		note: record.note,
		createdAt: record.createdAt.toISOString(),
	}
}

export function mapRentalAmendmentRecord(
	record: Pick<
		typeof rentalAmendment.$inferSelect,
		| "id"
		| "type"
		| "previousPlannedStartAt"
		| "previousPlannedEndAt"
		| "nextPlannedStartAt"
		| "nextPlannedEndAt"
		| "deltaAmount"
		| "currency"
		| "pricingSnapshotId"
		| "reason"
		| "createdAt"
	>,
) {
	return {
		id: record.id,
		type: record.type,
		previousPlannedStartAt:
			record.previousPlannedStartAt?.toISOString() ?? null,
		previousPlannedEndAt: record.previousPlannedEndAt?.toISOString() ?? null,
		nextPlannedStartAt: record.nextPlannedStartAt?.toISOString() ?? null,
		nextPlannedEndAt: record.nextPlannedEndAt?.toISOString() ?? null,
		deltaAmount: numericToNumber(record.deltaAmount),
		currency: record.currency,
		pricingSnapshotId: record.pricingSnapshotId,
		reason: record.reason,
		createdAt: record.createdAt.toISOString(),
	}
}

export function mapRentalTimelineRecord(
	record: Pick<
		typeof rentalEvent.$inferSelect,
		"id" | "type" | "payloadJson" | "createdAt" | "actorMemberId"
	>,
) {
	return {
		id: record.id,
		type: record.type,
		payload:
			record.payloadJson && typeof record.payloadJson === "object"
				? (record.payloadJson as Record<string, unknown>)
				: {},
		createdAt: record.createdAt.toISOString(),
		actorMemberId: record.actorMemberId,
	}
}

export function hasReachableCustomerContact(record: {
	email: string | null
	phone: string | null
}) {
	return Boolean(
		(typeof record.email === "string" && record.email.trim().length > 0) ||
		(typeof record.phone === "string" && record.phone.trim().length > 0),
	)
}

export async function logRentalEvent(input: {
	viewer: Context & { activeOrganizationId: string }
	rentalId: string
	branchId: string | null
	type: string
	payload: Record<string, unknown>
}) {
	const actorMemberId = await getViewerMembershipId(input.viewer)

	await db.insert(rentalEvent).values({
		organizationId: input.viewer.activeOrganizationId,
		branchId: input.branchId,
		rentalId: input.rentalId,
		type: input.type,
		payloadJson: input.payload,
		actorMemberId,
	})
}

function isAbsoluteHttpUrl(value: string) {
	try {
		const parsed = new URL(value)
		return parsed.protocol === "http:" || parsed.protocol === "https:"
	} catch {
		return false
	}
}

function isValidDeliveryUrl(value: string) {
	return value.startsWith("/") || isAbsoluteHttpUrl(value)
}

function normalizeFrontImageForSummary(images: unknown) {
	if (!images || typeof images !== "object") {
		return null
	}

	const frontImages = (images as { frontImages?: unknown }).frontImages
	if (!Array.isArray(frontImages)) {
		return null
	}

	const normalized = frontImages
		.filter((entry) => entry && typeof entry === "object")
		.map((entry, index) => {
			const image = entry as {
				assetId?: unknown
				deliveryUrl?: unknown
				blurDataUrl?: unknown
				sortOrder?: unknown
			}

			if (
				typeof image.assetId !== "string" ||
				image.assetId.length === 0 ||
				typeof image.deliveryUrl !== "string" ||
				!isValidDeliveryUrl(image.deliveryUrl) ||
				typeof image.blurDataUrl !== "string" ||
				image.blurDataUrl.length === 0
			) {
				return null
			}

			const sortOrder =
				typeof image.sortOrder === "number" && Number.isFinite(image.sortOrder)
					? Math.max(0, Math.floor(image.sortOrder))
					: index

			return {
				assetId: image.assetId,
				deliveryUrl: image.deliveryUrl,
				blurDataUrl: image.blurDataUrl,
				sortOrder,
			}
		})
		.filter(
			(
				entry,
			): entry is {
				assetId: string
				deliveryUrl: string
				blurDataUrl: string
				sortOrder: number
			} => Boolean(entry),
		)
		.sort((left, right) => left.sortOrder - right.sortOrder)

	const first = normalized[0]
	if (!first) {
		return null
	}

	return {
		assetId: first.assetId,
		deliveryUrl: first.deliveryUrl,
		blurDataUrl: first.blurDataUrl,
	}
}

export async function getRentalVehicleSummary(
	organizationId: string,
	vehicleId: string,
) {
	const vehicleRows = await db
		.select({
			id: vehicle.id,
			branchId: vehicle.branchId,
			vehicleClassId: vehicle.vehicleClassId,
			vehicleClassName: vehicleClass.name,
			vehicleClassCode: vehicleClass.code,
			year: vehicle.year,
			licensePlate: vehicle.licensePlate,
			status: vehicle.status,
			transmission: vehicle.transmission,
			seats: vehicle.seats,
			brandName: vehicleBrand.name,
			modelName: vehicleModel.name,
			images: vehicle.images,
			latestConditionSnapshot: vehicle.latestConditionSnapshot,
		})
		.from(vehicle)
		.innerJoin(vehicleBrand, eq(vehicle.brandId, vehicleBrand.id))
		.innerJoin(vehicleModel, eq(vehicle.modelId, vehicleModel.id))
		.leftJoin(vehicleClass, eq(vehicle.vehicleClassId, vehicleClass.id))
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
		id: vehicleRecord.id,
		label: `${vehicleRecord.year} ${vehicleRecord.brandName} ${vehicleRecord.modelName}`,
		licensePlate: vehicleRecord.licensePlate,
		status: vehicleRecord.status,
		branchId: vehicleRecord.branchId,
		vehicleClassId: vehicleRecord.vehicleClassId,
		vehicleClassName: vehicleRecord.vehicleClassName,
		vehicleClassCode: vehicleRecord.vehicleClassCode,
		transmission: vehicleRecord.transmission,
		seats: vehicleRecord.seats,
		frontImage: normalizeFrontImageForSummary(vehicleRecord.images),
		latestConditionSnapshot: mapVehicleConditionSnapshot(
			vehicleRecord.latestConditionSnapshot,
		),
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

export async function getCustomerForFinalize(
	organizationId: string,
	customerId: string,
) {
	const rows = await db
		.select({
			id: customer.id,
			fullName: customer.fullName,
			email: customer.email,
			phone: customer.phone,
			stripeCustomerId: customer.stripeCustomerId,
		})
		.from(customer)
		.where(
			and(
				eq(customer.organizationId, organizationId),
				eq(customer.id, customerId),
			),
		)
		.limit(1)

	return rows[0] ?? null
}

export async function getLatestPendingSchedule(
	organizationId: string,
	rentalId: string,
) {
	const rows = await db
		.select()
		.from(rentalPaymentSchedule)
		.where(
			and(
				eq(rentalPaymentSchedule.organizationId, organizationId),
				eq(rentalPaymentSchedule.rentalId, rentalId),
			),
		)
		.orderBy(rentalPaymentSchedule.sequence)

	return (
		rows.find((row) => row.status === "pending" || row.status === "failed") ??
		null
	)
}
